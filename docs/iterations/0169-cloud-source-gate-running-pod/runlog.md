---
title: "Iteration 0169-cloud-source-gate-running-pod Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0169-cloud-source-gate-running-pod
id: 0169-cloud-source-gate-running-pod
phase: phase3
---

# Iteration 0169-cloud-source-gate-running-pod Runlog

## Environment

- Date: 2026-03-06
- Branch: `dev_0164-playwright-readiness-fixes`
- Runtime: local repo + dy-cloud kubernetes cluster

Review Gate Record
- Iteration ID: 0169-cloud-source-gate-running-pod
- Review Date: 2026-03-06
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: 用户批准继续，对 cloud deploy 的 source gate rollout 竞态做最小修复与复验。

## Execution Records

### Step 1

- Command:
  - 新增 `scripts/tests/test_0169_ui_server_exec_retry.mjs`
  - 修改 `scripts/ops/deploy_cloud.sh`
  - `node scripts/tests/test_0169_ui_server_exec_retry.mjs`
  - `bash -n scripts/ops/deploy_cloud.sh`
- Key output:
  - failing test 先锁定 `exec_in_running_ui_server_pod()` 与三个调用点。
  - 当前本地修复后，`test_0169_ui_server_exec_retry: PASS`。
  - `deploy_cloud.sh` shell 语法检查通过。
- Result: PASS
- Commit: `98bd76c`

### Step 2

- Command:
  - `scp scripts/ops/deploy_cloud.sh dy-cloud:/home/wwpic/dongyuapp/scripts/ops/deploy_cloud.sh`
  - `ssh dy-cloud 'cp /home/wwpic/dongyuapp/k8s/cloud/workers.yaml /home/wwpic/dongyuapp/workers.yaml'`
  - `ssh dy-cloud-drop 'sudo -n /usr/bin/bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud.sh --image-tar /tmp/dy-ui-server-aaf4083-v1.tar'`
- Key output:
  - 远端脚本 hash 与本地一致。
  - deploy 完整通过，末尾出现 `=== Cloud deploy complete ===`。
  - Step 12 source gate 成功输出三份 runtime hash、prompt guard 与 snapshot runtime。
  - 本轮未再出现 `unable to upgrade connection: container not found ("server")`。
  - deploy 产出新的 Matrix Room：`!aHCpFSWVlLCZcpgwPh:dongyu.local`。
- Result: PASS
- Commit: `98bd76c`

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed（本轮无需改动）
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed（本轮无需改动）
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed（本轮无需改动）
