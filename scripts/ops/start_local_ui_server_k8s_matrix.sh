#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

PORT=9011
K8S_NS="${K8S_NS:-dongyu}"
K8S_CONTEXT="${K8S_CONTEXT:-}"
RUN_BASELINE=1
FORCE_KILL_PORT=0
FOREGROUND=0
LOG_FILE=""
PID_FILE=""
WORKER_BASE_WORKSPACE="${WORKER_BASE_WORKSPACE:-ws_local_matrix_e2e}"
WORKER_BASE_DATA_ROOT="${WORKER_BASE_DATA_ROOT:-}"

usage() {
  cat <<'EOF'
Usage:
  scripts/ops/start_local_ui_server_k8s_matrix.sh [options]

Options:
  --port <port>             Server port (default: 9011)
  --namespace <ns>          Kubernetes namespace (default: dongyu)
  --context <name>          Kubernetes context (default: current-context)
  --skip-baseline           Skip scripts/ops/check_runtime_baseline.sh
  --force-kill-port         Kill existing listener on target port before start
  --foreground              Run in foreground (default: background)
  --log-file <path>         Log file path (background mode only)
  --pid-file <path>         PID file path (background mode only)
  --workspace <name>        WORKER_BASE_WORKSPACE value
  --data-root <path>        WORKER_BASE_DATA_ROOT value
  -h, --help                Show help
EOF
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[start] missing command: $1" >&2
    exit 1
  fi
}

decode_b64() {
  if base64 --help 2>&1 | grep -q -- '--decode'; then
    base64 --decode
  else
    base64 -D
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --port)
      PORT="${2:?missing value for --port}"
      shift 2
      ;;
    --namespace)
      K8S_NS="${2:?missing value for --namespace}"
      shift 2
      ;;
    --context)
      K8S_CONTEXT="${2:?missing value for --context}"
      shift 2
      ;;
    --skip-baseline)
      RUN_BASELINE=0
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
      echo "[start] unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

need_cmd kubectl
need_cmd jq
need_cmd bun
need_cmd curl
need_cmd lsof
need_cmd base64

if [ -n "$K8S_CONTEXT" ]; then
  kubectl config use-context "$K8S_CONTEXT" >/dev/null
fi

CURRENT_CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
if [ -z "$CURRENT_CONTEXT" ]; then
  echo "[start] cannot determine kubernetes context" >&2
  exit 1
fi

if [ "$RUN_BASELINE" -eq 1 ]; then
  bash "$SCRIPT_DIR/check_runtime_baseline.sh"
fi

ROOM_ID="$(kubectl get configmap -n "$K8S_NS" mbr-worker-config -o jsonpath='{.data.DY_MATRIX_ROOM_ID}' 2>/dev/null || true)"
HOMESERVER_URL="$(kubectl get configmap -n "$K8S_NS" mbr-worker-config -o jsonpath='{.data.MATRIX_HOMESERVER_URL}' 2>/dev/null || true)"
BOT_USER="$(kubectl get configmap -n "$K8S_NS" mbr-worker-config -o jsonpath='{.data.MATRIX_MBR_BOT_USER}' 2>/dev/null || true)"
TOKEN_B64="$(kubectl get secret -n "$K8S_NS" mbr-worker-secret -o jsonpath='{.data.MATRIX_MBR_BOT_ACCESS_TOKEN}' 2>/dev/null || true)"

if [ -z "$ROOM_ID" ]; then
  echo "[start] missing mbr-worker-config.data.DY_MATRIX_ROOM_ID in namespace=$K8S_NS" >&2
  exit 1
fi
if [ -z "$HOMESERVER_URL" ]; then
  HOMESERVER_URL="http://synapse.${K8S_NS}.svc.cluster.local:8008"
fi
if [ -z "$BOT_USER" ]; then
  BOT_USER="@mbr:localhost"
fi
if [ -z "$TOKEN_B64" ]; then
  echo "[start] missing mbr-worker-secret.data.MATRIX_MBR_BOT_ACCESS_TOKEN in namespace=$K8S_NS" >&2
  exit 1
fi
BOT_TOKEN="$(printf '%s' "$TOKEN_B64" | decode_b64)"

if lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  if [ "$FORCE_KILL_PORT" -eq 1 ]; then
    lsof -tiTCP:"$PORT" -sTCP:LISTEN | xargs -r kill
    sleep 1
  else
    echo "[start] port $PORT is already in use. use --force-kill-port to replace it." >&2
    lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P >&2 || true
    exit 1
  fi
fi

if [ -z "$LOG_FILE" ]; then
  LOG_FILE="/tmp/dongyu-ui-server-${PORT}.log"
fi
if [ -z "$PID_FILE" ]; then
  PID_FILE="/tmp/dongyu-ui-server-${PORT}.pid"
fi

COMMON_ENV=(
  "PORT=$PORT"
  "DY_AUTH=0"
  "DY_MATRIX_ROOM_ID=$ROOM_ID"
  "DY_MATRIX_DM_PEER_USER_ID=$BOT_USER"
  "MATRIX_HOMESERVER_URL=$HOMESERVER_URL"
  "MATRIX_MBR_BOT_USER=$BOT_USER"
  "MATRIX_MBR_BOT_ACCESS_TOKEN=$BOT_TOKEN"
  "NO_PROXY=*"
  "no_proxy=*"
)

if [ -n "$WORKER_BASE_WORKSPACE" ]; then
  COMMON_ENV+=("WORKER_BASE_WORKSPACE=$WORKER_BASE_WORKSPACE")
fi
if [ -n "$WORKER_BASE_DATA_ROOT" ]; then
  COMMON_ENV+=("WORKER_BASE_DATA_ROOT=$WORKER_BASE_DATA_ROOT")
fi

echo "[start] context=$CURRENT_CONTEXT namespace=$K8S_NS port=$PORT"
echo "[start] matrix_room=$ROOM_ID"
echo "[start] matrix_hs=$HOMESERVER_URL"
echo "[start] matrix_bot_user=$BOT_USER"

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
    echo "[start] server exited early, see log: $LOG_FILE" >&2
    tail -n 80 "$LOG_FILE" >&2 || true
    exit 1
  fi
  if grep -q "Matrix init failed" "$LOG_FILE"; then
    echo "[start] Matrix init failed, see log: $LOG_FILE" >&2
    tail -n 80 "$LOG_FILE" >&2 || true
    exit 1
  fi
  if grep -q "Matrix adapter connected" "$LOG_FILE" && lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.5
done

if [ "$READY" -ne 1 ]; then
  echo "[start] timeout waiting for server readiness, see log: $LOG_FILE" >&2
  tail -n 120 "$LOG_FILE" >&2 || true
  exit 1
fi

echo "[start] started pid=$PID"
echo "[start] pid_file=$PID_FILE"
echo "[start] log_file=$LOG_FILE"
echo "[start] url=http://127.0.0.1:$PORT"
