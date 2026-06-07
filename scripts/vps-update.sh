#!/usr/bin/env bash
# Runs ON the VPS after git pull. Called by GitHub Actions or manually.
set -euo pipefail

APP_DIR="${VPS_APP_DIR:-/usr/src/taxi-crm-miniApp/MiniApp_Bot_CRM_Taxi}"
BRANCH="${DEPLOY_BRANCH:-main}"

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

echo "==> Install dependencies"
npm ci

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
