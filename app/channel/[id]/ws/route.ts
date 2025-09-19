import { maybeStartImplementation } from "@/lib/durable-channel/base";
import { jweEncrypt } from "@/lib/durable-channel/jwe";
import { startSandboxServer } from "@/lib/durable-channel/sandbox-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const domain = await startSandboxServer();
  await maybeStartImplementation(id);
  const serverUrl = new URL(domain);
  const jwe = jweEncrypt({
    channelId: id,
    projectId: process.env.VERCEL_PROJECT_ID || "local",
    targetEnv: process.env.VERCEL_TARGET_ENV || "dev",
  });
  const url = `wss://${serverUrl.host}/?jwe=${encodeURIComponent(jwe)}`;
  console.log(`WebSocket URL: ${url}`);
  return Response.json({
    url,
  });
}
