---
title: "Workspace UI Fill-Table Example Design"
doc_type: design
status: active
updated: 2026-03-31
source: ai
---

# Workspace UI Fill-Table Example Design

Date: 2026-03-31
Status: Approved-for-planning
Related Iteration: `0270-workspace-ui-filltable-example`

## Goal

提供一个仓库内预置的正式示例：

- 在 Workspace 侧边栏中出现一个与 `E2E 颜色生成器` 同级的新条目
- 右侧界面由 `Input + Button + Label` 三个组件组成
- 该界面通过填表/改表生成和控制，而非硬编码
- 同一示例可通过改表把链路从远端双总线模式切换到本地程序模型模式
- 最终形成一份用户文档，指导用户从零创建、挂载、调参、改链路、删除后重建

## Non-Negotiable Constraints

- 案例必须建立在当前已恢复的颜色生成器双总线 baseline 之上
- 新示例不得通过硬编码 JSX/AST 直接产出最终界面
- UI truth 必须来自 ModelTable 里的 cellwise labels / page asset / `model.submt` 挂载
- 远端模式和本地模式都必须遵守 owner materialization / scoped patch 约束
- 文档必须包含用户手工删除后重新填表恢复的流程

## Structure

### 1. Workspace Directory Layer

- 在 `Workspace (-25)` 当前目录机制下，新增一个独立 app 条目
- 它与 `E2E 颜色生成器` 同级，作为新的侧边栏项出现
- 这一层只负责“被列出与被打开”，不承载业务 truth

### 2. App Host Model

新增一个正数 app model 作为 Workspace 侧看到的宿主：

- `app_name`
- `source`
- page-level summary / status text
- 页面级 authoring 根

该模型负责：

- 被 Workspace 挂载
- 被 `Open` 后显示
- 容纳 parent-mounted child truth

### 3. Interaction Truth Child Model

再挂一个 child model 作为真正的业务/交互 truth：

- input draft / committed text
- confirm action 状态
- result label（展示颜色字符串）
- route mode label（`remote` / `local`）
- 布局参数
- 组件 props 参数
- 远端/本地切换所需的 pin/connect / owner materialization labels

这样可以把“界面被挂载”和“链路被改表切换”拆开，避免宿主层语义混乱。

## UI Layout

界面固定为方案 B：

- 左侧 `Input`
- 右侧 `Confirm Button`
- 下方整行 `Label`

但布局不是硬编码的，必须由显式 label 决定：

- `layout_direction`
  - `row`
  - `row-reverse`
  - `column`
- `input_font_size`
- `button_variant` / `button_color`
- `result_text_style`

这些 label 通过现有 `ui_props_json` / bind / cellwise authoring 进入组件 props。

## Data Flow Modes

### 1. Remote Mode

`submit_route_mode = remote`

链路：

1. Button click
2. 当前示例的 child truth model 组装 event payload
3. 写入本模型 boundary out pin
4. 经父模型 hosting cell relay 逐层上送到 `Model 0`
5. `Model 0 -> MBR -> MQTT -> remote-worker`
6. remote-worker 返回 `mt.v0 patch`
7. `MBR -> Model 0 -> owner/helper request`
8. child truth model owner materialize
9. `Label` 绑定的统一结果值更新

### 2. Local Mode

`submit_route_mode = local`

链路：

1. Button click
2. 不再进入 bus
3. 改写 pin/connect / local func route
4. 本地程序模型直接生成颜色字符串
5. 仍通过 owner/helper request 在当前模型内 materialize
6. 同一个结果 label 更新

关键原则：

- 切换远端/本地模式，不改 UI 组件消费的 truth key
- 改的是 route / connect / owner path，而不是业务代码里加 if/else fallback

## User-Visible Operations To Document

文档必须覆盖三种“用户自己能改表看到变化”的操作：

1. 改布局参数
- input 左 button 右 / 反向 / 纵向

2. 改样式参数
- input 字号
- button 颜色

3. 改链路参数
- 远端模式 -> 本地模式
- 本地模式 -> 远端模式

## Test Matrix

必须至少通过以下验证：

1. 预置示例基线
- 侧边栏新条目存在
- `Open` 后右侧界面显示正确

2. 远端双总线模式
- UI click -> `Model 0` -> `MBR` -> `MQTT` -> `remote-worker` -> return patch
- 页面 `Label` 收到远端新颜色字符串

3. 本地模式切换
- 只改表，不改代码
- 点击后不再出总线
- 页面仍更新颜色字符串

4. 参数化改表
- layout / font / button color 直接变化

5. 删除后重建
- 删除示例模型与挂载
- 按文档重新填表
- 刷新后重新出现并可运行

## Deliverables

1. 仓库内预置正式示例
2. 回归测试
3. 本地部署后的 browser / logs 证据
4. 面向用户的填表教程文档

## Recommendation

先把 0270 的实现拆成两个子目标：

- Goal A: 预置示例 + 双模式切换 + 回归验证
- Goal B: 用户教程文档 + 删除重建演练

这样既能先拿到可运行样例，也能保证文档最终是基于真实样例写出来的。
