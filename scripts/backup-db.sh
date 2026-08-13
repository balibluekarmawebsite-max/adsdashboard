#!/usr/bin/env bash
# Nightly PostgreSQL backup (gzip pg_dump) with retention. Reads DATABASE_URL
# from the app .env. Schedule via cron (see docs/DEPLOYMENT.md).
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/usr/pgsql-16/bin:$PATH"

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$APP_DIR/.env"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/adsdashboard}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"

[ -f "$ENV_FILE" ] || { echo "No .env at $ENV_FILE"; exit 1; }

# Extract DATABASE_URL and strip any surrounding quotes.
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
DATABASE_URL="${DATABASE_URL%\"}"
DATABASE_URL="${DATABASE_URL#\"}"
[ -n "$DATABASE_URL" ] || { echo "DATABASE_URL not set in $ENV_FILE"; exit 1; }

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/adsdashboard-$STAMP.sql.gz"

pg_dump "$DATABASE_URL" | gzip -9 >"$OUT"
find "$BACKUP_DIR" -name 'adsdashboard-*.sql.gz' -mtime +"$RETAIN_DAYS" -delete

echo "Backup written: $OUT ($(du -h "$OUT" | cut -f1))"
