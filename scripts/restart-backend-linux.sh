#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Delay allows API response to return before restart action.
nohup bash -lc "sleep 2; if systemctl --user is-active wfconsoleweb.service >/dev/null 2>&1 || systemctl --user list-unit-files wfconsoleweb.service >/dev/null 2>&1; then systemctl --user restart wfconsoleweb.service; elif systemctl is-active wfconsoleweb.service >/dev/null 2>&1 || systemctl list-unit-files wfconsoleweb.service >/dev/null 2>&1; then systemctl restart wfconsoleweb.service; else pkill -f 'wfconsoleweb.backend.main' >/dev/null 2>&1 || true; cd '${REPO_ROOT}'; if [[ -x '${REPO_ROOT}/.venv/bin/python' ]]; then '${REPO_ROOT}/.venv/bin/python' -m wfconsoleweb.backend.main >/dev/null 2>&1 & else python3 -m wfconsoleweb.backend.main >/dev/null 2>&1 & fi; fi" >/dev/null 2>&1 &
