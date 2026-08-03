#!/usr/bin/env bash
# Restore PostgreSQL, Redis, and uploads from a backup directory created by backup.sh.
# Usage:
#   ./scripts/restore.sh backups/20260803T020000Z
# Requires explicit confirmation: CONFIRM_RESTORE=yes

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "Refusing to restore without CONFIRM_RESTORE=yes" >&2
  echo "Example: CONFIRM_RESTORE=yes ./scripts/restore.sh backups/20260803T020000Z" >&2
  exit 1
fi

BACKUP_DIR="${1:-}"
if [[ -z "$BACKUP_DIR" ]] || [[ ! -d "$BACKUP_DIR" ]]; then
  echo "Usage: CONFIRM_RESTORE=yes $0 <backup-directory>" >&2
  exit 1
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

COMPOSE_BIN="${COMPOSE_BIN:-docker compose}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
REDIS_SERVICE="${REDIS_SERVICE:-redis}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-quron_yoli}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

PG_DUMP="${BACKUP_DIR}/postgres.dump"
REDIS_RDB="${BACKUP_DIR}/redis.rdb"
UPLOADS_TAR="${BACKUP_DIR}/uploads.tar.gz"

[[ -f "$PG_DUMP" ]] || { echo "Missing ${PG_DUMP}" >&2; exit 1; }

echo "[restore] WARNING: This overwrites Postgres data in service '${POSTGRES_SERVICE}'"
echo "[restore] Restoring PostgreSQL from ${PG_DUMP}..."

# Drop and recreate public schema objects via pg_restore --clean
${COMPOSE_BIN} exec -T "$POSTGRES_SERVICE" \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner \
  < "$PG_DUMP"

if [[ -f "$REDIS_RDB" ]] && [[ -s "$REDIS_RDB" ]]; then
  echo "[restore] Restoring Redis RDB..."
  ${COMPOSE_BIN} stop "$REDIS_SERVICE"
  ${COMPOSE_BIN} run --rm --no-deps -v "${ROOT_DIR}/${REDIS_RDB}:/restore.rdb:ro" "$REDIS_SERVICE" \
    sh -c 'cp /restore.rdb /data/dump.rdb && chown redis:redis /data/dump.rdb' || {
      echo "[restore] WARN: Redis volume restore via run failed; trying docker cp approach"
      CONTAINER_ID="$(${COMPOSE_BIN} ps -q "$REDIS_SERVICE" || true)"
      if [[ -n "$CONTAINER_ID" ]]; then
        docker cp "$REDIS_RDB" "${CONTAINER_ID}:/data/dump.rdb"
      fi
    }
  ${COMPOSE_BIN} start "$REDIS_SERVICE"
else
  echo "[restore] Skipping Redis (empty or missing redis.rdb)"
fi

if [[ -f "$UPLOADS_TAR" ]]; then
  echo "[restore] Restoring uploads..."
  tar -xzf "$UPLOADS_TAR" -C "$ROOT_DIR"
fi

echo "[restore] Done. Restart API if needed: ${COMPOSE_BIN} restart api"
