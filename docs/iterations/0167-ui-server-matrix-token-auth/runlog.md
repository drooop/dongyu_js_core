---
title: "Iteration 0167-ui-server-matrix-token-auth Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0167-ui-server-matrix-token-auth
id: 0167-ui-server-matrix-token-auth
phase: phase3
---

# Iteration 0167-ui-server-matrix-token-auth Runlog

## Environment

- Date: 2026-03-06
- Branch: `dev_0164-playwright-readiness-fixes`
- Runtime: local repo + dy-cloud kubernetes cluster

Review Gate Record
- Iteration ID: 0167-ui-server-matrix-token-auth
- Review Date: 2026-03-06
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: 用户要求继续远端问题排查与修复；本轮将问题独立登记为新的线上修复迭代。

## Execution Records

### Step 1

- Command:
  - `kubectl logs deploy/ui-server`
  - `kubectl logs deploy/mbr-worker`
  - `kubectl get secret ui-server-secret`
  - `node scripts/tests/test_0167_ui_server_matrix_token_auth.mjs`
- Key output:
  - `ProgramModelEngine] Matrix init failed (non-fatal): MatrixError: [429] Too Many Requests (.../_matrix/client/v3/login)`
  - `mbr-worker` 正常 `sendEvent ... 200`
  - 根因定位：`ui-server` 启动期走 password login，被 Synapse 429 限流
- Result: PASS
- Commit:

### Step 2

- Command:
  - `node scripts/tests/test_0167_ui_server_matrix_token_auth.mjs`
  - `bash -n scripts/ops/_deploy_common.sh scripts/ops/deploy_cloud.sh scripts/ops/deploy_local.sh`
- Key output:
  - `test_0167_ui_server_matrix_token_auth: PASS`
  - `shell_syntax_ok`
  - deploy contract fixed: `ui-server-secret` + `workers.yaml` 均声明 `MATRIX_MBR_ACCESS_TOKEN`
- Result: PASS
- Commit: `2e00cbe`

### Step 3

- Command:
  - 远端 `deploy_cloud.sh --image-tar /tmp/dy-ui-server-aaf4083-v1.tar`
  - `kubectl describe pod ...` 确认 `CreateContainerConfigError` 原因为 secret 缺 key
  - 手工补齐 `ui-server-secret.MATRIX_MBR_ACCESS_TOKEN` 并 `rollout restart deployment/ui-server`
  - Playwright smoke: 访问 `https://app.dongyudigital.com/#/workspace`，重新提交 Color Generator
- Key output:
  - 新 pod 启动日志：`[ProgramModelEngine] Matrix adapter connected, room: !QHumPTKIYNlnQSCPqn:dongyu.local`
  - 页面状态从 `matrix_unavailable` 恢复为 `processed`
  - 颜色值更新为 `#0883fc`
  - 证据截图：`output/playwright/remote-smoke-0167-processed.png`
- Result: PASS
- Commit: `2e00cbe` (code) + remote secret patch / rollout restart (ops only)

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed（本轮无需改动）
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed（本轮无需改动）
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed（本轮无需改动）
