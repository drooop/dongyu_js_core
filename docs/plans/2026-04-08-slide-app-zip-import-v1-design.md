---
title: "Slide App Zip Import v1 Design"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Slide App Zip Import v1 Design

## Goal

把 Slide UI 从“只有内置 app”推进到“能安装外部 slide app 包”的最小闭环。

本轮只做：

- zip 导入
- 解压与校验
- 分配新 model id
- 挂到 Workspace
- Open
- Delete / 卸载

不做：

- assets
- remote worker 真发 metrics
- 应用商店
- 完整 package 管理

## 与 0288-0291 的关系

`0302` 是独立能力线，不替代 `0288-0291`。

- `0288`
  - 继续是双工人拓扑与权属边界的上位约束。
- `0289`
  - `0302` 会实际落地其中一部分：
    - registry
    - mount
    - selection
    - delete lifecycle
  - 但 `0289` 仍保留“把这些行为抽成正式通用合同”的职责。
- `0290`
  - `0290` 是“用户直接填表创建 slide app”。
  - `0302` 是“把已经打好的 slide app 包安装进来”。
  - 两者并存，不互相替代。
- `0291`
  - 仍负责 Gallery / 文档 / 取证收口。

## 统一 payload 合同

本轮明确：

- matrix 消息体
- zip 导入包中的模型文件

使用同一个 payload 合同：

- [[docs/ssot/temporary_modeltable_payload_v1]]

也就是同样的记录数组语义：

- `id`
- `p`
- `r`
- `c`
- `k`
- `t`
- `v`

这意味着：

- zip 里不再放另一套 `manifest + patch ops` 结构
- zip 里只放一个 JSON 文件
- 这个 JSON 文件本身就是“临时模型表记录数组”

区别只在载体：

- matrix：直接发记录数组
- zip：把同样的记录数组放进压缩包

## 包格式（v1）

zip 中只允许一个 JSON 文件，建议名：

- `app_payload.json`

其内容必须是一个临时模型表数组。

不支持：

- 多个 payload 文件
- manifest
- assets
- 非 JSON 元数据

## 0302 自己冻结的最小导入字段集

因为 `0289` 还没执行，`0302` 先冻结一个“导入准入最小子集”。

要求这些 label 出现在“唯一 slide app host 临时模型”的 `(0,0,0)` 上：

- `app_name`
- `source_worker`
- `slide_capable`
- `slide_surface_type`
- `from_user`
- `to_user`
- `ui_authoring_version`
- `ui_root_node_id`
- `model_type`

其中：

- `slide_capable`
  - 必须为 `bool true`
- `ui_authoring_version`
  - 当前只接受 `cellwise.ui.v1`
- `model_type`
  - 当前要求 app host 为 `model.table`

定位说明：

- 这是 `0302` 的安装准入最小子集
- 后续 `0289` 以它为基础扩展正式 metadata 合同
- `0289` 不能推翻这批已上线字段，只能增补

## model_id 分配规则

`0302` 明确使用：

- 顺序递增
- 单调不回收

规则：

1. 读取当前运行态正数 `model_id` 最大值
2. 从 `max + 1` 开始，按导入包内临时 `id` 升序连续分配
3. 删除 app 后，不回收旧 id

原因：

- 最简单
- 最可审计
- 避免删除 / 重装后引用歧义
- 与当前 `ws_app_next_id` 口径一致

## v1 支持范围

为了把风险收紧，`0302` v1 只接受“声明式 slide app 包”：

- 允许：
  - `model.table`
  - `model.submt`
  - `ui_authoring_version`
  - `ui_root_node_id`
  - `ui_*`
  - `json / str / int / bool`
  - `ui_bind_json` 这类声明式绑定
- 暂不接受：
  - `func.js`
  - `func.python`
  - `dual_bus_model`
  - `pin.bus.*`
  - `pin.connect.model`

目的：

- 先证明“安装 slide app”主线成立
- 不把第一刀做成远端执行包管理

## 安装路径

1. 用户打开 Workspace 中的 `滑动 APP 导入`
2. 上传 zip
3. UI Server 从缓存媒体中取出 zip 二进制
4. 解压出唯一 JSON payload
5. 校验最小字段集
6. 为包内所有临时 `id` 分配真实正数 `model_id`
7. remap 记录中的：
  - `id`
  - `model.submt` 子模型值
  - 声明式 JSON 中的 `model_id` 引用
8. materialize 到运行态
9. 在 Model 0 下新增一个挂载点
10. 新 app 出现在 `ws_apps_registry`
11. 用户可直接 `Open`

## 卸载路径

1. Workspace 侧边栏行上点击 `Delete`
2. UI Server 找到该导入 app root
3. 删除：
  - Workspace registry 可见入口
  - Model 0 挂载点
  - 导入包 materialize 出来的所有模型
  - 这些模型在 sqlite 中的持久化记录
4. 刷新 `ws_apps_registry`
5. 若当前选中的是被删 app，回退到默认 app

## 关键风险

### 风险 1：包侧又发明第二套 metadata

缓解：

- zip 里只允许临时模型表数组
- metadata 也是 labels

### 风险 2：导入后 model_id 冲突

缓解：

- 单调递增分配
- 不回收旧 id

### 风险 3：删除只删侧边栏，不删实际模型

缓解：

- 卸载必须同时删：
  - registry
  - mount
  - runtime model
  - sqlite records

### 风险 4：v1 试图支持执行型 app，导致 remap 失控

缓解：

- v1 只接受声明式 slide app 包
- 执行型包留到后续 iteration
