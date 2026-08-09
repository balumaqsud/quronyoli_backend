#!/usr/bin/env bash
# Idempotent Quran.Foundation catalog + mushaf page sync (Compose api container).
#
# Syncs:
#   - catalog (translations / tafsirs / reciters)
#   - mushaf 1 (full crawl — QCF V2 / Madani coords)
#   - mushaf 4,5,19 (clone coords from 1)
#   - mushaf 10 (full crawl — FE book/reading mode default; do NOT clone)
#   - mushaf 1405 (clone from 1) only when QF_MUSHAF_1405_IMAGE_BASE is set
#
# Usage (repo root, stack running):
#   ./scripts/sync-qf.sh
#   npm run sync:qf

set -euo pipefail

# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

qy_init_root
qy_refuse_destructive_args "sync-qf" "$@"
qy_require_compose_file "sync-qf"
qy_load_env

LABEL="sync-qf"

if ! ${COMPOSE_BIN} ps --status running -q api 2>/dev/null | grep -q .; then
  echo "[${LABEL}] api container is not running. Start the stack first (./scripts/deploy.sh)." >&2
  exit 1
fi

# Load optional QF_MUSHAF_1405_IMAGE_BASE from .env without exporting secrets broadly.
MUSHAF_1405_BASE=""
if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
  MUSHAF_1405_BASE="$(printf '%s' "${QF_MUSHAF_1405_IMAGE_BASE:-}" | tr -d '[:space:]')"
fi

echo "[${LABEL}] Syncing Quran.Foundation catalog..."
${COMPOSE_BIN} exec -T api npm run qf:sync-catalog:prod

echo "[${LABEL}] Syncing mushaf pages: mushaf=1 (full crawl)..."
${COMPOSE_BIN} exec -T api npm run qf:sync-pages:prod -- --mushaf=1

echo "[${LABEL}] Cloning Madani layout to mushaf=4,5,19 from 1..."
${COMPOSE_BIN} exec -T api npm run qf:sync-pages:prod -- --mushaf=4,5,19 --clone-from=1

echo "[${LABEL}] Syncing mushaf pages: mushaf=10 (book/reading mode, full crawl)..."
${COMPOSE_BIN} exec -T api npm run qf:sync-pages:prod -- --mushaf=10

if [[ -n "$MUSHAF_1405_BASE" ]]; then
  echo "[${LABEL}] Cloning Madani layout to mushaf=1405 from 1 (QF_MUSHAF_1405_IMAGE_BASE set)..."
  ${COMPOSE_BIN} exec -T api npm run qf:sync-pages:prod -- --mushaf=1405 --clone-from=1
  echo "[${LABEL}] Ensure WebPs exist at uploads/mushaf/1405/{1..604}.webp and are reachable via ${MUSHAF_1405_BASE}"
else
  echo "[${LABEL}] Skipping mushaf=1405 — set QF_MUSHAF_1405_IMAGE_BASE and upload WebPs to enable Classic Medina."
fi

echo "[${LABEL}] Done. Enable translations/tafsirs in admin as needed."
echo "[${LABEL}] Reading mode needs mushaf=10 (604 active pages)."
