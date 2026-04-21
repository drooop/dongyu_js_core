---
title: "0239 — local-home-selector-model0-fix Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0239-local-home-selector-model0-fix
id: 0239-local-home-selector-model0-fix
phase: phase3
---

# 0239 — local-home-selector-model0-fix Runlog

## Environment

- Date: 2026-03-26
- Branch: `dropx/dev_0239-local-home-selector-model0-fix`
- Runtime: local home selector fix

## Execution Records

### Step 1 — Freeze Home Selector Contract

- Started: `2026-03-26 06:04:00 +0800`
- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '20,90p' docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '80,135p' packages/worker-base/system-models/home_catalog_ui.json`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "m\\.id !== 0|selected_model_id|uiPage !== 'workspace'|ensureLabel\\(runtime, stateModel, 0, 0, 0, \\{ k: 'selected_model_id'" packages/ui-model-demo-frontend/src/editor_page_state_derivers.js packages/ui-model-demo-server/server.mjs packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '565,590p' packages/ui-renderer/src/renderer.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '565,590p' packages/ui-renderer/src/renderer.js`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '210,330p' packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '2820,3065p' packages/ui-model-demo-server/server.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '160,215p' packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Key output:
  - `packages/worker-base/system-models/home_catalog_ui.json` 明确 Home 页 `sel_home_target_model` 的 `Select` 读取 `editor_model_options_json`，写回 `selected_model_id`。
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js:234` 当前仍有 `.filter((m) => Number.isInteger(m.id) && m.id !== 0)`，因此 inventory 不可能出现 `value == 0`。
  - `packages/ui-model-demo-server/server.mjs:2842` 只在启动时 `ensureStateLabel(runtime, 'selected_model_id', 'str', '0')`；真正的 reconcile 逻辑在 `packages/ui-model-demo-server/server.mjs:3041-3048`，且仅在 `uiPage === 'workspace'` 时才把 `selected_model_id` 对齐到 `ws_app_selected`，`home` 没有对应 canonical reset。
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js:195` 仍把首页 baseline 固定为 `selected_model_id = '1'`，与 server 初始 baseline `0` 不一致。
  - `packages/ui-renderer/src/renderer.mjs:570-586` 与 `packages/ui-renderer/src/renderer.js:570-586` 的 `Select` 都是直接把 snapshot 绑定值透传到 `props.modelValue`，没有额外 current-value 纠偏逻辑。
  - `docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md` 已把 Home selector 红灯固定为 `editor_options_has_model0 = false` 与 `selected_model_id = "1007"` 漂移；本次 Step 1 的源码结论与该证据一致。
- Adjudication:
  - Step 1 需要冻结的三条事实已经收敛：
    - Home `Select` 的 truth input 是 `editor_model_options_json` + `selected_model_id`
    - `deriveEditorModelOptions()` 当前主动排除了 `model0`
    - server 只有 `workspace` selection reconcile，local demo 首页 baseline 仍旧是 `1`
  - renderer 当前只是消费绑定值，不足以先验证明必须写入；是否需要触达 renderer 留给 Step 2/3 的 focused guard 再裁决。
  - 0239 目前仍可在 `inventory omission + home canonicalization gap + local/server baseline drift` 的解释下继续推进，无需扩大到 runtime 语义或 Home formal asset 合同。
- Conformance review:
  - tier placement: 未触达 Tier 1 runtime semantics，只确认 Home selector 问题位于 frontend/server projection 层。
  - model placement: `selected_model_id` 仍属于 `Model -2 / 0,0,0` UI state，未改 placement。
  - data ownership: Home selector 的 truth source 仍是 `Model -2` state labels 与模型 inventory，未引入 UI fallback truth source。
  - data flow / data chain: 当前断点明确位于 `deriveEditorModelOptions()` inventory、server `home` canonicalization 缺口、demo baseline 漂移三段链路。
- Result: PASS

### Step 2 — Add Focused Selector Guards

- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0239_home_selector_model0_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_selector_server_sse.mjs`
- Key output:
  - 首轮 focused guard 为红：
    - `server_home_selector_startup_model0_option_missing`
    - `server_home_route_must_reset_selected_model_to_zero ('1007' !== '0')`
    - `local_home_selector_startup_selected_model_must_be_zero ('1' !== '0')`
    - `local_home_route_must_reset_selected_model_to_zero ('-100' !== '0')`
    - `renderer_select_must_match_numeric_option_value_for_string_state ('0' !== 0)`
  - 初版 `validate_home_selector_server_sse.mjs` 采用 `startServer()` 时触发 `bun:sqlite is required for sqlite persistence`，说明 focused validator 不能依赖 sqlite persistence 或本地监听能力。
  - 据此把 0239 的最小红灯固定为 5 条：
    - inventory 缺 `model0`
    - server home route 缺 canonical reset
    - local demo home baseline 仍是 `1`
    - local home route 缺 canonical reset
    - renderer `Select` 对 `"0"` / `0` 没有 option value 对齐
- Adjudication:
  - Claude Code review 的 `NEEDS_CHANGES` 虽未列出 blocking list，但 branch 在本次执行前没有任何 0239 实现；真正 blocker 是 execution 未完成而不是单一已提交 patch 的局部瑕疵。
  - focused guard 已把 renderer 风险从“可能需要改”提升为“必须覆盖”，因此允许在 Step 3 触达 `packages/ui-renderer/src/renderer.mjs` 与 `packages/ui-renderer/src/renderer.js`。
- Conformance review:
  - tier placement: focused guard 仅覆盖 frontend/server projection 与 renderer consumption，未触达 runtime semantics。
  - model placement: 仍以 `Model -2 / 0,0,0` 为 selector state authority。
  - data ownership: 通过 guard 强制 `selected_model_id` / `editor_model_options_json` 继续作为 authority input，而不是 DOM fallback。
  - data flow / data chain: Step 2 已明确 inventory -> state reconcile -> renderer consumption 三段都必须纳入验证。
- Result: PASS

### Step 3 — Fix Minimal Home Selector State Chain

- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0239_home_selector_model0_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_selector_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_workspace_route_init_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - 修改文件：
    - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
    - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
    - `packages/ui-model-demo-server/server.mjs`
    - `packages/ui-renderer/src/renderer.mjs`
    - `packages/ui-renderer/src/renderer.js`
    - `scripts/tests/test_0239_home_selector_model0_contract.mjs`
    - `packages/ui-model-demo-frontend/scripts/validate_home_selector_server_sse.mjs`
  - 修复内容：
    - `deriveEditorModelOptions()` 不再过滤 `model0`
    - server 增加 `ui_page -> home` 的 canonical reset，并在 startup 先做 home baseline reconcile
    - local demo store 首页 baseline 从 `1` 对齐到 `0`，并在 `ui_page -> home` 事件后做同样的 reset
    - renderer `Select` 增加 option value 等值归一，允许 `"0"` 对齐 `0`
  - 验证结果：
    - `test_0239_home_selector_model0_contract.mjs` -> `5 passed, 0 failed out of 5`
    - `validate_home_selector_server_sse.mjs` -> `home_selector_server_sse: PASS`
    - `test_0212_home_crud_contract.mjs` -> `4 passed, 0 failed out of 4`
    - `test_0182_workspace_route_init_contract.mjs` -> `PASS test_0182_workspace_route_init_contract`
    - `validate_editor.mjs` -> editor validator 全量 PASS
    - `npm -C packages/ui-model-demo-frontend run build` -> `vite build` PASS（产物生成，存在 chunk size warning，但非失败）
- Adjudication:
  - 0239 现已同时关闭 inventory omission、home canonicalization gap、local/server baseline drift、renderer current-value mismatch 四类问题。
  - Workspace 现有同步合同保持绿色，说明修复没有把 `workspace -> selected_model_id` 的既有行为退化成全局 home reset。
- Conformance review:
  - tier placement: 未触达 `packages/worker-base/src/runtime.js` / `.mjs`。
  - model placement: `selected_model_id` 仍停留在 `Model -2`，没有迁移 truth source。
  - data ownership: Home selector authority 仍来自 state labels 与 model inventory。
  - data flow / data chain: route `ui_page -> home` 现在显式回到 canonical baseline，renderer 只做消费层等值匹配，不替代 state authority。
- Result: PASS

### Step 4 — Re-verify Live Local Readiness

- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node --input-type=module - <<'NODE' ... fetch('http://127.0.0.1:30900/ui_event') / fetch('http://127.0.0.1:30900/snapshot') ... NODE`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '(.snapshot.models["-2"].cells["0,0,0"].labels.ui_page.v == "home") and ((.snapshot.models["-2"].cells["0,0,0"].labels.selected_model_id.v == 0) or (.snapshot.models["-2"].cells["0,0,0"].labels.selected_model_id.v == "0")) and (.snapshot.models["-2"].cells["0,0,0"].labels.editor_model_options_json.v | any(.value == 0))'`
- Key output:
  - live probe 被当前执行沙箱拒绝：
    - `fetch failed -> connect EPERM 127.0.0.1:30900`
    - `curl ... | jq -e ...` -> `false`
  - 当前环境已确认禁止本地 `listen()` / `connect()`，因此本次 execution 只能给出 `repo-fixed / live-unverified`，不能宣称 `local environment effective`。
- Adjudication:
  - repo-side 0239 修复已完成并经 focused/non-regression/build 验证为 PASS。
  - live local `30900` probe 需要在允许本地网络连接的外层环境或后续 `0240` browser evidence rerun 中完成。
- Conformance review:
  - tier placement / model placement / data ownership / data flow: 本步无新增代码，仅记录验证环境边界。
- Result: PARTIAL (`repo-fixed / live-unverified`)

### Post-0239 Integration Recovery

- Date: `2026-03-26`
- Context:
  - 原始 `0239` batch 在 `REVIEW_EXEC` 因 prose parse false negative 停在 `On Hold`
  - 同时发现 `0235` 与 `0238` 的 completed fix 实际并未进入 `dev`
  - 因此通过 `0241-local-integration-recovery-for-0240` 先恢复主线，再在整合后的基线上承接本 iteration 的 selector 修复
- Git facts:
  - original selector fix commit on `dropx/dev_0239-local-home-selector-model0-fix`: `972b3a5`
  - recovered carrier commit on `dropx/dev_0241-local-integration-recovery-for-0240`: `30eac11`
  - merge commit into `dev`: `67cd8f5`
- Outer verification:
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `curl -fsS http://127.0.0.1:30900/snapshot | jq ...`
- Key output:
  - `ui_page = "home"`
  - `selected_model_id = "0"`
  - `editor_model_options_json` contains `value == 0`
- Adjudication:
  - 0239 的 selector fix 已在恢复后的主线上落地并完成 live 验证
  - original batch 的 parse false negative 不再构成实际 blocker
- Result: PASS (`selector fixed and carried through integration recovery`)

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] `docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md` reviewed
- [x] `docs/iterations/0239-local-home-selector-model0-fix/runlog.md` updated
- [x] Living docs review assessed:
  - `docs/ssot/runtime_semantics_modeltable_driven.md` -> no update required; no Tier 1 runtime semantics change
  - `docs/user-guide/modeltable_user_guide.md` -> no update required; no mailbox/PIN/reserved-model contract change

```
Review Gate Record
- Iteration ID: 0239-local-home-selector-model0-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 2
- Decision: On Hold
- Revision Type: N/A
- Notes: parse_failure: Could not parse verdict from review output

Review history:

```

```
Review Gate Record
- Iteration ID: 0239-local-home-selector-model0-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 3
- Decision: APPROVED
- Revision Type: N/A
- Notes: Manual review-plan acceptance after REVIEW_PLAN parse false negative. 0239 plan/resolution are self-contained, keep scope on home selector inventory/current-value canonicalization, and define concrete live snapshot/ui_event spot-checks for model0.
```

```
Review Gate Record
- Iteration ID: 0239-local-home-selector-model0-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 1
- Decision: NEEDS_CHANGES
- Revision Type: major
- Notes: # 0239 Execution Review
```

```
Review Gate Record
- Iteration ID: 0239-local-home-selector-model0-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 3
- Decision: On Hold
- Revision Type: N/A
- Notes: parse_failure: Could not parse verdict from review output

Review history:
  - Round 3 (REVIEW_PLAN): APPROVED [n/a]
  - Round 1 (REVIEW_EXEC): NEEDS_CHANGES [major]
```
