---
title: "0305 — slide-event-target-and-deferred-input-sync Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0305-slide-event-target-and-deferred-input-sync
id: 0305-slide-event-target-and-deferred-input-sync
phase: phase1
---

# 0305 — slide-event-target-and-deferred-input-sync Resolution

## Execution Strategy

- `0305` 同时覆盖两个独立验收点：
  1. 事件目标合同升级
  2. 正数模型 Input 延后同步
- 两个验收点共享一轮实现，但验证必须分开记录。
- 执行顺序固定为：
  1. 写失败测试锁定事件目标合同
  2. 写失败测试锁定正数模型 Input 延后同步
  3. 改前端 AST / renderer / server 合同
  4. 改正数模型 slide 输入示例
  5. 跑回归并回写 runlog

## Step 1

- Scope:
  - 锁定事件目标合同
- Files:
  - `scripts/tests/test_0305_event_target_contract.mjs`
  - `scripts/tests/test_0177_model100_submit_ui_contract.mjs`
- Verification:
  - 初始测试必须失败
  - 至少锁定：
    - `Model 100` submit 具备当前模型 / 当前单元格目标坐标
    - cellwise app 节点可向 renderer 暴露当前单元格坐标
- Acceptance:
  - 事件目标合同有明确自动化口径
- Rollback:
  - 回退新测试

## Step 2

- Scope:
  - 锁定正数模型 Input 延后同步
- Files:
  - `scripts/tests/test_0305_positive_input_deferred_contract.mjs`
  - `scripts/tests/test_0290_slide_app_filltable_create_contract.mjs`
- Verification:
  - 初始测试必须失败
  - 至少锁定：
    - 正数模型 slide 输入不应每次键入都立即双总线
    - 当前正数 slide 示例至少有一个明确的延后同步 commit_policy
- Acceptance:
  - 正数模型输入延后同步口径被测试固定
- Rollback:
  - 回退新测试

## Step 3

- Scope:
  - 实现事件目标合同
- Files:
  - `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`
  - `packages/ui-model-demo-frontend/src/model100_ast.js`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - submit 事件 envelope 必须带：
    - `target.model_id`
    - `target.p`
    - `target.r`
    - `target.c`
  - 兼容期允许继续保留 `meta.model_id`
- Acceptance:
  - 事件目标合同在 built-in 与 cellwise slide app 上都成立
- Rollback:
  - 回退事件合同相关代码

## Step 4

- Scope:
  - 落一个正数模型 slide 输入的延后同步示例
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs`
- Verification:
  - `0290` 创建出来的正数模型 slide 输入至少明确采用 `on_blur` 或等价延后策略
  - 现有 overlay / commit 流程仍通过
- Acceptance:
  - 正数模型 slide 输入不再默认逐键同步
- Rollback:
  - 回退示例 payload / bind 策略

## Step 5

- Scope:
  - 回归与收口
- Files:
  - `docs/iterations/0305-slide-event-target-and-deferred-input-sync/runlog.md`
  - `docs/user-guide/modeltable_user_guide.md`
- Verification:
  - `node scripts/tests/test_0305_event_target_contract.mjs`
  - `node scripts/tests/test_0305_positive_input_deferred_contract.mjs`
  - `node scripts/tests/test_0290_slide_app_filltable_create_contract.mjs`
  - `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs`
  - `node scripts/tests/test_0303_color_generator_proxy_import_server_flow.mjs`
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Acceptance:
  - 两个验收点分别通过，且 `0290/0303` 不回归
- Rollback:
  - 回退本轮改动与文档
