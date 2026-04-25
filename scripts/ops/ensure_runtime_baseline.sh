#!/usr/bin/env bash
# Ensure runtime baseline: if all required deployments are ready, exit early.
# Otherwise, auto-invoke deploy_local.sh to bring up the stack.
# Context resolution:
# 1) explicit env K8S_CONTEXT
# 2) deploy/env/local.env K8S_CONTEXT
# 3) kubectl current-context
# If chosen context is unreachable, fallback to current-context once.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
K8S_NS="dongyu"
DEPLOYMENTS=(mosquitto synapse remote-worker mbr-worker ui-server ui-side-worker)

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[baseline] missing command: $1" >&2
    exit 1
  fi
}

need_cmd kubectl

resolve_local_env_context() {
  local env_file="$ROOT_DIR/deploy/env/local.env"
  if [ ! -f "$env_file" ]; then
    return 0
  fi
  grep -E '^[[:space:]]*K8S_CONTEXT=' "$env_file" \
    | tail -n 1 \
    | cut -d '=' -f 2- \
    | tr -d "\"'" \
    | xargs
}

CURRENT_CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
LOCAL_ENV_CONTEXT="$(resolve_local_env_context || true)"
TARGET_CONTEXT="${K8S_CONTEXT:-${LOCAL_ENV_CONTEXT:-${CURRENT_CONTEXT:-}}}"

declare -a CONTEXT_CANDIDATES=()
append_context_candidate() {
  local candidate="$1"
  [ -z "${candidate:-}" ] && return 0
  for existing in "${CONTEXT_CANDIDATES[@]-}"; do
    if [ "$existing" = "$candidate" ]; then
      return 0
    fi
  done
  CONTEXT_CANDIDATES+=("$candidate")
}

append_context_candidate "${K8S_CONTEXT:-}"
append_context_candidate "$LOCAL_ENV_CONTEXT"
append_context_candidate "$CURRENT_CONTEXT"
while IFS= read -r ctx; do
  append_context_candidate "$ctx"
done < <(kubectl config get-contexts -o name 2>/dev/null || true)

if [ "${#CONTEXT_CANDIDATES[@]}" -eq 0 ]; then
  echo "[baseline] cannot determine kubernetes context (set K8S_CONTEXT or configure kubectl contexts)" >&2
  exit 1
fi

TARGET_CONTEXT=""
for ctx in "${CONTEXT_CANDIDATES[@]}"; do
  if kubectl config use-context "$ctx" >/dev/null 2>&1 && kubectl get ns >/dev/null 2>&1; then
    TARGET_CONTEXT="$ctx"
    break
  fi
done

if [ -z "$TARGET_CONTEXT" ]; then
  echo "[baseline] no reachable kubernetes context found from candidates: ${CONTEXT_CANDIDATES[*]}" >&2
  exit 1
fi

echo "[baseline] use kubernetes context $TARGET_CONTEXT"

# ── Canonical baseline gate: deployment readiness + Matrix contract ─
echo "[baseline] running canonical baseline gate..."
if bash "$SCRIPT_DIR/check_runtime_baseline.sh"; then
  echo "[baseline] baseline already healthy — nothing to do"
  exit 0
fi

# ── Not all ready: check if deploy_local.sh can be used ──
echo ""
echo "[baseline] baseline unhealthy; attempting local deploy repair"

if [ -f "$SCRIPT_DIR/deploy_local.sh" ] && [ -f "$(cd "$SCRIPT_DIR/../.." && pwd)/deploy/env/local.env" ]; then
  echo "[baseline] auto-invoking deploy_local.sh ..."
  bash "$SCRIPT_DIR/deploy_local.sh"
else
  echo "[baseline] deploy_local.sh or deploy/env/local.env not found"
  echo "[baseline] falling back to simple kubectl apply..."

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
