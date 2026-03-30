---
title: "0175 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0175-local-color-generator-smoke
id: 0175-local-color-generator-smoke
phase: phase1
---

# 0175 — Resolution (HOW)

## Execution Strategy

- 先把 `0173` 合入 `dev` 并从新基线拉出 `dev_0175-local-color-generator-smoke`，再登记 `0175` iteration。先按用户新边界验证 OrbStack pod 部署路径（优先 `http://localhost:30900`），再仅对 baseline / deploy 脚本做最小修复，使“假健康 baseline”能自修复。若业务链路仍失败，则按 FAIL 记录阻塞，不继续扩大到 runtime 语义修复。

## Step 1

- Scope:
- 合并 `0173` 到 `dev`，创建 `0175` 分支并登记 iteration。
- Files:
- `docs/ITERATIONS.md`
- `docs/iterations/0175-local-color-generator-smoke/plan.md`
- `docs/iterations/0175-local-color-generator-smoke/resolution.md`
- `docs/iterations/0175-local-color-generator-smoke/runlog.md`
- Verification:
- `rg -n "0175-local-color-generator-smoke|颜色生成器" docs/ITERATIONS.md docs/iterations/0175-local-color-generator-smoke`
- Acceptance:
- `dev_0175-local-color-generator-smoke` 已建立，且 `0175` 索引/文档齐全。
- Rollback:
- 回退 `0175` iteration 记录并删除分支。

## Step 2

- Scope:
- 执行本地颜色生成器一键链路验证并记录结果。
- Files:
- `docs/iterations/0175-local-color-generator-smoke/runlog.md`
- Verification:
- `bash scripts/ops/run_model100_submit_roundtrip_local.sh --port 9011 --stop-after`
- Acceptance:
- 命令得到明确 PASS/FAIL，且 runlog 记录关键输出与结论。
- Rollback:
- 无代码变更；仅回退 runlog 中本轮记录。

## Step 3

- Scope:
- 修复本地 baseline / deploy 脚本的配置性缺口，并复验 pod 部署路径。
- Files:
- `scripts/ops/check_runtime_baseline.sh`
- `scripts/ops/ensure_runtime_baseline.sh`
- `scripts/ops/run_model100_submit_roundtrip_local.sh`
- `scripts/ops/_deploy_common.sh`
- `scripts/ops/deploy_local.sh`
- `scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
- `docs/iterations/0175-local-color-generator-smoke/runlog.md`
- Verification:
- `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
- `bash scripts/ops/check_runtime_baseline.sh`
- `bash scripts/ops/ensure_runtime_baseline.sh`
- `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://localhost:30900`
- Acceptance:
- baseline placeholder/自修复链路已修通；若业务链路仍失败，必须明确新的阻塞点。
- Rollback:
- 回退上述脚本与测试文件。

## Notes

- Review Gate:
  - Decision: Approved
  - Basis: 用户明确要求启动这一轮本地验证。
