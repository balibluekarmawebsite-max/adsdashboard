#!/usr/bin/env bash
# Server-side deploy: pull the deploy branch, install, migrate, build, reload.
# Run by GitHub Actions over SSH (or by hand). Safe to re-run.
set -euo pipefail

# Make sure system node / npm / pm2 are on PATH for non-interactive SSH shells.
export PATH="/usr/local/bin:/usr/bin:$HOME/.local/bin:$PATH"

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

BRANCH="${DEPLOY_BRANCH:-main}"

echo "==> Fetching origin/$BRANCH"
git fetch --all --prune
git reset --hard "origin/$BRANCH"

echo "==> Installing dependencies (npm ci)"
npm ci

echo "==> Applying database migrations"
npx prisma migrate deploy

echo "==> Building"
npm run build

echo "==> Reloading PM2"
pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs
pm2 save

echo "==> Deployed $(git rev-parse --short HEAD) on $BRANCH"
