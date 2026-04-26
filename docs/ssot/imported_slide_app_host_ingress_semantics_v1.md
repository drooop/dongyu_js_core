---
title: "Imported Slide App Host Ingress Semantics v1"
doc_type: ssot
status: active
updated: 2026-04-26
source: ai
---

# Imported Slide App Host Ingress Semantics v1

## 0. Status

这是一份 **v1 已部分实现的正式规约**。

当前已经落地的范围只有：

- semantic:
  - `submit`
- locator form:
  - `root-relative cell locator`
- 安装时自动补：
  - `Model 0 pin.bus.in`
  - `Model 0 pin.connect.model`
  - imported model root relay `pin.in`
  - imported model root relay `pin.connect.cell`

其余更广泛的 semantic / locator form 仍属于后续扩展，不在本页 v1 实现范围内。

当前 live code 的其他事实，仍以：

- `0305`
- `0306`
- `0310`
- `0311`
- `docs/ssot/runtime_semantics_modeltable_driven.md`

为准。

0326 之后的 current truth 是：正式业务入口经 `bus_event_v2 -> Model 0 (0,0,0) pin.bus.in`，再由 pin route 转给目标模型。早期 direct target-cell 入口只作为 historical / superseded 口径保留在旧 iteration 记录中，不再是本页 current behavior。

## 1. 为什么需要这份规约

当前仓库已经冻结了这些事实：

- 前端正式协议是：
  - `target = cell`
  - `pin = port`
- 输入草稿和延后提交已经成立
- cell 的有效模型标签唯一，但可被多层 scope 发现
- 真正执行靠 pin 链和目标坐标，而不是靠“显式多重归属”

但 imported app 仍缺一层正式裁决：

- 宿主怎样把外来的正式业务输入交给 imported app
- 宿主在安装时自动补哪些 adapter
- imported app 最少要暴露哪些边界 pin，宿主才知道怎么接

本页只裁决这 3 件事。

## 2. 当前事实与正式规约的分界

### 2.1 当前事实

- 前端正式业务事件提交为 `bus_event_v2`。
- `Model 0 (0,0,0) pin.bus.in` 是正式业务 ingress 的统一入口。
- imported app 导入后，可以自己定义内部 pin 链、helper、root relay。
- 输入草稿、本地 overlay、on_blur / on_submit 延后同步已经成立。

### 2.2 v1 正式方向

对 imported slide app 来说，v1 的正式方向是：

- imported app 保留自己的内部程序模型和内部 pin 链
- 宿主在安装时自动补一层“宿主接入 adapter”
- 所有 **正式业务 ingress** 先进入宿主统一入口
- 再由宿主 adapter 转给该 imported app 声明的边界 pin
- imported app 内部后续怎样继续 relay、调用 helper、继续外发，仍由 app 自己定义

补充：

- 本地 UI 草稿态不属于这条统一 ingress
- 它们继续保留在本地 UI / overlay / 延后提交链路中

## 3. Decision 1：哪些事件属于宿主正式 ingress

### 3.1 不进入宿主正式 ingress 的事件

以下事件属于 **本地 UI 态**，不应被强制统一到宿主 `Model 0`：

- input 正在输入中的草稿值
- 本地 overlay value
- hover / focus / 展开态 / 临时选中态
- on_blur 之前尚未提交的编辑草稿
- 其他只影响本地交互体验、尚未进入正式业务链的 UI 临时状态

这些事件仍可继续使用：

- 前端本地草稿
- 负数状态模型
- on_blur / on_submit / delayed commit

### 3.2 必须视为宿主正式 ingress 的事件

以下事件属于 **正式业务 ingress**，必须统一进入宿主入口：

- submit
- confirm
- create
- delete
- import
- send
- execute
- invoke
- 其他会触发：
  - imported app 正式业务程序模型
  - 宿主持久化/资源变更
  - 对外 transport
  - 跨模型正式 relay

判断标准只有一条：

- 如果这个事件已经不再是“本地 UI 草稿”，而是要进入正式业务链，就属于宿主正式 ingress。

## 4. Decision 2：安装时宿主自动补哪些 adapter

imported app 安装完成后，宿主应自动补一层 **host-owned adapter**。

这层 adapter 的职责只有 3 类：

1. 定义 imported app 的宿主入口
   - 宿主如何识别这个 imported app 的正式 ingress
2. 将宿主入口 relay 到 imported app 的边界 pin
   - 由宿主生成 relay / mount adapter
3. 隔离宿主边界与 app 内部实现
   - 宿主不直接耦合 imported app 的内部 helper pin / 中间 cell

宿主自动补的 adapter 可以包含：

- `Model 0` ingress key / ingress pin
- imported app 对应的 relay pin
- host-to-app 的 `pin.connect.*` 或等价 wiring
- 与安装时分配出的目标模型号绑定的挂载适配层

宿主 **不应** 自动做这些事：

- 直接把 imported app 的内部 helper pin 暴露给外部
- 直接把 imported app 的内部 cell 坐标当作长期公共入口
- 把 imported app 的内部 relay 细节写死到用户侧说明中

一句话：

- imported app 的内部实现归 app 自己
- imported app 的宿主接入链归宿主自动生成

## 5. Decision 3：imported app 最少要暴露哪些边界 pin

imported app 后续若要接入宿主正式 ingress，至少要显式暴露 **边界 pin**。

这些边界 pin 的要求是：

- 它们是 host-facing 入口
- 它们代表 imported app 愿意让宿主接入的正式业务入口
- 宿主只能连接这些已声明的边界 pin
- 宿主不应越过这些边界 pin，直接接内部 helper / relay

最少声明内容应包含：

1. pin 名称
   - 宿主接哪一个入口
2. pin 输入值类型
   - 宿主写什么类型的值
3. ingress 类别
   - 必须是正式业务 ingress，而不是本地 UI 草稿入口
4. 边界语义
   - 例如 submit / confirm / create / delete / invoke
5. 稳定定位信息
   - 宿主如何唯一定位这个边界 pin 所在的 cell

### 5.1 稳定定位要求

宿主后续要自动补 `pin.connect.*`，不能只知道“有一个叫 submit 的 pin”。

因此，每个 host-facing 边界 pin 还必须提供 **稳定定位信息**，使宿主在安装时可以唯一确定接线目标。

本规约要求至少满足这 3 条：

1. 宿主必须能在 imported app 内唯一定位到该边界 pin
   - 不能靠“扫描到第一个同名 pin 就接上”
2. 定位结果必须稳定
   - 不能依赖导入后随机生成的临时顺序
   - 也不能依赖宿主去猜内部 helper / relay 结构
3. 边界 pin 的定位应当相对于 imported app 自己的根来表达
   - 而不是写成宿主安装后的外部绝对模型号

### 5.2 当前冻结的最小定位语义

这一版先冻结语义，不冻结最终 label schema。

也就是说，后续实现至少要能表达出下面这些信息：

- `pin_name`
- `semantic`
- `value_t`
- `locator_kind`
- `locator_value`

其中：

- `locator_kind`
  - 表示宿主该按哪种方式定位
- `locator_value`
  - 表示对应的具体定位值

### 5.3 v1 的强制定位方式

为避免“宿主和 imported app 都合规，但仍然互相接不上”，v1 必须有一个 **强制 locator form**。

本规约在 v1 明确要求：

- imported app 的 host-facing 边界 pin，必须使用：
  - `root-relative cell locator`

也就是说，宿主与 imported app 在 v1 里必须共享同一种定位形式：

- 相对于 imported app root 的 `(p,r,c)` + `pin_name`

这条要求同时约束两边：

- imported app 在 v1 中，必须提供 root-relative 定位信息
- 宿主在 v1 中，必须支持 root-relative 定位并以此生成自动接线

### 5.3.1 为什么 v1 只强制一种 form

如果 v1 允许多种 locator form，但只要求宿主“至少支持其中一种”，就会出现：

- imported app 合规地声明 `boundary_id`
- 宿主也合规地只支持 `root-relative`
- 最终双方都合规，但自动 wiring 仍然失败

本规约不允许这种“合规但不互通”的状态。

### 5.3.2 后续可扩展方向

未来版本可以增加其他 locator form，例如：

- import-time resolvable boundary id

但前提必须是：

- 该版本同时明确宿主必须支持哪些 form
- imported app 应声明哪个 form 为 mandatory
- 不得回到“双方各支持一种即可”的开放状态

### 5.4 不允许的定位方式

以下方式不应作为正式宿主接线依据：

- “宿主扫描全模型，找到第一个同名 pin”
- “宿主扫描所有同语义入口，自行挑一个”
- “宿主直接接 imported app 的内部 helper pin / relay pin”
- “宿主依赖安装后派生出的外部共享 AST 或投影结果反推入口”

### 5.5 多入口时的规则

如果 imported app 内存在多个同语义入口，必须显式声明：

- 哪一个是宿主正式 ingress 的 primary 边界 pin

并且这个 primary 边界 pin 仍必须使用：

- root-relative cell locator

宿主后续只允许自动连接被声明为 primary 的那个边界入口。

### 5.6 v1 的具体声明 schema

v1 现在已经冻结为一个具体 root label：

- Cell:
  - imported app root `(0,0,0)`
- Label:
  - `k = host_ingress_v1`
  - `t = json`

值结构固定为：

```json
{
  "version": "v1",
  "boundaries": [
    {
      "semantic": "submit",
      "pin_name": "submit_request",
      "value_t": "modeltable",
      "locator_kind": "root_relative_cell",
      "locator_value": { "p": 2, "r": 2, "c": 0 },
      "primary": true
    }
  ]
}
```

v1 当前还要求：

- `boundaries` 数组长度必须为 1
- 该唯一边界必须同时是：
  - `semantic = submit`
  - `primary = true`
- `locator_kind` 只能是：
  - `root_relative_cell`
- `locator_value` 指向的 cell 上，必须存在：
  - `k = pin_name`
  - `t = pin.in`

## 6. 宿主与 imported app 的职责分界

### 6.1 宿主负责

- 安装时分配模型号
- 安装时生成宿主 adapter
- 统一接收正式业务 ingress
- 把 ingress relay 到 imported app 的边界 pin
- 继续负责宿主侧审计、资源边界与系统 transport

当前 v1 已实现的宿主自动生成 labels 为：

- `Model 0 (0,0,0)`
  - `k = imported_host_submit_<model_id>`
  - `t = pin.bus.in`
- `Model 0 (0,0,0)`
  - `k = imported_host_submit_<model_id>_route`
  - `t = pin.connect.model`

同时，宿主会在 imported model root 自动补一层 relay：

- imported root `(0,0,0)`
  - `k = __host_ingress_submit`
  - `t = pin.in`
- imported root `(0,0,0)`
  - `k = __host_ingress_submit_route`
  - `t = pin.connect.cell`

删除 imported app 时，宿主必须把上述 `Model 0` 自动生成 labels 一并清理。

### 6.2 imported app 负责

- 声明自己的边界 pin
- 定义边界 pin 进入后怎样走内部 pin 链
- 定义内部 helper / relay / root 程序模型
- 定义后续业务结果如何在 app 内部继续传播

## 7. 对现有文档的影响

这份规约的直接影响是：

- 现有总览页、导入页、执行型导入页应引用它作为 current truth
- 文档必须区分本地 UI 草稿 / overlay 与正式业务 ingress
- 文档不得继续把 early direct target-cell path 写成当前正式业务入口

当前必须写成现状的是：

- 所有正式业务 ingress 经 `bus_event_v2 -> Model 0 (0,0,0) pin.bus.in`
- imported app 的 host ingress adapter 由宿主在安装时补齐
- imported app 内部后续 relay 仍由 app 自己定义

历史 direct-pin 口径只能作为 historical / superseded 说明出现在旧 iteration 记录中，不能出现在 current user-guide / SSOT 的正文里。

## 8. 后续扩展题目

current v1 已经落地 `submit` 语义和 `root_relative_cell` locator。后续扩展仍需回答：

1. `submit` 之外的 semantic 如何声明和验证
2. `root_relative_cell` 之外的 locator form 是否需要支持
3. 多边界 pin 时 primary / fallback / conflict 规则如何定义
4. host adapter 清理失败时如何记录和恢复

这些是 v1 之后的扩展题目，不影响当前正式业务 ingress 已收口到 Model 0。

---

## 9. Egress 对称扩展（0322 实装）

0320 ingress 冻结 + 0321 ingress 实装之后，0322 把同样的"声明 + 宿主补 adapter"模式扩展到出站。下列内容是 live code 事实。

### 9.1 imported app 侧的 egress 声明

imported app zip 必须：

- 在 root (0,0,0) 上声明 `dual_bus_model: json`，说明自己期望对外发送业务包。
- 在 root (0,0,0) 声明一个 `pin.out` 作为对外出口（约定名 `submit`；后续可通过 `dual_bus_model` 的 `egress_pin_name` 参数化，当前强制 `submit`）。
- 不允许在 zip 内声明 `pin.bus.in` / `pin.bus.out` / `pin.connect.model` / `func.python`，这些由 `SLIDE_IMPORT_FORBIDDEN_LABEL_TYPES` 拒绝，防止 imported app 自建第二个对外入口。

### 9.2 宿主自动补齐的 egress adapter（0326 current truth）

安装期 `materializeImportedHostEgressAdapter(runtime, rootModelId, mountCell, hostEgress)` 当前产出：

| 位置 | label | 作用 |
|---|---|---|
| Model 0 `mountCell` | `__host_egress_<semantic>_relay_<id>` `pin.in` | 接收 imported root `pin.out` 经 `pin.connect.label` 数字前缀转发的 value |
| Model 0 `mountCell` | `__host_egress_<semantic>_bridge_<id>` `pin.connect.label` | `(<rootModelId>, <pinName>) → (self, mountRelayPin)` |
| Model 0 `(0,0,0)` | `__host_egress_<semantic>_bridge_in_<id>` `pin.in` | 宿主 root bridge 入口 |
| Model 0 `(0,0,0)` | `bridge_imported_<semantic>_to_mt_bus_send_<id>` `func.js` | 把 imported payload 写到 `mt_bus_send_in` |
| Model 0 `(0,0,0)` | `imported_<semantic>_<id>_bridge_wiring` `pin.connect.label` | `(self, bridge_in) -> (func, bridge_func:in)` |
| Model 0 `(0,0,0)` | `imported_<semantic>_<id>_route` `pin.connect.cell` | `[mountCell,mountRelayPin] -> [0,0,0,bridge_in]` |
| Model 0 `(0,0,0)` | `imported_<semantic>_<id>_bus` `pin.bus.out` | 宿主 egress bus-out key |
| imported root `(0,0,0)` | `host_egress_generated_model0_labels` / `host_egress_generated_mount` | 删除清理清单 |

### 9.3 current egress 执行路径

1. imported app root `pin.out submit` 被写入 payload。
2. root pin.out 经过 mount relay / mount bridge 到达 Model 0 `(0,0,0)` 的 `bridge_in`。
3. `bridge_imported_*_to_mt_bus_send_*` 把 `{source_model_id, pin, payload, bus_out_key, op_id}` 写入 `mt_bus_send_in`。
4. `mt_bus_send` 构造 `pin_payload` packet，写入 `imported_<semantic>_<id>_bus` `pin.bus.out`。
5. runtime 对 `pin.bus.out` 执行 MQTT publish。
6. `ProgramModelEngine` 在 intercept 后补扫 `pin.bus.out`，按 packet `op_id` 做一次性 Matrix bridge。

### 9.4 删除契约

卸载 imported app 时 `removeImportedBundleFromRuntime` 必须：

- 删除 `host_ingress_generated_*` 与 `host_egress_generated_*` 清单里记录的全部 key。
- 禁止遗留 mount relay / mountBridge / bridge_in / bridge_func 让下一个 imported app 复用 cell 时污染路由。

### 9.5 Historical / Retired (pre-0326)

以下出站路径已退役，不再是 current truth：

- Model 0 `imported_<semantic>_<id>_out` `pin.in`
- Model -10 `forward_imported_<semantic>_from_model0_<id>` `func.js`
- imported root `dual_bus_model.model0_egress_label`
- imported root `dual_bus_model.model0_egress_func`
- `processEventsSnapshot -> executeFunction(forwardFunc) -> sendMatrix(packet)` 作为 imported host egress 主路径

范围限定：

- 上述退役只针对 imported-host 自动生成路径。
- 正数模型现有 dual-bus 配置中同名字段仍可能存在；它们不属于本节 imported-host 退役范围。
