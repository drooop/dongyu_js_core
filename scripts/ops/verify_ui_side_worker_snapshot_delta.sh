#!/usr/bin/env bash
set -euo pipefail

K8S_NS="dongyu"
UI_SIDE_LOCAL_PORT=19101
SYNAPSE_LOCAL_PORT=18008
TIMEOUT_SEC=25
POLL_INTERVAL_SEC=1

usage() {
  cat <<'EOF'
Usage:
  scripts/ops/verify_ui_side_worker_snapshot_delta.sh [options]

Options:
  --namespace <ns>          Kubernetes namespace (default: dongyu)
  --ui-port <port>          Local port for ui-side-worker port-forward (default: 19101)
  --synapse-port <port>     Local port for synapse port-forward (default: 18008)
  --timeout-sec <n>         Poll timeout in seconds (default: 25)
  --poll-interval-sec <n>   Poll interval in seconds (default: 1)
  -h, --help                Show help
EOF
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[verify-ui-side] missing command: $1" >&2
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
    --namespace)
      K8S_NS="${2:?missing value for --namespace}"
      shift 2
      ;;
    --ui-port)
      UI_SIDE_LOCAL_PORT="${2:?missing value for --ui-port}"
      shift 2
      ;;
    --synapse-port)
      SYNAPSE_LOCAL_PORT="${2:?missing value for --synapse-port}"
      shift 2
      ;;
    --timeout-sec)
      TIMEOUT_SEC="${2:?missing value for --timeout-sec}"
      shift 2
      ;;
    --poll-interval-sec)
      POLL_INTERVAL_SEC="${2:?missing value for --poll-interval-sec}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[verify-ui-side] unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

need_cmd kubectl
need_cmd curl
need_cmd jq
need_cmd python3
need_cmd base64

cleanup() {
  if [ -n "${UI_SIDE_PF_PID:-}" ] && kill -0 "$UI_SIDE_PF_PID" >/dev/null 2>&1; then
    kill "$UI_SIDE_PF_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "${SYNAPSE_PF_PID:-}" ] && kill -0 "$SYNAPSE_PF_PID" >/dev/null 2>&1; then
    kill "$SYNAPSE_PF_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

PATCH_B64="$(kubectl get secret -n "$K8S_NS" ui-server-secret -o jsonpath='{.data.MODELTABLE_PATCH_JSON}' 2>/dev/null || true)"
if [ -z "$PATCH_B64" ]; then
  echo "[verify-ui-side] missing ui-server-secret.MODELTABLE_PATCH_JSON" >&2
  exit 1
fi
PATCH_JSON="$(printf '%s' "$PATCH_B64" | decode_b64)"

MBR_PATCH_B64="$(kubectl get secret -n "$K8S_NS" mbr-worker-secret -o jsonpath='{.data.MODELTABLE_PATCH_JSON}' 2>/dev/null || true)"
if [ -z "$MBR_PATCH_B64" ]; then
  echo "[verify-ui-side] missing mbr-worker-secret.MODELTABLE_PATCH_JSON" >&2
  exit 1
fi
MBR_PATCH_JSON="$(printf '%s' "$MBR_PATCH_B64" | decode_b64)"

BOOTSTRAP_ENV="$(
  PATCH_JSON="$PATCH_JSON" \
  MBR_PATCH_JSON="$MBR_PATCH_JSON" \
  python3 - <<'PY'
import json
import os
import shlex

ui_patch = json.loads(os.environ['PATCH_JSON'])
mbr_patch = json.loads(os.environ['MBR_PATCH_JSON'])

def get_value(patch, key):
    for record in patch.get('records', []):
        if not isinstance(record, dict):
            continue
        if record.get('op') != 'add_label':
            continue
        if record.get('model_id') != 0 or record.get('p') != 0 or record.get('r') != 0 or record.get('c') != 0:
            continue
        if record.get('k') == key:
            return record.get('v')
    return None

room_id = get_value(ui_patch, 'matrix_room_id') or ''
homeserver = get_value(ui_patch, 'matrix_server') or ''
token = get_value(mbr_patch, 'matrix_token') or ''
for name, value in [('ROOM_ID', room_id), ('HOMESERVER', homeserver), ('MBR_TOKEN', token)]:
    if not isinstance(value, str) or not value.strip():
        raise SystemExit(f'missing_{name.lower()}')
    print(f'{name}={shlex.quote(value.strip())}')
PY
)"
eval "$BOOTSTRAP_ENV"

kubectl -n "$K8S_NS" port-forward svc/ui-side-worker "${UI_SIDE_LOCAL_PORT}:9101" >/tmp/ui-side-worker-port-forward.log 2>&1 &
UI_SIDE_PF_PID=$!
kubectl -n "$K8S_NS" port-forward svc/synapse "${SYNAPSE_LOCAL_PORT}:8008" >/tmp/synapse-port-forward.log 2>&1 &
SYNAPSE_PF_PID=$!

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${UI_SIDE_LOCAL_PORT}/value" >/dev/null 2>&1 && curl -fsS "http://127.0.0.1:${SYNAPSE_LOCAL_PORT}/_matrix/client/versions" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

INITIAL="$(curl -fsS "http://127.0.0.1:${UI_SIDE_LOCAL_PORT}/value")"
echo "[verify-ui-side] initial=$INITIAL"

TXN_ID="ui_side_$(date +%s)"
PATCH_ID="ui_side_patch_$(date +%s)"
EVENT_JSON="$(cat <<EOF
{"version":"v0","type":"snapshot_delta","op_id":"$TXN_ID","payload":{"version":"mt.v0","op_id":"$PATCH_ID","records":[{"op":"add_label","model_id":1,"p":0,"r":0,"c":0,"k":"slide_demo_text","t":"str","v":"ACK:hello"}]}}
EOF
)"

RESP="$(curl -fsS -X PUT "http://127.0.0.1:${SYNAPSE_LOCAL_PORT}/_matrix/client/v3/rooms/${ROOM_ID}/send/dy.bus.v0/${TXN_ID}" \
  -H "Authorization: Bearer ${MBR_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "$EVENT_JSON")"
echo "[verify-ui-side] send_response=$RESP"

PASS=0
for i in $(seq 1 "$TIMEOUT_SEC"); do
  STATE="$(curl -fsS "http://127.0.0.1:${UI_SIDE_LOCAL_PORT}/value")"
  echo "[verify-ui-side] poll#$i state=$STATE"
  VALUE="$(printf '%s' "$STATE" | jq -r '.slide_demo_text // ""')"
  if [ "$VALUE" = "ACK:hello" ]; then
    PASS=1
    break
  fi
  sleep "$POLL_INTERVAL_SEC"
done

if [ "$PASS" -ne 1 ]; then
  echo "[verify-ui-side] FAIL: slide_demo_text did not converge within ${TIMEOUT_SEC}s" >&2
  exit 2
fi

echo "[verify-ui-side] PASS"
