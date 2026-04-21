---
title: "Iteration Workflow"
doc_type: governance
status: active
updated: 2026-04-21
source: ai
---

# Iteration Workflow

> 关键约束已提升至 `CLAUDE.md`（自动加载）。本文件为详细参考。

本仓库的非紧急工作必须按 Iteration 工作流执行。目标：将"需求 → 计划 → 执行 → 验证 → 证据沉淀"固化为可复制流程。

---

## 核心概念

- **Iteration**：一次迭代工作包，目录为 `docs/iterations/<id>/`。
- **plan.md**：合同（WHAT/WHY）。定义目标、范围、不变量、成功标准。不得出现步骤编号和执行记录。
- **resolution.md**：施工方案（HOW）。以 Step 1..N 定义范围、文件、验证、验收、回滚。不得记录真实执行结果。
- **runlog.md**：飞行记录仪（FACTS）。只记录真实执行命令、关键输出、commit、PASS/FAIL、修复。不得写愿景与计划。
- **assets/**：截图、录屏、性能数据、对比图等证据（可选）。

---

## Phase 0 — Intake（需求录入）

输入：人类给出本次版本需求（可简短）。
输出：确定 `<id>`，创建 iteration 目录骨架。

约束：
- 未登记到 `docs/ITERATIONS.md` 的 iteration 不允许进入后续阶段。

## Phase 1 — Planning（生成计划）

输入：需求描述 + 模板 `docs/_templates/`。
输出：
- `docs/iterations/<id>/plan.md`
- `docs/iterations/<id>/resolution.md`
- 在 `docs/ITERATIONS.md` 登记（状态=Planned）

约束：
- **Phase 1 严禁实现代码**（只能写文档与计划）。
- plan 与 resolution 必须可被"无上下文读者"理解（自包含）。

## Phase 2 — Review Gate（审核闸门）

输入：对 plan/resolution 的审核结论。
输出：明确状态之一：
- **Approved**：允许进入 Phase 3
- **Change Requested**：返回 Phase 1 修改
- **On Hold**：暂停，不执行

约束：
- 未得到明确 Approved，不允许进入 Phase 3。
- 最多允许 3 次 major revision（影响 scope/契约/验证口径）。超过则必须 On Hold 并要求人类裁决。
- minor wording 修订不计数。

### Review Gate 记录模板

每次 review 必须写入 `docs/iterations/<id>/runlog.md` 的 Environment 区域：

```text
Review Gate Record
- Iteration ID:
- Review Date:
- Review Type: User / AI-assisted
- Review Index: 1/2/3...
- Decision: Approved / Change Requested / On Hold
- Notes:
```

### Auto-Approval Policy（单人模式）

当用户没有明确审核时，允许 AI 进行多次独立审核替代人工审核：

规则：
- 必须进行至少 3 次独立 review（不同视角或独立会话）。
- 最近连续 3 次 review 的 Decision 均为 **Approved**，且没有任何未处理的 Change Requested。
- 满足后可将 Review Gate 视为 **Approved** 并进入 Phase 3。
- 所有 review 记录必须写入 runlog.md。

## Phase 3 — Execution（按 Step 执行并自我迭代）

输入：已 Approved 的 `resolution.md`。
输出：逐 Step 完成实现与验证，将真实证据写入 `runlog.md`。

执行原则：
- 只在指定分支工作（`dev_<id>`）。
- 严格按 Step 顺序推进，不得跳步。
- 每个 Step 必须具备可执行验证（命令/脚本/可判定检查清单）。
- 验证失败必须自我迭代修复，直到通过才允许提交。
- 每个 Step 的真实执行证据写入 `runlog.md`（命令 + 关键输出 + commit hash）。
- 最多 3 次 major revision。超过则 On Hold 并要求人类裁决。

### Conformance Review（强制）

除“功能跑通”外，每次实现与测试还必须评估是否符合以下规范：
- Tier 1 / Tier 2 边界
- 负数系统模型 / 正数业务模型的放置边界
- 数据所有权
- 数据流向
- 数据链路是否存在跳层/绕过

详见：`docs/ssot/tier_boundary_and_conformance_testing.md`

## Phase 4 — Completion（完成与归档）

完成条件（Definition of Done）：
- `resolution.md` 中所有 Step 均在 `runlog.md` 里有 PASS 记录与对应 commit。
- `docs/ITERATIONS.md` 状态更新为 Completed（并填写最终分支/commit）。
- 关键资产（截图/性能数据）如有必须归档在 `assets/`。

---

## Documentation Maintenance（必须执行）

以下变更必须同步更新用户指南，并在对应 iteration 的 runlog 中记录 "docs updated"：
- mailbox contract（事件信封/错误码/单槽规则）
- PIN topic/payload 口径
- MGMT patch/routing 规则
- reserved model ids / reserved cells

指南入口：`docs/user-guide/modeltable_user_guide.md`

### Living Docs Review（必须评估）

每次相关变更必须评估是否需要更新以下文档，并在 runlog 记录评估结论：
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/user-guide/modeltable_user_guide.md`
- `docs/iterations/<id>/*`（plan/resolution/contract/validation）
- `docs/ssot/execution_governance_ultrawork_doit.md`
- `docs/ssot/tier_boundary_and_conformance_testing.md`

---

## 分支约定

- Iteration 分支：`dev_<id>`，完成后 merge 到 `dev`。
- `main` 只在需要发布/对外里程碑时从 `dev` 提升。
- 单人项目默认流程：本地验证通过后，直接把 iteration 分支本地 merge 到 `dev` 并 push。
- GitHub PR 不是默认要求；只有用户明确要求 review/PR 时才创建。
- `dev` 仍然禁止日常直提；允许的常规写入方式仍然是 merge commit。

## 允许的例外

仅以下情况允许绕过完整流程：
- 线上紧急修复（hotfix）
- 安全漏洞紧急修复

但仍需在事后补齐：
- Iteration 记录（至少 runlog 与链接到相关 commit）
