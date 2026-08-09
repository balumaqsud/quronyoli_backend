#!/usr/bin/env bash
# Restore PostgreSQL, Redis, and uploads from a backup directory created by backup.sh.
# Creates the app database if it is missing (P1003 recovery).
#
# Usage:
#   CONFIRM_RESTORE=yes ./scripts/restore.sh backups/20260803T020000Z
#
# Requires explicit confirmation: CONFIRM_RESTORE=yes

set -euo pipefail

# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

qy_init_root
qy_refuse_destructive_args "restore" "$@"

if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "Refusing to restore without CONFIRM_RESTORE=yes" >&2
  echo "Example: CONFIRM_RESTORE=yes ./scripts/restore.sh backups/20260803T020000Z" >&2
  exit 1
fi

BACKUP_DIR="${1:-}"
if [[ -z "$BACKUP_DIR" ]]; then
  echo "Usage: CONFIRM_RESTORE=yes $0 <backup-directory>" >&2
  exit 1
fi
# Allow relative paths from repo root
if [[ ! -d "$BACKUP_DIR" && -d "${ROOT_DIR}/${BACKUP_DIR}" ]]; then
  BACKUP_DIR="${ROOT_DIR}/${BACKUP_DIR}"
fi
if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "Usage: CONFIRM_RESTORE=yes $0 <backup-directory>" >&2
  echo "Directory not found: ${BACKUP_DIR}" >&2
  exit 1
fi

qy_require_compose_file "restore"
if [[ -f .env ]]; then
  qy_load_env
else
  POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
  POSTGRES_USER="${POSTGRES_USER:-postgres}"
  POSTGRES_DB="${POSTGRES_DB:-quron_yoli}"
  REDIS_PASSWORD="${REDIS_PASSWORD:-}"
fi

REDIS_SERVICE="${REDIS_SERVICE:-redis}"

# Resolve to absolute paths for docker volume mounts
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"
PG_DUMP="${BACKUP_DIR}/postgres.dump"
REDIS_RDB="${BACKUP_DIR}/redis.rdb"
UPLOADS_TAR="${BACKUP_DIR}/uploads.tar.gz"

[[ -f "$PG_DUMP" ]] || { echo "Missing ${PG_DUMP}" >&2; exit 1; }

if ! ${COMPOSE_BIN} ps --status running -q "$POSTGRES_SERVICE" 2>/dev/null | grep -q .; then
  echo "[restore] Postgres is not running. Start the stack first (without wiping volumes)." >&2
  exit 1
fi

echo "[restore] WARNING: This overwrites Postgres data in service '${POSTGRES_SERVICE}' / DB '${POSTGRES_DB}'"
qy_ensure_database "restore"

echo "[restore] Restoring PostgreSQL from ${PG_DUMP}..."

# Drop and recreate public schema objects via pg_restore --clean
${COMPOSE_BIN} exec -T "$POSTGRES_SERVICE" \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner \
  < "$PG_DUMP"

if [[ -f "$REDIS_RDB" ]] && [[ -s "$REDIS_RDB" ]]; then
  echo "[restore] Restoring Redis RDB..."
  ${COMPOSE_BIN} stop "$REDIS_SERVICE"
  ${COMPOSE_BIN} run --rm --no-deps -v "${REDIS_RDB}:/restore.rdb:ro" "$REDIS_SERVICE" \
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

echo "[restore] Done. Restart API if needed: ./scripts/restart-api.sh"
echo "[restore] Or full repair flow: CONFIRM_RESTORE=yes ./scripts/repair-db.sh ${BACKUP_DIR}"
