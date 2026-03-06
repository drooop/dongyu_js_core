#!/usr/bin/env bash
# Shared functions for deploy_local.sh and deploy_cloud.sh
# Source this file: source "$(dirname "${BASH_SOURCE[0]}")/_deploy_common.sh"

# ── load_env ──────────────────────────────────────────────
# Usage: load_env <env_file>
load_env() {
  local env_file="$1"
  if [ ! -f "$env_file" ]; then
    echo "ERROR: env file not found: $env_file" >&2
    echo "  Copy the example and fill in values:" >&2
    echo "  cp ${env_file}.example $env_file" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
  echo "  Loaded env: $env_file"
}

# ── ensure_namespace ──────────────────────────────────────
ensure_namespace() {
  local ns="${NAMESPACE:?NAMESPACE not set}"
  kubectl get ns "$ns" >/dev/null 2>&1 || kubectl create ns "$ns"
  echo "  Namespace '$ns': OK"
}

# ── wait_for_synapse_ready ─────────────────────────────────
# Polls Synapse HTTP until it responds (max 60s).
wait_for_synapse_ready() {
  local ns="${NAMESPACE:?}"
  local pod
  pod=$(kubectl -n "$ns" get pods -l app=synapse -o jsonpath='{.items[0].metadata.name}')
  echo "  Waiting for Synapse HTTP to be ready (max 60s)..."
  local i=0
  while [ $i -lt 30 ]; do
    if kubectl -n "$ns" exec "$pod" -- python3 -c "
import urllib.request
try:
    urllib.request.urlopen('http://localhost:8008/_matrix/client/versions')
    print('ready')
except:
    exit(1)
" 2>/dev/null | grep -q ready; then
      echo "  Synapse HTTP: ready"
      return 0
    fi
    sleep 2
    i=$((i + 1))
  done
  echo "  ERROR: Synapse HTTP not ready after 60s" >&2
  return 1
}

# ── register_synapse_users ────────────────────────────────
# Registers SERVER_USER and MBR_USER via register_new_matrix_user.
# Idempotent: fails silently if user already exists.
# Then resets passwords via SQLite to ensure known credentials.
register_synapse_users() {
  local ns="${NAMESPACE:?}"
  local server_name="${SYNAPSE_SERVER_NAME:?}"
  local pod
  pod=$(kubectl -n "$ns" get pods -l app=synapse -o jsonpath='{.items[0].metadata.name}')
  echo "  Synapse pod: $pod"

  # Wait for Synapse to be actually serving HTTP
  wait_for_synapse_ready

  echo "  Registering @${SERVER_USER}:${server_name} ..."
  kubectl -n "$ns" exec "$pod" -- \
    register_new_matrix_user -u "$SERVER_USER" -p "$SERVER_PASSWORD" \
    -c /data/homeserver.yaml --admin http://localhost:8008 2>&1 || echo "  (user may already exist)"

  echo "  Registering @${MBR_USER}:${server_name} ..."
  kubectl -n "$ns" exec "$pod" -- \
    register_new_matrix_user -u "$MBR_USER" -p "$MBR_PASSWORD" \
    -c /data/homeserver.yaml --no-admin http://localhost:8008 2>&1 || echo "  (user may already exist)"

  echo "  Resetting passwords via SQLite..."
  kubectl -n "$ns" exec "$pod" -- \
    python3 -c "
import subprocess, sqlite3
def hash_pw(pw):
    r = subprocess.run(['hash_password', '-c', '/data/homeserver.yaml', '-p', pw], capture_output=True, text=True)
    return r.stdout.strip()
h_server = hash_pw('${SERVER_PASSWORD}')
h_mbr    = hash_pw('${MBR_PASSWORD}')
db = sqlite3.connect('/data/homeserver.db')
db.execute('UPDATE users SET password_hash = ? WHERE name = ?', (h_server, '@${SERVER_USER}:${server_name}'))
db.execute('UPDATE users SET password_hash = ? WHERE name = ?', (h_mbr, '@${MBR_USER}:${server_name}'))
db.commit()
print('  Passwords reset for ${SERVER_USER} and ${MBR_USER}')
"
}

# ── get_matrix_token ──────────────────────────────────────
# Usage: TOKEN=$(get_matrix_token <username> <password>)
get_matrix_token() {
  local user="$1" pass="$2"
  local ns="${NAMESPACE:?}"
  local pod
  pod=$(kubectl -n "$ns" get pods -l app=synapse -o jsonpath='{.items[0].metadata.name}')
  kubectl -n "$ns" exec "$pod" -- \
    python3 -c "
import urllib.request, json
data = json.dumps({'type':'m.login.password','identifier':{'type':'m.id.user','user':'${user}'},'password':'${pass}'}).encode()
req = urllib.request.Request('http://localhost:8008/_matrix/client/v3/login', data=data, headers={'Content-Type':'application/json'})
resp = urllib.request.urlopen(req)
print(json.loads(resp.read())['access_token'])
"
}

# ── create_matrix_room_and_join ───────────────────────────
# Usage: ROOM_ID=$(create_matrix_room_and_join <server_token> <mbr_token>)
create_matrix_room_and_join() {
  local server_token="$1" mbr_token="$2"
  local ns="${NAMESPACE:?}"
  local server_name="${SYNAPSE_SERVER_NAME:?}"
  local pod
  pod=$(kubectl -n "$ns" get pods -l app=synapse -o jsonpath='{.items[0].metadata.name}')

  local room_id
  room_id=$(kubectl -n "$ns" exec "$pod" -- \
    python3 -c "
import urllib.request, json
data = json.dumps({'preset':'trusted_private_chat','invite':['@${MBR_USER}:${server_name}'],'is_direct':True}).encode()
req = urllib.request.Request('http://localhost:8008/_matrix/client/v3/createRoom', data=data, headers={'Content-Type':'application/json','Authorization':'Bearer ${server_token}'})
resp = urllib.request.urlopen(req)
print(json.loads(resp.read())['room_id'])
")
  echo "  Room ID: $room_id" >&2

  # MBR joins room
  kubectl -n "$ns" exec "$pod" -- \
    python3 -c "
import urllib.request, json
data = b'{}'
req = urllib.request.Request('http://localhost:8008/_matrix/client/v3/join/${room_id}', data=data, headers={'Content-Type':'application/json','Authorization':'Bearer ${mbr_token}'})
try:
    urllib.request.urlopen(req)
    print('joined', file=__import__('sys').stderr)
except Exception as e:
    print('may already be joined:', e, file=__import__('sys').stderr)
" >/dev/null 2>&1 || echo "  (may already be joined)" >&2

  echo "$room_id"
}

# ── extract_matrix_room_id ───────────────────────────────
# Usage: ROOM_ID=$(extract_matrix_room_id "$raw_output")
extract_matrix_room_id() {
  local raw="${1:-}"
  printf '%s\n' "$raw" | grep -Eo '![^[:space:]]+:[^[:space:]]+' | tail -n 1
}

# ── is_valid_matrix_room_id ──────────────────────────────
# Usage: is_valid_matrix_room_id "$room_id"
is_valid_matrix_room_id() {
  local room_id="${1:-}"
  [[ "$room_id" =~ ^![^[:space:]]+:[^[:space:]]+$ ]]
}

# ── escape_sed_replacement ───────────────────────────────
# Escapes a string for use as sed replacement with delimiter '|'.
escape_sed_replacement() {
  local value="${1:-}"
  if [[ "$value" == *$'\n'* ]] || [[ "$value" == *$'\r'* ]]; then
    echo "ERROR: multi-line value is not allowed in sed replacement." >&2
    return 1
  fi
  printf '%s' "$value" | sed -e 's/[\\|&]/\\&/g'
}

# ── update_k8s_secrets ────────────────────────────────────
# Creates/updates ui-server-secret and mbr-worker-secret.
update_k8s_secrets() {
  local server_token="$1"
  local mbr_token="$2"
  local room_id="$3"
  local ns="${NAMESPACE:?}"
  local tmp_ui tmp_mbr ui_patch mbr_patch secret_name
  tmp_ui=$(mktemp)
  tmp_mbr=$(mktemp)
  ui_patch="$(
    ROOM_ID="$room_id" \
    HOMESERVER_URL="http://synapse.${ns}.svc.cluster.local:8008" \
    MATRIX_USER="@${SERVER_USER}:${SYNAPSE_SERVER_NAME}" \
    MATRIX_PASSWORD="$SERVER_PASSWORD" \
    MATRIX_TOKEN="$server_token" \
    MATRIX_CONTUSER="@${MBR_USER}:${SYNAPSE_SERVER_NAME}" \
    python3 - <<'PY'
import json
import os

patch = {
    "version": "mt.v0",
    "op_id": "ui_server_matrix_bootstrap_v0",
    "records": [
        {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "matrix_room_id", "t": "str", "v": os.environ["ROOM_ID"]},
        {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "matrix_server", "t": "matrix.server", "v": os.environ["HOMESERVER_URL"]},
        {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "matrix_user", "t": "matrix.user", "v": os.environ["MATRIX_USER"]},
        {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "matrix_passwd", "t": "matrix.passwd", "v": os.environ["MATRIX_PASSWORD"]},
        {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "matrix_token", "t": "matrix.token", "v": os.environ["MATRIX_TOKEN"]},
        {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "matrix_contuser", "t": "matrix.contuser", "v": [os.environ["MATRIX_CONTUSER"]]},
    ],
}
print(json.dumps(patch, separators=(',', ':')))
PY
  )"
  mbr_patch="$(
    ROOM_ID="$room_id" \
    HOMESERVER_URL="http://synapse.${ns}.svc.cluster.local:8008" \
    MATRIX_USER="@${MBR_USER}:${SYNAPSE_SERVER_NAME}" \
    MATRIX_TOKEN="$mbr_token" \
    MATRIX_CONTUSER="@${SERVER_USER}:${SYNAPSE_SERVER_NAME}" \
    MQTT_HOST="${MQTT_HOST}" \
    MQTT_PORT="${MQTT_PORT}" \
    python3 - <<'PY'
import json
import os

patch = {
    "version": "mt.v0",
    "op_id": "mbr_worker_bootstrap_v0",
    "records": [
        {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "matrix_room_id", "t": "str", "v": os.environ["ROOM_ID"]},
        {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "matrix_server", "t": "matrix.server", "v": os.environ["HOMESERVER_URL"]},
        {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "matrix_user", "t": "matrix.user", "v": os.environ["MATRIX_USER"]},
        {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "matrix_token", "t": "matrix.token", "v": os.environ["MATRIX_TOKEN"]},
        {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "matrix_contuser", "t": "matrix.contuser", "v": [os.environ["MATRIX_CONTUSER"]]},
        {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "local_ip", "t": "mqtt.local.ip", "v": [os.environ["MQTT_HOST"]]},
        {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "local_port", "t": "mqtt.local.port", "v": [os.environ["MQTT_PORT"]]},
    ],
}
print(json.dumps(patch, separators=(',', ':')))
PY
  )"

  cat > "$tmp_ui" <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: ui-server-secret
  namespace: ${ns}
type: Opaque
stringData:
  MODELTABLE_PATCH_JSON: >-
    ${ui_patch}
EOF
  secret_name="ui-server-secret"
  kubectl delete secret "$secret_name" -n "$ns" --ignore-not-found >/dev/null 2>&1 || true
  kubectl apply -f "$tmp_ui"

  cat > "$tmp_mbr" <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: mbr-worker-secret
  namespace: ${ns}
type: Opaque
stringData:
  MODELTABLE_PATCH_JSON: >-
    ${mbr_patch}
EOF
  secret_name="mbr-worker-secret"
  kubectl delete secret "$secret_name" -n "$ns" --ignore-not-found >/dev/null 2>&1 || true
  kubectl apply -f "$tmp_mbr"

  rm -f "$tmp_ui" "$tmp_mbr"

  echo "  Secrets updated."
}

# ── patch_manifest ────────────────────────────────────────
# Usage: patch_manifest <src_yaml> <room_id> [<password>] [<mbr_token>]
# Replaces placeholder tokens and applies the manifest.
patch_manifest() {
  local src="$1" room_id="$2" password="${3:-}" mbr_token="${4:-}"
  if ! is_valid_matrix_room_id "$room_id"; then
    echo "ERROR: invalid matrix room id for patching: $room_id" >&2
    return 1
  fi
  local room_id_escaped password_escaped mbr_token_escaped
  room_id_escaped="$(escape_sed_replacement "$room_id")"
  password_escaped="$(escape_sed_replacement "$password")"
  mbr_token_escaped="$(escape_sed_replacement "$mbr_token")"
  local tmp
  tmp=$(mktemp)
  sed -e "s|placeholder-roomid-update-after-synapse-setup|$room_id_escaped|g" \
      -e "s|placeholder-password-update-after-synapse-setup|${password_escaped}|g" \
      -e "s|placeholder-will-update-after-synapse-setup|${mbr_token_escaped}|g" \
      "$src" > "$tmp"
  kubectl apply -f "$tmp"
  rm -f "$tmp"
}

# ── wait_for_rollout ──────────────────────────────────────
# Usage: wait_for_rollout <deploy1> <deploy2> ...
wait_for_rollout() {
  local ns="${NAMESPACE:?}"
  for deploy in "$@"; do
    echo "  Waiting for $deploy ..."
    if ! kubectl -n "$ns" rollout status "deployment/$deploy" --timeout=120s 2>&1; then
      echo "  WARN: rollout timeout for $deploy"
    fi
  done
}

# ── verify_pods ───────────────────────────────────────────
verify_pods() {
  local ns="${NAMESPACE:?}"
  echo "--- All pods ---"
  kubectl -n "$ns" get pods -o wide
  echo ""
  echo "--- Services ---"
  kubectl -n "$ns" get svc
}

# ── save_generated_env ────────────────────────────────────
# Appends runtime-generated values (tokens, room_id) to a file.
# Usage: save_generated_env <file> <room_id> <server_token> <mbr_token>
save_generated_env() {
  local file="$1" room_id="$2" server_token="$3" mbr_token="$4"
  cat > "$file" <<GENEOF
# Auto-generated by deploy script — $(date -Iseconds)
# Do NOT commit this file.
DY_MATRIX_ROOM_ID=$room_id
SERVER_ACCESS_TOKEN=$server_token
MBR_ACCESS_TOKEN=$mbr_token
GENEOF
  echo "  Generated env saved to: $file"
}
