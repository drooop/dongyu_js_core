#!/usr/bin/env bash
# Deploy a single app image to the remote rke2 cluster using remote build.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=_deploy_common.sh
source "$SCRIPT_DIR/_deploy_common.sh"

TARGET=""
EXPECTED_REVISION=""
REBUILD=0

while [ $# -gt 0 ]; do
  case "$1" in
    --target)
      TARGET="${2:?missing value for --target}"
      shift 2
      ;;
    --revision)
      EXPECTED_REVISION="${2:?missing value for --revision}"
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

if [ -z "$TARGET" ]; then
  echo "ERROR: --target is required (ui-server|mbr-worker|remote-worker|ui-side-worker)" >&2
  exit 1
fi

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

detect_source_revision() {
  if [ -n "$EXPECTED_REVISION" ]; then
    printf '%s' "$EXPECTED_REVISION"
    return 0
  fi
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
  echo "ERROR: cannot detect source revision" >&2
  return 1
}

find_running_pod() {
  local app="$1"
  kubectl -n "$NAMESPACE" get pods -l "app=${app}" --no-headers 2>/dev/null \
    | awk '$2 ~ /^[0-9]+\/[0-9]+$/ && $3 == "Running" {print $1; exit}'
}

exec_in_running_pod() {
  local app="$1"
  local command="$2"
  local purpose="${3:-pod exec}"
  local attempt=1
  local pod out
  while [ $attempt -le 8 ]; do
    pod="$(find_running_pod "$app")"
    if [ -n "$pod" ]; then
      if out="$(kubectl -n "$NAMESPACE" exec "$pod" -- sh -lc "$command" 2>&1)"; then
        printf '%s' "$out"
        return 0
      fi
      echo "WARN: ${purpose} failed on pod ${pod} (attempt ${attempt}/8): ${out}" >&2
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  echo "ERROR: ${purpose} failed" >&2
  return 1
}

container_file_sha256() {
  local app="$1"
  local path="$2"
  exec_in_running_pod "$app" "
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum '$path' | awk '{print \$1}'
    elif command -v shasum >/dev/null 2>&1; then
      shasum -a 256 '$path' | awk '{print \$1}'
    else
      echo 'missing sha256sum/shasum' >&2
      exit 2
    fi
  " "sha256 for $path"
}

load_target_spec() {
  case "$TARGET" in
    ui-server)
      IMAGE_TAG="dy-ui-server:v1"
      DOCKERFILE="k8s/Dockerfile.ui-server"
      DEPLOYMENT="ui-server"
      APP_LABEL="ui-server"
      LOCAL_FILES=(
        "packages/ui-model-demo-server/server.mjs:/app/packages/ui-model-demo-server/server.mjs"
        "packages/ui-model-demo-frontend/src/demo_modeltable.js:/app/packages/ui-model-demo-frontend/src/demo_modeltable.js"
        "packages/ui-model-demo-frontend/src/local_bus_adapter.js:/app/packages/ui-model-demo-frontend/src/local_bus_adapter.js"
        "packages/ui-model-demo-frontend/src/remote_store.js:/app/packages/ui-model-demo-frontend/src/remote_store.js"
        "packages/ui-renderer/src/renderer.mjs:/app/packages/ui-renderer/src/renderer.mjs"
        "packages/ui-renderer/src/renderer.js:/app/packages/ui-renderer/src/renderer.js"
      )
      ;;
    mbr-worker)
      IMAGE_TAG="dy-mbr-worker:v2"
      DOCKERFILE="k8s/Dockerfile.mbr-worker"
      DEPLOYMENT="mbr-worker"
      APP_LABEL="mbr-worker"
      LOCAL_FILES=(
        "scripts/run_worker_v0.mjs:/app/scripts/run_worker_v0.mjs"
        "packages/worker-base/src/runtime.js:/app/packages/worker-base/src/runtime.js"
        "packages/worker-base/src/runtime.mjs:/app/packages/worker-base/src/runtime.mjs"
        "packages/worker-base/src/persisted_asset_loader.mjs:/app/packages/worker-base/src/persisted_asset_loader.mjs"
      )
      ;;
    remote-worker)
      IMAGE_TAG="dy-remote-worker:v3"
      DOCKERFILE="k8s/Dockerfile.remote-worker"
      DEPLOYMENT="remote-worker"
      APP_LABEL="remote-worker"
      LOCAL_FILES=(
        "scripts/run_worker_remote_v1.mjs:/app/scripts/run_worker_remote_v1.mjs"
        "packages/worker-base/src/runtime.js:/app/packages/worker-base/src/runtime.js"
        "packages/worker-base/src/runtime.mjs:/app/packages/worker-base/src/runtime.mjs"
        "packages/worker-base/src/persisted_asset_loader.mjs:/app/packages/worker-base/src/persisted_asset_loader.mjs"
      )
      ;;
    ui-side-worker)
      IMAGE_TAG="dy-ui-side-worker:v1"
      DOCKERFILE="k8s/Dockerfile.ui-side-worker"
      DEPLOYMENT="ui-side-worker"
      APP_LABEL="ui-side-worker"
      LOCAL_FILES=(
        "scripts/run_worker_ui_side_v0.mjs:/app/scripts/run_worker_ui_side_v0.mjs"
        "packages/worker-base/src/runtime.js:/app/packages/worker-base/src/runtime.js"
        "packages/worker-base/src/runtime.mjs:/app/packages/worker-base/src/runtime.mjs"
        "packages/worker-base/src/persisted_asset_loader.mjs:/app/packages/worker-base/src/persisted_asset_loader.mjs"
      )
      ;;
    *)
      echo "ERROR: unsupported target '$TARGET' (expected ui-server|mbr-worker|remote-worker|ui-side-worker)" >&2
      exit 1
      ;;
  esac
}

verify_target_source_hashes() {
  local pair local_path container_path expected actual
  for pair in "${LOCAL_FILES[@]}"; do
    local_path="${pair%%:*}"
    container_path="${pair#*:}"
    expected="$(sha256_of_file "$REPO_DIR/$local_path")"
    actual="$(container_file_sha256 "$APP_LABEL" "$container_path")"
    echo "  hash ${local_path} local=${expected} pod=${actual}"
    if [ "$expected" != "$actual" ]; then
      echo "ERROR: source hash mismatch for $local_path" >&2
      return 1
    fi
  done
}

load_target_spec

echo "=== Cloud App Deploy ==="
echo "TARGET=$TARGET"
echo "REPO_DIR=$REPO_DIR"

if [ -f "$REPO_DIR/deploy/env/cloud.env" ]; then
  load_env "$REPO_DIR/deploy/env/cloud.env"
else
  echo "WARN: cloud.env not found; using app-deploy defaults only"
  export NAMESPACE="${NAMESPACE:-dongyu}"
fi
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/rke2/rke2.yaml}"
CTR="${CTR:-/usr/local/bin/ctr}"
export CTR
if [ -n "${CONTAINERD_SOCK:-}" ]; then
  "$SCRIPT_DIR/remote_preflight_guard.sh" --expect-socket "$CONTAINERD_SOCK" >/dev/null
fi
CONTAINERD_SOCK="$("$SCRIPT_DIR/remote_preflight_guard.sh" --print-socket)"
export CONTAINERD_SOCK

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: must run as root (sudo)." >&2
  exit 1
fi

SOURCE_REV="$(detect_source_revision)"
if [ -n "$EXPECTED_REVISION" ]; then
  case "$SOURCE_REV" in
    "$EXPECTED_REVISION"*) ;;
    *)
      echo "ERROR: current repo revision $SOURCE_REV does not match expected $EXPECTED_REVISION" >&2
      exit 1
      ;;
  esac
fi
echo "SOURCE_REV=$SOURCE_REV"

cd "$REPO_DIR"
BUILD_ARGS=()
if [ "$REBUILD" -eq 1 ]; then
  BUILD_ARGS+=(--no-cache)
fi

docker build "${BUILD_ARGS[@]}" \
  -f "$DOCKERFILE" \
  --label "org.opencontainers.image.revision=$SOURCE_REV" \
  -t "$IMAGE_TAG" .

docker save "$IMAGE_TAG" | "$CTR" --address "$CONTAINERD_SOCK" -n k8s.io images import -

kubectl -n "$NAMESPACE" rollout restart "deployment/${DEPLOYMENT}"
wait_for_rollout "$DEPLOYMENT"

echo "--- Target source gate ---"
verify_target_source_hashes

echo "=== Cloud app deploy complete ==="
echo "TARGET=$TARGET"
echo "DEPLOYMENT=$DEPLOYMENT"
echo "SOURCE_REV=$SOURCE_REV"
