#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

PORT=9013
LLM_PORT=11436
USE_REAL_OLLAMA=0
STOP_AFTER=1
FORCE_KILL_PORT=1

usage() {
  cat <<'EOF'
Usage:
  scripts/ops/run_0155_prompt_filltable_local.sh [options]

Options:
  --port <port>         UI server port (default: 9013)
  --llm-port <port>     Mock ollama port (default: 11436)
  --llm-model <name>    LLM model name (default: mt-label)
  --real-ollama         Use real Ollama at http://127.0.0.1:11434 (skip mock)
  --keep-running        Keep local services running after verify
  --no-force-kill       Do not kill existing listener on target port
  -h, --help            Show help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --port)
      PORT="${2:?missing value for --port}"
      shift 2
      ;;
    --llm-port)
      LLM_PORT="${2:?missing value for --llm-port}"
      shift 2
      ;;
    --llm-model)
      LLM_MODEL="${2:?missing value for --llm-model}"
      shift 2
      ;;
    --real-ollama)
      USE_REAL_OLLAMA=1
      shift
      ;;
    --keep-running)
      STOP_AFTER=0
      shift
      ;;
    --no-force-kill)
      FORCE_KILL_PORT=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[run-0155] unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[run-0155] missing command: $1" >&2
    exit 1
  fi
}

need_cmd node
need_cmd bash
need_cmd lsof
need_cmd curl

MOCK_PID=""
MOCK_LOG="/tmp/dongyu-mock-ollama-${LLM_PORT}.log"
SERVER_PID_FILE="/tmp/dongyu-ui-server-llm-${PORT}.pid"
LLM_BASE_URL="http://127.0.0.1:${LLM_PORT}"
LLM_MODEL="${LLM_MODEL:-mt-label}"

cleanup() {
  if [ "$STOP_AFTER" -eq 1 ]; then
    if [ -f "$SERVER_PID_FILE" ]; then
      local spid
      spid="$(cat "$SERVER_PID_FILE" 2>/dev/null || true)"
      if [ -n "${spid:-}" ] && kill -0 "$spid" >/dev/null 2>&1; then
        kill "$spid" >/dev/null 2>&1 || true
        echo "[run-0155] stopped ui-server pid=$spid"
      fi
    fi
    if [ -n "${MOCK_PID:-}" ] && kill -0 "$MOCK_PID" >/dev/null 2>&1; then
      kill "$MOCK_PID" >/dev/null 2>&1 || true
      echo "[run-0155] stopped mock-ollama pid=$MOCK_PID"
    fi
  fi
}
trap cleanup EXIT

cd "$ROOT_DIR"

if [ "$USE_REAL_OLLAMA" -eq 1 ]; then
  LLM_BASE_URL="http://127.0.0.1:11434"
  echo "[run-0155] using real ollama: $LLM_BASE_URL"
else
  if lsof -iTCP:"$LLM_PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
    lsof -tiTCP:"$LLM_PORT" -sTCP:LISTEN | xargs -r kill
    sleep 1
  fi
  echo "[run-0155] starting mock ollama on port $LLM_PORT"
  nohup node "$SCRIPT_DIR/mock_ollama_server.mjs" "$LLM_PORT" >"$MOCK_LOG" 2>&1 < /dev/null &
  MOCK_PID="$!"
  for _ in $(seq 1 30); do
    if curl -fsS "$LLM_BASE_URL/api/tags" >/dev/null 2>&1; then
      break
    fi
    sleep 0.3
  done
  curl -fsS "$LLM_BASE_URL/api/tags" >/dev/null
fi

echo "[run-0155] step1 start local ui-server"
START_ARGS=(
  --port "$PORT"
  --llm-base-url "$LLM_BASE_URL"
  --llm-model "$LLM_MODEL"
  --workspace "ws_prompt_filltable_0155"
)
if [ "$FORCE_KILL_PORT" -eq 1 ]; then
  START_ARGS+=(--force-kill-port)
fi
bash "$SCRIPT_DIR/start_local_ui_server_with_ollama.sh" "${START_ARGS[@]}"

echo "[run-0155] step2 verify prompt filltable roundtrip"
bash "$SCRIPT_DIR/verify_0155_prompt_filltable.sh" --base-url "http://127.0.0.1:${PORT}"

echo "[run-0155] PASS"
