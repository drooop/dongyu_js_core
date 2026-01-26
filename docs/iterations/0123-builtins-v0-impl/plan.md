# Iteration 0123-builtins-v0-impl Plan

## 0. Metadata
- ID: 0123-builtins-v0-impl
- Date: 2026-01-23
- Owner: TBD
- Branch: dev_0123-builtins-v0-impl
- Related: docs/roadmap/dongyu_app_next_runtime.md

## 1. Goal
实现 builtins-v0（仅 MVP keys），并按 Validation Protocol 逐条验证 PASS（含命令与输出摘要），用于完成 Stage 2.2 的实现型要求。

## 2. Background
Stage 2.2 已完成 docs-only（Ledger + Validation Protocol）。根据滚动执行模式，本迭代为实现型 iteration，用于落地 MVP keys 并完成可验证对照。

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
- 仅实现 MVP keys（见 Ledger）。
- 实现必须严格对齐：
  - `docs/iterations/0123-builtins-v0/ledger.md`
  - `docs/iterations/0123-builtins-v0/validation_protocol.md`
  - `docs/ssot/modeltable_runtime_v0.md`
- 执行 Validation Protocol，并在 runlog 记录逐条 PASS（含命令与输出摘要）。

### 4.2 Out of Scope
- Deferred keys 的语义实现（仅识别/无副作用）。
- UI AST/Renderer、Matrix、Element Call、E2EE、打包。
- MQTT pub/sub（除非证据明确且属于本 key 内建副作用）。

## 5. Non-goals
- 不扩展或新增 built-in 语义。
- 不以抽象模块替代 key-by-key 覆盖。

## 6. Success Criteria (Definition of Done)
- MVP keys 实现完成并与 Ledger 逐条对齐。
- Validation Protocol 的逐条 PASS 在 runlog 中可审计（命令 + 输出摘要）。
- Stage 2.2 的 IMPL 要求满足后才可标记 Completed。

## 7. Risks & Mitigations
- Risk: 误实现新语义。
  - Impact: 行为偏离 PICtest。
  - Mitigation: 所有空白先记录为 Open Questions。
- Risk: 对照验证不充分。
  - Impact: 无法推进 Stage 2.2。
  - Mitigation: runlog 必须逐条 PASS。

## 8. Open Questions
- MVP keys 是否需要额外样例集以覆盖 run_<func> 错误路径？

## 9. SSOT Alignment Checklist (REQUIRED)
- SSOT 0.2/3/4/5：模型驱动、UI 投影、执行在工人、控制总线边界保持一致。
- SSOT 8.2：必须具备脚本化验收路径。
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
  - `docs/iterations/0123-builtins-v0/ledger.md`
  - `docs/iterations/0123-builtins-v0/validation_protocol.md`

## 12. Iteration Decomposition (Conditional)
- Stage 2.3 在 Stage 2.2 IMPL 完成后推进。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
