---
title: "Slide App Zip Import v1"
doc_type: user-guide
status: active
updated: 2026-04-21
source: ai
---

# Slide App Zip Import v1

## 这一步做了什么

`0302` 让 Workspace 第一次具备了“安装外部 slide app”的能力。

现在可以：

- 上传一个 zip
- 把 zip 里的 slide app 导入到当前 UI Server
- 让它出现在 Workspace 侧边栏
- 点击 `Open`
- 点击 `Delete` 卸载

## 它和旧计划的关系

- 它不替代 `0288-0291`
- 它是新增能力线
- 它实际落了 `0289` 里的一部分主线能力：
  - registry
  - mount
  - selection
  - delete lifecycle

## 包格式

zip 中只允许一个 JSON 文件，建议叫：

- `app_payload.json`

这个文件不是另一套 manifest，而是直接使用同一套临时模型表合同：

- `id`
- `p`
- `r`
- `c`
- `k`
- `t`
- `v`

也就是说：

- matrix 消息体用这套结构
- zip 导入包里的模型文件也用这套结构

## 最小导入字段

导入包里必须有一个唯一的 slide app host 临时模型。  
它的 `(0,0,0)` 必须至少带这些 labels：

- `app_name`
- `source_worker`
- `slide_capable = true`
- `slide_surface_type`
- `from_user`
- `to_user`
- `ui_authoring_version = cellwise.ui.v1`
- `ui_root_node_id`
- `model_type`

## 当前 v1 范围

### 支持

- 声明式 slide app
- `model.table`
- `model.submt`
- `ui_*`
- `ui_bind_json`
- 普通字符串、数字、布尔、JSON labels

### 不支持

- `func.js`
- `func.python`
- `pin.connect.model`
- `pin.bus.*`
- assets

## model_id 分配规则

导入时会：

1. 找到当前正数 model id 最大值
2. 从 `max + 1` 开始顺序递增
3. 删除后不回收旧 id

所以导入 id 是单调递增的，不会因为卸载又把旧 id 发回去。

## 卸载规则

点击 Workspace 侧边栏中的 `Delete` 后，会一起移除：

- 侧边栏 registry 项
- Model 0 下的挂载点
- 这个导入包 materialize 出来的所有模型
- sqlite 中对应的持久化记录

## 最短验证步骤

1. 打开 Workspace。
2. 选择 `滑动 APP 导入`。
3. 上传一个 zip。
4. 点击 `导入 Slide App`。
5. 确认侧边栏新增导入 app。
6. 点击 `Open`，确认页面能打开。
7. 如果 app 有输入框或可编辑内容，确认能正常使用。
8. 点击 `Delete`，确认它从侧边栏消失。

## 本轮本地验收事实

- `/tmp/slide-import-v1.zip` 已用于真实导入验证
- `Imported Zip App` 已在 Workspace 中出现并可打开
- 输入框改成 `Browser imported change` 后，页面文本同步变化
- 删除后，`Imported Zip App` 已从 Workspace registry 消失
