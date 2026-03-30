---
title: "Iteration 0266-scoped-patch-authority Plan"
doc_type: iteration-plan
status: active
updated: 2026-03-30
source: ai
iteration_id: 0266-scoped-patch-authority
id: 0266-scoped-patch-authority
phase: phase1
---

# Iteration 0266-scoped-patch-authority Plan

## 0. Metadata
- ID: 0266-scoped-patch-authority
- Date: 2026-03-30
- Owner: Codex + User
- Branch: dev_0266-scoped-patch-authority
- Related:
  - `/Users/drop/codebase/cowork/dongyuapp_elysia_based/docs/plans/2026-03-30-scoped-patch-authority-design.md`
  - `/Users/drop/codebase/cowork/dongyuapp_elysia_based/docs/plans/2026-03-30-scoped-patch-authority-implementation.md`

## 1. Goal
把 runtime-wide patch authority 改造成“按当前模型作用域收紧”的执行模型，使双总线回程、UI 子模型 materialization、以及用户自定义程序模型都不能绕过父子 pin/API 链路直接越权写模型表。

## 2. Background
当前仓内已经确认至少两条不合规路径：
- `ui-server` 的 dual-bus 回程会 direct `runtime.applyPatch(...)`
- `Model 100` 的回程 handler 会 direct `ctx.runtime.applyPatch(...)`

这导致“只通过子模型暴露的 pin/API 链逐层深入并在目标模型内 materialize”的规约未被真正 enforce。用户进一步确认，希望后续用户自定义程序模型也不开放类似 `apply_patch` 的能力，而只能通过写 pin 调用预置 helper 完成当前模型修改。

## 3. Invariants (Must Not Change)
- `ModelTable` 仍是唯一真值源。
- `model.submt` 仍只负责父子挂载，不自动提供跨层数据写权限。
- 父模型不能直接操作子模型内部状态；跨层通信必须依赖 hosting cell 暴露的 pin/API。
- 全局 `applyPatch` 仅保留给 trusted bootstrap / loader，不得继续作为运行态通用能力。
- 实现前必须先完成影响面审查；实现后必须重新部署本地环境再验收。

## 4. Scope
### 4.1 In Scope
- 冻结 scoped patch authority 规约与 helper cell 约定
- runtime / ctx API 的权限收紧
- `ui-server` dual-bus 回程路径改造
- 所有受影响 system-model JSON / deploy patches 的升级审查与统一迁移
- regression tests + 本地 redeploy/live verification

### 4.2 Out of Scope
- 远端环境部署
- 新业务功能
- 非权威草稿/实验文件的整理

## 5. Non-goals
- 不在本 iteration 里发明新的 UI authoring 范式
- 不引入“隐藏 helper 模型/魔法执行层”
- 不保留 direct patch bypass 作为兼容兜底

## 6. Success Criteria (Definition of Done)
1. 运行态函数与用户程序不再持有全局 `applyPatch` 能力。
2. 当前模型只能通过 reserved helper cell 执行 scoped patch materialization。
3. dual-bus UI 子模型的回程路径不再 direct patch 目标模型，而是通过 formal pin/helper 链落盘。
4. 所有受影响的 authoritative JSON patches 与 deploy patches 完成升级并通过审查脚本。
5. 本地重新部署后，真实运行面验证通过，且 runlog 有部署与 live evidence。

## 7. Risks & Mitigations
- Risk: 历史 JSON patches 分布广，容易只修 `Model 100` 漏掉其它 UI 模型。
  - Impact: 局部合规，整体仍留 bypass。
  - Mitigation: 先写 repo audit test，再批量升级 authoritative patches。
- Risk: runtime/ctx 权限收紧可能影响已有负数系统模型函数。
  - Impact: 回归失败或运行时行为中断。
  - Mitigation: 以 focused contract tests 先红后绿，逐批迁移系统模型。
- Risk: 代码通过但 live 环境仍跑旧 persisted assets。
  - Impact: 验收结论失真。
  - Mitigation: 把 redeploy + baseline check 作为 DoD 强制步骤。

## 8. Open Questions
- helper executor cell 的最终保留命名与 label key 需要在实现时从现有 label registry 中选一组不冲突命名。

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `/Users/drop/codebase/cowork/dongyuapp_elysia_based/CLAUDE.md`
  - `/Users/drop/codebase/cowork/dongyuapp_elysia_based/docs/ssot/runtime_semantics_modeltable_driven.md`
  - `/Users/drop/codebase/cowork/dongyuapp_elysia_based/docs/ssot/label_type_registry.md`
  - `/Users/drop/codebase/cowork/dongyuapp_elysia_based/docs/ssot/host_ctx_api.md`
- Notes:
  - 本 iteration 直接修改 runtime semantics / host ctx API / label registry，属于 living docs mandatory review 范围。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `/Users/drop/codebase/cowork/dongyuapp_elysia_based/docs/WORKFLOW.md`
  - `/Users/drop/codebase/cowork/dongyuapp_elysia_based/docs/user-guide/modeltable_user_guide.md`
- Notes:
  - 当前阶段仅限 Phase 1 文档；实现必须等待正式 Review Gate。
