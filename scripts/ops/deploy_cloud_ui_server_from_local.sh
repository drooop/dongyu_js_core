#!/usr/bin/env bash
# Fallback-only helper: build ui-server image locally, copy tar to cloud host, and trigger remote deploy.
# Usage:
#   bash scripts/ops/deploy_cloud_ui_server_from_local.sh
#   bash scripts/ops/deploy_cloud_ui_server_from_local.sh --ssh-user drop --ssh-host dongyudigital.com
# Notes:
# - This is NOT the canonical cloud deploy path after 0183.
# - Canonical path is: sync_cloud_source.sh -> deploy_cloud_full.sh / deploy_cloud_app.sh on the remote host.
# - Keep this helper only for offline or wrapper-constrained fallback scenarios.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

SSH_USER="${SSH_USER:-}"
SSH_HOST="${SSH_HOST:-}"
REMOTE_REPO="${REMOTE_REPO:-/home/wwpic/dongyuapp}"
REMOTE_REPO_OWNER="${REMOTE_REPO_OWNER:-wwpic}"
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
    --remote-repo-owner)
      REMOTE_REPO_OWNER="${2:?missing value for --remote-repo-owner}"
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
echo "MODE=fallback-only"
echo "REPO_DIR=$REPO_DIR"
echo "SOURCE_REV=$SOURCE_REV"
echo "IMAGE_TAG=$IMAGE_TAG"
echo "LOCAL_TAR=$LOCAL_TAR"
echo "REMOTE_TAR=$REMOTE_TAR"
echo "TARGET=${SSH_USER}@${SSH_HOST}"
echo "REMOTE_REPO=$REMOTE_REPO"
echo "REMOTE_REPO_OWNER=$REMOTE_REPO_OWNER"
echo ""

cd "$REPO_DIR"
docker build --no-cache \
  --platform linux/amd64 \
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
  bash "$REPO_DIR/scripts/ops/sync_cloud_source.sh" \
    --ssh-user "$SSH_USER" \
    --ssh-host "$SSH_HOST" \
    --remote-repo "$REMOTE_REPO" \
    --remote-repo-owner "$REMOTE_REPO_OWNER" \
    --revision "$SOURCE_REV"
fi

echo "=== Trigger Remote Deploy ==="
ssh -t "${SSH_USER}@${SSH_HOST}" \
  "sudo DEPLOY_SOURCE_REV=${SOURCE_REV} bash ${REMOTE_REPO}/scripts/ops/deploy_cloud.sh --image-tar ${REMOTE_TAR}"

echo ""
echo "=== Done ==="
echo "Fallback remote deploy executed with local-built image tar."
