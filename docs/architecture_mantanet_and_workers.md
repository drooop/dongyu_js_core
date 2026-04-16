---
title: "云海流核心概念与架构边界（SSOT）"
doc_type: note
status: active
updated: 2026-04-09
source: ai
---

# 云海流核心概念与架构边界（SSOT）

> 目的：沉淀“云海流（云海流）模型化体系”在 dongyu / V1N / PICtest 语境下的**稳定概念、不变量与边界**，作为仓库内的唯一事实来源（Single Source of Truth, SSOT）。
>
> 适用范围：所有方案设计、文档、测试脚本、以及代码实现讨论，均必须以本文档定义的术语与边界为准。
>
> 说明：本文档**不以源码路径为中心**（那属于实现导览文档），而以“概念宪法”为中心；实现细节可在独立的 `v1n_concept_and_implement.md` 中维护。

---

## 0. 不变量与设计目标

### 0.1 总体目标
云海流的目标是：用**模型表（ModelTable）**作为统一抽象，驱动**软件工人（Software Worker）**执行与**滑动 UI（Sliding UI）**呈现，实现“自上而下统一管控”的工业数字化/智能化平台能力，并能在多终端以“小系统（App-as-OS）”形态交付。

### 0.2 核心不变量（必须长期成立）
- **模型驱动**：业务能力优先由模型表描述，代码是运行时与扩展，不是唯一事实来源。
- **应用层扩展**：除模型表核心数据依赖外，基座内的应用层能力应由 ModelTable 的模型能力（数据/程序/流程/UI/文档）提供；系统级扩展通过“系统自带的负数 model_id 模型”承载，避免改动基座核心层语义边界。
- **三种模型形态**：简单模型（结构性沙箱）、矩阵模型（固定空间维度）、模型表（动态扩展），运行时必须区分并执行对应约束。
- **模型 id 三层语义**：`model_id > 0` 为用户创建模型空间；`model_id = 0` 为根/中间层；`model_id < 0` 为软件工人系统级能力层。
- **负数模型分层趋势**：`-1..-100` 更靠近基座/系统边界/系统支撑层；`-101..-199` 更靠近内置系统级应用；更深层负数区间需经 iteration 明确分配。
- **UI 是投影**：滑动 UI 是模型表的投影与交互入口，UI 不应承载业务真相。
- **执行在工人**：软件工人承担业务逻辑执行、流程推进与状态演进；终端壳负责呈现与交互。
- **PIN 解耦**：三层 PIN 架构（label/cell/model）以类型区分层级，消息通过 PIN 端口路由，不直接跨层。
- **总线解耦**：消息、指令、状态更新应通过“总线抽象”解耦，不绑定具体实现名。
- **工作区隔离**：跨网络/跨组织的协作必须在“工作区（Workspace）”边界内进行隔离与加密。
- **填表优先**：新能力必须优先通过填充模型（JSON patches）实现，运行时代码变更仅限于新增 label.t 解释或修复解释器 bug。
- **模型类型二维性**：Cell 有效模型标签来自 `model.single / model.matrix / model.table / model.submt`；普通未物化 Cell 在 table/matrix 作用域内默认有效类型为 `model.single`；类型值仍由 `model_type` 的 value 承载。
- **显式挂载**：除 Model 0 外，每个模型都必须通过某个父模型 Cell 上的 `model.submt` 显式进入层级。
- **禁止默认兼容**：历史别名/旧 label 类型不构成当前规范输入面；如需兼容保留，必须显式批准。
- **可审计可验证**：任何关键能力必须有脚本化验收路径；关键变更可回滚、可追踪。

---

## 1. 系统形态：小系统（App-as-OS）与可安装小应用

### 1.1 小系统（Micro App OS / App-as-OS）
- **定义**：dongyu 作为宿主壳（桌面/移动端），提供统一的账号态、资源管理、权限边界与运行环境；其上运行多个“能力模块/小应用”。
- **不是什么**：
  - 不是单一业务 App（例如“只做聊天”）。
  - 不是把所有业务写死在壳层代码里。
- **不变量**：
  - 顶层信息架构应以“应用/工作台/能力模块”组织，而不是某个单一功能为中心。
  - 系统级能力（安装、更新、权限、日志、诊断）应由小系统承接。

### 1.2 可安装小应用（ModelTable + Sliding UI App）
- **定义**：由模型表描述的“可安装包”，运行时加载模型表并由滑动 UI 渲染。
- **生命周期**：安装 → 启动 → 运行 → 停止 → 卸载（均可被记录与审计）。
- **不变量**：
  - 小应用的 UI 与行为来自模型表；壳仅提供容器与系统能力。
  - 安装/更新必须具备来源校验、版本记录与回滚策略。

### 1.3 内建能力模块（Built-in Capability App）
- **定义**：由小系统内建实现的系统级能力（例如通讯、账号、设置、诊断），在用户感知上可以以“小应用”形式呈现，但其实现不一定是模型表驱动。
- **不变量**：
  - 其地位应与可安装小应用并列，而非强行压过整个系统叙事。

---

## 2. 软件工人（Software Worker）与软件工人基座（Worker Base）

### 2.1 软件工人（Software Worker）
- **定义**：执行实际业务逻辑的后端执行单元，由模型表驱动，响应来自滑动 UI 或总线的指令，产出状态与结果，并通过总线回传。
- **职责边界（做什么）**：
  - 执行业务函数、任务与流程
  - 维护业务状态（由模型表与持久化共同定义）
  - 对外暴露可被系统集成的能力接口（抽象层）
- **职责边界（不做什么）**：
  - 不承担终端 UI 的呈现与交互编排
  - 不把某个通讯实现写死为唯一通道
- **不变量**：
  - 工人的可观测性（日志/状态/错误）必须可被系统读取与审计。

### 2.2 软件工人基座（Worker Base / PICtest / V1N Runtime）
- **定义**：软件工人的运行时与管理界面/工具集合（可包含管理 UI、模型编辑器、诊断工具等），用于加载、运行与维护模型表驱动的能力。
- **关系**：
  - Worker Base 是“运行时容器 + 工具链”，Software Worker 是“执行实例/执行单元”。
- **不变量**：
  - 基座的集成必须可沉淀（runbook + 脚本验收），避免每次上游变更导致宿主系统崩溃。
  - 基座必须支持“能力探测/降级”：在缺失依赖或资源时可关闭或提供明确 fallback，而不是无提示崩溃。

---

## 3. 模型表（ModelTable）、单元格（Cell）与模型形态（Model Forms）

### 3.1 ModelTable
- **定义**：系统的核心数据结构，由大量 Cell 组成；模型表既可描述数据结构，也可描述程序、流程、文档与 UI。
- **分层（概念层）**：
  - 数据模型：定义字段与元数据
  - 程序模型：定义处理过程与协程任务
  - 流程模型：由“起/承/转/合”节点组织的执行流
  - 文档模型：展示与编辑内容
  - UI 模型：以 UI 组件为基础的可渲染描述
- **不变量**：
  - 模型表是“可持久化、可版本化、可迁移”的。
  - 模型表的变更必须可审计（谁改了、何时改、影响什么）。

### 3.2 Cell
- **定义**：模型表中的最小单元，包含结构化字段（例如 plcktv 等）用于描述 UI、状态、逻辑、触发与数据。
- **不变量**：
  - Cell 字段语义必须在运行时内保持一致（不得随意改解释规则）。
  - 触发与副作用必须可观察（日志/状态回写/事件记录）。

### 3.3 Label
- **定义**：Cell 内的最小语义单元，由 (k, t, v) 三元组描述：
  - k（key）：标签名称，同一 Cell 内唯一
  - t（type）：标签类型，决定运行时如何解释该标签
  - v（value）：标签值，承载数据或声明内容
- **分类**：
  - 常规参数标签：存储数据值，运行时不产生副作用（str, int, float, bool, list, tuple, dict, json）
  - 结构性声明标签：运行时识别并触发副作用（pin.*、func.*、submt 等）
- **权威注册表**：`docs/ssot/label_type_registry.md`

### 3.4 Model Forms（模型形态）

四种 Cell 有效模型标签，均为 Tier 1 定义，由 `model_type` 标签的 `label.t` 区分。

**简单模型（model.single）**
- 单 Cell 模型，程序只能操作自身 Cell。
- API：`add_label(k, t, v)`（无坐标参数）。
- 结构性沙箱：代码无法越过 Cell 边界访问其他 Cell。
- 硬约束：一个 Cell 只能声明一种类型（不可同时为 Code.Python 和 Code.JS）。

普通 table/matrix Cell 在未显式物化时，可按有效语义默认视为 `model.single`。

**矩阵模型（model.matrix）**
- 固定维度（min_p/r/c, max_p/r/c），矩阵自身的相对 `(0,0,0)` 必须显式声明 `model.matrix`。
- 允许拆分为简单模型 / 从简单模型合并。
- 允许绝对原点不同于全局 `(0,0,0)`，但必须有可裁决的 relative→absolute 映射规则。

**模型表（model.table）**
- 动态大小，无维度约束，模型根 `(0,0,0)` 必须显式声明 `model.table`。
- 拥有独立 model_id，是当前主要运行时模型形态。
- **(0323) (0,0,0) 默认三程序**：每个 model.table 的 (0,0,0) 必须包含三个 `func.js` 默认程序（`mt_write` / `mt_bus_receive` / `mt_bus_send`），作为模型的控制面入口。详见 `docs/ssot/runtime_semantics_modeltable_driven.md` §5.3。
- **(0323) 权限模型**：用户程序仅可写自身 Cell（V1N.addLabel）、读当前模型内任意 Cell（V1N.readLabel）；跨 Cell 写入经 (0,0,0) mt_write，跨模型通信经 pin 链路。详见 `docs/ssot/host_ctx_api.md`。

**子模型映射位（model.submt）**
- 某个 Cell 的 `model_type` 若声明为 `model.submt`，则该 Cell 是 child model 的挂载/映射位。
- 该 Cell 只允许 `pin.*` 与 `pin.log.*` 共存。
- 删除 `model.submt` 只解除挂载，不自动删除 child model 数据。
- child model 挂载采用 single-parent 语义。

**模型类型二维编码**
- label.t = 形态（model.single | model.matrix | model.table | model.submt）
- label.v = 类型（Code.JS | Data.Array | Flow | Doc.Markdown | ...），但 `model.submt` 的 value 为 child model id
- 无效的形态×类型组合必须在注册时被拒绝。

补充：
- materialized Cell 仍只有一个 effective model label（主归属 / 主执行形态）。
- 但一个 Cell 可以被多个上层 model scope 派生发现：
  - 父模型可沿 `model.submt` ancestry 逐层看到 descendants
  - `model.matrix` 可看到其范围内的 `model.single` 与更小矩阵
- 执行时不按“当前处于哪些 scope”分支，而按 pin 链与目标坐标传播。

---

## 4. 滑动 UI（Sliding UI）

- **定义**：终端 UI 不是写死的界面，而是由模型表动态渲染；交互事件被转换为可路由的消息/指令，并驱动模型表状态变化。
- **不变量**：
  - UI 变更优先通过模型表与 token/规范完成，而不是散落硬编码。
  - UI 事件必须可追踪到模型表的某个 Cell 或某条执行路径（可解释性）。
  - UI 事件只写 mailbox（model_id=-1, Cell(0,0,1)），不直接操作总线。
  - mailbox 之后的“事件 -> 引脚 ingress / routing”解释属于 Tier 1 runtime，不属于 server 独有语义。

---

## 5. 总线抽象：管理总线、控制总线与 MBR

> 本节为抽象概念定义，不绑定具体实现名。

### 5.1 管理总线（Management Bus）
- **定义**：承载“用户交互事件、会话、通知、UI 状态更新”等高层消息的逻辑通道。
- **不变量**：
  - 面向人/面向交互，强调可达性与可追踪性。
  - 允许端到端加密/鉴权等安全策略叠加。
  - 携带用户身份（user identity），为授权决策提供认证基础。

### 5.2 控制总线（Control Bus）
- **定义**：承载“指令下发、设备控制、工人执行结果回传”等控制类消息的逻辑通道。
- **不变量**：
  - 面向执行与控制，强调可靠性、时序与审计。
  - 与管理总线在语义上区分，避免混用导致权限边界模糊。
  - 外部消息只能通过 pin.bus.in（Model 0, (0,0,0)）进入系统。

### 5.3 MBR（Message Bridge Robot）
- **定义**：管理总线与控制总线之间的桥接者，负责消息转发、协议适配与安全策略执行。
- **不变量**：
  - 是系统枢纽，必须可观测（日志、指标、异常追踪）。
  - 必须执行策略：鉴权、过滤、限流、审计、重放保护（至少具备策略接口）。

- 直达 path（in-proc transport）仅替换传输层，不绕过 ModelTable 语义，详见 `docs/ssot/runtime_semantics_modeltable_driven.md`。

### 5.4 四环智控模型（0153）

在 0152 的通用 intent dispatch 之上，系统进入四环闭环：

| 环节 | ModelTable 实体 | 约定 model_id | 职责 |
|---|---|---:|---|
| 感知 | `ui_event` mailbox | -1 | 接收 UI 事件 envelope |
| 认知 | `scene_context` | -12 | 维护场景上下文、最近意图、上一轮结果 |
| 决策 | `intent_dispatch_table` | -10 | action → function 查表分发 |
| 行动 | handler function + hostApi | -10 | 执行动作，写业务结果 |
| 反馈 | `action_lifecycle` | -1 | 统一记录 executing/completed/failed 状态 |

不变量：
- 认知模型与登录模型隔离：`Model -3` 保留登录用途；认知层固定使用 `Model -12`。
- `event_trigger_map.ui_event` 链路中，认知更新仍先于其他处理执行；自 `0187` 起，legacy `forward_ui_events` 已移除，不再存在 mailbox 的默认 Matrix forward。
- 行动反馈必须结构化写回 `action_lifecycle`，禁止仅靠日志或临时状态判断执行结果。

---

## 6. PIN 系统架构

> PIN（端口-接线-网络）是模型表内消息路由的核心机制。
> 详细运行时语义见 `docs/ssot/runtime_semantics_modeltable_driven.md`。
> 完整标签类型注册表见 `docs/ssot/label_type_registry.md`。

### 6.1 三层 PIN 架构

PIN 端口按**类型**区分层级（不是按位置硬编码）：

| 层级 | 数据通道 | 日志通道 | 作用域 |
|---|---|---|---|
| Cell 级 | pin.in / pin.out | pin.log.in / pin.log.out | 任意 Cell |
| Model 根边界 | pin.in / pin.out | pin.log.in / pin.log.out | 非系统模型 `(0,0,0)` |
| 系统边界 | pin.bus.in / pin.bus.out | pin.log.bus.in / pin.log.bus.out | 仅 Model 0 (0,0,0) |

### 6.2 三层连接声明

| 连接类型 | 作用域 | 端点格式 | 位置约束 |
|---|---|---|---|
| pin.connect.label | Cell 内接线 | pin 名称字符串 | 任意 Cell |
| pin.connect.cell | Model 内跨 Cell 路由 | [p, r, c, pinName] | 仅 (0,0,0) |
| pin.connect.model | 跨 Model 路由 | [modelId, pinName] | 仅 Model 0 (0,0,0) |

### 6.3 通道隔离与函数引脚

- 数据通道与日志通道类型隔离，不可混连。
- pin.in 只连 pin.out；pin.log.in 只连 pin.log.out。
- pin.model.* 不处理 model_id=0；model_id=0 的外部出入口由 pin.bus.* 专属。
- 每个函数标签（func.js / func.python）自动关联三个引脚：
  - `{funcName}:in`
  - `{funcName}:out`
  - `{funcName}:log.out`

### 6.4 权限模型与 PIN 路由（0323）

- 用户程序写权限仅限自身 Cell；跨 Cell 写入必须通过 pin 路由到 (0,0,0) 的 `mt_write:in`。
- 跨模型通信必须通过 pin 链路：子模型挂载路径或 Model 0 中转路径。
- 禁止任何绕过 pin 的直接跨模型读写。
- 详细权限规则见 `docs/ssot/host_ctx_api.md`，运行时语义见 `docs/ssot/runtime_semantics_modeltable_driven.md` §5.3b。

---

## 7. 能力分层（Capability Tiers）

两层能力严格分离，不可混用。

### 7.1 Tier 1：运行时基座（解释器能力）

- 模型形态执行：model.single / model.matrix / model.table 约束校验。
- 标签类型解释：`_applyBuiltins` 按 label.t 分发。
- mailbox 事件入口到合法 pin ingress 的解释与传播。
- MQTT 循环、AsyncFunction 执行器、PIN 路由图管理、可观测性。

### 7.2 Tier 2：模型定义（填表能力）

- 通过 JSON patches 构建业务逻辑、路由拓扑与系统函数。
- func.js / func.python、pin.connect.*、flow.*、Data.* 等都在本层表达。

### 7.3 分层规则

- 能表达为模型定义的能力，必须走 Tier 2。
- Tier 1 只允许新增 label.t 解释或修复解释器 bug。
- 运行时代码禁止承载业务逻辑。

---

## 8. 工作区（Workspace）：隔离与安全边界

- **定义**：在进入控制总线前的隔离网络与安全边界，提供数据分离、通讯加密与节点信任组织能力。
- **不变量**：
  - 工作区之间数据隔离（默认不互通）。
  - 通讯必须加密，且具备可撤销的信任关系。
  - 能支持网状节点/多端接入的安全策略（抽象要求，不绑定实现）。

---

## 9. 多平台交付与集成原则（Windows / Linux / macOS / Android）

- **目标平台**：近期主攻 Windows、Linux、macOS、Android。
- **不变量**：
  - 集成经验必须沉淀为 runbook（按平台拆分）。
  - 所有关键能力必须可脚本化验收（避免仅靠 GUI 手测）。
  - 任何上游变更都必须有“能力探测与降级”策略，避免一处崩溃拖垮整个系统。

---

## 10. 可观测性与验收（必须具备的工程属性）

### 8.1 最小可观测性集合
- 运行时日志（按模块/按组件分类）
- 执行状态（成功/失败/耗时/错误码）
- 关键资源状态（模型表加载、连接状态、工作区状态）
- 审计记录（谁触发、触发了什么、结果如何）

### 8.2 验收要求（脚本化）
- 每个核心能力必须给出：
  - 验收脚本入口（命令）
  - PASS/FAIL 判定条件
  - 失败时的诊断指引
- 禁止把“人工打开页面看一眼”作为唯一验收方式。

---

## 11. 术语使用规则（写文档/写代码时必须遵守）

- **必须使用本文术语**：
  - 小系统（App-as-OS）
  - 可安装小应用（ModelTable + Sliding UI App）
  - 内建能力模块（Built-in Capability App）
  - 软件工人（Software Worker）
  - 软件工人基座（Worker Base）
  - 模型表（ModelTable）/ 单元格（Cell）
  - 管理总线 / 控制总线 / MBR
  - 工作区（Workspace）
- **禁止把具体实现名当成主叙事**：
  - 可以在附注中写“现有实现（不展开）”，但正文必须保持抽象。
- **不确定即标注**：
  - 对于尚未被事实验证的内容，必须标注“待确认”，并写明确认方法。

---

## 12. 与实现导览文档的关系

- 本文档（SSOT）是概念宪法：稳定、不频繁变更。
- 实现导览与源码佐证应放在独立文档（例如 `docs/v1n_concept_and_implement.md`）：
  - 允许随版本迭代更新
  - 允许包含文件路径、入口、模块结构、依赖与风险清单

---

## 13. 建议的后续文档（可选但强烈建议）

为提升可执行性，建议在 docs 下补齐：
- `docs/user-guide/modeltable_user_guide.md`：面向用户的 ModelTable 操作指南（Living Doc）
- `docs/runbooks/`：按平台记录集成经验（desktop/android/linux/macos）
- `docs/design/`：UI 规范、token、导航规则、审视报告
- `docs/plans/`：迭代计划（由 Iteration Workflow 生成）
