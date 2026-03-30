---
title: "Iteration 0169-cloud-source-gate-running-pod Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0169-cloud-source-gate-running-pod
id: 0169-cloud-source-gate-running-pod
phase: phase1
---

# Iteration 0169-cloud-source-gate-running-pod Plan

## Goal

- 修复 `deploy_cloud.sh` 在 rollout 切换窗口内对 `ui-server` 做 source gate 校验时命中已终止 pod 的竞态，确保 deploy 末尾能稳定以 0 退出。

## Scope

- In scope:
  - 为 `ui-server` 的 `kubectl exec` 校验路径增加基于 running pod 重试的 helper。
  - 复验 `container_file_sha256`、prompt guard、snapshot runtime 三类 source gate。
  - 同步远端脚本并重跑 cloud deploy，确认不再出现 `container not found (\"server\")`。
- Out of scope:
  - 修复 `workers.yaml` shadow manifest 设计本身。
  - 提交当前工作区中无关的 UI/renderer/tooling 改动。

## Invariants / Constraints

- 仅修改 `deploy_cloud.sh` 与最小测试文件，不触碰 runtime / service 业务逻辑。
- 继续以 `2e00cbe` / `3ca4584` 的 token-auth 路径为基线，不回退到 password-only。
- 若 deploy 仍失败，必须记录实际失败点并停止继续猜修。

## Success Criteria

- `test_0169_ui_server_exec_retry.mjs` 通过，且 `deploy_cloud.sh` 语法检查通过。
- 远端 `deploy_cloud.sh --image-tar ...` 以 0 退出。
- deploy 末尾 source gate 通过，不再出现 `unable to upgrade connection: container not found (\"server\")`。
