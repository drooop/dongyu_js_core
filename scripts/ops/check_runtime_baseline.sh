#!/usr/bin/env bash
set -euo pipefail

K8S_NS="dongyu"
EXPECTED_CONTEXT="orbstack"
EXPECTED_MATRIX_URL="http://synapse.dongyu.svc.cluster.local:8008"
EXPECTED_SYNAPSE_SERVER_NAME="localhost"
EXPECTED_MQTT_HOST="mosquitto.dongyu.svc.cluster.local"
EXPECTED_MQTT_PORT="1883"
PLACEHOLDER_TOKEN="placeholder-will-update-after-synapse-setup"
PLACEHOLDER_ROOM="placeholder-roomid-update-after-synapse-setup"
FAIL=0

decode_b64() {
  if base64 --help 2>&1 | grep -q -- '--decode'; then
    base64 --decode
  else
    base64 -D
  fi
}

fail_check() {
  echo "[check] FAIL $1"
  FAIL=1
}

pass_check() {
  echo "[check] PASS $1"
}

check_exact_contexts() {
  local kubectl_context docker_context
  kubectl_context="$(kubectl config current-context 2>/dev/null || true)"
  docker_context="$(docker context show 2>/dev/null || true)"
  if [ "$kubectl_context" != "$EXPECTED_CONTEXT" ]; then
    fail_check "kubernetes context must be $EXPECTED_CONTEXT"
  else
    pass_check "kubernetes context=$EXPECTED_CONTEXT"
  fi
  if [ "$docker_context" != "$EXPECTED_CONTEXT" ]; then
    fail_check "docker context must be $EXPECTED_CONTEXT"
  else
    pass_check "docker context=$EXPECTED_CONTEXT"
  fi
}

check_deploy_ready() {
  local name="$1" ready
  ready="$(kubectl get deploy "$name" -n "$K8S_NS" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  if [ "$ready" != "1" ]; then
    fail_check "deploy/$name readyReplicas=$ready (expect 1)"
  else
    pass_check "deploy/$name readyReplicas=1"
  fi
}

check_service_ready() {
  local name="$1" cluster_ip
  cluster_ip="$(kubectl get svc "$name" -n "$K8S_NS" -o jsonpath='{.spec.clusterIP}' 2>/dev/null || true)"
  if [ -z "$cluster_ip" ] || [ "$cluster_ip" = "None" ]; then
    fail_check "svc/$name missing local ClusterIP"
  else
    pass_check "svc/$name local endpoint declared"
  fi
}

check_no_terminating_pods() {
  local name="$1" stuck
  stuck="$(kubectl get pods -n "$K8S_NS" -l "app=$name" --no-headers 2>/dev/null \
    | awk '$3 == "Terminating" {print $1}')"
  if [ -n "$stuck" ]; then
    fail_check "deploy/$name has terminating pods: $stuck"
  else
    pass_check "deploy/$name no terminating pods"
  fi
}

check_synapse_config() {
  local homeserver
  homeserver="$(kubectl get configmap synapse-config -n "$K8S_NS" \
    -o 'jsonpath={.data.homeserver\.yaml}' 2>/dev/null || true)"
  if ! printf '%s\n' "$homeserver" | grep -Eq "^[[:space:]]*server_name:[[:space:]]*(${EXPECTED_SYNAPSE_SERVER_NAME}|\"${EXPECTED_SYNAPSE_SERVER_NAME}\"|'${EXPECTED_SYNAPSE_SERVER_NAME}')[[:space:]]*(#.*)?$"; then
    fail_check "synapse-config must declare SYNAPSE_SERVER_NAME=$EXPECTED_SYNAPSE_SERVER_NAME"
  else
    pass_check "synapse-config server_name=$EXPECTED_SYNAPSE_SERVER_NAME"
  fi
}

check_mqtt_configmap() {
  local name="$1" host port
  host="$(kubectl get configmap "$name" -n "$K8S_NS" -o jsonpath='{.data.MQTT_HOST}' 2>/dev/null || true)"
  port="$(kubectl get configmap "$name" -n "$K8S_NS" -o jsonpath='{.data.MQTT_PORT}' 2>/dev/null || true)"
  if [ "$host" != "$EXPECTED_MQTT_HOST" ] || [ "$port" != "$EXPECTED_MQTT_PORT" ]; then
    fail_check "configmap/$name must use local MQTT"
  else
    pass_check "configmap/$name local MQTT"
  fi
}

check_secret_patch_ready() {
  local secret_name="$1" label="$2" raw decoded
  raw="$(kubectl get secret "$secret_name" -n "$K8S_NS" -o jsonpath='{.data.MODELTABLE_PATCH_JSON}' 2>/dev/null || true)"
  if [ -z "$raw" ]; then
    fail_check "$label missing"
    return
  fi
  decoded="$(printf '%s' "$raw" | decode_b64 2>/dev/null || true)"
  if [ -z "$decoded" ]; then
    fail_check "$label empty or invalid base64"
    return
  fi
  if ! PATCH_JSON="$decoded" \
    EXPECTED_MATRIX_URL="$EXPECTED_MATRIX_URL" \
    EXPECTED_MQTT_HOST="$EXPECTED_MQTT_HOST" \
    EXPECTED_MQTT_PORT="$EXPECTED_MQTT_PORT" \
    EXPECTED_SERVER_NAME="$EXPECTED_SYNAPSE_SERVER_NAME" \
    PLACEHOLDER_ROOM="$PLACEHOLDER_ROOM" \
    PLACEHOLDER_TOKEN="$PLACEHOLDER_TOKEN" \
    python3 - <<'PY'
import json
import os
import re

patch = json.loads(os.environ['PATCH_JSON'])
records = patch.get('records') if isinstance(patch, dict) else None
if not isinstance(records, list):
    raise SystemExit('records_missing')

labels = {}
for record in records:
    if not isinstance(record, dict) or record.get('op') != 'add_label':
        continue
    if (record.get('model_id'), record.get('p'), record.get('r'), record.get('c')) != (0, 0, 0, 0):
        continue
    key = record.get('k')
    if isinstance(key, str):
        labels[key] = record

def value(key):
    record = labels.get(key)
    return record.get('v') if isinstance(record, dict) else None

room = value('matrix_room_id')
token = value('matrix_token')
server_name = os.environ['EXPECTED_SERVER_NAME']
if not isinstance(room, str) or not room.strip() or room == os.environ['PLACEHOLDER_ROOM']:
    raise SystemExit('matrix_room_id_missing_or_placeholder')
if not re.fullmatch(r'![^\s]+:' + re.escape(server_name), room):
    raise SystemExit('matrix_room_id_not_local')
if not isinstance(token, str) or not token.strip() or token == os.environ['PLACEHOLDER_TOKEN']:
    raise SystemExit('matrix_token_missing_or_placeholder')
if value('matrix_server') != os.environ['EXPECTED_MATRIX_URL']:
    raise SystemExit('matrix_server_not_local')
if value('local_ip') != [os.environ['EXPECTED_MQTT_HOST']]:
    raise SystemExit('mqtt_host_not_local')
if value('local_port') != [os.environ['EXPECTED_MQTT_PORT']]:
    raise SystemExit('mqtt_port_not_local')
matrix_user = value('matrix_user')
if not isinstance(matrix_user, str) or not matrix_user.endswith(':' + server_name):
    raise SystemExit('matrix_user_not_local')
matrix_contuser = value('matrix_contuser')
if not isinstance(matrix_contuser, list) or len(matrix_contuser) != 1 \
        or not isinstance(matrix_contuser[0], str) or not matrix_contuser[0].endswith(':' + server_name):
    raise SystemExit('matrix_contuser_not_local')
PY
  then
    fail_check "$label invalid local bootstrap"
    return
  fi
  pass_check "$label local bootstrap ready"
}

check_ui_auth_secret() {
  local raw
  raw="$(kubectl get secret ui-server-secret -n "$K8S_NS" -o json 2>/dev/null || true)"
  if [ -z "$raw" ]; then
    fail_check "ui-server-secret missing"
    return
  fi
  if ! SECRET_JSON="$raw" EXPECTED_MATRIX_URL="$EXPECTED_MATRIX_URL" python3 - <<'PY'
import base64
import json
import os

secret = json.loads(os.environ['SECRET_JSON'])
data = secret.get('data') if isinstance(secret, dict) else None
if not isinstance(data, dict):
    raise SystemExit('secret_data_missing')

def literal(key):
    if key not in data or not isinstance(data[key], str):
        raise SystemExit('missing_secret_key:' + key)
    try:
        return base64.b64decode(data[key], validate=True).decode('utf-8')
    except Exception as exc:
        raise SystemExit('invalid_secret_key:' + key) from exc

if literal('DY_AUTH') != '0':
    raise SystemExit('DY_AUTH_must_be_0')
if literal('DY_DEV_FAKE_LOGIN') != '0':
    raise SystemExit('DY_DEV_FAKE_LOGIN_must_be_0')
for key in (
    'DY_OIDC_ISSUER',
    'DY_OIDC_CLIENT_ID',
    'DY_OIDC_CLIENT_SECRET',
    'DY_OIDC_REDIRECT_URI',
    'DY_OIDC_SCOPE',
    'DY_OIDC_PROXY_URL',
    'DY_OIDC_STATE_SECRET',
):
    if literal(key) != '':
        raise SystemExit(key + '_must_be_empty')
if literal('MATRIX_HOMESERVER_URL') != os.environ['EXPECTED_MATRIX_URL']:
    raise SystemExit('MATRIX_HOMESERVER_URL_not_local')
PY
  then
    fail_check "ui-server-secret local auth/transport invalid"
    return
  fi
  pass_check "ui-server-secret DY_AUTH=0 and no remote OIDC"
}

check_actor_asset() {
  local deployment="$1" scope="$2" role_path="$3" worker_id="$4" worker_role="$5" worker_alias="$6" expected_pins="$7"
  local manifest patch
  manifest="$(kubectl exec "deployment/$deployment" -n "$K8S_NS" -- \
    cat /app/persisted-assets/manifest.v0.json 2>/dev/null || true)"
  patch="$(kubectl exec "deployment/$deployment" -n "$K8S_NS" -- \
    cat "/app/persisted-assets/$role_path" 2>/dev/null || true)"
  if [ -z "$manifest" ] || [ -z "$patch" ]; then
    fail_check "deploy/$deployment actor assets missing"
    return
  fi
  if ! ACTOR_MANIFEST="$manifest" ACTOR_PATCH="$patch" ACTOR_SCOPE="$scope" \
    ACTOR_ROLE_PATH="$role_path" EXPECTED_WORKER_ID="$worker_id" \
    EXPECTED_WORKER_ROLE="$worker_role" EXPECTED_WORKER_ALIAS="$worker_alias" \
    EXPECTED_BUS_PINS="$expected_pins" python3 - <<'PY'
import json
import os

manifest = json.loads(os.environ['ACTOR_MANIFEST'])
patch = json.loads(os.environ['ACTOR_PATCH'])
if manifest.get('version') != 'dy.asset_manifest.v0' or not isinstance(manifest.get('entries'), list):
    raise SystemExit('invalid_actor_manifest')
scope = os.environ['ACTOR_SCOPE']
path = os.environ['ACTOR_ROLE_PATH']
matching = [entry for entry in manifest['entries'] if isinstance(entry, dict) and entry.get('path') == path]
if len(matching) != 1:
    raise SystemExit('actor_manifest_entry_count')
entry = matching[0]
if scope not in entry.get('scope', []) or entry.get('phase') != '20-role-negative' \
        or entry.get('authority') != 'authoritative' or entry.get('required') is not True:
    raise SystemExit('actor_manifest_entry_invalid')

records = patch.get('records') if isinstance(patch, dict) else None
if not isinstance(records, list):
    raise SystemExit('actor_patch_records_missing')
labels = {}
for record in records:
    if not isinstance(record, dict) or record.get('op') != 'add_label':
        continue
    if (record.get('model_id'), record.get('p'), record.get('r'), record.get('c')) == (0, 0, 0, 0):
        labels[record.get('k')] = record

if labels.get('model_type', {}).get('t') != 'model.v1n':
    raise SystemExit('actor_root_not_model_v1n')
if labels.get('sys_worker_id', {}).get('v') != os.environ['EXPECTED_WORKER_ID']:
    raise SystemExit('actor_worker_id_mismatch')
if labels.get('sys_worker_role', {}).get('v') != os.environ['EXPECTED_WORKER_ROLE']:
    raise SystemExit('actor_worker_role_mismatch')
alias = os.environ['EXPECTED_WORKER_ALIAS']
if alias != '-' and labels.get('mqtt_worker_id', {}).get('v') != alias:
    raise SystemExit('actor_worker_alias_mismatch')
actual_pins = sorted(record.get('t') for record in labels.values()
                     if isinstance(record.get('t'), str) and record['t'].startswith('pin.bus.'))
expected_pins = sorted(filter(None, os.environ['EXPECTED_BUS_PINS'].split(',')))
if actual_pins != expected_pins:
    raise SystemExit('actor_bus_pins_mismatch')
PY
  then
    fail_check "deploy/$deployment actor declaration invalid"
    return
  fi
  pass_check "deploy/$deployment actor assets verified"
}

check_exact_contexts

for deploy in mosquitto synapse remote-worker workspace-manager mbr-worker ui-server; do
  check_deploy_ready "$deploy"
done

check_service_ready mosquitto
check_service_ready synapse

for deploy in remote-worker workspace-manager mbr-worker ui-server; do
  check_no_terminating_pods "$deploy"
done

check_synapse_config
check_mqtt_configmap remote-worker-config
check_mqtt_configmap workspace-manager-config

check_secret_patch_ready "mbr-worker-secret" "mbr-worker-secret.MODELTABLE_PATCH_JSON"
check_secret_patch_ready "ui-server-secret" "ui-server-secret.MODELTABLE_PATCH_JSON"
check_ui_auth_secret

check_actor_asset mbr-worker mbr-worker roles/mbr/patches/mbr_role_v0.json \
  5/10/28/35/14 DEM - \
  pin.bus.cb.in,pin.bus.cb.out,pin.bus.mb.in,pin.bus.mb.out
check_actor_asset remote-worker remote-worker roles/remote-worker/patches/00_remote_worker_config.json \
  5/10/28/35/15 V1N R1 \
  pin.bus.cb.in,pin.bus.cb.out
check_actor_asset workspace-manager workspace-manager roles/workspace-manager/patches/00_workspace_manager_dem_config.json \
  5/10/28/36/16 DEM WM1 \
  pin.bus.cb.in,pin.bus.cb.out,pin.bus.mb.in,pin.bus.mb.out

if [ "$FAIL" -ne 0 ]; then
  echo "[check] baseline NOT ready"
  exit 1
fi

echo "[check] baseline ready"
