import DurableChat from "@/app/chat/durable";
import { nanoid } from "nanoid";
import { after } from "next/server";
import { createClient } from "redis";
import { DurableChannelInterface } from ".";
import { Durable } from ".";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not set");
}

const redisSubscriber = createClient({
  url: process.env.REDIS_URL,
});
const redisPublisher = createClient({
  url: process.env.REDIS_URL,
});

const subscribePromise = redisSubscriber.connect();
const publishPromise = redisPublisher.connect();

const tenantId =
  (process.env.VERCEL_PROJECT_ID || "local") +
  ":" +
  (process.env.VERCEL_TARGET_ENV || "dev");

function getChannelKey(
  channelId: string,
  purpose: "publish" | "subscribe" | "instance"
) {
  return `durable-channel:${tenantId}:${channelId}:${purpose}`;
}

function getMessageKey(channelId: string, messageId: string) {
  return `durable-channel:${tenantId}:${channelId}:message:${messageId}`;
}

export const subscribeChannelMessages = async (
  channelId: string,
  cb: (message: string) => void,
  timeout: number
) => {
  await redisSubscriber.subscribe(
    getChannelKey(channelId, "subscribe"),
    (message) => {
      cb(message);
    }
  );
  return new Promise((resolve) => {
    setTimeout(async () => {
      await redisSubscriber.unsubscribe(getChannelKey(channelId, "subscribe"));
      resolve(true);
    }, timeout);
  });
};

export const publishToSubscribers = async (
  channelId: string,
  message: string
) => {
  log(`Publishing message to channel ${channelId} ${message}`);
  await redisPublisher.publish(getChannelKey(channelId, "subscribe"), message);
};

const activeDurables = new Map<string, DurableChannelHolder>();

export const durablePOST = async (channelId: string, request: Request) => {
  const impl = await maybeStartImplementation(channelId);
  return impl.POST(request);
};

export const durableGET = async (channelId: string, request: Request) => {
  const impl = await maybeStartImplementation(channelId);
  return impl.GET(request);
};

export async function maybeStartImplementation(
  channelId: string
): Promise<DurableChannelInterface> {
  if (activeDurables.has(channelId)) {
    log(`Current worker is assigned to channel ${channelId}`);
    const holder = activeDurables.get(channelId)!;
    after(holder.scheduleCleanup());
    return holder.impl;
  }
  await Promise.all([publishPromise, subscribePromise]);
  const isActive = await redisPublisher.incr(
    getChannelKey(channelId, "instance")
  );
  if (isActive > 1) {
    log(`Another worker is assigned to channel ${channelId}`);
    const messageId = nanoid();
    return {
      POST: async (request: Request) => {
        return new Promise((resolve) => async () => {
          await redisSubscriber.subscribe(
            getMessageKey(channelId, messageId),
            async (message: string) => {
              log(
                `[Remote] Received POST response message for channel ${channelId} ${message}`
              );
              await redisSubscriber.unsubscribe(
                getMessageKey(channelId, messageId)
              );
              const { result } = JSON.parse(message);
              resolve(result);
            }
          );
          await redisPublisher.publish(
            getChannelKey(channelId, "publish"),
            JSON.stringify({
              messageId,
              type: "POST",
              // TODO serialize request
              message: await request.text(),
            })
          );
        });
      },
      GET: async () => {
        return new Promise((resolve) => async () => {
          await redisSubscriber.subscribe(
            getMessageKey(channelId, messageId),
            async (message: string) => {
              log(
                `[Remote] Received GET response message for channel ${channelId}`
              );
              await redisSubscriber.unsubscribe(
                getMessageKey(channelId, messageId)
              );
              const { result } = JSON.parse(message);
              resolve(result);
            }
          );
          await redisPublisher.publish(
            getChannelKey(channelId, "publish"),
            JSON.stringify({
              messageId,
              type: "GET",
            })
          );
        });
      },
    };
  }
  return startImplementation(channelId);
}

async function startImplementation(
  channelId: string
): Promise<DurableChannelInterface> {
  log(`Starting worker for channel ${channelId}`);
  await redisSubscriber.subscribe(
    getChannelKey(channelId, "publish"),
    async (redisMessage: string) => {
      log(`Received publish message for channel ${channelId} ${redisMessage}`);
      const { message, messageId, type } = JSON.parse(redisMessage);
      const holder = activeDurables.get(channelId)!;
      const result = await (type === "POST"
        ? holder.impl.POST
        : holder.impl.GET
      ).call(
        holder.impl,
        new Request("http://localhost", { method: "POST", body: message })
      );
      const body = result ? await result.text() : null;
      log(`Sending response message for channel ${channelId} ${body}`);
      await redisPublisher.publish(
        getMessageKey(channelId, messageId),
        JSON.stringify({
          messageId,
          result: body,
        })
      );
    }
  );
  const impl = getImplementation(channelId);
  const holder: DurableChannelHolder = {
    impl,
    timeout: undefined,
    resolve: undefined,
    cleanedUp: false,
    scheduleCleanup: () => {
      return new Promise((resolve) => {
        if (holder.resolve) {
          holder.resolve(true);
        }
        holder.resolve = resolve;
        clearTimeout(holder.timeout);
        holder.timeout = setTimeout(async () => {
          await cleanup();
          resolve(true);
        }, 60000);
      });
    },
  };
  after(holder.scheduleCleanup());
  activeDurables.set(channelId, holder);
  const cleanup = async () => {
    if (holder.cleanedUp) {
      return;
    }
    log(`Cleaning up worker for channel ${channelId}`);
    holder.cleanedUp = true;
    if (holder.timeout) {
      clearTimeout(holder.timeout);
    }
    activeDurables.delete(channelId);
    process.removeListener("SIGTERM", cleanup);
    process.removeListener("SIGINT", cleanup);
    await Promise.all([
      impl.onHibernate(),
      redisSubscriber.unsubscribe(getChannelKey(channelId, "publish")),
      redisPublisher.del(getChannelKey(channelId, "instance")),
    ]);
  };
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
  await impl.onStart();
  return impl;
}

interface DurableChannelHolder {
  impl: DurableChannelInterface;
  timeout?: ReturnType<typeof setTimeout>;
  cleanedUp?: boolean;
  resolve?: (value: unknown) => void;
  scheduleCleanup: () => Promise<unknown>;
}

function getImplementation(channelId: string): Durable {
  const firstDash = channelId.indexOf("-");
  if (firstDash === -1) {
    throw new Error("Channel ID must contain a dash");
  }
  const type = channelId.substring(0, firstDash);
  if (type === "chat") {
    return new DurableChat(channelId, publishToSubscribers);
  }
  throw new Error(`Unknown channel type: ${type}`);
}

function log(message: string) {
  console.log(message);
}
