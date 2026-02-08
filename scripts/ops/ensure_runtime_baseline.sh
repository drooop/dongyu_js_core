#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ELEMENT_DIR="${ELEMENT_DOCKER_DEMO_DIR:-$ROOT_DIR/../element-docker-demo}"
K8S_NS="${K8S_NAMESPACE:-default}"
MOSQ_CONTAINER="${MOSQUITTO_CONTAINER:-mosquitto}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[baseline] missing command: $1" >&2
    exit 1
  fi
}

need_cmd docker
need_cmd kubectl

if [ ! -f "$ELEMENT_DIR/compose.yml" ]; then
  echo "[baseline] element compose not found: $ELEMENT_DIR/compose.yml" >&2
  exit 1
fi

echo "[baseline] docker compose up: $ELEMENT_DIR/compose.yml"
docker compose -f "$ELEMENT_DIR/compose.yml" up -d

if docker ps --format '{{.Names}}' | grep -qx "$MOSQ_CONTAINER"; then
  echo "[baseline] mosquitto already running"
else
  if docker ps -a --format '{{.Names}}' | grep -qx "$MOSQ_CONTAINER"; then
    echo "[baseline] starting existing mosquitto container"
    docker start "$MOSQ_CONTAINER" >/dev/null
  else
    echo "[baseline] creating mosquitto container"
    docker run -d --name "$MOSQ_CONTAINER" -p 1883:1883 eclipse-mosquitto:2 >/dev/null
  fi
fi

docker update --restart unless-stopped "$MOSQ_CONTAINER" >/dev/null || true

echo "[baseline] use kubernetes context docker-desktop"
kubectl config use-context docker-desktop >/dev/null

echo "[baseline] apply k8s manifests"
kubectl apply -f "$ROOT_DIR/k8s/mbr-worker-config.yaml"
kubectl apply -f "$ROOT_DIR/k8s/mbr-worker-secret.yaml"
kubectl apply -f "$ROOT_DIR/k8s/mbr-worker-deployment.yaml"
kubectl apply -f "$ROOT_DIR/k8s/remote-worker-config.yaml"
kubectl apply -f "$ROOT_DIR/k8s/remote-worker-deployment.yaml"

echo "[baseline] enforce replicas=1"
kubectl scale deploy/mbr-worker deploy/remote-worker -n "$K8S_NS" --replicas=1 >/dev/null

echo "[baseline] wait rollout"
kubectl rollout status deploy/mbr-worker -n "$K8S_NS" --timeout=180s
kubectl rollout status deploy/remote-worker -n "$K8S_NS" --timeout=180s

echo "[baseline] verify endpoints"
kubectl get pods -n "$K8S_NS" -o wide
kubectl get endpoints remote-worker-svc -n "$K8S_NS" -o wide

echo "[baseline] verify docker services"
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'mosquitto|element-docker-demo|k8s_mbr_|k8s_worker_' || true

if ! curl -skf https://matrix.localhost/_matrix/client/versions >/dev/null 2>&1; then
  echo "[baseline] WARN: matrix.localhost versions endpoint not reachable" >&2
fi

echo "[baseline] READY"
