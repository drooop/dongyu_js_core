---
title: "0294 — foundation-b-runtime-migration Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-06
source: ai
iteration_id: 0294-foundation-b-runtime-migration
id: 0294-foundation-b-runtime-migration
phase: phase1
---

# 0294 — foundation-b-runtime-migration Runlog

## Environment

- Date: `2026-04-06`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Branch: `dev_0294-foundation-b-runtime-migration`
- Base: `dev`

## Planning Record

### Record 1

- Inputs reviewed:
  - [[docs/iterations/0292-foundation-pin-payload-contract-freeze/plan]]
  - [[docs/ssot/temporary_modeltable_payload_v1]]
  - [[docs/ssot/program_model_pin_and_payload_contract_vnext]]
  - [[docs/plans/2026-04-06-pin-payload-impact-inventory-and-migration]]
- Locked conclusions:
  - 基础 B 只做：
    - runtime 合同切换
    - patch 迁移
    - host / adapter 迁移
    - validator / contract test 迁移
    - 已规划业务线的最小复审
  - 不做：
    - `MBR` 重构
    - bus 拓扑重排
    - 业务能力直接实现

## Docs Updated

- [x] `docs/iterations/0292-foundation-pin-payload-contract-freeze/plan.md` reviewed
- [x] `docs/ssot/temporary_modeltable_payload_v1.md` reviewed
- [x] `docs/ssot/program_model_pin_and_payload_contract_vnext.md` reviewed
- [x] `docs/plans/2026-04-06-pin-payload-impact-inventory-and-migration.md` reviewed
- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed

## Phase 3 Records

### 2026-04-06 — Runtime / Patch Migration

**Implemented**
- runtime:
  - root `pin.in` / `pin.out` 收敛为正式模型边界 pin
  - `mqttIncoming` 新增 `pin_payload_v1` 支持
  - child / parent / self relay 主路径统一写 `pin.in` / `pin.out`
  - runtime helper `owner_materialize` 允许直接消费临时模型表数组
- core patches:
  - `system_models.json` 中 `mbr_route_100` / `mbr_route_1010` 改为 `submit + pin_payload`
  - `mbr_role_v0.json` 上行改发 `pin_payload`，下行改回写 `pin_payload`
  - remote-worker `10_model100.json` / `11_model1010.json` 改为：
    - `submit` / `result`
    - root D0 function
    - topic `.../submit` / `.../result`
  - `test_model_100_ui.json` / `workspace_positive_models.json` 的远端 submit 主路径切到：
    - root `pin.out`
    - Matrix transport wrapper `version=v1,type=pin_payload`
- host / adapter:
  - `server.mjs` 支持 `pin_payload` 下行 materialization
  - `processEventsSnapshot` 的 model0 egress 检测不再依赖 `source_model_id` 塞在 pin 数据里
  - `sendGenericOwnerRequestsViaSourcePin` / `home` source pin 改为 `pin.in/out`
- worker bootstrap:
  - `run_worker_v0.mjs` 接受 Matrix `v1 pin_payload`
  - MQTT inbox 接受 `pin_payload`，订阅结果 topic 改为 `/result`

### Deterministic tests

- `node scripts/tests/test_0294_runtime_pin_contract.mjs` → PASS
- `node scripts/tests/test_model_in_out.mjs` → PASS
- `node scripts/tests/test_submodel_connect.mjs` → PASS
- `node scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs` → PASS
- `node scripts/tests/test_0143_e2e.mjs` → PASS
- `node scripts/tests/test_0144_remote_worker.mjs` → PASS
- `node scripts/tests/test_0144_mbr_compat.mjs` → PASS
- `node scripts/tests/test_0177_mbr_bridge_contract.mjs` → PASS
- `node scripts/tests/test_0179_mbr_route_contract.mjs` → PASS
- `node scripts/tests/test_0182_model100_submit_chain_contract.mjs` → PASS
- `node scripts/tests/test_0184_mbr_direct_event_bridge_contract.mjs` → PASS
- `node scripts/tests/test_0184_remote_worker_wildcard_event_contract.mjs` → PASS
- `node scripts/tests/test_0196_mbr_triggerless_contract.mjs` → PASS
- `node scripts/tests/test_0197_remote_worker_tier2_contract.mjs` → PASS
- `node scripts/tests/test_0270_workspace_ui_filltable_remote_mode_contract.mjs` → PASS
- `node scripts/tests/test_0270_workspace_ui_filltable_local_mode_contract.mjs` → PASS
- `node scripts/validate_mbr_patch_v0.mjs` → PASS
- `node scripts/validate_model100_records_e2e_v0.mjs` → PASS

### Local deploy / browser verification

- `bash scripts/ops/check_runtime_baseline.sh` → PASS
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` → PASS
- `bash scripts/ops/check_runtime_baseline.sh` → PASS

**Browser facts**
- 颜色生成器：
  - Workspace 中点击 `Generate Color`
  - 颜色值从 `#352c70` 变为 `#cb5bd0`
  - 状态恢复为 `processed`
- `0270 Fill-Table Workspace UI`：
  - 打开后将输入改为 `0294 browser verify`
  - 点击 `Confirm`
  - 结果色值从 `#817a00` 变为 `#1d7c5b`
- `Static`：
  - `选择文件` button 可弹出 file chooser
  - 上传 `/Users/drop/codebase/cowork/dongyuapp_elysia_based/docs/user-guide/workspace_ui_filltable_example_visualized.html`
  - 页面显示 `uploaded: it0294-static`
  - `/p/it0294-static/` 可访问并返回文档页面

### Step 5 Review

- `0283-0291` 已按影响面复查
- 未发现必须立即重写的旧 pin/action 合同表述
- 本轮仅在 `0294` 自身 runlog 中记录复审事实，不扩大 docs diff

### Review 1 — AI Self-Verification

- Iteration ID: `0294-foundation-b-runtime-migration`
- Review Date: `2026-04-06`
- Review Type: `AI-assisted`
- Review Index: `1`
- Decision: **PASS**
- Notes:
  - 基础 B 范围守住在 runtime / patch / host / validator 迁移
  - 没有顺手扩成 `MBR` 拓扑重构或业务能力开发
