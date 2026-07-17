#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://127.0.0.1:9011"
TIMEOUT_SEC=35
MODEL_TIMEOUT_SEC=40
POLL_INTERVAL_SEC=1
HTTP_CONNECT_TIMEOUT_SEC=2
HTTP_OPERATION_TIMEOUT_SEC=5

usage() {
  cat <<'EOF'
Usage:
  scripts/ops/verify_model100_submit_roundtrip.sh [options]

Options:
  --base-url <url>          Server base URL (default: http://127.0.0.1:9011)
  --timeout-sec <n>         Poll timeout in seconds (default: 35)
  --model-timeout-sec <n>   Wait timeout for Model 100 state (default: 40)
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

remaining_seconds() {
  local deadline="$1"
  echo "$((deadline - $(date +%s)))"
}

http_timeout_for() {
  local remaining="$1"
  if [ "$remaining" -lt "$HTTP_OPERATION_TIMEOUT_SEC" ]; then
    echo "$remaining"
  else
    echo "$HTTP_OPERATION_TIMEOUT_SEC"
  fi
}

sleep_within_deadline() {
  local remaining="$1"
  local duration
  duration="$(awk -v interval="$POLL_INTERVAL_SEC" -v remaining="$remaining" 'BEGIN { print (interval < remaining ? interval : remaining) }')"
  sleep "$duration"
}

http_get() {
  local max_time="$1"
  local url="$2"
  curl --connect-timeout "$HTTP_CONNECT_TIMEOUT_SEC" --max-time "$max_time" -fsS "$url"
}

http_post_json() {
  local max_time="$1"
  local url="$2"
  local body="$3"
  curl --connect-timeout "$HTTP_CONNECT_TIMEOUT_SEC" --max-time "$max_time" -fsS \
    -X POST "$url" -H 'content-type: application/json' -d "$body"
}

snapshot_state() {
  local max_time="$1"
  http_get "$max_time" "$BASE_URL/snapshot?profile=full" | jq -c '{
    model_present: (.snapshot.models["100"] != null),
    bg: .snapshot.models["100"].cells["0,0,0"].labels.bg_color.v,
    status: .snapshot.models["100"].cells["0,0,0"].labels.status.v,
    inflight: .snapshot.models["100"].cells["0,0,0"].labels.submit_inflight.v,
    err_present: ((.snapshot.models["-1"].cells["0,0,1"].labels // {}) | has("bus_event_error")),
    err: .snapshot.models["-1"].cells["0,0,1"].labels.bus_event_error.v,
    last: .snapshot.models["-1"].cells["0,0,1"].labels.bus_event_last_op_id.v
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
    --model-timeout-sec)
      MODEL_TIMEOUT_SEC="${2:?missing value for --model-timeout-sec}"
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
need_cmd awk

if ! [[ "$TIMEOUT_SEC" =~ ^[1-9][0-9]*$ ]]; then
  echo "[verify] invalid positive integer for --timeout-sec: $TIMEOUT_SEC" >&2
  exit 2
fi
if ! [[ "$MODEL_TIMEOUT_SEC" =~ ^[1-9][0-9]*$ ]]; then
  echo "[verify] invalid positive integer for --model-timeout-sec: $MODEL_TIMEOUT_SEC" >&2
  exit 2
fi
if ! awk -v value="$POLL_INTERVAL_SEC" 'BEGIN { exit !(value ~ /^[0-9]+([.][0-9]+)?$/ && (value + 0) > 0) }'; then
  echo "[verify] invalid positive number for --poll-interval-sec: $POLL_INTERVAL_SEC" >&2
  exit 2
fi

echo "[verify] base_url=$BASE_URL"

# Reachability, runtime activation, and Model 100 discovery share one real
# wall-clock deadline.
MODEL_DEADLINE="$(($(date +%s) + MODEL_TIMEOUT_SEC))"
SERVER_REACHABLE=0
REACHABILITY_POLL=0
while true; do
  REMAINING="$(remaining_seconds "$MODEL_DEADLINE")"
  if [ "$REMAINING" -le 0 ]; then
    break
  fi
  REACHABILITY_POLL="$((REACHABILITY_POLL + 1))"
  HTTP_TIMEOUT="$(http_timeout_for "$REMAINING")"
  if http_get "$HTTP_TIMEOUT" "$BASE_URL/snapshot?profile=full" >/dev/null 2>&1; then
    SERVER_REACHABLE=1
    break
  fi
  REMAINING="$(remaining_seconds "$MODEL_DEADLINE")"
  if [ "$REMAINING" -gt 0 ]; then sleep_within_deadline "$REMAINING"; fi
done
if [ "$SERVER_REACHABLE" -ne 1 ]; then
  echo "[verify] FAIL: server did not become reachable within ${MODEL_TIMEOUT_SEC}s" >&2
  exit 2
fi

REMAINING="$(remaining_seconds "$MODEL_DEADLINE")"
if [ "$REMAINING" -le 0 ]; then
  echo "[verify] FAIL: Model 100 state did not become available within ${MODEL_TIMEOUT_SEC}s" >&2
  exit 2
fi
HTTP_TIMEOUT="$(http_timeout_for "$REMAINING")"
if ! ACTIVATE_RESP="$(http_post_json "$HTTP_TIMEOUT" "$BASE_URL/api/runtime/mode" '{"mode":"running"}')"; then
  echo "[verify] FAIL: runtime activation failed within ${MODEL_TIMEOUT_SEC}s" >&2
  exit 2
fi
echo "[verify] runtime_mode_response=$ACTIVATE_RESP"

# Wait for the current Model 100 projection. Removed top-level compatibility
# events are not readiness sources.
MODEL_OK=0
MODEL_POLL=0
while true; do
  REMAINING="$(remaining_seconds "$MODEL_DEADLINE")"
  if [ "$REMAINING" -le 0 ]; then break; fi
  MODEL_POLL="$((MODEL_POLL + 1))"
  HTTP_TIMEOUT="$(http_timeout_for "$REMAINING")"
  if STATE="$(snapshot_state "$HTTP_TIMEOUT" 2>/dev/null)"; then
    MODEL_PRESENT="$(echo "$STATE" | jq -r '.model_present')"
    STATUS_PRESENT="$(echo "$STATE" | jq -r '.status != null')"
    INFLIGHT_BOOLEAN="$(echo "$STATE" | jq -r '.inflight | type == "boolean"')"
    echo "[verify] model_poll#$MODEL_POLL state=$STATE"
    if [ "$MODEL_PRESENT" = "true" ] && [ "$STATUS_PRESENT" = "true" ] && [ "$INFLIGHT_BOOLEAN" = "true" ]; then
      MODEL_OK=1
      break
    fi
  fi
  REMAINING="$(remaining_seconds "$MODEL_DEADLINE")"
  if [ "$REMAINING" -gt 0 ]; then sleep_within_deadline "$REMAINING"; fi
done
if [ "$MODEL_OK" -ne 1 ]; then
  echo "[verify] FAIL: Model 100 state did not become available within ${MODEL_TIMEOUT_SEC}s" >&2
  exit 2
fi

INITIAL_STATE="$STATE"
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

OP_ID="verify_model100_$(date +%s)_$$_${RANDOM}"
CLIENT_DISPATCH_TS="$(($(date +%s) * 1000))"
REQUEST="$(cat <<EOF
{"type":"bus_event_v2","bus_in_key":"bus_event_submit_100_0_0_0","value":[{"id":0,"p":0,"r":0,"c":0,"k":"__mt_payload_kind","t":"str","v":"ui_event.v1"},{"id":0,"p":0,"r":0,"c":0,"k":"input_value","t":"str","v":""}],"meta":{"op_id":"$OP_ID","source":"ui_renderer","client_dispatch_ts":$CLIENT_DISPATCH_TS,"client_dispatch_perf_ms":0}}
EOF
)"

if ! SUBMIT_RESP="$(http_post_json "$HTTP_OPERATION_TIMEOUT_SEC" "$BASE_URL/bus_event" "$REQUEST")"; then
  echo "[verify] FAIL: submit request failed within ${HTTP_OPERATION_TIMEOUT_SEC}s" >&2
  exit 2
fi
echo "[verify] submit_response=$SUBMIT_RESP"

SUBMIT_OK="$(echo "$SUBMIT_RESP" | jq -r '.ok == true')"
SUBMIT_RESULT="$(echo "$SUBMIT_RESP" | jq -r '.result // ""')"
SUBMIT_ROUTE="$(echo "$SUBMIT_RESP" | jq -r '.routed_by // ""')"
SUBMIT_LAST_OP="$(echo "$SUBMIT_RESP" | jq -r '.bus_event_last_op_id // ""')"
SUBMIT_ERR_NULL="$(echo "$SUBMIT_RESP" | jq -r 'has("bus_event_error") and .bus_event_error == null')"
if [ "$SUBMIT_OK" != "true" ] \
  || [ "$SUBMIT_RESULT" != "ok" ] \
  || [ "$SUBMIT_ROUTE" != "model0_busin" ] \
  || [ "$SUBMIT_LAST_OP" != "$OP_ID" ] \
  || [ "$SUBMIT_ERR_NULL" != "true" ]; then
  echo "[verify] FAIL: submit did not enter the declared Model 0 bus route" >&2
  exit 2
fi

PASS=0
TIMEOUT_DEADLINE="$(($(date +%s) + TIMEOUT_SEC))"
ROUNDTRIP_POLL=0
while true; do
  REMAINING="$(remaining_seconds "$TIMEOUT_DEADLINE")"
  if [ "$REMAINING" -le 0 ]; then break; fi
  ROUNDTRIP_POLL="$((ROUNDTRIP_POLL + 1))"
  HTTP_TIMEOUT="$(http_timeout_for "$REMAINING")"
  if STATE="$(snapshot_state "$HTTP_TIMEOUT" 2>/dev/null)"; then
    INFLIGHT="$(echo "$STATE" | jq -r '.inflight')"
    STATUS="$(echo "$STATE" | jq -r '.status')"
    BG="$(echo "$STATE" | jq -r '.bg')"
    LAST_OP="$(echo "$STATE" | jq -r '.last // ""')"
    ERR_PRESENT="$(echo "$STATE" | jq -r '.err_present')"
    ERR_NULL="$(echo "$STATE" | jq -r '.err == null')"
    echo "[verify] poll#$ROUNDTRIP_POLL state=$STATE"

    if [ "$INFLIGHT" = "false" ] \
      && [ "$STATUS" = "processed" ] \
      && [ "$ERR_PRESENT" = "true" ] \
      && [ "$ERR_NULL" = "true" ] \
      && [ "$BG" != "$INITIAL_BG" ] \
      && [ "$LAST_OP" = "$OP_ID" ]; then
      PASS=1
      break
    fi
  fi
  REMAINING="$(remaining_seconds "$TIMEOUT_DEADLINE")"
  if [ "$REMAINING" -gt 0 ]; then sleep_within_deadline "$REMAINING"; fi
done

if [ "$PASS" -ne 1 ]; then
  echo "[verify] FAIL: submit roundtrip did not converge in ${TIMEOUT_SEC}s" >&2
  exit 2
fi

FINAL_STATE="$STATE"
echo "[verify] PASS final_state=$FINAL_STATE"
