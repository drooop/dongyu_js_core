#!/usr/bin/env bash
set -euo pipefail

K8S_NS="dongyu"
FAIL=0
PLACEHOLDER_TOKEN="placeholder-will-update-after-synapse-setup"
PLACEHOLDER_ROOM="placeholder-roomid-update-after-synapse-setup"

decode_b64() {
  if base64 --help 2>&1 | grep -q -- '--decode'; then
    base64 --decode
  else
    base64 -D
  fi
}

check_deploy_ready() {
  local name="$1"
  local ready
  ready="$(kubectl get deploy "$name" -n "$K8S_NS" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  if [ "$ready" != "1" ]; then
    echo "[check] FAIL deploy/$name readyReplicas=$ready (expect 1)"
    FAIL=1
  else
    echo "[check] PASS deploy/$name readyReplicas=1"
  fi
}

check_no_terminating_pods() {
  local name="$1"
  local stuck
  stuck="$(kubectl get pods -n "$K8S_NS" -l "app=$name" --no-headers 2>/dev/null \
    | awk '$3 == "Terminating" {print $1}')"
  if [ -n "$stuck" ]; then
    echo "[check] FAIL deploy/$name has terminating pods: $stuck"
    FAIL=1
  else
    echo "[check] PASS deploy/$name no terminating pods"
  fi
}

check_secret_patch_ready() {
  local secret_name="$1"
  local label="$2"
  local raw decoded
  raw="$(kubectl get secret "$secret_name" -n "$K8S_NS" -o jsonpath="{.data.MODELTABLE_PATCH_JSON}" 2>/dev/null || true)"
  if [ -z "$raw" ]; then
    echo "[check] FAIL $label missing"
    FAIL=1
    return
  fi
  decoded="$(printf '%s' "$raw" | decode_b64)"
  if [ -z "$decoded" ]; then
    echo "[check] FAIL $label is empty"
    FAIL=1
    return
  fi
  if ! PATCH_JSON="$decoded" PLACEHOLDER_ROOM="$PLACEHOLDER_ROOM" PLACEHOLDER_TOKEN="$PLACEHOLDER_TOKEN" python3 - <<'PY'
import json
import os
import re
import sys

raw = os.environ['PATCH_JSON']
placeholder_room = os.environ['PLACEHOLDER_ROOM']
placeholder_token = os.environ['PLACEHOLDER_TOKEN']
patch = json.loads(raw)
records = patch.get('records') if isinstance(patch, dict) else None
if not isinstance(records, list):
    raise SystemExit('records_missing')
room_id = None
token = None
for record in records:
    if not isinstance(record, dict):
        continue
    if record.get('op') != 'add_label':
        continue
    if record.get('model_id') != 0 or record.get('p') != 0 or record.get('r') != 0 or record.get('c') != 0:
        continue
    if record.get('k') == 'matrix_room_id':
        room_id = record.get('v')
    if record.get('k') == 'matrix_token' and record.get('t') == 'matrix.token':
        token = record.get('v')

room_text = room_id.strip() if isinstance(room_id, str) else ''
token_text = token.strip() if isinstance(token, str) else ''
if not room_text or room_text == placeholder_room:
    raise SystemExit('matrix_room_id_missing_or_placeholder')
if not re.match(r'^![^\s]+:[^\s]+$', room_text):
    raise SystemExit(f'invalid_room_id:{room_text}')
if not token_text or token_text == placeholder_token:
    raise SystemExit('matrix_token_missing_or_placeholder')
print(room_text)
PY
  then
    echo "[check] FAIL $label invalid"
    FAIL=1
    return
  fi
  echo "[check] PASS $label ready"
}

echo "[check] kubernetes context: $(kubectl config current-context 2>/dev/null || echo unknown)"

for deploy in mosquitto synapse remote-worker mbr-worker ui-server ui-side-worker; do
  check_deploy_ready "$deploy"
done

for deploy in remote-worker mbr-worker ui-server ui-side-worker; do
  check_no_terminating_pods "$deploy"
done

check_secret_patch_ready "mbr-worker-secret" "mbr-worker-secret.MODELTABLE_PATCH_JSON"
check_secret_patch_ready "ui-server-secret" "ui-server-secret.MODELTABLE_PATCH_JSON"

if [ "$FAIL" -ne 0 ]; then
  echo "[check] baseline NOT ready"
  exit 1
fi

echo "[check] baseline ready"
