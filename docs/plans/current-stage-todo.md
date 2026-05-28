---
title: "当前阶段待办事项与待考虑方向"
doc_type: plan
status: active
updated: 2026-05-19
source: ai
---

# 当前阶段待办事项与待考虑方向

Status: Current Stage Todo / Evolution Basis

Authority: This document is a planning record. It does not override `docs/ssot/**`.

Purpose: Record project-level todos and directions that are important in the current stage but not yet frozen as SSOT or assigned to a specific iteration.

## 1. 滑动 APP 多实例与远端状态分仓

### 1.1 背景

当前滑动 APP 已支持同一个 APP 多次安装到 UI Server。

例如同一个颜色生成器被安装两次后，可以形成两个本地实例：

| 本地实例 | 来源 APP | 本地模型 ID | 显示状态 |
|---|---|---:|---|
| app_dupli_1 | E2E 颜色生成器 | 例如 1069 | 独立颜色 |
| app_dupli_2 | E2E 颜色生成器 | 例如 1070 | 独立颜色 |

这个行为是正确的。它说明 UI Server 侧已经能把“同一份 APP 模板”和“不同本地实例状态”分开。

### 1.2 已确认行为：本地实例为什么能独立显示不同颜色

#### 1.2.1 安装时生成独立本地模型

滑动 APP 的 ZIP / JSON patch 是模板。安装时，UI Server 不会复用原始源模型 ID，而是为每次安装分配新的本地模型 ID。

因此：

| 内容 | 说明 |
|---|---|
| UI 结构 | 来自同一份滑动 APP 模板 |
| 本地状态 | 每次安装后独立存放在新的模型表模型中 |
| 颜色值 | 写入各自本地模型的 `bg_color` |
| 状态值 | 写入各自本地模型的 `status` / `submit_inflight` 等 label |

#### 1.2.2 按钮入口按本地实例改写

安装过程会为每个本地实例生成独立的入口。

示例：

| 实例 | 本地入口示意 |
|---|---|
| app_dupli_1 | `imported_host_submit_1069` |
| app_dupli_2 | `imported_host_submit_1070` |

因此点击 `app_dupli_1` 的按钮，只会进入 `app_dupli_1` 的本地入口，不会误触发 `app_dupli_2`。

#### 1.2.3 回包按 `reply_target_model_id` 精确写回

两个本地实例可以请求同一个 Remote Worker 服务，例如都发到：

```text
UIPUT/<ws_id>/<dam_id>/<pic_id>/<de_id>/R1/100/submit
```

但请求模型表 payload 中会携带本地实例身份：

| 字段 | 含义 |
|---|---|
| `origin_worker_id` | 请求从哪个 UI Server / 软件工人发出 |
| `origin_model_id` | 请求来自哪个本地 APP 实例 |
| `reply_target_worker_id` | 回包应回到哪个 UI Server / 软件工人 |
| `reply_target_model_id` | 回包应写回哪个本地 APP 实例 |
| `reply_target_pin` | 回包进入本地实例的哪个入口，当前通常为 `result` |

所以回包时：

| 回包目标 | 写入位置 |
|---|---|
| `reply_target_model_id = 1069` | 只更新 app_dupli_1 |
| `reply_target_model_id = 1070` | 只更新 app_dupli_2 |

### 1.3 问题：Remote Worker 有状态服务需要远端分仓

当前机制可以保证 UI Server 本地多实例状态隔离。

但是，如果 Remote Worker 自己也保存业务状态，仅靠 `reply_target_model_id` 不够。

#### 1.3.1 无状态服务

颜色生成器当前更接近无状态服务：

```text
输入文本 -> 计算颜色 -> 回包
```

Remote Worker 不需要记住某个本地实例的长期状态。状态主要保存在 UI Server 本地实例中。

这种情况下，`reply_target_model_id` 已经足够。

#### 1.3.2 有状态服务

如果 Remote Worker 需要保存以下内容，就属于有状态服务：

| 状态类型 | 示例 |
|---|---|
| 会话历史 | 多轮对话、任务上下文 |
| 草稿状态 | 远端表单草稿、未提交编辑内容 |
| 长流程进度 | 审批流、生成任务、下载任务 |
| 用户配置 | 某个实例绑定的远端偏好 |
| 远端缓存 | 某个实例独有的中间结果 |

此时多个本地实例虽然都请求 `R1/100/submit`，但 Remote Worker 侧不能把它们混到同一份远端状态里。

### 1.4 待办：定义远端状态分仓字段

#### 1.4.1 推荐字段

建议在 pin payload 的模型表记录中增加一个显式字段：

```text
remote_state_scope
```

推荐格式：

```text
<origin_worker_id>/<origin_model_id>/<endpoint_worker_id>/<endpoint_model_id>
```

示例：

```text
U1/1069/R1/100
U1/1070/R1/100
```

#### 1.4.2 字段语义

| 字段 | 作用 |
|---|---|
| `endpoint_worker_id` / `endpoint_model_id` / `endpoint_pin` | 发给哪个远端服务处理 |
| `reply_target_worker_id` / `reply_target_model_id` / `reply_target_pin` | 结果回写到哪里 |
| `remote_state_scope` | Remote Worker 侧使用哪一个远端状态仓 |

这三个层次不能互相替代。

#### 1.4.3 后续需要确定的问题

| 问题 | 建议 |
|---|---|
| `remote_state_scope` 是否由 UI Server 自动生成 | 是，默认应由安装后的本地实例身份生成 |
| 用户是否可以覆盖 | 可以规划，但首版建议不开放 |
| Remote Worker 是否必须使用该字段 | 有状态服务必须使用；无状态服务可以忽略 |
| 是否需要远端状态清理 | 需要，但不放在首版实现 |

#### 1.4.4 验收标准

后续实现时至少需要验证：

| 验收项 | 期望 |
|---|---|
| 同一 APP 安装两次 | 两个本地实例获得不同 `remote_state_scope` |
| 两个实例请求同一远端模型 | 请求 topic 相同，但 payload 中 `remote_state_scope` 不同 |
| Remote Worker 保存状态 | 不同 `remote_state_scope` 不共享远端状态 |
| 回包写回 | 仍按 `reply_target_model_id` 写回正确本地实例 |

## 2. 显式指定走管理总线

### 2.1 背景

UI Server 当前不一定和云端服务位于同一个 VPN 环境。

远端 MQTT 服务可能只允许以下来源访问：

| 来源 | 是否可能访问远端 MQTT |
|---|---|
| localhost | 是 |
| VPN 网段 | 是 |
| 普通公网 UI Server | 不一定 |

因此仅靠 UI Server 直接走控制总线到远端 MQTT，在部分部署场景下不可用。

### 2.2 需要新增的路由方式

需要支持 APP 或请求显式指定：

```text
route_kind = "management"
```

此时路径应为：

```text
UI Server
  -> 管理总线
  -> MBR
  -> 控制总线
  -> Remote Worker
```

也就是：

| 阶段 | 路径 |
|---|---|
| UI Server 到 MBR | 管理总线 |
| MBR 到 Remote Worker | 控制总线 / MQTT |
| Remote Worker 回包 | 按对应回流规则返回 UI Server |

### 2.3 与默认路线的关系

默认仍应保持控制总线优先。

| 路由模式 | 适用场景 |
|---|---|
| `route_kind = "control"` | UI Server 能直接访问目标 MQTT / 控制总线 |
| `route_kind = "management"` | UI Server 不能直接访问目标 MQTT，需要 MBR 中转 |

### 2.4 推荐模型表声明方式

在滑动 APP 的远端端点配置中保留默认路由模式：

```json
{
  "transport": "mqtt",
  "route_kind": "control",
  "to": {
    "worker_id": "R1",
    "model_id": 100
  }
}
```

当需要显式走管理总线时：

```json
{
  "transport": "mqtt",
  "route_kind": "management",
  "to": {
    "worker_id": "R1",
    "model_id": 100
  }
}
```

说明：

| 字段 | 含义 |
|---|---|
| `transport` | 目标服务最终使用的传输类型，当前仍可为 `mqtt` |
| `route_kind` | UI Server 发出时选择的总线路径 |
| `to.worker_id` | 目标 Remote Worker |
| `to.model_id` | 目标 Remote Worker 上的服务模型 |
| `endpoint_pin` | 由按钮语义决定，例如 `submit` |

### 2.5 实施状态

0379 已冻结并实现首版显式管理总线路由：

| 项目 | 当前状态 |
|---|---|
| `remote_bus_endpoint_v1.route_kind` | 已支持；省略等同 `control`，非法值拒绝导入 |
| UI Server 出站 | `control` 接到 `pin.bus.cb.out`；`management` 接到 `pin.bus.mb.out` |
| MBR 转发 | 管理总线请求进入 MBR 后，按 payload `topic` 转为控制总线 / MQTT |
| topic truth | 仍只使用 payload records 中的 `topic` record，不做 per-app route registration |
| 回包 | 使用独立 `response_topic` 投递，并按 `reply_target_*` 写回本地实例 |

### 2.6 已实现点

| 编号 | 待办 | 说明 |
|---:|---|---|
| 1 | 扩展 `remote_bus_endpoint_v1` | 已支持声明默认 `route_kind` |
| 2 | 扩展 UI Server 出站逻辑 | 已根据 `route_kind` 选择控制总线或管理总线 |
| 3 | 扩展 MBR 转发逻辑 | 已接收管理总线请求后，按 payload topic 转发到控制总线 |
| 4 | 扩展回包路径 | 已明确按独立 `response_topic` 和 `reply_target_*` 回流 |
| 5 | 增加测试 | 已覆盖 control 默认路径和 management 显式路径 |
| 6 | 增加浏览器实测 | 0379 已使用显式 management 的最小 Submit 滑动 APP 完成安装、按钮提交和回包显示验证 |

### 2.7 验收标准

| 验收项 | 期望 |
|---|---|
| 默认不填 `route_kind` | 继续按 control 路径运行 |
| 显式 `route_kind = "control"` | UI Server 直接发控制总线 |
| 显式 `route_kind = "management"` | UI Server 先发管理总线到 MBR |
| MBR 收到 management 请求 | 按 payload topic 转发到控制总线 |
| 无 VPN UI Server 场景 | 不需要直接连远端 MQTT 也能触发 Remote Worker |
| 回包写回 | 仍按 `reply_target_model_id` 更新正确本地实例 |

## 3. 推荐后续 iteration 拆分

| Iteration | 目标 | 主要产物 |
|---|---|---|
| A | 远端状态分仓合同冻结 | `remote_state_scope` 字段、测试计划、文档 |
| B | 显式管理总线路由合同冻结 | `remote_bus_endpoint_v1.route_kind` 语义、MBR 转发责任 |
| C | UI Server / MBR 实现 | 出站分流、MBR management-to-control 转发、回包路径 |
| D | 示例 APP 与浏览器实测 | 一个 control 示例、一个 management 示例、双实例有状态验证 |

## 4. 当前结论

1. 同一个滑动 APP 多次安装后，本地显示不同颜色是正确行为。
2. 该行为当前依赖本地实例模型 ID 和 `reply_target_model_id` 隔离 UI Server 侧状态。
3. 如果 Remote Worker 提供有状态服务，还需要新增远端状态分仓字段。
4. 如果 UI Server 不能直接访问远端 MQTT，需要支持显式走管理总线，再由 MBR 转控制总线。
5. 以上两项应作为后续演进依据，先冻结合同，再实施。
