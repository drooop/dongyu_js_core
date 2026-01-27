# Iteration 0127-doit-auto-docs-refresh Plan

## 0. Metadata
- ID: 0127-doit-auto-docs-refresh
- Date: 2026-01-27
- Owner: Sisyphus (OpenCode)
- Branch: dev_0127-doit-auto-docs-refresh
- Related: docs/roadmap/dongyu_app_next_runtime.md, docs/roadmaps/dongyu-app-next-runtime-elysia.md, docs/concepts/pictest_pin_and_program_model.md

## 1. Goal
重新整理由 doit-auto 形成的路线图文档，补齐程序模型注册/加载过程的证据引用与说明，并把 test_files/test7 作为最终测试用例明确写入文档。

## 2. Background
当前路线图文档已包含整体迭代结构，但缺少对“程序模型注册/加载过程”的直接引用与可核验说明，也未明确最后的测试用例。为避免后续实现偏差，需要先完成文档级对齐，并将 test_files/test7 作为最终验证样例写入。

## 3. Invariants (Must Not Change)
- 不修改 SSOT：`docs/architecture_mantanet_and_workers.md`。
- 不违反 Charter：`docs/charters/dongyu_app_next_runtime.md`。
- 不改动运行时代码与 test_files 内容（仅写文档）。
- 仅改路线图 + iteration 记录文档，不修改 SSOT/Charter/证据文档本体。
- 不引入 Matrix/双总线，保持第一阶段控制总线范围不变。

## 4. Scope
### 4.1 In Scope
- 重新整理与补充路线图文档：
  - `docs/roadmaps/dongyu-app-next-runtime-elysia.md`
  - `docs/roadmap/dongyu_app_next_runtime.md`
- 维护 iteration 记录文档：
  - `docs/iterations/0127-doit-auto-docs-refresh/runlog.md`
  - `docs/ITERATIONS.md`
- 明确引用程序模型注册/加载过程（基于 `docs/concepts/pictest_pin_and_program_model.md` 与 `docs/v1n_concept_and_implement.md`）。
- 明确将 `test_files/test7/main.py` 与 `test_files/test7/yhl.db` 作为最终测试用例。
- 修正路线图中可能引发 Charter 误读的 Current Phase 表述（不改变范围边界，仅澄清语义）。

### 4.2 Out of Scope
- 任何运行时代码实现或行为改动。
- 修改 `test_files/test7/` 的文件内容。
- 变更 SSOT/Charter/Workflow 本体。

## 5. Non-goals
- 不设计或实现新的 built-in k 行为。
- 不进行 UI AST/Renderer 或 app-shell 实现。
- 不引入额外测试脚本或外部依赖。

## 6. Success Criteria (Definition of Done)
- 路线图文档中明确写入“程序模型注册/加载过程”的证据引用与说明。
- 路线图文档中明确写入 `test_files/test7/main.py` 与 `test_files/test7/yhl.db` 为最终测试用例。
- 可执行验证同时命中：
  - `test_files/test7/main.py` 与 `test_files/test7/yhl.db`
  - 程序模型注册/加载过程的证据指针（`docs/concepts/pictest_pin_and_program_model.md` 或 `docs/v1n_concept_and_implement.md`）

## 7. Risks & Mitigations
- Risk: 文档描述与 SSOT/Charter 不一致。
  - Impact: 误导后续实现。
  - Mitigation: 明确引用 SSOT/Charter/证据文档，并在 Checklist 中核对。

## 8. Open Questions
None.

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `docs/architecture_mantanet_and_workers.md`（程序模型、ModelTable、PIN_IN/OUT 不变量）
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
- Notes:
  - 仅整理文档，不改语义。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `docs/charters/dongyu_app_next_runtime.md`
- Notes:
  - 保持阶段范围与禁止项不变，且不触碰 Matrix/双总线。

### 9.3 Iteration Decomposition (Conditional)
N/A

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
