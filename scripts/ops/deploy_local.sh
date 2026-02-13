#!/usr/bin/env bash
# Deploy full stack to local Docker Desktop K8s cluster.
# Usage: bash scripts/ops/deploy_local.sh
# Requires: deploy/env/local.env (copy from local.env.example)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=_deploy_common.sh
source "$SCRIPT_DIR/_deploy_common.sh"

echo "=== Local Deploy (full stack) ==="
echo "REPO_DIR=$REPO_DIR"
echo ""

# ── Load env ──────────────────────────────────────────────
echo "=== Step 0: Load env ==="
load_env "$REPO_DIR/deploy/env/local.env"
echo ""

# ── Pre-flight checks ────────────────────────────────────
echo "=== Step 1: Pre-flight checks ==="

if ! kubectl config use-context "${K8S_CONTEXT:-docker-desktop}" >/dev/null 2>&1; then
  echo "ERROR: cannot switch to context ${K8S_CONTEXT:-docker-desktop}" >&2
  exit 1
fi
echo "  kubectl context: ${K8S_CONTEXT:-docker-desktop}"

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

# ── Deploy infrastructure (mosquitto + synapse) ──────────
echo "=== Step 3: Deploy infrastructure ==="
kubectl apply -f "$REPO_DIR/k8s/local/namespace.yaml"
kubectl apply -f "$REPO_DIR/k8s/local/mosquitto.yaml"
kubectl apply -f "$REPO_DIR/k8s/local/synapse.yaml"
echo "  Waiting for Synapse rollout..."
kubectl -n "$NAMESPACE" rollout status deployment/synapse --timeout=180s
kubectl -n "$NAMESPACE" rollout status deployment/mosquitto --timeout=60s
echo "  Infrastructure: OK"
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

# ── Build Docker images ───────────────────────────────────
echo "=== Step 6: Build Docker images ==="
cd "$REPO_DIR"
echo "  Building dy-ui-server:v1 ..."
docker build --no-cache -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .

echo "  Building dy-remote-worker:v3 ..."
docker build --no-cache -f k8s/Dockerfile.remote-worker -t dy-remote-worker:v3 .

echo "  Building dy-mbr-worker:v2 ..."
docker build --no-cache -f k8s/Dockerfile.mbr-worker -t dy-mbr-worker:v2 .
echo ""

# ── Apply worker manifests (with placeholder replacement) ─
echo "=== Step 7: Apply manifests ==="
patch_manifest "$REPO_DIR/k8s/local/workers.yaml" "$ROOM_ID" "$SERVER_PASSWORD"
kubectl apply -f "$REPO_DIR/k8s/local/ui-server-nodeport.yaml"
echo ""

# ── Rollout restart ───────────────────────────────────────
echo "=== Step 8: Rollout restart ==="
kubectl -n "$NAMESPACE" rollout restart deployment/ui-server
kubectl -n "$NAMESPACE" rollout restart deployment/mbr-worker
kubectl -n "$NAMESPACE" rollout restart deployment/remote-worker
echo ""

# ── Wait for rollout ─────────────────────────────────────
echo "=== Step 9: Wait for rollout ==="
wait_for_rollout mosquitto synapse remote-worker mbr-worker ui-server
echo ""

# ── Verify ────────────────────────────────────────────────
echo "=== Step 10: Verify ==="
verify_pods
echo ""

# ── Save generated env ────────────────────────────────────
save_generated_env "$REPO_DIR/deploy/env/local.generated.env" "$ROOM_ID" "$SERVER_TOKEN" "$MBR_TOKEN"

echo ""
echo "=== Local deploy complete ==="
echo "UI Server: http://localhost:30900"
echo "Matrix Room: $ROOM_ID"
echo "Server User: @${SERVER_USER}:${SYNAPSE_SERVER_NAME}"
echo "MBR User: @${MBR_USER}:${SYNAPSE_SERVER_NAME}"
