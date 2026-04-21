---
title: "Iteration 0169-cloud-source-gate-running-pod Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0169-cloud-source-gate-running-pod
id: 0169-cloud-source-gate-running-pod
phase: phase1
---

# Iteration 0169-cloud-source-gate-running-pod Resolution

## Execution Strategy

- 先用 failing test 锁住 `deploy_cloud.sh` 需要新增的 retry helper 和调用点，再做最小脚本修改。
- 本地确认测试与 shell 语法均通过后，再同步远端脚本并复跑完整 cloud deploy。
- deploy 成功后，更新 runlog 与索引并收口，不再额外扩散改动范围。

## Step 1

- Scope:
  - 为 `ui-server` exec source gate 增加 retry helper，并让三个校验入口统一走该 helper。
- Files:
  - `scripts/ops/deploy_cloud.sh`
  - `scripts/tests/test_0169_ui_server_exec_retry.mjs`
- Verification:
  - `node scripts/tests/test_0169_ui_server_exec_retry.mjs`
  - `bash -n scripts/ops/deploy_cloud.sh`
- Acceptance:
  - retry helper 存在，且 source gate 三处入口全部改用 helper。
- Rollback:
  - 回退 `deploy_cloud.sh` 到 0168 版本，保留 failing test 证据。

## Step 2

- Scope:
  - 同步远端 deploy 输入并重跑 deploy，确认脚本末尾稳定成功。
- Files:
  - `/home/wwpic/dongyuapp/scripts/ops/deploy_cloud.sh`
  - `/home/wwpic/dongyuapp/k8s/cloud/workers.yaml`
  - `/home/wwpic/dongyuapp/workers.yaml`
- Verification:
  - `sudo -n /usr/bin/bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud.sh --image-tar /tmp/dy-ui-server-aaf4083-v1.tar`
  - deploy 末尾 `=== Cloud deploy complete ===`
- Acceptance:
  - deploy 退出码为 0，source gate 不再命中已终止 pod。
- Rollback:
  - 恢复远端脚本到上一个可运行版本，保留失败日志。
