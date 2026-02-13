#!/usr/bin/env bash
# Deploy full stack to cloud rke2 cluster (124.71.43.80)
# Must be run as root (sudo) on the cloud server.
# Usage: sudo bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud.sh
# Requires: deploy/env/cloud.env (copy from cloud.env.example)
#
# Cluster: rke2 (NOT k3s). NEVER start/stop k3s.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=_deploy_common.sh
source "$SCRIPT_DIR/_deploy_common.sh"

echo "=== Cloud Deploy (full stack) ==="
echo "Cluster type: rke2"
echo "REPO_DIR=$REPO_DIR"
echo ""

# ── Load env ──────────────────────────────────────────────
echo "=== Step 0: Load env ==="
load_env "$REPO_DIR/deploy/env/cloud.env"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/rke2/rke2.yaml}"
CTR="${CTR:-/usr/local/bin/ctr}"
CONTAINERD_SOCK="${CONTAINERD_SOCK:-/run/k3s/containerd/containerd.sock}"
echo "  KUBECONFIG=$KUBECONFIG"
echo ""

# ── Pre-flight checks ────────────────────────────────────
echo "=== Step 1: Pre-flight checks ==="

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

# ── Ensure namespace ─────────────────────────────────────
echo "=== Step 2: Ensure namespace ==="
ensure_namespace
echo ""

# ── Deploy Synapse ────────────────────────────────────────
echo "=== Step 3: Deploy Synapse ==="
kubectl apply -f "$REPO_DIR/k8s/cloud/synapse.yaml"
echo "  Waiting for Synapse rollout..."
kubectl -n "$NAMESPACE" rollout status deployment/synapse --timeout=180s
echo "  Synapse: OK"
echo ""

# ── Initialize Synapse users & room ──────────────────────
echo "=== Step 4: Initialize Synapse ==="
register_synapse_users

echo "  Getting access token for @${SERVER_USER}..."
SERVER_TOKEN=$(get_matrix_token "$SERVER_USER" "$SERVER_PASSWORD")
echo "  Server token: ${SERVER_TOKEN:0:10}..."

echo "  Getting access token for @${MBR_USER}..."
MBR_TOKEN=$(get_matrix_token "$MBR_USER" "$MBR_PASSWORD")
echo "  MBR token: ${MBR_TOKEN:0:10}..."

echo "  Creating DM room..."
ROOM_ID=$(create_matrix_room_and_join "$SERVER_TOKEN" "$MBR_TOKEN")
echo "  Room: $ROOM_ID"
echo ""

# ── Update K8s secrets ────────────────────────────────────
echo "=== Step 5: Update secrets ==="
update_k8s_secrets "$MBR_TOKEN"
echo ""

# ── Build UI Server image ────────────────────────────────
echo "=== Step 6: Build dy-ui-server:v1 ==="
cd "$REPO_DIR"
docker build --no-cache -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .
echo ""

# ── Import image to rke2 containerd ──────────────────────
echo "=== Step 7: Import image to rke2 containerd ==="
docker save dy-ui-server:v1 | "$CTR" --address "$CONTAINERD_SOCK" -n k8s.io images import -
echo "  Image imported."
echo ""

# ── Apply manifests (with placeholder replacement) ───────
echo "=== Step 8: Apply manifests ==="
patch_manifest "$REPO_DIR/k8s/cloud/workers.yaml" "$ROOM_ID" "$SERVER_PASSWORD"

# Also patch mbr-update.yaml if it exists
if [ -f "$REPO_DIR/k8s/cloud/mbr-update.yaml" ]; then
  local_tmp=$(mktemp)
  sed -e "s|!fzuRnQYaDvsMJzwLMA:dongyu.local|$ROOM_ID|g" \
      -e "s|syt_bWJy_ZNQdUjBCnGAwrrpOSYzs_2S0abU|$MBR_TOKEN|g" \
      "$REPO_DIR/k8s/cloud/mbr-update.yaml" > "$local_tmp"
  kubectl apply -f "$local_tmp"
  rm -f "$local_tmp"
fi
echo ""

# ── Cleanup stuck pods ────────────────────────────────────
echo "=== Step 9: Cleanup stuck pods ==="
for deploy in ui-server mbr-worker remote-worker; do
  STUCK=$(kubectl -n "$NAMESPACE" get pods -l "app=$deploy" --no-headers 2>/dev/null \
    | awk '$3 == "Terminating" {print $1}')
  if [ -n "$STUCK" ]; then
    echo "  Force-deleting stuck pods for $deploy: $STUCK"
    echo "$STUCK" | xargs kubectl -n "$NAMESPACE" delete pod --grace-period=0 --force 2>/dev/null || true
  fi
done
echo ""

# ── Rollout restart ───────────────────────────────────────
echo "=== Step 10: Rollout restart ==="
kubectl -n "$NAMESPACE" rollout restart deployment/ui-server
kubectl -n "$NAMESPACE" rollout restart deployment/mbr-worker
echo ""

# ── Wait for rollout ─────────────────────────────────────
echo "=== Step 11: Wait for rollout ==="
wait_for_rollout ui-server mbr-worker
echo ""

# ── Verify ────────────────────────────────────────────────
echo "=== Step 12: Verify ==="
verify_pods
echo ""
echo "--- Ingress ---"
kubectl -n "$NAMESPACE" get ingress 2>/dev/null || echo "  (no ingress)"
echo ""

# ── Save generated env ────────────────────────────────────
save_generated_env "$REPO_DIR/deploy/env/cloud.generated.env" "$ROOM_ID" "$SERVER_TOKEN" "$MBR_TOKEN"

echo ""
echo "=== Cloud deploy complete ==="
echo "UI Server: https://app.dongyudigital.com"
echo "Matrix Room: $ROOM_ID"
echo "Server User: @${SERVER_USER}:${SYNAPSE_SERVER_NAME}"
echo "MBR User: @${MBR_USER}:${SYNAPSE_SERVER_NAME}"
