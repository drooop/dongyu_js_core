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

check_room_id_ready() {
  local room_id
  room_id="$(kubectl get configmap mbr-worker-config -n "$K8S_NS" -o jsonpath='{.data.DY_MATRIX_ROOM_ID}' 2>/dev/null || true)"
  if [ -z "$room_id" ] || [ "$room_id" = "$PLACEHOLDER_ROOM" ]; then
    echo "[check] FAIL mbr-worker-config.DY_MATRIX_ROOM_ID is missing or placeholder"
    FAIL=1
    return
  fi
  if ! [[ "$room_id" =~ ^![^[:space:]]+:[^[:space:]]+$ ]]; then
    echo "[check] FAIL mbr-worker-config.DY_MATRIX_ROOM_ID=$room_id is not a valid Matrix room id"
    FAIL=1
    return
  fi
  echo "[check] PASS mbr-worker-config.DY_MATRIX_ROOM_ID=$room_id"
}

check_secret_token_ready() {
  local secret_name="$1"
  local key="$2"
  local label="$3"
  local raw decoded
  raw="$(kubectl get secret "$secret_name" -n "$K8S_NS" -o jsonpath="{.data.${key}}" 2>/dev/null || true)"
  if [ -z "$raw" ]; then
    echo "[check] FAIL $label missing"
    FAIL=1
    return
  fi
  decoded="$(printf '%s' "$raw" | decode_b64)"
  if [ -z "$decoded" ] || [ "$decoded" = "$PLACEHOLDER_TOKEN" ]; then
    echo "[check] FAIL $label is empty or placeholder"
    FAIL=1
    return
  fi
  echo "[check] PASS $label present"
}

echo "[check] kubernetes context: $(kubectl config current-context 2>/dev/null || echo unknown)"

for deploy in mosquitto synapse remote-worker mbr-worker ui-server; do
  check_deploy_ready "$deploy"
done

check_room_id_ready
check_secret_token_ready "mbr-worker-secret" "MATRIX_MBR_BOT_ACCESS_TOKEN" "mbr-worker-secret.MATRIX_MBR_BOT_ACCESS_TOKEN"
check_secret_token_ready "ui-server-secret" "MATRIX_MBR_ACCESS_TOKEN" "ui-server-secret.MATRIX_MBR_ACCESS_TOKEN"

if [ "$FAIL" -ne 0 ]; then
  echo "[check] baseline NOT ready"
  exit 1
fi

echo "[check] baseline ready"
