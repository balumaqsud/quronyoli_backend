#!/bin/sh
set -eu

LOG_DIR="${LOG_DIR:-/app/logs}"
UPLOADS_DIR="${UPLOADS_DIR:-/app/uploads}"
mkdir -p "$LOG_DIR" "$UPLOADS_DIR"

echo "[entrypoint] Waiting for PostgreSQL..."
ATTEMPTS=0
MAX_ATTEMPTS=30
until node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query('SELECT 1'))
  .then(() => client.end())
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
"; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "[entrypoint] PostgreSQL is not reachable after ${MAX_ATTEMPTS} attempts" >&2
    exit 1
  fi
  echo "[entrypoint] PostgreSQL not ready (attempt ${ATTEMPTS}/${MAX_ATTEMPTS}), retrying..."
  sleep 2
done
echo "[entrypoint] PostgreSQL is ready"

echo "[entrypoint] Running Prisma migrations (deploy only)..."
npx prisma migrate deploy
echo "[entrypoint] Migrations applied"

echo "[entrypoint] Seeding database if empty..."
npx prisma db seed
echo "[entrypoint] Seed step finished"

echo "[entrypoint] Starting NestJS..."
exec "$@"
