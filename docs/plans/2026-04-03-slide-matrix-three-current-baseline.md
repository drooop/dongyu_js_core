---
title: "Slide UI / Matrix / Three.js Current Baseline"
doc_type: plan
status: active
updated: 2026-04-03
source: ai
---

# Slide UI / Matrix / Three.js Current Baseline

## Goal

在进入后续重头规划前，先盘清 3 条主线的当前起点：

- `Slide UI`
- Matrix 系统层能力 vs 用户侧通讯产品线
- Three.js scene CRUD 与后续可扩展边界

本文档只记录“现在已经有什么、缺什么、后续规划必须从哪里接着做”，不直接产出实施方案。

## 1. Slide UI 当前基线

### 1.1 权威起点

- 路线图：
  - [[docs/roadmaps/sliding-ui-workspace-plan]]
- 双工人链路说明：
  - [[docs/user-guide/dual_worker_slide_e2e_v0]]
- 已完成迭代：
  - [[docs/iterations/0214-sliding-flow-ui/plan]]
  - [[docs/iterations/0214-sliding-flow-ui/runlog]]

### 1.2 已完成到哪一步

- `0214` 已把 `sliding flow shell` 作为 Workspace 路径下的正式 UI 壳收口完成。
- 当前唯一被冻结的 executable flow anchor 是 `Model 100`。
- shell 当前聚合了 4 类输入：
  - 当前选中的 app
  - `Model -12 scene_context`
  - `Model -1 action_lifecycle`
  - `0213` Matrix debug projection
- 这条线已经有：
  - local validator
  - server/SSE validator
  - route sync contract
  - browser smoke 级证据

### 1.3 当前不应误解的地方

- `Slide UI` 不是一个空白概念，也不是“后面再想的交互样式”。
- 它当前已经是 Workspace 下的一种正式 UI 组织方式。
- 但它还不是“任意远端产品 UI 的通用完成态”，目前的稳定锚点仍然主要是 `Model 100` 和相关 process/debug 投影。

### 1.4 后续规划的正确起点

- 先复核 `0214` 当前冻结了哪些输入源、哪些 direct-write 被禁止。
- 先判断当前 `Slide UI` 是要：
  - 继续扩大适用 app 范围，
  - 还是继续增强 process shell 的表达能力，
  - 还是把它与后续新的用户产品页面共享容器能力。
- 不应把这条线当成“从零定义一个叫 slide UI 的东西”。

## 2. Matrix 当前基线

### 2.1 必须区分的两层

#### A. 现有 Matrix 接入

- 当前仓库里的 Matrix 主要是系统层能力，不是聊天产品。
- 关键落点：
  - `packages/worker-base/src/matrix_live.js`
  - [[docs/ssot/ui_to_matrix_event_flow]]
- 当前角色：
  - Management Bus Adapter
  - 负责 `dy.bus.v0` / 管理总线事件的收发
  - 与 `MBR`、MQTT、`remote-worker` 组成现有双总线基础设施

#### B. 未来要做的 Matrix 聊天/通话

- 这是新的用户侧产品线。
- 它应当落在正数 `model_id` 的用户模型 / app 体系里。
- 它可以共享同一个 Matrix homeserver。
- 但它在架构层级上不等于当前的总线适配器。

### 2.2 当前系统层已经具备的东西

- Matrix homeserver 接入
- `matrix-js-sdk` 使用基础
- `MBR` 与 Matrix/MQTT 的桥接路径
- `mt.v0` patch 口径的双工人最小闭环
- 现有颜色生成器等案例已经证明：
  - `ui-server`
  - `MBR`
  - `remote-worker`
  之间的远端链路可跑通

### 2.3 当前还没有的东西

- 用户登录 / 多用户会话管理
- 私聊 / 群聊产品 UI
- 面向用户的消息 timeline、会话列表、成员管理
- 用户产品层的视频通话
- 用户产品层的 E2E 加密

### 2.4 后续规划的正确起点

- 必须先把“系统层 Matrix bus adapter”与“用户产品层 Matrix app”拆开规划。
- 新的聊天/通话能力不能直接写成“继续扩展现有 Matrix”，否则会混淆层级。
- 更准确的说法应当是：
  - 复用现有 Matrix 基础设施与 homeserver
  - 新建用户侧通讯产品线

## 3. Three.js 当前基线

### 3.1 权威起点

- 已完成迭代：
  - [[docs/iterations/0216-threejs-runtime-and-scene-crud/plan]]
  - [[docs/iterations/0216-threejs-runtime-and-scene-crud/runlog]]
  - [[docs/iterations/0217-gallery-extension-matrix-three/plan]]
  - [[docs/iterations/0217-gallery-extension-matrix-three/runlog]]
- 冻结常量：
  - `packages/ui-model-demo-frontend/src/model_ids.js`
- 冻结合同测试：
  - `scripts/tests/test_0216_threejs_scene_contract.mjs`

### 3.2 已完成到哪一步

- 当前已有正式 `ThreeScene` primitive。
- 当前已有两层正式结构：
  - `1007` = scene app model
  - `1008` = scene child truth model
- 当前已有 4 个正式 CRUD intent：
  - `three_scene_create_entity`
  - `three_scene_select_entity`
  - `three_scene_update_entity`
  - `three_scene_delete_entity`
- 当前已有权威 scene truth：
  - `scene_graph_v0`
  - `camera_state_v0`
  - `selected_entity_id`
  - `scene_status`
  - `scene_audit_log`
- 当前 `/gallery` 也已经能作为 integration showcase 读取这条线。

### 3.3 当前范围边界

- 现在的正式支持仍然是最小闭环，不是完整场景编辑器。
- 当前重点是基础 scene/entity CRUD。
- 几何体能力目前仍偏基础（例如 box / sphere / plane 一类最小 primitive）。
- 相机已有状态口径，但：
  - 灯光
  - 材质
  - 动画
  还没有形成和 `scene_graph_v0` 同等级的完整 label 合同。

### 3.4 后续规划的正确起点

- 应把“材质、灯光、相机、动画等也都是对象”理解为对 `0216` 合同的扩展。
- 不应把这条线重新描述成“从零做一个 3D CRUD 系统”。
- 后续重点应是：
  - 扩大对象种类
  - 为这些对象补正式 label 合同
  - 确保模型表改动能稳定驱动前端场景同步更新

## 4. 三条主线之间的关系

### 4.1 真依赖

- 双总线 / `MBR` / `remote-worker` 是远端交互类能力的基础设施。
- Matrix bus adapter 属于这一层。

### 4.2 共享但不构成强依赖

- `Slide UI` 与后续聊天产品可能共享 Workspace 容器或 UI 组织方式。
- 但 `Slide UI` 不是 Matrix 聊天产品的硬前置依赖。

### 4.3 并行扩展关系

- Three.js 线与 Matrix 聊天线更多是并行产品/能力线。
- 它们共享：
  - ModelTable 规约
  - Workspace 容器
  - 远端 worker / bus 基础设施（部分场景）
- 但它们不是同一条产品线的不同阶段。

## 5. 跨线新增约束

### 5.1 UI 模型能力扩展必须合法沉淀

- 这三条线后续推进时，都可能需要扩展 UI 模型能力。
- 这些扩展不能作为一次性页面特判存在，而应当按现有规约合法落进 UI 模型体系。
- 新的 UI 能力应优先沉淀为：
  - 可复用的 UI 组件能力
  - 可复用的 authoring 字段约定
  - 可验证的 contract / validator

### 5.2 Gallery 应持续承担能力展示与回归入口

- 新增 UI 模型能力应尽量逐步沉淀到 `Gallery`。
- `Gallery` 继续作为：
  - 组件能力展示面
  - 集成能力展示面
  - 后续回归验证入口
- 不应把重要新能力只藏在单一业务页面里，而没有可复用的展示/验证落点。

### 5.3 使用文档也应逐步进入 UI 模型主线

- 后续新增 UI 模型能力时，应同步补使用说明文档。
- 这些说明文档最好逐步也由 UI 模型来实现，而不是始终停留在独立 HTML/Markdown 手写版本。
- 长期目标是：
  - UI 组件库
  - 对应使用说明
  - 对应示例页面
  共同构成“模型表语言范畴内”的可复用资产。

## 6. 后续正式规划前必须先回答的问题

### 5.1 Slide UI

- 是继续扩展 `0214` 的 flow-capable 覆盖范围，还是继续增强 shell 表达能力？
- 哪些未来 app 必须真的进入 Slide UI 主线，哪些只是共享 Workspace 外壳？

### 5.2 Matrix 用户产品线

- 用户模型、会话模型、房间模型、消息真值模型如何分层？
- 先做聊天，再做视频；每一阶段的“先不加密 / 再加密”如何拆迭代？
- 哪些能力复用当前 Matrix bus 层，哪些必须单独建产品模型和 UI？

### 5.3 Three.js 扩展线

- 下一批正式纳入模型表驱动的对象，优先是：
  - 灯光
  - 材质
  - 相机
  - 动画
  中的哪一批？
- 是继续沿 `scene_graph_v0` 扩字段，还是拆成多个正式 truth label？

## 7. Baseline Summary

- `Slide UI`：已有 `0214` 正式基础，不是空白概念。
- Matrix：当前完成的是系统层 bus adapter；未来聊天/视频是新的用户产品线。
- Three.js：已有 `0216/0217` 最小正式闭环；后续是扩对象体系，不是从零重做。
- UI 模型能力扩展后，应同步合法沉淀到 Gallery 与使用文档，逐步形成可复用组件库和说明体系。
- 后续任何大规划都应先基于这三条“当前起点”来拆，而不是把它们混成一条线。
