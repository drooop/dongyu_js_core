---
title: "0306 — slide-pin-chain-routing-buildout Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-04-09
source: ai
iteration_id: 0306-slide-pin-chain-routing-buildout
id: 0306-slide-pin-chain-routing-buildout
phase: phase4
---

# 0306 — slide-pin-chain-routing-buildout Resolution

## Execution Strategy

- `0306` 覆盖两条并行验收线：
  1. `Model 100 submit` 进入合法 pin-chain
  2. slide/workspace 系统动作进入 `-10` handler pin.in
- 已迁移动作不再允许 direct fallback。
- 非 slide 主线的其它 legacy shortcut 暂不在本 IT 内清理。

## Step 1

- Scope:
  - 锁定 runtime ingress 与 `Model 100 + 系统动作` 新链路合同
- Files:
  - `scripts/tests/test_0306_runtime_mailbox_ingress_contract.mjs`
  - `scripts/tests/test_0306_model100_pin_chain_contract.mjs`
  - `scripts/tests/test_0306_workspace_system_pin_chain_contract.mjs`
- Verification:
  - 初始测试必须失败
  - 至少锁定：
    - mailbox 事件可被 runtime 转成 `Model 0 pin.bus.in`
    - `Model 100` 有新的 `submit_request` pin 入口与 wiring
    - `slide_app_import/create + ws_app_*` 有稳定的 `Model 0 -> -10 pin.in` 路由与 pin 定义
- Acceptance:
  - 新链路合同被自动化固定
- Rollback:
  - 回退新测试

## Step 2

- Scope:
  - 锁定 server-flow 验收和已迁移动作的 no-fallback 行为
- Files:
  - `scripts/tests/test_0306_model100_pin_chain_server_flow.mjs`
  - `scripts/tests/test_0306_workspace_system_pin_chain_server_flow.mjs`
  - `scripts/tests/test_0306_submit_fallback_server_flow.mjs`
- Verification:
  - 初始测试必须失败
  - 至少锁定：
    - `Model 100` 与系统动作都能独立走通新链路
    - 移除已迁移动作 route 时直接报错，不再兜底
- Acceptance:
  - buildout / no-fallback 两条口径都固定
- Rollback:
  - 回退新测试

## Step 3

- Scope:
  - 实现 runtime ingress、系统 handler pin buildout 与 host ctx 对齐
- Files:
  - `packages/worker-base/src/runtime.mjs`
  - `packages/worker-base/system-models/test_model_100_ui.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/intent_handlers_slide_import.json`
  - `packages/worker-base/system-models/intent_handlers_slide_create.json`
  - `packages/worker-base/system-models/intent_handlers_ws.json`
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - `Model 100 submit` 不再只能靠 direct positive-model `ui_event`
  - slide/workspace 系统动作不再只能靠 dispatch table / direct `run_func`
  - pin-chain 执行的负数 handler 可用 `hostApi / getState`
- Acceptance:
  - `0306` 双验收线成立
- Rollback:
  - 回退 runtime / model100 route 改动

## Step 4

- Scope:
  - 回归与本地部署验证
- Files:
  - `docs/iterations/0306-slide-pin-chain-routing-buildout/runlog.md`
- Verification:
  - `node scripts/tests/test_0306_runtime_mailbox_ingress_contract.mjs`
  - `node scripts/tests/test_0306_model100_pin_chain_contract.mjs`
  - `node scripts/tests/test_0306_workspace_system_pin_chain_contract.mjs`
  - `node scripts/tests/test_0306_model100_pin_chain_server_flow.mjs`
  - `node scripts/tests/test_0306_workspace_system_pin_chain_server_flow.mjs`
  - `node scripts/tests/test_0306_submit_fallback_server_flow.mjs`
  - `node scripts/tests/test_0305_submit_target_server_flow.mjs`
  - `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs`
  - `node scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs`
  - `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs`
  - `node scripts/tests/test_0303_color_generator_proxy_import_server_flow.mjs`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Acceptance:
  - 新链路、no-fallback、回归三条线都通过
- Rollback:
  - 回退本轮改动并重新部署本地
