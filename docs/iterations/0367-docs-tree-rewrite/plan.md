---
title: "Iteration 0367 Docs Tree Rewrite Plan"
doc_type: iteration_plan
status: completed
updated: 2026-05-10
owner: codex
source: ai
---

# Iteration 0367-docs-tree-rewrite Plan

## Goal

在 0365 的规约撰写方法和 0366 的多入口规约树基础上，继续梳理 `docs/` 全树：重写当前仍会指导工作的文档，明确历史证据层不再承担当前规约作用，并把 `docs/user-guide/` 纳入同一轮整理。

本轮开始实施前必须完成计划审查。审查通过前，只允许登记 iteration、盘点、写计划和修订计划。

## Scope

- In scope:
  - `docs/` 全树盘点与分类，记录哪些文件是当前规约、用户指南、运行/部署指南、历史证据、旧计划或临时材料。
  - 逐文件处置 manifest：除 `docs/iterations/**` 历史正文外，每个现有 docs 文件必须标记为 rewrite / annotate / index / preserve / defer。
  - 当前 active / normative 文档的重写与冲突修正，包括 `docs/README.md`、`docs/WORKFLOW.md`、`docs/ssot/*.md`、`docs/charters/*.md` 和仍被入口引用的架构/治理文档。
  - `docs/user-guide/` 重写：更新索引、区分当前可用指南、visualized/interactive HTML、历史 prompt、示例材料与归档材料。
  - `docs/deployment/`、`docs/roadmaps/`、`docs/plans/`、`docs/handover/`、`docs/prompts/`、`docs/tests/`、`docs/tmp/` 的入口级状态标注与必要修订。
  - 发现矛盾、模糊或已废弃口径时，一并修正或登记为 deferred issue。
- Out of scope:
  - 不改运行时代码、测试脚本、部署脚本或 Kubernetes 配置。
  - 不批量重写 `docs/iterations/**` 历史证据内容；只允许补充当前 iteration 文档和必要索引说明。
  - 不把 HTML 作为默认交付形态；仅在已有 visualized/interactive 指南或明确需要可视化/交互时维护 HTML。
  - 不发明尚未被 SSOT 或已完成 iteration 冻结的产品事实。

## Invariants / Constraints

- `CLAUDE.md` 是执行最高约束；`AGENTS.md` 只做分层导航与本地工作提示。
- `docs/ssot/**` 与 active charter/workflow 是当前规约；`docs/iterations/**`、旧 plans、handover、tmp、tests evidence 只作历史或证据，不能反向覆盖 current SSOT。
- 写法遵守 0365 的 `RULE_WRITING_METHOD`：硬约束只用于不可变边界；判断类内容写成条件规则；偏好写成默认倾向并说明例外；事实、目标、历史、废弃状态必须分开。
- user-guide 必须面向“如何使用/验证当前能力”，不得把目标态、旧路线、临时 prompt 当作当前能力。
- 若发现真实冲突但缺少证据裁决，先标注冲突和下一步验证，不靠猜测合并。

## Success Criteria

- Plan gate:
  - `plan.md`、`resolution.md`、`runlog.md`、docs tree inventory 和 file treatment manifest 已落盘。
  - manifest 已覆盖除 historical iteration 正文外的所有 docs 文件；`docs/iterations/**` 由目录级 preserve policy 保护，只允许更新 `0367-*` 和必要索引。
  - 独立 sub-agent review 返回 `APPROVED` 后才进入实施；若为 `CHANGE_REQUESTED`，修订后重新送审。
- Rewrite coverage:
  - `docs/` 全树每个主要 bucket 都有明确处置策略：rewrite / annotate / index / preserve / defer。
  - active current docs 具备清楚的 authority、scope、conflict/deprecation 口径，避免绝对化和互相覆盖。
  - `docs/user-guide/README.md` 明确当前指南、HTML 仅用于 visualized/interactive、历史 prompt/旧指南的归属。
- Consistency checks:
  - 当前规约中不得出现把 `docs/iterations/**` 历史文件作为 current policy 的口径。
  - 当前用户指南不得把已废弃 label、旧 bus/pin 路线、目标态能力写成已可用事实。
  - 发现但不能安全裁决的事项必须写入本 iteration 的 deferred list。
- Verification:
  - `git diff --check`
  - `comm` coverage check: every non-iteration docs file appears in `file_treatment_manifest.md`.
  - `git diff --name-only` scope check: changes remain docs-only.
  - frontmatter/status check for edited Markdown current docs.
  - user-guide index coverage check: every current/HTML/archive guide changed in this iteration is linked or explicitly classified from `docs/user-guide/README.md`.
  - HTML check: if any `*.html` changes, serve locally and inspect each modified page in browser.

## Inputs

- Created at: 2026-05-10
- Iteration ID: 0367-docs-tree-rewrite
- Base commits:
  - `cb291e0 docs(governance): add prompt guidance rules`
  - `4cce700 docs(governance): rewrite spec tree guidance`
- Inventory:
  - `docs/iterations/0367-docs-tree-rewrite/assets/docs_tree_inventory.md`
  - `docs/iterations/0367-docs-tree-rewrite/assets/file_treatment_manifest.md`
