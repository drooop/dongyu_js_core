# Iteration 0123-ui-ast-spec Plan

## 0. Metadata
- ID: 0123-ui-ast-spec
- Date: 2026-01-23
- Owner: TBD
- Branch: dev_0123-ui-ast-spec
- Related: docs/roadmap/dongyu_app_next_runtime.md

## 1. Goal
定义 UI AST 规范与渲染契约（documents-only），为后续渲染器实现提供可审计约束。

## 2. Background
Stage 3.1 仅做 UI AST 规范；本阶段不实现 UI，不改运行时行为，不引入新 built-in 语义。

## 3. Invariants (Must Not Change)
- ModelTable（p/r/c/k/t/v）是唯一事实与显示数据源。
- UI 事件只能表现为“写单元格”，不得直接产生副作用。
- 不引入 Matrix/双总线/UI 实现/E2EE/打包。
- 不新增 built-in 语义。

## 4. Scope
### 4.1 In Scope
- 定义 UI AST 最小节点集（Normative）与字段职责（展示 vs ModelTable 绑定）。
- 定义 UI 事件归一化为写 Cell 的契约（结构化写入规则）。
- 定义 AST → ModelTable 单向绑定硬规则（只读 + add_label/rm_label 写入）。
- 定义渲染层与 ModelTable 的映射约束（契约级）。
- 明确 AST Negative Spec（禁止能力清单）。

### 4.2 Out of Scope
- UI 具体实现（Vue/Element Plus 渲染）。
- 运行时行为改动。
- Matrix/Element Call/E2EE/打包。

## 5. Non-goals
- 不新增/变更 built-in 语义。
- 不引入 UI 逻辑执行权。

## 6. Success Criteria (Definition of Done)
- UI AST 规范可审计（最小节点集 + 字段职责 + 绑定规则）。
- 事件归一化规则清晰（写 Cell，结构化写入）。
- AST Negative Spec 明确（禁止可执行体等越权能力）。
- 渲染契约不违背 SSOT/Charter/Runtime Semantics。

## 7. Risks & Mitigations
- Risk: AST 规范与 ModelTable 语义冲突。
  - Impact: 后续渲染错误。
  - Mitigation: 强制引用运行时语义规范并保持一致。

## 8. Open Questions
- AST 节点最小集是否包含布局/容器节点？

## 9. SSOT Alignment Checklist (REQUIRED)
- SSOT 0.2/3/4：模型驱动、UI 投影、执行在工人。
- SSOT 8.2：必须具备脚本化验收路径（本迭代仅文档）。
- 若发现冲突，记录而不擅自更改。

## 10. Charter Compliance Checklist (REQUIRED)
- Charter 4.1/4.2：UI 不执行逻辑，事件写 Cell。
- Charter 6.1：不引入 Matrix/Element Call/E2EE/打包。

## 11. Behavior First (REQUIRED)
- 约束来源：
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`

## 12. Iteration Decomposition (Conditional)
- Stage 3.2 渲染器实现另行迭代。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
