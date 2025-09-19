export interface DurableChannelInterface {
  POST: (request: Request) => Promise<Response | void>;
  GET: (request: Request) => Promise<Response>;
}

export class Durable implements DurableChannelInterface {
  constructor(
    protected readonly channelId: string,
    private readonly publishToSubscribers: (
      channelId: string,
      message: string
    ) => Promise<void>
  ) {}

  async broadcast(message: string) {
    await this.publishToSubscribers(this.channelId, message);
  }

  async POST(request: Request): Promise<Response | void> {
    throw new Error("Not implemented");
  }

  async GET(request: Request): Promise<Response> {
    throw new Error("Not implemented");
  }

  async onStart() {}

  async onHibernate() {}

  async onMessage(message: string) {}
}
