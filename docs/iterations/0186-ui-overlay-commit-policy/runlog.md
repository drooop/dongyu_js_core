---
title: "0186 — UI Overlay Commit Policy Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0186-ui-overlay-commit-policy
id: 0186-ui-overlay-commit-policy
phase: phase3
---

# 0186 — UI Overlay Commit Policy Runlog

## Environment

- Date: 2026-03-11
- Branch: `dev_0186-ui-overlay-commit-policy`
- Runtime: local repo implementation + deterministic tests

Review Gate Record
- Iteration ID: 0186-ui-overlay-commit-policy
- Review Date: 2026-03-11
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户在 `0187` 完成后明确批准继续执行 `0186`。

## Execution Records

### Step 1

- Command:
  - `git switch dev_0186-ui-overlay-commit-policy`
  - `git merge --ff-only dev_0187-remove-legacy-ui-egress-paths`
  - `apply_patch` add:
    - `scripts/tests/test_0186_remote_store_overlay_contract.mjs`
    - `scripts/tests/test_0186_renderer_commit_policy_contract.mjs`
  - `node scripts/tests/test_0186_remote_store_overlay_contract.mjs`
  - `node scripts/tests/test_0186_renderer_commit_policy_contract.mjs`
- Key output:
  - 红灯 FAIL：
    - `remote store must expose getEffectiveLabelValue for overlay-aware rendering`
    - `renderer must read effective overlay value when host exposes it`
- Result: PASS
- Commit: N/A

### Step 2

- Command:
  - `apply_patch` update:
    - `packages/ui-model-demo-frontend/src/remote_store.js`
    - `packages/ui-model-demo-frontend/src/demo_app.js`
    - `packages/ui-renderer/src/renderer.mjs`
    - `packages/ui-renderer/src/renderer.js`
  - `node scripts/tests/test_0186_remote_store_overlay_contract.mjs`
  - `node scripts/tests/test_0186_renderer_commit_policy_contract.mjs`
- Key output:
  - `PASS test_0186_remote_store_overlay_contract`
  - `PASS test_0186_renderer_commit_policy_contract`
- Result: PASS
- Commit: N/A

### Step 3

- Command:
  - `apply_patch` update:
    - `docs/ssot/runtime_semantics_modeltable_driven.md`
    - `docs/user-guide/modeltable_user_guide.md`
    - `docs/iterations/0186-ui-overlay-commit-policy/*`
  - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
  - `node scripts/tests/test_0185_remote_negative_state_local_first_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Key output:
  - `PASS validate_demo`
  - `PASS test_0185_remote_negative_state_local_first_contract`
  - frontend build PASS
  - docs audit PASS
- Result: PASS
- Commit: N/A

### Step 4 — real opt-in bindings + browser acceptance

- Command:
  - `apply_patch` update:
    - `packages/worker-base/system-models/workspace_positive_models.json`
    - `packages/ui-model-demo-frontend/src/gallery_model.js`
    - `packages/ui-model-demo-frontend/src/model100_ast.js`
    - `scripts/tests/test_0186_real_binding_opt_in_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `bash scripts/ops/start_local_ui_server_k8s_matrix.sh --port 9011 --force-kill-port --skip-baseline --workspace ws_0186_overlay_demo --data-root /tmp/dongyu_0186_runtime`
  - `node scripts/tests/test_0186_real_binding_opt_in_contract.mjs`
  - Playwright open `http://127.0.0.1:9011/?v=0186final#/workspace`
  - Playwright open `http://127.0.0.1:9011/?v=0186final#/gallery`
- Key output:
  - `PASS test_0186_real_binding_opt_in_contract`
  - real opt-in #1:
    - `workspace_positive_models.json` `input_value__bind.write.commit_policy = "on_submit"`
  - real opt-in #2:
    - `gallery_model.js` slider write declares `commit_policy: 'on_change'`
  - compatibility note:
    - `model100_ast.js` 也同步声明 `commit_policy: 'on_submit'`，保持静态 AST 与 schema 口径一致
  - browser evidence (`on_submit`):
    - typing `overlay submit final` updates textbox immediately
    - before submit: `/snapshot` still shows old `model100_input_draft`
    - after click `Generate Color`: `/snapshot` shows `draft = "overlay submit final"`
  - browser evidence (`on_change`):
    - during drag: `spin = "100"` but `/snapshot.slider_demo = 42`
    - after mouseup + 1.2s: `/snapshot.slider_demo = 100`
  - source-backed local server note:
    - `9011` clean workspace instance avoids stale SQLite and serves current frontend dist without waiting for k8s image rollout
- Result: PASS
- Commit: N/A

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed

## Execution Facts

- overlayStore kept separate from `snapshot.models`
- renderer now supports:
  - `commit_policy=on_change`
  - `commit_policy=on_blur`
  - `commit_policy=on_submit` (flush before action)
- default behavior for nodes without `commit_policy` remains unchanged
- real opt-in bindings exercised in this round:
  - `Model 100 input draft` (`on_submit`)
  - `Gallery slider_demo` (`on_change`)
