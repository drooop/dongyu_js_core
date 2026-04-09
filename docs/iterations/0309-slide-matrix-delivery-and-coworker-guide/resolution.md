---
title: "0309 — slide-matrix-delivery-and-coworker-guide Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-04-10
source: ai
iteration_id: 0309-slide-matrix-delivery-and-coworker-guide
id: 0309-slide-matrix-delivery-and-coworker-guide
phase: phase4
---

# 0309 — slide-matrix-delivery-and-coworker-guide Resolution

## Execution Strategy

1. 先核对 `0304/0308/0310/0311` 与 live code 的一致性，锁定正式说明边界。
2. 再输出一份给同事直接使用的正式说明文档，并把 preview 的定位降为历史预告。
3. 最后用当前稳定测试与文档导航更新闭环。

## Step 1

- Scope:
  - 核对 slide 导入与事件协议的 live 事实
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/worker-base/system-models/intent_dispatch_config.json`
  - `packages/worker-base/system-models/intent_handlers_slide_import.json`
  - `docs/user-guide/slide_matrix_delivery_preview_v0.md`
  - `docs/user-guide/slide_app_zip_import_v1.md`
  - `docs/user-guide/slide_executable_import_v1.md`
  - `docs/user-guide/modeltable_user_guide.md`
- Acceptance:
  - 明确 `0309` 正式文档只写当前稳定协议
  - 不再把 legacy `action` 写成正式入口
  - Matrix 交付边界被写清：
    - 交付单元 = zip
    - 交付媒介 = Matrix media `mxc://...`
    - 触发入口 = importer pin-chain

## Step 2

- Scope:
  - 产出正式同事说明文档并更新导航
- Files:
  - `docs/user-guide/slide_matrix_delivery_v1.md`
  - `docs/user-guide/README.md`
  - `docs/user-guide/slide_ui_mainline_guide.md`
  - `docs/user-guide/slide_matrix_delivery_preview_v0.md`
- Acceptance:
  - 同事文档能直接回答：
    - 包怎么准备
    - metadata 最小集是什么
    - slide app 消息现在怎么发
    - 事件链怎么走
    - 最短验证怎么做
  - preview 明确标成历史预告，不再冒充正式协议入口

## Step 3

- Scope:
  - 以当前稳定测试和静态检查验证文档口径
- Files:
  - `scripts/tests/test_0308_slide_legacy_action_retirement_server_flow.mjs`
  - `scripts/tests/test_0311_workspace_pin_addressing_server_flow.mjs`
  - `docs/iterations/0309-slide-matrix-delivery-and-coworker-guide/runlog.md`
- Acceptance:
  - 验证能同时覆盖：
    - legacy slide action 已退役
    - pin 直寻址导入链仍成立
  - runlog 记录 review / 执行 / PASS 证据

## Verification

- `node scripts/tests/test_0308_slide_legacy_action_retirement_server_flow.mjs`
- `node scripts/tests/test_0311_workspace_pin_addressing_server_flow.mjs`
- `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- `rg -n "slide_matrix_delivery_v1|slide_matrix_delivery_preview_v0" docs/user-guide/README.md docs/user-guide/slide_ui_mainline_guide.md docs/user-guide/slide_matrix_delivery_preview_v0.md`

## Rollback

- 删除 `docs/user-guide/slide_matrix_delivery_v1.md`
- 回退 `docs/user-guide/README.md`
- 回退 `docs/user-guide/slide_ui_mainline_guide.md`
- 回退 `docs/user-guide/slide_matrix_delivery_preview_v0.md`
- 回退 `docs/iterations/0309-slide-matrix-delivery-and-coworker-guide/*`
- 回退 `docs/ITERATIONS.md`
