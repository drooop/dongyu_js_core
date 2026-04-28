---
title: "定位说明（必须写在文件开头）"
doc_type: ssot
status: active
updated: 2026-04-29
source: ai
---

# 定位说明（必须写在文件开头）

本文件用于冻结当前仓库对 Feishu 文档《软件工人模型2》及其直接引用文档的**对齐决议**。

上位约束：
- `CLAUDE.md`
- `docs/architecture_mantanet_and_workers.md`
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/ssot/label_type_registry.md`

作用对象：
- 本仓库的所有运行时、system model、fill-table patch、验证脚本、后续迭代设计

本文件的性质：
- 它不是 Feishu 原文的镜像
- 它是“当前项目如何采纳 / 不采纳 Feishu 规约”的裁决文档

若本文件与更高层规约冲突：
- 必须以更高层规约为准
- 本文件需要被修订，而不是反向覆盖上位约束

---

# 1. 对齐来源

本决议基于以下外部文档：

- 主文档：`软件工人模型2`
- 直接引用文档：
  - `软件工人支持的Label标签`
  - `标签的基本操作`
  - `简单模型的基本操作`
  - `矩阵模型的基本操作`
  - `模型表的基本操作`

这些 Feishu 文档被视为：
- 架构方向输入
- 历史语义来源
- 未来能力规划参考

它们**不自动成为**本仓库的运行时 SSOT。

---

# 2. 总体决议

## 2.1 总原则

- Feishu 规约是**方向来源**，不是逐字实现模板。
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

## 3.1 模型形态四元组

决议：
- 保持以下四种有效模型形态为唯一正式集合：
  - `model.single`
  - `model.matrix`
  - `model.table`
  - `model.submt`

执行含义：
- 新工作不得发明第五种模型形态。
- 新工作不得回退到旧名 `subModel` / `submt` / 其他未注册别名。

理由：
- Feishu 与当前项目在这条主线上同源。
- 当前仓库的注册表和 runtime 约束已经更严格，适合作为正式裁判面。

## 3.2 `model_type` 二维编码

决议：
- 保持当前二维编码：
  - `label.t` = 形态（`model.single | model.matrix | model.table | model.submt`）
  - `label.v` = 类型（如 `Code.JS`、`Data.Array`、`Flow`、`Doc.Markdown` 等）
- `model.submt` 的 `label.v` 继续表示 child model id，而不是类型名。

理由：
- 这是 Feishu 方向与当前项目之间最稳定的公共交集。

## 3.3 `model.submt` 挂载约束

决议：
- 继续采用当前项目更严格的口径：
  - `model.submt` Cell 仅允许 `model.submt` + `pin.*` + `pin.log.*`
  - 同一 child model 只能被一个父模型 hosting cell 挂载
  - 删除挂载关系不自动删除 child model 数据
  - 除 Model 0 外，所有模型都必须显式挂载进入层级

理由：
- 该规则与 Feishu 方向一致，但当前项目的版本更可审计、更适合验证。

## 3.4 根模型与层级真值

决议：
- 保持 Model 0 作为系统根模型。
- 保持 `model_id + model.submt` 为模型层级唯一真值。
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
- 继续以 `pin.log.*` 为日志数据链路的正式语义。
- 若后续有 SDK 层，可把 `print/error` 映射到 `pin.log.*`。

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
  - 与 `model.submt` / `model.table` 的组合规则

理由：
- 这是当前项目与 Feishu 文档之间最大的“方向一致但实现未定”区域。
- 不先冻结语义，后续一定会造成 runtime 返工。

---

# 5. 明确不采纳的内容

## 5.1 不采纳“每个 Cell 自带模型表 id”作为正式真值

理由：
- 当前项目已经以 `model_id` + `model.submt` 表达所有权和层级。
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

- Feishu 文档定义了**方向**。
- 当前仓库定义了**裁决面**。
- 今后实现时，必须以当前仓库 SSOT 的运行时边界为准，
  在此基础上吸收 Feishu 文档中对 `Data` / `Flow` / `matrix` 的目标能力设计。

---

# 8. Feishu 协作文档组（维护入口）

以下 4 篇 Feishu 文档是当前维护中的协作文档组：

| 文档 | 地址 | 用途 |
|---|---|---|
| 主文档：`软件工人模型2（整理改写版 v0）` | `https://bob3y2gxxp.feishu.cn/wiki/Wurow8wi2iFyJqkDu81cyySQnlf` | 总览、核心规则、阅读入口 |
| 规则文档：`软件工人模型2-标签与连接规则 v0` | `https://bob3y2gxxp.feishu.cn/wiki/QnzqwrqRgiUOjUkzTA3chrVfnBd` | 标签、引脚、连接、配置等正式规则 |
| 例子文档：`软件工人模型2-完整模型表示例 v0` | `https://bob3y2gxxp.feishu.cn/wiki/LlBKwio3MiaIEBkLnaOcfzx4nuh` | 完整模型表总览与填写顺序 |
| 规划文档：`软件工人模型2-Tier2实现与模型ID规划 v0` | `https://bob3y2gxxp.feishu.cn/wiki/RazQwQpPjiZXtZkBIoocZq9Unuc` | Tier2 边界、model_id 放置、后续实现方向 |

维护规则：

- 这 4 篇 Feishu 文档属于协作层文档，不自动高于当前仓库 SSOT。
- 若 Feishu 文档与 `CLAUDE.md`、架构 SSOT、运行时语义、标签注册表冲突，以当前仓库高优先级规约为准。
- 若 Feishu 文档中的改动影响了正式规则，必须回写到当前仓库规约链路。
- 主文档负责导航；规则、例子、规划三篇文档负责拆分维护，不再继续把所有内容堆回主文档。

建议查阅顺序：

1. 主文档
2. 规则文档
3. 例子文档
4. 规划文档
