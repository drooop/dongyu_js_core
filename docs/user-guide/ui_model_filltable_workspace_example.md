---
title: "UI Model Fill-Table Workspace Example"
doc_type: user-guide
status: active
updated: 2026-03-27
source: ai
---

# UI Model Fill-Table Workspace Example

## 1. 本文只覆盖当前真的成立的能力

这份文档现在只讲一件事：

- 用户通过当前界面逐条增删改查 label
- 修改**已有正数 UI model**
- 从而改变这个 UI model 在 Workspace 中的显示结果

本文**不再**覆盖：

- 新建 `model_id`
- 新写 `model.table`
- 新写 `model.submt`
- 新增 `Model -25` 挂载

原因不是“理论上不想支持”，而是按当前仓库事实，这几条还不是现有界面路径的已交付能力。

## 2. 当前界面链路到底能做什么

当前 Home / editor 侧已交付的事实是：

- 只能对 `model_id > 0` 的现有模型做 label 级 CRUD
- 保存/删除通过 Home 的 pin 路径完成
- 已有 Workspace app 的显示会随这些 label 变化而变化

当前界面链路**不能**做的是：

- 创建新的 model
- 写负数模型
- 修改 `Model -25` 的 Workspace mount

因此，本文的正确口径必须是：

- 选一个**已经挂在 Workspace 里的正数 UI model**
- 手工逐条改它的 label
- 观察 Workspace 中这个 app 的页面变化

当前可直接用于这个目的的现成正数模型：

- `Model 1003`：schema-only leaf
- `Model 1004`：page_asset page

这两个模型都已经在 Workspace registry 中，所以你不需要再做挂载动作。

## 3. 操作入口

当前最贴近“手工填 label”的入口是 Home 页面：

1. 在 Home 选择目标正数模型
2. 选中要改的 label，或直接新建一个 label
3. 用 `home_save_label` 保存
4. 用 `home_delete_label` 删除
5. 再切回 Workspace 看对应 app 的显示变化

关键事实：

- Home 现在是对**已有正数模型**做 label CRUD
- 它不是结构 authoring 工具

## 4. 示例 A：`Model 1003` 完整模型表总览

先在 Home 选中 `Model 1003`，然后按下面总览逐条填写。

### Model 1003

Cell `(0,0,0)`

- `[k: "app_name", t: "str", v: "0250 Schema Leaf"]`
- `[k: "source_worker", t: "str", v: "workspace"]`
- `[k: "authority_note", t: "str", v: "This page is rendered from Model 1003 cellwise labels."]`
- `[k: "ownership_rule", t: "str", v: "Business truth stays on Model 1003 itself."]`
- `[k: "surface_status", t: "str", v: "success"]`
- `[k: "next_step_hint", t: "str", v: "Change schema labels at (1,0,0) to reshape the page."]`

Cell `(1,0,0)`

- `[k: "_title", t: "str", v: "0250 Schema Leaf Example"]`
- `[k: "_subtitle", t: "str", v: "A page rendered entirely from cellwise schema labels."]`
- `[k: "_field_order", t: "json", v: ["authority_note","ownership_rule","surface_status","next_step_hint"]]`
- `[k: "authority_note", t: "str", v: "Text"]`
- `[k: "authority_note__label", t: "str", v: "Authority"]`
- `[k: "authority_note__props", t: "json", v: {"type":"info"}]`
- `[k: "authority_note__no_wrap", t: "bool", v: true]`
- `[k: "ownership_rule", t: "str", v: "Text"]`
- `[k: "ownership_rule__label", t: "str", v: "Ownership"]`
- `[k: "ownership_rule__props", t: "json", v: {"type":"info"}]`
- `[k: "ownership_rule__no_wrap", t: "bool", v: true]`
- `[k: "surface_status", t: "str", v: "StatusBadge"]`
- `[k: "surface_status__label", t: "str", v: "Status"]`
- `[k: "surface_status__props", t: "json", v: {"label":"SURFACE"}]`
- `[k: "surface_status__no_wrap", t: "bool", v: true]`
- `[k: "next_step_hint", t: "str", v: "Text"]`
- `[k: "next_step_hint__label", t: "str", v: "Next Step"]`
- `[k: "next_step_hint__props", t: "json", v: {"type":"info"}]`
- `[k: "next_step_hint__no_wrap", t: "bool", v: true]`

完成后切回 Workspace 打开 `1003` 对应 app。

如果你想顺手验证删除，也可以再删掉：

- `[model_id: 1003, cell: (1,0,0), k: "authority_note__no_wrap"]`

## 5. 示例 B：`Model 1004` 完整模型表总览

先在 Home 选中 `Model 1004`，然后按下面总览逐条填写。

### Model 1004

Cell `(0,0,0)`

- `[k: "app_name", t: "str", v: "0250 Page Asset"]`
- `[k: "source_worker", t: "str", v: "workspace"]`
- `[k: "composition_status", t: "str", v: "monitoring"]`
- `[k: "requests_total", t: "int", v: 12]`
- `[k: "stale_cards", t: "int", v: 3]`
- `[k: "avg_latency", t: "int", v: 84]`
- `[k: "audit_log", t: "str", v: "page_asset_v0 composes Card/StatusBadge/StatCard/Terminal on Model 1004."]`

Cell `(0,1,0)`

- `[k: "page_asset_v0", t: "json", v: {"id":"page_root_0250","type":"Container","props":{"layout":"column","gap":16},"children":[{"id":"card_intro","type":"Card","props":{"title":"0250 Page Asset Example"},"children":[{"id":"txt_intro","type":"Text","props":{"type":"info","text":"This page is authored by editing one json label: page_asset_v0."}}]},{"id":"status_main","type":"StatusBadge","props":{"label":"STATUS"},"bind":{"read":{"model_id":1004,"p":0,"r":0,"c":0,"k":"composition_status"}}},{"id":"terminal_log","type":"Terminal","props":{"title":"Authoritative Log","maxHeight":"220px"},"bind":{"read":{"model_id":1004,"p":0,"r":0,"c":0,"k":"audit_log"}}}]}]`

完成后切回 Workspace 打开 `1004` 对应 app。

后续你继续修改：

- `composition_status`
- `audit_log`
- `page_asset_v0`

页面都会跟着变化。

## 6. 当前事实下，怎样理解“挂到 Workspace 下”

当前这份文档里，“挂到 Workspace 下”的事实前提是：

- `1003` 和 `1004` 已经挂在 Workspace 下

所以你现在能通过界面做到的是：

- 修改这两个已挂载 app 的 label
- 从而修改它们在 Workspace 里的显示

你现在**还不能**通过界面做到的是：

- 自己新增一个 `model_id`
- 自己写 `model.table`
- 自己写 `model.submt`
- 自己往 `-25` 增加挂载位

因此，这份文档不再把“新增挂载”伪装成现有界面能力。

## 7. 当前不该写进本文的内容

以下内容现在都不该再作为本文正例：

- JSON patch / `records[].op`
- `candidate_changes`
- `action: "set_label"` 这类对外 FillTable 合同
- 新建 model / 新挂载 Workspace 的教程
- parent/child `model.submt` 的手工创建教程

原因很简单：

- 本文已经收窄成“界面里逐条填 label 修改已有正数 UI model”
- 上面这些不是这个能力面

## 8. 证据入口

本文对应的仓库事实来源：

- 现成正数 UI model：
  - `packages/worker-base/system-models/workspace_positive_models.json`
- Workspace 已有挂载：
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
- Home 界面当前只做已有正数模型的 label CRUD：
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `packages/worker-base/system-models/intent_handlers_home.json`
  - `packages/ui-model-demo-server/server.mjs`
