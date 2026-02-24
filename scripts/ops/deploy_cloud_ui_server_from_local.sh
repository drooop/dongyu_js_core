#!/usr/bin/env bash
# Build ui-server image locally, copy tar to cloud host, and trigger remote deploy script.
# Usage:
#   bash scripts/ops/deploy_cloud_ui_server_from_local.sh
#   bash scripts/ops/deploy_cloud_ui_server_from_local.sh --ssh-user wwpic --ssh-host 124.71.43.80
# Notes:
# - Remote side still runs scripts/ops/deploy_cloud.sh (requires sudo on remote host).
# - This script avoids remote source drift by making local build artifact the deployment source.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

SSH_USER="${SSH_USER:-}"
SSH_HOST="${SSH_HOST:-}"
REMOTE_REPO="${REMOTE_REPO:-/home/wwpic/dongyuapp}"
IMAGE_TAG="${IMAGE_TAG:-dy-ui-server:v1}"
SKIP_REMOTE_SYNC=0

while [ $# -gt 0 ]; do
  case "$1" in
    --ssh-user)
      SSH_USER="${2:?missing value for --ssh-user}"
      shift 2
      ;;
    --ssh-host)
      SSH_HOST="${2:?missing value for --ssh-host}"
      shift 2
      ;;
    --remote-repo)
      REMOTE_REPO="${2:?missing value for --remote-repo}"
      shift 2
      ;;
    --image-tag)
      IMAGE_TAG="${2:?missing value for --image-tag}"
      shift 2
      ;;
    --skip-remote-sync)
      SKIP_REMOTE_SYNC=1
      shift
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$SSH_USER" ] || [ -z "$SSH_HOST" ]; then
  CLOUD_ENV="$REPO_DIR/deploy/env/cloud.env"
  if [ -f "$CLOUD_ENV" ]; then
    # shellcheck disable=SC1090
    source "$CLOUD_ENV"
  fi
fi

if [ -z "$SSH_USER" ] || [ -z "$SSH_HOST" ]; then
  echo "ERROR: missing SSH target. Provide --ssh-user/--ssh-host or set deploy/env/cloud.env." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found on local machine." >&2
  exit 1
fi
if ! command -v ssh >/dev/null 2>&1 || ! command -v scp >/dev/null 2>&1; then
  echo "ERROR: ssh/scp not found on local machine." >&2
  exit 1
fi

if [ ! -f "$REPO_DIR/k8s/Dockerfile.ui-server" ]; then
  echo "ERROR: canonical Dockerfile missing: $REPO_DIR/k8s/Dockerfile.ui-server" >&2
  exit 1
fi

if [ -d "$REPO_DIR/.git" ] && git -C "$REPO_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  SOURCE_REV="$(git -C "$REPO_DIR" rev-parse --short HEAD)"
else
  SOURCE_REV="no-git-$(date +%Y%m%d%H%M%S)"
fi

LOCAL_TAR="/tmp/dy-ui-server-${SOURCE_REV}.tar"
REMOTE_TAR="/tmp/dy-ui-server-${SOURCE_REV}.tar"

echo "=== Local Build ==="
echo "REPO_DIR=$REPO_DIR"
echo "SOURCE_REV=$SOURCE_REV"
echo "IMAGE_TAG=$IMAGE_TAG"
echo "LOCAL_TAR=$LOCAL_TAR"
echo "REMOTE_TAR=$REMOTE_TAR"
echo "TARGET=${SSH_USER}@${SSH_HOST}"
echo ""

cd "$REPO_DIR"
docker build --no-cache \
  -f k8s/Dockerfile.ui-server \
  --label "org.opencontainers.image.revision=$SOURCE_REV" \
  -t "$IMAGE_TAG" .
docker save -o "$LOCAL_TAR" "$IMAGE_TAG"
ls -lh "$LOCAL_TAR"
echo ""

echo "=== Upload Artifact ==="
scp "$LOCAL_TAR" "${SSH_USER}@${SSH_HOST}:${REMOTE_TAR}"

if [ "$SKIP_REMOTE_SYNC" -eq 0 ]; then
  echo "=== Sync Canonical Deploy Files ==="
  ssh "${SSH_USER}@${SSH_HOST}" \
    "mkdir -p ${REMOTE_REPO}/scripts/ops ${REMOTE_REPO}/k8s/cloud ${REMOTE_REPO}/packages/ui-model-demo-server ${REMOTE_REPO}/packages/ui-model-demo-frontend/src"
  scp "$REPO_DIR/scripts/ops/deploy_cloud.sh" "${SSH_USER}@${SSH_HOST}:${REMOTE_REPO}/scripts/ops/deploy_cloud.sh"
  scp "$REPO_DIR/scripts/ops/remote_preflight_guard.sh" "${SSH_USER}@${SSH_HOST}:${REMOTE_REPO}/scripts/ops/remote_preflight_guard.sh"
  scp "$REPO_DIR/k8s/cloud/workers.yaml" "${SSH_USER}@${SSH_HOST}:${REMOTE_REPO}/k8s/cloud/workers.yaml"
  scp "$REPO_DIR/k8s/Dockerfile.ui-server" "${SSH_USER}@${SSH_HOST}:${REMOTE_REPO}/k8s/Dockerfile.ui-server"
  scp "$REPO_DIR/packages/ui-model-demo-server/server.mjs" "${SSH_USER}@${SSH_HOST}:${REMOTE_REPO}/packages/ui-model-demo-server/server.mjs"
  scp "$REPO_DIR/packages/ui-model-demo-frontend/src/demo_modeltable.js" "${SSH_USER}@${SSH_HOST}:${REMOTE_REPO}/packages/ui-model-demo-frontend/src/demo_modeltable.js"
  scp "$REPO_DIR/packages/ui-model-demo-frontend/src/local_bus_adapter.js" "${SSH_USER}@${SSH_HOST}:${REMOTE_REPO}/packages/ui-model-demo-frontend/src/local_bus_adapter.js"
  # Keep legacy shadow copies aligned to satisfy drift gate when they exist.
  scp "$REPO_DIR/k8s/Dockerfile.ui-server" "${SSH_USER}@${SSH_HOST}:${REMOTE_REPO}/Dockerfile.ui-server"
  scp "$REPO_DIR/k8s/cloud/workers.yaml" "${SSH_USER}@${SSH_HOST}:${REMOTE_REPO}/workers.yaml"
fi

echo "=== Trigger Remote Deploy ==="
ssh -t "${SSH_USER}@${SSH_HOST}" \
  "sudo bash ${REMOTE_REPO}/scripts/ops/deploy_cloud.sh --image-tar ${REMOTE_TAR}"

echo ""
echo "=== Done ==="
echo "Remote deploy script executed with local-built image tar."
