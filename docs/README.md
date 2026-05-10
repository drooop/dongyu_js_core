---
title: "Docs Index"
doc_type: governance
status: active
updated: 2026-05-10
source: ai
---

# Docs Index

本目录按“最高约束、当前规约、执行流程、用户文档、历史事实”组织。若本文与 `CLAUDE.md` 的优先级树冲突，以 `CLAUDE.md` 为准。

## 1. 最高约束

- `../CLAUDE.md`
  - 仓库最高执行约束、远端安全禁区、ModelTable 不变量、工作流闸门、规约撰写方法。
- `../AGENTS.md`
  - 仓库导航与 repo-local 协作提示；不得覆盖 `CLAUDE.md`。

## 2. 当前规约

- `docs/architecture_mantanet_and_workers.md`
  - 系统架构 SSOT。
- `docs/ssot/runtime_semantics_modeltable_driven.md`
  - 运行时语义裁判规则。
- `docs/ssot/label_type_registry.md`
  - `label.t` 注册表。
- `docs/charters/*.md`
  - 项目级 Charter，低于系统 SSOT，高于 iteration 计划。
- `docs/ssot/`
  - 当前有效的运行时、payload、PIN、host API、执行治理等规约。

## 3. 执行与治理

- `docs/WORKFLOW.md`
- `docs/ITERATIONS.md`
- `docs/ssot/execution_governance_ultrawork_doit.md`
- `docs/ai-work-conventions.md`
  - 历史参考；文件内已标记 deprecated，不作为新工作规则来源。

## 4. 用户文档

- 入口：`docs/user-guide/README.md`

## 5. 路线图与计划

- `docs/roadmaps/dongyu-app-next-runtime.md`（主路线图，唯一）
- `docs/roadmaps/modeltable-editor-v1.md`
- `docs/roadmaps/sliding-ui-workspace-plan.md`

## 6. 部署文档

- `docs/deployment/runtime_baseline_default.md`（默认常驻基线：Docker + K8s）
- `docs/deployment/infrastructure_recovery.md`
- `docs/deployment/remote_worker_k8s_runbook.md`

## 7. 历史事实

- `docs/iterations/`：迭代合同与 runlog。它们是事实记录和审计证据，不作为覆盖当前 SSOT 的政策来源。
- `docs/concepts/`：PICtest 证据化理解文档。若与当前 SSOT 冲突，以当前 SSOT 为准。
- `docs/tmp/`：临时输出目录，仅保留临时用途（不存测试数据）
