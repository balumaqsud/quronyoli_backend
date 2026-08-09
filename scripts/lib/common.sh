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
  # Always prefer .env PORT over a stale shell export (e.g. leftover PORT=3001).
  PORT="$(qy_env_port)"
  export PORT
  HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/api/v1/health/ready}"
  LIVE_URL="${LIVE_URL:-http://127.0.0.1:${PORT}/api/v1/health/live}"
  POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
  POSTGRES_USER="${POSTGRES_USER:-postgres}"
  POSTGRES_DB="${POSTGRES_DB:-quron_yoli}"
  POSTGRES_VOLUME_NAME="${POSTGRES_VOLUME_NAME:-quron-yoli_postgres_data}"
  REDIS_VOLUME_NAME="${REDIS_VOLUME_NAME:-quron-yoli_redis_data}"
}

# Read PORT from .env only (ignore polluted shell exports like PORT=3001).
qy_env_port() {
  local env_port=""
  if [[ -f .env ]]; then
    env_port="$(
      grep -E '^[[:space:]]*PORT=' .env \
        | tail -1 \
        | cut -d= -f2- \
        | tr -d '[:space:]"'"'"'' \
        || true
    )"
  fi
  if [[ -n "$env_port" && "$env_port" =~ ^[0-9]+$ ]]; then
    printf '%s' "$env_port"
    return 0
  fi
  printf '3000'
}

# DOMAIN env override, else host from TELEGRAM_WEBHOOK_URL.
qy_resolve_domain() {
  local host
  host="$(printf '%s' "${DOMAIN:-}" | tr -d '[:space:]')"
  if [[ -n "$host" ]]; then
    printf '%s' "$host"
    return 0
  fi
  qy_domain_from_webhook_url || true
}

# Re-write Caddy reverse_proxy to match .env PORT + DOMAIN (unless SKIP_CADDY=1).
qy_sync_caddy() {
  local label="${1:-script}"
  local domain port

  if [[ "${SKIP_CADDY:-0}" == "1" ]]; then
    echo "[${label}] Skipping Caddy sync (SKIP_CADDY=1)"
    return 0
  fi

  port="$(qy_env_port)"
  domain="$(qy_resolve_domain || true)"
  export PORT="$port"
  export DOMAIN="$domain"

  if [[ -z "$domain" ]]; then
    echo "[${label}] WARN: DOMAIN unset and TELEGRAM_WEBHOOK_URL host unknown — skipping Caddy." >&2
    echo "[${label}] Set DOMAIN=189.74.96.28.sslip.io or TELEGRAM_WEBHOOK_URL, or use SKIP_CADDY=1." >&2
    return 0
  fi

  if [[ "$(uname -s)" != "Linux" ]]; then
    echo "[${label}] WARN: Caddy sync skipped (not Linux)." >&2
    return 0
  fi

  if [[ "${EUID}" -ne 0 ]]; then
    echo "[${label}] WARN: not root — cannot rewrite /etc/caddy/Caddyfile." >&2
    echo "[${label}] Re-run as root: DOMAIN=${domain} ./scripts/setup-caddy.sh" >&2
    return 0
  fi

  echo "[${label}] Syncing Caddy (${domain} -> 127.0.0.1:${port})..."
  DOMAIN="$domain" PORT="$port" bash "${ROOT_DIR}/scripts/setup-caddy.sh"
}

# Fail closed if Caddyfile upstream or public HTTPS health is wrong.
qy_assert_caddy_https() {
  local label="${1:-script}"
  local port domain upstream caddyfile https_url attempt max_attempts
  local soft="${QY_CADDY_HTTPS_SOFT:-0}"

  if [[ "${SKIP_CADDY:-0}" == "1" ]]; then
    echo "[${label}] Skipping Caddy HTTPS assert (SKIP_CADDY=1)"
    return 0
  fi

  port="$(qy_env_port)"
  domain="$(qy_resolve_domain || true)"
  upstream="127.0.0.1:${port}"
  caddyfile="${CADDYFILE:-/etc/caddy/Caddyfile}"

  if [[ -z "$domain" ]]; then
    echo "[${label}] WARN: no DOMAIN — cannot assert public HTTPS." >&2
    return 0
  fi

  if [[ ! -f "$caddyfile" ]]; then
    echo "[${label}] ERROR: missing ${caddyfile} — run DOMAIN=${domain} ./scripts/setup-caddy.sh" >&2
    if [[ "$soft" == "1" ]]; then
      return 0
    fi
    return 1
  fi

  if ! grep -qF "reverse_proxy ${upstream}" "$caddyfile"; then
    echo "[${label}] ERROR: ${caddyfile} upstream mismatch (want reverse_proxy ${upstream})." >&2
    echo "[${label}] Stale PORT (e.g. 3001) causes https://${domain} 502 while localhost:${port} works." >&2
    echo "[${label}] Fix: DOMAIN=${domain} ./scripts/setup-caddy.sh" >&2
    if [[ "$soft" == "1" ]]; then
      return 0
    fi
    return 1
  fi
  echo "[${label}] Caddyfile upstream OK (${upstream})"

  https_url="https://${domain}/api/v1/health/ready"
  max_attempts="${CADDY_HTTPS_ATTEMPTS:-15}"
  echo "[${label}] Checking public HTTPS ${https_url}..."
  attempt=0
  until curl -fsS "$https_url" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [[ "$attempt" -ge "$max_attempts" ]]; then
      echo "[${label}] ERROR: public HTTPS not ready after ${max_attempts} attempts." >&2
      echo "[${label}] Check: ufw allow 80,443; DOMAIN=${domain}; systemctl status caddy; journalctl -u caddy -n 50" >&2
      if [[ "$soft" == "1" ]]; then
        return 0
      fi
      return 1
    fi
    sleep 2
  done
  echo "[${label}] Public HTTPS ready: ${https_url}"
}

# Returns 0 if database POSTGRES_DB exists (postgres container must be running).
qy_database_exists() {
  local db="${1:-${POSTGRES_DB:-quron_yoli}}"
  local user="${POSTGRES_USER:-postgres}"
  local service="${POSTGRES_SERVICE:-postgres}"
  local result
  result="$(${COMPOSE_BIN} exec -T "$service" \
    psql -U "$user" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" 2>/dev/null \
    | tr -d '[:space:]' || true)"
  [[ "$result" == "1" ]]
}

# CREATE DATABASE if missing (connects to maintenance DB "postgres").
qy_ensure_database() {
  local label="${1:-script}"
  local db="${POSTGRES_DB:-quron_yoli}"
  local user="${POSTGRES_USER:-postgres}"
  local service="${POSTGRES_SERVICE:-postgres}"

  if ! ${COMPOSE_BIN} ps --status running -q "$service" 2>/dev/null | grep -q .; then
    echo "[${label}] Postgres service '${service}' is not running." >&2
    return 1
  fi

  if qy_database_exists "$db"; then
    echo "[${label}] Database '${db}' already exists"
    return 0
  fi

  echo "[${label}] Database '${db}' missing — creating..."
  ${COMPOSE_BIN} exec -T "$service" \
    psql -U "$user" -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE \"${db}\" OWNER \"${user}\";"
  echo "[${label}] Database '${db}' created"
}

# Approximate host size of a Docker named volume (bytes as integer string, or empty).
qy_volume_size_bytes() {
  local name="$1"
  local mount
  mount="$(docker volume inspect "$name" --format '{{ .Mountpoint }}' 2>/dev/null || true)"
  if [[ -z "$mount" || ! -d "$mount" ]]; then
    printf ''
    return 0
  fi
  if command -v du >/dev/null 2>&1; then
    du -sb "$mount" 2>/dev/null | awk '{print $1}' || printf ''
  else
    printf ''
  fi
}

# Fail closed if app DB is missing after stack start (empty/wiped volume).
# Set QY_POSTGRES_SANITY_SOFT=1 to warn instead of exit.
qy_assert_postgres_data_sane() {
  local label="${1:-script}"
  local db="${POSTGRES_DB:-quron_yoli}"
  local vol="${POSTGRES_VOLUME_NAME:-quron-yoli_postgres_data}"
  local soft="${QY_POSTGRES_SANITY_SOFT:-0}"
  local size_bytes
  local min_bytes="${QY_POSTGRES_VOLUME_MIN_BYTES:-1048576}" # 1 MiB

  if ! ${COMPOSE_BIN} ps --status running -q "${POSTGRES_SERVICE:-postgres}" 2>/dev/null | grep -q .; then
    echo "[${label}] ERROR: Postgres is not running — cannot verify data." >&2
    if [[ "$soft" == "1" ]]; then
      return 0
    fi
    return 1
  fi

  size_bytes="$(qy_volume_size_bytes "$vol")"
  if [[ -n "$size_bytes" && "$size_bytes" =~ ^[0-9]+$ && "$size_bytes" -lt "$min_bytes" ]]; then
    echo "[${label}] WARN: volume '${vol}' looks empty/tiny (${size_bytes} bytes; expect >= ${min_bytes})." >&2
  fi

  if qy_database_exists "$db"; then
    echo "[${label}] Postgres sanity OK — database '${db}' exists"
    return 0
  fi

  echo "[${label}] ERROR: database '${db}' does not exist (Prisma P1003 / readiness will fail)." >&2
  echo "[${label}] Next: ./scripts/doctor.sh then CONFIRM_RESTORE=yes ./scripts/repair-db.sh [backup-dir]" >&2
  if [[ "$soft" == "1" ]]; then
    return 0
  fi
  return 1
}

qy_list_recent_backups() {
  local root="${BACKUP_ROOT:-${ROOT_DIR}/backups}"
  local limit="${1:-5}"
  if [[ ! -d "$root" ]]; then
    return 0
  fi
  ls -1dt "${root}"/*/ 2>/dev/null | head -n "$limit" || true
}

qy_latest_backup_dir() {
  local root="${BACKUP_ROOT:-${ROOT_DIR}/backups}"
  local dir
  dir="$(ls -1dt "${root}"/*/ 2>/dev/null | head -n1 || true)"
  if [[ -n "$dir" ]]; then
    # strip trailing slash
    printf '%s' "${dir%/}"
  fi
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
