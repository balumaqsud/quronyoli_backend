#!/usr/bin/env bash
# Install Caddy (idempotent) and configure reverse proxy to the API.
#
# Usage:
#   DOMAIN=api.example.com ./scripts/setup-caddy.sh
#   PORT=3000 DOMAIN=api.example.com ./scripts/setup-caddy.sh
#
# DNS A/AAAA for DOMAIN must already point at this host.

set -euo pipefail

# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

qy_init_root

LABEL="setup-caddy"
PORT="${PORT:-3000}"

# Prefer PORT from .env over a stale shell export (e.g. leftover PORT=3001).
if [[ -f .env ]]; then
  qy_load_env
  env_port="$(
    grep -E '^[[:space:]]*PORT=' .env \
      | tail -1 \
      | cut -d= -f2- \
      | tr -d '[:space:]"'"'"'' \
      || true
  )"
  if [[ -n "${env_port}" ]]; then
    PORT="${env_port}"
  else
    PORT="${PORT:-3000}"
  fi
fi

DOMAIN="${DOMAIN:-}"
if [[ -z "$DOMAIN" ]]; then
  DOMAIN="$(qy_domain_from_webhook_url || true)"
fi

if [[ -z "$DOMAIN" ]]; then
  echo "[${LABEL}] DOMAIN is required (export DOMAIN=... or set TELEGRAM_WEBHOOK_URL in .env)." >&2
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

echo "[${LABEL}] Caddy is serving https://${DOMAIN}/"
echo "[${LABEL}] Ensure DNS A/AAAA for ${DOMAIN} points at this host (script cannot create DNS)."
echo "[${LABEL}] Health (after TLS): https://${DOMAIN}/api/v1/health/ready"
