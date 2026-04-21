---
title: "Iteration 0260-model100-submit-roundtrip-hardening Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0260-model100-submit-roundtrip-hardening
id: 0260-model100-submit-roundtrip-hardening
phase: phase3
---

# Iteration 0260-model100-submit-roundtrip-hardening Runlog

## Environment

- Date: 2026-03-29
- Branch: `dev`
- Runtime: local live deploy (`30900`) + local source mode (`5173?mode=local`)

## Review Gate Record

- Iteration ID: `0260-model100-submit-roundtrip-hardening`
- Review Date: `2026-03-29`
- Review Type: AI-assisted
- Review Index: `1`
- Decision: Approved
- Notes:
  - 当前问题已明确是旧 Model 100 submit 链与 hard-cut 主线冲突，不是单纯页面 bug。

## Execution Records

### Step 1

- Command:
  - planning only
- Key output:
  - 0260 已登记到 `docs/ITERATIONS.md`
  - plan / resolution 已补齐
- Result: PASS
- Commit:
  - n/a

## Resume Note

- Resume Date: `2026-03-30`
- Current branch: `dev_0260-model100-submit-roundtrip-hardening`
- Current worktree facts:
  - modified: `deploy/sys-v1ns/remote-worker/patches/10_model100.json`
  - modified: `packages/ui-model-demo-server/server.mjs`
  - modified: `packages/worker-base/system-models/test_model_100_full.json`
  - modified: `scripts/tests/test_0197_remote_worker_tier2_contract.mjs`
  - modified: `scripts/validate_model100_records_e2e_v0.mjs`
  - untracked: `scripts/tests/test_0260_model100_submit_authoritative_routing_contract.mjs`
- Status decision:
  - `0260` 已进入 Phase 3 并在当前 worktree 中断，`docs/ITERATIONS.md` 同步为 `In Progress`。
  - 后续续做应直接承接 focused verification 结果，不要重新开新 iteration。

## Resume Probe

- Date: `2026-03-30`
- Commands:
  - `node scripts/tests/test_0260_model100_submit_authoritative_routing_contract.mjs`
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `node scripts/tests/test_0197_remote_worker_tier2_contract.mjs`
  - `node scripts/validate_model100_records_e2e_v0.mjs`
- Key output:
  - `test_0260_model100_submit_authoritative_routing_contract`: `3 passed, 0 failed`
  - `test_0182_model100_submit_chain_contract`: `PASS`
  - `test_0197_remote_worker_tier2_contract`: `2 passed, 0 failed`
  - `validate_model100_records_e2e_v0`: `FAIL: published payload must be mt.v0`
- Resume conclusion:
  - 当前 worktree 下，authoritative routing / stale inflight / Tier2 patch shape 不再是首要红灯。
  - 下一步应优先对齐 Step 5 的 return-path contract，围绕 `published payload must be mt.v0` 继续排查。

### Step 2 / Step 3 Confirmation

- Date: `2026-03-30`
- Commands:
  - `node scripts/tests/test_0260_model100_submit_authoritative_routing_contract.mjs`
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
- Key output:
  - `test_0260_model100_submit_authoritative_routing_contract`: `3 passed, 0 failed`
  - `test_0182_model100_submit_chain_contract`: `PASS`
- Result:
  - PASS
  - `submit` authoritative routing 未再误入 home dispatch。
  - stale `submit_inflight` recovery 已按预期工作。

### Step 4 / Step 5 Repair Pass

- Date: `2026-03-30`
- Commands:
  - `node scripts/validate_model100_records_e2e_v0.mjs`
  - inline Node probe: materialize MBR `mbr_mgmt_to_mqtt` publish result and remote-worker cell state
  - `node scripts/tests/test_0144_remote_worker.mjs`
  - `node scripts/tests/test_0197_remote_worker_tier2_contract.mjs`
  - `node scripts/tests/test_0260_model100_submit_authoritative_routing_contract.mjs`
- Root-cause facts:
  - MBR 当前 canonical bridge 在 `/100/event` 上发布的是 direct `ui_event` (`version='v0'`)，不是 `mt.v0` records patch。
  - `scripts/validate_model100_records_e2e_v0.mjs` 仍按旧口径断言 `published payload must be mt.v0`，且 worker 侧还在加载过时的 `packages/worker-base/system-models/test_model_100_full.json`。
  - 改成真实 remote-worker patch 后，`Model 100 / Cell(1,0,0)` 暴露 `__error_on_model100_event_in = direct_access_cross_model_forbidden`。
  - 根因是 `deploy/sys-v1ns/remote-worker/patches/10_model100.json` 中 `on_model100_event_in` 在 scoped cell 内跨模型读取 `Model 0 / mqtt_topic_base`，导致函数在返回 `mt.v0` patch 前中断。
- File changes:
  - `scripts/validate_model100_records_e2e_v0.mjs`
    - 改为断言 `/100/event` 发布 direct `ui_event`
    - worker 侧切到 `deploy/sys-v1ns/remote-worker/patches/`
  - `scripts/tests/test_0144_remote_worker.mjs`
    - 为 full-chain 补 RED 断言：不得残留 `__error_on_model100_event_in`，且必须产出 `mt.v0` patch
  - `deploy/sys-v1ns/remote-worker/patches/10_model100.json`
    - 新增 `patch_out_topic`
    - `on_model100_event_in` 改为同模型读取 `patch_out_topic`，不再跨模型读取 `Model 0.mqtt_topic_base`
  - `scripts/tests/test_0197_remote_worker_tier2_contract.mjs`
    - 新增 `patch_out_topic` contract 断言
- Verification:
  - RED:
    - `node scripts/tests/test_0144_remote_worker.mjs`
    - output: `FAIL test_full_chain_async: on_model100_event_in must not leave a cross-model access error`
  - GREEN:
    - `node scripts/tests/test_0144_remote_worker.mjs`
    - output: `7 passed, 0 failed out of 7`
    - `node scripts/validate_model100_records_e2e_v0.mjs`
    - output: `PASS: model100 records-only E2E (MBR -> mqttIncoming -> cell_connection -> CELL_CONNECT -> function)`
    - `node scripts/tests/test_0197_remote_worker_tier2_contract.mjs`
    - output: `2 passed, 0 failed out of 2`
    - `node scripts/tests/test_0260_model100_submit_authoritative_routing_contract.mjs`
    - output: `3 passed, 0 failed out of 3`
- Result:
  - PASS
  - `0260` 当前已完成 Step 4/5 的 focused contract 修复，剩余待做项是 Step 6 的本地 live 浏览器 proof。

### Step 6 Attempt

- Date: `2026-03-30`
- Commands:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `bash scripts/ops/deploy_local.sh`
- Key output:
  - `check_runtime_baseline.sh`
    - `FAIL deploy/mosquitto readyReplicas= (expect 1)`
    - `FAIL deploy/synapse readyReplicas= (expect 1)`
    - `FAIL deploy/remote-worker readyReplicas= (expect 1)`
    - `FAIL deploy/mbr-worker readyReplicas= (expect 1)`
    - `FAIL deploy/ui-server readyReplicas= (expect 1)`
    - `FAIL deploy/ui-side-worker readyReplicas= (expect 1)`
    - `FAIL mbr-worker-secret.MODELTABLE_PATCH_JSON missing`
    - `FAIL ui-server-secret.MODELTABLE_PATCH_JSON missing`
  - elevated `deploy_local.sh` progressed through:
    - namespace ensure: PASS
    - infrastructure rollout: PASS
    - Synapse bootstrap: PASS
    - secret update: PASS
    - persisted asset sync: PASS
  - blocking failure at Docker build:
    - `Dockerfile.ui-server`
    - `RUN cd packages/ui-model-demo-frontend && bun install && bun run build`
    - `UNKNOWN_CERTIFICATE_VERIFICATION_ERROR downloading tarball commander@8.3.0`
    - `UNKNOWN_CERTIFICATE_VERIFICATION_ERROR downloading tarball vue-demi@0.14.10`
    - `UNKNOWN_CERTIFICATE_VERIFICATION_ERROR downloading tarball katex@0.16.22`
    - `UNKNOWN_CERTIFICATE_VERIFICATION_ERROR downloading tarball three@0.174.0`
- Result:
  - BLOCKED
  - Step 6 本地 live 浏览器 proof 尚未完成；当前阻塞不是 `0260` 业务链路，而是本地 Docker/Bun build 证书环境。

### Step 6 Completion

- Date: `2026-03-30`
- Commands:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - Playwright MCP:
    - navigate `http://localhost:30900`
    - click `Workspace`
    - click `Generate Color`
  - `curl -fsS http://localhost:30900/snapshot | jq ...`
- Environment fix:
  - `k8s/Dockerfile.ui-server`
  - `k8s/Dockerfile.remote-worker`
  - `k8s/Dockerfile.ui-server-prebuilt`
  - root cause: `oven/bun:latest` 缺少系统 CA bundle，补 `ca-certificates` 后 `bun install` 恢复正常
- Key output:
  - `check_runtime_baseline.sh`: `baseline ready`
  - local deploy:
    - `dy-ui-server:v1` build: PASS
    - `dy-remote-worker:v3` build: PASS
    - `dy-mbr-worker:v2` build: PASS
    - `dy-ui-side-worker:v1` build: PASS
    - rollout for `remote-worker` / `mbr-worker` / `ui-server` / `ui-side-worker`: PASS
  - Playwright page evidence:
    - before click color text: `#7a4354`
    - after click color text: `#f2f711`
    - lifecycle/status on page: `processed`
  - `/snapshot` after click:
    - `bg_color = "#f2f711"`
    - `status = "processed"`
    - `submit_inflight = false`
    - `patch_op_id = "color_response_1774812574377"`
    - `ui_event_error = null`
- Result:
  - PASS
  - 页面行为与 `/snapshot` 一致，Step 6 完成。

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
