---
title: "Label Type Registry"
doc_type: ssot
status: active
updated: 2026-04-29
source: ai
---

# Label Type Registry

> 本文件是所有 `label.t` 的权威注册表。运行时 `_applyBuiltins` 的 dispatch 列表必须与本表一致。
> 新增 `label.t` 必须先在本表注册，再实现运行时代码。

---

## 1. 常规参数标签

用于存储数据值，运行时不对其产生副作用。

| label.t | 说明 | value 类型 |
|---|---|---|
| `str` | 字符串 | string |
| `int` | 整数 | number |
| `float` | 浮点数 | number |
| `bool` | 布尔 | boolean |
| `list` | 列表 | array |
| `tuple` | 元组 | array |
| `dict` | 字典 | object |
| `json` | 任意 JSON | any |

---

## 2. 模型声明标签

规则：
- 每个 materialized Cell 必须且只能有一个有效模型标签（effective model label）。
- 有效模型标签是 Cell 的主归属 / 主执行形态，不等于它只能被一个上层 scope 发现。
- 在 table/matrix 作用域内，尚未物化且未显式声明的普通 Cell，其有效模型标签默认为 `model.single`。
- `model.name` 只允许写在模型自己的 `(0,0,0)`。
- Cell 的 scope discoverability 是派生语义：
  - 父模型可经 `model.submt` 逐层看到 descendants
  - `model.matrix` 可看到其范围内的 `model.single` 与更小矩阵
- 执行时不按“当前属于哪些 scope”分支，而按 pin 链与目标坐标传播。

| label.t | 说明 | key | value | 位置约束 |
|---|---|---|---|---|
| `model.single` | 普通 Cell / 简单模型声明 | `model_type` | 类型名（如 `Code.JS`） | 任意 Cell；table/matrix 普通 Cell 可隐式默认为本类型 |
| `model.matrix` | 矩阵模型根声明 | `model_type` | 类型名（如 `Data.Array`） | 矩阵自身相对 `(0,0,0)`；创建必填 |
| `model.table` | 模型表根声明 | `model_type` | 类型名（如 `Flow`） | 模型 `(0,0,0)`；创建必填 |
| `model.submt` | 子模型挂载/映射 Cell | `model_type` | 子模型 id | 任意 hosting Cell；该 Cell 仅允许 `model.submt` + `pin.*` + `pin.log.*` |

补充约束：
- `model.submt` 是 single-parent 挂载：同一个 child model 在任一时刻只能被一个父模型 hosting Cell 挂载。
- `model.submt` 只负责父子挂载，不自动赋予父模型对子模型内部 label 的 direct write 权限。
- child model 的正式输入/输出仍必须通过 hosting Cell 暴露出来的 pin relay 进入；最终落盘只能由 child owner materialize / reserved helper executor cell 完成。
- 删除 `model.submt` 仅删除父子挂载关系，不自动删除 child model 数据；只有删除 child model 自己的 `(0,0,0)` 根声明后，才删除整个 child model。
- 除 Model 0 外，每个模型都必须通过某个父模型 Cell 上的 `model.submt` 显式挂载进入模型层级。

保留约定：
- 每个需要正式 owner materialization 的模型，应保留一个 reserved helper executor cell。
- 该 helper cell 的职责是接收当前模型 scoped request，并在当前模型内完成 owner materialize；不得跨模型写入。
- 当前默认实现把该 helper cell 固定在 `(0,1,0)`，并保留以下 key：
  - `helper_executor`
  - `scope_privileged`
  - `owner_apply`
  - `owner_apply_route`
  - `owner_materialize`

### 2.1 UI Bootstrap Boundary (0210 Freeze)

- `ui_ast_v0`、`ws_selected_ast`、共享 mailbox root AST 都不是新的 label.t 合同；它们只是普通 `json` 数据标签在某些历史实现里的投影结果。
- 新的 UI bootstrap / mount 语义只能建立在：
  - `model.single` / `model.matrix` / `model.table` / `model.submt`
  - 显式页面目录
  - materialized Cell label
- 若某条 UI 路径需要把 `ui_ast_v0` 或共享 AST 当作 authoritative bootstrap，必须在 iteration 中被记为 legacy-debt / forbidden，而不是注册成新的 label.t。

---

## 3. PIN 端口标签（结构性声明，产生运行时副作用）

### 3.1 数据通道

| label.t | 说明 | key | value | 位置约束 |
|---|---|---|---|---|
| `pin.in` | Cell 级输入端口；写在非系统模型 root `(0,0,0)` 时也承担模型根边界输入 | 端口名 | `null` 或临时 ModelTable payload array | 任意 Cell |
| `pin.out` | Cell 级输出端口；写在非系统模型 root `(0,0,0)` 时也承担模型根边界输出 | 端口名 | `null` 或临时 ModelTable payload array | 任意 Cell |
| `pin.bus.in` | 系统边界输入端口 | 端口名 | `null` 或临时 ModelTable payload array | 仅 Model 0 (0,0,0) |
| `pin.bus.out` | 系统边界输出端口 | 端口名 | `null` 或临时 ModelTable payload array | 仅 Model 0 (0,0,0) |

0331 payload 约束：
- 正式业务 pin 的非空 value 必须是 `docs/ssot/temporary_modeltable_payload_v1.md` 定义的 record array。
- 对象 envelope（如 `{op, records}` / `{action, target}`）不再是正式 pin value。
- pin 名称 / 接收程序模型决定动作语义；payload 本身只表达数据。

0347 message / materialization 约束：
- pin value 中的 record array 是 Temporary ModelTable Message：`format is ModelTable-like; persistence is explicit materialization`。
- `id` 是 message-local 临时 id，不是正式 `model_id`。
- 写入 pin、route、bus、log/trace 或前端 projection 都不自动创建或更新正式 ModelTable。
- 只有接收程序模型、当前模型 D0 helper、owner materializer 或 importer/installer 明确执行 materialization 时，才允许产生正式 `add_label` / `rm_label` side effect。

### 3.2 日志通道

行为与数据通道一致，但类型隔离（不可与数据通道混连）。

说明：`pin.log.*` 视为 pin family 的一部分；当规约提到“引脚标签”时，默认同时包含 `pin.*` 与 `pin.log.*`。

| label.t | 说明 | key | value | 位置约束 |
|---|---|---|---|---|
| `pin.log.in` | Cell 级日志输入；写在非系统模型 root `(0,0,0)` 时也承担模型根边界日志输入 | 端口名 | 日志数据 | 任意 Cell |
| `pin.log.out` | Cell 级日志输出；写在非系统模型 root `(0,0,0)` 时也承担模型根边界日志输出 | 端口名 | 日志数据 | 任意 Cell |
| `pin.log.bus.in` | 系统边界日志输入 | 端口名 | 日志数据 | 仅 Model 0 (0,0,0) |
| `pin.log.bus.out` | 系统边界日志输出 | 端口名 | 日志数据 | 仅 Model 0 (0,0,0) |

### 3.3 连接规则

- `pin.in` ↔ `pin.out` 互连；`pin.log.in` ↔ `pin.log.out` 互连。
- 数据通道与日志通道不可混连。
- 同层级内 `in` 只连 `out`。
- 子模型对外连接只通过 (0,0,0) 的边界端口。

---

## 4. PIN 连接声明标签（结构性声明）

| label.t | 说明 | key | value 格式 | 位置约束 |
|---|---|---|---|---|
| `pin.connect.label` | Cell 内接线 | 连接名 | `[{from: "(prefix, pinName)", to: ["(prefix, pinName)", ...]}, ...]` | 任意 Cell |
| `pin.connect.cell` | Model 内跨 Cell 路由 | 连接名 | `[{from: [p,r,c,"pinName"], to: [[p,r,c,"pinName"], ...]}, ...]` | 仅 (0,0,0) |
| `pin.connect.model` | 跨 Model 路由 | 连接名 | `[{from: [modelId,"pinName"], to: [[modelId,"pinName"], ...]}, ...]` | 仅 Model 0 (0,0,0) |

`pin.connect.label` 的端点 `(prefix, pinName)` 语义：

| prefix 形式 | 含义 | 触发方向 |
|---|---|---|
| `self` | 当前 cell 上的 label（pin.in/pin.out） | label 写入时传播 |
| `func` | 当前 cell 上（或 Model -10 fallback）的 `func.*` label；`pinName` 形式必须是 `funcName:in` 或 `funcName:out` | 写 `:in` 触发函数执行；`:out` 是函数返回值 |
| 数字（如 `1030`） | 宿主接入的子模型边界 pin — 表示子模型 id；`pinName` 是子模型 root (0,0,0) 的 `pin.in` / `pin.out` | 子模型 root pin.out 被写 → 通过 `parentChildMap` 传播到该 cell 对应的 child id 前缀规则；反向写 `pin.in` 用于向子模型注入 |

数字前缀仅用于宿主 adapter 场景（例如导入 app 的 root pin.out 经 mount cell 的 pin.connect.label 桥接到宿主）。不是用户层模型的日常路由声明。

---

## 5. 函数标签（结构性声明）

| label.t | 说明 | key | value 格式 | 位置约束 |
|---|---|---|---|---|
| `func.js` | JS 函数 | 函数名 | `{"code": "async (ctx) => { ... }", "modelName": "scope"}` | 任意 Cell |
| `func.python` | Python 函数 | 函数名 | `{"code": "def func(ctx): ...", "modelName": "scope"}` | 任意 Cell |

value 字段说明：
- `code`（必填）：函数代码。
- `modelName`（推荐）：声明函数作用域；矩阵模型启用后用于父/子矩阵消歧。

兼容期说明：
- 旧格式 `value: "code string"` 仅用于历史模型兼容。
- 新模型必须使用结构化 value。

每个函数自动关联三个引脚：
- `{funcName}:in`（输入）
- `{funcName}:out`（输出）
- `{funcName}:log.out`（日志输出）

---

## 6. 流程标签（Tier 2 约定，非运行时结构性声明）

运行时不直接解释 `flow.*` 标签。由流程管理器函数（Tier 2 模板）读取并执行。

| label.t | 说明 | key | value |
|---|---|---|---|
| `flow.start` | 流程起节点 | `~StepName~` | 步骤名称 |
| `flow.develop` | 流程承节点 | `~StepName~` | 步骤名称 |
| `flow.trans` | 流程转节点 | `~StepName~` | 步骤名称 |
| `flow.end` | 流程合节点 | `~StepName~` | 步骤名称 |
| `flow.connect` | 流程节点连接 | `~NEXT~` / `~TRUE~` / `~FALSE~` | 目标步骤名 |
| `flow.develop.outpin` | 承节点外部引脚 | `~OutPin~` | 引脚名称 |
| `flow.develop.addend` | 承节点结束控制 | `~isAddEnd~` | true/false |
| `flow.trans.usecode` | 转节点代码控制 | `~isUseCode~` | true/false |
| `flow.trans.logicaltype` | 转节点判断逻辑 | `~LogicalType~` | `and` / `or` |
| `flow.trans.judgements` | 转节点判断条目 | `~Judgements~` | 判断条目列表 |

---

## 7. 数据模型 PIN 接口规范（Tier 2 约定）

0348 起，Data.* 目标合同由 `docs/ssot/feishu_data_model_contract_v1.md` 接管。

所有 Feishu-aligned 数据模型子类型共享统一 PIN 接口：

| pin 名称 | 方向 | 说明 |
|---|---|---|
| `add_data:in` | pin.in | 添加数据 |
| `delete_data:in` | pin.in | 删除数据 |
| `update_data:in` | pin.in | 修改数据 |
| `get_data:in` | pin.in | 获取数据（请求） |
| `get_data:out` | pin.out | 获取数据（响应） |
| `get_all_data:in` | pin.in | 获取全部数据（请求） |
| `get_all_data:out` | pin.out | 获取全部数据（响应） |
| `get_size:in` | pin.in | 获取数据量（请求） |
| `get_size:out` | pin.out | 获取数据量（响应） |

0296-era names such as `add_data_in`, `get_data_out`, `enqueue_data_in`, `dequeue_data_in`, `push_data_in`, `pop_data_in`, and `peek_data_in` may still exist in current implementation artifacts, but are not the target contract after 0348.

---

## 8. Historical Aliases（非当前规范）

以下旧名可能仍出现在历史文档/测试/代码中，但它们不是当前允许的新工作输入面。
除非用户显式批准，否则不得新增或保留兼容层来支持这些旧名。

| label.t | 替代方案 |
|---|---|
| `BUS_IN` | `pin.bus.in` |
| `BUS_OUT` | `pin.bus.out` |
| `CELL_CONNECT` | `pin.connect.label` |
| `cell_connection` | `pin.connect.cell` |
| `MODEL_IN` | 非系统模型 root `(0,0,0)` 上的 `pin.in` |
| `MODEL_OUT` | 非系统模型 root `(0,0,0)` 上的 `pin.out` |
| `pin.table.in` | 非系统模型 root `(0,0,0)` 上的 `pin.in` |
| `pin.table.out` | 非系统模型 root `(0,0,0)` 上的 `pin.out` |
| `pin.single.in` | 非系统模型 root `(0,0,0)` 上的 `pin.in` |
| `pin.single.out` | 非系统模型 root `(0,0,0)` 上的 `pin.out` |
| `pin.log.table.in` | 非系统模型 root `(0,0,0)` 上的 `pin.log.in` |
| `pin.log.table.out` | 非系统模型 root `(0,0,0)` 上的 `pin.log.out` |
| `pin.log.single.in` | 非系统模型 root `(0,0,0)` 上的 `pin.log.in` |
| `pin.log.single.out` | 非系统模型 root `(0,0,0)` 上的 `pin.log.out` |
| `IN` | `pin.in` |
| `function` | `func.js` |
| `subModel` | `model.submt` |
| `submt` | `model.submt` |
| `PIN_IN` / `PIN_OUT` | （已废弃） |
| `label_connection` | `pin.connect.label` |
| `trigger_funcs` | `pin.connect.label` |
| `function_PIN_IN` / `function_PIN_OUT` | （已废弃） |

## 9. Imported App Host Ingress Declaration（0321 MVP）

除 label.t 之外，当前仓库新增一条 v1 root label 声明，用于 imported slide app 的宿主接入：

- Cell:
  - imported app root `(0,0,0)`
- Label:
  - `k = host_ingress_v1`
  - `t = json`

v1 当前只允许：

- 一个 primary boundary
- `semantic = submit`
- `locator_kind = root_relative_cell`
- `locator_value = { p, r, c }`
- `pin_name` 对应的目标 label 必须是 `pin.in`

它不是新的 label.t，而是 imported app root 上的正式声明 key。

宿主安装后自动生成的接入 labels 当前包括：

- `Model 0`:
  - `pin.bus.in`
  - `pin.connect.model`
- imported model root:
  - `pin.in`
  - `pin.connect.cell`

删除 imported app 时，宿主必须清理安装时自动补上的 `Model 0` labels。
