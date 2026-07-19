#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
K8S_NS="dongyu"
DEPLOYMENTS=(mosquitto synapse remote-worker workspace-manager mbr-worker ui-server)
EXPECTED_CONTEXT="orbstack"
FORCE_REBUILD=0

usage() {
  echo "Usage: bash scripts/ops/ensure_runtime_baseline.sh [--force-rebuild]"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --force-rebuild)
      FORCE_REBUILD=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[baseline] unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for command in kubectl docker; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "[baseline] missing command: $command" >&2
    exit 1
  fi
done

CURRENT_K8S_CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
CURRENT_DOCKER_CONTEXT="$(docker context show 2>/dev/null || true)"
if [ "$CURRENT_K8S_CONTEXT" != "$EXPECTED_CONTEXT" ]; then
  echo "[baseline] kubernetes context must be $EXPECTED_CONTEXT (got ${CURRENT_K8S_CONTEXT:-unknown})" >&2
  exit 1
fi
if [ "$CURRENT_DOCKER_CONTEXT" != "$EXPECTED_CONTEXT" ]; then
  echo "[baseline] docker context must be $EXPECTED_CONTEXT (got ${CURRENT_DOCKER_CONTEXT:-unknown})" >&2
  exit 1
fi

deploy_once() {
  if [ ! -f "$ROOT_DIR/deploy/env/local.env" ]; then
    echo "[baseline] deploy/env/local.env not found" >&2
    exit 1
  fi
  SKIP_IMAGE_BUILD=0 bash "$SCRIPT_DIR/deploy_local.sh"
}

if [ "$FORCE_REBUILD" -eq 1 ]; then
  echo "[baseline] force rebuild requested"
  deploy_once
  bash "$SCRIPT_DIR/check_runtime_baseline.sh"
  echo "[baseline] READY"
  exit 0
fi

if bash "$SCRIPT_DIR/check_runtime_baseline.sh"; then
  echo "[baseline] baseline already healthy"
  exit 0
fi

echo "[baseline] baseline unhealthy; running one local repair deploy"
deploy_once
bash "$SCRIPT_DIR/check_runtime_baseline.sh"
echo "[baseline] READY"
