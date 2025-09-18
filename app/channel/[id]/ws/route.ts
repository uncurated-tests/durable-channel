import { startSandboxServer } from "@/lib/durable-channel/sandbox-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const domain = await startSandboxServer();
  const url = `wss://${domain}/?channelId=${id}`;
  console.log(`WebSocket URL: ${url}`);
  return Response.json({
    url,
  });
}
