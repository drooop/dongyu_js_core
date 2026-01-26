# Iteration 0123-modeltable-runtime-v0 Plan

## 0. Metadata
- ID: 0123-modeltable-runtime-v0
- Date: 2026-01-23
- Owner: TBD
- Branch: dev_0123-modeltable-runtime-v0
- Related: docs/roadmap/dongyu_app_next_runtime.md

## 1. Goal
建立 JS Worker Base 的 ModelTable Runtime v0（固定 p/r/c/k/t/v、确定性更新、变更检测），为后续 built-in k 行为对齐提供最小内核。

## 2. Background
Stage 2.1 开始进入 JS Worker Base 最小执行循环。此前已完成 PICtest 行为证据与 Test Harness Plan，当前迭代仅定义实现计划（不实现代码）。

## 3. Invariants (Must Not Change)
- ModelTable（p/r/c/k/t/v）是唯一事实与显示数据源。
- UI 事件只能表现为“写单元格”，不得直接产生副作用。
- 第一阶段仅控制总线（MQTT + PIN_IN/OUT），不引入 Matrix/双总线。
- 行为真值规则：在不违反 SSOT/Charter 的前提下，运行时行为以 PICtest 可观测行为为准；若有冲突，必须记录而不擅自裁决。
- **实现前强制约束**：必须遵守 `docs/iterations/0122-oracle-harness-plan/harness_plan.md` 中的 Concrete Key Inventory 与 Coverage Matrix；不得以抽象模块替代具体 key 覆盖边界。
- 本迭代不得实现任何运行时代码或 UI AST/Renderer。

## 4. Scope
### 4.1 In Scope
- 定义 ModelTable Runtime v0 的最小功能与接口（数据结构/加载/变更/追踪）。
- 明确与 Concrete Key Inventory / Coverage Matrix 的对齐方式（约束清单）。
- 定义最小可执行验证路径（仅文档与脚本入口建议，不实现代码）。

### 4.2 Out of Scope
- 任何运行时代码实现或测试代码编写。
- built-in k 行为实现（属于 Stage 2.2）。
- UI AST/Renderer、Matrix、Element Call、E2EE、打包。

## 5. Non-goals
- 不推断或补全 PICtest 行为。
- 不改变 Concrete Key Inventory 与 Coverage Matrix 结论。

## 6. Success Criteria (Definition of Done)
- 明确 ModelTable Runtime v0 的最小功能与接口边界。
- 定义确定性更新语义与变更检测策略的文档级说明。
- 明确与 Concrete Key Inventory / Coverage Matrix 的约束对齐方式。
- 给出最小可执行验证路径（命令与 PASS/FAIL 判定口径）。

## 7. Risks & Mitigations
- Risk: ModelTable 接口设计与后续 built-in k 证据不一致。
  - Impact: 行为对齐困难。
  - Mitigation: 以 Concrete Key Inventory / Coverage Matrix 为约束先行校验。
- Risk: 过早抽象导致偏离 SSOT。
  - Impact: 后续需要返工。
  - Mitigation: 严格以 SSOT/Charter + PICtest 可观测行为为依据。

## 8. Open Questions
- ModelTable 变更检测应以何种粒度记录（Cell-level / Label-level）以满足后续对照测试？
- v0 是否需要定义最小持久化接口，还是仅内存模型？

## 9. SSOT Alignment Checklist (REQUIRED)
- SSOT 0.2/3/4/5：模型驱动、UI 投影、执行在工人、控制总线边界保持一致。
- SSOT 8.2：必须具备脚本化验收路径（本迭代仅定义验证入口）。
- 若发现 PICtest 行为与 SSOT 冲突，记录冲突而不擅自更改。

## 10. Charter Compliance Checklist (REQUIRED)
- Charter 3.2/3.3/3.4：Cell 固定、built-in k 以 PICtest 行为为准、PIN_IN/OUT。
- Charter 6.1：仅控制总线（MQTT + PIN），不引入 Matrix/Element Call/E2EE/打包。
- Charter 7.1/7.2：PICtest 为行为 Oracle；不确定项需文档化。

## 11. Behavior First (REQUIRED)
- 行为证据来源以 PICtest 为唯一真值源。
- 约束来源：
  - `docs/iterations/0122-pictest-evidence/evidence.md`
  - `docs/iterations/0122-oracle-harness-plan/harness_plan.md`

## 11.1 ModelTable Runtime Spec v0 (REQUIRED)

### A) Cell Identity
- Cell 唯一身份由 `(p, r, c)` 组成；`p/r/c` 必须为整数。
- 澄清：`k` 属于 **label 维度**，不属于 cell identity；Cell(p,r,c) 内含多个 label(k/t/v)，与 PICtest 的 `add_label` 模型一致。
- Cell 的内容由 Label 集合构成；Label 必须包含 `k/t/v`（与 PICtest 兼容）。
- ModelTable 的最小维度为 `Model -> Cells[(p,r,c)] -> Labels[k]`。

### B) Core API (v0 Interface Surface)
- `create_cell(p, r, c) -> Cell`
  - 若 Cell 已存在则返回既有实例。
- `get_cell(p, r, c) -> Cell`
  - 若不存在则创建（与 PICtest 行为对齐；证据条目见 `docs/iterations/0122-pictest-evidence/evidence.md`）。
- `add_label(cell, label, save=true, init=true) -> void`
  - 负责校验、覆盖/合并、触发 label_init。
- `rm_label(cell, k, save=true) -> void`
  - 移除 label，并触发引脚移除逻辑（与 PICtest 行为对齐）。
- `set_labels(cell, labels[], save=true, init=true) -> void`
  - 批量替换 label 集合；必须生成一致的变更事件序列。
- `list_cells() -> Cell[]`
  - 用于 Harness 对照抽样与快照。
- `snapshot() -> ModelTableSnapshot`
  - 输出确定性快照（用于对照测试）。

### C) Validation Rules
- `p/r/c` 必须为整数；否则拒绝写入并记录错误事件。
- `label.k` 必须为非空字符串；否则拒绝写入并记录错误事件。
- `label.t` 必须为非空字符串；否则拒绝写入并记录错误事件。
- `label.v` 可为任意 JSON 可序列化值；不可序列化时记录错误事件。

## 11.2 Deterministic Update Semantics (REQUIRED)
- **写入顺序**：同一批操作按调用顺序入队执行；每次写入生成严格递增的 `event_id`。
- **覆盖/合并**：同一 Cell 的同名 `label.k` 采用**覆盖**语义（以最后写入为准）；无隐式合并。
- **t/v 变更规则**：若 `label.k` 已存在且 `t` 或 `v` 变化，则视为一次覆盖更新；必须产生更新事件并记录旧值与新值。
- **时间处理**：事件时间戳由运行时单调递增计数 + 可选 wall-clock 记录；对照测试以 `event_id` 为主序。
- **随机处理**：v0 不允许引入随机性；若发现随机源必须记录并阻断。

## 11.3 EventLog / ChangeLog (REQUIRED)

### Minimal EventLog Fields
- `event_id`（递增）
- `ts`（可选 wall-clock）
- `op`（add_label / rm_label / set_labels / error）
- `cell`（p/r/c）
- `label`（k/t/v）
- `prev_label`（可选，覆盖/移除时）
- `result`（applied / rejected）
- `reason`（可选，错误原因）

### Granularity
- 以 **Label-level** 记录（每次 label 变更 = 1 event）。选择理由：PICtest 原子操作与 Harness 覆盖索引均以 `label.k` 为核心。
- 批量操作 `set_labels` 必须拆解为可审计的逐 label 事件序列。

### Harness 对比口径
- Harness 以 `event_id` 顺序比对 EventLog；ModelTable 快照用于终态校验。
- Concrete Key Coverage Matrix 中每个 key 的“期望副作用”必须可映射为 EventLog 事件序列。

## 11.4 Persistence Contract v0 (REQUIRED)
- v0 允许内存实现，但必须定义持久化接口契约：
  - `load(checkpoint_id?) -> ModelTableSnapshot`
  - `flush(snapshot) -> checkpoint_id`
  - `checkpoint(reason) -> checkpoint_id`
- 所有持久化接口必须可被 Harness stub/mock 以验证行为顺序与快照一致性。

## 12. Iteration Decomposition (Conditional)
- Stage 2.2/2.3 按 `docs/roadmap/dongyu_app_next_runtime.md` 执行。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
