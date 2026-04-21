---
title: "Iteration 0200a-persisted-asset-loader-freeze Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0200a-persisted-asset-loader-freeze
id: 0200a-persisted-asset-loader-freeze
phase: phase1
---

# Iteration 0200a-persisted-asset-loader-freeze Plan

## Goal

- 冻结一套统一的“持久化目录 -> loader -> runtime”规约，作为后续本地 patch 外挂化与远端 `0200` 恢复执行的前置条件。
- 这轮不做远端部署，也不直接改 cloud deploy；重点是把以下边界写清楚：
  - authoritative asset 从哪里读
  - 如何决定加载顺序
  - 哪些 state 可回写，哪些是 volatile
  - worker / ui-server / frontend thin shell 的职责边界

## Background

- 当前仓库虽然已经完成 `0196/0197/0198` 的 patch-first worker rebase，但 patch 仍然是 bake 进镜像：
  - worker 侧 patch 目录通过 Dockerfile COPY 进入镜像
  - `ui-server` 读的是镜像内磁盘上的 patch
  - local mode 的 [demo_modeltable.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/demo_modeltable.js) 仍静态 import 多个 JSON patch
- 这导致一个关键缺口：
  - 改 Tier 2 资产仍然需要 `docker build -> import -> rollout`
  - Tier 1 / Tier 2 分层只在代码组织上成立，未在部署层面成立
- 用户已明确提出新的架构前提：
  - 所有模型应从持久化目录进入系统
  - 初始化时应有确定性加载顺序
  - 后续 Tier 2 变更不应再默认走重建镜像管线
- 同时，与 Claude 对齐后的新共识是：
  - worker patch 外挂化应优先于前端 bundle 动态化
  - component registry 不应再被视为 build-time 常量，应按 Tier 2 / 类 Tier 2 资产来设计动态加载路径
  - `0200` 应暂停，待本地 loader 规约和本地外挂化路径明确后再恢复

## Scope

- In scope:
  - 审计当前 4 条资产进入系统的路径：
    - `ui-server` remote mode
    - `mbr-worker`
    - `remote-worker`
    - `ui-side-worker`
    - `demo_modeltable` local mode
  - 冻结统一 loader 规约：
    - 持久化目录结构
    - manifest 格式
    - phase / layer 顺序
    - fallback 规则
    - writeback / volatile 边界
  - 明确 component registry 的目标归属与动态加载路径
  - 产出后续实施拆分建议：
    - 本地 patch 外挂化
    - 本地验证
    - 远端接线恢复
- Out of scope:
  - 不直接实现 patch 外挂化
  - 不改 Dockerfile / manifest / deploy 脚本
  - 不恢复 `0200` 执行
  - 不做前端 thin shell 的完整实现

## Invariants / Constraints

- 这轮是架构冻结迭代，不得混入 runtime/worker/deploy 行为改动。
- 必须遵守现有顶层规约：
  - fill-table-first
  - fail fast on non-conformance
  - 不允许用 fallback 掩盖规约路径缺失
- 加载顺序不能只靠 `model_id` 排序；必须有显式 manifest 作为主规则，`model_id` 排序只能作为 deterministic fallback。
- authoritative asset 与 runtime volatile state 必须分离：
  - authoritative asset 来自持久化目录
  - volatile state 不应默认回写到同一目录

## Success Criteria

- 形成一份清晰的差距与目标文档，至少明确：
  1. 当前 5 条资产加载路径的事实矩阵
  2. 统一持久化目录结构
  3. manifest schema
  4. 加载阶段与顺序规则
  5. writeback / volatile state 分类
  6. component registry 的降级/动态加载策略
  7. `0200b` 本地外挂化实施范围
  8. `0200` 何时可从 On Hold 恢复的恢复条件
- `0200` 在 `docs/ITERATIONS.md` 中被正式标记为 `On Hold`，且原因在 `0200` runlog 中有事实记录。
- `0200a` 的计划和方案能直接指导下一轮实现，不需要再重做大范围架构讨论。

## Risks & Mitigations

- Risk:
  - 讨论范围膨胀，把 worker patch 外挂化、frontend thin shell、component registry 动态化一次全塞进一个迭代。
  - Mitigation:
    - 本轮只冻结规则和拆分边界，不做实现。
- Risk:
  - 只按 `model_id` 排序设计 loader，忽略真实依赖。
  - Mitigation:
    - 显式 manifest 主导，排序只做兜底。
- Risk:
  - 把所有 state 都误判为 authoritative asset，导致后续回写语义混乱。
  - Mitigation:
    - 在计划里显式区分：
      - asset
      - bootstrap-generated
      - runtime volatile

## Alternatives

### A. 推荐：先冻结统一 loader 规约，再做本地外挂化实现

- 优点：
  - 能在不混入实现细节的前提下，把边界一次讲清
  - 后续 `0200b/0200` 的 scope 更稳定
- 缺点：
  - 比直接动代码多一个 planning iteration

### B. 直接实现 worker patch 外挂化，再边做边定规则

- 优点：
  - 速度更快
- 缺点：
  - 容易把目录结构、manifest、writeback 语义做成隐式约定
  - 后续 `ui-server` / frontend 路径容易返工

当前推荐：A。

## Inputs

- Created at: 2026-03-20
- Iteration ID: 0200a-persisted-asset-loader-freeze
- Trigger:
  - 用户已明确确认：
    - `0200` 先暂停
    - 优先处理“所有模型从持久化目录进入系统”的本地架构前提
  - 与 Claude 对齐后的新增共识：
    - worker patch 外挂化优先
    - component registry 也应纳入动态资产路径
    - frontend 最终应收窄为 thin shell
