#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTENT_SRC="$HOME/Documents/drip/Resources/software-worker"
DIST="$SCRIPT_DIR/dist"
BUILD="$DIST/sw-docs"
VENDOR="$SCRIPT_DIR/vendor"

# Ordered slug list (semantic reading order)
SLUGS=(
  modeltable-driven-paradigm
  structural-declaration-side-effect
  software-worker-and-worker-base
  fill-table-paradigm
  three-layer-connection
  dual-bus-decoupling
  four-loop-control-model
  app-as-os
)

echo "=== Building sw-docs ==="

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

# Copy .md files and generate manifest.json
{
  printf '{\n  "title": "云海流概念体系",\n  "version": "%s",\n  "docs": [\n' "$(date +%Y-%m-%d)"

  order=0
  for slug in "${SLUGS[@]}"; do
    src="$CONTENT_SRC/$slug.md"
    if [ ! -f "$src" ]; then
      echo >&2 "WARNING: $src not found, skipping"
      continue
    fi
    cp "$src" "$BUILD/"

    # Extract title from frontmatter
    title=$(awk '/^---$/ { if (++c == 2) exit } c == 1 && /^title:/ { sub(/^title: */, ""); print }' "$src")
    [ -z "$title" ] && title="$slug"

    order=$((order + 1))
    [ "$order" -gt 1 ] && printf ',\n'
    printf '    { "slug": "%s", "title": "%s", "order": %d }' "$slug" "$title" "$order"
  done

  printf '\n  ]\n}\n'
} > "$BUILD/manifest.json"

# Create ZIP (flat, no wrapping directory — server extracts directly into project dir)
cd "$BUILD"
rm -f "$DIST/sw-docs.zip"
zip -rq "$DIST/sw-docs.zip" .

echo ""
echo "=== Build complete ==="
echo "Output: $DIST/sw-docs.zip"
echo ""
echo "Local preview:"
echo "  cd $BUILD && python3 -m http.server 8080"
echo "  open http://localhost:8080"
echo ""
echo "Upload:"
echo "  curl -X POST 'https://<server>/api/static/upload?name=sw-docs&kind=zip' \\"
echo "    --data-binary @$DIST/sw-docs.zip"
