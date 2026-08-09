#!/usr/bin/env bash
# Ensure required mushaf page rows exist; sync only when missing.
#
# Skips when mushaf 1 and mushaf 10 each have 604 active rows (unless forced).
# When QF_MUSHAF_1405_IMAGE_BASE or PUBLIC_API_ORIGIN is set, also requires 604 rows for mushaf 1405.
#
# Usage:
#   ./scripts/ensure-qf-data.sh
#   FORCE_QF_SYNC=1 ./scripts/ensure-qf-data.sh   # always run full sync-qf.sh
#   RUN_QF_SYNC=1 ./scripts/ensure-qf-data.sh     # same as FORCE (deploy alias)

set -euo pipefail

# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

qy_init_root
qy_refuse_destructive_args "ensure-qf" "$@"
qy_require_compose_file "ensure-qf"

LABEL="ensure-qf"
FORCE_QF_SYNC="${FORCE_QF_SYNC:-0}"
# deploy.sh historically used RUN_QF_SYNC=1 to mean "force sync now"
if [[ "${RUN_QF_SYNC:-0}" == "1" ]]; then
  FORCE_QF_SYNC=1
fi

REQUIRED_PAGES="${REQUIRED_PAGES:-604}"
REQUIRED_MUSHAFS="${REQUIRED_MUSHAFS:-1 10}"

MUSHAF_1405_BASE=""
if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
  MUSHAF_1405_BASE="$(printf '%s' "${QF_MUSHAF_1405_IMAGE_BASE:-}" | tr -d '[:space:]')"
  if [[ -z "$MUSHAF_1405_BASE" ]]; then
    origin="$(printf '%s' "${PUBLIC_API_ORIGIN:-}" | tr -d '[:space:]')"
    if [[ -n "$origin" ]]; then
      MUSHAF_1405_BASE="${origin%/}/uploads/mushaf/1405"
    fi
  fi
fi

if [[ -n "$MUSHAF_1405_BASE" ]]; then
  REQUIRED_MUSHAFS="${REQUIRED_MUSHAFS} 1405"
  echo "[${LABEL}] Classic Medina image base set — will also ensure mushaf=1405"
fi

if ! ${COMPOSE_BIN} ps --status running -q api 2>/dev/null | grep -q .; then
  echo "[${LABEL}] api container is not running. Start the stack first." >&2
  exit 1
fi

count_active_pages() {
  local mushaf_id="$1"
  # Query via postgres service so we do not depend on prisma CLI flags inside api.
  ${COMPOSE_BIN} exec -T postgres \
    sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT COUNT(*)::int FROM mushaf_pages WHERE mushaf_id='"${mushaf_id}"' AND is_active = true"' \
    | tr -d '[:space:]'
}

if [[ "$FORCE_QF_SYNC" == "1" ]]; then
  echo "[${LABEL}] FORCE_QF_SYNC=1 — running full sync..."
  bash "${ROOT_DIR}/scripts/sync-qf.sh"
  exit 0
fi

NEED_SYNC=0
for mushaf_id in $REQUIRED_MUSHAFS; do
  count="$(count_active_pages "$mushaf_id" || echo 0)"
  if [[ -z "$count" || ! "$count" =~ ^[0-9]+$ ]]; then
    echo "[${LABEL}] WARN: could not read page count for mushaf=${mushaf_id}; will sync." >&2
    NEED_SYNC=1
    break
  fi
  echo "[${LABEL}] mushaf=${mushaf_id} active pages=${count} (need ${REQUIRED_PAGES})"
  if [[ "$count" -lt "$REQUIRED_PAGES" ]]; then
    NEED_SYNC=1
  fi
done

if [[ "$NEED_SYNC" -eq 0 ]]; then
  echo "[${LABEL}] Required mushaf pages already present — skipping sync."
  exit 0
fi

echo "[${LABEL}] Missing page rows — running ./scripts/sync-qf.sh ..."
bash "${ROOT_DIR}/scripts/sync-qf.sh"
