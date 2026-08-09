#!/usr/bin/env bash
# Shared helpers for production deploy/update scripts.
# Source from scripts that already have set -euo pipefail.

qy_init_root() {
  # Caller script lives in scripts/; repo root is one level up.
  local caller="${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}"
  ROOT_DIR="$(cd "$(dirname "$caller")/.." && pwd)"
  cd "$ROOT_DIR"
  COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
  COMPOSE_BIN="${COMPOSE_BIN:-docker compose -f ${COMPOSE_FILE}}"
  HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-60}"
  HEALTH_INTERVAL_SEC="${HEALTH_INTERVAL_SEC:-2}"
}

qy_refuse_destructive_args() {
  local label="${1:-script}"
  shift || true
  local arg
  for arg in "$@"; do
    case "$arg" in
      -v | --volumes | --rmi | prune)
        echo "[${label}] Refusing destructive argument: ${arg}" >&2
        echo "[${label}] This script never removes volumes or images via down -v / prune." >&2
        exit 1
        ;;
    esac
  done
}

qy_require_compose_file() {
  local label="${1:-script}"
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "[${label}] Missing ${COMPOSE_FILE} in ${ROOT_DIR}" >&2
    exit 1
  fi
}

qy_require_env_file() {
  local label="${1:-script}"
  if [[ ! -f .env ]]; then
    echo "[${label}] Missing .env — upload a ready .env to the repo root before deploying." >&2
    exit 1
  fi
}

qy_load_env() {
  # shellcheck disable=SC1091
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
  PORT="${PORT:-3000}"
  HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/api/v1/health/ready}"
}

# Bind mounts ./uploads and ./logs into the api container (USER nestjs, uid 100).
# Host dirs created as root are not writable by nestjs — fix ownership before start.
qy_prepare_runtime_dirs() {
  local label="${1:-script}"
  local nestjs_uid="${NESTJS_HOST_UID:-100}"
  local nestjs_gid="${NESTJS_HOST_GID:-101}"
  mkdir -p uploads/mushaf/1405 logs
  if [[ "${EUID}" -eq 0 ]]; then
    chown -R "${nestjs_uid}:${nestjs_gid}" uploads logs
    echo "[${label}] Runtime dirs uploads/ logs/ owned by ${nestjs_uid}:${nestjs_gid}"
  else
    echo "[${label}] WARN: not root — ensure uploads/ and logs/ are writable by uid ${nestjs_uid}" >&2
  fi
}

qy_wait_for_health() {
  local label="${1:-script}"
  echo "[${label}] Waiting for API readiness at ${HEALTH_URL}..."
  local attempt=0
  until curl -fsS "$HEALTH_URL" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [[ "$attempt" -ge "$HEALTH_ATTEMPTS" ]]; then
      echo "[${label}] API did not become ready after ${HEALTH_ATTEMPTS} attempts." >&2
      echo "[${label}] Recent api logs:" >&2
      # shellcheck disable=SC2086
      ${COMPOSE_BIN} logs --tail=80 api >&2 || true
      exit 1
    fi
    sleep "$HEALTH_INTERVAL_SEC"
  done
  echo "[${label}] API is ready"
}

qy_domain_from_webhook_url() {
  local url="${TELEGRAM_WEBHOOK_URL:-}"
  if [[ -z "$url" ]]; then
    return 0
  fi
  # Strip scheme and path: https://host/path -> host
  url="${url#*://}"
  url="${url%%/*}"
  url="${url%%:*}"
  printf '%s' "$url"
}
