---
title: "Iteration 0190-data-array-tier2-template Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0190-data-array-tier2-template
id: 0190-data-array-tier2-template
phase: phase1
---

# Iteration 0190-data-array-tier2-template Plan

## Goal

- 按当前项目已冻结规约，落地第一个正式 Tier2 数据模型模板：`Data.Array`。
- 明确 `Data.Array` 的模型结构、统一 pin 接口、实现边界、验证口径与回滚方式。

## Background

- `docs/ssot/feishu_alignment_decisions_v0.md` 已冻结 Feishu 对齐裁决，并明确 `Data.*` 应作为 Tier2 模板能力落地，而不是写入 Tier1 运行时解释器。
- 当前规约中已定义统一数据模型 PIN 接口约定：
  - `add_data_in`
  - `delete_data_in`
  - `get_data_in`
  - `get_data_out`
  - `get_all_data_in`
  - `get_all_data_out`
  - `get_size_in`
  - `get_size_out`
- 当前代码中存在 `packages/worker-base/src/data_models.js` 的现存 legacy live dependency；目前只在 `traceModel -> CircularBuffer` 路径中被实际调用。该文件不构成 `Data.Array` 的正式实现路线，只能作为历史行为参考。
- 依据 `docs/ssot/feishu_alignment_decisions_v0.md` 中已冻结的推进顺序，`Data.Array` 应先于 `Flow/Data.FlowTicket` 和 `matrix semantics` 进入正式落地。

## Scope

- In scope:
  - 定义一个 canonical `Data.Array` Tier2 模板结构
  - 明确模板应放在正数用户模型空间中的基本做法
  - 设计最小函数标签与 pin 行为分工
  - 设计 deterministic 合同测试
  - 明确对旧 `data_models.js` 的处理策略
- Out of scope:
  - 不实现 `Flow` / `Data.FlowTicket`
  - 不实现 `model.matrix` 的 size/collision/nesting
  - 不新增 Tier1 label.t
  - 不在本轮扩展 `Data.Queue` / `Data.Stack` / `Data.LinkedList` / `Data.CircularBuffer`

## Invariants / Constraints

- 继续遵守 `CLAUDE.md`：
  - Data model 行为属于 Tier2
  - Tier1 只做解释器语义和约束检查
  - 用户业务模型默认进入正数 `model_id` 空间
- `Data.Array` 的正式对外交互只能通过统一 pin 接口完成，不增加私有旁路。
- 模板能力优先放在正数用户模型；如未来需要系统内建模板，也必须通过单独 iteration 再决定是否下沉到负数系统模型。
- 不直接复活旧 `data_models.js` 作为正式实现；若参考其中行为，只能在文档和测试层说明。
- 需要显式检查 conformance：
  - tier 1 vs tier 2 boundary
  - negative vs positive model placement
  - data ownership
  - data flow
  - allowed routing path

## Success Criteria

- 0190 的 Phase1 文档足够明确，使其在获得正式 `Approved` gate 后可直接进入执行。
- 文档明确回答以下问题：
  - `Data.Array` 的模型根、元信息和数据 Cell 如何组织
  - 统一 pin 接口如何映射到函数实现
  - 旧 `data_models.js` 是弃用、迁移还是保留为历史参考
  - 需要新增哪些 tests / fixtures / docs
- resolution 中给出可复制的验证命令和回滚方案。

## Risks & Mitigations

- Risk:
  - 误把 `Data.Array` 做成 Tier1 运行时行为。
  - Impact:
    - 破坏当前规约边界，后续 `Data.Queue/Stack` 也会被迫下沉解释器。
  - Mitigation:
    - 明确规定 `Data.Array` 只作为 Tier2 模板 + function labels 落地。
- Risk:
  - 直接沿用历史 `data_models.js`，导致新路线和旧路线混用。
  - Impact:
    - 形成双实现，行为难以裁决。
  - Mitigation:
    - 将旧实现只作为行为参考；正式实现以新模板和新合同测试为准。
- Risk:
  - 模板放置在负数模型导致用户数据所有权模糊。
  - Impact:
    - 与当前 ownership 规则冲突。
  - Mitigation:
    - 默认 `Data.Array` 实例和示例均落在正数模型空间。

## Alternatives

### A. 推荐：正数模型中的自包含模板

- 形式：
  - `model.table + Data.Array`
  - 根单元格声明统一 pin
  - 行为通过本模型内 `func.js` / `func.python` 实现
- 优点：
  - 所有权清晰
  - 不引入系统隐藏依赖
  - 与当前规约最一致
- 缺点：
  - 模板复用时会有一些重复
- 成本：
  - 低到中
  - 主要成本在模板结构定义、合同测试和示例补齐
- 适用时机：
  - 当 `Data.Array` 是首个正式数据模型模板
  - 当优先级是先把 ownership、placement 和测试边界做清楚
  - 当暂时没有证据证明多个数据模型必须共享同一个系统 helper

### B. 共享系统 helper + 正数数据模型

- 形式：
  - 业务数组模型仍在正数模型
  - 共享 helper 函数放在负数系统模型
- 优点：
  - 逻辑复用更集中
- 缺点：
  - 增加跨模型依赖
  - 更容易把用户模型行为做成隐式系统能力
- 成本：
  - 中到高
  - 除模板和测试外，还需要定义系统 helper 的放置、依赖和审计方式
- 适用时机：
  - 只有在 `Data.Array` 之后，至少再出现 2 个以上数据模型模板需要共享同一套核心算法
  - 或者已有明确证据表明模板复制会造成不可接受的维护成本

当前推荐：先做 A，再视复用成本决定是否进入 B。

## Inputs

- Created at: 2026-03-17
- Iteration ID: 0190-data-array-tier2-template
- User approval:
  - 用户已明确同意以 `Data.Array` 作为按改进版规约推进项目的第一步
