import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./env.js";
import { registerRoutes } from "./routes/index.js";
import { startScheduler } from "./scheduler.js";
import { prisma } from "./prisma.js";

// Make BigInt JSON-serializable (Owner.telegramUserId).
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: env.nodeEnv === "development" ? "info" : "warn",
      transport:
        env.nodeEnv === "development"
          ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: env.corsOrigins.length ? env.corsOrigins : true,
    credentials: true,
  });

  await app.register(multipart, {
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  });

  app.get("/health", async () => ({ ok: true, time: new Date().toISOString() }));

  await registerRoutes(app);

  if (env.runScheduler) {
    startScheduler(app.log);
  }

  try {
    await app.listen({ port: env.port, host: "0.0.0.0" });
    app.log.info(`API listening on port ${env.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
