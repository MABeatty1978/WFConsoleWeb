#!/usr/bin/env bash
set -euo pipefail

ACTION="status"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --action)
      ACTION="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TASK_NAME="wfconsoleweb"

json_result() {
  local enabled="$1"
  local message="$2"
  local error="${3:-}"

  if [[ -n "$error" ]]; then
    printf '{"enabled":%s,"supported":true,"platform":"linux","service_name":"%s","message":"%s","error":"%s"}\n' "$enabled" "$TASK_NAME" "$message" "$error"
  else
    printf '{"enabled":%s,"supported":true,"platform":"linux","service_name":"%s","message":"%s"}\n' "$enabled" "$TASK_NAME" "$message"
  fi
}

is_enabled() {
  if systemctl --user is-enabled "${TASK_NAME}.service" >/dev/null 2>&1; then
    echo true
    return
  fi

  if systemctl is-enabled "${TASK_NAME}.service" >/dev/null 2>&1; then
    echo true
    return
  fi

  echo false
}

enable_service() {
  if systemctl --user list-unit-files "${TASK_NAME}.service" >/dev/null 2>&1; then
    systemctl --user enable "${TASK_NAME}.service" >/dev/null 2>&1
    return
  fi

  if systemctl list-unit-files "${TASK_NAME}.service" >/dev/null 2>&1; then
    systemctl enable "${TASK_NAME}.service" >/dev/null 2>&1
    return
  fi

  return 1
}

disable_service() {
  if systemctl --user list-unit-files "${TASK_NAME}.service" >/dev/null 2>&1; then
    systemctl --user disable "${TASK_NAME}.service" >/dev/null 2>&1 || true
    return
  fi

  if systemctl list-unit-files "${TASK_NAME}.service" >/dev/null 2>&1; then
    systemctl disable "${TASK_NAME}.service" >/dev/null 2>&1 || true
    return
  fi

  return 0
}

case "$ACTION" in
  status)
    ENABLED="$(is_enabled)"
    json_result "$ENABLED" "Autostart status retrieved."
    ;;
  enable)
    if enable_service; then
      json_result true "Autostart enabled."
    else
      json_result false "Autostart operation failed." "wfconsoleweb.service not found. Install and enable service first."
      exit 1
    fi
    ;;
  disable)
    disable_service
    json_result false "Autostart disabled."
    ;;
  *)
    json_result false "Autostart operation failed." "Unknown action: ${ACTION}"
    exit 1
    ;;
esac
