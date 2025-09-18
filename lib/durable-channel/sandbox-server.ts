import { Sandbox } from "@vercel/sandbox";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not set");
}

export async function startSandboxServer() {
  const sandbox = await Sandbox.create({
    source: {
      url: "git@github.com:uncurated-tests/durable-channel.git",
      type: "git",
    },
    resources: { vcpus: 4 },
    timeout: 1000 * 60 * 2,
    ports: [9000],
    runtime: "node22",
  });

  console.log(`Installing dependencies...`);
  const install = await sandbox.runCommand({
    cmd: "pnpm",
    args: ["install"],
    stderr: process.stderr,
    stdout: process.stdout,
    env: {
      CI: "1",
    },
  });

  if (install.exitCode != 0) {
    console.log("installing packages failed");
    process.exit(1);
  }

  console.log(`Starting server...`);
  await sandbox.runCommand({
    cmd: "pnpm",
    args: ["websocket"],
    detached: true,
    env: {
      VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID || "local",
      VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV || "dev",
      REDIS_URL: process.env.REDIS_URL || "required",
    },
  });

  return sandbox.domain(9000);
}
