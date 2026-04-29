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

if [ -z "$SSH_USER" ] || [ -z "$SSH_HOST" ]; then
  CLOUD_ENV="$REPO_DIR/deploy/env/cloud.env"
  if [ -f "$CLOUD_ENV" ]; then
    # shellcheck disable=SC1090
    source "$CLOUD_ENV"
  fi
fi

if [ -z "$SSH_USER" ] || [ -z "$SSH_HOST" ] || [ -z "$REVISION" ]; then
  echo "Usage: sync_cloud_source.sh --ssh-user <user> --ssh-host <host> --remote-repo <path> --revision <git-rev> [--remote-repo-owner <user>]" >&2
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ERROR: ssh not found" >&2
  exit 1
fi

TARGET="${SSH_USER}@${SSH_HOST}"
RESOLVED_REVISION="$(git -C "$REPO_DIR" rev-parse --short "$REVISION")"
DEPLOY_ARCHIVE_PATHS=(
  "package.json"
  "package-lock.json"
  "bun.lock"
  "CLAUDE.md"
  "AGENTS.md"
  "README.md"
  "CODEX_HANDOFF_MODE.md"
  "packages"
  "scripts/ops"
  "scripts/run_worker_v0.mjs"
  "scripts/run_worker_remote_v1.mjs"
  "scripts/run_worker_ui_side_v0.mjs"
  "scripts/worker_engine_v0.mjs"
  "deploy/sys-v1ns"
  "deploy/env/.gitkeep"
  "deploy/env/cloud.env.example"
  "deploy/env/local.env.example"
  "k8s"
)

run_remote_repo_command() {
  local script="$1"
  local quoted
  quoted="$(printf '%q' "$script")"
  if [ "$SSH_USER" = "$REMOTE_REPO_OWNER" ]; then
    ssh "$TARGET" "bash -lc $quoted"
  else
    ssh "$TARGET" "sudo -n -u '$REMOTE_REPO_OWNER' bash -lc $quoted"
  fi
}

echo "=== Cloud Source Sync ==="
echo "TARGET=$TARGET"
echo "REMOTE_REPO=$REMOTE_REPO"
echo "REMOTE_REPO_OWNER=$REMOTE_REPO_OWNER"
echo "REVISION=$REVISION"
echo "RESOLVED_REVISION=$RESOLVED_REVISION"

run_remote_repo_command "mkdir -p '$REMOTE_REPO'"

git_archive_fallback() {
  git -C "$REPO_DIR" rev-parse --verify "$REVISION" >/dev/null 2>&1
  echo "ARCHIVE_PATHS=${DEPLOY_ARCHIVE_PATHS[*]}"
  git -C "$REPO_DIR" archive "$REVISION" -- "${DEPLOY_ARCHIVE_PATHS[@]}" | run_remote_repo_command "
    set -euo pipefail
    mkdir -p '$REMOTE_REPO'
    archive_tmp=\"\$(mktemp -d)\"
    trap 'rm -rf \"\$archive_tmp\"' EXIT
    tar -xf - -C \"\$archive_tmp\"
    find '$REMOTE_REPO' -mindepth 1 -maxdepth 1 ! -name '.git' ! -name 'deploy' -exec rm -rf {} +
    find '$REMOTE_REPO/deploy' -mindepth 1 -maxdepth 1 ! -name 'env' -exec rm -rf {} + 2>/dev/null || true
    cp -a \"\$archive_tmp\"/. '$REMOTE_REPO'/
    rm -rf '$REMOTE_REPO/deploy/env'/.gitkeep 2>/dev/null || true
    printf '%s\n' '$RESOLVED_REVISION' > '$REMOTE_REPO/.deploy-source-revision'
    cat '$REMOTE_REPO/.deploy-source-revision'
  "
}

if run_remote_repo_command "test -d '$REMOTE_REPO/.git'"; then
  if ! run_remote_repo_command "
    set -euo pipefail
    git -C '$REMOTE_REPO' config --global --add safe.directory '$REMOTE_REPO' >/dev/null 2>&1 || true
    git -C '$REMOTE_REPO' fetch --all --tags || true
    git -C '$REMOTE_REPO' checkout --force '$REVISION'
    git -C '$REMOTE_REPO' reset --hard '$REVISION'
    git -C '$REMOTE_REPO' clean -fd
    git -C '$REMOTE_REPO' rev-parse --short HEAD > '$REMOTE_REPO/.deploy-source-revision'
    cat '$REMOTE_REPO/.deploy-source-revision'
  "; then
    echo "WARN: remote git checkout failed; falling back to git archive sync"
    git_archive_fallback
  fi
else
  echo "WARN: remote repo is not a git worktree; using git archive fallback"
  git_archive_fallback
fi
