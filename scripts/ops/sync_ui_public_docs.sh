#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOCAL_DY_PERSIST_ROOT="${LOCAL_DY_PERSIST_ROOT:-/Users/drop/dongyu/volume/persist/ui-server}"
DOCS_ROOT="${DOCS_ROOT:-$LOCAL_DY_PERSIST_ROOT/docs}"
STATIC_PROJECTS_ROOT="${STATIC_PROJECTS_ROOT:-$LOCAL_DY_PERSIST_ROOT/static_projects}"
STATIC_PROJECT_NAME="${STATIC_PROJECT_NAME:-slide-app-runtime-minimal-submit-provider}"

if [[ -z "$LOCAL_DY_PERSIST_ROOT" || "$LOCAL_DY_PERSIST_ROOT" == "/" ]]; then
  echo "ERROR: invalid LOCAL_DY_PERSIST_ROOT=$LOCAL_DY_PERSIST_ROOT" >&2
  exit 1
fi

SOURCE_DIR="$REPO_DIR/docs/user-guide/slide-app-runtime"
DOC_DEST="$DOCS_ROOT/user-guide/slide-app-runtime"
STATIC_DEST="$STATIC_PROJECTS_ROOT/$STATIC_PROJECT_NAME"

mkdir -p "$DOC_DEST" "$STATIC_DEST"

cp "$SOURCE_DIR/minimal_submit_app_provider_guide.md" "$DOC_DEST/minimal_submit_app_provider_guide.md"
cp "$SOURCE_DIR/minimal_submit_app_provider_visualized.md" "$DOC_DEST/minimal_submit_app_provider_visualized.md"
cp "$SOURCE_DIR/minimal_submit_app_provider_interactive.html" "$STATIC_DEST/index.html"
cp "$SOURCE_DIR/minimal_submit_app_provider_interactive.html" "$STATIC_DEST/minimal_submit_app_provider_interactive.html"
cp "$SOURCE_DIR/minimal_submit_app_provider_guide.md" "$STATIC_DEST/minimal_submit_app_provider_guide.md"
cp "$SOURCE_DIR/minimal_submit_app_provider_visualized.md" "$STATIC_DEST/minimal_submit_app_provider_visualized.md"

echo "[sync-ui-public-docs] docs synced to: $DOC_DEST"
echo "[sync-ui-public-docs] static project synced to: $STATIC_DEST"
