#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK_PATH_REL=".githooks"
HOOK_FILE="$REPO_ROOT/.githooks/pre-commit"

if [ ! -f "$HOOK_FILE" ]; then
  echo "[hooks] missing hook file: $HOOK_FILE" >&2
  exit 1
fi

if [ "${1:-}" = "--dry-run" ]; then
  echo "[hooks] dry-run"
  echo "[hooks] would run: git -C $REPO_ROOT config core.hooksPath $HOOK_PATH_REL"
  echo "[hooks] would run: chmod +x $HOOK_FILE"
  exit 0
fi

git -C "$REPO_ROOT" config core.hooksPath "$HOOK_PATH_REL"
chmod +x "$HOOK_FILE"

echo "[hooks] installed"
echo "[hooks] core.hooksPath=$(git -C "$REPO_ROOT" config --get core.hooksPath)"
echo "[hooks] pre-commit=$HOOK_FILE"
