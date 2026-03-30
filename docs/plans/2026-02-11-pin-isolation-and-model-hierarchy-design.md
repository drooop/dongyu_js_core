---
title: "PIN 隔离与模型层级通信设计"
doc_type: note
status: active
updated: 2026-03-21
source: ai
---

# PIN 隔离与模型层级通信设计

`docs/plans/2026-02-11-pin-isolation-and-model-hierarchy-design.md`

> 日期：2026-02-11
> 状态：Design Approved（所有待确认项已收口，待拆分为 Iteration）
> 上位约束：`docs/architecture_mantanet_and_workers.md`、`docs/ssot/runtime_semantics_modeltable_driven.md`

---

## 0. 问题陈述

当前 JS 版的 PIN_IN 实现（cell-owned binding）允许 MQTT 消息直接写入任意 Cell，违反了"数据分离可审计"的隔离要求。具体问题：

1. 任何 MQTT client 理论上可以向任意 Cell 发送消息
2. 缺乏统一的模型入口点——消息可以绕过 (0,0,0) 直接进入模型内部
3. 子模型没有清晰的边界定义，父子模型间的数据流缺乏显式声明
4. 负数 model ID（系统模型）与正数 model（应用模型）没有统一的层级语义

## 1. 设计目标

- **唯一外部入口**：整个系统只有一个 MQTT 入口，在 Model 0 的 (0,0,0)
- **唯一根模型**：Model 0 是系统根（基础设施层），同时挂载系统子模型和应用子模型
- **分层隔离**：外部→根模型→子模型→Cell，逐级路由，不可跳跃
- **可审计**：每一跳都有显式声明，可在 ModelTable 中追踪完整路径
- **统一连接模型**：Cell 内所有连接（自身 PIN、函数、子模型）用一张表描述
- **统一模型层级**：正数/负数 model 使用同一套父子机制，无特殊路径
- **与 PICtest 概念对齐**：借鉴 Python 版已验证的 3 层连接架构

---

## 2. 模型层级架构

### 2.1 Model 0 = 系统根

Model 0 不是"用户的主应用模型"，而是整个系统的**根/框架模型**：

```
Model 0 (系统根)
├── [Cell(0,0,0)] BUS_IN/OUT + cell_connection（路由声明）
├── [Cell(1,0,0)] subModel: Model -1（editor_mailbox）
├── [Cell(1,0,1)] subModel: Model -2（editor_state）
├── [Cell(1,0,2)] subModel: Model -10（运行时配置）
├── [Cell(2,0,0)] subModel: Model 10（应用模型 A）
├── [Cell(3,0,0)] subModel: Model 11（应用模型 B）
└── cell_connection 统一路由系统和应用子模型间的数据流
```

- **负数 model ID**（-1, -2, -10...）= 系统子模型，通过 subModel label 挂载
- **正数 model ID**（10, 11...）= 应用子模型，用户操作的对象
- 用户不直接操作 Model 0，只操作应用子模型
- BUS_IN/OUT 在 Model 0 的 (0,0,0)，与用户可操作的应用子模型隔离

### 2.2 Bootstrap 顺序

1. 加载 Model 0 框架 + 系统子模型（负数 ID），系统配置就绪
2. 加载应用子模型（正数 ID），读系统配置建立 BUS_IN/OUT 和路由
3. 运行时：正常数据流

### 2.3 三层连接架构

```
┌─────────────────────────────────────────┐
│  Layer 1: 系统边界                       │
│  BUS_IN / BUS_OUT                       │
│  位置: Model 0 的 (0,0,0)               │
│  职责: 外部控制总线 (MQTT) 的唯一入口/出口 │
├─────────────────────────────────────────┤
│  Layer 2: 模型内路由                     │
│  cell_connection                        │
│  位置: 各 Model 的 (0,0,0)              │
│  职责: Cell 间路由表                     │
│  ＋ MODEL_IN / MODEL_OUT               │
│  位置: 子模型的 (0,0,0)                 │
│  职责: 子模型的边界入口/出口             │
├─────────────────────────────────────────┤
│  Layer 3: Cell 内连接                    │
│  CELL_CONNECT                           │
│  位置: 各 Cell                          │
│  职责: 统一连接表 (自身/函数/子模型)     │
└─────────────────────────────────────────┘
```

---

## 3. 完整 Label Type 规范

### 3.1 系统边界层

| Type | 位置 | 唯一性 | 语义 |
|------|------|--------|------|
| `BUS_IN` | 仅 Model 0 的 (0,0,0) | 全系统唯一 | 外部控制总线入口。k = 本地端口名，运行时从系统子模型（Model -10）读取配置，拼接完整 MQTT topic（沿用 `uiput_9layer_v2`）后订阅。MQTT 消息到达时写入 v。 |
| `BUS_OUT` | 仅 Model 0 的 (0,0,0) | 全系统唯一 | 外部控制总线出口。v 被写入时，运行时拼接 topic 后发布到 MQTT。 |

### 3.2 模型边界层

| Type | 位置 | 唯一性 | 语义 |
|------|------|--------|------|
| `MODEL_IN` | 子模型的 (0,0,0) | 模型内唯一 | 从父模型接收数据。父模型通过 CELL_CONNECT 的 submodel ID 前缀写入。 |
| `MODEL_OUT` | 子模型的 (0,0,0) | 模型内唯一 | 向父模型回传数据。数据到达时通知父模型的 hosting cell。 |

### 3.3 模型内路由

| Type | 位置 | 语义 |
|------|------|------|
| `cell_connection` | 各 Model 的 (0,0,0) | Cell 间路由表。格式见 §4.5。仅在同一 Model 内路由。 |

### 3.4 Cell 层

| Type | 位置 | 语义 |
|------|------|------|
| `PIN_IN` | 各 Cell | Cell 的输入端口。从 cell_connection 路由目标接收数据。 |
| `PIN_OUT` | 各 Cell | Cell 的输出端口。数据写入后触发 cell_connection 查表路由。 |
| `CELL_CONNECT` | 各 Cell | **统一连接表**（见 §4）。替代原 label_connection、function_PIN_IN、function_PIN_OUT。 |
| `function` | 各 Cell | 程序模型。v = 代码字符串，init 时编译为 AsyncFunction。 |
| `subModel` | 各 Cell | 声明该 Cell 挂载的子模型。k = 子模型 ID，v = `{"alias": "sensor_ui"}`（alias 可选，仅供 UI 展示）。 |

### 3.5 被取消的 Type

以下 Type 合并进 CELL_CONNECT，不再单独存在：

- ~~`label_connection`~~ → CELL_CONNECT 的 `self` 前缀
- ~~`function_PIN_IN`~~ → CELL_CONNECT 的 `func` 前缀
- ~~`function_PIN_OUT`~~ → CELL_CONNECT 的 `func` 前缀
- ~~`trigger_funcs`~~ → CELL_CONNECT 已声明 PIN → 函数连接，trigger 机制冗余

---

## 4. CELL_CONNECT 格式规范

### 4.1 数据结构

CELL_CONNECT 的 v 是一个字典：

```
{
  (源前缀, 源端口名): [(目标前缀, 目标端口名), ...],
  ...
}
```

### 4.2 前缀定义

| 前缀 | 含义 | 解析方式 |
|------|------|----------|
| `self` | Cell 自身的 PIN（PIN_IN / PIN_OUT） | `cell.get_pin(pin_name)` |
| `func` | Cell 内函数的端口 | `cell.get_function_pin(pin_name)`，命名约定: `funcname:in`（输入）、`funcname:out`（输出） |
| `<数字ID>` | 挂载在该 Cell 上的子模型（如 `10`） | `parent_model.get_submt(id).get_pin(pin_name)`，引用子模型 (0,0,0) 的 MODEL_IN / MODEL_OUT |

与 PICtest 的差异：PICtest 用 `!SELF!`/`!FUNCTION!`/`<submodel_name>`，JS 版简化为 `self`/`func`/`<数字ID>`。因子模型用数字 ID，与 `self`/`func` 不会冲突。

### 4.3 示例

Cell(2,2,2) 上挂载了 subModel(k="10", v={"alias": "sensor_ui"})，且有函数 process_A1：

```json
{"k": "wiring", "t": "CELL_CONNECT", "v": {
    "(self, topic_cellA)":         ["(func, process_A1:in)"],
    "(func, process_A1:out)":      ["(self, topic_cellA_OUT)"],
    "(self, data_for_sensor)":     ["(10, from_parent)"],
    "(10, to_parent)":             ["(self, sensor_result)"]
}}
```

含义：
1. Cell 的 PIN_IN "topic_cellA" → 触发函数 process_A1
2. 函数 process_A1 输出 → Cell 的 PIN_OUT "topic_cellA_OUT"
3. Cell 的 PIN_IN "data_for_sensor" → 子模型 10 的 MODEL_IN "from_parent"
4. 子模型 10 的 MODEL_OUT "to_parent" → Cell 的 PIN_OUT "sensor_result"

### 4.4 初始化与运行时行为

**初始化阶段**：
1. 运行时遍历所有 Cell 的 CELL_CONNECT label
2. 解析每个条目，根据前缀定位源端口和目标端口
3. 在内存中建立连接图（`source_pin.add_connect(target_pin)`）

**运行阶段**：
1. 端口收到数据 → 查内存连接图
2. 级联传播到所有已连接的目标端口（**默认并发**，见 §6）
3. 不重新解析 CELL_CONNECT label，只查图

### 4.5 cell_connection JSON 格式

cell_connection 使用 from/to 数组结构：

```json
{"k": "routing", "t": "cell_connection", "v": [
  {"from": [0,0,0,"test"],              "to": [[2,2,2,"topic_cellA"]]},
  {"from": [2,2,2,"topic_cellA_OUT"],    "to": [[3,3,3,"topic_cellB"]]},
  {"from": [2,2,2,"sensor_result"],      "to": [[0,0,0,"out_topic"]]}
]}
```

- `from`: `[p, r, c, k]` 四元组
- `to`: 二维数组，每个目标也是 `[p, r, c, k]`
- init 时遍历一次，建 `Map<"p|r|c|k", Target[]>` 内存路由表

---

## 5. 完整数据流示例

### 5.1 外部 MQTT → 模型内处理 → MQTT 发布

```
① 外部 MQTT 消息到达
   topic 匹配 Model 0 (0,0,0) BUS_IN(k="test")
   运行时写入 BUS_IN.v = "test_msg"

② 模型内路由
   cell_connection 查表:
     (0,0,0,"test") → [(2,2,2,"topic_cellA")]
   Cell(2,2,2) PIN_IN(k="topic_cellA") 收到 "test_msg"

③ Cell 内处理
   CELL_CONNECT 查图:
     (self, topic_cellA) → [(func, process_A1:in)]
   函数 process_A1 执行, 产出 "test_msg_done"
   CELL_CONNECT 查图:
     (func, process_A1:out) → [(self, topic_cellA_OUT)]
   PIN_OUT(k="topic_cellA_OUT") 写入 "test_msg_done"

④ 路由到其他 Cell
   cell_connection 查表:
     (2,2,2,"topic_cellA_OUT") → [(3,3,3,"topic_cellB")]
   Cell(3,3,3) PIN_IN(k="topic_cellB") 收到 "test_msg_done"

⑤ 输出到 MQTT
   cell_connection 最终路由到 (0,0,0,"out_topic")
   BUS_OUT(k="out_topic") 被写入
   运行时拼接 topic 后发布到 MQTT
```

### 5.2 父模型 → 子模型 → 父模型

```
① Model 0 的 cell_connection 路由到 Cell(3,3,3)
   Cell(3,3,3) PIN_IN(k="data_for_sensor") 收到数据

② Cell(3,3,3) 桥接到子模型
   Cell(3,3,3) 有 subModel(k="10")
   CELL_CONNECT 查图:
     (self, data_for_sensor) → [(10, from_parent)]
   子模型 10 的 (0,0,0) MODEL_IN(k="from_parent") 收到数据

③ 子模型内部处理
   子模型的 cell_connection + 各 Cell 的 CELL_CONNECT 完成内部路由
   ...处理完毕...

④ 子模型返回
   子模型 (0,0,0) MODEL_OUT(k="to_parent") 写入结果
   CELL_CONNECT 查图:
     (10, to_parent) → [(self, sensor_result)]
   Cell(3,3,3) PIN_OUT(k="sensor_result") 收到结果

⑤ 继续在父模型内路由
   cell_connection 将 (3,3,3,"sensor_result") 路由到下一站
```

### 5.3 嵌套子模型

```
Model 0 (系统根)
├── Cell(1,0,0): subModel "-1" (editor_mailbox)
├── Cell(1,0,1): subModel "-2" (editor_state)
├── Cell(1,0,2): subModel "-10" (运行时配置)
├── Cell(2,0,0): subModel "10" (app_ui)
│   Model 10
│   ├── Cell(2,0,0): subModel "11" (form_handler)
│   │   Model 11 (Model 10 的子模型)
│   │   └── 内部 Cells...
│   └── Cell(3,0,0): subModel "12" (chart_renderer)
│       Model 12 (Model 10 的子模型)
│       └── 内部 Cells...
└── Cell(5,0,0): 其他业务逻辑 Cell
```

每一层的连接机制完全一致：
- 父模型的 cell_connection → 路由到 hosting cell
- hosting cell 的 CELL_CONNECT → 桥接到子模型的 MODEL_IN
- 子模型的 cell_connection → 子模型内部路由

---

## 6. 函数执行模型

### 6.1 编译方式

JS 版采用 AsyncFunction 构造器（与 PICtest 的 `exec()` + `async def` 对等）：

```javascript
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const fn = new AsyncFunction('ctx', 'label', userCode);
```

- `function` label 的 v = 代码字符串
- init 阶段编译为 AsyncFunction，存储为可调用对象
- `ctx` 提供受限的 ModelTable 操作接口（addLabel/getLabel/rmLabel 白名单）

### 6.2 运行时执行

```javascript
async function executeFunction(funcDef, inputLabel) {
  const ctx = createSandboxedContext(funcDef.parentCell);
  try {
    const result = await Promise.race([
      fn(ctx, inputLabel),
      timeout(30000)  // 异步超时保护
    ]);
    if (result !== undefined) {
      await writeToPin(funcDef.calloutPin, result);
    }
  } catch (err) {
    await writeToPin(funcDef.logoutPin, { error: err.message });
  }
}
```

### 6.3 并发模型

- **默认并发**：CELL_CONNECT 中一个源连多个目标时，所有目标同时触发（Promise.all）
- **串行依赖**：通过连接拓扑表达——A:out → B:in，A 完成后 B 才触发
- **不需要排序注解**：连接图本身就是执行计划

### 6.4 KNOWN_LIMITATION: 同步阻塞

AsyncFunction 方案无法防止用户代码的同步阻塞（如 `while(true) {}`）。这是 Node.js 单线程事件循环的本质限制，PICtest 的 Python asyncio 有同样问题。

`Promise.race` 超时仅对异步等待有效，无法中断同步执行。

**后续版本解决方案**：Worker Threads + 消息代理模式。用户函数在 Worker 中执行，ModelTable 操作通过 `postMessage` 代理到主线程。代价：每次 ModelTable 操作增加约 0.1-1ms 延迟。

**当前约束**：用户代码必须是协作式的（所有长时间操作使用 await）。

---

## 7. 命名设计理由

### 7.1 BUS_IN / BUS_OUT

- 选择 `BUS` 而非 `MQTT`：与架构文档的"控制总线"抽象一致，不绑定具体传输实现
- 全系统唯一：强化"唯一外部入口"的隔离语义
- BUS_IN.k = 本地端口名，完整 MQTT topic 由运行时从系统子模型（Model -10）配置拼接

### 7.2 MODEL_IN / MODEL_OUT

- 选择 `MODEL` 而非 `SUBMODEL`：子模型的子模型也用 MODEL_IN，语义统一（"模型边界入口"不区分嵌套层级）
- 与 BUS_IN/OUT 对称：BUS = 系统边界，MODEL = 模型边界，层级清晰

### 7.3 CELL_CONNECT（统一连接表）

- 源自 PICtest 的 `CELL_CONNECT`，已验证的设计
- 合并原 `label_connection`、`function_PIN_IN`、`function_PIN_OUT`、`trigger_funcs`
- 前缀系统 (`self` / `func` / `<数字ID>`) 统一处理三种连接目标

### 7.4 函数端口命名

- 采用 `funcname:in` / `funcname:out` 而非 PICtest 的 `$funcname_cin$` / `$funcname_cout$`
- 理由：`:` 是通用命名空间分隔符，`in`/`out` 比 `cin`/`cout` 更直白，无 `$` 特殊字符转义问题
- 约束：函数名不可包含 `:`

### 7.5 CELL_CONNECT 前缀

- 采用 `self` / `func` 而非 PICtest 的 `!SELF!` / `!FUNCTION!`
- 理由：子模型引用为数字 ID，与英文字符串 `self`/`func` 不会冲突，无需定界符
- 更简洁、可读性更好

---

## 8. 与 PICtest 的对应关系

| PICtest | JS 版（本设计） | 说明 |
|---------|----------------|------|
| ManageV1N + InLabel/OutLabel on (0,0,0) | `BUS_IN` / `BUS_OUT` | 外部 MQTT 绑定 |
| ManageModel + MODEL_CONNECT | `cell_connection` | 模型内 Cell 间路由 |
| ManageCell + CELL_CONNECT | `CELL_CONNECT` | Cell 内统一连接表 |
| SubmtLabel (k=id, v=name) | `subModel` (k=id, v={alias}) | 子模型声明 |
| PIN class (IN/OUT) | `PIN_IN` / `PIN_OUT` | Cell 端口 |
| Function.$cin$/$cout$ | `func` prefix + `funcname:in/out` | 函数端口 |
| No explicit equivalent | `MODEL_IN` / `MODEL_OUT` | 子模型边界声明（PICtest 隐式） |
| !SELF! / !FUNCTION! / submodel_name | `self` / `func` / `<数字ID>` | CELL_CONNECT 前缀 |
| exec() + async def | AsyncFunction constructor | 函数编译 |

### 差异点

1. PICtest 的子模型入口是隐式的（通过 ManageModel 自动提升 (0,0,0) PINs），JS 版用显式的 `MODEL_IN` / `MODEL_OUT` label
2. PICtest 在 CELL_CONNECT 中使用子模型的**本地名称**，JS 版使用**子模型 ID**（数字）；别名通过 subModel.v.alias 提供，仅供 UI
3. JS 版使用简化的前缀（`self`/`func`），PICtest 使用定界符包裹（`!SELF!`/`!FUNCTION!`）
4. JS 版函数端口用 `funcname:in`/`funcname:out`，PICtest 用 `$funcname_cin$`/`$funcname_cout$`
5. Model 0 定位为系统根（挂载正负子模型），而非用户的主应用模型

---

## 9. 迁移影响

### 需要新增/重构的运行时行为

1. `BUS_IN` label 处理：替代当前 PIN_IN 的 MQTT 订阅逻辑，从 Model -10 读配置拼接 topic
2. `CELL_CONNECT` 解析器：init 时建图，支持 `self`/`func`/数字ID 前缀
3. `cell_connection` 路由器：替代当前的 cell-owned binding 路由，使用 from/to 数组格式
4. `MODEL_IN/OUT` 处理：子模型边界数据传递
5. `subModel` 加载器：声明式子模型注册与生命周期管理
6. 函数执行引擎：AsyncFunction 编译 + 受限 ctx + try-catch + 超时
7. 并发调度：CELL_CONNECT 多目标默认 Promise.all

### 可删除的现有代码

1. `pinInBindings` / `findPinInBindingsForDelivery`（cell-owned binding 机制）
2. 当前 PIN_IN 的 `v` 作为 TargetRef 的处理逻辑
3. 当前 mailbox cell (0,1,1) 作为默认 PIN_IN 目标的机制
4. `trigger_funcs` / `trigger_func` / `trigger_model_id` 机制

### 向后兼容

本设计是架构级变更，不保留 legacy 兼容。需要一次性迁移现有 system-models JSON 和验证脚本。

---

## 10. 已确认的设计决策（原 §9 待确认项）

| # | 问题 | 决策 | 理由 |
|---|------|------|------|
| 1 | CELL_CONNECT 中引用子模型 | **统一用模型 ID**（数字），别名存 subModel.v.alias，仅供 UI | 无歧义、无解析逻辑，PICtest 兼顾名称和 ID，JS 版简化为 ID only |
| 2 | cell_connection JSON 格式 | **from/to 数组结构**：`[{"from": [p,r,c,k], "to": [[p,r,c,k], ...]}, ...]` | 结构化、无字符串解析、类型保留（整数是整数） |
| 3 | BUS_IN/OUT MQTT topic | **BUS_IN.k = 本地端口名**，运行时从 Model -10 读配置拼接，**沿用 uiput_9layer_v2** | 9layer 寻址与 PIN 隔离正交；同一 Model 0 部署到不同工人时只改配置 |
| 4 | 函数端口命名 | **`funcname:in` / `funcname:out`**，前缀 **`self` / `func` / `<数字ID>`** | `:` 通用分隔符、`in/out` 直白、无 `$` 转义问题；前缀与数字 ID 天然不冲突 |
| 5 | trigger label | **去掉**，CELL_CONNECT 已声明 PIN → 函数连接 | trigger_funcs 是弥补缺少 CELL_CONNECT 的临时机制 |

---

## 11. 后续待处理

### 实施前需完成
1. 将本设计拆分为可执行的 Iteration（遵循 [[WORKFLOW]] 的 Phase 0-4 流程）

### 已知缺陷（后续版本）
1. **KNOWN_LIMITATION: 同步阻塞** — 用户代码同步死循环可卡死事件循环。解决方向：Worker Threads + 消息代理
2. **并发任务管理** — 系统基座保护（负数 model 优先级）、用户侧并发上限、背压机制。运行时调度策略，不影响 CELL_CONNECT 格式
