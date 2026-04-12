---
title: "0315 — workspace-sidebar-name-width Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-04-13
source: ai
iteration_id: 0315-workspace-sidebar-name-width
id: 0315-workspace-sidebar-name-width
phase: phase4
---

# 0315 — workspace-sidebar-name-width Resolution

## Execution Strategy

1. 先补失败测试，锁定左侧栏总宽不变、名字列变宽、`source / Actions` 压缩。
2. 再做最小 JSON 调整，不动行为代码。
3. 最后跑静态测试和本地页面真验。

## Step 1

- Scope:
  - 锁定 workspace 左侧栏列宽合同
- Files:
  - `scripts/tests/test_0315_workspace_sidebar_layout_contract.mjs`
- Verification:
  - 初始测试必须失败
- Acceptance:
  - 测试能锁住：
    - 侧栏宽度仍为 `260px`
    - `name` 列宽度提升
    - `source / Actions` 列宽度下降
- Rollback:
  - 删除新增测试

## Step 2

- Scope:
  - 调整 workspace 左侧栏列宽配置
- Files:
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
- Verification:
  - 新测试 PASS
  - 现有 workspace 相关回归 PASS
- Acceptance:
  - 总宽不变，app 名称空间变大
- Rollback:
  - 回退 `workspace_catalog_ui.json`

## Step 3

- Scope:
  - 本地验证与迭代记录
- Files:
  - `docs/iterations/0315-workspace-sidebar-name-width/runlog.md`
- Verification:
  - `node scripts/tests/test_0315_workspace_sidebar_layout_contract.mjs`
  - `node scripts/tests/test_0311_workspace_pin_addressing_server_flow.mjs`
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
  - 本地浏览器查看 Workspace 侧边栏
- Acceptance:
  - 记录中有 PASS 证据
- Rollback:
  - 回退本轮改动
