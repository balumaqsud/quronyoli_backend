#!/usr/bin/env bash
# Backup PostgreSQL, Redis, and uploads. Suitable for cron.
# Usage:
#   ./scripts/backup.sh
#   BACKUP_ROOT=/var/backups/quron-yoli ./scripts/backup.sh
#
# Cron example (daily 02:00):
#   0 2 * * * cd /opt/quron-yoli_backend && ./scripts/backup.sh >> logs/backup.log 2>&1

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

BACKUP_ROOT="${BACKUP_ROOT:-${ROOT_DIR}/backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${BACKUP_ROOT}/${TIMESTAMP}"
mkdir -p "$DEST"

COMPOSE_BIN="${COMPOSE_BIN:-docker compose}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
REDIS_SERVICE="${REDIS_SERVICE:-redis}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-quron_yoli}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

echo "[backup] Writing to ${DEST}"

echo "[backup] Dumping PostgreSQL..."
${COMPOSE_BIN} exec -T "$POSTGRES_SERVICE" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  > "${DEST}/postgres.dump"

echo "[backup] Triggering Redis BGSAVE and copying RDB..."
if [[ -n "$REDIS_PASSWORD" ]]; then
  ${COMPOSE_BIN} exec -T "$REDIS_SERVICE" redis-cli -a "$REDIS_PASSWORD" BGSAVE >/dev/null
else
  ${COMPOSE_BIN} exec -T "$REDIS_SERVICE" redis-cli BGSAVE >/dev/null
fi
# Allow BGSAVE to finish
sleep 2
${COMPOSE_BIN} exec -T "$REDIS_SERVICE" cat /data/dump.rdb > "${DEST}/redis.rdb" || {
  echo "[backup] WARN: could not copy Redis dump.rdb (AOF-only or empty); continuing"
  : > "${DEST}/redis.rdb"
}

if [[ -d uploads ]] && [[ -n "$(ls -A uploads 2>/dev/null || true)" ]]; then
  echo "[backup] Archiving uploads..."
  tar -czf "${DEST}/uploads.tar.gz" -C "$ROOT_DIR" uploads
else
  echo "[backup] No uploads to archive"
  tar -czf "${DEST}/uploads.tar.gz" --files-from /dev/null
fi

echo "${TIMESTAMP}" > "${DEST}/MANIFEST.txt"
{
  echo "created_at_utc=${TIMESTAMP}"
  echo "postgres_db=${POSTGRES_DB}"
  echo "postgres_format=custom"
  echo "redis_file=redis.rdb"
  echo "uploads_archive=uploads.tar.gz"
} >> "${DEST}/MANIFEST.txt"

# Keep last 14 backups by default
KEEP="${BACKUP_KEEP:-14}"
if [[ -d "$BACKUP_ROOT" ]]; then
  ls -1dt "${BACKUP_ROOT}"/*/ 2>/dev/null | tail -n +"$((KEEP + 1))" | while IFS= read -r old; do
    [[ -n "${old}" ]] || continue
    echo "[backup] Pruning old backup: ${old}"
    rm -rf "$old"
  done || true
fi

echo "[backup] Done: ${DEST}"
