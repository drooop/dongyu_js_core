# Iteration 0123-builtins-v0 Plan

## 0. Metadata
- ID: 0123-builtins-v0
- Date: 2026-01-23
- Owner: TBD
- Branch: dev_0123-builtins-v0
- Related: docs/roadmap/dongyu_app_next_runtime.md

## 1. Goal
基于 Concrete Key Inventory 的**实际 built-in k key 列表**实现内建行为 v0（不引入新语义），并与 Coverage Matrix / Harness Assertion Rules 对齐。

## 2. Background
Stage 2.1 已完成 ModelTable Runtime v0 规范。当前进入 Stage 2.2，要求严格以 PICtest 可观测行为为真值源，并以实际 key 列表为唯一索引进行实现计划。

## 3. Invariants (Must Not Change)
- ModelTable（p/r/c/k/t/v）是唯一事实与显示数据源。
- UI 事件只能表现为“写单元格”，不得直接产生副作用。
- 第一阶段仅控制总线（MQTT + PIN_IN/OUT），不引入 Matrix/双总线。
- 行为真值规则：在不违反 SSOT/Charter 的前提下，运行时行为以 PICtest 可观测行为为准；若有冲突，必须记录而不擅自裁决。
- 实现对象必须以 **Concrete Key Inventory** 的实际 built-in k key 为唯一索引，不得以 PIN/Function/Connect 等抽象模块组织。
- 每个 key 的实现计划必须逐条引用 Coverage Matrix 与 Harness Assertion Rules。
- 不得引入 PICtest 未覆盖的新语义；若发现空白，必须记录为 Open Questions。
- 本迭代不实现 UI、Matrix、E2EE、打包。

## 4. Scope
### 4.1 In Scope
- 为 Concrete Key Inventory 中每个实际 key 制定实现计划（逐条索引）。
- 为每个 key 引用 Coverage Matrix 与 Harness Assertion Rules 并给出验证口径。
- 明确对 PICtest 未覆盖行为的记录与处置方式（Open Questions）。
- 产出 Concrete Key Implementation Ledger（key-by-key 实施清单）。
- 产出 v0 Validation Protocol（基于 EventLog/snapshot/intercepts 的 PASS/FAIL 口径）。

### 4.2 Out of Scope
- UI AST/Renderer、Matrix、Element Call、E2EE、打包。
- 扩展或新增 built-in 语义。
- Test Harness 实现（仅计划，不写代码）。

## 5. Non-goals
- 不进行抽象模块化分组（仅按 key 列表组织）。
- 不补全 PICtest 以外的行为推断。

## 6. Success Criteria (Definition of Done)
- 每个实际 key 都有明确的实现计划条目，且逐条绑定 Coverage Matrix 与 Harness Assertion Rules。
- 未覆盖行为全部记录为 Open Questions。
- 不引入新语义、不引入 UI/Matrix/E2EE/打包。
- Concrete Key Implementation Ledger 完整覆盖 Inventory（含 run_<func> pattern）。
- v0 Validation Protocol 明确可执行（文档级）。

## 7. Risks & Mitigations
- Risk: 误以抽象模块取代 key 级覆盖。
  - Impact: 行为对齐失败。
  - Mitigation: 强制以 Concrete Key Inventory 为唯一索引。
- Risk: PICtest 行为不完整导致误实现。
  - Impact: 破坏 Oracle 对齐。
  - Mitigation: 所有空白写入 Open Questions。

## 8. Open Questions
- 若 Concrete Key Inventory 更新，是否需要立即回补本迭代计划条目？
- run_<func> 的 key 列表是否需要在此迭代限定最小样例集？

## 9. SSOT Alignment Checklist (REQUIRED)
- SSOT 0.2/3/4/5：模型驱动、UI 投影、执行在工人、控制总线边界保持一致。
- SSOT 8.2：必须具备脚本化验收路径（本迭代仅计划）。
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
  - `docs/ssot/modeltable_runtime_v0.md`

## 11.1 Concrete Key Implementation Ledger (REQUIRED)
- Ledger 以 Concrete Key Inventory 为唯一索引（含 run_<func> pattern）。\n
- 每个 key 必须包含：证据来源、触发输入构造、预期 EventLog 序列、预期副作用/拦截点、PASS/FAIL 判据、未覆盖点/限制。\n
- Ledger 输出文件：`docs/iterations/0123-builtins-v0/ledger.md`\n

## 11.2 Builtins-v0 Scope Gate (MVP vs Deferred) (REQUIRED)
- v0 必做 keys（MVP）与 v0 延后 keys（Deferred）必须明确列出。\n
- Deferred keys 需写明原因与处理策略（仅识别/报错/无副作用）。\n

## 11.3 Stage 2.3 Boundary (REQUIRED)
- 本迭代不实现任何实际 MQTT pub/sub 行为；除非 PICtest 证据明确且属于本 key 的内建副作用。\n

## 12. Iteration Decomposition (Conditional)
- Stage 2.3 按 `docs/roadmap/dongyu_app_next_runtime.md` 执行。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
