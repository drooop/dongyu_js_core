---
title: "Iteration 0184-mbr-software-worker-remediation Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0184-mbr-software-worker-remediation
id: 0184-mbr-software-worker-remediation
phase: phase3
---

# Iteration 0184-mbr-software-worker-remediation Runlog

## Environment

- Date: 2026-03-11
- Branch: `dev_0184-mbr-software-worker-remediation`
- Runtime: local repo + remote rke2 cluster (`124.71.43.80`)

Review Gate Record
- Iteration ID: 0184-mbr-software-worker-remediation
- Review Date: 2026-03-11
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户明确批准继续做 `MBR` 规约收口，并强调 `MBR` 也必须严格按软件工人方式实现，尤其关注数据链路合法性。

## Execution Records

### Step 1

- Command:
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0184-mbr-software-worker-remediation --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - `git switch -c dev_0184-mbr-software-worker-remediation`
  - `apply_patch` 更新 `docs/ITERATIONS.md` 与 `docs/iterations/0184-mbr-software-worker-remediation/*`
- Key output:
  - 新 iteration 与独立分支创建成功
  - 本轮目标已从 `0183` 中拆出，避免 deploy 改造与 `MBR` 行为修复混在一起
- Result: PASS
- Commit: N/A

### Step 2 — 本地红灯合同：观测性与环境差异

- Command:
  - `apply_patch` 新增：
    - `scripts/tests/test_0184_remote_worker_observability_contract.mjs`
    - `scripts/tests/test_0184_cloud_mqtt_topology_contract.mjs`
  - `node scripts/tests/test_0184_remote_worker_observability_contract.mjs`
  - `node scripts/tests/test_0184_cloud_mqtt_topology_contract.mjs`
- Key output:
  - `test_0184_remote_worker_observability_contract` 初始 FAIL：
    - `remote-worker startup script must log connected state for MQTT diagnostics`
  - `test_0184_cloud_mqtt_topology_contract` 初始 FAIL：
    - `cloud rke2 worker baseline must point to the remote EMQX service`
- Result: PASS
- Commit: N/A

### Step 3 — 最小修复：remote-worker MQTT 可观测性 + local/cloud MQTT 拓扑文档

- Command:
  - `apply_patch` 更新：
    - `scripts/run_worker_remote_v1.mjs`
    - `scripts/ops/deploy_cloud_full.sh`
    - `scripts/ops/README.md`
    - `docs/user-guide/ui_event_matrix_mqtt_configuration.md`
  - 删除错误假设残留：`k8s/cloud/mosquitto.yaml`
  - `node scripts/tests/test_0184_remote_worker_observability_contract.mjs`
  - `node scripts/tests/test_0184_cloud_mqtt_topology_contract.mjs`
  - `node scripts/tests/test_0184_remote_worker_wildcard_event_contract.mjs`
  - `bash -n scripts/ops/deploy_cloud_full.sh`
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Key output:
  - `PASS test_0184_remote_worker_observability_contract`
  - `PASS test_0184_cloud_mqtt_topology_contract`
  - `PASS test_0184_remote_worker_wildcard_event_contract`
  - `deploy_cloud_full.sh` shell syntax PASS
  - docs audit PASS
- Notes:
  - 正式落盘了本地/远端差异：
    - 本地 OrbStack baseline：`mosquitto.dongyu.svc.cluster.local`
    - 远端 rke2 baseline：`emqx-emqx-enterprise.emqx.svc.cluster.local`
  - 远端 `deploy_cloud_full.sh` 不再错误宣称会创建 cloud broker。
- Result: PASS
- Commit: N/A

### Step 4 — 远端 targeted 验证：remote-worker MQTT observability

- Command:
  - `scp scripts/run_worker_remote_v1.mjs drop@124.71.43.80:/tmp/run_worker_remote_v1.mjs`
  - `ssh drop@124.71.43.80 'sudo cp /tmp/run_worker_remote_v1.mjs /home/wwpic/dongyuapp/scripts/run_worker_remote_v1.mjs'`
  - `ssh drop@124.71.43.80 "printf '%s\n' d018706-obs-mqtt | sudo tee /home/wwpic/dongyuapp/.deploy-source-revision >/dev/null && sudo -n /usr/local/sbin/dy-deploy-cloud-app --target remote-worker --revision d018706-obs-mqtt"`
  - `ssh drop@124.71.43.80 'sudo KUBECONFIG=/etc/rancher/rke2/rke2.yaml kubectl -n dongyu logs pod/remote-worker-546655d975-qlkzm --tail=200'`
  - `ssh drop@124.71.43.80 'sudo KUBECONFIG=/etc/rancher/rke2/rke2.yaml kubectl -n dongyu exec pod/remote-worker-546655d975-qlkzm -- sh -lc '\''bun -e "...mqtt dual-client probe..."'\'''`
- Key output:
  - remote-worker 新日志显示：
    - `MQTT connected: false status=running reason=after_start`
    - `MQTT subscriptions: ["UIPUT/ws/dam/pic/de/sw/100/event","UIPUT/ws/dam/pic/de/sw/100/patch"]`
    - 下一轮 interval 变为 `MQTT connected: true`
  - 双客户端 probe (`emqx_probe_001`) 结果：
    - `PUBLISHED`
    - `RECV UIPUT/ws/dam/pic/de/sw/100/event ...`
    - `RECV_COUNT 1`
  - remote-worker 自身日志随后确认：
    - `inbound ... topic=UIPUT/ws/dam/pic/de/sw/100/event`
    - `publish ... topic=UIPUT/ws/dam/pic/de/sw/100/patch_out`
- Notes:
  - 这一步把问题从“怀疑 remote-worker 没订阅/没连上”排除了。
  - 也明确证明远端 EMQX 本身可以正常完成同 topic 的 publish/subscribe。
- Result: PASS
- Commit: N/A

### Step 5 — 远端闭环复验：MBR 回程、脚本 PASS、真实浏览器 PASS

- Command:
  - `ssh drop@124.71.43.80 'sudo KUBECONFIG=/etc/rancher/rke2/rke2.yaml kubectl -n dongyu logs deploy/mbr-worker --tail=200'`
  - `ssh drop@124.71.43.80 'sudo KUBECONFIG=/etc/rancher/rke2/rke2.yaml kubectl -n dongyu logs deploy/ui-server --tail=200 | egrep "snapshot_delta|ui_event|mbr_ready|matrix|sendMatrix|handleDyBusEvent"'`
  - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url https://app.dongyudigital.com`
  - Playwright 真实浏览器：
    - 打开 `https://app.dongyudigital.com/?v=1773207932#/workspace`
    - 输入 `remote browser final 1773207932`
    - 点击 `Generate Color`
    - `fetch('/snapshot')`
- Key output:
  - `mbr-worker` 日志：
    - `recv mqtt topic=UIPUT/ws/dam/pic/de/sw/100/patch_out op_id=color_response_...`
    - 后续成功 `sendEvent dy.bus.v0`
  - `ui-server` 日志：
    - 收到 `snapshot_delta`
    - `applyPatch result: {"applied":3,"rejected":0}`
    - `Post-apply check: bg_color= #9564aa status= processed submit_inflight= false`
  - 远端脚本验收：
    - `PASS final_state={"bg":"#d7a491","status":"processed","inflight":false,"ready":true,"err":null,...}`
  - 真实浏览器验收：
    - 首屏自动进入 Workspace
    - 点击后颜色从 `#d7a491` 变到 `#bea3cb`
    - `/snapshot` 返回：
      - `bg_color="#bea3cb"`
      - `status="processed"`
      - `submit_inflight=false`
      - `ui_page="workspace"`
      - `ws_app_selected=100`
- Result: PASS
- Commit: N/A

### Step 6 — 提交收口

- Command:
  - `git add scripts/run_worker_remote_v1.mjs scripts/ops/deploy_cloud_full.sh scripts/ops/README.md scripts/tests/test_0184_remote_worker_observability_contract.mjs scripts/tests/test_0184_cloud_mqtt_topology_contract.mjs scripts/tests/test_0184_remote_worker_wildcard_event_contract.mjs`
  - `git commit -m "fix: add remote worker mqtt observability"`
- Key output:
  - commit: `42e372a`
  - message: `fix: add remote worker mqtt observability`
- Notes:
  - 本次提交只包含 repo 内代码/脚本与测试。
  - `docs` ledger 已单独补齐 `0184` 完成事实与远端验收事实。
- Result: PASS
- Commit: `42e372a`

## Docs Updated

- [x] `docs/ITERATIONS.md` updated
- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/ui_event_matrix_mqtt_configuration.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
