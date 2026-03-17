#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

PORT=9016
LLM_BASE_URL="${LLM_BASE_URL:-http://127.0.0.1:11434}"
LLM_MODEL="${LLM_MODEL:-mt-label}"
WORKSPACE="${WORKER_BASE_WORKSPACE:-ws_filltable_capability_matrix}"
REPORT_FILE=""
RUNNER_ARGS=()

usage() {
  cat <<'EOF'
Usage:
  scripts/ops/run_filltable_capability_matrix_local.sh [options]

Options:
  --port <port>             Local server port (default: 9016)
  --llm-base-url <url>      LLM endpoint base URL (default: http://127.0.0.1:11434)
  --llm-model <name>        LLM model name (default: mt-label)
  --workspace <name>        WORKER_BASE_WORKSPACE value
  --scenario <id>           Run one scenario id (repeatable)
  --tag <tag>               Run all scenarios with tag (repeatable)
  --report-file <path>      Save JSON report to file
  --list                    List available scenarios and tags
  -h, --help                Show help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --port)
      PORT="${2:?missing value for --port}"
      shift 2
      ;;
    --llm-base-url)
      LLM_BASE_URL="${2:?missing value for --llm-base-url}"
      shift 2
      ;;
    --llm-model)
      LLM_MODEL="${2:?missing value for --llm-model}"
      shift 2
      ;;
    --workspace)
      WORKSPACE="${2:?missing value for --workspace}"
      shift 2
      ;;
    --scenario|--tag)
      RUNNER_ARGS+=("$1" "${2:?missing value for $1}")
      shift 2
      ;;
    --report-file)
      REPORT_FILE="${2:?missing value for --report-file}"
      shift 2
      ;;
    --list)
      RUNNER_ARGS+=("--list")
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[capability-matrix] unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [ ${#RUNNER_ARGS[@]} -eq 1 ] && [ "${RUNNER_ARGS[0]}" = "--list" ]; then
  exec node "$SCRIPT_DIR/run_filltable_capability_matrix.mjs" --list
fi

PID_FILE="/tmp/dongyu-ui-server-llm-${PORT}.pid"

cleanup() {
  if [ -f "$PID_FILE" ]; then
    kill "$(cat "$PID_FILE")" >/dev/null 2>&1 || true
    rm -f "$PID_FILE"
  fi
}
trap cleanup EXIT

bash "$SCRIPT_DIR/start_local_ui_server_with_ollama.sh" \
  --port "$PORT" \
  --llm-base-url "$LLM_BASE_URL" \
  --llm-model "$LLM_MODEL" \
  --workspace "$WORKSPACE" \
  --force-kill-port

curl -fsS -X POST "$LLM_BASE_URL/api/generate" \
  -H 'content-type: application/json' \
  -d "{\"model\":\"$LLM_MODEL\",\"prompt\":\"{}\",\"stream\":false,\"think\":false,\"options\":{\"temperature\":0.1,\"num_predict\":64}}" \
  >/dev/null

cd "$ROOT_DIR"
NODE_ARGS=("$SCRIPT_DIR/run_filltable_capability_matrix.mjs" --base-url "http://127.0.0.1:${PORT}")
if [ -n "$REPORT_FILE" ]; then
  NODE_ARGS+=(--report-file "$REPORT_FILE")
fi
if [ ${#RUNNER_ARGS[@]} -gt 0 ]; then
  NODE_ARGS+=("${RUNNER_ARGS[@]}")
fi
node "${NODE_ARGS[@]}"
