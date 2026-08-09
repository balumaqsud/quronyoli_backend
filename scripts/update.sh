#!/usr/bin/env bash
# Safe production update: pull latest code, rebuild API, keep DB/Redis data.
#
# Usage (on the server, from the repo root):
#   ./scripts/update.sh
#   SKIP_BACKUP=1 ./scripts/update.sh          # skip pre-update backup
#   SKIP_GIT_PULL=1 ./scripts/update.sh        # rebuild current tree only
#
# This script NEVER removes Docker volumes (no `down -v`, no volume prune).
# New tables/columns come from committed Prisma migrations via entrypoint
# `prisma migrate deploy` (additive only).

set -euo pipefail

# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

qy_init_root
qy_refuse_destructive_args "update" "$@"
qy_require_compose_file "update"
qy_require_env_file "update"
qy_load_env

SKIP_BACKUP="${SKIP_BACKUP:-0}"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-0}"

echo "[update] Repo: ${ROOT_DIR}"
echo "[update] Compose: ${COMPOSE_BIN}"

if [[ "$SKIP_BACKUP" != "1" ]]; then
  if ${COMPOSE_BIN} ps --status running -q postgres 2>/dev/null | grep -q .; then
    echo "[update] Pre-update backup..."
    export COMPOSE_BIN
    bash "${ROOT_DIR}/scripts/backup.sh"
  else
    echo "[update] Postgres not running yet — skipping backup (first boot or stopped stack)"
  fi
else
  echo "[update] Skipping backup (SKIP_BACKUP=1)"
fi

if [[ "$SKIP_GIT_PULL" != "1" ]]; then
  if [[ ! -d .git ]]; then
    echo "[update] Not a git checkout; set SKIP_GIT_PULL=1 or clone the repo." >&2
    exit 1
  fi
  echo "[update] Fetching and fast-forward pulling..."
  git fetch --all --prune
  git pull --ff-only
else
  echo "[update] Skipping git pull (SKIP_GIT_PULL=1)"
fi

DOMAIN="${DOMAIN:-}"
if [[ -z "$DOMAIN" ]]; then
  DOMAIN="$(qy_domain_from_webhook_url || true)"
fi
export DOMAIN

qy_prepare_runtime_dirs "update"
qy_ensure_mushaf_1405_env "update"

echo "[update] Rebuilding and starting stack (volumes preserved)..."
# Intentionally no -v / down -v: named volumes postgres_data / redis_data stay intact.
${COMPOSE_BIN} up -d --build

qy_wait_for_health "update"

SKIP_QF_ENSURE="${SKIP_QF_ENSURE:-0}"
if [[ "$SKIP_QF_ENSURE" == "1" ]]; then
  echo "[update] Skipping QF ensure (SKIP_QF_ENSURE=1)"
else
  echo "[update] Ensuring Quran catalog + mushaf pages (incl. 1405 when configured)..."
  FORCE_QF_SYNC="${FORCE_QF_SYNC:-0}" RUN_QF_SYNC="${RUN_QF_SYNC:-0}" \
    bash "${ROOT_DIR}/scripts/ensure-qf-data.sh"
fi

echo "[update] Container status:"
${COMPOSE_BIN} ps

echo "[update] Persistent volumes (must still exist):"
${COMPOSE_BIN} volume ls | grep -E 'quron-yoli_(postgres|redis)_data|NAME' || \
  docker volume ls | grep -E 'quron-yoli_(postgres|redis)_data' || \
  echo "[update] WARN: could not list expected volume names; check 'docker volume ls'"

echo "[update] Recent migration / entrypoint lines:"
${COMPOSE_BIN} logs --tail=40 api 2>/dev/null | grep -E '\[entrypoint\]|migrate|Migration|Applied' || \
  ${COMPOSE_BIN} logs --tail=20 api || true

echo "[update] Done. Postgres and Redis data were not removed."
echo "[update] New schema (including new tables) applied via prisma migrate deploy on api start."
echo "[update] Manual QF sync anytime: ./scripts/sync-qf.sh"
