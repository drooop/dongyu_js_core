---
title: "新版规约条文草案 v0.1：模型分层与 Cell 模型标签"
doc_type: ssot
status: active
updated: 2026-03-21
source: ai
---

# 新版规约条文草案 v0.1：模型分层与 Cell 模型标签

> 位置说明：本文件是 review draft，用于集中审核新版模型分层与 Cell 模型标签语义。
> 生效顺序仍遵循 `CLAUDE.md` > `docs/ssot/**` > 其他 docs。
> 本文不覆盖上位硬约束，只做统一重述与待确认文本收口。

## 0. 目标

本草案用于统一以下语义：

- `model_id` 的三层空间与负数模型内部层级
- Model 0 / 负数模型 / 正数模型的关系
- 每个 Cell 的唯一有效模型标签（effective model label）
- `model.single / model.matrix / model.table / model.submt` 的规范化含义
- 子模型挂载、删除语义、引脚共存规则
- “禁止默认兼容”的规范口径

## 1. 模型 id 分层

### 1.1 基本分层

- `model_id > 0`
  - 用户创建模型空间。

- `model_id = 0`
  - 软件工人的根模型 / 中间层模型 / 系统边界层。

- `model_id < 0`
  - 软件工人系统级能力层。

### 1.2 负数模型内部层级

- `-1 .. -100`
  - 靠近基座/系统边界/系统支撑层。
  - 包括但不限于：mailbox、state、auth、routing、worker-base support。

- `-101 .. -199`
  - 内置系统级应用层（built-in system applications / workbenches）。

- `<= -200`
  - 为后续更深层的内置系统级应用保留。
  - 新增使用必须经 iteration 明确登记。

### 1.3 负数模型排序原则

- 绝对值越小，越靠近基座/系统边界。
- 绝对值越大，越靠近内置系统级应用层。

## 2. 根模型与显式挂载

### 2.1 Model 0

- Model 0 是模型层级的根。
- Model 0 `(0,0,0)` 必须显式带 `model.table`。
- 系统边界端口位于 Model 0 `(0,0,0)`。
- Model 0 不承载用户业务逻辑。

### 2.2 显式挂载原则

- 除 Model 0 外，每个模型都必须通过某个父模型 Cell 上的 `model.submt` 显式挂载进入层级。
- 这条规则也适用于 bootstrap children，例如 `-1` 与 `1`。

### 2.3 传递归属

- 若模型 A 挂载模型 B，模型 B 挂载模型 C，则 C 同时属于 B 与 A。
- 祖先归属是传递的。

## 3. Cell 的唯一有效模型标签

### 3.1 基本规则

- 每个 materialized Cell 必须且只能有一个有效模型标签（effective model label）。
- 有效模型标签集合为：
  - `model.single`
  - `model.matrix`
  - `model.table`
  - `model.submt`

### 3.2 稀疏存储下的默认语义

- 运行时允许稀疏存储与按需创建 Cell。
- 因此，不要求每个尚未物化的普通 Cell 都实际持久化一条 `model.single`。
- 在 `model.table` 或 `model.matrix` 的有效作用域内：
  - 若某个普通 Cell 尚未物化或未显式声明模型标签
  - 则其有效模型标签默认视为 `model.single`

### 3.3 清空与回退

- 若某个普通 Cell 的显式 labels 被全部删除
- 则该 Cell 可以在存储层直接消失/清空
- 其语义层仍等价于“回退为隐式默认 `model.single`”

## 4. 四类模型标签

### 4.1 `model.single`

- 表示普通 Cell / 简单模型 Cell。
- 在 table/matrix 作用域中，普通 Cell 的默认有效语义就是 `model.single`。

### 4.2 `model.table`

- 表示 table 模型根声明。
- 必须出现在该模型自己的 `(0,0,0)`。
- 是创建该 table 模型时的必填项。

### 4.3 `model.matrix`

- 表示 matrix 模型根声明。
- 必须出现在该 matrix 自身相对坐标的 `(0,0,0)`。
- 是创建该 matrix 模型时的必填项。
- matrix 的绝对原点可以不同于全局 `(0,0,0)`。
- 但必须有可裁决的 relative -> absolute 映射表达。

### 4.4 `model.submt`

- 表示 child model 的挂载/映射 Cell。
- `model.submt` 的 `value` 是 child model id。
- 一旦某个 Cell 声明 `model.submt`：
  - 该 Cell 的唯一有效模型标签就是 `model.submt`
  - 不再同时视为 `model.table` / `model.matrix` / `model.single`

## 5. `model.submt` 的约束

### 5.1 single-parent

- 一个 child model 在任一时刻只能被一个父模型 hosting Cell 挂载。
- `model.submt` 采用 single-parent 语义。

### 5.2 引脚共存规则

- `model.submt` Cell 只允许以下标签共存：
  - `pin.*`
  - `pin.log.*`
- 本规约中“引脚标签”默认同时包含 `pin.*` 与 `pin.log.*`。

### 5.3 子模型引脚转发

- `model.submt` Cell 会把自身同名引脚，与 child model `(0,0,0)` 的同名引脚做双向传递。

### 5.4 删除语义

- 删除 `model.submt`：
  - 只删除父子挂载关系
  - 不自动删除 child model 数据

- 只有删除 child model 自己的 `(0,0,0)` 根声明时：
  - 才删除整个 child model

## 6. `model.name`

- `model.name` 是选填。
- `model.name` 只允许写在模型自己的 `(0,0,0)`。
- 对于 `model.submt` 对应的 child model：
  - 名称写在 child model 自己的 `(0,0,0)` 中
  - 不写在 hosting Cell 上

## 7. 禁止默认兼容

### 7.1 基本原则

- 历史 label/type/术语不构成当前允许的新工作输入面。
- 不应为了旧术语继续保留或扩展兼容代码。

### 7.2 审批要求

- 若确需保留兼容逻辑、兼容别名、兼容解析路径：
  - 必须得到用户显式批准
  - 否则默认禁止

### 7.3 当前应视为迁移债务的旧口径

- `PIN_IN / PIN_OUT`
- `BUS_IN / BUS_OUT`
- `CELL_CONNECT`
- `MODEL_IN / MODEL_OUT`
- `subModel`
- 其他旧式 alias / legacy path

这些旧名如果仍出现在 repo 中，应视为历史残留或迁移债务，而不是新工作的允许输入面。

## 8. 与当前实现的关系

本草案描述的是当前准备冻结的新语义口径。

当前 repo 仍存在若干尚未完全对齐之处，例如：

- runtime 中仍存在旧 `submt` 口径
- persistence / bootstrap 里仍有旧 `model_type` 落表方式
- 某些 user guide / tests / code path 仍残留历史 alias

这些差异不改变本草案的目标语义，只表示后续需要单独做“代码与测试对齐计划”。

## 9. 本轮审核重点

请重点确认以下几点是否已经准确表达你的意图：

1. 负数模型区间分层是否合理
2. `model.table` / `model.matrix` 根声明 + 普通 Cell 默认 `model.single` 的组合是否准确
3. `model.submt` 是否完整表达了 single-parent、pin-only、删挂载不删 child 数据
4. “所有非 0 模型都必须显式挂载进入层级”是否符合你的要求
5. “禁止默认兼容，兼容必须显式批准”是否足够强
