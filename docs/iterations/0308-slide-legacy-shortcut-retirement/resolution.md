---
title: "0308 — slide-legacy-shortcut-retirement Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0308-slide-legacy-shortcut-retirement
id: 0308-slide-legacy-shortcut-retirement
phase: phase1
---

# 0308 — slide-legacy-shortcut-retirement Resolution

## Execution Strategy

1. 先锁定“应删除 / 应保留 / 基础设施”三类路径的失败测试。
2. 再删除 slide 主线的 action-based ingress 映射。
3. 用静态 request pin wiring 替代运行时动态 buildout。
4. 最后跑完整回归、本地部署和浏览器事实验证。

## Step 1

- Scope:
  - 锁定 0308 删除目标与保留边界
- Files:
  - `scripts/tests/test_0308_slide_legacy_action_retirement_contract.mjs`
  - `scripts/tests/test_0308_slide_legacy_action_retirement_server_flow.mjs`
  - `scripts/tests/test_0308_non_slide_action_compat_server_flow.mjs`
- Acceptance:
  - server 源码仍保留旧映射时测试先 FAIL
  - 删除后应看到：
    - slide legacy action 被拒绝
    - 非 slide legacy action 仍可用

## Step 2

- Scope:
  - 删除 slide action → ingress 的过渡层
- Files:
  - `packages/ui-model-demo-server/server.mjs`
- Acceptance:
  - 以下路径从正式 slide 主线中消失：
    - `RUNTIME_PIN_SYSTEM_ACTION_SPECS`
    - `_buildUiEventIngressPort`
    - `ensureRuntimePinSystemActionBuildout`
    - `routed_by=runtime_pin`
  - 已退役的 slide legacy action 必须统一报 `legacy_action_protocol_retired`

## Step 3

- Scope:
  - 用静态 wiring 替代动态 buildout
- Files:
  - `packages/worker-base/system-models/intent_handlers_slide_import.json`
  - `packages/worker-base/system-models/intent_handlers_slide_create.json`
  - `packages/worker-base/system-models/intent_handlers_ws.json`
- Acceptance:
  - `slide_app_import_request`
  - `slide_app_create_request`
  - `ws_select_app_request`
  - `ws_app_add_request`
  - `ws_app_delete_request`
  - 以上 request pin 均有静态 `pin.in + pin.connect.label` wiring

## Step 4

- Scope:
  - 回归、部署和页面事实验证
- Files:
  - `docs/iterations/0308-slide-legacy-shortcut-retirement/runlog.md`
  - `docs/user-guide/modeltable_user_guide.md`
- Acceptance:
  - `0289/0290/0302/0303/0305/0306/0307/0311/0308` 回归 PASS
  - docs audit PASS
  - 本地部署 PASS
  - 浏览器里至少确认：
    - 颜色生成器仍可生成颜色
    - 创建/删除 slide app 仍可用
