#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

MODE="dry-run"
CONFIRM=""
VERIFY_ROOT=""
REPO_ROOT="$DEFAULT_REPO_ROOT"
BACKUP_BASE="/Users/drop/dongyu/backups"
PERSIST_ROOT="/Users/drop/dongyu/volume/persist"
NAMESPACE="dongyu"
BASELINE_SHA="e0c48fa"
PRODUCTION_PERSIST_ROOT="/Users/drop/dongyu/volume/persist"
PRODUCTION_NAMESPACE="dongyu"

BACKUP_ROOT=""
QUIESCE_ACTIVE=0
UI_REPLICAS=""
MBR_REPLICAS=""
SYNAPSE_REPLICAS=""
SYNAPSE_POD=""
SYNAPSE_HELPER="synapse-0457-backup"
SYNAPSE_HELPER_ACTIVE=0
PVC_JSON=""
PV_JSON=""
PVC_UID=""
PV_NAME=""
PV_UID=""
CLAIM_REF_NAME=""
CLAIM_REF_NAMESPACE=""
CLAIM_REF_UID=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/prepare_0457_local_rollback.sh [options]

Default mode is DRY_RUN and performs no snapshot writes, image tags, or pod scaling.

Options:
  --dry-run                    Print the prepare plan (default)
  --apply                      Create and verify a real local snapshot
  --confirm PREPARE-0457       Required together with --apply
  --verify <backup-dir>        Verify an existing snapshot without mutation
  --verify-frozen <backup-dir> Verify only frozen archive integrity and semantic bindings
  --repo-root <path>           Repository root
  --backup-base <path>         Parent for timestamped snapshots
  --persist-root <path>        Parent containing assets/ and ui-server/
  --namespace <name>           Kubernetes namespace (default: dongyu)
  --baseline-sha <sha>         Old checker revision (default: e0c48fa)
  -h, --help                   Show this help
EOF
}

die() {
  echo "[0457-rollback-prepare] ERROR: $*" >&2
  exit 1
}

log() {
  echo "[0457-rollback-prepare] $*"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
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
    --verify)
      MODE="verify"
      VERIFY_ROOT="${2:?missing value for --verify}"
      shift 2
      ;;
    --verify-frozen)
      MODE="verify-frozen"
      VERIFY_ROOT="${2:?missing value for --verify-frozen}"
      shift 2
      ;;
    --repo-root)
      REPO_ROOT="${2:?missing value for --repo-root}"
      shift 2
      ;;
    --backup-base)
      BACKUP_BASE="${2:?missing value for --backup-base}"
      shift 2
      ;;
    --persist-root)
      PERSIST_ROOT="${2:?missing value for --persist-root}"
      shift 2
      ;;
    --namespace)
      NAMESPACE="${2:?missing value for --namespace}"
      shift 2
      ;;
    --baseline-sha)
      BASELINE_SHA="${2:?missing value for --baseline-sha}"
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

if [ "$MODE" = "apply" ] && [ "$CONFIRM" != "PREPARE-0457" ]; then
  die "--apply requires --confirm PREPARE-0457"
fi

require_commands() {
  local command
  for command in kubectl docker git jq python3 ditto shasum tar diff install df du wc find xargs; do
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
  BACKUP_PATH="$BACKUP_BASE" python3 - <<'PY'
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

assert_path_topology() {
  local backup_path="$1"
  REPO_ROOT="$REPO_ROOT" PERSIST_ROOT="$PERSIST_ROOT" BACKUP_PATH="$backup_path" python3 - <<'PY'
import os
from pathlib import Path

repo = Path(os.environ["REPO_ROOT"]).expanduser().resolve()
persist = Path(os.environ["PERSIST_ROOT"]).expanduser().resolve()
assets = (persist / "assets").resolve()
ui_server = (persist / "ui-server").resolve()
backup = Path(os.environ["BACKUP_PATH"]).expanduser().resolve()

def overlaps(left: Path, right: Path) -> bool:
    return left == right or left in right.parents or right in left.parents

if backup == Path("/") or persist == Path("/"):
    raise SystemExit("unsafe_root_path")
if len(persist.parts) < 4:
    raise SystemExit("unsafe_persist_root")
if assets.parent != persist or ui_server.parent != persist or assets == ui_server:
    raise SystemExit("invalid_persist_child_topology")

# persist intentionally owns assets/ and ui-server/. Every other pair must be
# disjoint in both directions so a copy cannot recursively consume its source.
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

assert_repo_inputs() {
  [ -d "$REPO_ROOT/.git" ] || die "repo root is not a git checkout: $REPO_ROOT"
  [ -f "$REPO_ROOT/deploy/env/local.env" ] || die "missing deploy/env/local.env"
  [ -f "$REPO_ROOT/deploy/env/local.generated.env" ] || die "missing deploy/env/local.generated.env"
  [ -d "$PERSIST_ROOT/assets" ] || die "missing persisted assets: $PERSIST_ROOT/assets"
  [ -d "$PERSIST_ROOT/ui-server" ] || die "missing UI persistence: $PERSIST_ROOT/ui-server"
  git -C "$REPO_ROOT" check-ignore -q deploy/env/local.env \
    || die "deploy/env/local.env must remain ignored"
  git -C "$REPO_ROOT" check-ignore -q deploy/env/local.generated.env \
    || die "deploy/env/local.generated.env must remain ignored"
  [ -z "$(git -C "$REPO_ROOT" status --porcelain -- deploy/env/local.env deploy/env/local.generated.env)" ] \
    || die "ignored env files unexpectedly appear in git status"
}

retry_scale() {
  local deployment="$1"
  local replicas="$2"
  local attempt
  for attempt in 1 2 3; do
    if kubectl -n "$NAMESPACE" scale "deployment/$deployment" --replicas="$replicas" >/dev/null; then
      return 0
    fi
    log "replica restore retry $attempt failed for $deployment"
  done
  return 1
}

restore_quiesced_replicas() {
  [ "$QUIESCE_ACTIVE" -eq 1 ] || return 0
  local failed=0
  if [ -n "$UI_REPLICAS" ] && ! retry_scale ui-server "$UI_REPLICAS"; then failed=1; fi
  if [ -n "$MBR_REPLICAS" ] && ! retry_scale mbr-worker "$MBR_REPLICAS"; then failed=1; fi
  if [ -n "$SYNAPSE_REPLICAS" ] && ! retry_scale synapse "$SYNAPSE_REPLICAS"; then failed=1; fi
  if [ "$failed" -eq 0 ]; then
    QUIESCE_ACTIVE=0
    return 0
  fi
  return 1
}

cleanup_synapse_helper() {
  [ "$SYNAPSE_HELPER_ACTIVE" -eq 1 ] || return 0
  local attempt
  for attempt in 1 2 3; do
    if kubectl -n "$NAMESPACE" delete pod "$SYNAPSE_HELPER" --wait=true --timeout=120s >/dev/null; then
      SYNAPSE_HELPER_ACTIVE=0
      return 0
    fi
    log "backup helper cleanup retry $attempt failed"
  done
  return 1
}

on_exit() {
  local original_rc=$?
  local cleanup_rc=0
  local restore_rc=0
  trap - EXIT
  set +e
  cleanup_synapse_helper
  cleanup_rc=$?
  restore_quiesced_replicas
  restore_rc=$?
  if [ "$cleanup_rc" -ne 0 ]; then
    log "ERROR: failed to remove Synapse backup helper"
  fi
  if [ "$restore_rc" -ne 0 ]; then
    log "ERROR: failed to restore one or more quiesced deployments"
  fi
  if [ "$original_rc" -eq 0 ] && { [ "$cleanup_rc" -ne 0 ] || [ "$restore_rc" -ne 0 ]; }; then
    original_rc=1
  fi
  exit "$original_rc"
}

trap on_exit EXIT

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

snapshot_kubernetes_list() {
  local kind="$1"
  local target="$2"
  shift 2
  kubectl -n "$NAMESPACE" get "$kind" "$@" -o json \
    | sanitize_kubernetes_list > "$target"
  chmod 600 "$target"
  kubectl apply --dry-run=server -f "$target" >/dev/null
}

verify_synapse_sqlite() {
  local db_path="$1"
  DB_PATH="$db_path" python3 - <<'PY'
import os
import sqlite3

path = os.environ["DB_PATH"]
con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
result = con.execute("PRAGMA quick_check").fetchone()[0]
con.close()
if result != "ok":
    raise SystemExit(f"synapse_sqlite_quick_check_failed:{result}")
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
if not dbs:
    raise SystemExit("ui_sqlite_backup_empty")
if active not in dbs:
    raise SystemExit("ui_active_yhl_db_missing")
for db in dbs:
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    result = con.execute("PRAGMA quick_check").fetchone()[0]
    con.close()
    if result != "ok":
        raise SystemExit(f"ui_sqlite_quick_check_failed:{db}:{result}")
PY
}

snapshot_image_id_for_tag() {
  local image_ids_file="$1"
  local wanted_tag="$2"
  local tag expected extra matched=""

  while IFS=$'\t' read -r tag expected extra; do
    [ -n "$tag" ] || continue
    [ -n "$expected" ] && [ -z "$extra" ] \
      || die "snapshot image ID record is malformed: $tag"
    if [ "$tag" = "$wanted_tag" ]; then
      [ -z "$matched" ] || die "snapshot image tag is duplicated: $wanted_tag"
      matched="$expected"
    fi
  done < "$image_ids_file"

  [ -n "$matched" ] || die "snapshot image tag is missing: $wanted_tag"
  printf '%s\n' "$matched"
}

assert_snapshot_image_pair() {
  local image_ids_file="$1"
  local active_tag="$2"
  local alias_tag="$3"
  local active_id alias_id

  active_id="$(snapshot_image_id_for_tag "$image_ids_file" "$active_tag")"
  alias_id="$(snapshot_image_id_for_tag "$image_ids_file" "$alias_tag")"
  [ "$active_id" = "$alias_id" ] \
    || die "snapshot image ID mapping mismatch: $active_tag -> $alias_tag"
}

assert_snapshot_active_image_binding() {
  local image_ids_file="$1"
  local image_metadata="$2"
  local snapshot_metadata="$3"
  local active_tag="$4"
  local expected snapshot_expected

  expected="$(snapshot_image_id_for_tag "$image_ids_file" "$active_tag")"
  jq -e --arg tag "$active_tag" --arg id "$expected" '
    [
      .[]
      | select((.RepoTags | type) == "array")
      | select((.RepoTags | index($tag)) != null)
      | .Id
    ]
    | unique == [$id]
  ' "$image_metadata" >/dev/null \
    || die "snapshot image metadata binding mismatch: $active_tag"
  snapshot_expected="$(jq -r --arg tag "$active_tag" '.images[$tag] // empty' "$snapshot_metadata")"
  [ "$snapshot_expected" = "$expected" ] \
    || die "snapshot manifest image binding mismatch: $active_tag"
}

verify_snapshot() {
  local root="$1"
  [ -d "$root" ] || die "snapshot directory missing: $root"
  [ ! -L "$root" ] || die "snapshot directory must not be a symlink"

  local required
  for required in \
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
    evidence/git-head.txt \
    evidence/check_runtime_baseline.pre-0457.sh \
    snapshot.json \
    checksums.sha256; do
    [ -s "$root/$required" ] || die "snapshot artifact missing or empty: $required"
  done

  jq -e '
    .format == "dy.0457.local-rollback.v2"
    and (.synapse_volume.pvc_uid | type == "string" and length > 0)
    and (.synapse_volume.pv_name | type == "string" and length > 0)
    and (.synapse_volume.pv_uid | type == "string" and length > 0)
    and (.synapse_volume.claim_ref.name == "synapse-data")
    and (.synapse_volume.claim_ref.namespace | type == "string" and length > 0)
    and (.synapse_volume.claim_ref.uid == .synapse_volume.pvc_uid)
  ' "$root/snapshot.json" >/dev/null
  jq -e '.items | length == 2' "$root/k8s/secrets.json" >/dev/null
  jq -e '.items | length == 5' "$root/k8s/configmaps.json" >/dev/null
  jq -e '.items | length == 6' "$root/k8s/deployments.json" >/dev/null
  jq -e '.items | length == 4' "$root/k8s/services.json" >/dev/null

  (
    cd "$root"
    shasum -a 256 -c checksums.sha256 >/dev/null
  )
  verify_synapse_sqlite "$root/synapse/homeserver.db"
  verify_ui_sqlite_tree "$root/ui-server"
  if tar -tf "$root/synapse/pvc-files.tar" | grep -Eq '(^|/)homeserver\.db($|[-.])'; then
    die "Synapse PVC archive must not contain a raw homeserver.db"
  fi
  for required in homeserver.yaml log.config signing.key media_store; do
    tar -tf "$root/synapse/pvc-files.tar" | grep -Eq "(^|/)${required}(/|$)" \
      || die "Synapse PVC archive missing $required"
  done

  jq -e '
    type == "array"
    and length > 0
    and all(.[];
      (.Id | type == "string" and length > 0)
      and (
        .RepoTags == null
        or (
          (.RepoTags | type) == "array"
          and all(.RepoTags[]; type == "string" and length > 0)
        )
      )
    )
  ' "$root/images/images.json" >/dev/null \
    || die "snapshot image metadata is invalid"

  local image_ids_file="$root/images/image-ids.tsv"
  local image_metadata="$root/images/images.json"
  local tag expected extra
  while IFS=$'\t' read -r tag expected extra; do
    [ -n "$tag" ] || continue
    [ -n "$expected" ] && [ -z "$extra" ] \
      || die "snapshot image ID record is malformed: $tag"
    jq -e --arg id "$expected" 'any(.[]; .Id == $id)' "$image_metadata" >/dev/null \
      || die "snapshot image ID missing from frozen metadata: $tag"
  done < "$image_ids_file"

  assert_snapshot_image_pair \
    "$image_ids_file" dy-ui-server:v1 dy-ui-server:pre-0457-e0c48fa
  assert_snapshot_image_pair \
    "$image_ids_file" dy-remote-worker:v3 dy-remote-worker:pre-0457-e0c48fa
  assert_snapshot_image_pair \
    "$image_ids_file" dy-mbr-worker:v2 dy-mbr-worker:pre-0457-e0c48fa
  for tag in \
    dy-ui-server:v1 \
    dy-remote-worker:v3 \
    dy-mbr-worker:v2 \
    ghcr.io/element-hq/synapse:latest \
    eclipse-mosquitto:2; do
    assert_snapshot_active_image_binding \
      "$image_ids_file" "$image_metadata" "$root/snapshot.json" "$tag"
  done
  log "snapshot verified: $root"
}

verify_live_snapshot_aliases() {
  local root="$1"
  local tag expected extra actual
  while IFS=$'\t' read -r tag expected extra; do
    [ -n "$tag" ] || continue
    [ -n "$expected" ] && [ -z "$extra" ] \
      || die "snapshot image ID record is malformed: $tag"
    case "$tag" in
      *:pre-0457-*)
        actual="$(docker image inspect "$tag" --format '{{.Id}}' 2>/dev/null || true)"
        [ "$actual" = "$expected" ] || die "snapshot image alias mismatch: $tag"
        ;;
    esac
  done < "$root/images/image-ids.tsv"
  log "snapshot live aliases verified: $root"
}

load_and_verify_volume_identity() {
  PVC_JSON="$(kubectl -n "$NAMESPACE" get pvc synapse-data -o json)"
  PVC_UID="$(jq -r '.metadata.uid // empty' <<<"$PVC_JSON")"
  PV_NAME="$(jq -r '.spec.volumeName // empty' <<<"$PVC_JSON")"
  [ "$(jq -r '.metadata.name // empty' <<<"$PVC_JSON")" = "synapse-data" ] \
    || die "unexpected Synapse PVC name"
  [ "$(jq -r '.metadata.namespace // empty' <<<"$PVC_JSON")" = "$NAMESPACE" ] \
    || die "Synapse PVC namespace mismatch"
  [ "$(jq -r '.status.phase // empty' <<<"$PVC_JSON")" = "Bound" ] \
    || die "synapse-data PVC is not Bound"
  [ -n "$PVC_UID" ] && [ -n "$PV_NAME" ] || die "Synapse PVC identity is incomplete"

  PV_JSON="$(kubectl get pv "$PV_NAME" -o json)"
  PV_UID="$(jq -r '.metadata.uid // empty' <<<"$PV_JSON")"
  CLAIM_REF_NAME="$(jq -r '.spec.claimRef.name // empty' <<<"$PV_JSON")"
  CLAIM_REF_NAMESPACE="$(jq -r '.spec.claimRef.namespace // empty' <<<"$PV_JSON")"
  CLAIM_REF_UID="$(jq -r '.spec.claimRef.uid // empty' <<<"$PV_JSON")"
  [ "$(jq -r '.metadata.name // empty' <<<"$PV_JSON")" = "$PV_NAME" ] \
    || die "Synapse PV name mismatch"
  [ "$(jq -r '.status.phase // empty' <<<"$PV_JSON")" = "Bound" ] \
    || die "Synapse PV is not Bound"
  [ -n "$PV_UID" ] || die "Synapse PV UID missing"
  [ "$CLAIM_REF_NAME" = "synapse-data" ] \
    && [ "$CLAIM_REF_NAMESPACE" = "$NAMESPACE" ] \
    && [ "$CLAIM_REF_UID" = "$PVC_UID" ] \
    || die "Synapse PV claimRef does not match the live PVC identity"
}

assert_pod_image_matches_local() {
  local app="$1"
  local image="$2"
  local local_id pod_id normalized_pod_id repo_digests
  local_id="$(docker image inspect "$image" --format '{{.Id}}')"
  repo_digests="$(docker image inspect "$image" --format '{{json .RepoDigests}}')"
  pod_id="$(kubectl -n "$NAMESPACE" get pod -l "app=$app" -o jsonpath='{.items[0].status.containerStatuses[0].imageID}')"
  [ -n "$pod_id" ] || die "running pod imageID missing: app=$app"
  normalized_pod_id="${pod_id#docker-pullable://}"
  normalized_pod_id="${normalized_pod_id#docker://}"
  normalized_pod_id="${normalized_pod_id#containerd://}"
  if [ "$normalized_pod_id" = "$local_id" ]; then
    return 0
  fi
  jq -e --arg id "$normalized_pod_id" '(. // []) | index($id) != null' <<<"$repo_digests" >/dev/null \
    || die "pod imageID does not match local image: app=$app image=$image pod=$pod_id local=$local_id"
}

tag_image_without_overwrite() {
  local active="$1"
  local backup="$2"
  local active_id existing_id
  active_id="$(docker image inspect "$active" --format '{{.Id}}')"
  existing_id="$(docker image inspect "$backup" --format '{{.Id}}' 2>/dev/null || true)"
  if [ -n "$existing_id" ] && [ "$existing_id" != "$active_id" ]; then
    die "backup image tag already exists with a different ID: $backup"
  fi
  if [ -z "$existing_id" ]; then
    docker image tag "$active" "$backup"
  fi
}

capture_replica_counts() {
  UI_REPLICAS="$(kubectl -n "$NAMESPACE" get deployment ui-server -o jsonpath='{.spec.replicas}')"
  MBR_REPLICAS="$(kubectl -n "$NAMESPACE" get deployment mbr-worker -o jsonpath='{.spec.replicas}')"
  SYNAPSE_REPLICAS="$(kubectl -n "$NAMESPACE" get deployment synapse -o jsonpath='{.spec.replicas}')"
  [[ "$UI_REPLICAS" =~ ^[0-9]+$ ]] \
    && [[ "$MBR_REPLICAS" =~ ^[0-9]+$ ]] \
    && [[ "$SYNAPSE_REPLICAS" =~ ^[0-9]+$ ]] \
    || die "failed to capture deployment replica counts"
}

quiesce_snapshot_deployments() {
  local deployment remaining
  QUIESCE_ACTIVE=1
  for deployment in ui-server mbr-worker synapse; do
    kubectl -n "$NAMESPACE" scale "deployment/$deployment" --replicas=0
  done
  for deployment in ui-server mbr-worker synapse; do
    remaining="$(kubectl -n "$NAMESPACE" get pod -l "app=$deployment" -o name)" \
      || die "failed to inspect pods while quiescing snapshot: $deployment"
    if [ -n "$remaining" ]; then
      kubectl -n "$NAMESPACE" wait --for=delete pod -l "app=$deployment" --timeout=120s
    fi
    remaining="$(kubectl -n "$NAMESPACE" get pod -l "app=$deployment" -o name)" \
      || die "failed to confirm pod termination for snapshot: $deployment"
    [ -z "$remaining" ] \
      || die "snapshot data copy requires confirmed pod quiescence: $deployment"
    log "snapshot quiesce confirmed: deployment=$deployment pods=0"
  done
}

preflight_resources_and_images() {
  kubectl -n "$NAMESPACE" get secret ui-server-secret mbr-worker-secret -o name >/dev/null
  kubectl -n "$NAMESPACE" get configmap \
    mosquitto-config synapse-config remote-worker-config workspace-manager-config mbr-worker-config -o name >/dev/null
  kubectl -n "$NAMESPACE" get deployment \
    mosquitto synapse remote-worker workspace-manager mbr-worker ui-server -o name >/dev/null
  kubectl -n "$NAMESPACE" get service mosquitto synapse ui-server ui-server-nodeport -o name >/dev/null
  if kubectl -n "$NAMESPACE" get pod "$SYNAPSE_HELPER" >/dev/null 2>&1; then
    die "Synapse backup helper already exists: $SYNAPSE_HELPER"
  fi
  render_synapse_backup_helper | kubectl apply --dry-run=server -f - >/dev/null

  load_and_verify_volume_identity
  capture_replica_counts
  SYNAPSE_POD="$(kubectl -n "$NAMESPACE" get pod -l app=synapse -o jsonpath='{.items[0].metadata.name}')"
  [ -n "$SYNAPSE_POD" ] || die "Synapse pod not found"
  assert_pod_image_matches_local ui-server dy-ui-server:v1
  assert_pod_image_matches_local remote-worker dy-remote-worker:v3
  assert_pod_image_matches_local workspace-manager dy-remote-worker:v3
  assert_pod_image_matches_local mbr-worker dy-mbr-worker:v2
  assert_pod_image_matches_local synapse ghcr.io/element-hq/synapse:latest
  assert_pod_image_matches_local mosquitto eclipse-mosquitto:2
}

check_backup_disk_capacity() {
  local probe="$BACKUP_BASE"
  local available_kb assets_kb ui_kb synapse_kb image_bytes image_kb source_kb required_kb
  while [ ! -e "$probe" ] && [ "$probe" != "/" ]; do
    probe="$(dirname "$probe")"
  done
  [ -e "$probe" ] || die "cannot resolve a filesystem for backup base: $BACKUP_BASE"

  available_kb="$(df -Pk "$probe" | awk 'NR == 2 {print $4}')"
  assets_kb="$(du -sk "$PERSIST_ROOT/assets" | awk '{print $1}')"
  ui_kb="$(du -sk "$PERSIST_ROOT/ui-server" | awk '{print $1}')"
  synapse_kb="$(kubectl -n "$NAMESPACE" exec "$SYNAPSE_POD" -c synapse -- du -sk /data | awk '{print $1}')"
  image_bytes=0
  local image size value
  for image in \
    dy-ui-server:v1 \
    dy-remote-worker:v3 \
    dy-mbr-worker:v2 \
    ghcr.io/element-hq/synapse:latest \
    eclipse-mosquitto:2; do
    size="$(docker image inspect "$image" --format '{{.Size}}')"
    [[ "$size" =~ ^[0-9]+$ ]] || die "invalid local image size: $image"
    image_bytes=$((image_bytes + size))
  done
  for value in "$available_kb" "$assets_kb" "$ui_kb" "$synapse_kb"; do
    [[ "$value" =~ ^[0-9]+$ ]] || die "invalid capacity estimate"
  done
  image_kb=$(((image_bytes + 1023) / 1024))
  source_kb=$((assets_kb + ui_kb + synapse_kb + image_kb))
  required_kb=$((source_kb + source_kb / 3 + 65536))
  [ "$available_kb" -ge "$required_kb" ] \
    || die "insufficient backup space: required_kb=$required_kb available_kb=$available_kb"
  log "backup capacity preflight passed: required_kb=$required_kb available_kb=$available_kb"
}

write_checksums() {
  local root="$1"
  (
    cd "$root"
    find . -type f ! -name checksums.sha256 -print0 \
      | LC_ALL=C sort -z \
      | xargs -0 shasum -a 256
  ) > "$root/checksums.sha256"
  chmod 600 "$root/checksums.sha256"
}

create_synapse_backup_helper() {
  render_synapse_backup_helper | kubectl apply -f - >/dev/null
  SYNAPSE_HELPER_ACTIVE=1
  kubectl -n "$NAMESPACE" wait --for=condition=Ready "pod/$SYNAPSE_HELPER" --timeout=120s
}

render_synapse_backup_helper() {
  cat <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: $SYNAPSE_HELPER
  namespace: $NAMESPACE
spec:
  restartPolicy: Never
  containers:
  - name: backup
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

backup_quiesced_synapse() {
  local stamp="$1"
  local synapse_tmp_db="/data/.0457-$stamp-homeserver.db"
  create_synapse_backup_helper
  kubectl -n "$NAMESPACE" exec -i "$SYNAPSE_HELPER" -c backup -- \
    env OUT="$synapse_tmp_db" python3 - <<'PY'
import os
import sqlite3

src = sqlite3.connect("file:/data/homeserver.db?mode=ro", uri=True)
dst = sqlite3.connect(os.environ["OUT"])
src.backup(dst, pages=1024, sleep=0.01)
result = dst.execute("PRAGMA quick_check").fetchone()[0]
dst.close()
src.close()
if result != "ok":
    raise SystemExit(f"synapse_backup_quick_check_failed:{result}")
PY
  kubectl -n "$NAMESPACE" exec "$SYNAPSE_HELPER" -c backup -- cat "$synapse_tmp_db" \
    > "$BACKUP_ROOT/synapse/homeserver.db"
  kubectl -n "$NAMESPACE" exec "$SYNAPSE_HELPER" -c backup -- \
    tar --numeric-owner -C /data -cpf - homeserver.yaml log.config signing.key media_store \
    > "$BACKUP_ROOT/synapse/pvc-files.tar"
  kubectl -n "$NAMESPACE" exec "$SYNAPSE_HELPER" -c backup -- rm -f "$synapse_tmp_db"
  cleanup_synapse_helper
  chmod 600 "$BACKUP_ROOT/synapse/"*
  verify_synapse_sqlite "$BACKUP_ROOT/synapse/homeserver.db"
}

create_snapshot() {
  local stamp git_head
  local ui_id remote_id mbr_id synapse_id mosquitto_id

  stamp="$(date +%Y%m%dT%H%M%S)"
  BACKUP_ROOT="$BACKUP_BASE/0457-predeploy-$stamp"
  assert_path_topology "$BACKUP_ROOT"
  [ ! -e "$BACKUP_ROOT" ] || die "snapshot path already exists: $BACKUP_ROOT"
  [ ! -L "$BACKUP_BASE" ] || die "backup base must not be a symlink"

  install -d -m 700 \
    "$BACKUP_ROOT/env" \
    "$BACKUP_ROOT/synapse" \
    "$BACKUP_ROOT/k8s" \
    "$BACKUP_ROOT/images" \
    "$BACKUP_ROOT/evidence"
  install -m 600 "$REPO_ROOT/deploy/env/local.env" "$BACKUP_ROOT/env/local.env"
  install -m 600 "$REPO_ROOT/deploy/env/local.generated.env" "$BACKUP_ROOT/env/local.generated.env"

  git_head="$(git -C "$REPO_ROOT" rev-parse HEAD)"
  printf '%s\n' "$git_head" > "$BACKUP_ROOT/evidence/git-head.txt"
  git -C "$REPO_ROOT" status --porcelain=v2 > "$BACKUP_ROOT/evidence/git-status.txt"
  git -C "$REPO_ROOT" show "$BASELINE_SHA:scripts/ops/check_runtime_baseline.sh" \
    > "$BACKUP_ROOT/evidence/check_runtime_baseline.pre-0457.sh"
  chmod 700 "$BACKUP_ROOT/evidence/check_runtime_baseline.pre-0457.sh"

  snapshot_kubernetes_list secret "$BACKUP_ROOT/k8s/secrets.json" \
    ui-server-secret mbr-worker-secret
  snapshot_kubernetes_list configmap "$BACKUP_ROOT/k8s/configmaps.json" \
    mosquitto-config synapse-config remote-worker-config workspace-manager-config mbr-worker-config
  snapshot_kubernetes_list deployment "$BACKUP_ROOT/k8s/deployments.json" \
    mosquitto synapse remote-worker workspace-manager mbr-worker ui-server
  snapshot_kubernetes_list service "$BACKUP_ROOT/k8s/services.json" \
    mosquitto synapse ui-server ui-server-nodeport
  printf '%s\n' "$PVC_JSON" > "$BACKUP_ROOT/k8s/synapse-pvc.raw.json"
  printf '%s\n' "$PV_JSON" > "$BACKUP_ROOT/k8s/synapse-pv.raw.json"
  chmod 600 "$BACKUP_ROOT/k8s/synapse-pvc.raw.json" "$BACKUP_ROOT/k8s/synapse-pv.raw.json"
  kubectl -n "$NAMESPACE" get deployment -o json > "$BACKUP_ROOT/evidence/deployments-live.raw.json"
  kubectl -n "$NAMESPACE" get pods -o json > "$BACKUP_ROOT/evidence/pods-live.raw.json"
  chmod 600 "$BACKUP_ROOT/evidence/"*.json

  tag_image_without_overwrite dy-ui-server:v1 dy-ui-server:pre-0457-e0c48fa
  tag_image_without_overwrite dy-remote-worker:v3 dy-remote-worker:pre-0457-e0c48fa
  tag_image_without_overwrite dy-mbr-worker:v2 dy-mbr-worker:pre-0457-e0c48fa
  ui_id="$(docker image inspect dy-ui-server:pre-0457-e0c48fa --format '{{.Id}}')"
  remote_id="$(docker image inspect dy-remote-worker:pre-0457-e0c48fa --format '{{.Id}}')"
  mbr_id="$(docker image inspect dy-mbr-worker:pre-0457-e0c48fa --format '{{.Id}}')"
  synapse_id="$(docker image inspect ghcr.io/element-hq/synapse:latest --format '{{.Id}}')"
  mosquitto_id="$(docker image inspect eclipse-mosquitto:2 --format '{{.Id}}')"
  {
    printf 'dy-ui-server:v1\t%s\n' "$ui_id"
    printf 'dy-remote-worker:v3\t%s\n' "$remote_id"
    printf 'dy-mbr-worker:v2\t%s\n' "$mbr_id"
    printf 'dy-ui-server:pre-0457-e0c48fa\t%s\n' "$ui_id"
    printf 'dy-remote-worker:pre-0457-e0c48fa\t%s\n' "$remote_id"
    printf 'dy-mbr-worker:pre-0457-e0c48fa\t%s\n' "$mbr_id"
    printf 'ghcr.io/element-hq/synapse:latest\t%s\n' "$synapse_id"
    printf 'eclipse-mosquitto:2\t%s\n' "$mosquitto_id"
  } > "$BACKUP_ROOT/images/image-ids.tsv"
  docker image inspect \
    dy-ui-server:v1 \
    dy-remote-worker:v3 \
    dy-mbr-worker:v2 \
    dy-ui-server:pre-0457-e0c48fa \
    dy-remote-worker:pre-0457-e0c48fa \
    dy-mbr-worker:pre-0457-e0c48fa \
    ghcr.io/element-hq/synapse:latest \
    eclipse-mosquitto:2 > "$BACKUP_ROOT/images/images.json"
  docker save -o "$BACKUP_ROOT/images/pre-0457-images.tar" \
    dy-ui-server:v1 \
    dy-remote-worker:v3 \
    dy-mbr-worker:v2 \
    dy-ui-server:pre-0457-e0c48fa \
    dy-remote-worker:pre-0457-e0c48fa \
    dy-mbr-worker:pre-0457-e0c48fa \
    ghcr.io/element-hq/synapse:latest \
    eclipse-mosquitto:2
  chmod 600 "$BACKUP_ROOT/images/"*

  quiesce_snapshot_deployments

  ditto --rsrc --extattr --acl "$PERSIST_ROOT/assets" "$BACKUP_ROOT/assets"
  ditto --rsrc --extattr --acl "$PERSIST_ROOT/ui-server" "$BACKUP_ROOT/ui-server"
  diff -qr "$PERSIST_ROOT/assets" "$BACKUP_ROOT/assets" >/dev/null
  diff -qr "$PERSIST_ROOT/ui-server" "$BACKUP_ROOT/ui-server" >/dev/null
  verify_ui_sqlite_tree "$BACKUP_ROOT/ui-server"
  backup_quiesced_synapse "$stamp"

  jq -n \
    --arg format "dy.0457.local-rollback.v2" \
    --arg created_at "$(date -Iseconds)" \
    --arg repo_root "$(cd "$REPO_ROOT" && pwd -P)" \
    --arg persist_root "$(cd "$PERSIST_ROOT" && pwd -P)" \
    --arg namespace "$NAMESPACE" \
    --arg baseline_sha "$BASELINE_SHA" \
    --arg git_head "$git_head" \
    --arg pvc_uid "$PVC_UID" \
    --arg pv_name "$PV_NAME" \
    --arg pv_uid "$PV_UID" \
    --arg claim_ref_name "$CLAIM_REF_NAME" \
    --arg claim_ref_namespace "$CLAIM_REF_NAMESPACE" \
    --arg claim_ref_uid "$CLAIM_REF_UID" \
    --arg ui_replicas "$UI_REPLICAS" \
    --arg mbr_replicas "$MBR_REPLICAS" \
    --arg synapse_replicas "$SYNAPSE_REPLICAS" \
    --arg ui_image_id "$ui_id" \
    --arg remote_image_id "$remote_id" \
    --arg mbr_image_id "$mbr_id" \
    --arg synapse_image_id "$synapse_id" \
    --arg mosquitto_image_id "$mosquitto_id" \
    '{
      format: $format,
      created_at: $created_at,
      repo_root: $repo_root,
      persist_root: $persist_root,
      namespace: $namespace,
      baseline_sha: $baseline_sha,
      git_head: $git_head,
      synapse_volume: {
        pvc_uid: $pvc_uid,
        pv_name: $pv_name,
        pv_uid: $pv_uid,
        claim_ref: {
          name: $claim_ref_name,
          namespace: $claim_ref_namespace,
          uid: $claim_ref_uid
        }
      },
      replicas: {
        "ui-server": ($ui_replicas|tonumber),
        "mbr-worker": ($mbr_replicas|tonumber),
        "synapse": ($synapse_replicas|tonumber)
      },
      images: {
        "dy-ui-server:v1": $ui_image_id,
        "dy-remote-worker:v3": $remote_image_id,
        "dy-mbr-worker:v2": $mbr_image_id,
        "ghcr.io/element-hq/synapse:latest": $synapse_image_id,
        "eclipse-mosquitto:2": $mosquitto_image_id
      },
      image_revision_attestation: "unverified; pre-0457-e0c48fa is an operational alias, not a proven build revision"
    }' > "$BACKUP_ROOT/snapshot.json"
  chmod 600 "$BACKUP_ROOT/snapshot.json"

  restore_quiesced_replicas
  [ "$UI_REPLICAS" -eq 0 ] || kubectl -n "$NAMESPACE" rollout status deployment/ui-server --timeout=180s
  [ "$MBR_REPLICAS" -eq 0 ] || kubectl -n "$NAMESPACE" rollout status deployment/mbr-worker --timeout=180s
  [ "$SYNAPSE_REPLICAS" -eq 0 ] || kubectl -n "$NAMESPACE" rollout status deployment/synapse --timeout=180s
  "$BACKUP_ROOT/evidence/check_runtime_baseline.pre-0457.sh" \
    | tee "$BACKUP_ROOT/evidence/old-baseline-before-deploy.txt"

  write_checksums "$BACKUP_ROOT"
  verify_snapshot "$BACKUP_ROOT"
  verify_live_snapshot_aliases "$BACKUP_ROOT"
  log "PREPARED $BACKUP_ROOT"
}

print_dry_run_plan() {
  cat <<EOF
[0457-rollback-prepare] DRY_RUN
repo_root=$REPO_ROOT
backup_base=$BACKUP_BASE
persist_root=$PERSIST_ROOT
namespace=$NAMESPACE
baseline_sha=$BASELINE_SHA

No files, image tags, Kubernetes resources, pods, or PVC data were changed.
Real snapshot command:
  bash scripts/ops/prepare_0457_local_rollback.sh --apply --confirm PREPARE-0457
EOF
}

require_commands
check_exact_contexts
assert_execution_scope
assert_path_topology "$BACKUP_BASE"

case "$MODE" in
  dry-run)
    print_dry_run_plan
    ;;
  verify)
    [ -n "$VERIFY_ROOT" ] || die "--verify requires a backup directory"
    assert_path_topology "$VERIFY_ROOT"
    verify_snapshot "$VERIFY_ROOT"
    verify_live_snapshot_aliases "$VERIFY_ROOT"
    ;;
  verify-frozen)
    [ -n "$VERIFY_ROOT" ] || die "--verify-frozen requires a backup directory"
    assert_path_topology "$VERIFY_ROOT"
    verify_snapshot "$VERIFY_ROOT"
    ;;
  apply)
    assert_repo_inputs
    preflight_resources_and_images
    check_backup_disk_capacity
    create_snapshot
    ;;
  *)
    die "invalid mode: $MODE"
    ;;
esac
