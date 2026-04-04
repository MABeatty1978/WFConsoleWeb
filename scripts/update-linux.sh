#!/usr/bin/env bash
set -euo pipefail

ASSET_URL=""
EXPECTED_VERSION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --asset-url)
      ASSET_URL="$2"
      shift 2
      ;;
    --expected-version)
      EXPECTED_VERSION="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$ASSET_URL" ]]; then
  echo "--asset-url is required"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${REPO_ROOT}/.runtime"
UPDATE_DIR="${RUNTIME_DIR}/updates"
BACKUP_DIR="${RUNTIME_DIR}/backups"
LOG_FILE="${RUNTIME_DIR}/update.log"

mkdir -p "${RUNTIME_DIR}" "${UPDATE_DIR}" "${BACKUP_DIR}"

log() {
  echo "$(date -Iseconds) [update] $1" >> "${LOG_FILE}"
}

resolve_db_path() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "${REPO_ROOT}/wfconsoleweb.db"
    return 0
  fi

  if [[ "${DATABASE_URL}" == sqlite:///* ]]; then
    local p="${DATABASE_URL#sqlite:///}"
    if [[ "${p}" = /* ]]; then
      echo "${p}"
    else
      echo "${REPO_ROOT}/${p}"
    fi
    return 0
  fi

  echo ""
}

restart_backend() {
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl list-unit-files | grep -q "wfconsoleweb"; then
      sudo systemctl restart wfconsoleweb || true
      return 0
    fi
  fi

  pkill -f "wfconsoleweb.backend.main" || true
  if [[ -x "${REPO_ROOT}/venv/bin/python" ]]; then
    nohup "${REPO_ROOT}/venv/bin/python" -m wfconsoleweb.backend.main >/dev/null 2>&1 &
  else
    nohup python3 -m wfconsoleweb.backend.main >/dev/null 2>&1 &
  fi
}

main() {
  log "Starting update. AssetUrl=${ASSET_URL} ExpectedVersion=${EXPECTED_VERSION}"

  local db_path
  db_path="$(resolve_db_path)"
  if [[ -n "${db_path}" && -f "${db_path}" ]]; then
    local ts
    ts="$(date +%Y%m%d-%H%M%S)"
    cp "${db_path}" "${BACKUP_DIR}/wfconsoleweb-${ts}.db"
    log "Database backup created"
  else
    log "Database backup skipped (non-sqlite or missing file)"
  fi

  local file_name
  file_name="$(basename "${ASSET_URL%%\?*}")"
  if [[ -z "${file_name}" ]]; then
    log "Failed to determine filename from URL"
    exit 1
  fi

  local asset_path="${UPDATE_DIR}/${file_name}"
  curl -L --fail "${ASSET_URL}" -o "${asset_path}"

  if command -v systemctl >/dev/null 2>&1; then
    if systemctl list-unit-files | grep -q "wfconsoleweb"; then
      sudo systemctl stop wfconsoleweb || true
    fi
  else
    pkill -f "wfconsoleweb.backend.main" || true
  fi

  if [[ -x "${REPO_ROOT}/venv/bin/python" ]]; then
    "${REPO_ROOT}/venv/bin/python" -m pip install --upgrade "${asset_path}"
  else
    python3 -m pip install --upgrade "${asset_path}"
  fi

  restart_backend
  log "Update completed successfully"
}

main
