---
title: "0244 — pin-only-core-with-scoped-privilege-contract-freeze Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0244-pin-only-core-with-scoped-privilege-contract-freeze
id: 0244-pin-only-core-with-scoped-privilege-contract-freeze
phase: phase1
---

# 0244 — pin-only-core-with-scoped-privilege-contract-freeze Plan

## Metadata

- ID: `0244-pin-only-core-with-scoped-privilege-contract-freeze`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch: `dropx/dev_0244-pin-only-core-with-scoped-privilege-contract-freeze`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `docs/plans/2026-03-26-pin-only-core-with-scoped-privilege-design.md`

## WHAT

0244 不实现 runtime，只冻结正式 contract。要冻结的不是某个 helper API 名称，而是这套权限/链路模型的正式边界：

- `PIN-only` 仍是默认核心范式
- same-model privileged direct access 只是受控例外
- `root (0,0,0)` 自动拥有 privileged capability label
- 非 root cell 必须显式声明后才拥有 privileged capability
- `Model.table` privileged scope
- `Model.matrix` privileged scope
- 跨 `model_id` / 跨 `model.submt` 的硬边界

本 iteration 的交付目标是把上述内容写成**接近 SSOT 的 contract 文本**，让后续实现不再需要回头重谈“到底默认走 pin，还是默认走 direct access”。

## WHY

当前设计讨论稿已经明确了推荐方向，但还没有进入正式规范口径。  
0244 的目标是把“讨论稿里的正确方向”冻结成：

- 可审查
- 可测试
- 可作为后续 runtime implementation 入口

而不是继续在聊天里口头维护。

当前最需要冻结的不是“某个实现技巧”，而是以下根问题：

1. `pin` 到底是不是默认核心范式
2. same-model direct access 是不是允许存在
3. 如果允许，它是默认能力还是 privileged capability
4. `table`、`matrix`、`submt` 三者的边界到底怎么分

若这四点不先冻结，后续 runtime、handler、UI、docs 都会各自形成一套理解。

## Terms To Freeze

本 iteration 结束时，至少要把以下术语固定：

- `PIN-only core`
- `same-model scoped privilege`
- `privileged capability`
- `root auto privilege`
- `non-root explicit privilege`
- `cross-model boundary`
- `cross-submt boundary`
- `same-model internal management`

这些术语必须在文档内有单一含义，不能混用“权限穿透”“直达”“管理能力”等口头表达而没有映射。

## Contract Draft

### 1. Default Rule

- 默认规则：`PIN-only`
- 任何 cell 若未持有 privileged capability：
  - 只能操作自身
  - 想操作其他 cell，必须走 `pin.* / pin.connect.*`

### 2. Privileged Capability Source

- `root (0,0,0)` 自动拥有 privileged capability label
- 非 root cell 必须显式声明后才拥有
- 普通 `model.single` cell 不自动拥有

### 3. Same-Model Scoped Privilege

如果 privileged cell 属于同一个 `model_id` 的管理层，则允许 direct operate owned cells：

- `Model.table` privileged cell
  - 可 direct read/write 本 `model_id` 下普通 cell
  - 可 direct read/write 本 `model_id` 下 nested `model.matrix` 的 cell
- `Model.matrix` privileged cell
  - 可 direct read/write 该矩阵作用域内的 cell
  - 不自动获得同模型其他兄弟区域的权限

### 4. Hard Boundaries

以下边界一旦跨越，立即回到 `PIN-only`：

- 跨 `model_id`
- 跨 `model.submt`
- parent -> child
- child -> parent
- system/user boundary
- external ingress / egress

### 5. Consequence

- `pin` 继续是 canonical default path
- same-model direct access 只是 wiring reduction 的受控例外
- `submodel` / child boundary 不被打穿

## Sanity-Check Cases

本 contract 至少需要能解释这些例子：

1. Home CRUD
- `Home UI -> Home local state`
  - same-model internal management，可 privileged direct
- `Home UI -> positive business model label`
  - cross-model，必须 `PIN-only`

2. Table manages own matrix cells
- `table root -> same model nested matrix cell`
  - allowed by same-model scoped privilege

3. Table touches child model
- `table root -> child model via submt`
  - forbidden as direct access
  - must be `PIN-only`

## Success Criteria

- 明确 contract 文档存在并自洽
- 至少回答以下问题：
  - privileged capability 的语义与来源
  - `table` / `matrix` 的 same-model scope 边界
  - root 自动权限与非 root 显式权限的关系
  - `submt` boundary 为什么仍必须 pin-only
- 至少给出一组 sanity-check cases，证明规则不是自相矛盾
- 明确下游 implementation iteration 应改哪些文件、测哪些 regression

## Out Of Scope

- 不在本 iteration 内定义最终 label 名
- 不在本 iteration 内修改 runtime
- 不在本 iteration 内改 `label_type_registry.md` / `runtime_semantics_modeltable_driven.md`
- 不在本 iteration 内决定具体 JS API 叫 `ctx.writeCellScoped` 还是其他名字

## Deliverables

本 iteration 至少要产出：

1. 一版可审查的 contract text
2. 一版后续 implementation checklist
3. 一版 docs assessment，说明未来要改哪些 SSOT
