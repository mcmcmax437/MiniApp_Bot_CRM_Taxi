#!/usr/bin/env bash
# Runs ON the VPS after git pull. Called by GitHub Actions or manually.
set -euo pipefail

APP_DIR="${VPS_APP_DIR:-/usr/src/taxi-crm-miniApp/MiniApp_Bot_CRM_Taxi}"
BRANCH="${DEPLOY_BRANCH:-main}"
LOCK_SHA_FILE=".deploy-npm-lock-sha"
PM2_APP_NAMES=(taxi-api taxi-bot)

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env — create it once on the server (not in git)."
  exit 1
fi

if [[ ! -d .git ]]; then
  echo "Not a git repo. Run: bash scripts/vps-git-bootstrap.sh"
  exit 1
fi

echo "==> Pull $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> Apply production .env (VPS_MYSQL_* → MYSQL_*)"
node scripts/vps-apply-production-env.mjs

lockfile_sha() {
  sha256sum package-lock.json | awk '{print $1}'
}

deps_current() {
  [[ -d node_modules ]] || return 1
  [[ -f node_modules/.package-lock.json ]] || return 1
  [[ -f "$LOCK_SHA_FILE" ]] || return 1
  [[ "$(cat "$LOCK_SHA_FILE")" == "$(lockfile_sha)" ]]
}

# Small VPS (1 GB) OOM-kills `npm ci` (exit 137). Swap lets install/build finish.
ensure_swap() {
  local mem_kb swap_kb
  mem_kb=$(awk '/MemTotal:/ {print $2}' /proc/meminfo)
  swap_kb=$(awk '/SwapTotal:/ {print $2}' /proc/meminfo)
  if [[ "${swap_kb:-0}" -ge 1048576 ]]; then
    return 0
  fi
  if [[ "${mem_kb:-0}" -ge 2097152 ]]; then
    return 0
  fi
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "==> Low RAM ($((mem_kb / 1024)) MB) and not root — cannot add swap"
    return 0
  fi
  echo "==> Adding 2G swap ($((mem_kb / 1024)) MB RAM, $((swap_kb / 1024)) MB swap)"
  if [[ ! -f /swapfile ]]; then
    if command -v fallocate >/dev/null 2>&1; then
      fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
    else
      dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
    fi
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile 2>/dev/null || true
  if [[ -w /etc/fstab ]] && ! grep -q '^/swapfile ' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
}

# Cap Node so one process cannot eat the whole box; swap covers the rest.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=384}"
export npm_config_audit=false
export npm_config_fund=false
export npm_config_progress=false

ensure_swap || true

if deps_current; then
  echo "==> Dependencies unchanged — skip npm install"
else
  echo "==> Install dependencies (pause app to free RAM)"
  for pm2_app in "${PM2_APP_NAMES[@]}"; do
    pm2 stop "$pm2_app" || true
  done
  # Incremental install: `npm ci` deletes node_modules first and often OOM-kills 1 GB boxes.
  npm install --no-audit --no-fund --no-progress
  lockfile_sha > "$LOCK_SHA_FILE"
fi

echo "==> Prisma + database"
npm run prisma:generate -w @taxi/api
NODE_ENV=production npm run db:sync -w @taxi/api

echo "==> Build Mini App"
VITE_API_BASE=/api npm run build -w @taxi/miniapp

# nginx (www-data) must traverse the project root to serve dist/
chmod o+rx "$APP_DIR"
chmod -R a+rX apps/miniapp/dist

mkdir -p apps/api/uploads

echo "==> Restart PM2"
pm2 startOrReload deploy/ecosystem.config.cjs
pm2 save

echo "==> Deploy done ($(git rev-parse --short HEAD))"
