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

# Public HTTPS origin for static uploads / mushaf image bases.
# Order: PUBLIC_API_ORIGIN → DOMAIN → host of TELEGRAM_WEBHOOK_URL.
qy_public_origin() {
  local origin host
  origin="$(printf '%s' "${PUBLIC_API_ORIGIN:-}" | tr -d '[:space:]')"
  if [[ -n "$origin" ]]; then
    printf '%s' "${origin%/}"
    return 0
  fi
  host="$(printf '%s' "${DOMAIN:-}" | tr -d '[:space:]')"
  if [[ -z "$host" ]]; then
    host="$(qy_domain_from_webhook_url || true)"
  fi
  host="$(printf '%s' "$host" | tr -d '[:space:]')"
  if [[ -z "$host" ]]; then
    return 0
  fi
  printf 'https://%s' "$host"
}

qy_mushaf_1405_webp_count() {
  local dir="${ROOT_DIR}/uploads/mushaf/1405"
  if [[ ! -d "$dir" ]]; then
    printf '0'
    return 0
  fi
  # Count WebP page files (expect 1.webp … 604.webp).
  find "$dir" -maxdepth 1 -type f -name '*.webp' 2>/dev/null | wc -l | tr -d '[:space:]'
}

# Upsert KEY=VALUE in .env only when the key is missing or empty (never prints values).
qy_env_upsert() {
  local key="$1"
  local value="$2"
  local current val tmp
  if [[ ! -f .env ]]; then
    printf '%s=%s\n' "$key" "$value" >.env
    return 0
  fi
  current="$(grep -E "^${key}=" .env | head -n1 || true)"
  if [[ -z "$current" ]]; then
    printf '%s=%s\n' "$key" "$value" >>.env
    return 0
  fi
  val="${current#*=}"
  val="${val%$'\r'}"
  if [[ "$val" =~ ^\"(.*)\"$ ]]; then
    val="${BASH_REMATCH[1]}"
  elif [[ "$val" =~ ^\'(.*)\'$ ]]; then
    val="${BASH_REMATCH[1]}"
  fi
  val="$(printf '%s' "$val" | tr -d '[:space:]')"
  if [[ -n "$val" ]]; then
    return 0
  fi
  tmp="$(mktemp)"
  grep -Ev "^${key}=" .env >"$tmp" || true
  printf '%s=%s\n' "$key" "$value" >>"$tmp"
  mv "$tmp" .env
}

# When 604 Classic Medina WebPs exist and a public origin is known, write .env keys
# so deploy/update + Nest enable mushaf 1405 without a manual ops step.
qy_ensure_mushaf_1405_env() {
  local label="${1:-mushaf-1405}"
  local count origin base
  mkdir -p uploads/mushaf/1405
  count="$(qy_mushaf_1405_webp_count)"
  if [[ -z "$count" || ! "$count" =~ ^[0-9]+$ ]]; then
    count=0
  fi
  if [[ "$count" -lt 604 ]]; then
    echo "[${label}] Skipping Classic Medina 1405 env — found ${count}/604 WebPs in uploads/mushaf/1405/"
    return 0
  fi
  origin="$(qy_public_origin || true)"
  if [[ -z "$origin" ]]; then
    echo "[${label}] WARN: ${count} WebPs present but PUBLIC_API_ORIGIN/DOMAIN/TELEGRAM_WEBHOOK_URL unset — cannot set QF_MUSHAF_1405_IMAGE_BASE" >&2
    return 0
  fi
  base="${origin}/uploads/mushaf/1405"
  qy_env_upsert PUBLIC_API_ORIGIN "$origin"
  qy_env_upsert QF_MUSHAF_1405_IMAGE_BASE "$base"
  qy_env_upsert QF_MUSHAF_1405_IMAGE_EXT "webp"
  qy_env_upsert QF_TAJWEED_PAGE_IMAGE_BASE \
    "https://www.noureddin.dev/quran-pages/2/pages/776x1053-webp"
  qy_env_upsert QF_TAJWEED_PAGE_IMAGE_EXT "webp"
  export PUBLIC_API_ORIGIN="$origin"
  export QF_MUSHAF_1405_IMAGE_BASE="$base"
  export QF_MUSHAF_1405_IMAGE_EXT="webp"
  echo "[${label}] Classic Medina 1405 ready (${count} WebPs); image base configured for ${origin}"
}
