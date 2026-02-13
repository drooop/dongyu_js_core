#!/usr/bin/env bash
# Deploy full stack to cloud rke2 cluster (124.71.43.80)
# Must be run as root (sudo) on the cloud server.
# Usage: sudo bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud.sh
#
# Cluster: rke2 (NOT k3s). NEVER start/stop k3s.
# Containerd socket: /run/k3s/containerd/containerd.sock (rke2 uses this path)
# Kubeconfig: /etc/rancher/rke2/rke2.yaml
set -euo pipefail

REPO_DIR="/home/wwpic/dongyuapp"
NAMESPACE="dongyu"
export KUBECONFIG="/etc/rancher/rke2/rke2.yaml"
CTR="/usr/local/bin/ctr"
CONTAINERD_SOCK="/run/k3s/containerd/containerd.sock"

# Synapse config
SYNAPSE_SERVER_NAME="dongyu.local"
SYNAPSE_SECRET="dongyu-synapse-secret-2026"
SERVER_USER="drop"
SERVER_PASSWORD="DyCloud2026!"
MBR_USER="mbr"
MBR_PASSWORD="DyCloud2026!"

echo "=== 0145 Cloud Deploy (full stack) ==="
echo "Cluster type: rke2"
echo "KUBECONFIG=$KUBECONFIG"
echo "REPO_DIR=$REPO_DIR"
echo ""

# ── Pre-flight checks ──────────────────────────────────
echo "=== Pre-flight checks ==="

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: must run as root (sudo)." >&2
  exit 1
fi

if [ ! -r "$KUBECONFIG" ]; then
  echo "ERROR: kubeconfig not readable: $KUBECONFIG" >&2
  exit 1
fi

if [ ! -S "$CONTAINERD_SOCK" ]; then
  echo "ERROR: containerd socket not found: $CONTAINERD_SOCK" >&2
  echo "Is rke2 running? Check: systemctl status rke2-server" >&2
  exit 1
fi

if ! kubectl get nodes >/dev/null 2>&1; then
  echo "ERROR: kubectl cannot reach cluster." >&2
  exit 1
fi
echo "  kubectl: OK"

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: docker daemon not reachable." >&2
  exit 1
fi
echo "  docker: OK"

if [ ! -x "$CTR" ]; then
  echo "ERROR: ctr binary not found at $CTR" >&2
  exit 1
fi
echo "  ctr: OK"

if [ ! -f "$REPO_DIR/k8s/Dockerfile.ui-server" ]; then
  echo "ERROR: Dockerfile not found at $REPO_DIR/k8s/Dockerfile.ui-server" >&2
  exit 1
fi
echo "  repo: OK"

echo "All pre-flight checks passed."
echo ""

# ── Step 1: Ensure namespace ───────────────────────────
echo "=== Step 1: Ensure namespace '$NAMESPACE' ==="
kubectl get ns "$NAMESPACE" >/dev/null 2>&1 || kubectl create ns "$NAMESPACE"
echo "  Namespace '$NAMESPACE': OK"
echo ""

# ── Step 2: Deploy Synapse ─────────────────────────────
echo "=== Step 2: Deploy Synapse ==="
kubectl apply -f "$REPO_DIR/k8s/cloud/synapse.yaml"
echo "  Waiting for Synapse rollout..."
kubectl -n "$NAMESPACE" rollout status deployment/synapse --timeout=180s
echo "  Synapse: OK"
echo ""

# ── Step 3: Initialize Synapse users & room ─────────────
echo "=== Step 3: Initialize Synapse users & room ==="

SYNAPSE_POD=$(kubectl -n "$NAMESPACE" get pods -l app=synapse -o jsonpath='{.items[0].metadata.name}')
echo "  Synapse pod: $SYNAPSE_POD"

# Register users (idempotent — will fail if user exists, that's OK)
echo "  Registering user @${SERVER_USER}:${SYNAPSE_SERVER_NAME} ..."
kubectl -n "$NAMESPACE" exec "$SYNAPSE_POD" -- \
  register_new_matrix_user -u "$SERVER_USER" -p "$SERVER_PASSWORD" \
  -c /data/homeserver.yaml --admin http://localhost:8008 2>&1 || echo "  (user may already exist)"

echo "  Registering user @${MBR_USER}:${SYNAPSE_SERVER_NAME} ..."
kubectl -n "$NAMESPACE" exec "$SYNAPSE_POD" -- \
  register_new_matrix_user -u "$MBR_USER" -p "$MBR_PASSWORD" \
  -c /data/homeserver.yaml --no-admin http://localhost:8008 2>&1 || echo "  (user may already exist)"

# Reset passwords via SQLite (ensures known passwords even if users existed)
echo "  Resetting passwords via SQLite..."
kubectl -n "$NAMESPACE" exec "$SYNAPSE_POD" -- \
  python3 -c "
import subprocess, sqlite3
def hash_pw(pw):
    r = subprocess.run(['hash_password', '-c', '/data/homeserver.yaml', '-p', pw], capture_output=True, text=True)
    return r.stdout.strip()
h = hash_pw('${SERVER_PASSWORD}')
db = sqlite3.connect('/data/homeserver.db')
db.execute('UPDATE users SET password_hash = ? WHERE name = ?', (h, '@${SERVER_USER}:${SYNAPSE_SERVER_NAME}'))
db.execute('UPDATE users SET password_hash = ? WHERE name = ?', (h, '@${MBR_USER}:${SYNAPSE_SERVER_NAME}'))
db.commit()
print('  Passwords reset for ${SERVER_USER} and ${MBR_USER}')
"

# Login as server user to get access token (use python3 — curl not in Synapse image)
echo "  Getting access token for @${SERVER_USER}..."
SERVER_TOKEN=$(kubectl -n "$NAMESPACE" exec "$SYNAPSE_POD" -- \
  python3 -c "
import urllib.request, json
data = json.dumps({'type':'m.login.password','identifier':{'type':'m.id.user','user':'${SERVER_USER}'},'password':'${SERVER_PASSWORD}'}).encode()
req = urllib.request.Request('http://localhost:8008/_matrix/client/v3/login', data=data, headers={'Content-Type':'application/json'})
resp = urllib.request.urlopen(req)
print(json.loads(resp.read())['access_token'])
")
echo "  Server token: ${SERVER_TOKEN:0:10}..."

echo "  Getting access token for @${MBR_USER}..."
MBR_TOKEN=$(kubectl -n "$NAMESPACE" exec "$SYNAPSE_POD" -- \
  python3 -c "
import urllib.request, json
data = json.dumps({'type':'m.login.password','identifier':{'type':'m.id.user','user':'${MBR_USER}'},'password':'${MBR_PASSWORD}'}).encode()
req = urllib.request.Request('http://localhost:8008/_matrix/client/v3/login', data=data, headers={'Content-Type':'application/json'})
resp = urllib.request.urlopen(req)
print(json.loads(resp.read())['access_token'])
")
echo "  MBR token: ${MBR_TOKEN:0:10}..."

# Create DM room
echo "  Creating DM room..."
ROOM_ID=$(kubectl -n "$NAMESPACE" exec "$SYNAPSE_POD" -- \
  python3 -c "
import urllib.request, json
data = json.dumps({'preset':'trusted_private_chat','invite':['@${MBR_USER}:${SYNAPSE_SERVER_NAME}'],'is_direct':True}).encode()
req = urllib.request.Request('http://localhost:8008/_matrix/client/v3/createRoom', data=data, headers={'Content-Type':'application/json','Authorization':'Bearer ${SERVER_TOKEN}'})
resp = urllib.request.urlopen(req)
print(json.loads(resp.read())['room_id'])
")
echo "  Room ID: $ROOM_ID"

# MBR joins room
echo "  MBR joining room..."
kubectl -n "$NAMESPACE" exec "$SYNAPSE_POD" -- \
  python3 -c "
import urllib.request, json
data = b'{}'
req = urllib.request.Request('http://localhost:8008/_matrix/client/v3/join/${ROOM_ID}', data=data, headers={'Content-Type':'application/json','Authorization':'Bearer ${MBR_TOKEN}'})
try:
    urllib.request.urlopen(req)
    print('joined')
except Exception as e:
    print('may already be joined:', e)
" || echo "  (may already be joined)"

echo "  Matrix setup complete."
echo ""

# ── Step 4: Update K8s secrets with real credentials ────
echo "=== Step 4: Update secrets & configmaps ==="

# UI Server secret
kubectl -n "$NAMESPACE" create secret generic ui-server-secret \
  --from-literal="MATRIX_MBR_PASSWORD=$SERVER_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

# MBR Worker secret
kubectl -n "$NAMESPACE" create secret generic mbr-worker-secret \
  --from-literal="MATRIX_MBR_BOT_ACCESS_TOKEN=$MBR_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

# Patch workers.yaml env with real room ID and password
WORKERS_TMP=$(mktemp)
sed -e "s|placeholder-roomid-update-after-synapse-setup|$ROOM_ID|g" \
    -e "s|placeholder-password-update-after-synapse-setup|$SERVER_PASSWORD|g" \
    "$REPO_DIR/k8s/cloud/workers.yaml" > "$WORKERS_TMP"

# Also update mbr-update.yaml with real values
MBR_UPDATE_TMP=$(mktemp)
sed -e "s|!fzuRnQYaDvsMJzwLMA:dongyu.local|$ROOM_ID|g" \
    -e "s|syt_bWJy_ZNQdUjBCnGAwrrpOSYzs_2S0abU|$MBR_TOKEN|g" \
    "$REPO_DIR/k8s/cloud/mbr-update.yaml" > "$MBR_UPDATE_TMP"

echo "  Secrets updated."
echo ""

# ── Step 5: Build UI Server image ──────────────────────
echo "=== Step 5: Build dy-ui-server:v1 ==="
cd "$REPO_DIR"
docker build --no-cache -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .
echo ""

# ── Step 6: Import image to rke2 containerd ─────────────
echo "=== Step 6: Import image to rke2 containerd ==="
docker save dy-ui-server:v1 | "$CTR" --address "$CONTAINERD_SOCK" -n k8s.io images import -
echo "  Image imported."
echo ""

# ── Step 7: Apply manifests ─────────────────────────────
echo "=== Step 7: Apply manifests ==="
kubectl apply -f "$WORKERS_TMP"
kubectl apply -f "$MBR_UPDATE_TMP"
rm -f "$WORKERS_TMP" "$MBR_UPDATE_TMP"
echo ""

# ── Step 8: Force-delete stuck Terminating pods ──────────
echo "=== Step 8: Cleanup stuck pods ==="
for deploy in ui-server mbr-worker remote-worker; do
  STUCK=$(kubectl -n "$NAMESPACE" get pods -l "app=$deploy" --no-headers 2>/dev/null \
    | awk '$3 == "Terminating" {print $1}')
  if [ -n "$STUCK" ]; then
    echo "  Force-deleting stuck pods for $deploy: $STUCK"
    echo "$STUCK" | xargs kubectl -n "$NAMESPACE" delete pod --grace-period=0 --force 2>/dev/null || true
  fi
done
echo ""

# ── Step 9: Rollout restart ─────────────────────────────
echo "=== Step 9: Rollout restart ==="
kubectl -n "$NAMESPACE" rollout restart deployment/ui-server
kubectl -n "$NAMESPACE" rollout restart deployment/mbr-worker
echo ""

# ── Step 10: Wait for rollout ────────────────────────────
echo "=== Step 10: Wait for rollout (timeout 60s) ==="
for deploy in ui-server mbr-worker; do
  if ! kubectl -n "$NAMESPACE" rollout status "deployment/$deploy" --timeout=60s 2>&1; then
    echo "  Rollout timeout for $deploy — force-deleting Terminating pods..."
    kubectl -n "$NAMESPACE" get pods -l "app=$deploy" --no-headers \
      | awk '$3 == "Terminating" {print $1}' \
      | xargs -r kubectl -n "$NAMESPACE" delete pod --grace-period=0 --force 2>/dev/null || true
    echo "  Waiting again..."
    kubectl -n "$NAMESPACE" rollout status "deployment/$deploy" --timeout=60s || true
  fi
done
echo ""

# ── Step 11: Verify ─────────────────────────────────────
echo "=== Step 11: Verify ==="
echo "--- All pods ---"
kubectl -n "$NAMESPACE" get pods -o wide
echo ""
echo "--- Services ---"
kubectl -n "$NAMESPACE" get svc
echo ""
echo "--- Ingress ---"
kubectl -n "$NAMESPACE" get ingress 2>/dev/null || echo "  (no ingress)"
echo ""

echo "=== Deploy complete ==="
echo "UI Server: https://app.dongyudigital.com"
echo "Matrix Room: $ROOM_ID"
echo "Server User: @${SERVER_USER}:${SYNAPSE_SERVER_NAME}"
echo "MBR User: @${MBR_USER}:${SYNAPSE_SERVER_NAME}"
