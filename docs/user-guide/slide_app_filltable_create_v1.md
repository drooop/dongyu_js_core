---
title: "Slide App Filltable Create v1"
doc_type: user-guide
status: active
updated: 2026-04-08
source: ai
---

# Slide App Filltable Create v1

## 这一步做了什么

`0290` 让 Workspace 第一次具备了“用户自己填表创建 slide app”的能力。

现在可以：

- 打开 `滑动 APP 创建`
- 填写最小字段
- 点击 `创建 Slide App`
- 让新 app 自动出现在 Workspace 侧边栏
- 打开、继续编辑、再删除

## 它和 0289 / 0302 的关系

- 它不替代 `0289`
  - `0289` 负责统一 slide-capable app 主线合同
- 它不替代 `0302`
  - `0302` 是 zip 导入外部 app
  - `0290` 是用户在 Workspace 里直接填表创建
- 这两条路径最终都落到同一类结果：
  - 一个挂在 Workspace 里的 `workspace.page` slide app

## creator 自己用到哪些模型

- `Model 1034`
  - `滑动 APP 创建` host
- `Model 1035`
  - creator truth

`1034` 挂在 `Model 0` 下，`1035` 通过 `1034` 的 `model.submt` 被挂进去。

## 用户需要填写什么

当前 v1 需要填写这几项：

- `App name`
- `Source worker`
- `Surface type`
  - 当前只支持 `workspace.page`
- `Headline`
- `Body text`

## 系统会自动补什么

创建时，UI Server 会自动生成新 app 的最小 metadata：

- `slide_capable = true`
- `slide_surface_type = workspace.page`
- `from_user = local_filltable`
- `to_user = workspace_local`
- `ui_authoring_version = cellwise.ui.v1`
- `ui_root_node_id`

也就是说，用户不需要再手写第二套安装描述文件。

## 和 zip 导入用的是同一套合同

这一步没有发明新协议。

当前做法是：

1. 从 `1035` 读用户填写的字段
2. 在 UI Server 里生成一份临时模型表数组
3. 复用 `0302` 已有的校验和 materialize 路径

所以：

- zip 导入和填表创建，底层都站在同一套 `id / p / r / c / k / t / v` payload 合同上
- 差别只在来源：
  - `0302` 来自 zip
  - `0290` 来自 creator truth

## 创建后的规则

创建成功后会发生这些事：

1. 分配新的正数 `model_id`
2. 同时生成对应 truth model
3. 挂到 Workspace 主线
4. 自动切成当前选中 app

当前 id 规则与 `0302` 一样：

- 从当前最大正数 `model_id + 1` 开始顺序递增
- 删除后不回收旧 id

## 删除规则

创建出来的 app 和 zip 导入 app 一样，可以直接从侧边栏删除。

删除时会一起移除：

- 侧边栏 registry 项
- Model 0 下的挂载点
- 创建出来的 host / truth 模型
- 对应的持久化记录

## 最短验证步骤

1. 打开 Workspace。
2. 选择 `滑动 APP 创建`。
3. 填写 app name、headline、body text。
4. 点击 `创建 Slide App`。
5. 确认侧边栏出现新 app。
6. 确认它会自动被打开。
7. 在新 app 里继续改输入内容，确认页面文字同步变化。
8. 点击 `Delete`，确认它从侧边栏消失。

## 当前 v1 不做什么

这一步还没有进入：

- Gallery 收口
- 远端 metrics 真发包
- `workspace.page` 之外的新 surface type
- assets 打包
- 多模板创建器
