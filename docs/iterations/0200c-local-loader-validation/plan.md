---
title: "Iteration 0200c-local-loader-validation Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0200c-local-loader-validation
id: 0200c-local-loader-validation
phase: phase1
---

# Iteration 0200c-local-loader-validation Plan

## Goal

- 在本地完整验证 `0200b` 新引入的 persisted asset loader / hostPath externalization 路径，确认它不仅“能工作”，而且能作为恢复 `0200` 的可靠前置基线。

## Background

- `0200a` 已冻结：
  - authoritative asset root
  - manifest + phase
  - writeback / volatile 分类
- `0200b` 已完成本地外挂化实现：
  - 4 个角色从 `/app/persisted-assets` 读取 authoritative assets
  - `deploy_local.sh` 支持 `SKIP_IMAGE_BUILD=1`
  - `deploy_local.sh` 支持复用 `local.generated.env`，避免 patch-only 路径重复 Matrix bootstrap
  - `ui-server` 已加入 sqlite restore filter，避免负数模型和 bootstrap-generated `model 0` keys 覆盖外挂 authority
- 但 `0200` 仍处于 `On Hold`，因为还需要一轮更系统的本地验证，证明这套新 loader 在多轮 deploy / rollback / patch-only update 下是稳定的。

## Scope

- In scope:
  - 以 `0200b` 当前实现为对象，执行本地 loader 验证
  - 覆盖 3 类场景：
    - clean deploy
    - patch-only update
    - rollback / restore
  - 覆盖 3 类证据：
    - 静态 contract / manifest 证据
    - 脚本级 smoke / roundtrip
    - 浏览器页面证据
  - 给 `0200` 是否恢复执行做出明确判定
- Out of scope:
  - 不新增实现
  - 不修改远端 deploy
  - 不开始 `0200`

## Invariants / Constraints

- 本轮是 validation iteration，不得借机再做新实现。
- 所有验证必须基于真实本地链路，不允许 mock。
- 如发现问题，必须明确记录为 blocker，而不是边修边算通过。
- `0200` 的恢复与否，必须由本轮证据驱动，而不是主观判断。

## Success Criteria

- clean deploy 路径 PASS：
  - `bash scripts/ops/deploy_local.sh`
- patch-only 路径 PASS：
  - `SKIP_IMAGE_BUILD=1 bash scripts/ops/deploy_local.sh`
  - 证明 authoritative patch 改动无需重建镜像即可生效
- rollback / restore 路径 PASS：
  - 临时 patch 改动后能恢复到原状态
- 关键 smoke PASS：
  - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`
  - `bash scripts/ops/verify_ui_side_worker_snapshot_delta.sh`
- 浏览器证据完整：
  - 至少 2 张截图
  - 至少 1 组 “patch-only 变更前后” 对照
- 最终给出明确结论：
  - `0200` 可恢复执行
  - 或仍需继续补本地链路

## Risks & Mitigations

- Risk:
  - patch-only 路径仍潜藏依赖旧 bootstrap/state。
  - Mitigation:
    - 明确覆盖 clean deploy 与 patch-only 两条路径，不只验证其中一条。
- Risk:
  - 浏览器看到的只是缓存结果，不是真实 loader 效果。
  - Mitigation:
    - 结合 `/snapshot`、截图、cache-bust 页面访问交叉验证。
- Risk:
  - 本地验证 PASS，但原因只是当前数据巧合，没有覆盖 rollback。
  - Mitigation:
    - 强制包含 restore 场景。

## Alternatives

### A. 推荐：单独做一轮本地 loader validation，再恢复 `0200`

- 优点：
  - `0200` 恢复前有明确本地基线
  - 能把实现和验证分离，避免边改边验
- 缺点：
  - 比直接恢复 `0200` 多一轮

### B. 直接恢复 `0200`

- 优点：
  - 更快
- 缺点：
  - 本地 loader 路径还没经过系统验证
  - 风险直接带进远端

当前推荐：A。

## Inputs

- Created at: 2026-03-20
- Iteration ID: 0200c-local-loader-validation
- Trigger:
  - 用户要求直接开启 `0200c`
  - `0200b` 已完成，下一步需要验证其稳定性并为恢复 `0200` 提供依据
