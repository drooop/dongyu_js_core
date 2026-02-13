#!/usr/bin/env bash
# Ensure runtime baseline: if all 5 deployments are ready, exit early.
# Otherwise, auto-invoke deploy_local.sh to bring up the stack.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_NS="dongyu"
DEPLOYMENTS=(mosquitto synapse remote-worker mbr-worker ui-server)

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[baseline] missing command: $1" >&2
    exit 1
  fi
}

need_cmd kubectl

# Switch to docker-desktop context
echo "[baseline] use kubernetes context docker-desktop"
kubectl config use-context docker-desktop >/dev/null

# ── Smart detection: check if all 5 deployments are ready ─
echo "[baseline] checking deployment readiness..."
ALL_READY=true
for deploy in "${DEPLOYMENTS[@]}"; do
  ready=$(kubectl get deploy "$deploy" -n "$K8S_NS" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)
  if [ "$ready" != "1" ]; then
    echo "[baseline] deploy/$deploy not ready (readyReplicas=$ready)"
    ALL_READY=false
  else
    echo "[baseline] deploy/$deploy ready"
  fi
done

if [ "$ALL_READY" = true ]; then
  echo "[baseline] all deployments ready — nothing to do"
  exit 0
fi

# ── Not all ready: check if deploy_local.sh can be used ──
echo ""
echo "[baseline] some deployments missing or not ready"

if [ -f "$SCRIPT_DIR/deploy_local.sh" ] && [ -f "$(cd "$SCRIPT_DIR/../.." && pwd)/deploy/env/local.env" ]; then
  echo "[baseline] auto-invoking deploy_local.sh ..."
  bash "$SCRIPT_DIR/deploy_local.sh"
else
  echo "[baseline] deploy_local.sh or deploy/env/local.env not found"
  echo "[baseline] falling back to simple kubectl apply..."
  ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

  kubectl apply -f "$ROOT_DIR/k8s/local/"

  echo "[baseline] wait rollout (timeout 180s each)"
  for deploy in "${DEPLOYMENTS[@]}"; do
    if kubectl get deploy "$deploy" -n "$K8S_NS" >/dev/null 2>&1; then
      kubectl rollout status "deploy/$deploy" -n "$K8S_NS" --timeout=180s
    else
      echo "[baseline] WARN: deploy/$deploy not found, skipping"
    fi
  done
fi

echo "[baseline] verify pods"
kubectl get pods -n "$K8S_NS" -o wide

echo "[baseline] READY"
