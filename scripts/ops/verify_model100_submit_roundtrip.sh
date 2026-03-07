#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://127.0.0.1:9011"
TIMEOUT_SEC=35
READY_TIMEOUT_SEC=40
POLL_INTERVAL_SEC=1

usage() {
  cat <<'EOF'
Usage:
  scripts/ops/verify_model100_submit_roundtrip.sh [options]

Options:
  --base-url <url>          Server base URL (default: http://127.0.0.1:9011)
  --timeout-sec <n>         Poll timeout in seconds (default: 35)
  --ready-timeout-sec <n>   Wait timeout for system_ready=true (default: 40)
  --poll-interval-sec <n>   Poll interval seconds (default: 1)
  -h, --help                Show help
EOF
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[verify] missing command: $1" >&2
    exit 1
  fi
}

snapshot_state() {
  curl -fsS "$BASE_URL/snapshot" | jq -c '{
    bg: .snapshot.models["100"].cells["0,0,0"].labels.bg_color.v,
    status: .snapshot.models["100"].cells["0,0,0"].labels.status.v,
    inflight: .snapshot.models["100"].cells["0,0,0"].labels.submit_inflight.v,
    ready: .snapshot.models["100"].cells["0,0,0"].labels.system_ready.v,
    err: .snapshot.models["-1"].cells["0,0,1"].labels.ui_event_error.v,
    last: .snapshot.models["-1"].cells["0,0,1"].labels.ui_event_last_op_id.v
  }'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:?missing value for --base-url}"
      shift 2
      ;;
    --timeout-sec)
      TIMEOUT_SEC="${2:?missing value for --timeout-sec}"
      shift 2
      ;;
    --ready-timeout-sec)
      READY_TIMEOUT_SEC="${2:?missing value for --ready-timeout-sec}"
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
      echo "[verify] unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

need_cmd curl
need_cmd jq
need_cmd date

echo "[verify] base_url=$BASE_URL"

# Wait until server is reachable.
for _ in $(seq 1 30); do
  if curl -fsS "$BASE_URL/snapshot" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
curl -fsS "$BASE_URL/snapshot" >/dev/null

ACTIVATE_RESP="$(curl -fsS -X POST "$BASE_URL/api/runtime/mode" -H 'content-type: application/json' -d '{"mode":"running"}')"
echo "[verify] runtime_mode_response=$ACTIVATE_RESP"

# Wait for MBR ready signal.
READY_OK=0
for i in $(seq 1 "$READY_TIMEOUT_SEC"); do
  STATE="$(snapshot_state)"
  READY="$(echo "$STATE" | jq -r '.ready')"
  echo "[verify] ready_poll#$i state=$STATE"
  if [ "$READY" = "true" ]; then
    READY_OK=1
    break
  fi
  sleep 1
done
if [ "$READY_OK" -ne 1 ]; then
  echo "[verify] FAIL: system_ready did not become true within ${READY_TIMEOUT_SEC}s" >&2
  exit 2
fi

INITIAL_STATE="$(snapshot_state)"
echo "[verify] initial_state=$INITIAL_STATE"
INITIAL_BG="$(echo "$INITIAL_STATE" | jq -r '.bg')"
INITIAL_INFLIGHT="$(echo "$INITIAL_STATE" | jq -r '.inflight')"
INITIAL_STATUS="$(echo "$INITIAL_STATE" | jq -r '.status')"

# 0177 removed the direct patch reset bypass. A stale loading state now means
# the runtime was not cleanly reset between runs and should be re-deployed.
if [ "$INITIAL_INFLIGHT" = "true" ] || [ "$INITIAL_STATUS" = "loading" ]; then
  echo "[verify] FAIL: stale loading state requires a clean redeploy under 0177 (no direct patch reset bypass)" >&2
  exit 2
fi

OP_ID="verify_model100_$(date +%s)"
REQUEST="$(cat <<EOF
{"payload":{"action":"submit","source":"ui_renderer","meta":{"op_id":"$OP_ID","model_id":100},"value":{"t":"event","v":{"action":"submit","input_value":"","meta":{"op_id":"$OP_ID","model_id":100}}}}}
EOF
)"

SUBMIT_RESP="$(curl -fsS -X POST "$BASE_URL/ui_event" -H 'content-type: application/json' -d "$REQUEST")"
echo "[verify] submit_response=$SUBMIT_RESP"

SUBMIT_RESULT="$(echo "$SUBMIT_RESP" | jq -r '.result // ""')"
if [ "$SUBMIT_RESULT" != "ok" ]; then
  echo "[verify] FAIL: submit did not return result=ok" >&2
  exit 2
fi

PASS=0
for i in $(seq 1 "$TIMEOUT_SEC"); do
  STATE="$(snapshot_state)"
  INFLIGHT="$(echo "$STATE" | jq -r '.inflight')"
  STATUS="$(echo "$STATE" | jq -r '.status')"
  BG="$(echo "$STATE" | jq -r '.bg')"
  LAST_OP="$(echo "$STATE" | jq -r '.last // ""')"
  ERR_NULL="$(echo "$STATE" | jq -r '.err == null')"
  echo "[verify] poll#$i state=$STATE"

  if [ "$INFLIGHT" = "false" ] \
    && [ "$STATUS" != "loading" ] \
    && [ "$ERR_NULL" = "true" ] \
    && { [ "$BG" != "$INITIAL_BG" ] || [ "$LAST_OP" = "$OP_ID" ]; }; then
    PASS=1
    break
  fi
  sleep "$POLL_INTERVAL_SEC"
done

if [ "$PASS" -ne 1 ]; then
  echo "[verify] FAIL: submit roundtrip did not converge in ${TIMEOUT_SEC}s" >&2
  exit 2
fi

FINAL_STATE="$(snapshot_state)"
echo "[verify] PASS final_state=$FINAL_STATE"
