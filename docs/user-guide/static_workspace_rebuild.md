---
title: "Static Workspace Upload Guide"
doc_type: user-guide
status: active
updated: 2026-04-21
source: ai
---

# Static Workspace Upload Guide

本页说明新版 `Static` 页面如何工作。

目标：
- 通过 Workspace 侧边栏进入 Static 页面
- 通过填表驱动的页面状态完成上传
- 上传单个 HTML 或 ZIP 后，内容固定挂到 `/p/<projectName>/...`

## 1. 模型结构

新版 Static 采用两个正数模型：

- `Model 1011`
  - Workspace 可见的页面宿主
  - 负责 UI 节点和侧边栏入口
- `Model 1012`
  - Static truth
  - 保存项目名、上传类型、media uri、状态、项目列表

挂载关系：

- `Model 0 -> 1011`
- `Model 1011 -> 1012`

## 2. 页面里有哪些控件

页面至少包含：

- `Project name`
- `Upload kind`
  - `HTML`
  - `ZIP`
- `Upload file`
- `Upload`
- `Refresh list`
- `Mounted Projects`

这些控件的值和状态都来自 `Model 1012`，不是页面内部硬编码状态。

## 3. 关键 truth 标签

`Model 1012` 上的核心标签：

- `static_project_name`
- `static_upload_kind`
- `static_media_uri`
- `static_media_name`
- `static_status`
- `static_projects_json`
- `mounted_path_prefix`

其中：

- `mounted_path_prefix` 固定为 `/p/`
- 访问规则固定为 `/p/<projectName>/...`

## 4. 上传单个 HTML

操作步骤：

1. 在 Workspace 中打开 `Static`
2. 在 `Project name` 输入项目名，例如 `my-html-demo`
3. 在 `Upload kind` 选择 `HTML`
4. 选择一个 `.html` 文件
5. 点击 `Upload`

成功后：

- 页面状态会显示 `uploaded: <projectName>`
- 列表里会出现新的项目
- 可以直接访问：

```text
/p/my-html-demo/
```

如果是本地默认入口，完整地址通常是：

```text
http://127.0.0.1:30900/p/my-html-demo/
```

## 5. 上传 ZIP

上传 ZIP 时，推荐压缩包根目录内包含 `index.html`。

操作步骤：

1. 输入项目名，例如 `my-zip-demo`
2. `Upload kind` 选择 `ZIP`
3. 选择 `.zip` 文件
4. 点击 `Upload`

成功后同样会挂到：

```text
/p/my-zip-demo/
```

## 6. 页面和后端的分工

页面负责：

- 把项目名、上传类型、media uri 写到 `Model 1012`
- 触发：
  - `static_project_upload`
  - `static_project_list`

后端负责：

- 读取 `Model 1012` 上的上传参数
- 调用现有静态项目能力
- 把项目列表和状态写回 `Model 1012`
- 通过 `/p/<projectName>/...` 对外提供访问

## 7. 当前固定规则

这轮只保留固定规则：

```text
/p/<projectName>/...
```

不支持用户自定义任意挂载路径。

## 8. 最短操作路径

1. 打开 Workspace 中的 `Static`
2. 输入 `Project name`
3. 选择 `HTML` 或 `ZIP`
4. 选文件
5. 点 `Upload`
6. 打开 `/p/<projectName>/`

## 9. 本轮真实验证用例

本轮已实际验证：

- 上传单个 HTML：
  - `workspace_ui_filltable_example_visualized.html`
- 上传 ZIP：
  - 将同一 HTML 打包成含 `index.html` 的 zip 再上传

两种方式都可通过 `/p/<projectName>/...` 成功访问。

