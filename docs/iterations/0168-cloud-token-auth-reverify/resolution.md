---
title: "Iteration 0168-cloud-token-auth-reverify Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0168-cloud-token-auth-reverify
id: 0168-cloud-token-auth-reverify
phase: phase1
---

# Iteration 0168-cloud-token-auth-reverify Resolution

## Execution Strategy

- 先同步当前 deploy 相关文件到远端，并处理已知的 shadow `workers.yaml` 门禁前提。
- 然后重跑 cloud deploy，检查 secret、pod、日志三层证据是否一致。
- 如果复验通过，则只记录事实并完成；如果不通过，再进入新的 root-cause 调查。

## Step 1

- Scope:
  - 更新 0168 文档并登记索引。
- Files:
  - `docs/iterations/0168-cloud-token-auth-reverify/*`
  - `docs/ITERATIONS.md`
- Verification:
  - 文档文件存在且索引登记成功。
- Acceptance:
  - 允许进入复验执行。
- Rollback:
  - 删除 0168 文档与索引条目。

## Step 2

- Scope:
  - 远端同步 deploy 输入并重跑 deploy。
- Files:
  - `/home/wwpic/dongyuapp/scripts/ops/*`
  - `/home/wwpic/dongyuapp/k8s/cloud/workers.yaml`
  - `/home/wwpic/dongyuapp/workers.yaml`
- Verification:
  - `deploy_cloud.sh --image-tar ...`
  - `kubectl get secret ui-server-secret -o yaml`
- Acceptance:
  - `MATRIX_MBR_ACCESS_TOKEN` 自动存在于 secret 中。
- Rollback:
  - 回退到之前可用的 secret/manifest 状态。

## Step 3

- Scope:
  - 复验线上行为。
- Files:
  - `docs/iterations/0168-cloud-token-auth-reverify/runlog.md`
- Verification:
  - `kubectl logs deploy/ui-server`
  - Playwright smoke
- Acceptance:
  - Matrix 适配器正常，颜色生成器为 `processed`。
- Rollback:
  - 保留现场，停止继续改动并回报。
