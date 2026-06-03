#!/usr/bin/env bash
set -euo pipefail

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="${PWCLI:-$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh}"
DY_PW_SESSION="${DY_PW_SESSION:-dy-0400}"
PROJECT_PROCESS_PATTERN="${PROJECT_PROCESS_PATTERN:-$DY_PW_SESSION|playwright_chromiumdev_profile.*$DY_PW_SESSION}"

usage() {
  cat <<'USAGE'
Usage:
  scripts/ops/playwright_session_guard.sh cleanup
  scripts/ops/playwright_session_guard.sh check-clean
  scripts/ops/playwright_session_guard.sh list
  scripts/ops/playwright_session_guard.sh session <playwright-cli-command> [args...]
  scripts/ops/playwright_session_guard.sh with-cleanup <command> [args...]

Rules:
  - Uses one fixed Playwright session, default DY_PW_SESSION=dy-0400.
  - Cleans only the named Playwright session/profile for this project.
  - Does not kill ordinary user Chrome windows.
USAGE
}

require_pwcli() {
  if [[ ! -x "$PWCLI" ]]; then
    echo "Playwright CLI wrapper not found or not executable: $PWCLI" >&2
    exit 2
  fi
}

list_sessions() {
  require_pwcli
  "$PWCLI" list
}

project_session_lines() {
  list_sessions | grep -F "$DY_PW_SESSION" || true
}

project_processes() {
  pgrep -fl "$PROJECT_PROCESS_PATTERN" | grep -E 'playwright|chromium|Chrome' || true
}

check_clean() {
  require_pwcli
  local sessions
  sessions="$(project_session_lines)"
  local processes
  processes="$(project_processes)"
  if [[ -n "$sessions" ]]; then
    echo "Project Playwright session still active: $DY_PW_SESSION" >&2
    echo "$sessions" >&2
    return 1
  fi
  if [[ -n "$processes" ]]; then
    echo "Project Playwright-managed browser processes still active for session: $DY_PW_SESSION" >&2
    echo "$processes" >&2
    return 1
  fi
  echo "PASS: no project Playwright session or project Playwright-managed browser process remains for $DY_PW_SESSION"
}

cleanup() {
  require_pwcli
  "$PWCLI" -s="$DY_PW_SESSION" close >/dev/null 2>&1 || true
  "$PWCLI" -s="$DY_PW_SESSION" delete-data >/dev/null 2>&1 || true
  check_clean
}

cmd="${1:-}"
case "$cmd" in
  cleanup)
    cleanup
    ;;
  check-clean)
    check_clean
    ;;
  list)
    list_sessions
    ;;
  session)
    require_pwcli
    shift
    if [[ $# -eq 0 ]]; then
      usage >&2
      exit 2
    fi
    "$PWCLI" -s="$DY_PW_SESSION" "$@"
    ;;
  with-cleanup)
    shift
    if [[ $# -eq 0 ]]; then
      usage >&2
      exit 2
    fi
    trap cleanup EXIT
    cleanup
    "$@"
    ;;
  ""|-h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
