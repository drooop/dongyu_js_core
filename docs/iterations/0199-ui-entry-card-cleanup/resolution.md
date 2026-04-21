---
title: "Iteration 0199-ui-entry-card-cleanup Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0199-ui-entry-card-cleanup
id: 0199-ui-entry-card-cleanup
phase: phase1
---

# Iteration 0199-ui-entry-card-cleanup Resolution

## Execution Strategy

- 先审计 `Card` 的实际渲染路径，确认 `[object Object]` 根因是“绕过解析后的 props”，而不是 `$label` getter 或 state seed。
- 再做两项最小实现：
  - renderer 使用解析后的 `props.title`
  - `nav_catalog_ui` 将 `gallery/docs/static` 标记为 `nav_visible: false`
- 最后用合同测试 + 本地 UI 验证收口，并把本轮与 `0200` 的边界记录清楚。

## Step 1

- Scope:
  - 审计 `Card` 在 renderer 中的 tree/runtime 两条路径
  - 审计 `nav_catalog_ui` 当前 Header 可见项
  - 固化产品入口决策：Header 只保留 `首页 / Workspace / Prompt`
- Files:
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/nav_catalog_ui.json`
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - `rg -n "type === 'Card'|resolveRefsDeep|ws_selected_title|nav_visible" packages/ui-renderer/src/renderer.mjs packages/worker-base/system-models/workspace_catalog_ui.json packages/worker-base/system-models/nav_catalog_ui.json packages/ui-model-demo-server/server.mjs`
  - `node -e "const fs=require('fs'); const p='packages/worker-base/system-models/nav_catalog_ui.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); const items=j.records.find(r=>r.k==='nav_catalog_v0').v; console.log(items.filter(x=>x.nav_visible).map(x=>x.page).join(','));"`
- Acceptance:
  - `[object Object]` 根因被记录为 renderer `Card.title` 使用了原始 `node.props`
  - Header 当前可见页清单明确
  - 本轮仅处理 `Card.title` 与 `gallery/docs/static` 的 Header 可见性
- Rollback:
  - 本步只记录事实，无代码回滚需求

## Step 2

- Scope:
  - 修复 `Card.title` 使用已解析的 `props.title`
  - 将 `gallery / docs / static` 从 Header 隐藏
  - 增加最小合同测试
- Files:
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/worker-base/system-models/nav_catalog_ui.json`
  - `scripts/tests/test_0199_card_title_label_resolution.mjs`
  - `scripts/tests/test_0199_nav_catalog_visibility_contract.mjs`
- Verification:
  - `node scripts/tests/test_0199_card_title_label_resolution.mjs`
  - `node scripts/tests/test_0199_nav_catalog_visibility_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
  - `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `node scripts/tests/test_0191b_gallery_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_docs_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_static_asset_resolution.mjs`
- Acceptance:
  - `Card.title` 在 `$label` 场景下输出字符串值
  - Header 默认可见页仅剩 `home/workspace/prompt`
  - Workspace 相关页面资产解析测试无回归
- Rollback:
  - 回退 `renderer.mjs`
  - 回退 `nav_catalog_ui.json`
  - 回退本轮新增测试

## Step 3

- Scope:
  - 用真实浏览器路径做最小 smoke，确认这轮适合作为 `0200` 前置 cleanup
  - 更新 runlog / `docs/ITERATIONS`
- Files:
  - `docs/iterations/0199-ui-entry-card-cleanup/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - 浏览器打开 Workspace，确认右侧标题不再出现 `[object Object]`
  - 浏览器确认 Header 不再显示 `Gallery / Docs / Static`
  - runlog 记录：
    - 访问地址
    - 操作步骤
    - 实际结果
    - 截图或页面证据路径
- Acceptance:
  - 本轮证据足够支持 `0200` 继续使用远端浏览器验收，不会被这两个已知 UI 问题污染
  - 台账状态与 runlog 一致
- Rollback:
  - 回退 docs vault 中本轮记录
