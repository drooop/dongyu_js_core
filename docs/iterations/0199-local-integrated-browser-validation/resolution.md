---
title: "Iteration 0199-local-integrated-browser-validation Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0199-local-integrated-browser-validation
id: 0199-local-integrated-browser-validation
phase: phase1
---

# Iteration 0199-local-integrated-browser-validation Resolution

## Execution Strategy

- 先把 `ui-side-worker` 接入本地部署链，确保 4 个角色都能启动。
- 再跑脚本级 smoke / roundtrip。
- 最后做 Playwright 和人工浏览器复核，并把截图/页面证据写进 runlog。

## Step 1

- Scope:
  - 审计并补齐本地部署链：
    - `deploy_local.sh`
    - `k8s/local/workers.yaml`
    - `k8s/local/ui-side-worker.yaml`
    - 相关 Dockerfile / secret / baseline 脚本
  - 目标：`ui-side-worker` 能被纳入本地部署
- Files:
  - `scripts/ops/deploy_local.sh`
  - `k8s/local/workers.yaml`
  - `k8s/local/ui-side-worker.yaml`
  - `k8s/Dockerfile.ui-side-worker`
  - 必要时相关 ops 脚本
- Verification:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `bash scripts/ops/deploy_local.sh`
  - `kubectl -n dongyu get pods`
  - `kubectl -n dongyu get svc`
- Acceptance:
  - 本地部署链成功纳入 `ui-side-worker`
  - 所需服务和 Pod 都在可用状态
- Rollback:
  - 回退本地部署链接线改动

## Step 2

- Scope:
  - 执行脚本级 smoke / roundtrip
  - 执行 Playwright 浏览器测例
  - 执行人工浏览器复核
- Files:
  - 现有 smoke/roundtrip 脚本
  - 必要时新增 Playwright 测例脚本
  - runlog 证据
- Verification:
  - 本地 roundtrip 脚本
  - Playwright 脚本
  - 人工浏览器步骤 + 截图
- Acceptance:
  - 脚本级 smoke PASS
  - Playwright PASS
  - 人工浏览器 PASS
- Rollback:
  - 回退本轮新增的验证脚本或本地接线改动

## Step 3

- Scope:
  - 收口 runlog / `docs/ITERATIONS`
- Files:
  - `docs/iterations/0199-local-integrated-browser-validation/runlog`
  - `docs/ITERATIONS`
- Verification:
  - runlog 记录命令、截图、浏览器证据
  - `docs/ITERATIONS` 状态与 runlog 一致
- Acceptance:
  - 台账完整
- Rollback:
  - 回退 docs vault 中本轮新增记录
