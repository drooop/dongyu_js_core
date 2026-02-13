#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
K8S_NS="dongyu"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[baseline] missing command: $1" >&2
    exit 1
  fi
}

need_cmd kubectl

echo "[baseline] use kubernetes context docker-desktop"
kubectl config use-context docker-desktop >/dev/null

echo "[baseline] apply k8s/local manifests"
kubectl apply -f "$ROOT_DIR/k8s/local/"

echo "[baseline] wait rollout (timeout 180s each)"
for deploy in mosquitto synapse remote-worker mbr-worker ui-server; do
  if kubectl get deploy "$deploy" -n "$K8S_NS" >/dev/null 2>&1; then
    kubectl rollout status "deploy/$deploy" -n "$K8S_NS" --timeout=180s
  else
    echo "[baseline] WARN: deploy/$deploy not found, skipping"
  fi
done

echo "[baseline] verify pods"
kubectl get pods -n "$K8S_NS" -o wide

echo "[baseline] READY"
