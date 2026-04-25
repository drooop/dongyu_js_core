---
title: "Iteration 0185-ui-local-first-negative-state Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0185-ui-local-first-negative-state
id: 0185-ui-local-first-negative-state
phase: phase3
---

# Iteration 0185-ui-local-first-negative-state Runlog

## Environment

- Date: 2026-03-11
- Branch: dev_0185-ui-local-first-negative-state
- Runtime: local repo + remote-mode frontend audit

Review Gate Record
- Iteration ID: 0185-ui-local-first-negative-state
- Review Date: 2026-03-11
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: 用户明确批准继续执行，目标为修复新版规约下 UI 负数本地态的滞后问题。

## Execution Records

### Step 1

- Command:
  - `node scripts/tests/test_0185_remote_negative_state_local_first_contract.mjs`
- Key output:
  - 首轮红灯：`negative non-editor-state UI labels must also patch local snapshot immediately`
  - 二次红灯：`negative non-editor-state UI labels must materialize and patch local snapshot immediately`
- Result: PASS
- Commit: N/A

### Step 2

- Command:
  - `node scripts/tests/test_0185_remote_negative_state_local_first_contract.mjs`
  - `node scripts/tests/test_0177_model100_input_draft_contract.mjs`
  - `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - Browser:
    - `DY_AUTH=0 CORS_ORIGIN=http://127.0.0.1:5173 bun packages/ui-model-demo-server/server.mjs`
    - `npm -C packages/ui-model-demo-frontend run dev`
    - Playwright open `http://127.0.0.1:5173/?mode=remote&server=http://127.0.0.1:9000#/gallery`
- Key output:
  - 新测试 PASS，证明 remote store 现在会对负数本地态执行即时本地 patch，并在缺失模型/cell 时本地 materialize。
  - `test_0177_direct_model_mutation_disabled_contract` 继续 PASS，正数业务模型 direct mutation 未被放宽。
  - 浏览器实测：
    - 点击 Gallery slider 的 `increase number` 后，spinbutton 立即从 `0` 变为 `1`
    - 同步的 `Value:` 文本也立即从 `0` 变为 `1`
    - `window.__DY_STORE.snapshot.models['-102'].cells['0,3,0'].labels.slider_demo.v === 1`
- Result: PASS
- Commit: `1ffd27e`

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed

Review notes:
- 本轮修复属于 remote frontend store 的本地优先实现收口，不改变 `pin.bus.out` authority 或双总线规约；SSOT 无需改文。
