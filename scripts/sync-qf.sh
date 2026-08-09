#!/usr/bin/env bash
# Idempotent Quran.Foundation catalog + mushaf page sync (Compose api container).
#
# Syncs:
#   - catalog (translations / tafsirs / reciters)
#   - mushaf 1 (full crawl — QCF V2 / Madani coords)
#   - mushaf 4,5,19 (clone coords from 1)
#   - mushaf 10 (full crawl — FE book/reading mode default; do NOT clone)
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

LABEL="sync-qf"

if ! ${COMPOSE_BIN} ps --status running -q api 2>/dev/null | grep -q .; then
  echo "[${LABEL}] api container is not running. Start the stack first (./scripts/deploy.sh)." >&2
  exit 1
fi

echo "[${LABEL}] Syncing Quran.Foundation catalog..."
${COMPOSE_BIN} exec -T api npm run qf:sync-catalog:prod

echo "[${LABEL}] Syncing mushaf pages: mushaf=1 (full crawl)..."
${COMPOSE_BIN} exec -T api npm run qf:sync-pages:prod -- --mushaf=1

echo "[${LABEL}] Cloning Madani layout to mushaf=4,5,19 from 1..."
${COMPOSE_BIN} exec -T api npm run qf:sync-pages:prod -- --mushaf=4,5,19 --clone-from=1

echo "[${LABEL}] Syncing mushaf pages: mushaf=10 (book/reading mode, full crawl)..."
${COMPOSE_BIN} exec -T api npm run qf:sync-pages:prod -- --mushaf=10

echo "[${LABEL}] Done. Enable translations/tafsirs in admin as needed."
echo "[${LABEL}] Reading mode needs mushaf=10 (604 active pages)."
