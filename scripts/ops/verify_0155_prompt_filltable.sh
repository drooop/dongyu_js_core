#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://127.0.0.1:9013"

usage() {
  cat <<'USAGE'
Usage:
  scripts/ops/verify_0155_prompt_filltable.sh [options]

Options:
  --base-url <url>          Server base URL (default: http://127.0.0.1:9013)
  -h, --help                Show help
USAGE
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[verify-0155] missing command: $1" >&2
    exit 1
  fi
}

post_ui_event() {
  local action="$1"
  local op_id="$2"
  local target_key="$3"
  local body
  body="$(jq -nc --arg action "$action" --arg op "$op_id" --arg key "$target_key" '{
    payload: {
      action: $action,
      source: "ui_renderer",
      meta: { op_id: $op, local_only: true, model_id: -2 },
      target: { model_id: -2, p: 0, r: 0, c: 0, k: $key }
    }
  }')"
  curl -fsS -X POST "$BASE_URL/ui_event" -H 'content-type: application/json' -d "$body"
}

write_local_state() {
  local key="$1"
  local type="$2"
  local json_value="$3"
  local op_id="$4"
  local body
  body="$(jq -nc --arg key "$key" --arg type "$type" --arg op "$op_id" --argjson value "$json_value" '{
    payload: {
      action: "label_update",
      source: "ui_renderer",
      meta: { op_id: $op, local_only: true, model_id: -2 },
      target: { model_id: -2, p: 0, r: 0, c: 0, k: $key },
      value: { t: $type, v: $value }
    }
  }')"
  curl -fsS -X POST "$BASE_URL/ui_event" -H 'content-type: application/json' -d "$body" >/dev/null
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
      echo "[verify-0155] unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

need_cmd curl
need_cmd jq
need_cmd date

echo "[verify-0155] base_url=$BASE_URL"
curl -fsS "$BASE_URL/snapshot" >/dev/null

ACTIVATE_RESP="$(curl -fsS -X POST "$BASE_URL/api/runtime/mode" -H 'content-type: application/json' -d '{"mode":"running"}')"
echo "[verify-0155] runtime_mode_response=$ACTIVATE_RESP"
echo "$ACTIVATE_RESP" | jq -e '.ok == true and .mode == "running"' >/dev/null

write_local_state "llm_prompt_text" "str" '"Set model 100 title to prompt demo, remove obsolete_key, then check model 100 status"' "verify_0155_set_prompt"

OP1="pf_preview_$(date +%s)_1"
R1="$(post_ui_event "llm_filltable_preview" "$OP1" "llm_prompt_text")"
echo "[verify-0155] preview_response=$R1"
echo "$R1" | jq -e '.ok == true and .result == "ok"' >/dev/null

S1="$(curl -fsS "$BASE_URL/snapshot")"
echo "$S1" | jq -e '.snapshot.models["-2"].cells["0,0,0"].labels.llm_prompt_preview_id.v | type == "string" and length > 0' >/dev/null
echo "$S1" | jq -e '.snapshot.models["-2"].cells["0,0,0"].labels.llm_prompt_preview_json.v.accepted_changes | length >= 1' >/dev/null
echo "$S1" | jq -e '.snapshot.models["-2"].cells["0,0,0"].labels.llm_prompt_preview_json.v.proposal.requires_confirmation == true' >/dev/null
echo "$S1" | jq -e '.snapshot.models["-2"].cells["0,0,0"].labels.llm_prompt_preview_json.v.proposal.operations | type == "array" and length >= 1' >/dev/null
echo "$S1" | jq -e '.snapshot.models["-2"].cells["0,0,0"].labels.llm_prompt_preview_json.v.proposal.confirmation_question | type == "string" and length > 0' >/dev/null

OP2="pf_apply_$(date +%s)_2"
R2="$(post_ui_event "llm_filltable_apply" "$OP2" "llm_prompt_apply_preview_id")"
echo "[verify-0155] apply_response=$R2"
echo "$R2" | jq -e '.ok == true and .result == "ok"' >/dev/null

S2="$(curl -fsS "$BASE_URL/snapshot")"
echo "$S2" | jq -e '.snapshot.models["-2"].cells["0,0,0"].labels.llm_prompt_apply_result_json.v.applied_count >= 1' >/dev/null
echo "$S2" | jq -e '.snapshot.models["-2"].cells["0,0,0"].labels.llm_prompt_apply_result_json.v.applied_changes | map(select(.target.model_id == 100)) | length >= 1' >/dev/null

OP3="pf_replay_$(date +%s)_3"
R3="$(post_ui_event "llm_filltable_apply" "$OP3" "llm_prompt_apply_preview_id")"
echo "[verify-0155] replay_response=$R3"
echo "$R3" | jq -e '.ok == true and .result == "error" and .code == "preview_replay"' >/dev/null

write_local_state "llm_prompt_preview_json" "json" '{"accepted_records":[{"action":"set_label","target":{"model_id":100,"p":0,"r":0,"c":0,"k":"title"},"label":{"t":"str","v":"x"}}]}' "verify_0155_legacy_preview_json"
write_local_state "llm_prompt_preview_id" "str" '"pv_legacy_1"' "verify_0155_legacy_preview_id"
write_local_state "llm_prompt_apply_preview_id" "str" '"pv_legacy_1"' "verify_0155_legacy_apply_preview_id"
write_local_state "llm_prompt_last_applied_preview_id" "str" '""' "verify_0155_legacy_last_applied"

OP4="pf_legacy_$(date +%s)_4"
R4="$(post_ui_event "llm_filltable_apply" "$OP4" "llm_prompt_apply_preview_id")"
echo "[verify-0155] legacy_response=$R4"
echo "$R4" | jq -e '.ok == true and .result == "error" and .code == "legacy_preview_contract"' >/dev/null

TOO_MANY_JSON="$(jq -nc 'def mkchange(i): {
  action: "set_label",
  target: { model_id: 100, p: 0, r: 0, c: 0, k: ("bulk_" + ((i + 1) | tostring)) },
  label: { t: "str", v: "x" }
}; { accepted_changes: [range(0;11) | mkchange(.)] }')"
write_local_state "llm_prompt_preview_json" "json" "$TOO_MANY_JSON" "verify_0155_toomany_preview_json"
write_local_state "llm_prompt_preview_id" "str" '"pv_toomany_1"' "verify_0155_toomany_preview_id"
write_local_state "llm_prompt_apply_preview_id" "str" '"pv_toomany_1"' "verify_0155_toomany_apply_preview_id"
write_local_state "llm_prompt_last_applied_preview_id" "str" '""' "verify_0155_toomany_last_applied"

OP5="pf_toomany_$(date +%s)_5"
R5="$(post_ui_event "llm_filltable_apply" "$OP5" "llm_prompt_apply_preview_id")"
echo "[verify-0155] too_many_changes_response=$R5"
echo "$R5" | jq -e '.ok == true and .result == "error" and .code == "too_many_changes"' >/dev/null

echo "[verify-0155] PASS"
