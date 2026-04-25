---
title: "0333 — cellwise-ui-composition-model100 Plan"
doc_type: iteration-plan
status: approved
updated: 2026-04-24
source: ai
iteration_id: 0333-cellwise-ui-composition-model100
id: 0333-cellwise-ui-composition-model100
phase: phase2
---

# 0333 — cellwise-ui-composition-model100 Plan

## 0. Metadata
- ID: `0333-cellwise-ui-composition-model100`
- Date: `2026-04-24`
- Owner: Codex
- Branch: `dev_0331-0333-pin-payload-ui`
- Depends on:
  - `0331-pin-modeltable-payload-contract`
  - `0332-pin-modeltable-payload-implementation`

## 1. Goal
冻结 UI cellwise 组合规则，并把 `Model 100 / E2E 颜色生成器` 从单 schema cell 迁移为真正可填表组合的 cellwise UI。

## 2. Background
当前 `Model 100` 右侧内容主要来自 `Model 100 (1,0,0)` 的 schema projection：多个字段集中在同一 cell 的复合 labels 中。它能运行，但不满足用户希望的“改某个 label 改文字、增加一个 cell 多一行、layout cell 决定内部排布”的精细化填表目标。已有 `cellwise.ui.v1` projection 和组件 registry 可复用，本 iteration 要把规则和真实样例对齐。

## 3. Invariants (Must Not Change)
- UI 只能是 ModelTable 的投影，不能成为业务 truth。
- 普通视觉包含关系用 `ui_parent/ui_order/ui_layout/ui_slot` 表达，不使用 `model.submt`。
- `model.submt` 只用于独立子模型/子 app 组合，不用于普通 row/column 排版。
- `Generate Color` 事件仍必须走 0332 后的合法 pin payload 链路。
- 不允许整页 `ui_ast_v0` 或大 JSON blob 重新成为 authoritative input。

## 4. Scope
### 4.1 In Scope
- 文档冻结 UI containment rule 与 model composition rule。
- 扩展/收口 `cellwise.ui.v1` projection 所需的 layout props，如 row/column/grid/form。
- 迁移 `Model 100` 的 UI 节点到独立 cells。
- 补测试证明：
  - 标题来自 label；
  - layout 改 label 会改 AST；
  - 新增 node cell 会出现在投影；
  - submit button 仍有 `cell_ref + writable_pins`。
- 本地部署后浏览器实测颜色生成器。

### 4.2 Out of Scope
- 不做全量 Gallery 重做。
- 不做新的可视化 UI 编辑器。
- 不把所有旧 schema projection 页面一次性迁到 cellwise。

## 5. Non-goals
- 不用 `model.submt` 表示“按钮在 row 里面”。
- 不用 HTML 字符串或 WebView 方式偷懒。
- 不绕过 0332 的 pin payload 合同。

## 6. Success Criteria (Definition of Done)
- `Model 100` root 声明 `ui_authoring_version = cellwise.ui.v1` 与 `ui_root_node_id`。
- `E2E 颜色生成器` 标题/按钮/状态/颜色块/输入区由多个 UI node cells 组成。
- 改标题 label 后投影文字变化。
- 新增一个 UI node cell 后 AST 增加对应行/组件。
- 浏览器在 `http://127.0.0.1:30900/#/workspace` 点击 Generate 后颜色变化且 loading 释放。
- 每个小阶段都有 sub-agent review 记录。

## 7. Risks & Mitigations
- Risk: 迁移 Model 100 UI 时破坏 submit 事件绑定。
  - Impact: 浏览器点击无反应或 loading 卡住。
  - Mitigation: 保持 `cell_ref + writable_pins` 测试和浏览器实测。
- Risk: layout 规则过度复杂。
  - Impact: 用户难以填表。
  - Mitigation: 默认只使用 `Container` + `ui_parent/ui_order/ui_layout`；`ui_slot` 仅用于命名区域。
- Risk: schema projection 与 cellwise projection 并存导致 fallback 掩盖问题。
  - Impact: 测试误判旧路径可用。
  - Mitigation: `Model 100` 必须命中 `buildAstFromCellwiseModel`，测试显式断言。

## 8. Open Questions
None. 用户已同意 UI containment 不使用 `model.submt`，子模型组合另行保留。

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/user-guide/ui_components_v2.md`
- Notes:
  - 0333 是 cellwise UI authoring 的真实样例迁移，不改变 runtime ownership。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `CLAUDE.md`
  - `docs/WORKFLOW.md`
- Notes:
  - UI projection cannot be truth source.
