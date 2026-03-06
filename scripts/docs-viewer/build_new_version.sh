#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTENT_SRC="$HOME/Documents/drip/Inbox/new_version/docs"
DIST="$SCRIPT_DIR/dist"
BUILD="$DIST/new-version-specs"
VENDOR="$SCRIPT_DIR/vendor"

# Ordered entries: slug|relative-path
ENTRIES=(
  "architecture_mantanet_and_workers|architecture_mantanet_and_workers.md"
  "runtime_semantics_modeltable_driven|ssot/runtime_semantics_modeltable_driven.md"
  "label_type_registry|ssot/label_type_registry.md"
)

echo "=== Building new-version-specs ==="

# Clean build dir
rm -rf "$BUILD"
mkdir -p "$BUILD" "$VENDOR"

# Download markdown-it if needed
if [ ! -f "$VENDOR/markdown-it.min.js" ]; then
  echo "Downloading markdown-it.min.js ..."
  curl -sL "https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/dist/markdown-it.min.js" \
    -o "$VENDOR/markdown-it.min.js"
  echo "Done."
fi

# Copy viewer assets
cp "$SCRIPT_DIR/index.html" "$BUILD/"
cp "$VENDOR/markdown-it.min.js" "$BUILD/"

# Copy .md files (flatten into build dir) and generate manifest.json
{
  printf '{\n  "title": "万态网规约 (new version draft)",\n  "version": "%s",\n  "docs": [\n' "$(date +%Y-%m-%d)"

  order=0
  for entry in "${ENTRIES[@]}"; do
    slug="${entry%%|*}"
    rel="${entry#*|}"
    src="$CONTENT_SRC/$rel"
    if [ ! -f "$src" ]; then
      echo >&2 "WARNING: $src not found, skipping"
      continue
    fi
    cp "$src" "$BUILD/$slug.md"

    # Extract title from frontmatter (strip surrounding quotes)
    title=$(awk '/^---$/ { if (++c == 2) exit } c == 1 && /^title:/ { sub(/^title: *"?/, ""); sub(/"? *$/, ""); print }' "$src")
    [ -z "$title" ] && title="$slug"

    order=$((order + 1))
    [ "$order" -gt 1 ] && printf ',\n'
    printf '    { "slug": "%s", "title": %s, "order": %d }' \
      "$slug" \
      "$(printf '%s' "$title" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" \
      "$order"
  done

  printf '\n  ]\n}\n'
} > "$BUILD/manifest.json"

# Create ZIP
cd "$BUILD"
rm -f "$DIST/new-version-specs.zip"
zip -rq "$DIST/new-version-specs.zip" .

echo ""
echo "=== Build complete ==="
echo "Output: $DIST/new-version-specs.zip"
echo ""
echo "Local preview:"
echo "  cd $BUILD && python3 -m http.server 8080"
echo "  open http://localhost:8080"
echo ""
echo "Upload:"
echo "  curl -X POST 'https://<server>/api/static/upload?name=new-version-specs&kind=zip' \\"
echo "    --data-binary @$DIST/new-version-specs.zip"
