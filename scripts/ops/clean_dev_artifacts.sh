#!/usr/bin/env bash
# clean_dev_artifacts.sh — Remove development debris from project root
# Safe to run anytime. Only deletes gitignored / untracked temp files.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

removed=0

# 1. Root-level media files (gitignored by /*.png etc.)
for ext in png jpg jpeg gif svg webp bmp tiff mp4 mp3 wav; do
  for f in ./*."$ext"; do
    [ -e "$f" ] || continue
    rm -f "$f"
    echo "removed: $f"
    removed=$((removed + 1))
  done
done

# 2. Playwright MCP cache (.playwright-mcp/)
if [ -d .playwright-mcp ]; then
  count=$(find .playwright-mcp -type f | wc -l | tr -d ' ')
  if [ "$count" -gt 0 ]; then
    rm -f .playwright-mcp/*.log .playwright-mcp/*.png
    echo "cleaned: .playwright-mcp/ ($count files)"
    removed=$((removed + count))
  fi
fi

# 3. Playwright test output (output/playwright/)
if [ -d output/playwright ]; then
  count=$(find output/playwright -type f | wc -l | tr -d ' ')
  if [ "$count" -gt 0 ]; then
    rm -f output/playwright/*.png output/playwright/*.jpeg
    echo "cleaned: output/playwright/ ($count files)"
    removed=$((removed + count))
  fi
fi

if [ "$removed" -eq 0 ]; then
  echo "nothing to clean"
else
  echo "done: removed $removed file(s)"
fi
