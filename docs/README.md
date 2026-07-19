---
title: "Docs Index"
doc_type: governance
status: active
updated: 2026-07-10
source: ai
---

# Docs Index

本页是 `docs/` 的导航地图，不是新的规约来源。执行优先级始终是 `CLAUDE.md` > current SSOT / charter / workflow > user-guide > plan / handover / historical evidence。

## 0. Human entry 与共享产品合同

本页是 Human entry。人类与 LLM 使用不同导航入口，但读取同一套当前产品合同：

1. 产品与架构语义从 `docs/architecture_mantanet_and_workers.md` 和对应 `docs/ssot/*.md` 读取。
2. `docs/ssot/contract_surface_manifest.json` 只负责把合同路由到 SSOT、实现、测试和待决事项；它不是新的产品 SSOT。
3. `docs/ssot/feishu_alignment_decisions_v0.md` 记录 Feishu 公司共识如何被本仓库采纳，不替代运行时 SSOT。
4. LLM 从 `../CLAUDE.md` 与 `../AGENTS.md` 进入，但不得形成另一套产品合同。

权威按职责分域，不使用一条跨域总排序：

| 领域 | 权威 | 边界 |
|---|---|---|
| 公司共识 | Feishu `UpstreamConsensus` | 变更不会自动改变代码或 repo SSOT |
| 阅读视图与支持材料 | Feishu `DerivedView` / `SupportingSource` | 无独立裁决权 |
| 当前可执行合同 | 经 iteration 审核的 repo SSOT | 决定当前实现与测试口径 |
| 执行治理 | `CLAUDE.md`、`docs/WORKFLOW.md` | 决定如何修改、审核和验证，不替代具体产品 SSOT |
| 历史证据 | iteration、runlog、report | 保留事实，但不能覆盖 current SSOT |

发现 Feishu 与 repo 不一致时，记录为“公司共识变化、尚未本地采纳”，经用户确认和 Approved iteration 后再更新 repo；禁止自动双向覆盖。

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
  - 只有被明确归类为 current executable contract 的 runtime、payload、PIN、data model、host API 或执行治理文档属于当前规约。
  - routing indexes、generated summaries 和 decision backlogs 不属于产品 SSOT；目录位置本身不授予权威。

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
