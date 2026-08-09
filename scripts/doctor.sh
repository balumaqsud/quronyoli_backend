#!/usr/bin/env bash
# Diagnose Compose stack, Postgres DB presence, volume size, and backups.
# Prints the next recommended command (non-destructive).
#
# Usage:
#   ./scripts/doctor.sh

set -euo pipefail

# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

qy_init_root
qy_refuse_destructive_args "doctor" "$@"
qy_require_compose_file "doctor"

LABEL="doctor"
if [[ -f .env ]]; then
  qy_load_env
else
  echo "[${LABEL}] WARN: no .env — using defaults for DB/volume names" >&2
  PORT="${PORT:-3000}"
  HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/api/v1/health/ready}"
  LIVE_URL="${LIVE_URL:-http://127.0.0.1:${PORT}/api/v1/health/live}"
  POSTGRES_USER="${POSTGRES_USER:-postgres}"
  POSTGRES_DB="${POSTGRES_DB:-quron_yoli}"
  POSTGRES_VOLUME_NAME="${POSTGRES_VOLUME_NAME:-quron-yoli_postgres_data}"
  REDIS_VOLUME_NAME="${REDIS_VOLUME_NAME:-quron-yoli_redis_data}"
fi

echo "=== [${LABEL}] Compose status ==="
${COMPOSE_BIN} ps || true

echo
echo "=== [${LABEL}] Health probes ==="
if curl -fsS "${LIVE_URL}" >/dev/null 2>&1; then
  echo "live:  OK  (${LIVE_URL})"
else
  echo "live:  DOWN (${LIVE_URL})"
fi
ready_http="$(curl -sS -o /tmp/qy-doctor-ready.json -w '%{http_code}' "${HEALTH_URL}" 2>/dev/null || echo "000")"
ready_body="$(cat /tmp/qy-doctor-ready.json 2>/dev/null || true)"
rm -f /tmp/qy-doctor-ready.json 2>/dev/null || true
if [[ "$ready_http" == "200" ]]; then
  echo "ready: OK  (${HEALTH_URL})"
else
  echo "ready: DOWN http=${ready_http} (${HEALTH_URL})"
  if [[ -n "$ready_body" ]]; then
    echo "ready body: ${ready_body}"
  fi
fi

echo
echo "=== [${LABEL}] Postgres databases ==="
db_missing=0
if ${COMPOSE_BIN} ps --status running -q postgres 2>/dev/null | grep -q .; then
  ${COMPOSE_BIN} exec -T postgres \
    psql -U "${POSTGRES_USER}" -d postgres -c '\l' 2>/dev/null || \
    echo "[${LABEL}] WARN: could not list databases"
  if qy_database_exists "${POSTGRES_DB}"; then
    echo "app DB '${POSTGRES_DB}': EXISTS"
  else
    echo "app DB '${POSTGRES_DB}': MISSING (Prisma P1003)"
    db_missing=1
  fi
else
  echo "postgres container: not running"
  db_missing=1
fi

echo
echo "=== [${LABEL}] Named volumes ==="
for vol in "${POSTGRES_VOLUME_NAME}" "${REDIS_VOLUME_NAME}"; do
  if docker volume inspect "$vol" >/dev/null 2>&1; then
    size_bytes="$(qy_volume_size_bytes "$vol")"
    mount="$(docker volume inspect "$vol" --format '{{ .Mountpoint }}' 2>/dev/null || true)"
    if [[ -n "$size_bytes" ]]; then
      echo "${vol}: exists size_bytes=${size_bytes} mount=${mount}"
    else
      echo "${vol}: exists mount=${mount} (size unknown — need root to read mountpoint)"
    fi
  else
    echo "${vol}: MISSING"
  fi
done

echo
echo "=== [${LABEL}] Caddy / HTTPS ==="
PORT="$(qy_env_port)"
DOMAIN="$(qy_resolve_domain || true)"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
UPSTREAM="127.0.0.1:${PORT}"
caddy_mismatch=0
https_down=0

echo "PORT from .env: ${PORT}"
echo "DOMAIN resolved: ${DOMAIN:-"(empty)"}"
if [[ -n "$DOMAIN" ]]; then
  echo "Expected public health: https://${DOMAIN}/api/v1/health/ready"
fi

if [[ -f "$CADDYFILE" ]]; then
  if grep -qF "reverse_proxy ${UPSTREAM}" "$CADDYFILE"; then
    echo "Caddyfile upstream: OK (${UPSTREAM})"
  else
    echo "Caddyfile upstream: MISMATCH (want reverse_proxy ${UPSTREAM})"
    echo "--- ${CADDYFILE} ---"
    cat "$CADDYFILE" 2>/dev/null || true
    caddy_mismatch=1
  fi
else
  echo "Caddyfile: missing (${CADDYFILE})"
  caddy_mismatch=1
fi

if command -v systemctl >/dev/null 2>&1; then
  echo "caddy systemd: $(systemctl is-active caddy 2>/dev/null || echo unknown)"
else
  echo "caddy systemd: (systemctl not available)"
fi

if [[ -n "$DOMAIN" ]]; then
  https_url="https://${DOMAIN}/api/v1/health/ready"
  https_http="$(curl -sS -o /tmp/qy-doctor-https.json -w '%{http_code}' "$https_url" 2>/dev/null || echo "000")"
  https_body="$(cat /tmp/qy-doctor-https.json 2>/dev/null || true)"
  rm -f /tmp/qy-doctor-https.json 2>/dev/null || true
  if [[ "$https_http" == "200" ]]; then
    echo "https ready: OK (${https_url})"
  else
    echo "https ready: DOWN http=${https_http} (${https_url})"
    if [[ -n "$https_body" ]]; then
      echo "https body: ${https_body}"
    fi
    https_down=1
  fi
else
  echo "https ready: skipped (no DOMAIN)"
fi

echo
echo "=== [${LABEL}] Recent backups ==="
BACKUP_ROOT="${BACKUP_ROOT:-${ROOT_DIR}/backups}"
if [[ -d "$BACKUP_ROOT" ]]; then
  found=0
  while IFS= read -r dir; do
    [[ -n "$dir" ]] || continue
    found=1
    dump="${dir%/}/postgres.dump"
    if [[ -f "$dump" ]]; then
      sz="$(wc -c <"$dump" | tr -d '[:space:]')"
      echo "${dir%/}  postgres.dump=${sz} bytes"
    else
      echo "${dir%/}  (no postgres.dump)"
    fi
  done < <(qy_list_recent_backups 5)
  if [[ "$found" -eq 0 ]]; then
    echo "(none under ${BACKUP_ROOT})"
  fi
else
  echo "(no ${BACKUP_ROOT} directory)"
fi

echo
echo "=== [${LABEL}] Recommendation ==="
latest="$(qy_latest_backup_dir || true)"
if [[ "$db_missing" -eq 1 ]]; then
  if [[ -n "$latest" ]]; then
    echo "Database missing/empty. Restore with:"
    echo "  CONFIRM_RESTORE=yes ./scripts/repair-db.sh ${latest}"
  else
    echo "Database missing and no backups found. Create DB then migrate+seed (data loss):"
    echo "  docker compose -f docker-compose.yml exec -T postgres psql -U ${POSTGRES_USER} -d postgres -c \"CREATE DATABASE ${POSTGRES_DB};\""
    echo "  ./scripts/restart-api.sh"
    echo "  ./scripts/ensure-qf-data.sh"
  fi
elif [[ "$caddy_mismatch" -eq 1 || "$https_down" -eq 1 ]]; then
  echo "Caddy/HTTPS problem (local API may still be fine on :${PORT}). Fix:"
  echo "  DOMAIN=${DOMAIN:-189.74.96.28.sslip.io} ./scripts/setup-caddy.sh"
  echo "  curl -sS https://${DOMAIN:-189.74.96.28.sslip.io}/api/v1/health/ready"
  echo "Never leave a stale shell PORT=3001 — Caddy always uses .env PORT=${PORT}."
elif ! curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
  echo "DB looks present but API not ready. Try:"
  echo "  ./scripts/restart-api.sh"
  echo "  ${COMPOSE_BIN} logs --tail=80 api"
else
  echo "Stack looks healthy (local + HTTPS). Day-2 code/schema updates:"
  echo "  ./scripts/update.sh"
  echo "API-only restart (keep DB, re-sync Caddy):"
  echo "  ./scripts/restart-api.sh"
  echo "Recreate all containers (keep volumes):"
  echo "  ./scripts/restart-stack.sh"
fi

echo
echo "[${LABEL}] Done."
