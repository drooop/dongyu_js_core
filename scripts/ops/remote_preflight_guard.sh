#!/usr/bin/env bash
# Guard for remote cloud deploy: enforce rke2-only constraints before mutating ops.
# Usage:
#   bash scripts/ops/remote_preflight_guard.sh
#   bash scripts/ops/remote_preflight_guard.sh --print-socket
#   bash scripts/ops/remote_preflight_guard.sh --expect-socket /run/k3s/containerd/containerd.sock
set -euo pipefail

QUIET=0
PRINT_SOCKET=0
EXPECTED_SOCKET=""

while [ $# -gt 0 ]; do
  case "$1" in
    --quiet)
      QUIET=1
      shift
      ;;
    --print-socket)
      PRINT_SOCKET=1
      QUIET=1
      shift
      ;;
    --expect-socket)
      shift
      if [ $# -eq 0 ]; then
        echo "ERROR: --expect-socket requires a path" >&2
        exit 1
      fi
      EXPECTED_SOCKET="$1"
      shift
      ;;
    -h|--help)
      cat <<'USAGE'
Usage:
  remote_preflight_guard.sh [--quiet] [--print-socket] [--expect-socket <path>]

Checks:
  - kubectl reachable
  - node kubelet versions contain +rke2
  - k3s service is not active
  - containerd socket resolved and ctr can connect
USAGE
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

log() {
  if [ "$QUIET" -eq 0 ]; then
    echo "$@"
  fi
}

fail() {
  echo "REMOTE_RKE2_GATE: FAIL - $*" >&2
  exit 1
}

CTR_BIN="${CTR:-ctr}"

if ! command -v kubectl >/dev/null 2>&1; then
  fail "kubectl not found in PATH"
fi

if [ "$(id -u)" -ne 0 ]; then
  fail "must run as root (sudo) on cloud host"
fi

if ! command -v "$CTR_BIN" >/dev/null 2>&1; then
  fail "ctr binary not found: $CTR_BIN"
fi

if ! kubectl get nodes >/dev/null 2>&1; then
  fail "kubectl cannot reach cluster"
fi

NODE_VERSIONS="$(kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"="}{.status.nodeInfo.kubeletVersion}{"\n"}{end}' 2>/dev/null || true)"
if [ -z "$NODE_VERSIONS" ]; then
  fail "cannot read node kubelet versions"
fi

if ! printf '%s\n' "$NODE_VERSIONS" | grep -q '+rke2'; then
  fail "cluster kubelet versions do not contain +rke2"
fi

if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-active --quiet k3s 2>/dev/null; then
    fail "k3s service is active; this host must stay rke2-only"
  fi
fi

SOCKET_CANDIDATES=()
append_candidate() {
  local sock="$1"
  [ -n "$sock" ] || return 0
  local existing
  for existing in "${SOCKET_CANDIDATES[@]-}"; do
    if [ "$existing" = "$sock" ]; then
      return 0
    fi
  done
  SOCKET_CANDIDATES+=("$sock")
}

append_candidate "$EXPECTED_SOCKET"
append_candidate "${CONTAINERD_SOCK:-}"
append_candidate "/run/rke2/containerd/containerd.sock"
append_candidate "/run/k3s/containerd/containerd.sock"

RESOLVED_SOCKET=""
for sock in "${SOCKET_CANDIDATES[@]}"; do
  if [ -S "$sock" ]; then
    RESOLVED_SOCKET="$sock"
    break
  fi
done

if [ -z "$RESOLVED_SOCKET" ]; then
  fail "containerd socket not found (checked: ${SOCKET_CANDIDATES[*]})"
fi

if ! "$CTR_BIN" --address "$RESOLVED_SOCKET" -n k8s.io version >/dev/null 2>&1; then
  fail "ctr cannot connect to socket $RESOLVED_SOCKET (need root/permission?)"
fi

if [ "$PRINT_SOCKET" -eq 1 ]; then
  printf '%s\n' "$RESOLVED_SOCKET"
  exit 0
fi

log "REMOTE_RKE2_GATE: PASS"
log "  node kubelet versions:"
if [ "$QUIET" -eq 0 ]; then
  while IFS= read -r line; do
    [ -n "$line" ] && echo "    - $line"
  done <<< "$NODE_VERSIONS"
fi
log "  resolved containerd socket: $RESOLVED_SOCKET"
