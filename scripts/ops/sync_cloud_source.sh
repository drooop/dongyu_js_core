#!/usr/bin/env bash
# Sync the requested repository revision to the remote cloud host.
# Canonical path for 0183: remote source sync first, then remote build.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

SSH_USER="${SSH_USER:-}"
SSH_HOST="${SSH_HOST:-}"
REMOTE_REPO="${REMOTE_REPO:-/home/wwpic/dongyuapp}"
REVISION="${REVISION:-}"
REMOTE_REPO_OWNER="${REMOTE_REPO_OWNER:-wwpic}"

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
    --revision)
      REVISION="${2:?missing value for --revision}"
      shift 2
      ;;
    --remote-repo-owner)
      REMOTE_REPO_OWNER="${2:?missing value for --remote-repo-owner}"
      shift 2
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$SSH_USER" ] || [ -z "$SSH_HOST" ] || [ -z "$REVISION" ]; then
  echo "Usage: sync_cloud_source.sh --ssh-user <user> --ssh-host <host> --remote-repo <path> --revision <git-rev> [--remote-repo-owner <user>]" >&2
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ERROR: ssh not found" >&2
  exit 1
fi

TARGET="${SSH_USER}@${SSH_HOST}"

echo "=== Cloud Source Sync ==="
echo "TARGET=$TARGET"
echo "REMOTE_REPO=$REMOTE_REPO"
echo "REMOTE_REPO_OWNER=$REMOTE_REPO_OWNER"
echo "REVISION=$REVISION"

ssh "$TARGET" "mkdir -p '$REMOTE_REPO'"

if ssh "$TARGET" "test -d '$REMOTE_REPO/.git'"; then
  ssh "$TARGET" "
    set -euo pipefail
    if [ \"\$(stat -c '%U' '$REMOTE_REPO')\" = '$REMOTE_REPO_OWNER' ] && command -v sudo >/dev/null 2>&1; then
      sudo -u '$REMOTE_REPO_OWNER' git -C '$REMOTE_REPO' config --global --add safe.directory '$REMOTE_REPO' >/dev/null 2>&1 || true
      sudo -u '$REMOTE_REPO_OWNER' git -C '$REMOTE_REPO' fetch --all --tags
      sudo -u '$REMOTE_REPO_OWNER' git -C '$REMOTE_REPO' checkout --force '$REVISION'
      sudo -u '$REMOTE_REPO_OWNER' git -C '$REMOTE_REPO' reset --hard '$REVISION'
      sudo -u '$REMOTE_REPO_OWNER' git -C '$REMOTE_REPO' clean -fd
      sudo -u '$REMOTE_REPO_OWNER' git -C '$REMOTE_REPO' rev-parse --short HEAD
    else
      git -C '$REMOTE_REPO' config --global --add safe.directory '$REMOTE_REPO' >/dev/null 2>&1 || true
      git -C '$REMOTE_REPO' fetch --all --tags
      git -C '$REMOTE_REPO' checkout --force '$REVISION'
      git -C '$REMOTE_REPO' reset --hard '$REVISION'
      git -C '$REMOTE_REPO' clean -fd
      git -C '$REMOTE_REPO' rev-parse --short HEAD
    fi
  "
else
  echo "WARN: remote repo is not a git worktree; using git archive fallback"
  git -C "$REPO_DIR" rev-parse --verify "$REVISION" >/dev/null 2>&1
  git -C "$REPO_DIR" archive "$REVISION" | ssh "$TARGET" "
    set -euo pipefail
    mkdir -p '$REMOTE_REPO'
    find '$REMOTE_REPO' -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
    tar -xf - -C '$REMOTE_REPO'
    printf '%s\n' '$REVISION' > '$REMOTE_REPO/.deploy-source-revision'
    cat '$REMOTE_REPO/.deploy-source-revision'
  "
fi
