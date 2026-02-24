#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

PORT=9011
K8S_NS="${K8S_NS:-dongyu}"
K8S_CONTEXT="${K8S_CONTEXT:-}"
STOP_AFTER=0
FORCE_KILL_PORT=1

usage() {
  cat <<'EOF'
Usage:
  scripts/ops/run_model100_submit_roundtrip_local.sh [options]

Options:
  --port <port>        Server port (default: 9011)
  --namespace <ns>     Kubernetes namespace (default: dongyu)
  --context <name>     Kubernetes context (default: current-context)
  --stop-after         Stop local ui-server after verification
  --no-force-kill      Do not kill existing listener on target port
  -h, --help           Show help
EOF
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
    --stop-after)
      STOP_AFTER=1
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
      echo "[run] unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

echo "[run] step1 check baseline"
bash "$SCRIPT_DIR/check_runtime_baseline.sh"

echo "[run] step2 start local ui-server with k8s matrix config"
START_ARGS=(
  --port "$PORT"
  --namespace "$K8S_NS"
  --skip-baseline
)
if [ -n "$K8S_CONTEXT" ]; then
  START_ARGS+=(--context "$K8S_CONTEXT")
fi
if [ "$FORCE_KILL_PORT" -eq 1 ]; then
  START_ARGS+=(--force-kill-port)
fi
bash "$SCRIPT_DIR/start_local_ui_server_k8s_matrix.sh" "${START_ARGS[@]}"

echo "[run] step3 verify Model 100 submit roundtrip"
bash "$SCRIPT_DIR/verify_model100_submit_roundtrip.sh" --base-url "http://127.0.0.1:$PORT"

if [ "$STOP_AFTER" -eq 1 ]; then
  PID_FILE="/tmp/dongyu-ui-server-${PORT}.pid"
  if [ -f "$PID_FILE" ]; then
    PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "${PID:-}" ] && kill -0 "$PID" >/dev/null 2>&1; then
      kill "$PID" >/dev/null 2>&1 || true
      echo "[run] stopped pid=$PID"
    fi
  fi
fi

echo "[run] PASS"
