---
title: "Iteration 0264-debug-crud-unhide-all Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0264-debug-crud-unhide-all
id: 0264-debug-crud-unhide-all
phase: phase1
---

# Iteration 0264-debug-crud-unhide-all Plan

## 0. Metadata
- ID: 0264-debug-crud-unhide-all
- Date: 2026-03-30
- Owner: Codex + User
- Branch: dev_0264-debug-crud-unhide-all
- Related:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/worker-base/system-models/home_catalog_ui.json`

## 1. Goal
让当前调试用的 ModelTable 增删改查界面不再隐藏结构标签，并支持直接操作任意模型、任意 `label.t`。

## 2. Background
用户已明确当前界面是调试面，不需要隐藏能力。现在有三类限制：
- client snapshot 隐藏 `submt` / pin / connect / secret labels
- Home table rows 继续过滤结构标签
- 编辑对话框与服务端保存逻辑只支持 `str/int/bool/json`，且只允许正数模型

## 3. Invariants (Must Not Change)
- 调试界面仍以 `add_label` / `rm_label` 为最终执行动作。
- 不改业务模型语义；只放开调试面可见性与可操作性。
- 大体 UI 结构保持不变。

## 4. Scope
### 4.1 In Scope
- 取消结构标签隐藏
- 允许 debug CRUD 选择和写入任意 `label.t`
- 允许对负数模型和 `Model 0` 做调试 CRUD

### 4.2 Out of Scope
- 重做整个调试 UI
- 远端权限控制

## 5. Non-goals
- 不处理非 debug 页面
- 不改 FillTable policy

## 6. Success Criteria (Definition of Done)
1. `home_table_rows_json` 能看到 `model.submt` / pin / connect 等结构标签。
2. 调试编辑对话框可以输入任意 `label.t`。
3. 调试 CRUD 可以直接对负数模型和 `Model 0` 执行保存/删除。
4. 对正数模型的既有 pin/owner 路径不回归。

## 7. Risks & Mitigations
- Risk: 取消过滤后 snapshot 体积增加。
  - Impact: 调试页面变慢。
  - Mitigation: 保留超大递归 payload 的最小必要过滤。
- Risk: 任意类型写入解析出错。
  - Impact: 调试保存失败。
  - Mitigation: 统一按类型分类做最小解析策略。

## 8. Open Questions
None.
