---
title: "Iteration 0267-home-save-draft-sync Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0267-home-save-draft-sync
id: 0267-home-save-draft-sync
phase: phase1
---

# Iteration 0267-home-save-draft-sync Plan

## 0. Metadata
- ID: 0267-home-save-draft-sync
- Date: 2026-03-31
- Owner: Codex + User
- Branch: dev_0267-home-save-draft-sync

## 1. Goal
修复首页 ModelTable 编辑弹窗在 JSON 文本修改后立即点击 Save 时可能保存旧值的问题，并把保存失败错误在界面上明确显示出来。

## 2. Background
用户在首页编辑 `Model -103 / (2,31,0) / ui_props_json` 时，只把 `Gamma` 改为 `Gamma1` 也会出现“点击保存没反应”。复现表明并非部署失败，而是编辑文本写回与 `home_save_label` 之间存在竞态；同时失败时 UI 没有明确错误提示。

## 3. Invariants (Must Not Change)
- 不放宽 JSON 规约；`json` 类型仍必须走严格 `JSON.parse`。
- 保存动作必须继续经过既有 `home_save_label` 权威链路。
- 修复应尽量作用于通用首页编辑器，而不是为单个 Gallery cell 打特判。

## 4. Scope
### 4.1 In Scope
- Save 按钮携带当前 draft override
- `home_save_label` 优先使用 draft override
- 编辑弹窗内显示保存错误文本
- 覆盖 Gallery `ui_props_json` 编辑路径的 contract test

### 4.2 Out of Scope
- 其它页面的独立编辑器
- JSON5/宽松 JSON 支持

## 5. Success Criteria (Definition of Done)
1. 仅修改 JSON 文本内容、不改格式时，立即点击 Save 也能保存最新值。
2. 非法 JSON 保存时，界面出现明确错误提示，不再表现为“无反应”。
3. contract test 能证明 Save 使用的是当前 draft，而不是 server 上可能滞后的旧状态。
