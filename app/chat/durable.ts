import { Durable } from "@/lib/durable-channel";
import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL,
});
const redisPromise = redis.connect();

export default class DurableChat extends Durable {
  private messages: string[] = [];

  async POST(request: Request) {
    const message = await request.text();
    this.messages.push(message);
    console.log("Broadcasting message", message, this.messages);
    await this.broadcast(message);
  }

  async GET() {
    return Response.json({ messages: this.messages });
  }

  async onStart() {
    await redisPromise;
    const messages = JSON.parse(
      (await redis.get(`demo:whatsapp:${this.channelId}:messages`)) || "[]"
    ) as string[];
    this.messages = messages;
    console.log("Starting chat", this.channelId, this.messages);
  }

  async onHibernate() {
    console.log("Hibernating chat", this.channelId);
    await redisPromise;
    await redis.set(
      `demo:whatsapp:${this.channelId}:messages`,
      JSON.stringify(this.messages)
    );
  }
}
