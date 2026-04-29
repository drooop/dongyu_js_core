---
title: "0349 Data Model Tier2 And Remote Deploy Optimization Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-29
source: ai
---

# Iteration 0349-data-model-tier2-and-remote-deploy-optimization Runlog

## Environment

- Date: 2026-04-29
- Branch: `dev_0349-data-model-tier2-and-remote-deploy-optimization`
- Runtime: local repo + remote `dongyudigital.com` rke2 deploy path

## Execution Records

### Step 1 — Inventory And Plan

- Command:
  - `git switch -c dev_0349-data-model-tier2-and-remote-deploy-optimization`
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0349-data-model-tier2-and-remote-deploy-optimization --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - Reviewed `CLAUDE.md`, 0348 SSOT docs, Data.* templates/tests, deploy scripts, Dockerfiles, and remote deploy docs.
- Key output:
  - Current Data.* executable implementation is still 0296-era Tier 2 templates for Array/Queue/Stack plus a Tier 1-ish `CircularBuffer` helper used by Matrix Debug trace.
  - Cloud deploy already prefers remote source sync + remote build + app/full split, but Docker build context has no `.dockerignore`, and archive fallback still syncs the full repo.
  - First Stage 1 review returned `CHANGE_REQUESTED`:
    - `Data.Single` was incorrectly grouped with table/matrix collection models.
    - archive fallback revision-gate risk was not documented.
    - validation command did not explicitly include untracked new docs.
  - Fixed Stage 1 docs to separate `Data.Single` placement from collection models and to document stale `.git` / `.deploy-source-revision` risk.
- Result: in progress
- Commit:

### Step 2 — Tier 2 Implementation Design

- Command:
  - Added `docs/ssot/data_model_tier2_implementation_v1.md`.
  - Updated `docs/user-guide/data_models_filltable_guide.md`.
  - Updated `docs/ssot/runtime_semantics_modeltable_driven.md`.
  - Added `scripts/tests/test_0349_data_model_tier2_plan.mjs`.
  - `node scripts/tests/test_0349_data_model_tier2_plan.mjs`
  - `node scripts/tests/test_0348_feishu_data_model_contract.mjs`
  - `git add -N docs/ssot/data_model_tier2_implementation_v1.md scripts/tests/test_0349_data_model_tier2_plan.mjs`
  - `git diff --check`
- Key output:
  - Data.* implementation path is now explicitly Tier 2 fill-table template/program capability.
  - `Data.Single` placement is separated from collection-like Data.* placement.
  - Legacy 0296-era templates/tests/runtime helper are identified as migration debt, not authoring examples.
  - 0349 Data Model Tier 2 plan test: PASS.
  - 0348 Feishu Data Model contract docs test: PASS.
  - `git diff --check`: PASS with new Stage 2 files included through intent-to-add.
  - First Stage 2 review returned `CHANGE_REQUESTED` because resolution missed `runtime_semantics_modeltable_driven.md` in Files/Rollback and runlog lacked Stage 2 verification evidence.
  - Fixed resolution and runlog evidence.
- Result: in progress
- Commit:

### Step 3 — Deploy Sync Optimization

- Command:
  - Added `.dockerignore`.
  - Updated `scripts/ops/sync_cloud_source.sh`.
  - Updated `scripts/ops/deploy_cloud_app.sh`.
  - Updated `scripts/ops/deploy_cloud_full.sh`.
  - Updated `scripts/ops/README.md`.
  - Added `scripts/tests/test_0349_remote_deploy_sync_contract.mjs`.
- Key output:
  - Docker build context excludes docs/tests/archive/output/dependency directories.
  - Source sync writes `.deploy-source-revision` after normal git checkout and archive fallback.
  - Archive fallback uses an explicit deploy source path list instead of streaming the full repository.
  - App deploy now detects actual source revision from `DEPLOY_SOURCE_REV`, `.deploy-source-revision`, or git HEAD and compares it to `--revision`.
  - First Stage 3 review returned `CHANGE_REQUESTED` because full deploy did not accept/check `--revision`, and app deploy trusted `DEPLOY_SOURCE_REV` before actual sync stamp/git state.
  - Fixed both deploy paths to prefer `.deploy-source-revision`/git HEAD before `DEPLOY_SOURCE_REV`; full deploy now accepts `--revision` and rejects mismatch.
  - First remote source sync attempt through `dongyudigital.com` failed because DNS resolved to expired/non-SSH hosts.
  - Retried through historical SSH IP `124.71.43.80`; git checkout missed local-only revision and archive fallback started as expected.
  - Archive fallback failed because remote `/tmp` is on a full root filesystem; read-only disk check showed `/home/wwpic/dongyuapp` is on `/opt` with available space.
  - Updated archive fallback to use `$REMOTE_REPO/.sync-work` instead of `/tmp`.
  - Second remote sync succeeded with revision stamp `1c6be63`, but verification showed `.dockerignore` was not included in archive fallback paths.
  - Standalone preflight without explicit `KUBECONFIG` failed with `kubectl cannot reach cluster`; deploy scripts set `KUBECONFIG`, and manual preflight command was updated to pass it explicitly.
  - Added `.dockerignore` to `DEPLOY_ARCHIVE_PATHS`.
  - Follow-up review required Stage 4 source sync, preflight, and app deploy commands to use the same reachable SSH target; updated all three to `124.71.43.80`.
- Result: in progress
- Commit:

### Step 4 — Remote Deploy Verification

- Command:
  - `docker build -f k8s/Dockerfile.ui-server -t dy-ui-server:0349-noapt .`
  - `docker build -f k8s/Dockerfile.remote-worker -t dy-remote-worker:0349-noapt .`
  - `docker run --rm dy-remote-worker:0349-noapt bun -e 'const r=await fetch("https://registry.npmjs.org/bun"); console.log("HTTPS_OK="+r.status)'`
  - `docker build --build-arg INSTALL_SYSTEM_CA=1 -f k8s/Dockerfile.ui-server -t dy-ui-server:0349-system-ca .`
  - `node scripts/tests/test_0349_remote_deploy_sync_contract.mjs`
  - `bash -n scripts/ops/sync_cloud_source.sh scripts/ops/deploy_cloud_app.sh scripts/ops/deploy_cloud_full.sh`
  - `git diff --check`
  - Sub-agent review of Bun image deploy unblock fix: first `CHANGE_REQUESTED`, then `APPROVED`.
  - `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision 45f2a81`
  - `ssh drop@124.71.43.80 'sudo -n env KUBECONFIG=/etc/rancher/rke2/rke2.yaml CTR=/usr/local/bin/ctr bash /home/wwpic/dongyuapp/scripts/ops/remote_preflight_guard.sh'`
  - `ssh drop@124.71.43.80 'sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_app.sh --target ui-server --revision 45f2a81'`
  - `ssh drop@124.71.43.80 'sudo -n env KUBECONFIG=/etc/rancher/rke2/rke2.yaml kubectl -n dongyu get deploy ui-server -o wide; sudo -n env KUBECONFIG=/etc/rancher/rke2/rke2.yaml kubectl -n dongyu get pods -l app=ui-server -o wide'`
  - Pod-level smoke through `kubectl exec -i deploy/ui-server -- bun -` against `/auth/login-model`, `/snapshot`, and `/`.
- Key output:
  - Local default no-apt Bun image build: PASS.
  - Local opt-in system CA rollback image build: PASS.
  - Local Bun HTTPS smoke without system CA: `HTTPS_OK=200`.
  - `node scripts/tests/test_0349_remote_deploy_sync_contract.mjs`: PASS.
  - `bash -n` deploy scripts: PASS.
  - `git diff --check`: PASS.
  - First Stage 4 sub-agent review found that the rollback switch existed only in Dockerfiles and was not reachable through deploy scripts.
  - Fixed `deploy_cloud_app.sh` and `deploy_cloud_full.sh` to accept `--install-system-ca`; tests and README now cover the pass-through.
  - Re-review returned `APPROVED`.
  - Remote DNS note: `dongyudigital.com` and `app.dongyudigital.com` currently resolve to `expired.hichina.com` / unrelated IPs, while SSH to `124.71.43.80` is reachable. Stage 4 therefore used the reachable SSH target and pod-level smoke for service proof.
  - Source sync to `124.71.43.80` succeeded through archive fallback because `45f2a81` is a local-only branch revision not present in remote git.
  - Remote revision stamp verified: `.deploy-source-revision = 45f2a81`.
  - Remote preflight: `REMOTE_RKE2_GATE: PASS`; node `apic-xc599-dongyu=v1.34.1+rke2r1`; resolved containerd socket `/run/k3s/containerd/containerd.sock`.
  - Remote build context: `11.21MB`.
  - Remote deploy used default fast path: `INSTALL_SYSTEM_CA=0`; Docker build printed `Skipping apt ca-certificates install; Bun HTTPS uses its bundled CA store.`
  - Remote `ui-server` rollout: `deployment "ui-server" successfully rolled out`.
  - Target source gate: six ui-server source hashes matched local vs pod.
  - Runtime state: deployment `ui-server` is `1/1`, pod `ui-server-7f99b45f65-2cs44` is `Running`, `RESTARTS=0`.
  - Pod-level smoke:
    - `/auth/login-model`: HTTP 200 with login ModelTable payload.
    - `/snapshot`: HTTP 200 with model snapshot payload.
    - `/`: HTTP 200 with Vite app HTML.
  - Disk after deploy: root filesystem `68%` used; Docker images `3.013GB`, reclaimable `1.783GB`.
- Result: PASS
- Commit: `45f2a81 fix(ops): unblock remote bun image deploy [0349]`

### Step 5 — Final Gate

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

## Docs Updated

- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
