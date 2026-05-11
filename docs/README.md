---
title: "Docs Index"
doc_type: governance
status: active
updated: 2026-05-10
source: ai
---

# Docs Index

本页是 `docs/` 的导航地图，不是新的规约来源。执行优先级始终是 `CLAUDE.md` > current SSOT / charter / workflow > user-guide > plan / handover / historical evidence。

使用本文时先判断文件类型：

| 类型 | 作用 | 能否覆盖 current SSOT |
|---|---|---|
| 最高约束 | 仓库执行边界、安全禁区、工作流硬约束 | 可以，最高优先级 |
| current SSOT / charter | 当前语义、合同、架构边界 | 可以覆盖下层文档 |
| workflow / governance | 如何计划、审核、执行、验证 | 只覆盖流程，不覆盖产品语义 |
| user-guide | 面向使用者和集成者的当前用法 | 不能覆盖 SSOT |
| roadmap / plan | 目标、方案、历史设计 | 不能覆盖 current SSOT |
| iteration / handover / tmp / test evidence | 审计事实、交接、临时记录、证据 | 不能覆盖 current SSOT |

## 1. 最高约束

- `../CLAUDE.md`
  - 仓库最高执行约束、远端安全禁区、ModelTable 不变量、工作流闸门、规约撰写方法。
- `../AGENTS.md`
  - 仓库导航与 repo-local 协作提示；不得覆盖 `CLAUDE.md`。

## 2. 当前规约

- `docs/architecture_mantanet_and_workers.md`
  - 系统概念、架构边界和术语总入口。若它与更具体 SSOT 冲突，按具体文件的 delegation 规则处理。
- `docs/ssot/runtime_semantics_modeltable_driven.md`
  - ModelTable 结构性声明和运行时副作用的语义裁判。
- `docs/ssot/label_type_registry.md`
  - `label.t` 注册表与 label 类型迁移边界。
- `docs/ssot/pin_connection_contract_v2.md`
  - 0356 之后 PIN 连接合同和 legacy hard-cut 边界。
- `docs/ssot/temporary_modeltable_payload_v1.md`
  - pin/event 传输中的临时 ModelTable record array。
- `docs/ssot/host_ctx_api.md`
  - 程序模型可调用的宿主能力边界。
- `docs/charters/dongyu_app_next_runtime.md`
  - Next Runtime rewrite 的项目级 charter，低于系统 SSOT，高于 iteration 计划。
- `docs/ssot/`
  - 其他当前有效的运行时、payload、PIN、data model、host API、执行治理等规约。

## 3. 执行与治理

- `docs/WORKFLOW.md`
  - iteration 生命周期、review gate、runlog、completion 的当前流程。
- `docs/ITERATIONS.md`
  - iteration 唯一索引。它登记状态，但不把历史 iteration 变成 current policy。
- `docs/ssot/execution_governance_ultrawork_doit.md`
  - AI 协作、sub-agent review、规约撰写和 artifact 使用边界。
- `docs/ai-work-conventions.md`
  - deprecated 历史参考。新工作不从这里取规则。

## 4. 用户文档

- `docs/user-guide/README.md`
  - 用户指南入口。它会把当前指南、visualized / interactive HTML、历史 prompt、runbook 和 archive 分开。
- `docs/user-guide/**/*.html`
  - 只作为 visualized / interactive companion 使用；不是 SSOT。

## 5. 路线图、计划与历史设计

- `docs/roadmaps/`
  - 路线图和目标方向。它说明“可能/计划做什么”，不直接证明“当前已经可用”。
- `docs/plans/`
  - 历史设计和 implementation plan。除非被 current SSOT 明确提升，否则不作为当前规则。
- `docs/architecture-review-2026-04/`、`docs/architecture_review.md`
  - 架构审查证据和反思材料。
- `docs/UI_ITERATION_WAVE_POST_0201.md`
  - 历史 wave 规划说明。
- `docs/TODO.md`
  - 历史业务/调研笔记，不作为 repo 执行任务列表。

## 6. 部署与运行资料

- `docs/deployment/runtime_baseline_default.md`
  - 默认常驻基线和本地/远端 runtime baseline 口径。
- `docs/deployment/remote_worker_k8s_runbook.md`
  - remote worker / K8s 操作 runbook。
- `docs/deployment/infrastructure_recovery.md`
  - 历史恢复记录和排障参考。
- `docs/deployment/cloud_public_docs_fast_deploy.md`
  - 只发布公开文档和静态 HTML 时的远端快速部署路径，不重建镜像、不重启 workload。

## 7. 历史事实与 archive

- `docs/iterations/`
  - 迭代合同、runlog 和 evidence archive。除当前 iteration 自身外，不批量改写历史正文。
- `docs/handover/`
  - 历史交接材料。若与 current SSOT 冲突，以 current SSOT 为准。
- `docs/concepts/`
  - 概念来源或历史理解材料。当前语义仍以 SSOT 为准。
- `docs/prompts/`
  - prompt archive，不是当前协作规约。
- `docs/tests/`
  - 测试证据或 runbook，不是产品语义来源。
- `docs/tmp/`
  - 临时或迁移输出，不提升为规约。
