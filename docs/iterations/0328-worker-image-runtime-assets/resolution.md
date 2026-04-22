---
title: "0328 — worker-image-runtime-assets Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-22
source: ai
iteration_id: 0328-worker-image-runtime-assets
id: 0328-worker-image-runtime-assets
phase: phase1
---

# 0328 — worker-image-runtime-assets Resolution

## Execution Strategy

1. 评估 `mbr` / `remote-worker` 是否需要重填模型表
2. 先写 failing test，锁定镜像缺少 `worker-base/system-models`
3. 修 Dockerfile
4. 写 failing test，锁定 `remote-worker` 当前业务函数还停留在旧 `ctx.*` 语义
5. 重填 `remote-worker` 当前业务函数到 `V1N` / `ctx.runtime.*`
6. 重部署本地环境
7. 做真实浏览器验证

## Step 1 — Assessment

- Commands:
  - `node scripts/tests/test_0144_remote_worker.mjs`
  - `node scripts/tests/test_0144_mbr_compat.mjs`
  - `sed -n '1,220p' k8s/Dockerfile.remote-worker`
  - `sed -n '1,220p' k8s/Dockerfile.mbr-worker`
  - `sed -n '1,220p' k8s/Dockerfile.ui-side-worker`
  - `kubectl logs/describe` for crashing pods after local deploy
- Acceptance:
  - 明确记录“是否需要重填模型表”的判断和证据

## Step 2 — Failing Test

- Files:
  - `scripts/tests/test_0328_worker_images_include_runtime_assets.mjs`
- Verification:
  - 新测试初始 FAIL，明确指出哪些 Dockerfile 没有复制 `packages/worker-base/system-models/`

## Step 3 — Dockerfile Fix

- Files:
  - `k8s/Dockerfile.remote-worker`
  - `k8s/Dockerfile.mbr-worker`
  - `k8s/Dockerfile.ui-side-worker`
- Changes:
  - 为运行 `packages/worker-base/src/runtime.mjs` 的镜像补上 `packages/worker-base/system-models/`
- Verification:
  - Step 2 新测试 PASS

## Step 4 — Failing Test for remote-worker patch semantics

- Files:
  - `scripts/tests/test_0328_remote_worker_v1n_runtime_contract.mjs`
- Verification:
  - 新测试初始 FAIL，证明 current remote-worker patch 在当前运行时下不能把 submit 链推进到 `processed` / `remote_processed`

## Step 5 — remote-worker patch migration

- Files:
  - `deploy/sys-v1ns/remote-worker/patches/10_model100.json`
  - `deploy/sys-v1ns/remote-worker/patches/11_model1010.json`
  - `deploy/sys-v1ns/remote-worker/patches/12_model1019.json`
- Changes:
  - 把当前失效的 `ctx.writeLabel/getLabel` 写法改到 `V1N.table.addLabel` 与可用读取面
  - 不改变现有 topic / payload / business result 语义
- Verification:
  - Step 4 新测试 PASS
  - `node scripts/tests/test_0144_remote_worker.mjs` PASS

## Step 6 — Redeploy

- Commands:
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `kubectl get pods -n dongyu -o wide`
- Acceptance:
  - 三个新 pod Ready
  - baseline PASS

## Step 7 — Browser Validation

- Commands:
  - `export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"; export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"`
  - `"$PWCLI" open http://127.0.0.1:30900/#/workspace`
  - `"$PWCLI" -s=default snapshot`
  - `"$PWCLI" -s=default fill <textbox-ref> "<probe-text>"`
  - `"$PWCLI" -s=default click <button-ref>`
  - `"$PWCLI" -s=default snapshot`
  - `"$PWCLI" -s=default console`
- Acceptance:
  - 浏览器实测通过
