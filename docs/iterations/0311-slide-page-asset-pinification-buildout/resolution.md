---
title: "0311 — slide-page-asset-pinification-buildout Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-04-09
source: ai
iteration_id: 0311-slide-page-asset-pinification-buildout
id: 0311-slide-page-asset-pinification-buildout
phase: phase4
---

# 0311 — slide-page-asset-pinification-buildout Resolution

## Execution Strategy

1. 先补失败测试，锁定 pin envelope、投影 `writable_pins` 和 6 类动作的 pin 直寻址行为。
2. 再实现前端协议和内置页面 pin 化。
3. 最后跑回归、本地部署和浏览器真验。

## Step 1

- Scope:
  - 锁定协议与投影合同
- Files:
  - `scripts/tests/test_0311_pin_projection_contract.mjs`
  - `scripts/tests/test_0311_pin_envelope_server_contract.mjs`
- Acceptance:
  - `writable_pins` 与 pin envelope 被自动化固定

## Step 2

- Scope:
  - 锁定 6 类动作的 pin 直寻址 server flow
- Files:
  - `scripts/tests/test_0311_model100_pin_addressing_server_flow.mjs`
  - `scripts/tests/test_0311_workspace_pin_addressing_server_flow.mjs`
- Acceptance:
  - `Model 100 submit` 与 workspace 系统按钮可脱离 `action` 路径独立成立

## Step 3

- Scope:
  - 实现投影 / renderer / server / local adapter / page asset pin 化
- Files:
  - `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/test_model_100_ui.json`
- Acceptance:
  - 6 类动作都可走 pin 直寻址

## Step 4

- Scope:
  - 回归与本地真验
- Files:
  - `docs/iterations/0311-slide-page-asset-pinification-buildout/runlog.md`
- Acceptance:
  - 回归通过，浏览器里可实际点击验证
