#!/usr/bin/env bash
# Partial restart: rebuild/restart API only. Postgres and Redis stay running (data untouched).
#
# Usage (on the server, from the repo root):
#   ./scripts/restart-api.sh              # rebuild + recreate api (--no-deps)
#   REBUILD=0 ./scripts/restart-api.sh    # docker compose restart api only
#
# This script NEVER stops postgres/redis and NEVER removes volumes.

set -euo pipefail

# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

qy_init_root
qy_refuse_destructive_args "restart-api" "$@"
qy_require_compose_file "restart-api"
qy_require_env_file "restart-api"
qy_load_env

REBUILD="${REBUILD:-1}"
LABEL="restart-api"

echo "[${LABEL}] Repo: ${ROOT_DIR}"
echo "[${LABEL}] Postgres/Redis containers will not be recreated."

qy_prepare_runtime_dirs "$LABEL"

if [[ "$REBUILD" == "0" ]]; then
  echo "[${LABEL}] Restarting api container (no rebuild)..."
  ${COMPOSE_BIN} restart api
else
  echo "[${LABEL}] Building and recreating api only (--no-deps, volumes preserved)..."
  ${COMPOSE_BIN} up -d --build --no-deps --force-recreate api
fi

qy_wait_for_health "$LABEL"
qy_assert_postgres_data_sane "$LABEL" || {
  echo "[${LABEL}] API may still crash-loop until the database is repaired." >&2
  exit 1
}

qy_sync_caddy "$LABEL"
qy_assert_caddy_https "$LABEL" || exit 1

echo "[${LABEL}] Container status:"
${COMPOSE_BIN} ps

echo "[${LABEL}] Done. Database volume was not touched."
DOMAIN="$(qy_resolve_domain || true)"
if [[ -n "$DOMAIN" && "${SKIP_CADDY:-0}" != "1" ]]; then
  echo "[${LABEL}] Public health: https://${DOMAIN}/api/v1/health/ready"
fi
