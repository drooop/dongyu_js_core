#!/usr/bin/env bash
set -euo pipefail

K8S_NS="dongyu"
FAIL=0

check_deploy_ready() {
  local name="$1"
  local ready
  ready="$(kubectl get deploy "$name" -n "$K8S_NS" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  if [ "$ready" != "1" ]; then
    echo "[check] FAIL deploy/$name readyReplicas=$ready (expect 1)"
    FAIL=1
  else
    echo "[check] PASS deploy/$name readyReplicas=1"
  fi
}

echo "[check] kubernetes context: $(kubectl config current-context 2>/dev/null || echo unknown)"

for deploy in mosquitto synapse remote-worker mbr-worker ui-server; do
  check_deploy_ready "$deploy"
done

if [ "$FAIL" -ne 0 ]; then
  echo "[check] baseline NOT ready"
  exit 1
fi

echo "[check] baseline ready"
