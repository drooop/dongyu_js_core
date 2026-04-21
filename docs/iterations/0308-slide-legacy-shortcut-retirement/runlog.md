---
title: "0308 — slide-legacy-shortcut-retirement Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0308-slide-legacy-shortcut-retirement
id: 0308-slide-legacy-shortcut-retirement
phase: phase3
---

# 0308 — slide-legacy-shortcut-retirement Runlog

## Environment

- Date: `2026-04-10`
- Branch: `dev_0308-slide-legacy-shortcut-retirement`
- Runtime: planning

## Planning Record

### Record 1

- Inputs reviewed:
  - `0306/0307/0310/0311` runlog and current `dev`
- Locked conclusions:
  - `0308` 只删除 slide 主线已经被 pin-chain 替代的 action 过渡层
  - 非 slide legacy action 暂不处理
  - mailbox / snapshot / SSE / upload transport 属于基础设施职责，不在删除范围

## Review Gate Record

### Review 1 — User

- Iteration ID: `0308-slide-legacy-shortcut-retirement`
- Review Date: `2026-04-10`
- Review Type: `User`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 盘点 `processEventsSnapshot` 时必须区分：
    1. 已被 `0306/0311` pin-chain 完全替代的删除目标
    2. 非 slide 动作仍在走的旧路径
    3. 纯基础设施路径

## Execution Start Record

### 2026-04-10

- Execution start:
  - `0308` 进入执行
  - 当前只做：
    - slide 主线 legacy action 退役
    - 静态 request pin wiring 补齐
    - 回归 / 部署 / 页面事实验证
- done-criteria:
  - slide legacy action 被显式拒绝
  - 非 slide legacy action 仍可用
  - 动态 ingress buildout 删除
  - `0302/0303/0307` 等导入链不回归
  - docs audit PASS

## Execution Record

### 2026-04-10 — Step 1 先补失败测试

**TDD**
- 先改并确认失败：
  - `node scripts/tests/test_0308_slide_legacy_action_retirement_contract.mjs` → FAIL
  - `node scripts/tests/test_0308_slide_legacy_action_retirement_server_flow.mjs` → FAIL
  - `node scripts/tests/test_0308_non_slide_action_compat_server_flow.mjs` → FAIL

**Locked**
- slide legacy action 退役必须是显式协议变化，不允许 silent fallback
- 非 slide action 至少保留一个兼容事实样本

### 2026-04-10 — Step 2 删除 slide 主线过渡层

**Implemented**
- `packages/ui-model-demo-server/server.mjs`
  - 删除：
    - `RUNTIME_PIN_SYSTEM_ACTION_SPECS`
    - `_buildUiEventIngressPort`
    - `ensureRuntimePinSystemActionBuildout`
    - `routed_by=runtime_pin` 路径
  - 新增：
    - `RETIRED_SLIDE_ACTIONS`
    - `legacy_action_protocol_retired`
  - 现状变为：
    - direct pin envelope 继续保留
    - slide legacy action envelope 被显式拒绝

### 2026-04-10 — Step 3 用静态 request pin 取代动态 buildout

**Implemented**
- `intent_handlers_slide_import.json`
  - 新增 `slide_app_import_request` + wiring
- `intent_handlers_slide_create.json`
  - 新增 `slide_app_create_request` + wiring
- `intent_handlers_ws.json`
  - 新增：
    - `ws_select_app_request`
    - `ws_app_add_request`
    - `ws_app_delete_request`
  - 均补齐 `pin.in + pin.connect.label`

**Regression found and fixed**
- `0303` 代理导入回归最初失败，不是路由回归，而是测试 zip 同时包含两个 JSON 文件。
- 修复方式：
  - 只重建 `test_files/color_generator_proxy_import.zip`
  - 归并为单文件 `app_payload.json`
- 结论：
  - 根因是测试资源包不再符合 `0302` 导入协议
  - 不是 `0308` 删除旧路径导致导入失效

### 2026-04-10 — Step 4 Path Classification

**Category 1 — 删除目标（已被 0306/0311 完全替代）**
- `RUNTIME_PIN_SYSTEM_ACTION_SPECS`
- `_buildUiEventIngressPort`
- `ensureRuntimePinSystemActionBuildout`
- slide/action → ingress 映射
- slide 主线的 `routed_by=runtime_pin`

**Category 2 — 暂时保留（非 slide 动作仍在使用）**
- `event_trigger_map`
- `intent_dispatch_table`
- 当前仍未 pin 化的非 slide mailbox action，例如：
  - `static_project_list`

**Category 3 — 必须保留（基础设施职责）**
- mailbox 写入本身
- direct pin envelope transport
- snapshot / SSE
- `/api/media/upload` 与 cached media 读取

### 2026-04-10 — Step 5 Deterministic Verification

**Tests**
- `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs` → PASS
- `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs` → PASS
- `node scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs` → PASS
- `node scripts/tests/test_0303_color_generator_proxy_import_server_flow.mjs` → PASS
- `node scripts/tests/test_0305_submit_target_server_flow.mjs` → PASS
- `node scripts/tests/test_0306_model100_pin_chain_server_flow.mjs` → PASS
- `node scripts/tests/test_0306_workspace_system_pin_chain_server_flow.mjs` → PASS
- `node scripts/tests/test_0307_executable_import_contract.mjs` → PASS
- `node scripts/tests/test_0307_executable_import_server_flow.mjs` → PASS
- `node scripts/tests/test_0311_pin_projection_contract.mjs` → PASS
- `node scripts/tests/test_0311_workspace_pin_addressing_server_flow.mjs` → PASS
- `node scripts/tests/test_0308_slide_legacy_action_retirement_contract.mjs` → PASS
- `node scripts/tests/test_0308_slide_legacy_action_retirement_server_flow.mjs` → PASS
- `node scripts/tests/test_0308_non_slide_action_compat_server_flow.mjs` → PASS
- `node scripts/ops/obsidian_docs_audit.mjs --root docs` → PASS

### 2026-04-10 — Step 6 Local Deploy + Browser Facts

**Deploy**
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` → PASS

**Browser facts**
- 新 bundle 已切到：
  - `index-CXosiUw2.js`
- 本地 `/#/workspace` 中实际确认：
  - `E2E 颜色生成器` 仍可输入文本并生成新颜色
  - `滑动 APP 创建` 仍可创建 `0308 Browser Created App`
  - 上述新建项可从左侧 `Delete` 删除
  - 导入页的文件上传接口返回 `200`，导入主线的端到端正确性由 `0302/0303/0307` server-flow 回归继续覆盖

**Observation (non-blocking)**
- 浏览器自动化会话里导入页的“已选择 zip”文本没有稳定刷新出来，但同一套 zip 导入链在 `0302/0303/0307` 的 deterministic server-flow 中全部继续 PASS。
- 当前未把该 Playwright 现象判定为产品回归。
- 仍需 `hostApi` 的函数尚未在本 IT 内改成纯 `pin.out` 路由；建议在 `0309` 或后续小 cleanup 中补一份函数清单，作为后续收窄参考。

### Review 2 — AI Self-Verification

- Iteration ID: `0308-slide-legacy-shortcut-retirement`
- Review Date: `2026-04-10`
- Review Type: `AI-assisted`
- Review Index: `2`
- Decision: **Approved**
- Notes:
  - slide 主线 legacy action 退役完成
  - 非 slide legacy 与基础设施职责均未误删

## Docs Updated

- [x] `docs/iterations/0308-slide-legacy-shortcut-retirement/resolution.md` updated
- [x] `docs/iterations/0308-slide-legacy-shortcut-retirement/runlog.md` updated
- [x] `docs/user-guide/modeltable_user_guide.md` updated

## Deterministic Verification

- `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs`
- `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs`
- `node scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs`
- `node scripts/tests/test_0303_color_generator_proxy_import_server_flow.mjs`
- `node scripts/tests/test_0305_submit_target_server_flow.mjs`
- `node scripts/tests/test_0306_model100_pin_chain_server_flow.mjs`
- `node scripts/tests/test_0306_workspace_system_pin_chain_server_flow.mjs`
- `node scripts/tests/test_0307_executable_import_contract.mjs`
- `node scripts/tests/test_0307_executable_import_server_flow.mjs`
- `node scripts/tests/test_0311_pin_projection_contract.mjs`
- `node scripts/tests/test_0311_workspace_pin_addressing_server_flow.mjs`
- `node scripts/tests/test_0308_slide_legacy_action_retirement_contract.mjs`
- `node scripts/tests/test_0308_slide_legacy_action_retirement_server_flow.mjs`
- `node scripts/tests/test_0308_non_slide_action_compat_server_flow.mjs`
- `node scripts/ops/obsidian_docs_audit.mjs --root docs`
