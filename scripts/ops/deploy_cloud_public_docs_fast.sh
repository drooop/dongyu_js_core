#!/usr/bin/env bash
# Fast cloud publish path for docs/static-only slide app runtime artifacts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

SSH_USER="${SSH_USER:-}"
SSH_HOST="${SSH_HOST:-}"
REMOTE_REPO="${REMOTE_REPO:-/home/wwpic/dongyuapp}"
REMOTE_REPO_OWNER="${REMOTE_REPO_OWNER:-wwpic}"
REVISION="${REVISION:-}"
CLOUD_DY_PERSIST_ROOT="${CLOUD_DY_PERSIST_ROOT:-/home/wwpic/dongyu/volume/persist/ui-server}"
STATIC_PROJECT_NAME="${STATIC_PROJECT_NAME:-slide-app-runtime-minimal-submit-provider}"
SKIP_SOURCE_SYNC=0

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
    --revision)
      REVISION="${2:?missing value for --revision}"
      shift 2
      ;;
    --cloud-dy-persist-root)
      CLOUD_DY_PERSIST_ROOT="${2:?missing value for --cloud-dy-persist-root}"
      shift 2
      ;;
    --static-project-name)
      STATIC_PROJECT_NAME="${2:?missing value for --static-project-name}"
      shift 2
      ;;
    --skip-source-sync)
      SKIP_SOURCE_SYNC=1
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

if [ -z "$REVISION" ]; then
  REVISION="$(git -C "$REPO_DIR" rev-parse --short HEAD)"
fi

if [ -z "$SSH_USER" ] || [ -z "$SSH_HOST" ] || [ -z "$REMOTE_REPO" ]; then
  echo "Usage: deploy_cloud_public_docs_fast.sh --ssh-user <user> --ssh-host <host> --remote-repo <path> [--revision <git-rev>]" >&2
  exit 1
fi

TARGET="${SSH_USER}@${SSH_HOST}"
RESOLVED_REVISION="$(git -C "$REPO_DIR" rev-parse --short "$REVISION")"

if [ "$SKIP_SOURCE_SYNC" = "0" ]; then
  bash "$SCRIPT_DIR/sync_cloud_source.sh" \
    --ssh-user "$SSH_USER" \
    --ssh-host "$SSH_HOST" \
    --remote-repo "$REMOTE_REPO" \
    --remote-repo-owner "$REMOTE_REPO_OWNER" \
    --revision "$REVISION"
fi

remote_script="
  set -euo pipefail
  test -d '$REMOTE_REPO'
  cd '$REMOTE_REPO'
  current=\"\$(cat .deploy-source-revision 2>/dev/null || git rev-parse --short HEAD)\"
  case '$RESOLVED_REVISION' in
    \"\$current\"*) ;;
    *) case \"\$current\" in '$RESOLVED_REVISION'*) ;; *) echo \"ERROR: remote revision \$current does not match expected $RESOLVED_REVISION\" >&2; exit 1 ;; esac ;;
  esac
  LOCAL_DY_PERSIST_ROOT='$CLOUD_DY_PERSIST_ROOT' STATIC_PROJECT_NAME='$STATIC_PROJECT_NAME' bash scripts/ops/sync_ui_public_docs.sh
  test -f '$CLOUD_DY_PERSIST_ROOT/static_projects/$STATIC_PROJECT_NAME/minimal_submit_app_provider_interactive.html'
  test -f '$CLOUD_DY_PERSIST_ROOT/static_projects/$STATIC_PROJECT_NAME/index.html'
  test -f '$CLOUD_DY_PERSIST_ROOT/docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md'
  sha256sum '$CLOUD_DY_PERSIST_ROOT/static_projects/$STATIC_PROJECT_NAME/minimal_submit_app_provider_interactive.html' | awk '{print \$1}'
"

echo "=== Cloud public docs fast deploy ==="
echo "TARGET=$TARGET"
echo "REMOTE_REPO=$REMOTE_REPO"
echo "REMOTE_REPO_OWNER=$REMOTE_REPO_OWNER"
echo "REVISION=$REVISION"
echo "RESOLVED_REVISION=$RESOLVED_REVISION"
echo "CLOUD_DY_PERSIST_ROOT=$CLOUD_DY_PERSIST_ROOT"
echo "STATIC_PROJECT_NAME=$STATIC_PROJECT_NAME"

quoted="$(printf '%q' "$remote_script")"
ssh "$TARGET" "sudo -n bash -lc $quoted"

echo "=== Cloud public docs fast deploy complete ==="
echo "STATIC_URL=/p/$STATIC_PROJECT_NAME/minimal_submit_app_provider_interactive.html"
