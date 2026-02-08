#!/usr/bin/env bash
set -euo pipefail

K8S_NS="${K8S_NAMESPACE:-default}"
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
check_deploy_ready mbr-worker
check_deploy_ready remote-worker

if kubectl get endpoints remote-worker-svc -n "$K8S_NS" -o jsonpath='{.subsets[0].addresses[0].ip}' >/dev/null 2>&1; then
  echo "[check] PASS remote-worker-svc has endpoint"
else
  echo "[check] FAIL remote-worker-svc has no endpoint"
  FAIL=1
fi

if docker ps --format '{{.Names}}' | grep -qx mosquitto; then
  echo "[check] PASS mosquitto running"
else
  echo "[check] FAIL mosquitto not running"
  FAIL=1
fi

if docker ps --format '{{.Names}}' | grep -qx element-docker-demo-synapse-1; then
  echo "[check] PASS element synapse running"
else
  echo "[check] FAIL element synapse not running"
  FAIL=1
fi

if command -v curl >/dev/null 2>&1; then
  if curl -skf https://matrix.localhost/_matrix/client/versions >/dev/null 2>&1; then
    echo "[check] PASS matrix versions endpoint reachable"
  else
    echo "[check] FAIL matrix versions endpoint unreachable"
    FAIL=1
  fi
fi

if [ "$FAIL" -ne 0 ]; then
  echo "[check] baseline NOT ready"
  exit 1
fi

echo "[check] baseline ready"
