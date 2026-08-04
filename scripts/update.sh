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

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
COMPOSE_BIN="${COMPOSE_BIN:-docker compose -f ${COMPOSE_FILE}}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-60}"
HEALTH_INTERVAL_SEC="${HEALTH_INTERVAL_SEC:-2}"
SKIP_BACKUP="${SKIP_BACKUP:-0}"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-0}"

# Refuse accidental destructive volume flags if passed through to this script.
for arg in "$@"; do
  case "$arg" in
    -v | --volumes | --rmi | prune)
      echo "[update] Refusing destructive argument: ${arg}" >&2
      echo "[update] This script never removes volumes or images via down -v / prune." >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[update] Missing ${COMPOSE_FILE} in ${ROOT_DIR}" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "[update] Missing .env — copy from .env.production and fill secrets first." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

PORT="${PORT:-3000}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/api/v1/health/ready}"

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

echo "[update] Rebuilding and starting stack (volumes preserved)..."
# Intentionally no -v / down -v: named volumes postgres_data / redis_data stay intact.
${COMPOSE_BIN} up -d --build

echo "[update] Waiting for API readiness at ${HEALTH_URL}..."
ATTEMPT=0
until curl -fsS "$HEALTH_URL" >/dev/null 2>&1; do
  ATTEMPT=$((ATTEMPT + 1))
  if [[ "$ATTEMPT" -ge "$HEALTH_ATTEMPTS" ]]; then
    echo "[update] API did not become ready after ${HEALTH_ATTEMPTS} attempts." >&2
    echo "[update] Recent api logs:" >&2
    ${COMPOSE_BIN} logs --tail=80 api >&2 || true
    exit 1
  fi
  sleep "$HEALTH_INTERVAL_SEC"
done
echo "[update] API is ready"

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
