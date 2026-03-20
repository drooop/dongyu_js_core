#!/usr/bin/env bash
# Deploy full stack to cloud rke2 cluster (124.71.43.80).
# Must be run as root (sudo) on the cloud server.
# Usage:
#   sudo bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh
#   sudo bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh --image-tar /tmp/dy-ui-server.tar
# Requires: deploy/env/cloud.env (copy from cloud.env.example)
#
# Cluster: rke2 (NOT k3s). NEVER start/stop k3s.
set -euo pipefail

UI_IMAGE_TAR=""
REBUILD=0
while [ $# -gt 0 ]; do
  case "$1" in
    --image-tar)
      UI_IMAGE_TAR="${2:?missing value for --image-tar}"
      shift 2
      ;;
    --rebuild|--no-cache)
      REBUILD=1
      shift
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=_deploy_common.sh
source "$SCRIPT_DIR/_deploy_common.sh"

sha256_of_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "ERROR: file not found for sha256: $file" >&2
    return 1
  fi
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
    return 0
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
    return 0
  fi
  echo "ERROR: neither sha256sum nor shasum available." >&2
  return 1
}

require_single_ui_build_source() {
  local canonical="$REPO_DIR/k8s/Dockerfile.ui-server"
  local legacy="$REPO_DIR/Dockerfile.ui-server"
  local canonical_workers="$REPO_DIR/k8s/cloud/workers.yaml"
  local shadow_workers="$REPO_DIR/workers.yaml"

  if [ -f "$legacy" ]; then
    local h1 h2
    h1="$(sha256_of_file "$canonical")"
    h2="$(sha256_of_file "$legacy")"
    if [ "$h1" != "$h2" ]; then
      echo "ERROR: duplicate Dockerfile source drift detected." >&2
      echo "  canonical: $canonical ($h1)" >&2
      echo "  legacy:    $legacy ($h2)" >&2
      echo "Action: remove or sync legacy Dockerfile.ui-server before deploy." >&2
      exit 1
    fi
    echo "  WARN: legacy Dockerfile.ui-server exists but hash matches canonical."
  fi

  if [ -f "$shadow_workers" ]; then
    local wh1 wh2
    wh1="$(sha256_of_file "$canonical_workers")"
    wh2="$(sha256_of_file "$shadow_workers")"
    if [ "$wh1" != "$wh2" ]; then
      echo "ERROR: shadow workers manifest drift detected." >&2
      echo "  canonical: $canonical_workers ($wh1)" >&2
      echo "  shadow:    $shadow_workers ($wh2)" >&2
      echo "Action: remove/sync shadow workers.yaml to avoid stale deploy source." >&2
      exit 1
    fi
    echo "  WARN: shadow workers.yaml exists but hash matches canonical."
  fi
}

detect_source_revision() {
  if [ -d "$REPO_DIR/.git" ] && git -C "$REPO_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "$REPO_DIR" rev-parse --short HEAD
    return 0
  fi
  if [ -f "$REPO_DIR/.deploy-source-revision" ]; then
    tr -d '\r\n' < "$REPO_DIR/.deploy-source-revision"
    return 0
  fi
  if [ -n "${DEPLOY_SOURCE_REV:-}" ]; then
    printf '%s' "$DEPLOY_SOURCE_REV"
    return 0
  fi
  if [ -n "$UI_IMAGE_TAR" ] && [ -f "$UI_IMAGE_TAR" ]; then
    local tar_base tar_rev
    tar_base="$(basename "$UI_IMAGE_TAR")"
    if [[ "$tar_base" =~ ^dy-ui-server-([A-Za-z0-9._-]+)\.tar$ ]]; then
      tar_rev="${BASH_REMATCH[1]}"
    elif [[ "$tar_base" =~ ^(.+)\.tar$ ]]; then
      tar_rev="${BASH_REMATCH[1]}"
    else
      tar_rev="$tar_base"
    fi
    tar_rev="$(printf '%s' "$tar_rev" | tr -c 'A-Za-z0-9._-' '-')"
    tar_rev="${tar_rev#-}"
    tar_rev="${tar_rev%-}"
    if [ -n "$tar_rev" ]; then
      printf '%s' "$tar_rev"
      return 0
    fi
  fi
  echo "ERROR: cannot detect source revision (.git missing)." >&2
  echo "Set DEPLOY_SOURCE_REV to an explicit source identifier or provide --image-tar." >&2
  return 1
}

find_running_ui_server_pod() {
  kubectl -n "$NAMESPACE" get pods -l app=ui-server --no-headers 2>/dev/null \
    | awk '$2 ~ /^1\/1$/ && $3 == "Running" {print $1; exit}'
}

LAST_RUNNING_UI_SERVER_POD=""

exec_in_running_ui_server_pod() {
  local command="$1"
  local purpose="${2:-ui-server exec}"
  local max_attempts="${3:-8}"
  local attempt=1
  local pod out

  while [ $attempt -le $max_attempts ]; do
    pod="$(find_running_ui_server_pod)"
    if [ -n "$pod" ]; then
      if out="$(kubectl -n "$NAMESPACE" exec "$pod" -- sh -lc "$command" 2>&1)"; then
        LAST_RUNNING_UI_SERVER_POD="$pod"
        printf '%s' "$out"
        return 0
      fi
      echo "WARN: ${purpose} failed on pod ${pod} (attempt ${attempt}/${max_attempts}): ${out}" >&2
    else
      echo "WARN: cannot find running ui-server pod for ${purpose} (attempt ${attempt}/${max_attempts})" >&2
    fi
    attempt=$((attempt + 1))
    sleep 2
  done

  echo "ERROR: ${purpose} failed after ${max_attempts} attempts." >&2
  return 1
}

container_file_sha256() {
  local in_container_path="$1"
  exec_in_running_ui_server_pod \
    "bun -e \"import { readFileSync } from 'node:fs'; import { createHash } from 'node:crypto'; const p='${in_container_path}'; process.stdout.write(createHash('sha256').update(readFileSync(p)).digest('hex'));\""
}

verify_ui_server_runtime_source_hashes() {
  local expected_server="$1"
  local expected_demo="$2"
  local expected_adapter="$3"
  local expected_remote_store="$4"
  local expected_renderer_mjs="$5"
  local expected_renderer_js="$6"
  local got_server got_demo got_adapter got_remote_store got_renderer_mjs got_renderer_js
  got_server="$(container_file_sha256 "/app/packages/ui-model-demo-server/server.mjs")"
  got_demo="$(container_file_sha256 "/app/packages/ui-model-demo-frontend/src/demo_modeltable.js")"
  got_adapter="$(container_file_sha256 "/app/packages/ui-model-demo-frontend/src/local_bus_adapter.js")"
  got_remote_store="$(container_file_sha256 "/app/packages/ui-model-demo-frontend/src/remote_store.js")"
  got_renderer_mjs="$(container_file_sha256 "/app/packages/ui-renderer/src/renderer.mjs")"
  got_renderer_js="$(container_file_sha256 "/app/packages/ui-renderer/src/renderer.js")"

  echo "  ui-server pod: ${LAST_RUNNING_UI_SERVER_POD:-unknown}"
  echo "  hash server.mjs local=$expected_server pod=$got_server"
  echo "  hash demo_modeltable.js local=$expected_demo pod=$got_demo"
  echo "  hash local_bus_adapter.js local=$expected_adapter pod=$got_adapter"
  echo "  hash remote_store.js local=$expected_remote_store pod=$got_remote_store"
  echo "  hash renderer.mjs local=$expected_renderer_mjs pod=$got_renderer_mjs"
  echo "  hash renderer.js local=$expected_renderer_js pod=$got_renderer_js"

  if [ "$expected_server" != "$got_server" ] || [ "$expected_demo" != "$got_demo" ] || [ "$expected_adapter" != "$got_adapter" ] || [ "$expected_remote_store" != "$got_remote_store" ] || [ "$expected_renderer_mjs" != "$got_renderer_mjs" ] || [ "$expected_renderer_js" != "$got_renderer_js" ]; then
    echo "ERROR: ui-server runtime source hash mismatch (stale image or stale build context)." >&2
    return 1
  fi
}

verify_ui_prompt_guard_markers() {
  exec_in_running_ui_server_pod \
    "grep -q 'llmPromptAvailable' /app/packages/ui-model-demo-frontend/src/demo_modeltable.js" \
    "prompt guard marker llmPromptAvailable" >/dev/null
  exec_in_running_ui_server_pod \
    "grep -q 'txt_prompt_unavailable' /app/packages/ui-model-demo-frontend/src/demo_modeltable.js" \
    "prompt guard marker txt_prompt_unavailable" >/dev/null
  echo "  Prompt UI guard markers: OK"
}

verify_ui_server_snapshot_runtime() {
  local out
  out="$(exec_in_running_ui_server_pod \
    "bun -e \"fetch('http://127.0.0.1:9000/snapshot').then(r=>r.json()).then(j=>{const s=j.snapshot.models['-2'].cells['0,0,0'].labels; console.log('llm_prompt_available='+s.llm_prompt_available.v+' llm_prompt_notice='+s.llm_prompt_notice.v);}).catch(e=>{console.error(String(e&&e.message?e.message:e)); process.exit(2);})\"" \
    "snapshot check")"
  echo "  snapshot runtime: $out"
}

echo "=== Cloud Deploy (full stack) ==="
echo "Cluster type: rke2"
echo "REPO_DIR=$REPO_DIR"
if [ -n "$UI_IMAGE_TAR" ]; then
  echo "UI_IMAGE_TAR=$UI_IMAGE_TAR"
fi
echo "REBUILD=$REBUILD"
echo ""

# ── Load env ──────────────────────────────────────────────
echo "=== Step 0: Load env ==="
load_env "$REPO_DIR/deploy/env/cloud.env"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/rke2/rke2.yaml}"
CTR="${CTR:-/usr/local/bin/ctr}"
CLOUD_PERSISTED_ASSET_ROOT="${CLOUD_PERSISTED_ASSET_ROOT:-/home/wwpic/dongyu/volume/persist/assets}"
echo "  KUBECONFIG=$KUBECONFIG"
echo "  CTR=$CTR"
echo "  CLOUD_PERSISTED_ASSET_ROOT=$CLOUD_PERSISTED_ASSET_ROOT"
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

export CTR
if [ -n "${CONTAINERD_SOCK:-}" ]; then
  "$SCRIPT_DIR/remote_preflight_guard.sh" --expect-socket "$CONTAINERD_SOCK" >/dev/null
fi
CONTAINERD_SOCK="$("$SCRIPT_DIR/remote_preflight_guard.sh" --print-socket)"
export CONTAINERD_SOCK
echo "  containerd socket: $CONTAINERD_SOCK"

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

echo "  checking single build source ..."
require_single_ui_build_source
echo "  source-of-truth: OK"

SOURCE_REV="$(detect_source_revision)"
echo "  source revision: $SOURCE_REV"

UI_SRC_SERVER="$REPO_DIR/packages/ui-model-demo-server/server.mjs"
UI_SRC_DEMO="$REPO_DIR/packages/ui-model-demo-frontend/src/demo_modeltable.js"
UI_SRC_ADAPTER="$REPO_DIR/packages/ui-model-demo-frontend/src/local_bus_adapter.js"
UI_SRC_REMOTE_STORE="$REPO_DIR/packages/ui-model-demo-frontend/src/remote_store.js"
UI_SRC_RENDERER_MJS="$REPO_DIR/packages/ui-renderer/src/renderer.mjs"
UI_SRC_RENDERER_JS="$REPO_DIR/packages/ui-renderer/src/renderer.js"
UI_SRC_HASH_SERVER="$(sha256_of_file "$UI_SRC_SERVER")"
UI_SRC_HASH_DEMO="$(sha256_of_file "$UI_SRC_DEMO")"
UI_SRC_HASH_ADAPTER="$(sha256_of_file "$UI_SRC_ADAPTER")"
UI_SRC_HASH_REMOTE_STORE="$(sha256_of_file "$UI_SRC_REMOTE_STORE")"
UI_SRC_HASH_RENDERER_MJS="$(sha256_of_file "$UI_SRC_RENDERER_MJS")"
UI_SRC_HASH_RENDERER_JS="$(sha256_of_file "$UI_SRC_RENDERER_JS")"
echo "  source hash server.mjs:         $UI_SRC_HASH_SERVER"
echo "  source hash demo_modeltable.js: $UI_SRC_HASH_DEMO"
echo "  source hash local_bus_adapter:  $UI_SRC_HASH_ADAPTER"
echo "  source hash remote_store.js:    $UI_SRC_HASH_REMOTE_STORE"
echo "  source hash renderer.mjs:       $UI_SRC_HASH_RENDERER_MJS"
echo "  source hash renderer.js:        $UI_SRC_HASH_RENDERER_JS"

echo "All pre-flight checks passed."
echo ""

# ── Ensure namespace ─────────────────────────────────────
echo "=== Step 2: Ensure namespace ==="
ensure_namespace
echo ""

# ── Deploy infrastructure ────────────────────────────────
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
ROOM_ID_RAW="$(create_matrix_room_and_join "$SERVER_TOKEN" "$MBR_TOKEN")"
ROOM_ID="$(extract_matrix_room_id "$ROOM_ID_RAW")"
if ! is_valid_matrix_room_id "$ROOM_ID"; then
  echo "ERROR: failed to parse valid room id from create_matrix_room_and_join output." >&2
  echo "Raw output:" >&2
  printf '%s\n' "$ROOM_ID_RAW" >&2
  exit 1
fi
echo "  Room: $ROOM_ID"
echo ""

# ── Update K8s secrets ────────────────────────────────────
echo "=== Step 5: Update secrets ==="
update_k8s_secrets "$SERVER_TOKEN" "$MBR_TOKEN" "$ROOM_ID"
echo ""

# ── Build images ─────────────────────────────────────────
echo "=== Step 6: Sync authoritative assets ==="
LOCAL_PERSISTED_ASSET_ROOT="$CLOUD_PERSISTED_ASSET_ROOT" bash "$REPO_DIR/scripts/ops/sync_local_persisted_assets.sh"
echo ""

# ── Build images ─────────────────────────────────────────
echo "=== Step 7: Build cloud images ==="
cd "$REPO_DIR"
BUILD_ARGS=()
if [ "$REBUILD" -eq 1 ]; then
  BUILD_ARGS+=(--no-cache)
fi
if [ -n "$UI_IMAGE_TAR" ]; then
  if [ ! -f "$UI_IMAGE_TAR" ]; then
    echo "ERROR: --image-tar file not found: $UI_IMAGE_TAR" >&2
    exit 1
  fi
  echo "  skipping ui-server docker build (using prebuilt tar): $UI_IMAGE_TAR"
else
  docker build "${BUILD_ARGS[@]}" \
    -f k8s/Dockerfile.ui-server \
    --label "org.opencontainers.image.revision=$SOURCE_REV" \
    --label "io.dongyu.source.sha256.server_mjs=$UI_SRC_HASH_SERVER" \
    --label "io.dongyu.source.sha256.demo_modeltable=$UI_SRC_HASH_DEMO" \
    --label "io.dongyu.source.sha256.local_bus_adapter=$UI_SRC_HASH_ADAPTER" \
    -t dy-ui-server:v1 .
fi
docker build "${BUILD_ARGS[@]}" \
  -f k8s/Dockerfile.mbr-worker \
  --label "org.opencontainers.image.revision=$SOURCE_REV" \
  -t dy-mbr-worker:v2 .
docker build "${BUILD_ARGS[@]}" \
  -f k8s/Dockerfile.remote-worker \
  --label "org.opencontainers.image.revision=$SOURCE_REV" \
  -t dy-remote-worker:v3 .
docker build "${BUILD_ARGS[@]}" \
  -f k8s/Dockerfile.ui-side-worker \
  --label "org.opencontainers.image.revision=$SOURCE_REV" \
  -t dy-ui-side-worker:v1 .
echo ""

# ── Import images to rke2 containerd ─────────────────────
echo "=== Step 8: Import images to rke2 containerd ==="
if [ -n "$UI_IMAGE_TAR" ]; then
  "$CTR" --address "$CONTAINERD_SOCK" -n k8s.io images import "$UI_IMAGE_TAR"
else
  docker save dy-ui-server:v1 | "$CTR" --address "$CONTAINERD_SOCK" -n k8s.io images import -
fi
docker save dy-mbr-worker:v2 | "$CTR" --address "$CONTAINERD_SOCK" -n k8s.io images import -
docker save dy-remote-worker:v3 | "$CTR" --address "$CONTAINERD_SOCK" -n k8s.io images import -
docker save dy-ui-side-worker:v1 | "$CTR" --address "$CONTAINERD_SOCK" -n k8s.io images import -
echo "  Images imported."
echo ""

# ── Apply manifests (with placeholder replacement) ───────
echo "=== Step 9: Apply manifests ==="
patch_manifest "$REPO_DIR/k8s/cloud/workers.yaml" "$ROOM_ID" "$SERVER_PASSWORD"
kubectl apply -f "$REPO_DIR/k8s/cloud/ui-side-worker.yaml"

# Also patch mbr-update.yaml if it exists
if [ -f "$REPO_DIR/k8s/cloud/mbr-update.yaml" ]; then
  ROOM_ID_ESCAPED="$(escape_sed_replacement "$ROOM_ID")"
  MBR_TOKEN_ESCAPED="$(escape_sed_replacement "$MBR_TOKEN")"
  local_tmp=$(mktemp)
  sed -e "s|placeholder-roomid-update-after-synapse-setup|$ROOM_ID_ESCAPED|g" \
      -e "s|placeholder-will-update-after-synapse-setup|$MBR_TOKEN_ESCAPED|g" \
      "$REPO_DIR/k8s/cloud/mbr-update.yaml" > "$local_tmp"
  kubectl apply -f "$local_tmp"
  rm -f "$local_tmp"
fi
echo ""

# ── Cleanup stuck pods ────────────────────────────────────
echo "=== Step 10: Cleanup stuck pods ==="
for deploy in ui-server mbr-worker remote-worker ui-side-worker; do
  STUCK=$(kubectl -n "$NAMESPACE" get pods -l "app=$deploy" --no-headers 2>/dev/null \
    | awk '$3 == "Terminating" {print $1}')
  if [ -n "$STUCK" ]; then
    echo "  Force-deleting stuck pods for $deploy: $STUCK"
    echo "$STUCK" | xargs kubectl -n "$NAMESPACE" delete pod --grace-period=0 --force 2>/dev/null || true
  fi
done
echo ""

# ── Rollout restart ───────────────────────────────────────
echo "=== Step 11: Rollout restart ==="
kubectl -n "$NAMESPACE" rollout restart deployment/ui-server
kubectl -n "$NAMESPACE" rollout restart deployment/mbr-worker
kubectl -n "$NAMESPACE" rollout restart deployment/remote-worker
kubectl -n "$NAMESPACE" rollout restart deployment/ui-side-worker
echo ""

# ── Wait for rollout ─────────────────────────────────────
echo "=== Step 12: Wait for rollout ==="
wait_for_rollout ui-server mbr-worker remote-worker ui-side-worker
echo ""

# ── Verify ────────────────────────────────────────────────
echo "=== Step 13: Verify ==="
verify_pods
echo "--- UI runtime source gate ---"
verify_ui_server_runtime_source_hashes "$UI_SRC_HASH_SERVER" "$UI_SRC_HASH_DEMO" "$UI_SRC_HASH_ADAPTER" "$UI_SRC_HASH_REMOTE_STORE" "$UI_SRC_HASH_RENDERER_MJS" "$UI_SRC_HASH_RENDERER_JS"
verify_ui_prompt_guard_markers
verify_ui_server_snapshot_runtime
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
