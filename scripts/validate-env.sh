#!/usr/bin/env bash
# Validate production .env before deploy. Never prints secret values.
#
# Usage (from repo root or any cwd; resolves via script location):
#   ./scripts/validate-env.sh

set -euo pipefail

# Prefer Homebrew bash on macOS if /usr/bin/env bash is 3.x (no ${var,,}).
# Ubuntu 24.04 ships Bash 4+.

# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

qy_init_root
qy_require_env_file "validate-env"

LABEL="validate-env"
ERRORS=0
WARNINGS=0

fail() {
  echo "[${LABEL}] ERROR: $*" >&2
  ERRORS=$((ERRORS + 1))
}

warn() {
  echo "[${LABEL}] WARN: $*" >&2
  WARNINGS=$((WARNINGS + 1))
}

# Read KEY value from .env (first match). Does not print or echo secret elsewhere.
env_get() {
  local key="$1"
  local line val
  line="$(grep -E "^${key}=" .env | head -n1 || true)"
  [[ -z "$line" ]] && return 0
  val="${line#*=}"
  val="${val%$'\r'}"
  if [[ "$val" =~ ^\"(.*)\"$ ]]; then
    val="${BASH_REMATCH[1]}"
  elif [[ "$val" =~ ^\'(.*)\'$ ]]; then
    val="${BASH_REMATCH[1]}"
  fi
  printf '%s' "$val"
}

to_lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

require_nonempty() {
  local key="$1"
  local val
  val="$(env_get "$key")"
  if [[ -z "$val" ]]; then
    fail "${key} is missing or empty"
  fi
}

require_min_len() {
  local key="$1"
  local min="$2"
  local val
  val="$(env_get "$key")"
  if [[ -z "$val" ]]; then
    fail "${key} is missing or empty"
    return
  fi
  if [[ "${#val}" -lt "$min" ]]; then
    fail "${key} must be at least ${min} characters (got ${#val})"
  fi
}

reject_placeholder() {
  local key="$1"
  local val lower
  val="$(env_get "$key")"
  [[ -z "$val" ]] && return
  lower="$(to_lower "$val")"
  case "$val" in
    *REPLACE_*)
      fail "${key} still looks like a placeholder"
      return
      ;;
  esac
  case "$lower" in
    *change-me* | *your_*)
      fail "${key} still looks like a placeholder"
      ;;
  esac
}

# Global placeholder scan
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    val="${BASH_REMATCH[2]}"
    lower="$(to_lower "$val")"
    case "$val" in
      *REPLACE_*)
        fail "${key} still contains a placeholder value"
        continue
        ;;
    esac
    case "$lower" in
      *change-me*)
        fail "${key} still contains a placeholder value"
        ;;
    esac
  fi
done < .env

require_min_len REDIS_PASSWORD 16
require_min_len JWT_ACCESS_SECRET 32
require_min_len JWT_REFRESH_SECRET 32
require_min_len TELEGRAM_BOT_TOKEN 30
require_min_len TELEGRAM_BOT_USERNAME 3
require_min_len TELEGRAM_WEBHOOK_SECRET 16
require_min_len QF_CLIENT_ID 8
require_min_len QF_CLIENT_SECRET 8
require_nonempty TELEGRAM_WEB_APP_URL
require_nonempty NODE_ENV

reject_placeholder REDIS_PASSWORD
reject_placeholder JWT_ACCESS_SECRET
reject_placeholder JWT_REFRESH_SECRET
reject_placeholder TELEGRAM_BOT_TOKEN
reject_placeholder QF_CLIENT_ID
reject_placeholder QF_CLIENT_SECRET

NODE_ENV_VAL="$(env_get NODE_ENV)"
if [[ "$NODE_ENV_VAL" != "production" ]]; then
  warn "NODE_ENV is '${NODE_ENV_VAL:-empty}' (expected production for this deploy path)"
fi

TRUST="$(env_get TRUST_PROXY)"
TRUST_LOWER="$(to_lower "$TRUST")"
if [[ "$TRUST_LOWER" != "true" && "$TRUST" != "1" ]]; then
  warn "TRUST_PROXY is not true — set TRUST_PROXY=true behind Caddy/nginx"
fi

if [[ "$ERRORS" -gt 0 ]]; then
  echo "[${LABEL}] Failed with ${ERRORS} error(s), ${WARNINGS} warning(s)." >&2
  exit 1
fi

echo "[${LABEL}] .env OK (${WARNINGS} warning(s))."
