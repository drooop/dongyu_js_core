---
title: "0305 — slide-event-target-and-deferred-input-sync Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-04-09
source: ai
iteration_id: 0305-slide-event-target-and-deferred-input-sync
id: 0305-slide-event-target-and-deferred-input-sync
phase: phase4
---

# 0305 — slide-event-target-and-deferred-input-sync Runlog

## Environment

- Date: `2026-04-09`
- Branch: `dev_0305-slide-event-target-and-deferred-input-sync`
- Runtime: planning

## Planning Record

### Record 1

- Inputs reviewed:
  - [[docs/iterations/0304-slide-runtime-scope-semantics-freeze/runlog]]
  - [[docs/iterations/0305-slide-event-target-and-deferred-input-sync/plan]]
  - [[docs/iterations/0305-slide-event-target-and-deferred-input-sync/resolution]]
  - [[docs/user-guide/modeltable_user_guide]]
- Locked conclusions:
  - `0305` 需要同时处理：
    - 事件目标合同升级
    - 正数模型 Input 延后同步
  - 事件目标合同采用过渡式兼容：
    - 新增 `target.model_id/p/r/c`
    - 兼容期保留 `meta.model_id`
  - 正数模型 Input 的最小可交付落点选 `0290` 创建出来的 slide app

## Review Gate Record

### Review 1 — AI-assisted

- Iteration ID: `0305-slide-event-target-and-deferred-input-sync`
- Review Date: `2026-04-09`
- Review Type: `AI-assisted`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 从合同角度看，`0305` 的两个验收点彼此独立，适合在一个 IT 内分开验证。

### Review 2 — AI-assisted

- Iteration ID: `0305-slide-event-target-and-deferred-input-sync`
- Review Date: `2026-04-09`
- Review Type: `AI-assisted`
- Review Index: `2`
- Decision: **Approved**
- Notes:
  - 从实现边界看，`0305` 不进入 `Model 0 -> pin-chain` 建设，也不拆旧路径，范围清楚。

### Review 3 — AI-assisted

- Iteration ID: `0305-slide-event-target-and-deferred-input-sync`
- Review Date: `2026-04-09`
- Review Type: `AI-assisted`
- Review Index: `3`
- Decision: **Approved**
- Notes:
  - 从验证路径看，`0305` 可先用 built-in `Model 100` 和 `0290` creator app 完成双验收点证明，再把 `0306` 留给合法链路建设。

## Execution Start Record

### 2026-04-09

- Execution start:
  - `0305` 从 AI gate 进入执行
  - 当前只处理两件事：
    - 事件目标合同升级
    - 正数模型 Input 延后同步
- done-criteria:
  - submit 事件 envelope 带 `target.model_id/p/r/c`
  - cellwise app 节点可把当前单元格坐标传给 renderer
  - 至少一个正数模型 slide 输入明确使用 `on_blur`
  - `0290/0303` 不回归
  - docs audit PASS

## Execution Record

### 2026-04-09 — Step 1 事件目标合同

**TDD**
- 先改并确认失败：
  - `node scripts/tests/test_0177_model100_submit_ui_contract.mjs` → FAIL
  - `node scripts/tests/test_0305_event_target_contract.mjs` → FAIL

**Implemented**
- `Model 100` submit 现在显式带：
  - `target.model_id = 100`
  - `target.p = 0`
  - `target.r = 0`
  - `target.c = 0`
- cellwise AST 现在为每个节点保留 `cell_ref`
- renderer 对业务动作在无显式 `target_ref` 时，会回退到节点的 `cell_ref`
- server 在兼容期同时接受：
  - `meta.model_id`
  - `payload.target.model_id/p/r/c`
- 对 submit 业务事件，server 现在会把 `target` 保留进标准化事件对象，供后续 `0306` 使用

**Files**
- `packages/ui-model-demo-frontend/src/model100_ast.js`
- `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`
- `packages/ui-renderer/src/renderer.mjs`
- `packages/ui-renderer/src/renderer.js`
- `packages/ui-model-demo-server/server.mjs`
- `packages/worker-base/system-models/workspace_positive_models.json`

### 2026-04-09 — Step 2 正数模型 Input 延后同步

**TDD**
- 先改并确认失败：
  - `node scripts/tests/test_0290_slide_app_filltable_create_contract.mjs` → FAIL

**Implemented**
- `0290` 生成出来的正数模型 slide 输入，当前明确使用：
  - `commit_policy = on_blur`
- 新增正数模型延后同步行为测试：
  - `scripts/tests/test_0305_positive_input_deferred_contract.mjs`
- `0290` server-flow 测试补了动态断言，确认创建后的实际 bind 也是 `on_blur`

**Files**
- `packages/ui-model-demo-server/server.mjs`
- `scripts/tests/test_0290_slide_app_filltable_create_contract.mjs`
- `scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs`
- `scripts/tests/test_0305_positive_input_deferred_contract.mjs`

### 2026-04-09 — Step 3 Deterministic Verification

**Tests**
- `node scripts/tests/test_0177_model100_submit_ui_contract.mjs` → PASS
- `node scripts/tests/test_0305_event_target_contract.mjs` → PASS
- `node scripts/tests/test_0305_submit_target_server_flow.mjs` → PASS
- `node scripts/tests/test_0305_positive_input_deferred_contract.mjs` → PASS
- `node scripts/tests/test_0290_slide_app_filltable_create_contract.mjs` → PASS
- `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs` → PASS
- `node scripts/tests/test_0303_color_generator_proxy_import_server_flow.mjs` → PASS

### 2026-04-09 — Step 4 Local Deploy + Browser Facts

**Deploy**
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` → PASS

**Browser facts**
- 本地 `/#/workspace` 可显式打开：
  - `E2E 颜色生成器`
- 本地 headless Chrome 验证了正数模型 slide 输入的 `on_blur`：
  - 先创建测试 app `0305 Browser App 1775737493312`
  - 对应 truth model = `1042`
  - 编辑前 `body_text = "0305 body seed"`
  - 输入但未 blur 时，committed snapshot 仍为 `"0305 body seed"`
  - 执行 DOM `blur()` 后，committed snapshot 变为 `"0305 body blur commit"`
- 本地测试 app 已清理：
  - `0305 Browser App*` 不再留在 registry

### Review 4 — AI Self-Verification

- Iteration ID: `0305-slide-event-target-and-deferred-input-sync`
- Review Date: `2026-04-09`
- Review Type: `AI-assisted`
- Review Index: `4`
- Decision: **Approved**
- Notes:
  - 事件目标合同和正数输入延后同步两条验收线都已通过
  - `0290/0303` 回归未被打坏

## Docs Updated

- [x] `docs/iterations/0305-slide-event-target-and-deferred-input-sync/resolution.md` updated
- [x] `docs/iterations/0305-slide-event-target-and-deferred-input-sync/runlog.md` updated
- [x] `docs/user-guide/modeltable_user_guide.md` updated
- [x] `docs/user-guide/slide_app_filltable_create_v1.md` updated
- [x] `docs/user-guide/slide_matrix_delivery_preview_v0.md` updated

## Execution Start Record

### 2026-04-09

- Execution start:
  - `0305` 从 AI gate 进入执行
  - 本轮只做两件事：
    - 事件目标合同升级
    - 正数模型 Input 延后同步
- done-criteria:
  - submit 事件能带 `target.model_id/p/r/c`
  - 正数模型 slide 输入至少有一个真实 `on_blur` 落点
  - `0290/0303` 不回归
  - docs audit PASS

## Execution Record

### 2026-04-09 — Step 1 事件目标合同

**TDD**
- 先改测试并确认失败：
  - `node scripts/tests/test_0177_model100_submit_ui_contract.mjs` → FAIL
  - `node scripts/tests/test_0305_event_target_contract.mjs` → FAIL

**Implemented**
- `Model 100` submit 绑定现在显式带：
  - `target.model_id = 100`
  - `target.p = 0`
  - `target.r = 0`
  - `target.c = 0`
- cellwise AST 现在会把当前单元格坐标保存在 `cell_ref`
- renderer 在业务动作没有显式 `target_ref` 时，会回退到节点自身 `cell_ref`
- server 兼容接收：
  - `meta.model_id`
  - `payload.target.model_id/p/r/c`
  并把 `target` 保留进业务事件对象

**Files**
- `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`
- `packages/ui-model-demo-frontend/src/model100_ast.js`
- `packages/ui-renderer/src/renderer.mjs`
- `packages/ui-renderer/src/renderer.js`
- `packages/ui-model-demo-server/server.mjs`
- `packages/worker-base/system-models/workspace_positive_models.json`

### 2026-04-09 — Step 2 正数模型 Input 延后同步

**TDD**
- 先改测试并确认失败：
  - `node scripts/tests/test_0290_slide_app_filltable_create_contract.mjs` → FAIL

**Implemented**
- `0290` 生成的正数模型 slide 输入现在明确采用：
  - `commit_policy = on_blur`
- 新增正数模型延后同步行为测试：
  - `node scripts/tests/test_0305_positive_input_deferred_contract.mjs` → PASS

**Files**
- `packages/ui-model-demo-server/server.mjs`
- `scripts/tests/test_0290_slide_app_filltable_create_contract.mjs`
- `scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs`
- `scripts/tests/test_0305_positive_input_deferred_contract.mjs`

### 2026-04-09 — Step 3 Deterministic Verification

**Tests**
- `node scripts/tests/test_0177_model100_submit_ui_contract.mjs` → PASS
- `node scripts/tests/test_0305_event_target_contract.mjs` → PASS
- `node scripts/tests/test_0305_submit_target_server_flow.mjs` → PASS
- `node scripts/tests/test_0305_positive_input_deferred_contract.mjs` → PASS
- `node scripts/tests/test_0290_slide_app_filltable_create_contract.mjs` → PASS
- `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs` → PASS
- `node scripts/tests/test_0303_color_generator_proxy_import_server_flow.mjs` → PASS

### 2026-04-09 — Step 4 Local Browser Verification

**Deploy**
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` → PASS

**Browser facts**
- 本地 `/#/workspace` 中显式打开 `E2E 颜色生成器` 后：
  - 输入框与 `Generate Color` 按钮可见
- 本地通过 headless Chrome 脚本验证了正数模型 slide 输入的 `on_blur`：
  - 创建测试 app 后，truth model = `1042`
  - 编辑前 `body_text = "0305 body seed"`
  - 输入但未 blur 时，committed snapshot 仍是 `"0305 body seed"`
  - 执行 `blur()` 后，committed snapshot 变成 `"0305 body blur commit"`
- 本地测试 app 已清理：
  - `0305 Browser App*` 不再出现在 registry

### Review 4 — AI Self-Verification

- Iteration ID: `0305-slide-event-target-and-deferred-input-sync`
- Review Date: `2026-04-09`
- Review Type: `AI-assisted`
- Review Index: `4`
- Decision: **Approved**
- Notes:
  - 两个独立验收点都已通过
  - `0290/0303` 回归通过

## Docs Updated

- [x] `docs/iterations/0305-slide-event-target-and-deferred-input-sync/resolution.md` updated
- [x] `docs/iterations/0305-slide-event-target-and-deferred-input-sync/runlog.md` updated
- [x] `docs/user-guide/modeltable_user_guide.md` updated
- [x] `docs/user-guide/slide_app_filltable_create_v1.md` updated
- [x] `docs/user-guide/slide_matrix_delivery_preview_v0.md` updated

## Deterministic Verification

- `node scripts/tests/test_0177_model100_submit_ui_contract.mjs`
- `node scripts/tests/test_0305_event_target_contract.mjs`
- `node scripts/tests/test_0305_submit_target_server_flow.mjs`
- `node scripts/tests/test_0305_positive_input_deferred_contract.mjs`
- `node scripts/tests/test_0290_slide_app_filltable_create_contract.mjs`
- `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs`
- `node scripts/tests/test_0303_color_generator_proxy_import_server_flow.mjs`
- `node scripts/ops/obsidian_docs_audit.mjs --root docs`
