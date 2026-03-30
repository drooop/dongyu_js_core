---
title: "Cloud Deploy Remote Build Split Implementation Plan"
doc_type: note
status: active
updated: 2026-03-21
source: ai
---

# Cloud Deploy Remote Build Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the cloud deploy main path with remote source sync + remote build, and split remote deploy into `full` and `app` flows without touching forbidden `rke2` host boundaries.

**Architecture:** Keep `remote_preflight_guard.sh` as the single mandatory gate, then separate source synchronization from deployment execution. `deploy_cloud_full.sh` will own bootstrap/secrets/manifests, while `deploy_cloud_app.sh` will build and roll out only one target deployment at a time. Existing tar-based entrypoints stay only as fallback wrappers.

**Tech Stack:** Bash, git, rsync/scp, docker, ctr, kubectl, rke2, Node test scripts.

---

### Task 1: Add failing contract tests for the new deploy model

**Files:**
- Create: `scripts/tests/test_0183_cloud_remote_build_contract.mjs`
- Create: `scripts/tests/test_0183_cloud_split_deploy_contract.mjs`
- Modify: `scripts/ops/deploy_cloud.sh`
- Modify: `scripts/ops/deploy_cloud_ui_server_from_local.sh`

**Step 1: Write the failing tests**

Add tests that assert:
- `deploy_cloud.sh` is no longer the only concrete implementation entrypoint
- a remote-build path exists
- a split-deploy path exists with explicit `full` and `app` semantics
- `deploy_cloud_ui_server_from_local.sh` is no longer the canonical path

**Step 2: Run tests to verify they fail**

Run:
```bash
node scripts/tests/test_0183_cloud_remote_build_contract.mjs
node scripts/tests/test_0183_cloud_split_deploy_contract.mjs
```

Expected:
- FAIL because `scripts/ops/deploy_cloud_full.sh` and `scripts/ops/deploy_cloud_app.sh` do not exist yet
- FAIL because current scripts still contain `docker save -o ...` + `scp` canonical path

**Step 3: Commit the red state only if needed in runlog, not in git**

Do not commit failing tests alone unless they are part of a short-lived task branch state. Keep working tree local.

### Task 2: Implement remote source sync and revision gate

**Files:**
- Create: `scripts/ops/sync_cloud_source.sh`
- Modify: `scripts/ops/remote_preflight_guard.sh`
- Modify: `scripts/ops/README.md`
- Test: `scripts/tests/test_0183_cloud_remote_build_contract.mjs`

**Step 1: Write a failing focused assertion**

Extend the contract test to require:
- `sync_cloud_source.sh` exists
- it supports explicit revision and remote repo path
- it prefers git fetch/checkout and only falls back to file sync when needed

**Step 2: Run test to verify it fails**

Run:
```bash
node scripts/tests/test_0183_cloud_remote_build_contract.mjs
```

Expected:
- FAIL with missing `sync_cloud_source.sh` or missing revision/sync markers

**Step 3: Write minimal implementation**

Implement `scripts/ops/sync_cloud_source.sh` with:
- args for `--ssh-user`, `--ssh-host`, `--remote-repo`, `--revision`
- remote `git fetch --all --tags && git checkout <revision>` preferred path
- optional fallback sync for specific canonical files when remote repo is not usable
- explicit stdout for final remote revision

**Step 4: Run test to verify it passes**

Run:
```bash
node scripts/tests/test_0183_cloud_remote_build_contract.mjs
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add scripts/ops/sync_cloud_source.sh scripts/ops/remote_preflight_guard.sh scripts/tests/test_0183_cloud_remote_build_contract.mjs scripts/ops/README.md
git commit -m "feat: add remote source sync for cloud deploy"
```

### Task 3: Split full deploy from app deploy

**Files:**
- Create: `scripts/ops/deploy_cloud_full.sh`
- Create: `scripts/ops/deploy_cloud_app.sh`
- Modify: `scripts/ops/deploy_cloud.sh`
- Modify: `scripts/ops/_deploy_common.sh`
- Test: `scripts/tests/test_0183_cloud_split_deploy_contract.mjs`

**Step 1: Write the failing test**

Test should assert:
- `deploy_cloud_full.sh` owns bootstrap/full apply semantics
- `deploy_cloud_app.sh` requires `--target ui-server|mbr-worker|remote-worker`
- `deploy_cloud_app.sh` does not invoke synapse bootstrap / room creation / secret regeneration
- `deploy_cloud.sh` becomes a wrapper or compatibility entry, not the only implementation body

**Step 2: Run test to verify it fails**

Run:
```bash
node scripts/tests/test_0183_cloud_split_deploy_contract.mjs
```

Expected:
- FAIL because these files/markers do not exist yet

**Step 3: Write minimal implementation**

Implement:
- `deploy_cloud_full.sh`
  - preflight
  - env load
  - namespace/synapse/bootstrap/secrets/manifests
  - target image builds/imports
  - full rollout and source gate
- `deploy_cloud_app.sh`
  - preflight
  - target validation
  - remote build/import only for one target
  - rollout only that target
  - target-specific source hash verification
- `deploy_cloud.sh`
  - thin wrapper delegating to `deploy_cloud_full.sh`
  - preserve old args only as compatibility wrapper, not canonical docs target

**Step 4: Run test to verify it passes**

Run:
```bash
node scripts/tests/test_0183_cloud_split_deploy_contract.mjs
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add scripts/ops/deploy_cloud_full.sh scripts/ops/deploy_cloud_app.sh scripts/ops/deploy_cloud.sh scripts/ops/_deploy_common.sh scripts/tests/test_0183_cloud_split_deploy_contract.mjs
git commit -m "feat: split cloud full and app deploy flows"
```

### Task 4: Replace local tar transfer as the default fast path

**Files:**
- Modify: `scripts/ops/deploy_cloud_ui_server_from_local.sh`
- Modify: `scripts/ops/README.md`
- Test: `scripts/tests/test_0183_cloud_remote_build_contract.mjs`

**Step 1: Write the failing test**

Require that:
- local helper is marked fallback-only
- canonical path points to remote build scripts
- README no longer recommends `docker save + scp tar` as the default

**Step 2: Run test to verify it fails**

Run:
```bash
node scripts/tests/test_0183_cloud_remote_build_contract.mjs
```

Expected:
- FAIL because README and helper script still describe tar upload as recommended

**Step 3: Write minimal implementation**

Update:
- helper script banner/help text to say fallback-only
- README to promote:
  - `deploy_cloud_full.sh`
  - `deploy_cloud_app.sh --target ui-server`
- keep tar path only for explicit offline/manual fallback

**Step 4: Run test to verify it passes**

Run:
```bash
node scripts/tests/test_0183_cloud_remote_build_contract.mjs
node scripts/tests/test_0183_cloud_split_deploy_contract.mjs
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add scripts/ops/deploy_cloud_ui_server_from_local.sh scripts/ops/README.md scripts/tests/test_0183_cloud_remote_build_contract.mjs
git commit -m "docs: promote remote build cloud deploy path"
```

### Task 5: Verify locally and on remote rke2

**Files:**
- Modify: `docs/iterations/0183-cloud-deploy-remote-build-split/runlog.md`
- Optional Modify: `docs/ITERATIONS.md`

**Step 1: Run local static/contract verification**

Run:
```bash
node scripts/tests/test_0183_cloud_remote_build_contract.mjs
node scripts/tests/test_0183_cloud_split_deploy_contract.mjs
bash scripts/ops/remote_preflight_guard.sh --help
node scripts/ops/obsidian_docs_audit.mjs --root docs
```

Expected:
- PASS

**Step 2: Run remote app fast deploy verification**

Run:
```bash
bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp --revision "$(git rev-parse --short HEAD)"
ssh drop@124.71.43.80 'sudo -n /usr/local/sbin/dy-remote-preflight --quiet && echo PREFLIGHT_OK'
ssh drop@124.71.43.80 "sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_app.sh --target ui-server --revision $(git rev-parse --short HEAD)"
```

Expected:
- PASS
- only `ui-server` rollout changed

**Step 3: Run remote full deploy verification**

Run:
```bash
ssh drop@124.71.43.80 "sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh --revision $(git rev-parse --short HEAD)"
```

Expected:
- PASS
- full source gate and rollout pass

**Step 4: Run product acceptance**

Run:
```bash
bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url https://app.dongyudigital.com
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add docs/iterations/0183-cloud-deploy-remote-build-split/runlog.md
git commit -m "test: verify remote build split cloud deploy"
```

