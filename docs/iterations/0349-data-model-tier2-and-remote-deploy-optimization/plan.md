---
title: "0349 Data Model Tier2 And Remote Deploy Optimization Plan"
doc_type: iteration-plan
status: completed
updated: 2026-04-29
source: ai
---

# Iteration 0349-data-model-tier2-and-remote-deploy-optimization Plan

## Goal

把 0348 冻结的数据模型合同转成可执行的 Tier 2 实现路线，明确 Data.* 在项目中的适用/不适用场景；同时审查 cloud deploy 的源码同步、构建和 rollout 路径，做最小安全优化，并完成一次远端部署验证。

## Scope

- In scope:
  - 盘点现有 Data.* 实现与 0348 Feishu-aligned 目标合同的差异。
  - 设计 Data.* 作为 Tier 2 模板/程序模型实现的迁移路线。
  - 盘点项目中适合使用 Data.* 的业务面，以及不应使用 Data.* 的边界。
  - 审查远端部署路径：source sync、Docker build context、full deploy、app fast deploy、本地 tar fallback。
  - 做低风险部署优化：减少 Docker build context 和 archive fallback 同步范围。
  - 同步当前项目到远端并执行一次远端 app deploy 验证。
  - 每个阶段用 sub-agent code review，修复到通过后再进入下一阶段。
- Out of scope:
  - 不在本 iteration 完整迁移所有 Data.* 模板实现。
  - 不引入镜像仓库或 CI/CD 平台。
  - 不修改 rke2/containerd/docker/systemd/CNI/firewall/networking 等远端基础设施。
  - 不改变 Matrix/MBR/MQTT 业务语义。

## Invariants / Constraints

- `CLAUDE.md` 最高优先级，远端目标是 `dongyudigital.com` 上的 rke2，不允许触碰禁止运维项。
- Data.* 行为必须是 Tier 2 model definition/template/program/worker 能力；Tier 1 runtime 只允许做解释器语义或 bugfix。
- 正式业务 pin payload 必须是 Temporary ModelTable Message：`format is ModelTable-like; persistence is explicit materialization`。
- Data.* 新目标合同来自 `docs/ssot/feishu_data_model_contract_v1.md`。
- UI 是 ModelTable 投影，不是 truth source；正式 UI 业务事件仍进入 Model 0 `pin.bus.in`。
- 远端 mutating deploy 之前必须经过 rke2 preflight/source integrity gate。

## Success Criteria

- 0349 迭代文档登记完整，plan/resolution/runlog 无 TODO。
- Data.* Tier 2 实现路线和适用场景清单落盘，并明确后续 implementation iteration 的拆分建议。
- 远端部署同步/构建审计落盘，并说明哪些文件需要同步、哪些文件不需要进入 Docker build context。
- 最小部署优化有自动化检查覆盖。
- 当前项目已同步到远端并完成一次远端部署验证。
- 每个阶段 sub-agent review 最终为 `APPROVED`。

## Inputs

- Created at: 2026-04-29
- Iteration ID: 0349-data-model-tier2-and-remote-deploy-optimization
- Branch: `dev_0349-data-model-tier2-and-remote-deploy-optimization`
