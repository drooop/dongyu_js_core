---
title: "0307 — slide-executable-app-import-v1 Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0307-slide-executable-app-import-v1
id: 0307-slide-executable-app-import-v1
phase: phase1
---

# 0307 — slide-executable-app-import-v1 Resolution

## Execution Strategy

1. 先锁定执行型导入安全策略与合同。
2. 再开放导入包中的 runtime `func.js`。
3. 最后用一个可导入示例同时验证：
   - 同 cell `func.js`
   - 事件继续走 root/helper pin 链

## Step 1

- Scope:
  - 锁定安全策略与合同
- Files:
  - `scripts/tests/test_0307_executable_import_contract.mjs`
- Acceptance:
  - `func.js` 被允许
  - `func.python / pin.bus.* / pin.connect.model / helper-override labels` 被拒绝

## Step 2

- Scope:
  - 锁定执行型导入 server flow
- Files:
  - `scripts/tests/test_0307_executable_import_server_flow.mjs`
- Acceptance:
  - 导入 app 可通过 pin 直寻址触发 imported `func.js`
  - 导入 app 可通过 root/helper pin 链完成一次后端写入

## Step 3

- Scope:
  - 实现执行型导入与最小示例包
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `test_files/`
- Acceptance:
  - 最小示例包可导入、可点击、可见状态变化

## Step 4

- Scope:
  - 回归、本地部署和浏览器真验
- Files:
  - `docs/iterations/0307-slide-executable-app-import-v1/runlog.md`
- Acceptance:
  - 回归通过，浏览器事实成立
