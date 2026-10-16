import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const updateScript = path.join(repoRoot, "scripts", "vps-update.sh");

function hashPackageLock(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function writeExecutable(filePath, content) {
  writeFileSync(filePath, content, { mode: 0o755 });
}

async function createFakeApp({
  packageLock = '{"lockfileVersion":3}\n',
  lockSha,
  hasNodeModules = true,
  lowMemoryNonRoot = false,
} = {}) {
  const appDir = mkdtempSync(path.join(tmpdir(), "taxi-vps-update-"));
  const binDir = path.join(appDir, "bin");
  const logPath = path.join(appDir, "commands.log");

  await mkdir(path.join(appDir, ".git"), { recursive: true });
  await mkdir(path.join(appDir, "scripts"), { recursive: true });
  await mkdir(path.join(appDir, "apps", "miniapp", "dist"), { recursive: true });
  await mkdir(binDir, { recursive: true });

  writeFileSync(path.join(appDir, ".env"), "BOT_TOKEN=test\n");
  writeFileSync(path.join(appDir, "package-lock.json"), packageLock);
  if (hasNodeModules) {
    await mkdir(path.join(appDir, "node_modules"), { recursive: true });
    writeFileSync(path.join(appDir, "node_modules", ".package-lock.json"), "{}\n");
  }
  if (lockSha != null) {
    writeFileSync(path.join(appDir, ".deploy-npm-lock-sha"), `${lockSha}\n`);
  }

  await writeExecutable(
    path.join(binDir, "git"),
    `#!/usr/bin/env bash
echo "git $*" >> "${logPath}"
if [[ "$1 $2 $3" == "rev-parse --short HEAD" ]]; then
  echo "abc123"
fi
`,
  );
  await writeExecutable(
    path.join(binDir, "node"),
    `#!/usr/bin/env bash
echo "node $*" >> "${logPath}"
`,
  );
  await writeExecutable(
    path.join(binDir, "npm"),
    `#!/usr/bin/env bash
echo "npm NODE_OPTIONS=$NODE_OPTIONS audit=$npm_config_audit fund=$npm_config_fund progress=$npm_config_progress $*" >> "${logPath}"
`,
  );
  await writeExecutable(
    path.join(binDir, "pm2"),
    `#!/usr/bin/env bash
echo "pm2 $*" >> "${logPath}"
`,
  );
  await writeExecutable(
    path.join(binDir, "chmod"),
    `#!/usr/bin/env bash
echo "chmod $*" >> "${logPath}"
`,
  );

  if (lowMemoryNonRoot) {
    await writeExecutable(
      path.join(binDir, "awk"),
      `#!/usr/bin/env bash
if [[ "$*" == *"/proc/meminfo"* && "$1" == *"MemTotal:"* ]]; then
  echo "1048576"
  exit 0
fi
if [[ "$*" == *"/proc/meminfo"* && "$1" == *"SwapTotal:"* ]]; then
  echo "0"
  exit 0
fi
exec /usr/bin/awk "$@"
`,
    );
    await writeExecutable(
      path.join(binDir, "id"),
      `#!/usr/bin/env bash
if [[ "$1" == "-u" ]]; then
  echo "1000"
  exit 0
fi
exec /usr/bin/id "$@"
`,
    );
  }

  return {
    appDir,
    binDir,
    logPath,
    packageLock,
    cleanup: () => rmSync(appDir, { recursive: true, force: true }),
  };
}

function runUpdate(fakeApp, extraEnv = {}) {
  return spawnSync("bash", [updateScript], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...extraEnv,
      PATH: `${fakeApp.binDir}:${process.env.PATH}`,
      VPS_APP_DIR: fakeApp.appDir,
      DEPLOY_BRANCH: "main",
    },
  });
}

function commandLog(fakeApp) {
  return readFileSync(fakeApp.logPath, "utf8").trim().split("\n").filter(Boolean);
}

test("vps-update skips npm install when node_modules matches package-lock", async () => {
  const packageLock = '{"name":"taxi","lockfileVersion":3}\n';
  const fakeApp = await createFakeApp({
    packageLock,
    lockSha: hashPackageLock(packageLock),
  });

  try {
    const result = runUpdate(fakeApp);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Dependencies unchanged .* skip npm install/);

    const log = commandLog(fakeApp);
    assert.ok(log.includes("git fetch origin main"));
    assert.ok(log.includes("git checkout main"));
    assert.ok(log.includes("git pull --ff-only origin main"));
    assert.ok(log.some((line) => line === "node scripts/vps-apply-production-env.mjs"));
    assert.ok(!log.some((line) => line.includes("npm ") && line.includes(" install ")));
    assert.ok(!log.includes("pm2 stop all"));
    assert.ok(log.some((line) => line.endsWith(" run prisma:generate -w @taxi/api")));
    assert.ok(log.some((line) => line.includes("pm2 startOrReload deploy/ecosystem.config.cjs")));
  } finally {
    fakeApp.cleanup();
  }
});

test("vps-update pauses PM2, installs with low-memory flags, and records the new lock hash", async () => {
  const packageLock = '{"name":"taxi","packages":{"":{"version":"1.0.0"}}}\n';
  const fakeApp = await createFakeApp({
    packageLock,
    lockSha: "stale-lock",
    lowMemoryNonRoot: true,
  });

  try {
    const result = runUpdate(fakeApp, { NODE_OPTIONS: "" });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Low RAM \(1024 MB\) and not root .* cannot add swap/);

    const log = commandLog(fakeApp);
    const stopIndex = log.indexOf("pm2 stop all");
    const installIndex = log.findIndex(
      (line) =>
        line ===
        "npm NODE_OPTIONS=--max-old-space-size=384 audit=false fund=false progress=false install --no-audit --no-fund --no-progress",
    );
    assert.notEqual(stopIndex, -1);
    assert.notEqual(installIndex, -1);
    assert.ok(stopIndex < installIndex);

    const writtenSha = readFileSync(path.join(fakeApp.appDir, ".deploy-npm-lock-sha"), "utf8").trim();
    assert.equal(writtenSha, hashPackageLock(packageLock));
  } finally {
    fakeApp.cleanup();
  }
});
