---
title: "0177 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0177-worker-boundary-remediation
id: 0177-worker-boundary-remediation
phase: phase1
---

# 0177 — Resolution (HOW)

## Execution Strategy

- 先以测试锁定 `runtime mode`、trusted bootstrap 直写、旁路封堵和 MBR 白名单合同，再用最小实现使这些测试转绿。
- 运行模式作为跨进程统一边界：`ui-server` 启动后停在 `edit`，headless worker bootstrap 完成后自动切到 `running`。
- 所有 public/runtime mutation 入口都必须服从运行模式与 sanctioned-path 约束，不保留兼容旁路。
- 文档与验证资产同步收口：SSOT/user-guide 更新、0177 logs 记录 Feishu 规约映射与实测结果。

## Step 1

- Scope:
  - 建立 `0177` iteration 合同与审计日志骨架，并把 Feishu `MQTT标签` / `Matrix标签` 的关键约束映射到本地实施目标。
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0177-worker-boundary-remediation/plan.md`
  - `docs/iterations/0177-worker-boundary-remediation/resolution.md`
  - `docs/iterations/0177-worker-boundary-remediation/runlog.md`
  - `docs/logs/0177-worker-boundary-remediation/*`
- Verification:
  - `rg -n "0177-worker-boundary-remediation|boot -> edit -> running|trusted bootstrap|mqtt.local.ip|matrix.server" docs/ITERATIONS.md docs/iterations/0177-worker-boundary-remediation docs/logs/0177-worker-boundary-remediation`
- Acceptance:
  - `0177` 已登记、具备 Review Gate 记录、且 Feishu 新规约约束已被写入本地执行文档。
- Rollback:
  - 删除 `0177` iteration 与对应 logs 目录，并回退索引登记。

## Step 2

- Scope:
  - 先写失败测试，锁定 `runtime mode`、direct patch 禁用、`LocalBusAdapter` 旁路禁用、`submt` 映射位约束、MBR action 白名单等合同。
- Files:
  - `scripts/tests/test_0177_runtime_mode_contract.mjs`
  - `scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
  - `scripts/tests/test_0177_submt_mapping_contract.mjs`
  - `scripts/tests/test_0177_mbr_bridge_contract.mjs`
  - `docs/iterations/0177-worker-boundary-remediation/runlog.md`
- Verification:
  - `node scripts/tests/test_0177_runtime_mode_contract.mjs`
  - `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
  - `node scripts/tests/test_0177_submt_mapping_contract.mjs`
  - `node scripts/tests/test_0177_mbr_bridge_contract.mjs`
- Acceptance:
  - 新测试先红，且失败原因与目标合同一致，不是语法或环境错误。
- Rollback:
  - 删除本轮新增合同测试。

## Step 3

- Scope:
  - 实现运行模式、trusted bootstrap loader、generic patch/建模旁路封堵，以及 MBR/worker 启动门控。
- Files:
  - `packages/worker-base/src/runtime.mjs`
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/bootstrap_config.mjs`
  - `packages/worker-base/src/matrix_live.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - `scripts/run_worker_v0.mjs`
  - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
  - 其他为满足合同所必需的最小入口文件
- Verification:
  - 上述 `0177` 新测试全部 PASS
  - `node scripts/tests/test_0175_matrix_patch_bootstrap_contract.mjs`
  - `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
  - `node scripts/tests/test_0167_ui_server_matrix_token_auth.mjs`
- Acceptance:
  - `boot/edit/running` 边界生效，generic runtime/model mutation 旁路被拒绝，旧 fallback 不再参与产品路径。
- Rollback:
  - 回退本轮实现文件到 `0177` 前状态，并恢复旧入口行为。

## Step 4

- Scope:
  - 复验本地 OrbStack pod 部署链路，确认颜色生成器 roundtrip 在新规约下仍通过；同时记录 0176 反例现已被拒绝。
- Files:
  - `docs/logs/0177-worker-boundary-remediation/*.md`
  - `docs/iterations/0177-worker-boundary-remediation/runlog.md`
  - `scripts/ops/verify_model100_submit_roundtrip.sh`
  - 必要的最小测试或验收辅助
- Verification:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`
  - 代表性拒绝验证：`/api/modeltable/patch`、`submodel_create`、`submt` hosting Cell 非引脚标签、MBR generic CRUD`
- Acceptance:
  - 本地 pod baseline 与颜色生成器 roundtrip PASS；0176 代表性非法 case 明确 reject。
- Rollback:
  - 删除本轮日志文档；如链路回归失败，回退 `0177` 实现并恢复 `0175` 已知可运行状态。

## Step 5

- Scope:
  - 更新 SSOT / user-guide，收口 runlog 与 commit 证据，完成 `0177` 文档审查。
- Files:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/ui_to_matrix_event_flow.md`
  - `docs/ssot/host_ctx_api.md`
  - `docs/user-guide/ui_event_matrix_mqtt_configuration.md`
  - `docs/iterations/0177-worker-boundary-remediation/runlog.md`
- Verification:
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
  - `rg -n "runtime_mode|trusted bootstrap|Model 0 \\(0,0,0\\)|mqtt\\.local|matrix\\." docs/ssot docs/user-guide`
- Acceptance:
  - SSOT/user-guide 已与实现和 Feishu 新规约对齐；runlog 中有完整 PASS/FAIL 与 commit 证据。
- Rollback:
  - 回退本轮文档改动，保持 `0177` 之前文档状态。

## Notes

- Review Gate:
  - Decision: Approved
  - Basis: 用户已确认采用“仅 trusted bootstrap 直写 + 全局运行模式 + 单向激活 + 不做兼容”，并明确要求开始实施。
