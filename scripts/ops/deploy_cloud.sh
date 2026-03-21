#!/usr/bin/env bash
# Compatibility wrapper. Canonical implementation lives in deploy_cloud_full.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/deploy_cloud_full.sh" "$@"
