#!/usr/bin/env node

import { createServer } from "http";
import { WebSocketServer } from "ws";
import { createClient } from "redis";
import { URL } from "url";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not set");
}

const redisSubscriber = createClient({
  url: process.env.REDIS_URL,
});
const redisPublisher = createClient({
  url: process.env.REDIS_URL,
});

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

async function startWebSocketServer(port: number = 8080) {
  await Promise.all([redisSubscriber.connect(), redisPublisher.connect()]);

  const server = createServer();
  const wss = new WebSocketServer({ server });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url!, `https://${req.headers.host}`);
    const channelId = url.searchParams.get("channelId");

    if (!channelId) {
      ws.close(4000, "Missing channelId query parameter");
      return;
    }

    console.log(`[ws] WebSocket connected for channel: ${channelId}`);

    const publishTopic = getChannelKey(channelId, "publish");
    const subscribeTopic = getChannelKey(channelId, "subscribe");

    const messageHandler = (message: string) => {
      console.log(`[ws] Received message for channel ${channelId}: ${message}`);
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
      } else {
        console.log(`[ws] WebSocket not open for channel ${channelId}`);
      }
    };

    await redisSubscriber.subscribe(subscribeTopic, messageHandler);

    ws.on("message", async (data) => {
      try {
        const message = data.toString();
        console.log(
          `[ws] Received message for channel ${channelId}: ${message}`
        );

        await redisPublisher.publish(
          publishTopic,
          JSON.stringify({ type: "POST", message })
        );
        console.log(`[ws] Published message to ${publishTopic}: ${message}`);
      } catch (error) {
        console.error("[ws] Error handling message:", error);
      }
    });

    ws.on("close", async () => {
      console.log(`[ws] WebSocket disconnected for channel: ${channelId}`);
      try {
        await redisSubscriber.unsubscribe(subscribeTopic);
      } catch (error) {
        console.error("[ws] Error unsubscribing:", error);
      }
    });

    ws.on("error", (error) => {
      console.error(`[ws] WebSocket error for channel ${channelId}:`, error);
    });
  });

  server.listen(port, () => {
    console.log(`[ws] WebSocket server started on port ${port}`);
    console.log(
      `Connect with: ws://localhost:${port}?channelId=your-channel-id`
    );
  });

  const cleanup = async () => {
    console.log("[ws] Shutting down WebSocket server...");
    wss.close();
    server.close();
    await redisSubscriber.quit();
    await redisPublisher.quit();
    process.exit(0);
  };

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
}

if (require.main === module) {
  const port = parseInt(process.argv[2]) || 9000;
  startWebSocketServer(port).catch(console.error);
}

export { startWebSocketServer };
