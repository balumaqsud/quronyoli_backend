#!/usr/bin/env bash
# First-boot production deploy (Ubuntu): Docker + Compose stack + Caddy TLS.
#
# Prerequisites:
#   - Repo checked out on the server
#   - Ready .env uploaded to repo root (secrets are never generated here)
#   - DNS A/AAAA for DOMAIN already pointing at this host (for HTTPS)
#
# Usage:
#   ./scripts/deploy.sh
#   DOMAIN=api.example.com ./scripts/deploy.sh
#   SKIP_CADDY=1 ./scripts/deploy.sh
#   SKIP_DOCKER_INSTALL=1 ./scripts/deploy.sh
#   RUN_QF_SYNC=1 ./scripts/deploy.sh          # force full QF sync (even if pages exist)
#   FORCE_QF_SYNC=1 ./scripts/deploy.sh        # same as RUN_QF_SYNC=1
#   SKIP_QF_ENSURE=1 ./scripts/deploy.sh       # skip ensure-qf-data (not recommended)
#
# Day-2 updates: ./scripts/update.sh

set -euo pipefail

# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

qy_init_root
qy_refuse_destructive_args "deploy" "$@"
qy_require_compose_file "deploy"

LABEL="deploy"
SKIP_DOCKER_INSTALL="${SKIP_DOCKER_INSTALL:-0}"
SKIP_CADDY="${SKIP_CADDY:-0}"
SKIP_QF_ENSURE="${SKIP_QF_ENSURE:-0}"
RUN_QF_SYNC="${RUN_QF_SYNC:-0}"
FORCE_QF_SYNC="${FORCE_QF_SYNC:-0}"
if [[ "$RUN_QF_SYNC" == "1" ]]; then
  FORCE_QF_SYNC=1
fi

echo "[${LABEL}] Repo: ${ROOT_DIR}"

if [[ "$SKIP_DOCKER_INSTALL" != "1" ]]; then
  bash "${ROOT_DIR}/scripts/install-docker.sh"
else
  echo "[${LABEL}] Skipping Docker install (SKIP_DOCKER_INSTALL=1)"
  if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    echo "[${LABEL}] Docker Engine + Compose v2 are required." >&2
    exit 1
  fi
fi

bash "${ROOT_DIR}/scripts/validate-env.sh"
qy_require_env_file "deploy"
qy_load_env

DOMAIN="${DOMAIN:-}"
if [[ -z "$DOMAIN" ]]; then
  DOMAIN="$(qy_domain_from_webhook_url || true)"
fi
export DOMAIN
export PORT

qy_prepare_runtime_dirs "$LABEL"

echo "[${LABEL}] Building and starting stack (volumes preserved)..."
${COMPOSE_BIN} up -d --build

qy_wait_for_health "deploy"

if [[ "$SKIP_CADDY" != "1" ]]; then
  if [[ -z "${DOMAIN:-}" ]]; then
    echo "[${LABEL}] WARN: DOMAIN unset and TELEGRAM_WEBHOOK_URL host unknown — skipping Caddy." >&2
    echo "[${LABEL}] Re-run with DOMAIN=your.host or set TELEGRAM_WEBHOOK_URL, or use SKIP_CADDY=1." >&2
  else
    bash "${ROOT_DIR}/scripts/setup-caddy.sh"
  fi
else
  echo "[${LABEL}] Skipping Caddy (SKIP_CADDY=1)"
fi

if [[ "$SKIP_QF_ENSURE" == "1" ]]; then
  echo "[${LABEL}] Skipping QF ensure (SKIP_QF_ENSURE=1)"
else
  echo "[${LABEL}] Ensuring Quran catalog + mushaf pages (incl. mushaf=10 for reading mode)..."
  FORCE_QF_SYNC="$FORCE_QF_SYNC" RUN_QF_SYNC="$RUN_QF_SYNC" \
    bash "${ROOT_DIR}/scripts/ensure-qf-data.sh"
fi

echo "[${LABEL}] Container status:"
${COMPOSE_BIN} ps

echo "[${LABEL}] Done."
echo "[${LABEL}] Local health: ${HEALTH_URL}"
if [[ -n "${DOMAIN:-}" && "$SKIP_CADDY" != "1" ]]; then
  echo "[${LABEL}] Public health: https://${DOMAIN}/api/v1/health/ready"
fi
echo "[${LABEL}] Manual QF sync anytime: ./scripts/sync-qf.sh"
echo "[${LABEL}] Later updates: ./scripts/update.sh"
