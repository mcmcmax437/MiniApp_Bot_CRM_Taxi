/**
 * Ensure local MySQL is running (Docker Compose). Exits when the port is ready.
 */
import { spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, ".env") });

const PORT = Number(process.env.LOCAL_DB_PORT || 3306);
const USER = process.env.MYSQL_USER || "taxi";
const PASSWORD = process.env.MYSQL_PASSWORD || "taxi";
const DB = process.env.MYSQL_DATABASE || "taxi";

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.on("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function waitForPort(port, timeoutMs = 120_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = createConnection({ port, host: "127.0.0.1" });
      socket.on("connect", () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for MySQL on port ${port}`));
          return;
        }
        setTimeout(tryConnect, 500);
      });
    };
    tryConnect();
  });
}

async function main() {
  if (await isPortOpen(PORT)) {
    console.log(`MySQL already running on port ${PORT}.`);
  } else {
    console.log("Starting MySQL via Docker Compose (first run may download the image)…");
    const result = spawnSync("docker", ["compose", "up", "-d", "db"], {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (result.status !== 0) {
      console.error("");
      console.error("Could not start MySQL via Docker (is Docker Desktop installed?).");
      console.error(`If MySQL is already running on port ${PORT}, fix auth for Prisma:`);
      console.error("  npm run db:auth-help -w @taxi/api");
      console.error("");
      process.exit(1);
    }
    console.log("Waiting for MySQL to accept connections…");
    await waitForPort(PORT);
  }

  console.log("");
  console.log(`MySQL is ready on port ${PORT}.`);
  console.log(`DATABASE_URL=mysql://${USER}:${PASSWORD}@localhost:${PORT}/${DB}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
