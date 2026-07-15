#!/usr/bin/env bash
# Deploy full stack to the local OrbStack Kubernetes cluster.
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

LOCAL_PERSISTED_ASSET_ROOT="${LOCAL_PERSISTED_ASSET_ROOT:-/Users/drop/dongyu/volume/persist/assets}"
SKIP_IMAGE_BUILD="${SKIP_IMAGE_BUILD:-0}"
SKIP_MATRIX_BOOTSTRAP="${SKIP_MATRIX_BOOTSTRAP:-0}"
GENERATED_ENV_FILE="$REPO_DIR/deploy/env/local.generated.env"

docker_build_with_local_fallback() {
  local tag="$1"
  local dockerfile="$2"
  local build_log
  build_log="$(mktemp)"
  if docker build --no-cache -f "$dockerfile" -t "$tag" . 2>&1 | tee "$build_log"; then
    rm -f "$build_log"
    return 0
  fi

  if grep -Eq 'registry-1\.docker\.io|failed to verify certificate|x509:' "$build_log"; then
    echo "  BuildKit metadata fetch failed for $tag; retrying with classic builder..."
    rm -f "$build_log"
    DOCKER_BUILDKIT=0 docker build --no-cache -f "$dockerfile" -t "$tag" .
    return 0
  fi

  rm -f "$build_log"
  return 1
}

# ── Load env ──────────────────────────────────────────────
echo "=== Step 0: Load env ==="
load_env "$REPO_DIR/deploy/env/local.env"
echo ""

# ── Pre-flight checks ────────────────────────────────────
echo "=== Step 1: Pre-flight checks ==="

CURRENT_CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
DOCKER_CONTEXT="$(docker context show 2>/dev/null || true)"
if [ "$CURRENT_CONTEXT" != "orbstack" ]; then
  echo "ERROR: kubectl context must be orbstack (got ${CURRENT_CONTEXT:-unknown})." >&2
  exit 1
fi
if [ "$DOCKER_CONTEXT" != "orbstack" ]; then
  echo "ERROR: docker context must be orbstack (got ${DOCKER_CONTEXT:-unknown})." >&2
  exit 1
fi
if [ "${K8S_CONTEXT:-}" != "orbstack" ]; then
  echo "ERROR: deploy/env/local.env must set K8S_CONTEXT=orbstack." >&2
  exit 1
fi
if [ "${NAMESPACE:-}" != "dongyu" ]; then
  echo "ERROR: deploy/env/local.env must set NAMESPACE=dongyu." >&2
  exit 1
fi
if [ "$(matrix_homeserver_url)" != "http://synapse.dongyu.svc.cluster.local:8008" ]; then
  echo "ERROR: local Matrix must use the in-cluster Synapse service." >&2
  exit 1
fi
if [ "${SYNAPSE_SERVER_NAME:-}" != "localhost" ]; then
  echo "ERROR: local Synapse server_name must be localhost." >&2
  exit 1
fi
if [ "${MQTT_HOST:-}" != "mosquitto.dongyu.svc.cluster.local" ] || [ "${MQTT_PORT:-}" != "1883" ]; then
  echo "ERROR: local MQTT must use mosquitto.dongyu.svc.cluster.local:1883." >&2
  exit 1
fi
if [ "${DY_AUTH:-}" != "0" ] || [ "${DY_DEV_FAKE_LOGIN:-}" != "0" ]; then
  echo "ERROR: local acceptance requires DY_AUTH=0 and DY_DEV_FAKE_LOGIN=0." >&2
  exit 1
fi
for oidc_key in DY_OIDC_ISSUER DY_OIDC_CLIENT_ID DY_OIDC_CLIENT_SECRET DY_OIDC_REDIRECT_URI DY_OIDC_SCOPE DY_OIDC_PROXY_URL DY_OIDC_STATE_SECRET; do
  oidc_value="$(printenv "$oidc_key" 2>/dev/null || true)"
  if [ -n "$oidc_value" ]; then
    echo "ERROR: local acceptance requires $oidc_key to be empty." >&2
    exit 1
  fi
done

echo "  kubectl context: orbstack"
echo "  docker context: orbstack"
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
kubectl -n "$NAMESPACE" rollout restart deployment/synapse
kubectl -n "$NAMESPACE" rollout restart deployment/mosquitto
echo "  Waiting for Synapse rollout..."
kubectl -n "$NAMESPACE" rollout status deployment/synapse --timeout=180s
kubectl -n "$NAMESPACE" rollout status deployment/mosquitto --timeout=60s
echo "  Infrastructure: OK"
echo ""

# ── Initialize Synapse users & room ──────────────────────
echo "=== Step 4: Initialize Synapse ==="
if [ "$SKIP_IMAGE_BUILD" = "1" ] && [ -f "$GENERATED_ENV_FILE" ] && [ "$SKIP_MATRIX_BOOTSTRAP" = "0" ]; then
  if validate_generated_matrix_bootstrap "$GENERATED_ENV_FILE"; then
    SKIP_MATRIX_BOOTSTRAP=1
  else
    echo "  Generated Matrix bootstrap does not match current homeserver; refreshing."
  fi
fi

if [ "$SKIP_MATRIX_BOOTSTRAP" = "1" ]; then
  if ! validate_generated_matrix_bootstrap "$GENERATED_ENV_FILE"; then
    echo "ERROR: generated Matrix bootstrap does not match current Matrix configuration: $GENERATED_ENV_FILE" >&2
    exit 1
  fi
  echo "  Reusing generated Matrix bootstrap from $GENERATED_ENV_FILE"
  # shellcheck disable=SC1090
  source "$GENERATED_ENV_FILE"
  ROOM_ID="${DY_MATRIX_ROOM_ID:-}"
  SERVER_TOKEN="${SERVER_ACCESS_TOKEN:-}"
  MBR_TOKEN="${MBR_ACCESS_TOKEN:-}"
  if ! is_valid_matrix_room_id "$ROOM_ID"; then
    echo "ERROR: invalid or missing DY_MATRIX_ROOM_ID in $GENERATED_ENV_FILE" >&2
    exit 1
  fi
  if [ -z "$SERVER_TOKEN" ] || [ -z "$MBR_TOKEN" ]; then
    echo "ERROR: missing SERVER_ACCESS_TOKEN / MBR_ACCESS_TOKEN in $GENERATED_ENV_FILE" >&2
    exit 1
  fi
  echo "  Room: $ROOM_ID"
  echo "  Matrix access tokens loaded from generated local env"
else
  register_synapse_users

  echo "  Getting access token for @${SERVER_USER}..."
  SERVER_TOKEN=$(get_matrix_token "$SERVER_USER" "$SERVER_PASSWORD")
  echo "  Server access token obtained"

  echo "  Getting access token for @${MBR_USER}..."
  MBR_TOKEN=$(get_matrix_token "$MBR_USER" "$MBR_PASSWORD")
  echo "  MBR access token obtained"

  echo "  Creating DM room..."
  ROOM_ID_RAW="$(create_matrix_room_and_join "$SERVER_TOKEN" "$MBR_TOKEN")"
  ROOM_ID="$(extract_matrix_room_id "$ROOM_ID_RAW")"
  if ! is_valid_matrix_room_id "$ROOM_ID"; then
    echo "ERROR: failed to parse valid room id from create_matrix_room_and_join output." >&2
    echo "Raw output:" >&2
    printf '%s\n' "$ROOM_ID_RAW" >&2
    exit 1
  fi
  echo "  Room: $ROOM_ID"
fi
echo ""

# ── Update K8s secrets ────────────────────────────────────
echo "=== Step 5: Update secrets ==="
update_k8s_secrets "$SERVER_TOKEN" "$MBR_TOKEN" "$ROOM_ID"
echo ""

# ── Sync persisted assets ─────────────────────────────────
echo "=== Step 6: Sync persisted assets ==="
LOCAL_PERSISTED_ASSET_ROOT="$LOCAL_PERSISTED_ASSET_ROOT" bash "$REPO_DIR/scripts/ops/sync_local_persisted_assets.sh"
LOCAL_DY_PERSIST_ROOT="${LOCAL_DY_PERSIST_ROOT:-/Users/drop/dongyu/volume/persist/ui-server}" bash "$REPO_DIR/scripts/ops/sync_ui_public_docs.sh"
echo ""

# ── Build Docker images ───────────────────────────────────
echo "=== Step 7: Build Docker images ==="
cd "$REPO_DIR"
if [ "$SKIP_IMAGE_BUILD" = "1" ]; then
  echo "  SKIP_IMAGE_BUILD=1 -> skipping docker build"
else
  echo "  Building dy-ui-server:v1 ..."
  docker_build_with_local_fallback dy-ui-server:v1 k8s/Dockerfile.ui-server

  echo "  Building dy-remote-worker:v3 ..."
  docker_build_with_local_fallback dy-remote-worker:v3 k8s/Dockerfile.remote-worker

  echo "  Building dy-mbr-worker:v2 ..."
  docker_build_with_local_fallback dy-mbr-worker:v2 k8s/Dockerfile.mbr-worker

fi
echo ""

# ── Apply worker manifests (with placeholder replacement) ─
echo "=== Step 8: Apply manifests ==="
patch_manifest "$REPO_DIR/k8s/local/workers.yaml" "$ROOM_ID" "$SERVER_PASSWORD" "$MBR_TOKEN"
kubectl apply -f "$REPO_DIR/k8s/local/ui-server-nodeport.yaml"
echo ""

# ── Rollout restart ───────────────────────────────────────
echo "=== Step 9: Rollout restart ==="
kubectl -n "$NAMESPACE" rollout restart deployment/ui-server
kubectl -n "$NAMESPACE" rollout restart deployment/mbr-worker
kubectl -n "$NAMESPACE" rollout restart deployment/remote-worker
kubectl -n "$NAMESPACE" rollout restart deployment/workspace-manager
echo ""

# ── Wait for rollout ─────────────────────────────────────
echo "=== Step 10: Wait for rollout ==="
wait_for_rollout mosquitto synapse remote-worker workspace-manager mbr-worker ui-server
echo "  Waiting for old app pods to terminate..."
wait_for_no_terminating_pods remote-worker workspace-manager mbr-worker ui-server
echo ""

# ── Verify ────────────────────────────────────────────────
echo "=== Step 11: Verify ==="
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
