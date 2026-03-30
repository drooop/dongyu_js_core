---
title: "Iteration 0183-cloud-deploy-remote-build-split Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0183-cloud-deploy-remote-build-split
id: 0183-cloud-deploy-remote-build-split
phase: phase1
---

# Iteration 0183-cloud-deploy-remote-build-split Resolution

## Execution Strategy

本轮仍停留在 Phase 1 docs-only。先把设计方案收口成一份单独设计稿，再把未来实施拆成 4 个可验证步骤：远端源码同步与 revision gate、`full deploy` 抽离、`app fast deploy` 抽离、ops 文档与回归脚本同步。当前不改脚本实现。

## Step 1

- Scope:
  - 登记 `0183`
  - 写清目标、边界、成功标准
  - 在 runlog 中记录 Review Gate = Approved
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0183-cloud-deploy-remote-build-split/plan.md`
  - `docs/iterations/0183-cloud-deploy-remote-build-split/resolution.md`
  - `docs/iterations/0183-cloud-deploy-remote-build-split/runlog.md`
- Verification:
  - `rg -n "0183-cloud-deploy-remote-build-split" docs/ITERATIONS.md docs/iterations/0183-cloud-deploy-remote-build-split/*.md`
- Acceptance:
  - `0183` 已登记为 `Approved`
  - iteration 文档中不含 `[TODO]`
- Rollback:
  - 删除 `0183` 条目与 `docs/iterations/0183-cloud-deploy-remote-build-split/`

## Step 2

- Scope:
  - 产出正式设计文档
  - 对比并收口方案：`remote build`、`registry pull`、`remote tar fallback`
  - 固化 `full deploy` / `app fast deploy` 两类职责边界
- Files:
  - `docs/plans/2026-03-11-cloud-deploy-remote-build-split-design.md`
- Verification:
  - `rg -n "Approach|Recommended|full deploy|app fast deploy|remote build|registry pull" docs/plans/2026-03-11-cloud-deploy-remote-build-split-design.md`
- Acceptance:
  - 设计稿包含方案比较、推荐结论、风险、验证与 rollback 设计
  - 明确说明当前无镜像仓库，因此 remote build 为近期 canonical path
- Rollback:
  - 删除设计稿

## Step 3

- Scope:
  - 为后续实现写出可执行 resolution
  - 把脚本拆分、验证命令、回滚策略和 living docs 更新目标写清
- Files:
  - `docs/iterations/0183-cloud-deploy-remote-build-split/resolution.md`
- Verification:
  - `sed -n '1,260p' docs/iterations/0183-cloud-deploy-remote-build-split/resolution.md`
- Acceptance:
  - resolution 清晰列出未来实现至少 4 个 step
  - 每个 step 都有 files / verification / acceptance / rollback
- Rollback:
  - 回退本轮对 resolution 的修改

## Step 4

- Scope:
  - 运行 docs audit
  - 在 runlog 中记录本轮事实与后续实施入口
- Files:
  - `docs/iterations/0183-cloud-deploy-remote-build-split/runlog.md`
- Verification:
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Acceptance:
  - docs audit PASS
  - runlog 只记录真实命令、结果与审核事实
- Rollback:
  - 回退 runlog 本轮追加记录

## Future Implementation Targets

- `scripts/ops/deploy_cloud.sh`
- `scripts/ops/deploy_cloud_ui_server_from_local.sh`
- `scripts/ops/remote_preflight_guard.sh`
- `scripts/ops/README.md`
- 可能新增：
  - `scripts/ops/deploy_cloud_full.sh`
  - `scripts/ops/deploy_cloud_app.sh`
  - `scripts/ops/sync_cloud_source.sh`
  - 对应 `scripts/tests/test_0183_*.mjs` 或 shell contract tests

## Notes

- Generated at: 2026-03-11
- This iteration is docs-only until implementation is separately executed under the approved plan.
