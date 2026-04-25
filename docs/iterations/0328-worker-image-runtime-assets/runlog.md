---
title: "0328 — worker-image-runtime-assets Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-22
source: ai
iteration_id: 0328-worker-image-runtime-assets
id: 0328-worker-image-runtime-assets
phase: phase1
---

# 0328 — worker-image-runtime-assets Runlog

## Environment

- Date: 2026-04-22
- Branch: `dev_0328-worker-image-runtime-assets`
- Runtime: `dev` HEAD `f01225d` 作为基线

## Planning Record

### Record 1 — Initial assessment target (2026-04-22)

- Inputs reviewed:
  - `k8s/Dockerfile.remote-worker`
  - `k8s/Dockerfile.mbr-worker`
  - `k8s/Dockerfile.ui-side-worker`
  - `scripts/run_worker_remote_v1.mjs`
  - `scripts/run_worker_v0.mjs`
  - `scripts/run_worker_ui_side_v0.mjs`
- Locked focus:
  - 先回答“要不要重填 `mbr` / `remote-worker` 模型表”
  - 若证据显示模型表未坏，则只修镜像回归

### Record 2 — Assessment revised after fresh deploy evidence (2026-04-22)

- Facts:
  - 修复镜像缺文件后，`remote-worker` / `mbr-worker` / `ui-side-worker` 已能启动
  - `mbr-worker` 日志显示已从 Matrix 收到 `pin_payload` 并发布到 MQTT
  - `remote-worker` 日志显示已从 MQTT 收到 `100/submit` 与 `1010/submit`，但状态仍停在 `ready`
  - `packages/worker-base/src/runtime.mjs` 的这条执行路径只提供 `publishMqtt` + `V1N` / `ctx.runtime.*`
  - `deploy/sys-v1ns/remote-worker/patches/{10,11,12}_*.json` 里的业务函数仍使用 `ctx.writeLabel/getLabel`
- Locked conclusion:
  - `mbr-worker` 暂无必须重填模型表的证据
  - `remote-worker` 当前业务函数需要迁移到现运行时语义

## Review Gate Record

Review Gate Record
- Iteration ID: `0328-worker-image-runtime-assets`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 1
- Decision: Change Requested
- Notes:
  - workflow review pending absorb; phase1 draft created but gate 记录与浏览器验证命令还需补实

Review Gate Record
- Iteration ID: `0328-worker-image-runtime-assets`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 2
- Decision: Approved
- Notes:
  - scope consistency review（sub-agent `019db202-736d-7e72-a3c9-10d53590cf4f`）
  - 初版 scope 与 `docs/ITERATIONS.md` 摘要一致，无 docs-only gate 阻断

Review Gate Record
- Iteration ID: `0328-worker-image-runtime-assets`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 3
- Decision: Approved
- Notes:
  - diagnosis review（sub-agent `019db202-79be-7e31-92ff-8b1301711861`）
  - 确认初始问题首先是镜像内容回归，而不是先入为主地要求重填模型表

Review Gate Record
- Iteration ID: `0328-worker-image-runtime-assets`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 4
- Decision: Approved
- Notes:
  - workflow review（sub-agent `019db212-c3d4-7b01-811d-a1e8bc201a0e`）
  - 确认 failing test、redeploy、Playwright CLI browser 验证入口都已写成可复现命令

Review Gate Record
- Iteration ID: `0328-worker-image-runtime-assets`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 5
- Decision: Change Requested
- Notes:
  - scope-revision review（sub-agent `019db202-736d-7e72-a3c9-10d53590cf4f`）
  - 新证据显示 `remote-worker` 需要 patch migration；要求把 `docs/ITERATIONS.md` 摘要与 plan/resolution scope 一起扩大

Review Gate Record
- Iteration ID: `0328-worker-image-runtime-assets`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 6
- Decision: Change Requested
- Notes:
  - implementation-scope review（sub-agent `019db202-79be-7e31-92ff-8b1301711861`）
  - 确认 `mbr` 暂不迁移，`remote-worker` 三张 truth patch 迁移应纳入 scope

Review Gate Record
- Iteration ID: `0328-worker-image-runtime-assets`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 7
- Decision: Change Requested
- Notes:
  - workflow review（sub-agent `019db212-c3d4-7b01-811d-a1e8bc201a0e`）
  - 要求把新增 Step4 failing test 先落成真实文件

Review Gate Record
- Iteration ID: `0328-worker-image-runtime-assets`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 8
- Decision: Approved
- Notes:
  - scope-expanded review（sub-agent `019db202-79be-7e31-92ff-8b1301711861`）
  - 确认 `mbr` 暂不迁移、`remote-worker` 迁移范围与 success criteria 已和新证据一致

Review Gate Record
- Iteration ID: `0328-worker-image-runtime-assets`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 9
- Decision: Approved
- Notes:
  - workflow review（sub-agent `019db212-c3d4-7b01-811d-a1e8bc201a0e`）
  - 复核新增 failing test 入口和 Playwright CLI browser 验证命令后，确认 phase1 docs 可执行

Review Gate Record
- Iteration ID: `0328-worker-image-runtime-assets`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 10
- Decision: Approved
- Notes:
  - final phase1 review（sub-agent `019db202-736d-7e72-a3c9-10d53590cf4f`）
  - 复核 `docs/ITERATIONS.md` 摘要、plan、resolution、runlog 一致，phase1 docs 足够进入 phase3

## Gate Status

- Current status: **APPROVED**
- Basis:
  - Review 5-7 的 `Change Requested` 已吸收进 phase1 docs
  - 最近连续 3 次 `Approved` 为 Review 8-10

## Execution Records

### Step 1

- Command:
  - `node scripts/tests/test_0144_remote_worker.mjs`
  - `node scripts/tests/test_0144_mbr_compat.mjs`
  - `kubectl logs -n dongyu deploy/ui-server --tail=120`
  - `kubectl logs -n dongyu deploy/mbr-worker --tail=120`
  - `kubectl logs -n dongyu deploy/remote-worker --tail=120`
- Key output:
  - `test_0144_mbr_compat.mjs` PASS
  - `mbr-worker` 日志显示已收到 Matrix `pin_payload` 并发布到 `.../100/submit`
  - `remote-worker` 日志显示已收到 `.../100/submit` / `.../1010/submit`，但 `Model 100` 仍停在 `status=ready`
  - 由此确认：`mbr` 暂无必须重填模型表的证据；`remote-worker` 需要 patch migration
- Result: PASS
- Commit: `n/a (assessment only)`

### Step 2

- Command:
  - `node scripts/tests/test_0328_worker_images_include_runtime_assets.mjs`
- Key output:
  - 初次执行 FAIL：`k8s/Dockerfile.remote-worker must copy packages/worker-base/system-models ...`
  - 修复后 PASS
- Result: PASS
- Commit: `24f744b`

### Step 3

- Command:
  - 修改 `k8s/Dockerfile.remote-worker`
  - 修改 `k8s/Dockerfile.mbr-worker`
  - 修改 `k8s/Dockerfile.ui-side-worker`
  - `node scripts/tests/test_0328_worker_images_include_runtime_assets.mjs`
- Key output:
  - 三个 Dockerfile 都补上 `COPY packages/worker-base/system-models/`
  - 镜像缺文件 contract test PASS
- Result: PASS
- Commit: `24f744b`

### Step 4

- Command:
  - `node scripts/tests/test_0328_remote_worker_v1n_runtime_contract.mjs`
- Key output:
  - 初次执行 `0 passed, 3 failed out of 3`
  - `model100_status_must_be_processed`
  - `model1010_result_status_must_be_remote_processed`
  - `model1019_conversation_status_must_be_remote_processed`
- Result: PASS
- Commit: `24f744b`

### Step 5

- Command:
  - 修改 `deploy/sys-v1ns/remote-worker/patches/10_model100.json`
  - 修改 `deploy/sys-v1ns/remote-worker/patches/11_model1010.json`
  - 修改 `deploy/sys-v1ns/remote-worker/patches/12_model1019.json`
  - `node scripts/tests/test_0328_remote_worker_v1n_runtime_contract.mjs`
  - `node scripts/tests/test_0144_remote_worker.mjs`
- Key output:
  - `test_0328_remote_worker_v1n_runtime_contract.mjs` → `3 passed, 0 failed out of 3`
  - `test_0144_remote_worker.mjs` → `7 passed, 0 failed out of 7`
  - 1019 的 `on_matrix_phase1_remote_submit_in:out` 误接线也一并修正为 `on_matrix_phase2_remote_submit_in:out`
- Result: PASS
- Commit: `24f744b`

### Step 6

- Command:
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
- Key output:
  - 新 `remote-worker` / `mbr-worker` / `ui-side-worker` pod 全部 Ready
  - `check_runtime_baseline.sh` 全量 PASS
- Result: PASS
- Commit: `24f744b`

### Step 7

- Command:
  - Playwright CLI 打开 `http://127.0.0.1:30900/#/workspace`
  - 在 `E2E 颜色生成器` 中输入 `browser smoke 0328`
  - 点击 `Generate Color`
  - 重新 snapshot / screenshot
- Key output:
  - 初始页面显示 `status=ready`
  - 最终页面显示 `颜色状态 = processed`
  - `颜色值` 从 `#4b460a` 变为 `#c78333`
  - 截图：`.playwright-cli/page-2026-04-22T01-13-33-922Z.png`
- Result: PASS
- Commit: `24f744b`

## Final Proof

- `node scripts/tests/test_0328_worker_images_include_runtime_assets.mjs`
  - PASS
- `node scripts/tests/test_0328_remote_worker_v1n_runtime_contract.mjs`
  - PASS
- `node scripts/tests/test_0144_remote_worker.mjs`
  - PASS
- `bash scripts/ops/deploy_local.sh`
  - PASS
- `bash scripts/ops/check_runtime_baseline.sh`
  - PASS
- Browser real test:
  - 打开 `http://127.0.0.1:30900/#/workspace`
  - 在 `E2E 颜色生成器` 输入 `browser smoke 0328`
  - 点击 `Generate Color`
  - 页面结果：
    - `颜色值`：`#4b460a` → `#c78333`
    - `颜色状态`：`ready` → `processed`
    - 按钮恢复可点击
  - Screenshot: `.playwright-cli/page-2026-04-22T01-13-33-922Z.png`
