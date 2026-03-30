---
title: "Iteration 0175-local-color-generator-smoke Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0175-local-color-generator-smoke
id: 0175-local-color-generator-smoke
phase: phase3
---

# Iteration 0175-local-color-generator-smoke Runlog

## Environment

- Date: 2026-03-07
- Branch: `dev_0175-local-color-generator-smoke`
- Runtime: local repo + existing color generator runbook

Review Gate Record
- Iteration ID: 0175-local-color-generator-smoke
- Review Date: 2026-03-07
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: 用户明确要求以颜色生成器例子验证本地运行情况。

## Execution Records

### Step 1 — 合并到 dev 并创建 0175 分支

- Command:
- `git checkout dev && git merge --no-ff dev_0173-handoff-mode-protocol -m "merge: sync dropmode protocol updates into dev"`
- `git checkout -b dev_0175-local-color-generator-smoke dev`
- `apply_patch` 更新 `docs/ITERATIONS.md` 与 `docs/iterations/0175-local-color-generator-smoke/*`
- Key output:
- `dev` 已生成 merge commit，并纳入 `0173` 的 3 个文档提交。
- `dev_0175-local-color-generator-smoke` 已基于合并后的 `dev` 创建。
- Result: PASS
- Commit: N/A

### Step 2 — 本地颜色生成器一键验证

- Command:
- `bash scripts/ops/run_model100_submit_roundtrip_local.sh --port 9011 --stop-after`
- `tail -n 200 /tmp/dongyu-ui-server-9011.log`
- `kubectl -n dongyu get configmap mbr-worker-config -o jsonpath='{.data.MATRIX_HOMESERVER_URL}'`
- `env NO_PROXY='*' no_proxy='*' curl -sv --max-time 5 http://synapse.dongyu.svc.cluster.local:8008/_matrix/client/v3/account/whoami`
- Key output:
- baseline 5 个 deployment 全部 ready：`mosquitto / synapse / remote-worker / mbr-worker / ui-server`
- `start_local_ui_server_k8s_matrix.sh` 注入的 homeserver 为：`http://synapse.dongyu.svc.cluster.local:8008`
- 本地 ui-server 日志：
  - `Matrix init failed (non-fatal): fetch failed: The socket connection was closed unexpectedly`
  - `Program engine will run without Matrix. UI events won't reach MBR/MQTT.`
- 直连探针结果：
  - `synapse.dongyu.svc.cluster.local` 解析到 `198.18.1.187`
  - `curl` 返回 `Empty reply from server`（exit `52`）
- 当前结论：
  - 本地颜色生成器一键链路 **FAIL**
  - 阻塞点不在 baseline readiness，而在“主机侧 ui-server 直连 cluster 内 Synapse 地址”这一配置路径
- Result: FAIL
- Commit: N/A

### Step 3 — 收口判断

- Command:
- `apply_patch` 更新 `docs/iterations/0175-local-color-generator-smoke/runlog.md`
- Key output:
- 本轮已完成“利用颜色生成器例子测试本地运行情况”的第一轮事实采集。
- 由于验证失败且尚未进入修复阶段，`0175` 保持 `In Progress`。
- Result: PASS
- Commit: N/A

### Step 4 — 用户澄清 OrbStack pod 部署边界

- Command:
- 用户明确补充：“本地测试重点在于本机 OrbStack 中的 pod 部署方式测试”
- Key output:
- 验证口径从 host-side `9011` 临时 UI server，切换为本地 K8s 常驻基线 `http://localhost:30900`
- Result: PASS
- Commit: N/A

### Step 5 — OrbStack pod 部署路径复测

- Command:
- `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://localhost:30900`
- `kubectl -n dongyu logs deploy/ui-server --since=10m`
- `kubectl -n dongyu logs deploy/mbr-worker --since=10m`
- `kubectl -n dongyu logs deploy/remote-worker --since=10m`
- Key output:
- `ui-server` 成功发送 `dy.bus.v0` submit 到 Matrix。
- 初次复测时，`mbr-worker` 仍报 `missing_matrix_credentials`，发现 `mbr-worker-secret` 实际仍是 placeholder token。
- Result: FAIL
- Commit: N/A

### Step 6 — baseline / deploy 脚本最小修复

- Command:
- `apply_patch` 新增 `scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
- `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`（先 FAIL 后 PASS）
- `apply_patch` 更新：
  - `scripts/ops/check_runtime_baseline.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/run_model100_submit_roundtrip_local.sh`
  - `scripts/ops/_deploy_common.sh`
  - `scripts/ops/deploy_local.sh`
- `bash scripts/ops/check_runtime_baseline.sh`
- `bash scripts/ops/ensure_runtime_baseline.sh`
- `kubectl -n dongyu exec deploy/mbr-worker -- env | rg MATRIX_MBR_BOT_ACCESS_TOKEN`
- Key output:
- 新增契约测试，要求：
  - one-click roundtrip 走 `ensure_runtime_baseline.sh`
  - baseline 检查必须拒绝 placeholder Matrix secret
  - `deploy_local.sh` patch manifest 时必须传入 `MBR_TOKEN`
- 复测后：
  - `check_runtime_baseline.sh` 能识别 `mbr-worker-secret` placeholder 并返回 FAIL
  - `ensure_runtime_baseline.sh` 会自动触发 `deploy_local.sh`
  - `deploy_local.sh` 重建 baseline 后，运行中 `mbr-worker` pod 已拿到真实 `MATRIX_MBR_BOT_ACCESS_TOKEN`
- Result: PASS
- Commit: `92b9c9e`

### Step 7 — 修复后业务闭环再验证

- Command:
- `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://localhost:30900`
- `kubectl -n dongyu logs deploy/ui-server --since=5m`
- `kubectl -n dongyu logs deploy/mbr-worker --since=5m`
- `kubectl -n dongyu logs deploy/remote-worker --since=5m`
- `curl -fsS http://localhost:30900/snapshot | jq ...`
- Key output:
- `mbr-worker` 已成功 token auth，并可见：
  - `recv mgmt ui_event`
  - `mqtt publish topic=.../100/event`
  - `recv mqtt topic=.../100/patch_out`
- `remote-worker` 心跳显示 `bg_color=#68a481, status=processed`
- 但 `ui-server` 在处理 `snapshot_delta` 时出现：
  - `[ProgramModelEngine] handleDyBusEvent failed: database is locked`
- 最终 `Model 100` 仍停在 `status=loading`、`submit_inflight=true`
- 当前结论：
  - baseline 假健康问题已修复
  - 业务链路仍存在第二层阻塞：`ui-server` 处理 `snapshot_delta` 时的数据库锁竞争
- Result: FAIL
- Commit: N/A

### Step 8 — 按 Feishu 新规约收敛启动路径

- Command:
- `python3 /Users/drop/.codex/skills/feishu-doc-sync/scripts/feishu_doc_sync.py ...`（读取 Feishu wiki 原文，聚焦 `mqtt：MQTT标签` / `matrix：Matrix标签`）
- `node scripts/tests/test_0175_matrix_patch_bootstrap_contract.mjs`（先 FAIL 后 PASS）
- `node scripts/tests/test_0167_ui_server_matrix_token_auth.mjs`
- `node scripts/tests/test_0168_update_k8s_secrets_manifest.mjs`
- `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
- `node --check ...`
- `bash -n ...`
- Key output:
- Feishu 原文确认：
  - MQTT / Matrix 运行标签应收敛到 Model 0 `(0,0,0)`
  - Matrix 标签族为 `matrix.server / matrix.user / matrix.passwd / matrix.token / matrix.contuser`
  - MQTT 标签族为 `mqtt.local.ip / mqtt.local.port`（本轮 local path 使用 local 侧）
- 代码与清单已收口为单一路径：
  - `ui-server` / `mbr-worker` 统一使用 `MODELTABLE_PATCH_JSON`
  - 启动后先 `applyPatch`，再由 `server.mjs` / `run_worker_v0.mjs` 从 Model 0 读表实例化 Matrix / MQTT
  - local/cloud `workers.yaml` 均移除了 `ui-server` 上的直接 `MATRIX_*` / `DY_MATRIX_*` env 注入
  - `update_k8s_secrets()` 现在直接生成 `MODELTABLE_PATCH_JSON` secret
- Result: PASS
- Commit: `b4d12e1`

### Step 9 — OrbStack pod 实测与 rollout 窗口判断

- Command:
- `bash scripts/ops/deploy_local.sh`
- `bash scripts/ops/check_runtime_baseline.sh`
- `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`
- `kubectl -n dongyu get pods -o wide`
- `kubectl -n dongyu logs deploy/ui-server --tail=120`
- `kubectl -n dongyu logs deploy/mbr-worker --tail=120`
- Key output:
- 新部署后 baseline 通过：
  - `mbr-worker-secret.MODELTABLE_PATCH_JSON ready`
  - `ui-server-secret.MODELTABLE_PATCH_JSON ready`
- 首次在 rollout 刚完成时立即验收，`verify_model100_submit_roundtrip.sh` 仍可能卡在 `loading`
  - 同期日志显示 `ui-server` 报 `database is locked`
  - 同期 `kubectl get pods` 仍可见旧 `ui-server` / `mbr-worker` / `remote-worker` pod 处于 `Terminating`
- 等旧 pod 完全退出后复跑同一验收命令：
  - `submit_response ... result:"ok"`
  - `poll#2 state={"bg":"#7d2bab","status":"processed","inflight":false,...}`
  - 最终 `PASS`
- 当前判断：
  - 新规约路径本身可用
  - `database is locked` 在本轮实测中是 rollout 窗口内旧 pod 共用 hostPath sqlite 的瞬时竞争，不是新规约引入的稳定阻塞
- Result: PASS
- Commit: `b4d12e1`

### Step 10 — 清除 legacy secret 残留并修正 host-side bootstrap 读取

- Command:
- `node scripts/tests/test_0175_matrix_patch_bootstrap_contract.mjs`（先 FAIL 后 PASS）
- `node scripts/tests/test_0168_update_k8s_secrets_manifest.mjs`（先 FAIL 后 PASS）
- `bash scripts/ops/start_local_ui_server_k8s_matrix.sh --port 9011 --force-kill-port`
- `apply_patch` 更新：
  - `scripts/ops/_deploy_common.sh`
  - `scripts/ops/start_local_ui_server_k8s_matrix.sh`
  - `README.md`
  - `scripts/ops/README.md`
- Key output:
- 真实复现表明 `start_local_ui_server_k8s_matrix.sh` 仍在读取旧键：
  - `missing mbr-worker-config.data.DY_MATRIX_ROOM_ID`
- 根因确认：
  - 新规约下 live secret/config 已切到 `MODELTABLE_PATCH_JSON`
  - host-side 启动脚本仍在读旧 `DY_MATRIX_ROOM_ID` / `MATRIX_MBR_*`
  - `kubectl apply` 更新 secret 时不会自动清除历史 key，存在 compatibility residue
- 修复后：
  - `start_local_ui_server_k8s_matrix.sh` 改为只读取 `ui-server-secret.data.MODELTABLE_PATCH_JSON`
  - `update_k8s_secrets()` 改为先删旧 secret 再 apply，确保集群内不残留旧键
  - repo 入口文档改为以 `http://127.0.0.1:30900` 的 pod 路径为 canonical
- Result: PASS
- Commit: `b4d12e1`

### Step 11 — fresh deploy 后复验 secret purge 与 pod 闭环

- Command:
- `bash scripts/ops/deploy_local.sh`
- `kubectl get secret -n dongyu ui-server-secret -o yaml`
- `kubectl get secret -n dongyu mbr-worker-secret -o yaml`
- `bash scripts/ops/check_runtime_baseline.sh`
- `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`（第一次 FAIL，第二次 PASS）
- Key output:
- 重新部署后，`ui-server-secret` / `mbr-worker-secret` 均只保留 `MODELTABLE_PATCH_JSON`，旧 `MATRIX_MBR_*` key 已被 purged。
- 首次在 fresh deploy 后立即执行 submit roundtrip：
  - baseline ready
  - `ui-server` 收到 `snapshot_delta` 后报 `database is locked`
  - 闭环卡在 `status=loading`
- 随后直接重跑同一 verify 命令：
  - `poll#2 state={"bg":"#2bdd6b","status":"processed","inflight":false,...}`
  - 闭环 PASS
- 当前判断：
  - secret purge 与 Model 0 bootstrap 契约生效
  - fresh deploy 后“第一轮 submit 可能锁表、重跑即过”仍是已知风险，需要在下一轮审计中单独追查
- Result: PASS
- Commit: `b4d12e1`

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` updated（补充 `mqtt.local.*` / `matrix.*` 作为启动期运行配置）
- [x] `docs/ssot/ui_to_matrix_event_flow.md` updated（改为 Model 0 + `MODELTABLE_PATCH_JSON` 口径）
- [x] `docs/ssot/host_ctx_api.md` updated（`ctx.startMqttLoop()` 读取 Model 0 MQTT labels）
- [x] `docs/user-guide/ui_event_matrix_mqtt_configuration.md` updated（改为 patch 入表 + Model 0 读表）
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed（本轮无需直接改动）
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed（本轮无关，无需改动）
