---
title: "0176 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0176-worker-spec-audit
id: 0176-worker-spec-audit
phase: phase1
---

# 0176 — Resolution (HOW)

## Execution Strategy

- 先建立审计证据格式，再分别梳理 `ui-server`、`mbr worker`、`Sliding UI -> ui-server` 三条链路的真实代码路径与运行边界。
- 结论只按 repo 事实与本地复验证据给出，并显式判断哪些逻辑属于 Tier 1、哪些本应下沉到 Tier 2。
- 手工填表验证不写成脚本优先，而是沉淀成可直接照着填 `model0` / 正数模型的案例文档；同时把每次实际验证记录写到 `docs/logs/`。
- 若发现稳定的规约违例或绕过点，只先记录与分级；只有在证据收集被阻塞时才做最小修复。

## Step 1

- Scope:
  - 建立 iteration 文档、`docs/logs/` 记录格式和审计输出结构。
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0176-worker-spec-audit/plan.md`
  - `docs/iterations/0176-worker-spec-audit/resolution.md`
  - `docs/iterations/0176-worker-spec-audit/runlog.md`
  - `docs/logs/0176-worker-spec-audit/*`
- Verification:
  - `rg -n "0176-worker-spec-audit|docs/logs/0176-worker-spec-audit" docs/ITERATIONS.md docs/iterations/0176-worker-spec-audit docs/logs/0176-worker-spec-audit`
- Acceptance:
  - iteration 已登记，且存在可复用的 logs 模板与记录入口。
- Rollback:
  - 删除 `0176` iteration 与 `docs/logs/0176-worker-spec-audit`。

## Step 2

- Scope:
  - 审计 `ui-server` 与 `mbr worker` 的初始化、bootstrap、数据传递、Tier 归属与规约符合性。
- Files:
  - `docs/logs/0176-worker-spec-audit/ui_server_audit.md`
  - `docs/logs/0176-worker-spec-audit/mbr_audit.md`
  - `docs/iterations/0176-worker-spec-audit/runlog.md`
- Verification:
  - `rg -n "Tier 1|Tier 2|绕过|旁路|Model 0|MODELTABLE_PATCH_JSON" docs/logs/0176-worker-spec-audit/ui_server_audit.md docs/logs/0176-worker-spec-audit/mbr_audit.md`
- Acceptance:
  - 两条链路都有代码级路径、边界判断、风险点和引用。
- Rollback:
  - 删除本轮 audit log 文档。

## Step 3

- Scope:
  - 审计 `Sliding UI -> ui-server` 路径，并核查正数模型创建/子模型/引脚/权限规则是否有实现保障。
- Files:
  - `docs/logs/0176-worker-spec-audit/sliding_ui_to_server_audit.md`
  - `docs/iterations/0176-worker-spec-audit/runlog.md`
- Verification:
  - `rg -n "mailbox|owner|submodel|pin|model1|model2|negative model|model0" docs/logs/0176-worker-spec-audit/sliding_ui_to_server_audit.md`
- Acceptance:
  - 已明确哪些规则现有实现有保障，哪些仅存在文档层要求，哪些存在潜在绕过。
- Rollback:
  - 删除本轮 audit log 文档。

## Step 4

- Scope:
  - 设计“从 0 开始填 model0 和正数模型”的手工验证用例，并执行至少一轮代表性复验。
- Files:
  - `docs/logs/0176-worker-spec-audit/manual_case_catalog.md`
  - `docs/logs/0176-worker-spec-audit/case_runs/*.md`
  - `docs/iterations/0176-worker-spec-audit/runlog.md`
- Verification:
  - `rg -n "Case 0|Case 1|前置填表|预期拒绝|预期 PASS|model0|model1|model2" docs/logs/0176-worker-spec-audit/manual_case_catalog.md docs/logs/0176-worker-spec-audit/case_runs`
- Acceptance:
  - 已形成覆盖 bootstrap / owner / submodel / pin routing / 非法绕过的案例目录，并至少落一轮真实执行记录。
- Rollback:
  - 删除案例目录与 case run 记录。

## Step 5

- Scope:
  - 汇总发现、分级风险、沉淀规约改进建议，明确后续 remediation 是否需要单独 iteration。
- Files:
  - `docs/logs/0176-worker-spec-audit/findings_and_recommendations.md`
  - `docs/iterations/0176-worker-spec-audit/runlog.md`
- Verification:
  - `rg -n "Finding|Risk|Bypass|Recommendation|Follow-up" docs/logs/0176-worker-spec-audit/findings_and_recommendations.md`
- Acceptance:
  - 已形成可讨论的发现清单与后续动作建议，不把改进建议留在聊天里。
- Rollback:
  - 删除 findings 文档。

## Notes

- Review Gate:
  - Decision: Approved
  - Basis: 用户明确要求“彻查三类软件工人、设计手工填表案例、把 logs 和改进建议都落文档，并允许拆成多个 it”。
