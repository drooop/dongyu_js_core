---
title: "Iteration 0167-ui-server-matrix-token-auth Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0167-ui-server-matrix-token-auth
id: 0167-ui-server-matrix-token-auth
phase: phase1
---

# Iteration 0167-ui-server-matrix-token-auth Resolution

## Execution Strategy

- 先用静态测试把 deploy contract 固化：`ui-server-secret` 必须包含 `MATRIX_MBR_ACCESS_TOKEN`，`workers.yaml` 必须把它注入 `ui-server`。
- 再做最小实现：复用 deploy 时已获取的 `SERVER_TOKEN`，写入 `ui-server-secret`，并在 `cloud/local workers.yaml` 中声明 env。
- 最后复跑 deploy，并用日志 + Playwright smoke 验证 `ui-server -> Matrix -> MBR` 链路恢复。

## Step 1

- Scope:
  - 写失败测试，固化 `ui-server` token auth deploy contract。
- Files:
  - `scripts/tests/test_0167_ui_server_matrix_token_auth.mjs`
  - `scripts/ops/_deploy_common.sh`
  - `k8s/cloud/workers.yaml`
  - `k8s/local/workers.yaml`
- Verification:
  - `node scripts/tests/test_0167_ui_server_matrix_token_auth.mjs`
- Acceptance:
  - 测试在改动前稳定 FAIL，指出缺少 `MATRIX_MBR_ACCESS_TOKEN` secret/env 注入。
- Rollback:
  - 删除新增测试文件。

## Step 2

- Scope:
  - 注入 `drop` user access token，避免 `ui-server` 每次启动走 password login。
- Files:
  - `scripts/ops/_deploy_common.sh`
  - `k8s/cloud/workers.yaml`
  - `k8s/local/workers.yaml`
- Verification:
  - `node scripts/tests/test_0167_ui_server_matrix_token_auth.mjs`
- Acceptance:
  - 测试 PASS，配置满足 token auth contract。
- Rollback:
  - 回退上述三处文件。

## Step 3

- Scope:
  - 重新部署远端并验证线上行为。
- Files:
  - `docs/iterations/0167-ui-server-matrix-token-auth/runlog.md`
- Verification:
  - `deploy_cloud.sh` 远端发布
  - `kubectl logs` 检查 `Matrix adapter connected`
  - Playwright smoke 提交颜色生成器
- Acceptance:
  - 不再出现 `matrix_unavailable`，UI 状态恢复 `processed`。
- Rollback:
  - 回退到上一个可用镜像/commit，保留 runlog 证据。

## Notes

- Generated at: 2026-03-06
