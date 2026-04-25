---
title: "Slide Workspace Generalization"
doc_type: user-guide
status: active
updated: 2026-04-21
source: ai
---

# Slide Workspace Generalization

## 这一步做了什么

`0289` 把 Slide UI 的 Workspace 主线从“围着单点 `Model 100` 运转”推进成“多个 slide-capable app 共用一套主线合同”。

这一步不是新增一个新的创建入口，而是统一已经存在的三类 app：

- 内置 slide app
- importer app
- zip 导入得到的 slide app

## 什么算 slide-capable app

当前主线里，一个 app 要进入 slide-capable 合同，至少要满足：

- `app_name`
- `slide_capable = true`
- `slide_surface_type`
- `deletable`
- `ui_authoring_version`
- `ui_root_node_id`

其中：

- `flow.shell`
  - 表示使用 flow shell 这类投影
- `workspace.importer`
  - 表示 importer 自己的工作页面
- `workspace.page`
  - 表示直接在 Workspace 右侧打开的页面 app

## 当前三类实际例子

- `E2E 颜色生成器`
  - `slide_capable = true`
  - `slide_surface_type = flow.shell`
  - `deletable = false`
- `滑动 APP 导入`
  - `slide_capable = true`
  - `slide_surface_type = workspace.importer`
  - `deletable = false`
- `Imported Zip App`
  - `slide_capable = true`
  - `slide_surface_type = workspace.page`
  - `deletable = true`

## Workspace 统一字段

Workspace registry 现在统一输出这些字段：

- `name`
- `source`
- `deletable`
- `delete_disabled`
- `slide_capable`
- `slide_surface_type`
- `installed_at`
- `from_user`
- `to_user`

这意味着：

- 内置 app 和导入 app 在侧边栏属于同一张表
- 差异不再靠“是不是某个特殊 model id”判断
- 差异改为由 metadata 决定

## 选择规则

现在的规则是：

1. 用户显式点选哪个 app，就优先用哪个
2. 只有当当前选择的 app 已不存在时，才回退默认 app
3. 默认 app 不再硬编码写死为 `Model 100`

## 删除规则

- `deletable = false`
  - 侧边栏 `Delete` disabled
- `deletable = true`
  - 侧边栏 `Delete` enabled

当前 importer 生成的 zip app 可以删；内置 app 不行。

## 本轮最短验证

1. 打开 Workspace。
2. 确认 `E2E 颜色生成器`、`滑动 APP 导入`、已导入 zip app 同时出现在侧边栏。
3. 确认内置 app 的 `Delete` 不可点。
4. 确认导入 app 的 `Delete` 可点。
5. 先打开导入 app，再切回 `E2E 颜色生成器`。
6. 确认选中状态真的切回内置 app，而不是被旧默认值覆盖。

## 这一步还没做什么

这一步没有进入：

- `0290` 用户自己填表创建 slide app
- `0291` Gallery / 文档 / 取证收口

也就是说，Phase B 现在只负责把“系统主线通用化”变成真实实现。
