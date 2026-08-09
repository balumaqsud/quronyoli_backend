#!/usr/bin/env bash
# Total restart: force-recreate all Compose services, keep named volumes (DB data stays).
#
# Usage (on the server, from the repo root):
#   ./scripts/restart-stack.sh
#   SKIP_BACKUP=1 ./scripts/restart-stack.sh
#
# This script NEVER runs `down -v`, volume rm, or prune.
# For code + migrations from git, prefer ./scripts/update.sh instead.

set -euo pipefail

# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

qy_init_root
qy_refuse_destructive_args "restart-stack" "$@"
qy_require_compose_file "restart-stack"
qy_require_env_file "restart-stack"
qy_load_env

SKIP_BACKUP="${SKIP_BACKUP:-0}"
LABEL="restart-stack"

echo "[${LABEL}] Repo: ${ROOT_DIR}"
echo "[${LABEL}] Will force-recreate containers; volumes ${POSTGRES_VOLUME_NAME} / ${REDIS_VOLUME_NAME} stay."

if [[ "$SKIP_BACKUP" != "1" ]]; then
  if ${COMPOSE_BIN} ps --status running -q postgres 2>/dev/null | grep -q .; then
    if qy_database_exists "${POSTGRES_DB}"; then
      echo "[${LABEL}] Pre-restart backup..."
      export COMPOSE_BIN
      bash "${ROOT_DIR}/scripts/backup.sh"
    else
      echo "[${LABEL}] Skipping backup — database '${POSTGRES_DB}' missing (use ./scripts/repair-db.sh)"
    fi
  else
    echo "[${LABEL}] Postgres not running — skipping backup"
  fi
else
  echo "[${LABEL}] Skipping backup (SKIP_BACKUP=1)"
fi

qy_prepare_runtime_dirs "$LABEL"

echo "[${LABEL}] Rebuilding and force-recreating stack (no volume delete)..."
${COMPOSE_BIN} up -d --build --force-recreate

qy_assert_postgres_data_sane "$LABEL" || {
  echo "[${LABEL}] Stack is up but database is missing/empty." >&2
  exit 1
}

qy_wait_for_health "$LABEL"

qy_sync_caddy "$LABEL"
qy_assert_caddy_https "$LABEL" || exit 1

echo "[${LABEL}] Container status:"
${COMPOSE_BIN} ps

echo "[${LABEL}] Persistent volumes:"
docker volume ls | grep -E 'quron-yoli_(postgres|redis)_data' || \
  echo "[${LABEL}] WARN: could not list expected volume names"

echo "[${LABEL}] Done. Postgres and Redis data volumes were not removed."
echo "[${LABEL}] For git pull + migrate: ./scripts/update.sh"
DOMAIN="$(qy_resolve_domain || true)"
if [[ -n "$DOMAIN" && "${SKIP_CADDY:-0}" != "1" ]]; then
  echo "[${LABEL}] Public health: https://${DOMAIN}/api/v1/health/ready"
fi
