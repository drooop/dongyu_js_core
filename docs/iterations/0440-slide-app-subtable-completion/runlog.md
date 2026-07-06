---
title: "Iteration 0440 Slide App Subtable Completion Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-07-06
source: ai
iteration_id: 0440-slide-app-subtable-completion
id: 0440-slide-app-subtable-completion
phase: phase6
---

# Iteration 0440-slide-app-subtable-completion Runlog

## Environment

- Date: 2026-07-06
- Branch: `dropx/dev_0440-slide-app-subtable-completion`
- Runtime: local repo, Node-based deterministic tests
- Intake correction: 0439 completed only a To Do slice; this iteration restores the user's full four-part objective.

## Phase 1 Planning Records

### Planning Record — Current State Rebuild

- Command: `git status --short --branch`
- Key output: `## dev...origin/dev` before branch creation, then new branch `dropx/dev_0440-slide-app-subtable-completion`.
- Result: PASS

### Planning Record — Source App Export Probe

- Command: `node --input-type=module - <<'NODE' ... createServerState + buildSlideAppExportPayload probe ... NODE`
- Key output:
  - Existing seeded sources after 0439: `100` and `1086`.
  - Direct export with missing metadata still failed for most remaining built-ins as `missing_slide_root_metadata`.
  - Export with normalized root metadata passed for `1007`, `1011`, `1036`, `1051`, `1080`, `1081`, `1082`, `1083`, and `1086`.
  - `1030` passed after blank `from_user`/`to_user` were replaced.
  - `1034` and `1037` passed after adding missing summary, but they are not in the current visible Workspace entry allowlist.
- Result: PASS

## Review Gate Records

Review Gate Record
- Iteration ID: 0440-slide-app-subtable-completion
- Review Date: 2026-07-06
- Review Type: AI-assisted
- Review Index: 1
- Decision: Approved
- Notes: Workflow review found 0440 registered before implementation, Phase 1 remained docs-only, Step 1 starts with RED coverage, and rollback/verification are explicit for every step.

Review Gate Record
- Iteration ID: 0440-slide-app-subtable-completion
- Review Date: 2026-07-06
- Review Type: AI-assisted
- Review Index: 2
- Decision: Approved
- Notes: SSOT review found the plan aligned with child-side `model.subtable`, host-side `model.subtableconnection`, table-qualified `ModelRef`, principal-scoped App table ownership, and fail-closed snapshot access.

Review Gate Record
- Iteration ID: 0440-slide-app-subtable-completion
- Review Date: 2026-07-06
- Review Type: AI-assisted
- Review Index: 3
- Decision: Approved
- Notes: Verification review found the scope now covers the user's four requested outcomes, including remaining user-facing Apps, RemoteWorker provider contracts, visible snapshot closure, A/B isolation, local browser verification, and developer docs.

## Execution Records

### Step 1 — Inventory And RED Contract

- Command:
  - `node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs`
- Key output:
  - `workspace_allowlist_must_not_expose_host_source_model_1007`
  - `source_100_must_have_exactly_one_app_table_entry`
  - `source_1007_must_have_exactly_one_app_table_entry`
  - `developer_guide_must_document:\`source_worker\` / \`source_de\` / \`from_user\` / \`to_user\``
  - `0 passed, 5 failed out of 5`
- Result: PASS (expected RED failure proving 0440 scope is not complete on the current baseline)
- Commit: `4538018`

### Step 2 — Generalize Seeded App Table Migration

- Command:
  - `node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
  - `node scripts/tests/test_0412_todo_provider_app1_contract.mjs`
- Key output:
  - `5 passed, 0 failed out of 5`
  - `10 passed, 0 failed out of 10`
  - `PASS test_0412_todo_provider_app1_contract`
- Result: PASS
- Commit: `082cb10`

### Step 3 — Snapshot Closure And Permission Isolation

- Command:
  - `node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs`
  - `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
  - `node scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
- Key output:
  - `5 passed, 0 failed out of 5`
  - `6 passed, 0 failed`
  - `4 passed, 0 failed`
  - `PASS 8/8`
  - `5 passed, 0 failed out of 5`
- Result: PASS
- Commit: `082cb10`

### Step 4 — Frontend Projection And App Identity

- Command:
  - `node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs`
  - `node scripts/tests/test_0382_workspace_entry_cleanup_contract.mjs`
  - `node scripts/tests/test_0383_matrix_suite_slide_app_contract.mjs`
  - `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
  - `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `npm -C packages/ui-model-demo-frontend run test`
- Key output:
  - `12 passed, 0 failed out of 12`
  - `test_0382_workspace_entry_cleanup_contract: PASS`
  - `5 passed, 0 failed out of 5`
  - `7 passed, 0 failed out of 7`
  - `6 passed, 0 failed out of 6`
  - `vite build ... built`
  - `editor_*: PASS`
- Result: PASS
- Commit: `082cb10`

### Step 5 — Developer Documentation

- Command:
  - `node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs`
  - `node scripts/tests/test_0439_todo_subtable_view_snapshot_contract.mjs`
  - `node scripts/tests/test_0353_slide_app_runtime_docs_publish_contract.mjs`
- Key output:
  - `developer_guide_documents_full_subtable_worker_authoring_path`
  - `6 passed, 0 failed out of 6`
  - `5 passed, 0 failed out of 5`
- Result: PASS
- Commit: `082cb10`

### Step 6 — Local Deploy And Browser Verification

- Command:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `kubectl get deploy,pods --all-namespaces`
  - `curl -sS --max-time 10 'http://127.0.0.1:9107/snapshot?profile=bootstrap' | node -e '...'`
  - Playwright browser verification at `http://127.0.0.1:9107/` with `DY_AUTH=0` local fake login
- Key output:
  - Local deploy built and rolled out `remote-worker`, `workspace-manager`, `mbr-worker`, and `ui-server`; the deploy script's final old-pod termination check initially saw terminating pods, then `kubectl get deploy,pods --all-namespaces` showed all four core `dongyu` deployments at `1/1` and new pods `Running`.
  - K8s `http://127.0.0.1:30900/auth/status` returns `login_required` for an unauthenticated request, so user-flow browser verification used the local fake-login server rather than treating an unauthenticated K8s page as a valid app check.
  - Local fake-login bootstrap: `runtime=ready`, `registryCount=14`.
  - Bootstrap registry contained 12 migrated App table roots plus two host built-ins:
    - `滑动 APP 导入` source `1030`
    - `E2E 颜色生成器` source `100`
    - `Matrix Chat` source `1083`
    - `Matrix Suite` source `1080`
    - `Mgmt Bus Console` source `1036`
    - `ModelTable` source `1082`
    - `Settings` source `1081`
    - `工作区管理器` source `1051`
    - `Static` source `1011`
    - `最小 Submit 双总线示例` source `1050`
    - `Three Scene` source `1007`
    - `To Do Board` source `1086`
    - host built-ins: `Gallery`, `Docs`
  - Playwright result: `missing=[]`, `expectedCount=12`, `appCardCount=14`.
  - Playwright opened `Settings`, `Matrix Chat`, `工作区管理器`, `最小 Submit 双总线示例`, and `To Do Board`; every one showed `Workspace app · model 0`.
- Result: PASS
- Commit: pending completion docs commit

## Docs Updated

- [x] `docs/iterations/0440-slide-app-subtable-completion/plan.md`
- [x] `docs/iterations/0440-slide-app-subtable-completion/resolution.md`
- [x] `docs/user-guide/modeltable_user_guide.md`
- [x] `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md`
- [x] `docs/ITERATIONS.md`

## Living Docs Review

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` considered through existing `model.subtable` / `model.subtableconnection` contract; no Phase 1 SSOT edit needed.
- [x] `docs/ssot/principal_scoped_subtable_namespace_v1.md` considered for table-qualified App instance isolation.
- [x] `docs/user-guide/modeltable_user_guide.md` updated so it no longer describes migrated positive source host models as user-facing Workspace entries.
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed; completion is backed by PASS evidence in this runlog.
