#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREPARE_VERIFIER="$SCRIPT_DIR/prepare_0457_local_rollback.sh"

MODE="dry-run"
CONFIRM=""
BACKUP_ROOT=""
REPO_ROOT_OVERRIDE=""
PERSIST_ROOT_OVERRIDE=""
NAMESPACE_OVERRIDE=""

REPO_ROOT=""
PERSIST_ROOT=""
NAMESPACE=""
PRODUCTION_PERSIST_ROOT="/Users/drop/dongyu/volume/persist"
PRODUCTION_NAMESPACE="dongyu"
RESTORE_HELPER="synapse-0457-restore"
HELPER_ACTIVE=0
ROLLBACK_ACTIVE=0
QUIESCE_STARTED=0
SERVICES_QUIESCED=0
DATA_MUTATION_STARTED=0
TXN_DIR=""
TXN_STAMP=""
ASSETS_FAILED_TREE=""
UI_FAILED_TREE=""
ASSETS_RESTORED=0
UI_RESTORED=0
SYNAPSE_STATE_MOVED=0
SYNAPSE_FAILED_NAME=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/rollback_0457_local.sh --backup <backup-dir> [options]

Default mode is DRY_RUN. It verifies the backup, live volume identity, and plan.

Options:
  --backup <path>               Prepared 0457 snapshot directory
  --dry-run                     Verify and print only (default)
  --apply                       Execute rollback
  --confirm ROLLBACK-0457       Required together with --apply
  --repo-root <path>            Must exactly equal snapshot repo root
  --persist-root <path>         Must exactly equal snapshot persisted-data root
  --namespace <name>            Must exactly equal snapshot namespace
  -h, --help                    Show this help
EOF
}

die() {
  echo "[0457-rollback] ERROR: $*" >&2
  exit 1
}

log() {
  echo "[0457-rollback] $*"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --backup)
      BACKUP_ROOT="${2:?missing value for --backup}"
      shift 2
      ;;
    --dry-run)
      MODE="dry-run"
      shift
      ;;
    --apply)
      MODE="apply"
      shift
      ;;
    --confirm)
      CONFIRM="${2:?missing value for --confirm}"
      shift 2
      ;;
    --repo-root)
      REPO_ROOT_OVERRIDE="${2:?missing value for --repo-root}"
      shift 2
      ;;
    --persist-root)
      PERSIST_ROOT_OVERRIDE="${2:?missing value for --persist-root}"
      shift 2
      ;;
    --namespace)
      NAMESPACE_OVERRIDE="${2:?missing value for --namespace}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      die "unknown option: $1"
      ;;
  esac
done

if [ "$MODE" = "apply" ] && [ "$CONFIRM" != "ROLLBACK-0457" ]; then
  die "--apply requires --confirm ROLLBACK-0457"
fi
[ -n "$BACKUP_ROOT" ] || die "--backup is required"

require_commands() {
  local command
  for command in kubectl docker git jq python3 ditto shasum tar diff install mv df du wc mktemp find xargs; do
    command -v "$command" >/dev/null 2>&1 || die "missing command: $command"
  done
}

check_exact_contexts() {
  local kubectl_context docker_context
  kubectl_context="$(kubectl config current-context 2>/dev/null || true)"
  docker_context="$(docker context show 2>/dev/null || true)"
  [ "$kubectl_context" = "orbstack" ] \
    || die "kubectl context must be orbstack (got ${kubectl_context:-unknown})"
  [ "$docker_context" = "orbstack" ] \
    || die "docker context must be orbstack (got ${docker_context:-unknown})"
}

assert_path_topology() {
  REPO_ROOT="$REPO_ROOT" PERSIST_ROOT="$PERSIST_ROOT" BACKUP_ROOT="$BACKUP_ROOT" python3 - <<'PY'
import os
from pathlib import Path

repo = Path(os.environ["REPO_ROOT"]).expanduser().resolve()
persist = Path(os.environ["PERSIST_ROOT"]).expanduser().resolve()
assets = (persist / "assets").resolve()
ui_server = (persist / "ui-server").resolve()
backup = Path(os.environ["BACKUP_ROOT"]).expanduser().resolve()

def overlaps(left: Path, right: Path) -> bool:
    return left == right or left in right.parents or right in left.parents

if backup == Path("/") or persist == Path("/") or len(persist.parts) < 4:
    raise SystemExit("unsafe_root_path")
if assets.parent != persist or ui_server.parent != persist or assets == ui_server:
    raise SystemExit("invalid_persist_child_topology")
for left_name, left, right_name, right in (
    ("backup", backup, "repo", repo),
    ("backup", backup, "persist", persist),
    ("backup", backup, "assets", assets),
    ("backup", backup, "ui-server", ui_server),
    ("repo", repo, "persist", persist),
    ("repo", repo, "assets", assets),
    ("repo", repo, "ui-server", ui_server),
    ("assets", assets, "ui-server", ui_server),
):
    if overlaps(left, right):
        raise SystemExit(f"path_overlap:{left_name}:{right_name}")
PY
}

assert_execution_scope() {
  local canonical_persist
  canonical_persist="$(PERSIST_ROOT="$PERSIST_ROOT" python3 - <<'PY'
import os
from pathlib import Path
print(Path(os.environ["PERSIST_ROOT"]).expanduser().resolve())
PY
)"
  if [ "$NAMESPACE" = "$PRODUCTION_NAMESPACE" ] \
    && [ "$canonical_persist" = "$PRODUCTION_PERSIST_ROOT" ]; then
    return 0
  fi

  [ "${DY_0457_ROLLBACK_TEST_ONLY:-}" = "FAKE_ORBSTACK_ONLY" ] \
    || die "execution scope must use namespace=dongyu and persist=$PRODUCTION_PERSIST_ROOT"
  [ "$NAMESPACE" = "dy-0457-test" ] \
    || die "test-only scope requires namespace=dy-0457-test"
  [ -n "${DY_0457_ROLLBACK_TEST_ROOT:-}" ] \
    || die "test-only scope requires DY_0457_ROLLBACK_TEST_ROOT"
  TEST_ROOT="$DY_0457_ROLLBACK_TEST_ROOT" \
  REPO_ROOT="$REPO_ROOT" \
  PERSIST_ROOT="$PERSIST_ROOT" \
  BACKUP_PATH="$BACKUP_ROOT" python3 - <<'PY'
import os
import tempfile
from pathlib import Path

test_root = Path(os.environ["TEST_ROOT"]).expanduser().resolve()
system_tmp = Path(tempfile.gettempdir()).resolve()
if test_root == system_tmp or system_tmp not in test_root.parents:
    raise SystemExit("test_root_must_be_a_child_of_system_tmp")
for name in ("REPO_ROOT", "PERSIST_ROOT", "BACKUP_PATH"):
    candidate = Path(os.environ[name]).expanduser().resolve()
    if candidate == test_root or test_root not in candidate.parents:
        raise SystemExit(f"test_path_outside_gate:{name}")
PY
  log "TEST_ONLY scope accepted under $DY_0457_ROLLBACK_TEST_ROOT"
}

load_snapshot_metadata() {
  local snapshot="$BACKUP_ROOT/snapshot.json"
  local saved_repo saved_persist saved_namespace
  [ -d "$BACKUP_ROOT" ] || die "backup directory missing: $BACKUP_ROOT"
  [ ! -L "$BACKUP_ROOT" ] || die "backup directory must not be a symlink"
  [ -s "$snapshot" ] || die "snapshot.json missing"
  jq -e '.format == "dy.0457.local-rollback.v2"' "$snapshot" >/dev/null \
    || die "unsupported snapshot format"

  saved_repo="$(jq -r '.repo_root // empty' "$snapshot")"
  saved_persist="$(jq -r '.persist_root // empty' "$snapshot")"
  saved_namespace="$(jq -r '.namespace // empty' "$snapshot")"
  [ -n "$saved_repo" ] && [ -n "$saved_persist" ] && [ -n "$saved_namespace" ] \
    || die "snapshot location metadata is incomplete"
  if [ -n "$REPO_ROOT_OVERRIDE" ] && [ "$REPO_ROOT_OVERRIDE" != "$saved_repo" ]; then
    die "repo-root override must exactly match snapshot metadata"
  fi
  if [ -n "$PERSIST_ROOT_OVERRIDE" ] && [ "$PERSIST_ROOT_OVERRIDE" != "$saved_persist" ]; then
    die "persist-root override must exactly match snapshot metadata"
  fi
  if [ -n "$NAMESPACE_OVERRIDE" ] && [ "$NAMESPACE_OVERRIDE" != "$saved_namespace" ]; then
    die "namespace override must exactly match snapshot metadata"
  fi
  REPO_ROOT="$saved_repo"
  PERSIST_ROOT="$saved_persist"
  NAMESPACE="$saved_namespace"

  [ -d "$REPO_ROOT/.git" ] || die "repo root is not a git checkout: $REPO_ROOT"
  assert_execution_scope
  assert_path_topology
}

verify_sqlite() {
  local path="$1"
  DB_PATH="$path" python3 - <<'PY'
import os
import sqlite3

path = os.environ["DB_PATH"]
con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
result = con.execute("PRAGMA quick_check").fetchone()[0]
con.close()
if result != "ok":
    raise SystemExit(f"sqlite_quick_check_failed:{path}:{result}")
PY
}

verify_ui_sqlite_tree() {
  local root="$1"
  UI_ROOT="$root" python3 - <<'PY'
import os
import sqlite3
from pathlib import Path

root = Path(os.environ["UI_ROOT"])
dbs = sorted(set(root.rglob("*.db")) | set(root.rglob("*.sqlite")))
active = root / "runtime" / "default" / "yhl.db"
if not dbs or active not in dbs:
    raise SystemExit("ui_sqlite_set_incomplete")
for db in dbs:
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    result = con.execute("PRAGMA quick_check").fetchone()[0]
    con.close()
    if result != "ok":
        raise SystemExit(f"ui_sqlite_quick_check_failed:{db}:{result}")
PY
}

verify_saved_volume_metadata() {
  jq -e --slurpfile snapshot "$BACKUP_ROOT/snapshot.json" '
    (.metadata.uid == $snapshot[0].synapse_volume.pvc_uid)
    and (.metadata.name == "synapse-data")
    and (.metadata.namespace == $snapshot[0].namespace)
    and (.spec.volumeName == $snapshot[0].synapse_volume.pv_name)
  ' "$BACKUP_ROOT/k8s/synapse-pvc.raw.json" >/dev/null \
    || die "saved PVC manifest does not match snapshot identity"
  jq -e --slurpfile snapshot "$BACKUP_ROOT/snapshot.json" '
    (.metadata.uid == $snapshot[0].synapse_volume.pv_uid)
    and (.metadata.name == $snapshot[0].synapse_volume.pv_name)
    and (.spec.claimRef.name == $snapshot[0].synapse_volume.claim_ref.name)
    and (.spec.claimRef.namespace == $snapshot[0].synapse_volume.claim_ref.namespace)
    and (.spec.claimRef.uid == $snapshot[0].synapse_volume.claim_ref.uid)
  ' "$BACKUP_ROOT/k8s/synapse-pv.raw.json" >/dev/null \
    || die "saved PV manifest does not match snapshot identity"
}

verify_backup() {
  load_snapshot_metadata
  local required
  for required in \
    checksums.sha256 \
    env/local.env \
    env/local.generated.env \
    assets/manifest.v0.json \
    ui-server/runtime/default/yhl.db \
    synapse/homeserver.db \
    synapse/pvc-files.tar \
    k8s/secrets.json \
    k8s/configmaps.json \
    k8s/deployments.json \
    k8s/services.json \
    k8s/synapse-pvc.raw.json \
    k8s/synapse-pv.raw.json \
    images/images.json \
    images/image-ids.tsv \
    images/pre-0457-images.tar \
    evidence/check_runtime_baseline.pre-0457.sh; do
    [ -s "$BACKUP_ROOT/$required" ] || die "backup artifact missing or empty: $required"
  done
  [ -f "$PREPARE_VERIFIER" ] || die "snapshot semantic verifier missing: $PREPARE_VERIFIER"
  bash "$PREPARE_VERIFIER" \
    --verify-frozen "$BACKUP_ROOT" \
    --repo-root "$REPO_ROOT" \
    --backup-base "$BACKUP_ROOT" \
    --persist-root "$PERSIST_ROOT" \
    --namespace "$NAMESPACE"
  (
    cd "$BACKUP_ROOT"
    shasum -a 256 -c checksums.sha256 >/dev/null
  )
  verify_sqlite "$BACKUP_ROOT/synapse/homeserver.db"
  verify_ui_sqlite_tree "$BACKUP_ROOT/ui-server"
  if tar -tf "$BACKUP_ROOT/synapse/pvc-files.tar" | grep -Eq '(^|/)homeserver\.db($|[-.])'; then
    die "Synapse PVC archive contains a raw homeserver.db"
  fi
  for required in homeserver.yaml log.config signing.key media_store; do
    tar -tf "$BACKUP_ROOT/synapse/pvc-files.tar" | grep -Eq "(^|/)${required}(/|$)" \
      || die "Synapse PVC archive missing $required"
  done
  jq -e '.items | length == 2' "$BACKUP_ROOT/k8s/secrets.json" >/dev/null
  jq -e '.items | length == 5' "$BACKUP_ROOT/k8s/configmaps.json" >/dev/null
  jq -e '.items | length == 6' "$BACKUP_ROOT/k8s/deployments.json" >/dev/null
  jq -e '.items | length == 4' "$BACKUP_ROOT/k8s/services.json" >/dev/null
  for required in secrets configmaps services deployments; do
    kubectl apply --dry-run=server -f "$BACKUP_ROOT/k8s/$required.json" >/dev/null
  done
  verify_saved_volume_metadata
  log "backup verified: $BACKUP_ROOT"
}

verify_live_volume_identity() {
  local pvc_json pv_json
  local expected_pvc_uid expected_pv_name expected_pv_uid expected_claim_name expected_claim_namespace expected_claim_uid
  expected_pvc_uid="$(jq -r '.synapse_volume.pvc_uid' "$BACKUP_ROOT/snapshot.json")"
  expected_pv_name="$(jq -r '.synapse_volume.pv_name' "$BACKUP_ROOT/snapshot.json")"
  expected_pv_uid="$(jq -r '.synapse_volume.pv_uid' "$BACKUP_ROOT/snapshot.json")"
  expected_claim_name="$(jq -r '.synapse_volume.claim_ref.name' "$BACKUP_ROOT/snapshot.json")"
  expected_claim_namespace="$(jq -r '.synapse_volume.claim_ref.namespace' "$BACKUP_ROOT/snapshot.json")"
  expected_claim_uid="$(jq -r '.synapse_volume.claim_ref.uid' "$BACKUP_ROOT/snapshot.json")"

  pvc_json="$(kubectl -n "$NAMESPACE" get pvc synapse-data -o json)"
  [ "$(jq -r '.metadata.uid // empty' <<<"$pvc_json")" = "$expected_pvc_uid" ] \
    && [ "$(jq -r '.metadata.namespace // empty' <<<"$pvc_json")" = "$NAMESPACE" ] \
    && [ "$(jq -r '.spec.volumeName // empty' <<<"$pvc_json")" = "$expected_pv_name" ] \
    && [ "$(jq -r '.status.phase // empty' <<<"$pvc_json")" = "Bound" ] \
    || die "live Synapse PVC identity drift detected"

  pv_json="$(kubectl get pv "$expected_pv_name" -o json)"
  [ "$(jq -r '.metadata.uid // empty' <<<"$pv_json")" = "$expected_pv_uid" ] \
    && [ "$(jq -r '.spec.claimRef.name // empty' <<<"$pv_json")" = "$expected_claim_name" ] \
    && [ "$(jq -r '.spec.claimRef.namespace // empty' <<<"$pv_json")" = "$expected_claim_namespace" ] \
    && [ "$(jq -r '.spec.claimRef.uid // empty' <<<"$pv_json")" = "$expected_claim_uid" ] \
    && [ "$(jq -r '.status.phase // empty' <<<"$pv_json")" = "Bound" ] \
    || die "live Synapse PV identity drift detected"
}

sanitize_kubernetes_list() {
  jq '
    del(.metadata)
    | .items |= map(
        del(
          .metadata.uid,
          .metadata.resourceVersion,
          .metadata.generation,
          .metadata.creationTimestamp,
          .metadata.managedFields,
          .status
        )
        | if .metadata.annotations then
            .metadata.annotations |= del(
              ."deployment.kubernetes.io/revision",
              ."kubectl.kubernetes.io/last-applied-configuration"
            )
          else . end
        | if ((.metadata.annotations? // {}) | length) == 0 then
            del(.metadata.annotations)
          else . end
        | if ((.metadata.labels? // {}) | length) == 0 then
            del(.metadata.labels)
          else . end
      )
  '
}

capture_current_kubernetes_list() {
  local kind="$1"
  local target="$2"
  shift 2
  kubectl -n "$NAMESPACE" get "$kind" "$@" -o json \
    | sanitize_kubernetes_list > "$target"
  kubectl apply --dry-run=server -f "$target" >/dev/null
}

normalize_kubernetes_object() {
  jq -S -c '
    del(
      .metadata.uid,
      .metadata.resourceVersion,
      .metadata.generation,
      .metadata.creationTimestamp,
      .metadata.managedFields,
      .status
    )
    | if .metadata.annotations then
        .metadata.annotations |= del(
          ."deployment.kubernetes.io/revision",
          ."kubectl.kubernetes.io/last-applied-configuration"
        )
      else . end
    | if ((.metadata.annotations? // {}) | length) == 0 then
        del(.metadata.annotations)
      else . end
    | if ((.metadata.labels? // {}) | length) == 0 then
        del(.metadata.labels)
      else . end
  '
}

service_immutable_fingerprint() {
  jq -S -c '{
    clusterIP: (.spec.clusterIP // null),
    clusterIPs: (.spec.clusterIPs // null),
    ipFamilies: (.spec.ipFamilies // null),
    ipFamilyPolicy: (.spec.ipFamilyPolicy // null),
    healthCheckNodePort: (.spec.healthCheckNodePort // null),
    ports: [
      (.spec.ports // [])[] |
      {
        name: (.name // null),
        port: .port,
        protocol: (.protocol // "TCP"),
        nodePort: (.nodePort // null)
      }
    ]
  }'
}

exact_replace_bundle() {
  local bundle="$1"
  local phase="$2"
  local item kind name item_namespace live resource_version uid desired after after_uid
  local desired_normalized after_normalized desired_immutable live_immutable
  [ "$phase" = "rollback" ] || [ "$phase" = "recovery" ] \
    || die "invalid exact restore phase: $phase"

  while IFS= read -r item; do
    kind="$(jq -r '.kind | ascii_downcase' <<<"$item")"
    name="$(jq -r '.metadata.name // empty' <<<"$item")"
    item_namespace="$(jq -r '.metadata.namespace // empty' <<<"$item")"
    case "$kind" in
      secret|configmap|deployment|service) ;;
      *) die "unsupported exact restore kind: $kind" ;;
    esac
    [ -n "$name" ] && [ "$item_namespace" = "$NAMESPACE" ] \
      || die "invalid exact restore identity: kind=$kind name=$name"

    live="$(kubectl -n "$NAMESPACE" get "$kind" "$name" -o json)"
    resource_version="$(jq -r '.metadata.resourceVersion // empty' <<<"$live")"
    uid="$(jq -r '.metadata.uid // empty' <<<"$live")"
    [ -n "$resource_version" ] && [ -n "$uid" ] \
      || die "live resource identity missing: kind=$kind name=$name"
    desired="$(jq -c --arg rv "$resource_version" --arg ns "$NAMESPACE" '
      .metadata.resourceVersion = $rv
      | .metadata.namespace = $ns
    ' <<<"$item")"

    if [ "$kind" = "service" ]; then
      desired_immutable="$(service_immutable_fingerprint <<<"$desired")"
      live_immutable="$(service_immutable_fingerprint <<<"$live")"
      [ "$desired_immutable" = "$live_immutable" ] \
        || die "service immutable identity drift: $name"
    fi

    if ! DY_0457_EXACT_RESTORE_PHASE="$phase" \
      kubectl -n "$NAMESPACE" replace -f - >/dev/null <<<"$desired"; then
      die "exact restore replace failed: phase=$phase kind=$kind name=$name"
    fi
    after="$(kubectl -n "$NAMESPACE" get "$kind" "$name" -o json)"
    after_uid="$(jq -r '.metadata.uid // empty' <<<"$after")"
    [ "$after_uid" = "$uid" ] \
      || die "resource UID changed during exact restore: kind=$kind name=$name"
    desired_normalized="$(normalize_kubernetes_object <<<"$desired")"
    after_normalized="$(normalize_kubernetes_object <<<"$after")"
    [ "$after_normalized" = "$desired_normalized" ] \
      || die "exact restore verification failed: kind=$kind name=$name"
  done < <(jq -c '.items[]' "$bundle")
}

exact_restore_kubernetes_prerequisites() {
  local root="$1"
  local phase="$2"
  exact_replace_bundle "$root/configmaps.json" "$phase"
  exact_replace_bundle "$root/secrets.json" "$phase"
  exact_replace_bundle "$root/services.json" "$phase"
  verify_live_volume_identity
}

exact_restore_kubernetes_deployments() {
  local root="$1"
  local phase="$2"
  exact_replace_bundle "$root/deployments.json" "$phase"
  verify_live_volume_identity
}

exact_restore_kubernetes_state() {
  local root="$1"
  local phase="$2"
  exact_restore_kubernetes_prerequisites "$root" "$phase"
  exact_restore_kubernetes_deployments "$root" "$phase"
}

preflight_resources() {
  kubectl -n "$NAMESPACE" get deployment \
    mosquitto synapse remote-worker workspace-manager mbr-worker ui-server -o name >/dev/null
  kubectl -n "$NAMESPACE" get service mosquitto synapse ui-server ui-server-nodeport -o name >/dev/null
  kubectl -n "$NAMESPACE" get secret ui-server-secret mbr-worker-secret -o name >/dev/null
  kubectl -n "$NAMESPACE" get configmap \
    mosquitto-config synapse-config remote-worker-config workspace-manager-config mbr-worker-config -o name >/dev/null
  if kubectl -n "$NAMESPACE" get pod "$RESTORE_HELPER" >/dev/null 2>&1; then
    die "restore helper already exists: $RESTORE_HELPER"
  fi
  render_synapse_restore_helper | kubectl apply --dry-run=server -f - >/dev/null
}

preflight_host_restore_capacity() {
  local assets_kb ui_kb host_required_kb host_available_kb value
  assets_kb="$(du -sk "$BACKUP_ROOT/assets" | awk '{print $1}')"
  ui_kb="$(du -sk "$BACKUP_ROOT/ui-server" | awk '{print $1}')"
  host_available_kb="$(df -Pk "$PERSIST_ROOT" | awk 'NR == 2 {print $4}')"
  host_required_kb=$((assets_kb + ui_kb + (assets_kb + ui_kb) / 4 + 16384))
  for value in "$assets_kb" "$ui_kb" "$host_available_kb"; do
    [[ "$value" =~ ^[0-9]+$ ]] || die "invalid rollback capacity estimate"
  done
  [ "$host_available_kb" -ge "$host_required_kb" ] \
    || die "insufficient host restore space: required_kb=$host_required_kb available_kb=$host_available_kb"
  log "host restore capacity preflight passed: required_kb=$host_required_kb"
}

preflight_synapse_restore_capacity() {
  local synapse_backup_kb pvc_available_kb pvc_required_kb
  synapse_backup_kb=$((($(wc -c < "$BACKUP_ROOT/synapse/homeserver.db") + $(wc -c < "$BACKUP_ROOT/synapse/pvc-files.tar") + 1023) / 1024))
  pvc_required_kb=$((synapse_backup_kb + synapse_backup_kb / 4 + 16384))
  ensure_restore_helper
  pvc_available_kb="$(kubectl -n "$NAMESPACE" exec "$RESTORE_HELPER" -c restore -- \
    sh -c "df -Pk /data | awk 'NR == 2 {print \$4}'")"
  [[ "$pvc_available_kb" =~ ^[0-9]+$ ]] || die "invalid Synapse PVC capacity estimate"
  [ "$pvc_available_kb" -ge "$pvc_required_kb" ] \
    || die "insufficient Synapse PVC restore space: required_kb=$pvc_required_kb available_kb=$pvc_available_kb"
  cleanup_restore_helper
  log "Synapse PVC restore capacity preflight passed: required_kb=$pvc_required_kb"
}

verify_loaded_images() {
  local tag expected actual
  while IFS=$'\t' read -r tag expected; do
    [ -n "$tag" ] || continue
    actual="$(docker image inspect "$tag" --format '{{.Id}}' 2>/dev/null || true)"
    [ "$actual" = "$expected" ] || die "loaded image ID mismatch: $tag"
  done < "$BACKUP_ROOT/images/image-ids.tsv"
}

capture_transaction_state() {
  TXN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/dy-0457-rollback-txn.XXXXXX")"
  TXN_STAMP="$(date +%Y%m%dT%H%M%S)"
  install -d -m 700 "$TXN_DIR/env" "$TXN_DIR/k8s"
  install -m 600 "$REPO_ROOT/deploy/env/local.env" "$TXN_DIR/env/local.env"
  install -m 600 "$REPO_ROOT/deploy/env/local.generated.env" "$TXN_DIR/env/local.generated.env"
  capture_current_kubernetes_list secret "$TXN_DIR/k8s/secrets.json" \
    ui-server-secret mbr-worker-secret
  capture_current_kubernetes_list configmap "$TXN_DIR/k8s/configmaps.json" \
    mosquitto-config synapse-config remote-worker-config workspace-manager-config mbr-worker-config
  capture_current_kubernetes_list deployment "$TXN_DIR/k8s/deployments.json" \
    mosquitto synapse remote-worker workspace-manager mbr-worker ui-server
  capture_current_kubernetes_list service "$TXN_DIR/k8s/services.json" \
    mosquitto synapse ui-server ui-server-nodeport

  : > "$TXN_DIR/replicas.tsv"
  local deployment replicas image image_id
  for deployment in mosquitto synapse remote-worker workspace-manager mbr-worker ui-server; do
    replicas="$(kubectl -n "$NAMESPACE" get deployment "$deployment" -o jsonpath='{.spec.replicas}')"
    [[ "$replicas" =~ ^[0-9]+$ ]] || die "invalid current replica count: $deployment"
    printf '%s\t%s\n' "$deployment" "$replicas" >> "$TXN_DIR/replicas.tsv"
  done
  : > "$TXN_DIR/image-ids.tsv"
  for image in \
    dy-ui-server:v1 \
    dy-remote-worker:v3 \
    dy-mbr-worker:v2 \
    ghcr.io/element-hq/synapse:latest \
    eclipse-mosquitto:2; do
    image_id="$(docker image inspect "$image" --format '{{.Id}}')"
    [ -n "$image_id" ] || die "current image ID missing: $image"
    printf '%s\t%s\n' "$image" "$image_id" >> "$TXN_DIR/image-ids.tsv"
  done
}

cleanup_restore_helper() {
  [ "$HELPER_ACTIVE" -eq 1 ] || return 0
  if kubectl -n "$NAMESPACE" delete pod "$RESTORE_HELPER" --wait=true --timeout=120s >/dev/null; then
    HELPER_ACTIVE=0
    return 0
  fi
  return 1
}

create_synapse_restore_helper() {
  if kubectl -n "$NAMESPACE" get pod "$RESTORE_HELPER" >/dev/null 2>&1; then
    die "restore helper already exists: $RESTORE_HELPER"
  fi
  render_synapse_restore_helper | kubectl apply -f - >/dev/null
  HELPER_ACTIVE=1
  kubectl -n "$NAMESPACE" wait --for=condition=Ready "pod/$RESTORE_HELPER" --timeout=120s
}

render_synapse_restore_helper() {
  cat <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: $RESTORE_HELPER
  namespace: $NAMESPACE
spec:
  restartPolicy: Never
  containers:
  - name: restore
    image: ghcr.io/element-hq/synapse:latest
    imagePullPolicy: Never
    command: ["/bin/sh", "-c", "sleep infinity"]
    volumeMounts:
    - name: data
      mountPath: /data
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: synapse-data
EOF
}

ensure_restore_helper() {
  if [ "$HELPER_ACTIVE" -eq 1 ]; then
    return 0
  fi
  create_synapse_restore_helper
}

restore_host_tree() {
  local backup_tree="$1"
  local target_tree="$2"
  local label="$3"
  local failed_tree="${target_tree}.failed-before-rollback-$TXN_STAMP"
  [ -d "$backup_tree" ] || die "backup tree missing: $backup_tree"
  [ "$target_tree" = "$PERSIST_ROOT/assets" ] || [ "$target_tree" = "$PERSIST_ROOT/ui-server" ] \
    || die "unsafe host restore target: $target_tree"
  [ ! -e "$failed_tree" ] || die "failed-state target already exists: $failed_tree"

  mv "$target_tree" "$failed_tree"
  if [ "$label" = "assets" ]; then
    ASSETS_FAILED_TREE="$failed_tree"
  else
    UI_FAILED_TREE="$failed_tree"
  fi
  ditto --rsrc --extattr --acl "$backup_tree" "$target_tree"
  diff -qr "$backup_tree" "$target_tree" >/dev/null \
    || die "$label restore content mismatch"
  if [ "$label" = "assets" ]; then
    ASSETS_RESTORED=1
  else
    UI_RESTORED=1
  fi
  log "$label restored; failed state retained at $failed_tree"
}

recover_host_tree() {
  local target="$1"
  local failed="$2"
  local label="$3"
  [ -n "$failed" ] && [ -d "$failed" ] || return 0
  if [ -e "$target" ]; then
    if ! mv "$target" "${target}.failed-rollback-attempt-$TXN_STAMP"; then
      return 1
    fi
  fi
  if ! mv "$failed" "$target"; then
    return 1
  fi
  log "$label pre-rollback state restored after failure"
}

restore_synapse_pvc() {
  SYNAPSE_FAILED_NAME=".failed-before-rollback-$TXN_STAMP"
  ensure_restore_helper
  SYNAPSE_STATE_MOVED=1
  if ! kubectl -n "$NAMESPACE" exec "$RESTORE_HELPER" -c restore -- \
    env FAILED_NAME="$SYNAPSE_FAILED_NAME" sh -ceu '
      failed="/data/$FAILED_NAME"
      mkdir "$failed"
      for item in /data/* /data/.[!.]* /data/..?*; do
        [ -e "$item" ] || continue
        [ "$item" = "$failed" ] && continue
        mv "$item" "$failed/"
      done
    '; then
    return 1
  fi
  kubectl -n "$NAMESPACE" exec -i "$RESTORE_HELPER" -c restore -- \
    tar --numeric-owner -C /data -xpf - \
    < "$BACKUP_ROOT/synapse/pvc-files.tar"
  kubectl -n "$NAMESPACE" exec -i "$RESTORE_HELPER" -c restore -- \
    sh -ceu 'cat > /data/homeserver.db; chmod 0644 /data/homeserver.db' \
    < "$BACKUP_ROOT/synapse/homeserver.db"
  kubectl -n "$NAMESPACE" exec "$RESTORE_HELPER" -c restore -- \
    sh -ceu '
      chown -R 991:991 /data/homeserver.db /data/homeserver.yaml /data/log.config /data/signing.key /data/media_store
      chmod 0640 /data/signing.key
      python3 - <<"PY"
import sqlite3
con = sqlite3.connect("file:/data/homeserver.db?mode=ro", uri=True)
result = con.execute("PRAGMA quick_check").fetchone()[0]
con.close()
if result != "ok":
    raise SystemExit(f"restored_synapse_quick_check_failed:{result}")
PY
    '
  cleanup_restore_helper
}

recover_synapse_state() {
  [ "$SYNAPSE_STATE_MOVED" -eq 1 ] || return 0
  if ! ensure_restore_helper; then
    return 1
  fi
  if ! kubectl -n "$NAMESPACE" exec "$RESTORE_HELPER" -c restore -- \
    env FAILED_NAME="$SYNAPSE_FAILED_NAME" ATTEMPT_NAME=".failed-rollback-attempt-$TXN_STAMP" \
    sh -ceu '
      failed="/data/$FAILED_NAME"
      attempt="/data/$ATTEMPT_NAME"
      [ -d "$failed" ]
      mkdir "$attempt"
      for item in /data/* /data/.[!.]* /data/..?*; do
        [ -e "$item" ] || continue
        [ "$item" = "$failed" ] && continue
        [ "$item" = "$attempt" ] && continue
        mv "$item" "$attempt/"
      done
      for item in "$failed"/* "$failed"/.[!.]* "$failed"/..?*; do
        [ -e "$item" ] || continue
        mv "$item" /data/
      done
      rmdir "$failed"
    '; then
    return 1
  fi
  SYNAPSE_STATE_MOVED=0
  if ! cleanup_restore_helper; then
    return 1
  fi
  log "Synapse pre-rollback data restored after failure"
}

retry_scale() {
  local deployment="$1"
  local replicas="$2"
  local attempt
  for attempt in 1 2 3; do
    if kubectl -n "$NAMESPACE" scale "deployment/$deployment" --replicas="$replicas" >/dev/null; then
      return 0
    fi
    log "replica recovery retry $attempt failed for $deployment"
  done
  return 1
}

restore_original_replicas() {
  local deployment replicas
  while IFS=$'\t' read -r deployment replicas; do
    [ -n "$deployment" ] || continue
    retry_scale "$deployment" "$replicas" || return 1
  done < "$TXN_DIR/replicas.tsv"
  return 0
}

restore_original_image_tags() {
  local failed=0
  local image image_id
  while IFS=$'\t' read -r image image_id; do
    [ -n "$image" ] || continue
    docker image tag "$image_id" "$image" >/dev/null || failed=1
  done < "$TXN_DIR/image-ids.tsv"
  return "$failed"
}

quiesce_deployments() {
  local deployment remaining
  QUIESCE_STARTED=1
  for deployment in mosquitto synapse remote-worker workspace-manager mbr-worker ui-server; do
    kubectl -n "$NAMESPACE" scale "deployment/$deployment" --replicas=0
  done
  for deployment in mosquitto synapse remote-worker workspace-manager mbr-worker ui-server; do
    remaining="$(kubectl -n "$NAMESPACE" get pod -l "app=$deployment" -o name)" \
      || die "failed to inspect pods while quiescing rollback: $deployment"
    if [ -n "$remaining" ]; then
      kubectl -n "$NAMESPACE" wait --for=delete pod -l "app=$deployment" --timeout=180s
    fi
    remaining="$(kubectl -n "$NAMESPACE" get pod -l "app=$deployment" -o name)" \
      || die "failed to confirm pod termination for rollback: $deployment"
    [ -z "$remaining" ] || die "deployment pods still present after quiesce: $deployment"
    log "quiesce confirmed: deployment=$deployment pods=0"
  done
  SERVICES_QUIESCED=1
}

quiesce_for_recovery() {
  local failed=0
  local deployment remaining
  for deployment in mosquitto synapse remote-worker workspace-manager mbr-worker ui-server; do
    kubectl -n "$NAMESPACE" scale "deployment/$deployment" --replicas=0 >/dev/null || failed=1
  done
  for deployment in mosquitto synapse remote-worker workspace-manager mbr-worker ui-server; do
    if ! remaining="$(kubectl -n "$NAMESPACE" get pod -l "app=$deployment" -o name 2>/dev/null)"; then
      failed=1
      continue
    fi
    if [ -n "$remaining" ]; then
      kubectl -n "$NAMESPACE" wait --for=delete pod -l "app=$deployment" --timeout=180s >/dev/null \
        || failed=1
    fi
    if ! remaining="$(kubectl -n "$NAMESPACE" get pod -l "app=$deployment" -o name 2>/dev/null)"; then
      failed=1
      continue
    fi
    [ -z "$remaining" ] || failed=1
  done
  return "$failed"
}

fail_closed_recovery() {
  local reason="$1"
  log "ERROR: pre-attempt recovery prerequisite failed: $reason"
  if ! quiesce_for_recovery; then
    log "ERROR: best-effort deployment quiesce was incomplete"
  fi
  log "recovery remains fail-closed with deployments quiesced"
  log "ERROR: pre-attempt recovery was incomplete; manual intervention is required"
  return 1
}

recover_failed_rollback() {
  log "rollback failed; restoring pre-attempt state"

  if ! restore_original_image_tags; then
    fail_closed_recovery image_tags
    return 1
  fi

  if [ "$DATA_MUTATION_STARTED" -eq 0 ]; then
    if ! cleanup_restore_helper; then
      fail_closed_recovery helper_cleanup
      return 1
    fi
    if [ "$QUIESCE_STARTED" -eq 1 ] && ! restore_original_replicas; then
      fail_closed_recovery replicas
      return 1
    fi
    log "pre-attempt state recovery completed"
    return 0
  fi

  if ! quiesce_for_recovery; then
    fail_closed_recovery deployment_quiesce
    return 1
  fi
  if ! recover_synapse_state; then
    fail_closed_recovery synapse_state
    return 1
  fi
  if ! recover_host_tree "$PERSIST_ROOT/ui-server" "$UI_FAILED_TREE" ui-server; then
    fail_closed_recovery ui_server_state
    return 1
  fi
  if ! recover_host_tree "$PERSIST_ROOT/assets" "$ASSETS_FAILED_TREE" assets; then
    fail_closed_recovery assets_state
    return 1
  fi
  if ! install -m 600 "$TXN_DIR/env/local.env" "$REPO_ROOT/deploy/env/local.env"; then
    fail_closed_recovery local_env
    return 1
  fi
  if ! install -m 600 "$TXN_DIR/env/local.generated.env" "$REPO_ROOT/deploy/env/local.generated.env"; then
    fail_closed_recovery generated_env
    return 1
  fi
  if ! (exact_restore_kubernetes_prerequisites "$TXN_DIR/k8s" recovery); then
    fail_closed_recovery kubernetes_prerequisites
    return 1
  fi
  if ! cleanup_restore_helper; then
    fail_closed_recovery helper_cleanup
    return 1
  fi
  if ! (exact_restore_kubernetes_deployments "$TXN_DIR/k8s" recovery); then
    fail_closed_recovery kubernetes_deployments
    return 1
  fi

  log "pre-attempt state recovery completed"
  return 0
}

on_exit() {
  local original_rc=$?
  local recovery_rc=0
  local cleanup_rc=0
  local remove_txn=0
  trap - EXIT
  set +e
  if [ "$original_rc" -ne 0 ] && [ "$ROLLBACK_ACTIVE" -eq 1 ]; then
    recover_failed_rollback
    recovery_rc=$?
  fi
  cleanup_restore_helper
  cleanup_rc=$?
  if [ "$recovery_rc" -ne 0 ] || [ "$cleanup_rc" -ne 0 ]; then
    log "ERROR: rollback cleanup/recovery did not complete"
  fi
  if [ "$original_rc" -eq 0 ] && [ "$cleanup_rc" -eq 0 ]; then
    remove_txn=1
  elif [ "$original_rc" -ne 0 ] && [ "$ROLLBACK_ACTIVE" -eq 1 ] \
    && [ "$recovery_rc" -eq 0 ] && [ "$cleanup_rc" -eq 0 ]; then
    remove_txn=1
  elif [ "$ROLLBACK_ACTIVE" -eq 0 ]; then
    remove_txn=1
  fi
  if [ "$remove_txn" -eq 1 ] && [ -n "$TXN_DIR" ] && [ -d "$TXN_DIR" ]; then
    rm -rf "$TXN_DIR"
  elif [ -n "$TXN_DIR" ] && [ -d "$TXN_DIR" ]; then
    log "TRANSACTION EVIDENCE RETAINED: $TXN_DIR"
  fi
  if [ "$original_rc" -eq 0 ] && { [ "$recovery_rc" -ne 0 ] || [ "$cleanup_rc" -ne 0 ]; }; then
    original_rc=1
  fi
  exit "$original_rc"
}

trap on_exit EXIT

expected_image_id() {
  jq -r --arg image "$1" '.images[$image]' "$BACKUP_ROOT/snapshot.json"
}

assert_running_image() {
  local app="$1"
  local image="$2"
  local expected actual pod_id normalized_pod_id repo_digests
  expected="$(expected_image_id "$image")"
  actual="$(docker image inspect "$image" --format '{{.Id}}')"
  [ "$actual" = "$expected" ] \
    || die "rolled-back local image mismatch: image=$image expected=$expected actual=$actual"
  repo_digests="$(docker image inspect "$image" --format '{{json .RepoDigests}}')"
  pod_id="$(kubectl -n "$NAMESPACE" get pod -l "app=$app" -o jsonpath='{.items[0].status.containerStatuses[0].imageID}')"
  normalized_pod_id="${pod_id#docker-pullable://}"
  normalized_pod_id="${normalized_pod_id#docker://}"
  normalized_pod_id="${normalized_pod_id#containerd://}"
  if [ "$normalized_pod_id" = "$expected" ]; then
    return 0
  fi
  jq -e --arg id "$normalized_pod_id" '(. // []) | index($id) != null' <<<"$repo_digests" >/dev/null \
    || die "rolled-back pod image mismatch: app=$app expected=$expected actual=$pod_id"
}

verify_live_synapse_db() {
  local pod
  pod="$(kubectl -n "$NAMESPACE" get pod -l app=synapse -o jsonpath='{.items[0].metadata.name}')"
  [ -n "$pod" ] || die "Synapse pod missing after rollback"
  kubectl -n "$NAMESPACE" exec -i "$pod" -c synapse -- python3 - <<'PY'
import sqlite3
con = sqlite3.connect("file:/data/homeserver.db?mode=ro", uri=True)
result = con.execute("PRAGMA quick_check").fetchone()[0]
con.close()
if result != "ok":
    raise SystemExit(f"live_synapse_quick_check_failed:{result}")
PY
}

apply_rollback() {
  local deployment
  capture_transaction_state
  ROLLBACK_ACTIVE=1
  verify_live_volume_identity
  preflight_synapse_restore_capacity

  quiesce_deployments
  docker load -i "$BACKUP_ROOT/images/pre-0457-images.tar" >/dev/null
  verify_loaded_images

  docker image tag dy-ui-server:pre-0457-e0c48fa dy-ui-server:v1
  docker image tag dy-remote-worker:pre-0457-e0c48fa dy-remote-worker:v3
  docker image tag dy-mbr-worker:pre-0457-e0c48fa dy-mbr-worker:v2

  [ "$SERVICES_QUIESCED" -eq 1 ] || die "data restore requires confirmed pod quiescence"
  DATA_MUTATION_STARTED=1
  install -m 600 "$BACKUP_ROOT/env/local.env" "$REPO_ROOT/deploy/env/local.env"
  install -m 600 "$BACKUP_ROOT/env/local.generated.env" "$REPO_ROOT/deploy/env/local.generated.env"
  git -C "$REPO_ROOT" check-ignore -q deploy/env/local.env \
    || die "restored local.env is not ignored"
  git -C "$REPO_ROOT" check-ignore -q deploy/env/local.generated.env \
    || die "restored local.generated.env is not ignored"

  restore_host_tree "$BACKUP_ROOT/assets" "$PERSIST_ROOT/assets" assets
  restore_host_tree "$BACKUP_ROOT/ui-server" "$PERSIST_ROOT/ui-server" ui-server
  verify_ui_sqlite_tree "$PERSIST_ROOT/ui-server"
  restore_synapse_pvc

  exact_restore_kubernetes_state "$BACKUP_ROOT/k8s" rollback
  for deployment in mosquitto synapse remote-worker workspace-manager mbr-worker ui-server; do
    kubectl -n "$NAMESPACE" rollout status "deployment/$deployment" --timeout=180s
  done

  assert_running_image ui-server dy-ui-server:v1
  assert_running_image remote-worker dy-remote-worker:v3
  assert_running_image workspace-manager dy-remote-worker:v3
  assert_running_image mbr-worker dy-mbr-worker:v2
  assert_running_image synapse ghcr.io/element-hq/synapse:latest
  assert_running_image mosquitto eclipse-mosquitto:2
  verify_live_synapse_db
  chmod 700 "$BACKUP_ROOT/evidence/check_runtime_baseline.pre-0457.sh"
  "$BACKUP_ROOT/evidence/check_runtime_baseline.pre-0457.sh"
  ROLLBACK_ACTIVE=0
  log "ROLLBACK COMPLETE; current strict 0457 checker is intentionally not the old-baseline success signal"
}

print_dry_run_plan() {
  cat <<EOF
[0457-rollback] DRY_RUN
backup=$BACKUP_ROOT
repo_root=$REPO_ROOT
persist_root=$PERSIST_ROOT
namespace=$NAMESPACE

Backup, path topology, host capacity, and live PVC/PV identity verification passed.
The live PVC free-space check runs through a temporary PVC helper only after confirmed apply starts its transaction.
No images, files, Kubernetes resources, pods, or PVC data were changed.
Real rollback command:
  bash scripts/ops/rollback_0457_local.sh --backup "$BACKUP_ROOT" --apply --confirm ROLLBACK-0457
EOF
}

require_commands
check_exact_contexts
verify_backup
verify_live_volume_identity
preflight_resources
preflight_host_restore_capacity

case "$MODE" in
  dry-run)
    print_dry_run_plan
    ;;
  apply)
    apply_rollback
    ;;
  *)
    die "invalid mode: $MODE"
    ;;
esac
