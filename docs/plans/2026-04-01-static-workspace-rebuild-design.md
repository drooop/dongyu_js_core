---
title: "Static Workspace Rebuild Design"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Static Workspace Rebuild Design

## Goal

把原有 `Static` 页面按当前主线重新实现为一个正式的 Workspace 侧边栏应用，同时保留原有静态内容访问规则 `/p/<projectName>/...`。

## Current Facts

- 旧界面定义在：
  - `packages/worker-base/system-models/static_catalog_ui.json`
- 旧后端能力仍存在：
  - `staticListProjects`
  - `staticUploadProjectFromMxc`
  - `staticDeleteProject`
  - `/p/<projectName>/...`
- 旧静态页大量依赖 `editor_state(-2)` 上的 `static_*` 标签。
- 当前 local bus 对 `static_project_*` 动作明确标记为 `static_remote_only`。

## Chosen Architecture

采用与 `0270` 相同的模式：

- 一个正数 Workspace app host
- 一个 child truth model

建议模型：

- `Model 1011`
  - Static Workspace app host
  - 负责 Workspace 展示和页面 UI 节点
- `Model 1012`
  - Static truth model
  - 负责项目名、上传类型、media uri、状态、项目列表、访问路径

挂载关系：

- `Model 0 -> 1011`
- `Model 1011 -> 1012`

## Why This Shape

- 保持与 `0270` 一致，避免再把正式业务入口留在负数系统模型。
- 页面展示与业务 truth 分层清晰。
- 上传动作与项目列表能以当前模型权属落表，不再把用户页面状态直接绑在 `-2`。
- 旧后端能力可以继续复用，不需要重写静态服务挂载逻辑。

## UI Scope

页面至少包含：

- 项目名输入框
- 上传类型选择
  - `html`
  - `zip`
- 文件上传按钮
- 执行上传按钮
- 刷新列表按钮
- 状态文本
- 项目表格
  - 项目名
  - 更新时间
  - 访问路径提示

说明：

- 这一轮不做自定义任意挂载路径
- 固定访问规则仍是 `/p/<projectName>/...`

## Data Ownership

`Model 1012` 持有以下 truth：

- `static_project_name`
- `static_upload_kind`
- `static_media_uri`
- `static_media_name`
- `static_status`
- `static_projects_json`
- `mounted_path_prefix`（固定为 `/p/`）

`Model 1011` 只持有：

- `app_name`
- `source_worker`
- `ui_authoring_version`
- `ui_root_node_id`
- 页面节点与绑定

## Action Path

上传/列表刷新/删除仍复用旧 action 名：

- `static_project_upload`
- `static_project_list`
- `static_project_delete`

但页面绑定目标从旧 `-2` 改成新 truth `1012`。

宿主执行原则：

- 页面写入 `Model 1012`
- host action 从 `Model 1012` 读取请求参数
- 后端调用现有 `staticUploadProjectFromMxc` / `staticListProjects` / `staticDeleteProject`
- 结果再 materialize 回 `Model 1012`

## Compatibility Rule

保留这些后端稳定面：

- `/p/<projectName>/...`
- `staticUploadProjectFromMxc`
- `staticListProjects`
- `staticDeleteProject`

不保留这些旧页面耦合：

- 正式页面继续依赖 `-24 StaticCatalog`
- 正式交互继续以 `-2 static_*` 作为唯一 truth

## Validation Plan

必须验证：

1. Workspace 侧边栏出现新的 Static 条目
2. 页面能打开
3. 上传单个 HTML 后可通过 `/p/<projectName>/...` 访问
4. 上传 zip 后可通过 `/p/<projectName>/...` 访问
5. 上传参数与状态都能在 `Model 1012` 中看到
6. 用 `docs/user-guide/workspace_ui_filltable_example_visualized.html` 做真实上传验证

## Risks

- 风险 1：
  当前后端 static host 能力默认从 `-2` 取状态，迁到 `1012` 时可能有旧耦合遗漏。
- 缓解：
  先写合同测试，明确 action 读取面必须切到 `1012`。

- 风险 2：
  Workspace 新条目可能和旧 `Static` 系统页并存，引起双入口。
- 缓解：
  本轮以 Workspace 为正式入口；旧 `Static` 仅保留历史页，不作为主导航目标。

- 风险 3：
  上传后页面显示成功，但 `/p/...` 不可访问。
- 缓解：
  最终必须做真实上传和真实 URL 访问，不以脚本模拟替代。

