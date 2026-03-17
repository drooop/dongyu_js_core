#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

PORT=9012
RUN_BASELINE=0
FORCE_KILL_PORT=0
FOREGROUND=0
LOG_FILE=""
PID_FILE=""
LLM_BASE_URL="${LLM_BASE_URL:-http://127.0.0.1:11434}"
LLM_MODEL="${LLM_MODEL:-mt-label}"
LLM_TIMEOUT_MS="${LLM_TIMEOUT_MS:-180000}"
LLM_MAX_TOKENS="${LLM_MAX_TOKENS:-1024}"
WORKER_BASE_WORKSPACE="${WORKER_BASE_WORKSPACE:-ws_llm_dispatch_0154}"
WORKER_BASE_DATA_ROOT="${WORKER_BASE_DATA_ROOT:-}"

usage() {
  cat <<'EOF'
Usage:
  scripts/ops/start_local_ui_server_with_ollama.sh [options]

Options:
  --port <port>             Server port (default: 9012)
  --llm-base-url <url>      LLM endpoint base URL (default: http://127.0.0.1:11434)
  --llm-model <name>        LLM model name (default: mt-label)
  --llm-timeout-ms <ms>     LLM timeout in ms (default: 180000)
  --llm-max-tokens <n>      LLM num_predict upper bound (default: 1024)
  --run-baseline            Run scripts/ops/check_runtime_baseline.sh before start
  --force-kill-port         Kill existing listener on target port
  --foreground              Run in foreground
  --log-file <path>         Log file path (background mode)
  --pid-file <path>         PID file path (background mode)
  --workspace <name>        WORKER_BASE_WORKSPACE value
  --data-root <path>        WORKER_BASE_DATA_ROOT value
  -h, --help                Show help
EOF
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[start-llm] missing command: $1" >&2
    exit 1
  fi
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
    --llm-timeout-ms)
      LLM_TIMEOUT_MS="${2:?missing value for --llm-timeout-ms}"
      shift 2
      ;;
    --llm-max-tokens)
      LLM_MAX_TOKENS="${2:?missing value for --llm-max-tokens}"
      shift 2
      ;;
    --run-baseline)
      RUN_BASELINE=1
      shift
      ;;
    --force-kill-port)
      FORCE_KILL_PORT=1
      shift
      ;;
    --foreground)
      FOREGROUND=1
      shift
      ;;
    --log-file)
      LOG_FILE="${2:?missing value for --log-file}"
      shift 2
      ;;
    --pid-file)
      PID_FILE="${2:?missing value for --pid-file}"
      shift 2
      ;;
    --workspace)
      WORKER_BASE_WORKSPACE="${2:?missing value for --workspace}"
      shift 2
      ;;
    --data-root)
      WORKER_BASE_DATA_ROOT="${2:?missing value for --data-root}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[start-llm] unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

need_cmd bun
need_cmd curl
need_cmd lsof

if [ "$RUN_BASELINE" -eq 1 ]; then
  bash "$SCRIPT_DIR/check_runtime_baseline.sh"
fi

if ! curl -fsS "$LLM_BASE_URL/api/tags" >/dev/null 2>&1; then
  echo "[start-llm] llm endpoint unavailable: $LLM_BASE_URL/api/tags" >&2
  exit 1
fi

if lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  if [ "$FORCE_KILL_PORT" -eq 1 ]; then
    lsof -tiTCP:"$PORT" -sTCP:LISTEN | xargs -r kill
    sleep 1
  else
    echo "[start-llm] port $PORT is already in use. use --force-kill-port to replace it." >&2
    exit 1
  fi
fi

if [ -z "$LOG_FILE" ]; then
  LOG_FILE="/tmp/dongyu-ui-server-llm-${PORT}.log"
fi
if [ -z "$PID_FILE" ]; then
  PID_FILE="/tmp/dongyu-ui-server-llm-${PORT}.pid"
fi

COMMON_ENV=(
  "PORT=$PORT"
  "DY_AUTH=0"
  "DY_LLM_ENABLED=1"
  "DY_LLM_BASE_URL=$LLM_BASE_URL"
  "DY_LLM_MODEL=$LLM_MODEL"
  "DY_LLM_TIMEOUT_MS=$LLM_TIMEOUT_MS"
  "DY_LLM_MAX_TOKENS=$LLM_MAX_TOKENS"
  "NO_PROXY=*"
  "no_proxy=*"
)

if [ -n "$WORKER_BASE_WORKSPACE" ]; then
  COMMON_ENV+=("WORKER_BASE_WORKSPACE=$WORKER_BASE_WORKSPACE")
fi
if [ -n "$WORKER_BASE_DATA_ROOT" ]; then
  COMMON_ENV+=("WORKER_BASE_DATA_ROOT=$WORKER_BASE_DATA_ROOT")
fi

echo "[start-llm] port=$PORT llm_base_url=$LLM_BASE_URL llm_model=$LLM_MODEL llm_timeout_ms=$LLM_TIMEOUT_MS llm_max_tokens=$LLM_MAX_TOKENS"

cd "$ROOT_DIR"
if [ "$FOREGROUND" -eq 1 ]; then
  exec env "${COMMON_ENV[@]}" bun packages/ui-model-demo-server/server.mjs --port "$PORT"
fi

nohup env "${COMMON_ENV[@]}" bun packages/ui-model-demo-server/server.mjs --port "$PORT" >"$LOG_FILE" 2>&1 < /dev/null &
PID="$!"
echo "$PID" > "$PID_FILE"

READY=0
for _ in $(seq 1 60); do
  if ! kill -0 "$PID" >/dev/null 2>&1; then
    echo "[start-llm] server exited early, see log: $LOG_FILE" >&2
    tail -n 80 "$LOG_FILE" >&2 || true
    exit 1
  fi
  if curl -fsS "http://127.0.0.1:$PORT/snapshot" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.5
done

if [ "$READY" -ne 1 ]; then
  echo "[start-llm] timeout waiting for server readiness, see log: $LOG_FILE" >&2
  tail -n 120 "$LOG_FILE" >&2 || true
  exit 1
fi

echo "[start-llm] started pid=$PID"
echo "[start-llm] pid_file=$PID_FILE"
echo "[start-llm] log_file=$LOG_FILE"
echo "[start-llm] url=http://127.0.0.1:$PORT"
