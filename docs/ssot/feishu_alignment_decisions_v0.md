---
title: "Feishu Alignment Decisions v0"
doc_type: ssot
status: active
updated: 2026-07-10
source: ai
---

# Feishu Alignment Decisions v0

## Positioning

本文件用于冻结当前仓库对 Feishu 文档《软件工人模型2》及其直接引用文档的**对齐决议**。

- Authority: below `CLAUDE.md`, `docs/architecture_mantanet_and_workers.md`, `docs/ssot/runtime_semantics_modeltable_driven.md`, and `docs/ssot/label_type_registry.md`.
- Scope: runtime, system models, fill-table patches, validation scripts, and future iteration designs that claim Feishu alignment.
- Rule type: adoption decisions. It decides what this repository adopts, rejects, or defers from Feishu source material.
- Conflict behavior: Feishu source material never overrides repository SSOT automatically. If Feishu changes should become project rules, first update the repository spec chain through an iteration.

本文件的性质：
- 它不是 Feishu 原文的镜像
- 它是“当前项目如何采纳 / 不采纳 Feishu 规约”的裁决文档

若本文件与更高层规约冲突：
- 必须以更高层规约为准
- 本文件需要被修订，而不是反向覆盖上位约束

## Approved authority model (0455)

- `UpstreamConsensus`：公司共识来源；当前锁定为 `feishu-model2` 与 `feishu-message-api`。
- `DerivedView`：从上游共识派生的阅读视图；当前锁定为 `main`、`rules`、`examples`、`planning`，无独立裁决权。
- `SupportingSource`：背景或解释材料，无独立裁决权；`supporting-source-1` 与 `supporting-source-2` 在身份核验前保持 `identity_pending`，不参与自动追踪或冲突裁决。
- repo SSOT：经 iteration 审核后的当前可执行合同。Feishu 上游变化不能自动覆盖它。
- Human entry 与 LLM entry 共享同一套 repo SSOT；差别只在导航和执行职责。

0431 correction:
- `model.submt` and `model.subtable` are child-side declarations.
- `model.submtconnection` and `model.subtableconnection` are parent/main-side
  relationship indexes.
- Older wording in this file that treated `model.submt` as the parent-side
  relationship Cell is superseded.

---

# 1. 对齐来源与角色

## 1.1 UpstreamConsensus

| ID | 文档 | 地址 | 权威范围 |
|---|---|---|---|
| `feishu-model2` | `软件工人模型2` | `https://bob3y2gxxp.feishu.cn/wiki/JYNWwQOOjiWcOLktv07cBvIVnOh` | 模型、Label、Connection、Tier 等公司共识 |
| `feishu-message-api` | `软件工人消息API文档` | `https://bob3y2gxxp.feishu.cn/wiki/WBZjwY3DSil6pAkQ8DZcpsrWnUf` | 公开消息结构、路由字段、回包语义等公司共识 |

两篇上游文档共同表达公司共识。文内矛盾、跨文档冲突或与 repo SSOT 不一致时，统一进入 `requires_user_confirmation`，不得使用“更新者优先”自动裁决。

## 1.2 SupportingSource

`supporting-source-1` 与 `supporting-source-2` 是已批准的两个支持来源槽位，但当前身份仍为 `identity_pending`：

- 不写入猜测标题、URL 或 token；
- 不参与自动同步；
- 不解决上游冲突；
- 其中的新主张只能形成 Change Proposal。

四篇 `DerivedView` 及其维护边界见 §8。

---

# 2. 总体决议

## 2.1 总原则

- Feishu `UpstreamConsensus` 是公司共识来源，但不是可直接执行的逐字实现模板。
- `DerivedView` 与 `SupportingSource` 不得新增或裁决产品语义。
- 当前仓库已经冻结的 runtime 边界、结构性声明模型、负数模型边界、ctx API 边界，不因 Feishu 原文而回退。
- 采纳策略为：
  - 概念层尽量对齐 Feishu
  - 语义层以当前项目 SSOT 为准
  - 未实现能力优先做 Tier 2 模板/worker，不先写死进 Tier 1

## 2.2 采纳策略

| 类型 | 处理规则 |
|---|---|
| Feishu 与当前项目一致 | 直接采纳，沿用当前更严格表达 |
| Feishu 是方向、当前项目未实现 | 记录为后续 iteration 的实施方向 |
| Feishu 与当前 runtime 边界冲突 | 不直接采纳；只保留概念，不保留原实现方式 |
| Feishu 表达模糊或重复真值 | 当前项目必须先冻结唯一真值后再实现 |

---

# 3. 已冻结决议

## 3.1 模型形态与关系索引

决议：
- 保持以下基础模型形态为正式集合：
  - `model.single`
  - `model.matrix`
  - `model.table`
  - `model.submt`
- 0431 后补充两类关系/表边界标签：
  - child ModelTable 声明：`model.subtable`
  - 父侧/主侧索引：`model.submtconnection` / `model.subtableconnection`

执行含义：
- 新工作不得把 relationship/index label 当成新的 pin wiring 写法。
- 新工作不得回退到旧名 `subModel` / `submt` / 其他未注册别名。

理由：
- Feishu 与当前项目在“声明”和“关系索引”两条线上同源。
- 当前仓库的注册表和 runtime 约束已经更严格，适合作为正式裁判面。

## 3.2 `model_type` 二维编码

决议：
- 保持当前二维编码，但区分声明与索引：
  - `label.t` = 形态或关系索引（`model.single | model.matrix | model.table | model.submt | model.subtable | model.submtconnection | model.subtableconnection`）
  - `label.v` = 类型（如 `Code.JS`、`Data.Array.One`、`Flow`、`Doc.Markdown` 等）
- `model.submt` 写在 child model root，`label.v` 表示 child model 自身类型名或形态说明。
- `model.submtconnection` 写在父侧/主侧 connection Cell，`label.v` 表示 child model id 或 `{ "model_id": int }`。
- `model.subtable` 写在 child ModelTable root。
- `model.subtableconnection` 写在父侧/主侧 connection Cell，`label.v` 表示 child table id 与 root model id。

理由：
- 这是 Feishu 方向与当前项目之间最稳定的公共交集。

## 3.3 子模型与子模型表关系约束

决议：
- 继续采用当前项目更严格的口径：
  - 父侧 `model.submtconnection` Cell 仅允许 relationship label + `pin.in` / `pin.out` / `pin.login` / `pin.logout`
  - 同一 child model 只能被一个父模型 connection Cell 索引为直接 child
  - 删除父侧索引关系不自动删除 child model 数据
  - 除 Model 0 外，所有模型都必须由父侧 `model.submtconnection` 显式索引进入层级，并在子侧 root 声明 `model.submt`
  - child ModelTable 由子侧 root `model.subtable` 声明，父侧/主侧 `model.subtableconnection` 负责索引

理由：
- 该规则与 Feishu 方向一致，但当前项目的版本更可审计、更适合验证。

## 3.4 根模型与层级真值

决议：
- 保持 Model 0 作为系统根模型。
- 保持 `model_id + model.submtconnection + child root model.submt` 为模型层级唯一真值。
- 保持 `table_id + model.subtableconnection + child table root model.subtable` 为 child ModelTable 层级唯一真值。
- 不引入“每个 Cell 额外带模型表 id”作为第二套真值。

理由：
- Feishu 中“每个 cell 自带模型表 id”的表达更偏概念层。
- 当前项目如果再引入 cell-level table id，会制造重复真值与同步问题。

## 3.5 OO API 不直接进入 runtime 宪法

决议：
- Feishu 文档中的 `Label.__init__`、`Model.add_label`、`Model.get_label`、`print/error` 等类方法，
  **不直接作为 runtime 规范输入面**。
- 当前 runtime 正式输入面仍然是：
  - ModelTable 结构性声明
  - `add_label` / `rm_label`
  - `ctx` API
  - `pin.*` / `pin.connect.*` / `func.*`

允许的后续动作：
- 如果后续确实需要 SDK，可以新增一层 wrapper，把 OO API 映射到当前 runtime contract。

理由：
- Feishu 文档描述的是对象接口风格。
- 当前项目描述的是结构性语义和宿主边界。
- 直接混用会形成两套正式接口。

## 3.6 日志语义

决议：
- 不把 `print(info)` / `error(error)` 升格为 runtime 语义层能力。
- 0356 后以 `pin.login` / `pin.logout` 为日志数据链路的正式语义。
- 若后续有 SDK 层，可把 `print/error` 映射到 `pin.login` / `pin.logout`。

理由：
- 当前项目已经有通用日志 PIN 通道，不需要再在 runtime 增加第二条日志语义。

## 3.7 MQTT 配置标签

决议：
- 保持 `mqtt.local.*` 在 Model 0 `(0,0,0)` 生效的当前规则。
- `mqtt.global.*` 暂不提升为正式已实现语义。

允许的后续动作：
- 如果出现真实跨环境 broker 需求，单开 iteration 冻结：
  - 位置约束
  - 优先级
  - 与 `mqtt.local.*` 的关系

理由：
- Feishu 列出 `mqtt.global.*` 但当前项目并未冻结其语义。
- 直接实现会引入环境优先级和安全边界问题。

---

# 4. 未实现能力的正式方向

## 4.1 数据模型（Data.*）

决议：
- `Data.*` 的当前目标合同由 `docs/ssot/feishu_data_model_contract_v1.md` 接管。
- `Data.Single` / `Data.Array.One` / `Data.Array.Two` / `Data.Array.Three` / `Data.Queue` / `Data.Stack` / `Data.LinkedList` / `Data.CircularBuffer` / `Data.FlowTicket` 等
  继续被视为正式类型名或正式目标类型名。
- 这些类型的行为**不直接写入 Tier 1 运行时解释器**。
- 当前项目正式方向是：
  - 通过 Tier 2 模板模型 / 系统 worker / `func.js` / `func.python` 实现
  - 复用统一 PIN 接口契约

实施约束：
- 新工作优先围绕 Feishu 统一接口落地：
  - `add_data:in`
  - `delete_data:in`
  - `update_data:in`
  - `get_data:in`
  - `get_data:out`
  - `get_all_data:in`
  - `get_all_data:out`
  - `get_size:in`
  - `get_size:out`
- `add_data_in` / `get_data_out` 等 underscore 命名，以及 Queue/Stack 的 operation-specific pins，属于 0296-era 实现债务，不是目标合同。
- `Data.Array` 作为不分维度的目标类型被 `Data.Array.One/Two/Three` supersede；若现有实现仍使用 `Data.Array`，应在后续迁移 iteration 中处理。

理由：
- 这既保留了 Feishu “数据模型是一等类型”的方向，
  又不破坏当前项目“runtime 只解释、不发明具体业务容器语义”的边界。

## 4.2 流程模型（Flow）

决议：
- `Flow` 继续保留为正式类型名。
- `flow.*` 继续保留为 Tier 2 标签约定，而不是 Tier 1 运行时内建能力。

正式方向：
- 通过流程管理器模板 / 系统 worker 实现流程推进。
- 统一使用 ticket/state/error 的数据模型承载流程状态。
- 若区分 JS host executor / Python worker executor，二者必须共用同一份流程状态契约。

理由：
- Feishu 的方向是“流程属于模型”。
- 当前项目的边界是“流程执行器不直接下沉到 runtime 核心”。

## 4.3 矩阵模型（model.matrix）

决议：
- `model.matrix` 作为形态名已冻结。
- 但以下语义仍未进入正式已实现集合：
  - `model.matrix.size`
  - `set_size(...)`
  - 碰撞检测
  - 父子矩阵包含关系
  - 矩阵与模型表混合嵌套边界

实施前置：
- 任何 matrix 代码实现前，必须单开 iteration 冻结：
  - 绝对坐标 vs 相对坐标
  - 矩阵 root 与占用范围
  - 碰撞与边界规则
  - 与 `model.submtconnection` / `model.submt` / `model.subtableconnection` / `model.subtable` / `model.table` 的组合规则

理由：
- 这是当前项目与 Feishu 文档之间最大的“方向一致但实现未定”区域。
- 不先冻结语义，后续一定会造成 runtime 返工。

---

# 5. 明确不采纳的内容

## 5.1 不采纳“每个 Cell 自带模型表 id”作为正式真值

理由：
- 当前项目以 `model_id` + 父侧 `model.submtconnection` + 子侧 `model.submt` 表达模型所有权和层级；以 `table_id` + 父侧 `model.subtableconnection` + 子侧 `model.subtable` 表达 App table / child ModelTable 层级。
- 额外引入 cell-level table id 会制造同步和裁决冲突。

## 5.2 不采纳“Feishu OO API 直接等于 runtime API”

理由：
- 当前项目的正式语义面是结构性声明与宿主能力边界。
- OO API 只能作为未来 SDK 设计输入。

## 5.3 不采纳为了对齐 Feishu 而恢复 legacy alias

理由：
- 当前项目已经明确：
  - 不新增旧名兼容债
  - 不保留历史 alias，除非用户明确批准

---

# 6. 后续迭代建议顺序

## 建议顺序

1. `Data model` iteration
   - 先做 `Data.Single` 与 `Data.Array.One/Two/Three` 模板能力
   - 再按 Feishu target contract 迁移 `Data.Queue` / `Data.Stack` / `Data.CircularBuffer` / `Data.LinkedList`
   - 建 deterministic tests

2. `Flow model` iteration
   - 先基于 `Data.FlowTicket` 冻结 state / error contract
   - 再做 executor

3. `Matrix semantics` iteration
   - 先定 size / collision / nesting 语义
   - 再考虑 runtime 落地

---

# 7. 一句话裁决

- Feishu `UpstreamConsensus` 定义公司共识。
- 当前仓库 SSOT 定义当前可执行合同。
- `DerivedView`、`SupportingSource`、backlog、generated summary 与 iteration evidence 都不能成为第二套合同。
- 两个权威面不一致时，保留差异并走用户确认与 iteration Gate，不自动覆盖任一侧。

---

# 8. Feishu 协作文档组（维护入口）

以下 4 篇 Feishu 文档是当前维护中的 `DerivedView` 协作文档组，均从 `feishu-model2` 与 `feishu-message-api` 上游组合派生：

| ID | 文档 | 地址 | 用途 |
|---|---|---|---|
| `main` | `软件工人模型2（整理改写版 v0）` | `https://bob3y2gxxp.feishu.cn/wiki/Wurow8wi2iFyJqkDu81cyySQnlf` | 面向人类的总览与导航，不新增规则 |
| `rules` | `软件工人模型2-标签与连接规则 v0` | `https://bob3y2gxxp.feishu.cn/wiki/QnzqwrqRgiUOjUkzTA3chrVfnBd` | 规则查询视图，不独立裁决冲突 |
| `examples` | `软件工人模型2-完整模型表示例 v0` | `https://bob3y2gxxp.feishu.cn/wiki/LlBKwio3MiaIEBkLnaOcfzx4nuh` | 非规范性例子，不通过例子创造规则 |
| `planning` | `软件工人模型2-Tier2实现与模型ID规划 v0` | `https://bob3y2gxxp.feishu.cn/wiki/RazQwQpPjiZXtZkBIoocZq9Unuc` | 规划视图，不把未来计划写成现行合同 |

维护规则：

- 这 4 篇 Feishu 文档属于 `DerivedView`，无独立裁决权，也不自动高于当前仓库 SSOT。
- 若 Feishu 文档与 `CLAUDE.md`、架构 SSOT、运行时语义、标签注册表冲突，以当前仓库高优先级规约为准。
- 若 Feishu 文档中的改动影响了正式规则，必须回写到当前仓库规约链路。
- 这 4 篇 Feishu 文档的持续追踪入口为
  `docs/ssot/feishu_source_watch_manifest.json`；该 manifest 只记录来源、token hint、影响面和确认规则，不保存密钥或原文快照。
- Feishu 文档是每周会议共识的整理输入。若追踪报告发现疑似冲突、需要拒绝、或需要延后，不得由工具或 agent 自动定案；必须列明变更标题、具体原因和影响面，等待用户与同事确认后再继续 SSOT 改动。
- 主文档负责导航；规则、例子、规划三篇文档负责拆分维护，不再继续把所有内容堆回主文档。

建议查阅顺序：

1. 主文档
2. 规则文档
3. 例子文档
4. 规划文档
