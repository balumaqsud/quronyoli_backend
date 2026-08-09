#!/usr/bin/env bash
# One-command DB repair for missing/empty quron_yoli (Prisma P1003).
#
# Usage:
#   CONFIRM_RESTORE=yes ./scripts/repair-db.sh
#   CONFIRM_RESTORE=yes ./scripts/repair-db.sh backups/20260809T090949Z
#
# Flow: ensure Postgres up → CREATE DATABASE if missing → restore dump →
# restart API → wait for health → ensure-qf-data (unless SKIP_QF_ENSURE=1).
#
# Never removes Docker volumes.

set -euo pipefail

# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

qy_init_root
qy_refuse_destructive_args "repair-db" "$@"
qy_require_compose_file "repair-db"
qy_require_env_file "repair-db"
qy_load_env

LABEL="repair-db"
SKIP_QF_ENSURE="${SKIP_QF_ENSURE:-0}"
SKIP_API_RESTART="${SKIP_API_RESTART:-0}"

if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "Refusing to repair/restore without CONFIRM_RESTORE=yes" >&2
  echo "Example: CONFIRM_RESTORE=yes ./scripts/repair-db.sh [backup-dir]" >&2
  echo "Omit backup-dir to use the latest under backups/" >&2
  exit 1
fi

BACKUP_DIR="${1:-}"
if [[ -z "$BACKUP_DIR" ]]; then
  BACKUP_DIR="$(qy_latest_backup_dir || true)"
  if [[ -z "$BACKUP_DIR" ]]; then
    echo "[${LABEL}] No backup directory given and none found under backups/." >&2
    echo "[${LABEL}] Refusing to leave production on an empty seeded DB." >&2
    exit 1
  fi
  echo "[${LABEL}] Using latest backup: ${BACKUP_DIR}"
fi

if [[ ! -d "$BACKUP_DIR" && -d "${ROOT_DIR}/${BACKUP_DIR}" ]]; then
  BACKUP_DIR="${ROOT_DIR}/${BACKUP_DIR}"
fi
if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "[${LABEL}] Backup directory not found: ${BACKUP_DIR}" >&2
  exit 1
fi
if [[ ! -f "${BACKUP_DIR}/postgres.dump" ]]; then
  echo "[${LABEL}] Missing ${BACKUP_DIR}/postgres.dump" >&2
  exit 1
fi

echo "[${LABEL}] Repo: ${ROOT_DIR}"
echo "[${LABEL}] Ensuring postgres/redis are up (volumes preserved)..."
${COMPOSE_BIN} up -d postgres redis

# Wait for postgres health
echo "[${LABEL}] Waiting for Postgres..."
attempt=0
until ${COMPOSE_BIN} exec -T postgres pg_isready -U "${POSTGRES_USER}" -d postgres >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [[ "$attempt" -ge 30 ]]; then
    echo "[${LABEL}] Postgres did not become ready." >&2
    exit 1
  fi
  sleep 2
done

qy_ensure_database "$LABEL"

echo "[${LABEL}] Restoring from ${BACKUP_DIR}..."
CONFIRM_RESTORE=yes COMPOSE_BIN="${COMPOSE_BIN}" \
  bash "${ROOT_DIR}/scripts/restore.sh" "$BACKUP_DIR"

if [[ "$SKIP_API_RESTART" == "1" ]]; then
  echo "[${LABEL}] Skipping API restart (SKIP_API_RESTART=1)"
else
  echo "[${LABEL}] Restarting API..."
  REBUILD="${REBUILD:-0}" bash "${ROOT_DIR}/scripts/restart-api.sh" || {
    # If health failed because of QF timing, still try ensure; but surface failure
    echo "[${LABEL}] WARN: restart-api reported failure; checking doctor next" >&2
  }
fi

qy_assert_postgres_data_sane "$LABEL"

if [[ "$SKIP_QF_ENSURE" == "1" ]]; then
  echo "[${LABEL}] Skipping QF ensure (SKIP_QF_ENSURE=1)"
else
  echo "[${LABEL}] Ensuring Quran catalog + mushaf pages..."
  FORCE_QF_SYNC="${FORCE_QF_SYNC:-0}" RUN_QF_SYNC="${RUN_QF_SYNC:-0}" \
    bash "${ROOT_DIR}/scripts/ensure-qf-data.sh" || {
      echo "[${LABEL}] WARN: ensure-qf-data failed — run ./scripts/sync-qf.sh manually" >&2
    }
fi

echo "[${LABEL}] Verifying readiness..."
if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
  echo "[${LABEL}] Ready: ${HEALTH_URL}"
else
  echo "[${LABEL}] WARN: ${HEALTH_URL} not ready yet — check ./scripts/doctor.sh and api logs" >&2
  ${COMPOSE_BIN} logs --tail=40 api || true
  exit 1
fi

echo "[${LABEL}] Done."
