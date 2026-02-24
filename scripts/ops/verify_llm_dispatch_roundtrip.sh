#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://127.0.0.1:9012"

usage() {
  cat <<'EOF'
Usage:
  scripts/ops/verify_llm_dispatch_roundtrip.sh [options]

Options:
  --base-url <url>          Server base URL (default: http://127.0.0.1:9012)
  -h, --help                Show help
EOF
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[verify-llm] missing command: $1" >&2
    exit 1
  fi
}

post_ui_event() {
  local action="$1"
  local op_id="$2"
  local body
  body="$(jq -nc --arg action "$action" --arg op "$op_id" '{
    payload: {
      action: $action,
      source: "ui_renderer",
      meta: { op_id: $op }
    }
  }')"
  curl -fsS -X POST "$BASE_URL/ui_event" -H 'content-type: application/json' -d "$body"
}

apply_patch_json() {
  local patch_json="$1"
  local body
  body="$(jq -nc --argjson patch "$patch_json" '{ patch: $patch }')"
  curl -fsS -X POST "$BASE_URL/api/modeltable/patch" -H 'content-type: application/json' -d "$body" >/dev/null
}

while [ $# -gt 0 ]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:?missing value for --base-url}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[verify-llm] unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

need_cmd curl
need_cmd jq
need_cmd date

echo "[verify-llm] base_url=$BASE_URL"
curl -fsS "$BASE_URL/snapshot" >/dev/null

# Case 1: deterministic action should stay on rule path
OP1="llm_rule_$(date +%s)_1"
R1="$(post_ui_event "docs_refresh_tree" "$OP1")"
echo "[verify-llm] case1=$R1"
echo "$R1" | jq -e '.ok == true and .result == "ok" and .routed_by == "rule" and (.confidence == 1)' >/dev/null

# Case 2: unknown action should be routed by llm (high confidence)
OP2="llm_route_$(date +%s)_2"
R2="$(post_ui_event "please refresh docs tree now" "$OP2")"
echo "[verify-llm] case2=$R2"
echo "$R2" | jq -e '.ok == true and .result == "ok" and .routed_by == "llm" and (.confidence >= 0 and .confidence < 1)' >/dev/null
S2="$(curl -fsS "$BASE_URL/snapshot")"
echo "$S2" | jq -e '.snapshot.models["-1"].cells["0,0,1"].labels.action_lifecycle.v.llm_used == true' >/dev/null

# Case 3: low confidence should reject and return candidates
OP3="llm_low_$(date +%s)_3"
R3="$(post_ui_event "ambiguous docs operation" "$OP3")"
echo "[verify-llm] case3=$R3"
echo "$R3" | jq -e '.ok == true and .result == "error" and .code == "low_confidence" and (.candidates | length) >= 1' >/dev/null

# Case 4: llm dispatch disabled should degrade to unknown_action
ORIG_CFG="$(curl -fsS "$BASE_URL/snapshot" | jq '.snapshot.models["0"].cells["0,0,0"].labels.llm_dispatch_config.v')"
BAD_CFG="$(echo "$ORIG_CFG" | jq '.provider = "disabled"')"
PATCH_BAD="$(jq -nc --argjson cfg "$BAD_CFG" '{
  version: "mt.v0",
  op_id: "verify_llm_cfg_bad",
  records: [
    { op: "add_label", model_id: 0, p: 0, r: 0, c: 0, k: "llm_dispatch_config", t: "json", v: $cfg }
  ]
}')"
apply_patch_json "$PATCH_BAD"
OP4="llm_down_$(date +%s)_4"
R4="$(post_ui_event "please refresh docs tree now" "$OP4")"
echo "[verify-llm] case4=$R4"
echo "$R4" | jq -e '.ok == true and .result == "error" and .code == "unknown_action"' >/dev/null

# Restore config
PATCH_RESTORE="$(jq -nc --argjson cfg "$ORIG_CFG" '{
  version: "mt.v0",
  op_id: "verify_llm_cfg_restore",
  records: [
    { op: "add_label", model_id: 0, p: 0, r: 0, c: 0, k: "llm_dispatch_config", t: "json", v: $cfg }
  ]
}')"
apply_patch_json "$PATCH_RESTORE"

echo "[verify-llm] PASS"
