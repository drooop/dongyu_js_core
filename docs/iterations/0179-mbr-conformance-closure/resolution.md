---
title: "0179 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0179-mbr-conformance-closure
id: 0179-mbr-conformance-closure
phase: phase1
---

# 0179 — Resolution (HOW)

## Execution Strategy

- 先以失败测试锁定“哪些旧合同必须退役、哪些新合同必须补齐”，再用最小代码/测试改动完成合规收口。
- 对 `MBR` 的判断优先看当前 product path，不以历史验证器为准；如果测试口径已过时，直接修正测试和 supporting docs。
- 保持实现边界克制：不恢复 legacy bridge，只证明并加固现行 `Model 100 records-only` / `snapshot_delta` 路径。

## Step 1

- Scope:
  - 固化 `0179` iteration 文档与 Review Gate，并把本轮 MBR 审计结论落入 runlog baseline。
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0179-mbr-conformance-closure/plan.md`
  - `docs/iterations/0179-mbr-conformance-closure/resolution.md`
  - `docs/iterations/0179-mbr-conformance-closure/runlog.md`
- Verification:
  - `rg -n "0179-mbr-conformance-closure|legacy generic CRUD|runtime_mode=edit|Model 0" docs/ITERATIONS.md docs/iterations/0179-mbr-conformance-closure`
- Acceptance:
  - `0179` 已登记，且目标/边界/验证范围可被独立读者理解。
- Rollback:
  - 删除 `0179` iteration 文档与索引登记。

## Step 2

- Scope:
  - 先写或修正合同测试，锁定现行 `MBR` gate：
    - 只允许标准业务事件桥接
    - `edit` 阶段不产生业务副作用
    - bootstrap 只认 Model 0
    - legacy verifier 不再验证被废弃行为
- Files:
  - `scripts/tests/test_0179_mbr_runtime_mode_gate.mjs`
  - `scripts/tests/test_0144_mbr_compat.mjs`
  - `scripts/validate_mbr_patch_v0.mjs`
- Verification:
  - `node scripts/tests/test_0144_mbr_compat.mjs`
  - `node scripts/tests/test_0179_mbr_runtime_mode_gate.mjs`
  - `node scripts/validate_mbr_patch_v0.mjs`
- Acceptance:
  - 新测试先红，且失败原因准确反映当前实现与现规约之间的缺口。
- Rollback:
  - 删除本轮新增测试；恢复旧验证器文件。

## Step 3

- Scope:
  - 收口 `MBR` 实现与 patch 数据：
    - 移除或停用误导性的旧 transport config labels
    - 必要时调整 `run_worker_v0.mjs` / `mbr_role_v0.json` / supporting code 以满足现规约和新测试
- Files:
  - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
  - `scripts/run_worker_v0.mjs`
  - 如有必要的最小 supporting file
- Verification:
  - `node scripts/tests/test_0175_matrix_patch_bootstrap_contract.mjs`
  - `node scripts/tests/test_0177_mbr_bridge_contract.mjs`
  - `node scripts/tests/test_0179_mbr_runtime_mode_gate.mjs`
  - `node scripts/tests/test_0144_mbr_compat.mjs`
  - `node scripts/validate_mbr_patch_v0.mjs`
- Acceptance:
  - `MBR` 实现、bootstrap 来源和 runtime_mode gating 与现规约一致，且不恢复旧桥接。
- Rollback:
  - 回退 `MBR` patch / worker bootstrap 改动。

## Step 4

- Scope:
  - 更新 SSOT / runlog，明确当前 canonical MBR gate，并记录已废弃的 legacy verifier expectations。
- Files:
  - `docs/ssot/ui_to_matrix_event_flow.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/iterations/0179-mbr-conformance-closure/runlog.md`
- Verification:
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
  - `rg -n "MBR|runtime_mode=edit|legacy|records-only|snapshot_delta" docs/ssot docs/iterations/0179-mbr-conformance-closure`
- Acceptance:
  - 文档能解释：哪些测试是当前 gate，哪些旧预期已退役。
- Rollback:
  - 回退本轮文档改动。

## Notes

- Review Gate:
  - Decision: Approved
  - Basis: 用户要求继续推进 `MBR` 合规确认与收口，已明确接受“先修正验证口径，再做最小实现收口”的方向。
