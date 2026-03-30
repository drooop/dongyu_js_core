---
title: "Iteration 0261-docs-source-flip Plan"
doc_type: iteration-plan
status: active
updated: 2026-03-30
source: ai
iteration_id: 0261-docs-source-flip
id: 0261-docs-source-flip
phase: phase1
---

# Iteration 0261-docs-source-flip Plan

## 0. Metadata
- ID: 0261-docs-source-flip
- Date: 2026-03-30
- Owner: Codex + User
- Branch: dev_0261-docs-source-flip
- Related:
  - `CLAUDE.md`
  - `README.md`
  - `docs/WORKFLOW.md`
  - `docs/ITERATIONS.md`
  - `scripts/ops/obsidian_docs_audit.mjs`
  - `scripts/ops/validate_obsidian_docs_gate.mjs`

## 1. Goal
把当前项目从“`repo/docs -> vault目录`”反转为“仓库内 `docs/` 为权威源，vault 路径为指向仓库 `docs/` 的 symlink”，使 docs 变更能够直接进入 Git 工作流。

## 2. Background
当前仓库把 `docs/` 作为指向 `~/Documents/drip/Projects/dongyuapp` 的 symlink，导致 Git 只跟踪一个 symlink 节点，`docs/**` 实际文件不在 repo index 中。结果是：
- `git add docs/...` 会触发 `beyond a symbolic link`
- hook / gate / orchestrator 对 docs 的可交付边界不稳定
- 文档虽能在 Obsidian 中即时可见，但不能作为仓内权威源稳定提交

`forkit` 已采用相反模式：仓库内 `docs/` 为真实目录，vault 入口再指回 repo。本次要把当前项目切到同一模式。

## 3. Invariants (Must Not Change)
- `docs-shared/` 维持现状，不纳入本次迁移。
- `docs/` 下既有文件层级、文件名和内容语义保持不变；本次不做批量文案重写。
- `scripts/ops/obsidian_docs_audit.mjs` 与 `scripts/ops/validate_obsidian_docs_gate.mjs` 的入口参数保持不变。
- vault 侧仍必须能通过 `~/Documents/drip/Projects/dongyuapp` 直接打开当前项目文档。
- 任意一步失败时，必须能用备份目录恢复原 vault 实体目录。

## 4. Scope
### 4.1 In Scope
- 备份当前 `~/Documents/drip/Projects/dongyuapp`
- 将 repo `docs` 从 symlink 迁为真实目录并纳入 Git
- 将 vault 路径 `dongyuapp` 反转为指向 repo `docs` 的 symlink
- 更新 README / CLAUDE / 相关说明文档
- 验证 Git、obsidian gate、最小 docs stage 行为恢复正常

### 4.2 Out of Scope
- `docs-shared/` 结构改造
- docs 内容规范化迁移
- 任何业务代码、runtime 语义或部署逻辑修改

## 5. Non-goals
- 不创建并行 `*-docs-edit` 入口
- 不做 shared knowledge 拆分或跨项目知识库整理
- 不顺手修复无关 docs 内容问题

## 6. Success Criteria (Definition of Done)
1. repo `docs/` 变为真实目录，`git ls-files | rg '^docs/'` 能列出 docs 文件。
2. `~/Documents/drip/Projects/dongyuapp` 变为指向 repo `docs/` 的 symlink。
3. `git add docs/ITERATIONS.md` 不再报 `beyond a symbolic link`。
4. `node scripts/ops/obsidian_docs_audit.mjs --root docs` 与 `node scripts/ops/validate_obsidian_docs_gate.mjs` 均通过。
5. README / CLAUDE / 历史备注中关于 docs 所有权的说明与新结构一致。

## 7. Risks & Mitigations
- Risk: 反转过程中丢失 vault 文档。
  - Impact: 文档数据损坏。
  - Mitigation: 先做时间戳备份；完成前不删除备份。
- Risk: hook / gate 仍隐式依赖 `docs` 为 symlink。
  - Impact: commit / audit 流程继续失败。
  - Mitigation: 迁移后立即跑 obsidian audit / gate 和最小 `git add` 验证。
- Risk: Obsidian 入口断开。
  - Impact: 日常文档编辑路径失效。
  - Mitigation: 用固定路径 `~/Documents/drip/Projects/dongyuapp` 回建 symlink，并验 `ls -ld`。

## 8. Open Questions
None.

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `CLAUDE.md`
  - `docs/WORKFLOW.md`
  - `docs/ITERATIONS.md`
- Notes:
  - 本次以仓库内 docs 为 source of truth，消除 symlink-only Git 边界。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `CLAUDE.md`
- Notes:
  - 本次为 docs ownership / workflow 修复，不改变 runtime / dataflow / tier 语义。
