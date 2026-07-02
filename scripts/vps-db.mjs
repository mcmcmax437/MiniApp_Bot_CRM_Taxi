/**
 * SSH tunnel to MySQL on the VPS, then test or sync the schema.
 *
 * Uses your SSH config host alias by default:  ssh vps
 *
 * Optional .env overrides:
 *   VPS_SSH_TARGET=vps
 *   VPS_MYSQL_PORT=3306
 *   VPS_TUNNEL_LOCAL_PORT=3307
 *   VPS_SSH_KEY=C:\Users\you\.ssh\id_rsa
 *
 * Usage:
 *   npm run db:vps:test
 *   npm run db:vps:sync
 *   npm run db:vps:fix-expense-payer
 *   npm run db:vps:tunnel
 */
import { spawn, spawnSync } from "node:child_process";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(rootDir, ".env") });

const sshTarget = process.env.VPS_SSH_TARGET?.trim() || process.env.VPS_SSH_HOST?.trim() || "vps";
const sshPort = process.env.VPS_SSH_PORT?.trim();
const sshKey = process.env.VPS_SSH_KEY?.trim();
const remoteMysqlPort = process.env.VPS_MYSQL_PORT?.trim() || "3306";
const localPort = process.env.VPS_TUNNEL_LOCAL_PORT?.trim() || "3307";

const mode = process.argv[2] || "test";

function buildSshArgs() {
  const args = [
    "-N",
    "-L",
    `${localPort}:127.0.0.1:${remoteMysqlPort}`,
    "-o",
    "ServerAliveInterval=30",
    "-o",
    "StrictHostKeyChecking=accept-new",
  ];
  if (sshPort) args.push("-p", sshPort);
  if (sshKey) args.push("-i", sshKey);
  args.push(sshTarget);
  return args;
}

function waitForPort(port, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const sock = spawnSync(
        process.platform === "win32" ? "powershell" : "sh",
        process.platform === "win32"
          ? [
              "-NoProfile",
              "-Command",
              `try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', ${port}); $c.Close(); exit 0 } catch { exit 1 }`,
            ]
          : ["-c", `nc -z 127.0.0.1 ${port}`],
        { stdio: "ignore" },
      );
      if (sock.status === 0) return resolve();
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Tunnel port ${port} did not open in time`));
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

async function withTunnel(run) {
  const ssh = spawn("ssh", buildSshArgs(), { stdio: "inherit" });
  let closed = false;

  const cleanup = () => {
    if (!closed) {
      closed = true;
      ssh.kill("SIGTERM");
    }
  };

  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.on("exit", cleanup);

  ssh.on("error", (err) => {
    console.error("SSH failed:", err.message);
    cleanup();
    process.exit(1);
  });

  ssh.on("exit", (code) => {
    if (!closed && code !== 0 && code !== null) {
      console.error(`SSH tunnel exited with code ${code}`);
      process.exit(code ?? 1);
    }
  });

  console.log(`Opening SSH tunnel via "${sshTarget}" …`);
  console.log(`  127.0.0.1:${localPort} → remote 127.0.0.1:${remoteMysqlPort}\n`);
  await waitForPort(Number(localPort));
  console.log("Tunnel is up.\n");

  try {
    await run();
  } finally {
    cleanup();
  }
}

function tunnelEnv() {
  const user = process.env.VPS_MYSQL_USER?.trim() || process.env.MYSQL_USER || "taxi";
  const password = process.env.VPS_MYSQL_PASSWORD?.trim() || process.env.MYSQL_PASSWORD || "";
  const database = process.env.VPS_MYSQL_DATABASE?.trim() || process.env.MYSQL_DATABASE || "taxi";

  return {
    ...process.env,
    MYSQL_HOST: "127.0.0.1",
    LOCAL_DB_PORT: localPort,
    MYSQL_USER: user,
    MYSQL_PASSWORD: password,
    MYSQL_DATABASE: database,
    DATABASE_URL: undefined,
  };
}

async function runTest() {
  await withTunnel(() => {
    console.log("Testing MySQL through tunnel…");
    const res = spawnSync("npm", ["run", "db:ping", "-w", "@taxi/api"], {
      cwd: rootDir,
      env: tunnelEnv(),
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    process.exit(res.status ?? 1);
  });
}

async function runSync() {
  await withTunnel(() => {
    console.log("Syncing Prisma schema to VPS MySQL…");
    const res = spawnSync("npm", ["run", "db:sync", "-w", "@taxi/api"], {
      cwd: rootDir,
      env: tunnelEnv(),
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    process.exit(res.status ?? 1);
  });
}

async function runFixExpensePayer() {
  await withTunnel(() => {
    console.log("Adding missing Expense.paidByFather on VPS (additive only)…");
    const res = spawnSync("npm", ["run", "db:fix:expense-payer", "-w", "@taxi/api"], {
      cwd: rootDir,
      env: { ...tunnelEnv(), USE_VPS_TUNNEL: "1" },
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    process.exit(res.status ?? 1);
  });
}

function runTunnelForeground() {
  console.log(`SSH tunnel via "${sshTarget}": 127.0.0.1:${localPort} → remote:${remoteMysqlPort}`);
  console.log("Press Ctrl+C to close.\n");
  const res = spawnSync("ssh", buildSshArgs(), { stdio: "inherit" });
  process.exit(res.status ?? 1);
}

if (mode === "tunnel") {
  runTunnelForeground();
} else if (mode === "sync") {
  await runSync();
} else if (mode === "fix-expense-payer") {
  await runFixExpensePayer();
} else if (mode === "test") {
  await runTest();
} else {
  console.error("Usage: node scripts/vps-db.mjs [test|sync|fix-expense-payer|tunnel]");
  process.exit(1);
}
