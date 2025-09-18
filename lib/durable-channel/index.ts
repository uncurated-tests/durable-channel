import { nanoid } from "nanoid";
import { after } from "next/server";
import { createClient } from "redis";

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
  await redisPublisher.publish(getChannelKey(channelId, "subscribe"), message);
};

const activeChannels = new Map<string, DurableChannelHolder>();

export const forwardChannelMessage = async (
  channelId: string,
  message: string
) => {
  const impl = await maybeStartImplementation(channelId);
  return impl.processMessageWithReturn(message);
};

export async function maybeStartImplementation(
  channelId: string
): Promise<DurableChannelInterface> {
  if (activeChannels.has(channelId)) {
    log(`Current worker is assigned to channel ${channelId}`);
    return activeChannels.get(channelId)!;
  }
  await Promise.all([publishPromise, subscribePromise]);
  const isActive = await redisPublisher.incr(
    getChannelKey(channelId, "instance")
  );
  if (isActive > 1) {
    log(`Another worker is assigned to channel ${channelId}`);
    const messageId = nanoid();
    return {
      processMessageWithReturn: async (message: string) => {
        return new Promise((resolve) => async () => {
          await redisSubscriber.subscribe(
            getMessageKey(channelId, messageId),
            async (message: string) => {
              log(
                `[Remote] Received response message for channel ${channelId} ${message}`
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
              message,
            })
          );
        });
      },
    };
  }
  return startImplementation(channelId);
}

async function startImplementation(channelId: string) {
  log(`Starting worker for channel ${channelId}`);
  await redisSubscriber.subscribe(
    getChannelKey(channelId, "publish"),
    async (redisMessage: string) => {
      log(`Received publish message for channel ${channelId} ${redisMessage}`);
      const { message, messageId } = JSON.parse(redisMessage);
      const impl = activeChannels.get(channelId)!;
      const result = await impl.processMessageWithReturn(message);
      log(`Sending response message for channel ${channelId} ${result}`);
      await redisPublisher.publish(
        getMessageKey(channelId, messageId),
        JSON.stringify({
          messageId,
          result,
        })
      );
    }
  );
  const impl = getImplementation(channelId);
  const holder: DurableChannelHolder = {
    timeout: undefined,
    resolve: undefined,
    cleanedUp: false,
    processMessageWithReturn: async (message) => {
      after(
        new Promise((resolve) => {
          if (holder.resolve) {
            holder.resolve(true);
          }
          holder.resolve = resolve;
          clearTimeout(holder.timeout);
          holder.timeout = setTimeout(async () => {
            await cleanup();
            resolve(true);
          }, 60000);
        })
      );
      return impl.processMessageWithReturn(message);
    },
  };
  activeChannels.set(channelId, holder);
  const cleanup = async () => {
    if (holder.cleanedUp) {
      return;
    }
    log(`Cleaning up worker for channel ${channelId}`);
    holder.cleanedUp = true;
    if (holder.timeout) {
      clearTimeout(holder.timeout);
    }
    await redisPublisher.del(getChannelKey(channelId, "instance"));
    activeChannels.delete(channelId);
    process.removeListener("SIGTERM", cleanup);
    process.removeListener("SIGINT", cleanup);
  };
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
  return holder;
}

interface DurableChannelHolder extends DurableChannelInterface {
  timeout?: ReturnType<typeof setTimeout>;
  cleanedUp?: boolean;
  resolve?: (value: unknown) => void;
}

interface DurableChannelInterface {
  processMessageWithReturn: (message: string) => Promise<unknown>;
}

function getImplementation(channelId: string): DurableChannelInterface {
  return {
    processMessageWithReturn: async (message: string) => {
      await publishToSubscribers(channelId, message);
      return message;
    },
  };
}

function log(message: string) {
  console.log(message);
}
