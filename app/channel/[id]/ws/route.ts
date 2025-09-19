import { maybeStartImplementation } from "@/lib/durable-channel/base";
import { startSandboxServer } from "@/lib/durable-channel/sandbox-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const domain = await startSandboxServer();
  await maybeStartImplementation(id);
  const serverUrl = new URL(domain);
  const url = `wss://${serverUrl.host}/?channelId=${id}`;
  console.log(`WebSocket URL: ${url}`);
  return Response.json({
    url,
  });
}
