import { Sandbox } from "@vercel/sandbox";
import { createClient } from "redis";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not set");
}

const redisClient = createClient({
  url: process.env.REDIS_URL,
});
const redisPromise = redisClient.connect();

const timeout = 1000 * 60 * 15;

const VERSION = "9";

function getSandboxKey() {
  return `durable-channel:sandbox:${VERSION}:${
    process.env.VERCEL_PROJECT_ID || "local"
  }:${process.env.VERCEL_TARGET_ENV || "dev"}`;
}

export async function startSandboxServer() {
  await redisPromise;
  const active = await redisClient.get(getSandboxKey());
  if (active === "pending") {
    console.log("Polling for sandbox server");
    return new Promise(async (resolve) => {
      while (true) {
        // TODO Add a timeout
        const active = await redisClient.get(getSandboxKey());
        if (active && active !== "pending") {
          const { domain, expiresAt } = JSON.parse(active);
          resolve(domain);
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    });
  }
  if (active) {
    const { domain, expiresAt } = JSON.parse(active);
    if (expiresAt > Date.now()) {
      console.log("Sandbox server is active", domain);
      return domain;
    }
  }
  await redisClient.set(getSandboxKey(), "pending");

  console.log(`Starting sandbox server...`);
  const sandbox = await Sandbox.create({
    source: {
      url: "https://github.com/uncurated-tests/durable-channel.git",
      type: "git",
    },
    resources: { vcpus: 4 },
    timeout,
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
  const startPromise = sandbox.runCommand({
    cmd: "pnpm",
    args: ["websocket"],
    detached: true,
    env: {
      VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID || "local",
      VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV || "dev",
      REDIS_URL: process.env.REDIS_URL || "required",
    },
  });
  startPromise.then(async (cmd) => {
    for await (const log of cmd.logs()) {
      if (log.stream === "stdout") {
        process.stdout.write(log.data);
      } else {
        process.stderr.write(log.data);
      }
    }
  });
  startPromise.catch(async (error) => {
    console.error("Starting server failed", error);
    await redisClient.del(getSandboxKey());
  });
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await redisClient.set(
    getSandboxKey(),
    JSON.stringify({
      domain: sandbox.domain(9000),
      expiresAt: Date.now() + timeout,
    })
  );

  return sandbox.domain(9000);
}
