#!/usr/bin/env bash
# Install Caddy (idempotent) and configure reverse proxy to the API.
#
# Usage:
#   DOMAIN=api.example.com ./scripts/setup-caddy.sh
#   DOMAIN=189.74.96.28.sslip.io ./scripts/setup-caddy.sh
#
# PORT always comes from .env (never a stale shell export like PORT=3001).
# DNS A/AAAA for DOMAIN must already point at this host (sslip.io needs no extra DNS).

set -euo pipefail

# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

qy_init_root

LABEL="setup-caddy"

if [[ -f .env ]]; then
  qy_load_env
fi

# Single source of truth: .env PORT (ignores polluted shell PORT=3001).
PORT="$(qy_env_port)"
export PORT

if [[ ! "$PORT" =~ ^[0-9]+$ ]]; then
  echo "[${LABEL}] ERROR: invalid PORT from .env: '${PORT}'" >&2
  exit 1
fi

DOMAIN="$(qy_resolve_domain || true)"
export DOMAIN

if [[ -z "$DOMAIN" ]]; then
  echo "[${LABEL}] DOMAIN is required (export DOMAIN=... or set TELEGRAM_WEBHOOK_URL in .env)." >&2
  echo "[${LABEL}] Example: DOMAIN=189.74.96.28.sslip.io ./scripts/setup-caddy.sh" >&2
  exit 1
fi

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "[${LABEL}] Caddy auto-install is only supported on Linux." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "[${LABEL}] apt-get not found. Install Caddy manually." >&2
  exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "[${LABEL}] Re-run as root (or with sudo) to install/configure Caddy." >&2
  exit 1
fi

if ! command -v caddy >/dev/null 2>&1; then
  echo "[${LABEL}] Installing Caddy..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y
  apt-get install -y caddy
else
  echo "[${LABEL}] Caddy already installed: $(caddy version 2>/dev/null || echo present)"
fi

CADDYFILE="/etc/caddy/Caddyfile"
UPSTREAM="127.0.0.1:${PORT}"
echo "[${LABEL}] Writing ${CADDYFILE} (${DOMAIN} -> ${UPSTREAM})"

cat >"$CADDYFILE" <<EOF
${DOMAIN} {
	encode gzip
	reverse_proxy ${UPSTREAM}
}
EOF

if ! grep -qF "reverse_proxy ${UPSTREAM}" "$CADDYFILE"; then
  echo "[${LABEL}] ERROR: ${CADDYFILE} missing upstream ${UPSTREAM}" >&2
  exit 1
fi

caddy validate --config "$CADDYFILE"
systemctl enable --now caddy
systemctl reload caddy

# Upstream must answer before HTTPS through Caddy can succeed.
LIVE_URL="http://127.0.0.1:${PORT}/api/v1/health/live"
HTTPS_URL="https://${DOMAIN}/api/v1/health/ready"
echo "[${LABEL}] Waiting for local upstream ${LIVE_URL}..."
attempt=0
until curl -fsS "$LIVE_URL" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [[ "$attempt" -ge 30 ]]; then
    echo "[${LABEL}] ERROR: API not listening on ${UPSTREAM} — Caddy will 502." >&2
    echo "[${LABEL}] Fix PORT in .env (expected ${PORT}) and restart API, then re-run this script." >&2
    exit 1
  fi
  sleep 1
done
echo "[${LABEL}] Local upstream is up"

echo "[${LABEL}] Waiting for public HTTPS ${HTTPS_URL}..."
attempt=0
until curl -fsS "$HTTPS_URL" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [[ "$attempt" -ge 30 ]]; then
    echo "[${LABEL}] ERROR: https://${DOMAIN} not ready after ~30s." >&2
    echo "[${LABEL}] Check: ufw allow 80/tcp && ufw allow 443/tcp; DOMAIN spelling; journalctl -u caddy -n 50" >&2
    echo "[${LABEL}] Cert may still be issuing — retry: systemctl reload caddy && curl -sS ${HTTPS_URL}" >&2
    exit 1
  fi
  sleep 1
done

echo "[${LABEL}] Caddy is serving https://${DOMAIN}/"
echo "[${LABEL}] Upstream: ${UPSTREAM} (from .env PORT — not shell)"
echo "[${LABEL}] Health: ${HTTPS_URL}"
