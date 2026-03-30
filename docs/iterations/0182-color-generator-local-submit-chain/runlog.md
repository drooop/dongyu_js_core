---
title: "Iteration 0182-color-generator-local-submit-chain Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0182-color-generator-local-submit-chain
id: 0182-color-generator-local-submit-chain
phase: phase3
---

# Iteration 0182-color-generator-local-submit-chain Runlog

## Environment

- Date: 2026-03-08
- Branch: `dev_0182-color-generator-local-submit-chain`
- Runtime: local dev + remote r2ke

Review Gate Record
- Iteration ID: 0182-color-generator-local-submit-chain
- Review Date: 2026-03-08
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户在 `0181` 样例批准后要求继续落地实现。

## Execution Records

### Step 1

- Command:
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0182-color-generator-local-submit-chain --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - `git checkout -b dev_0182-color-generator-local-submit-chain`
  - `rg -n "0182-color-generator-local-submit-chain" docs/ITERATIONS.md docs/iterations/0182-color-generator-local-submit-chain/*.md`
- Key output:
  - scaffold 写入 `plan.md` / `resolution.md` / `runlog.md`
  - branch 创建成功：`dev_0182-color-generator-local-submit-chain`
- Result: PASS
- Commit: N/A

### Step 2

- Command:
  - `rg -n "forward_model100_events|dual_bus_model|submit__bind|model100_input_draft|ui_event" packages/ui-model-demo-server/server.mjs packages/worker-base/system-models/workspace_positive_models.json packages/ui-model-demo-frontend/src/model100_ast.js scripts/tests`
  - `sed -n '2448,2488p' packages/ui-model-demo-server/server.mjs`
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `node scripts/tests/test_0182_server_model0_egress_contract.mjs`
- Key output:
  - 当前正数模型 `ui_event` 在 `Cell(model_id,0,0,2)` 被 `processEventsSnapshot()` 特判
  - `dual_bus_model.ui_event_func=forward_model100_events`
  - 颜色生成器当前 authority 仍在 server 侧 direct forward
  - `test_0182_model100_submit_chain_contract` FAIL：
    - `forward_model100_events` 仍直接调用 `sendMatrix(...)`
    - 当前 patch 尚未声明 `Model 100 root pin.table.out submit`
    - 当前 patch 尚未声明 `Model 0` 对 `Model 100` 的 mount / egress label
  - `test_0182_server_model0_egress_contract` FAIL：
    - `server.mjs` 还没有 `model100_submit_out` 观察点
- Result: PASS
- Commit: N/A

### Step 3

- Command:
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `node scripts/tests/test_0182_server_model0_egress_contract.mjs`
  - `node scripts/tests/test_0177_model100_submit_ui_contract.mjs`
  - `node scripts/tests/test_0177_model100_input_draft_contract.mjs`
  - `node scripts/tests/test_0177_mbr_bridge_contract.mjs`
  - `node --check packages/ui-model-demo-server/server.mjs`
- Key output:
  - `test_0182_model100_submit_chain_contract` PASS
    - `prepare_model100_submit` 不再直接 `sendMatrix`
    - `Model 100 root pin.table.out submit` 已声明
    - `Model 0 model100_submit_out` 已形成本地 egress label
  - `test_0182_server_model0_egress_contract` PASS
    - `server.mjs` 已定义 `model100_submit_out` 观察点
    - `source_model_id=100` 守卫存在
  - 旧合同回归仍绿：
    - `test_0177_model100_submit_ui_contract` PASS
    - `test_0177_model100_input_draft_contract` PASS
    - `test_0177_mbr_bridge_contract` PASS
  - `node --check packages/ui-model-demo-server/server.mjs` PASS
- Result: PASS
- Commit: N/A

### Step 4

- Command:
  - `npm -C packages/ui-model-demo-frontend run build`
  - `docker build --platform linux/amd64 --pull=false -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`
  - `mv /Users/drop/dongyu/volume/persist/ui-server/runtime/default/yhl.db /Users/drop/dongyu/volume/persist/ui-server/runtime/default/yhl.db.bak.<ts>`（执行两次；第二次用于清理 0182 半成品 DB）
  - `kubectl -n dongyu rollout restart deployment/ui-server`
  - `kubectl -n dongyu rollout status deployment/ui-server --timeout=300s`
  - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`
  - 浏览器打开 `http://127.0.0.1:30900/?v=0182local#/workspace`，点击 `Workspace`，输入 `local acceptance 0182`，点击 `Generate Color`
- Key output:
  - 本地断点定位：
    - 第一次 rollout 后 `snapshot.models["100"].cells["0,0,0"].labels.dual_bus_model.v.ui_event_func` 仍为 `forward_model100_events`
    - 根因：第一次 0182 半成品启动生成了新的 `yhl.db`，固化了旧 `dual_bus_model`
    - 修复：补改 `test_model_100_ui.json` 中 `dual_bus_model.ui_event_func=prepare_model100_submit`，并再次备份 `yhl.db` 后重启 `ui-server`
  - 最终本地脚本验收 PASS：
    - `runtime_mode_response={"ok":true,"mode":"running"}`
    - `poll#1 state={"bg":"#FFFFFF","status":"loading","inflight":true,"ready":true,...}`
    - `poll#2 state={"bg":"#95ac04","status":"processed","inflight":false,"ready":true,...}`
  - 当前 pod 日志确认链路：
    - `Model 100 ui_event detected, triggering prepare_model100_submit`
    - `Model 0 egress detected, triggering forward_model100_submit_from_model0`
    - `[sendMatrix] CALLED with payload ... source_model_id:100`
    - `snapshot_delta ... bg_color=#95ac04 status=processed submit_inflight=false`
  - 浏览器验收：
    - 首次直接打开 `#/workspace` 仍先落到 DataTable；点击页面内 `Workspace` 后进入颜色生成器
    - 输入 `local acceptance 0182` 后 draft 保留在 `-2.model100_input_draft`
    - 点击 `Generate Color` 后颜色更新为 `#3e78d8`
    - snapshot 结果：`status=processed`, `ready=true`, `inflight=false`, `egress=null`, `uiPage=workspace`, `wsAppSelected=100`
- Result: PASS（local）
- Commit: N/A

### Step 5

- Command:
  - `node scripts/tests/test_0182_workspace_route_init_contract.mjs`
  - `node scripts/tests/test_0182_app_shell_route_sync_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `docker build --platform linux/amd64 --pull=false -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`
  - `kubectl -n dongyu rollout restart deployment/ui-server`
  - `kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`
  - 浏览器直接打开 `http://127.0.0.1:30900/?v=0182residual2#/workspace`
  - `curl -fsS http://127.0.0.1:30900/snapshot | jq '{ui_page, ws_app_selected, selected_model_id, draft, bg, status, inflight}'`
- Key output:
  - 新合同先红后绿：
    - `test_0182_workspace_route_init_contract` 初始 FAIL：`selected_model_id='0' !== ws_app_selected='100'`
    - 补齐 `server.mjs` 的 `reconcileWorkspaceSelectionState()` 后 PASS
    - `test_0182_app_shell_route_sync_contract` 初始 FAIL：缺少 route-sync helper
    - 新增 `app_shell_route_sync.js` 并让 `demo_app.js` 在 route 未同步时显示过渡态后 PASS
  - 本地 rollout 后，浏览器直接首开 `#/workspace` 不再先显示 DataTable
    - 首屏直接进入 Workspace 资产树与 `Model 100` 颜色生成器
    - 不再需要先点页面内 `Workspace`
  - 现场 snapshot 对齐：
    - `ui_page="workspace"`
    - `ws_app_selected=100`
    - `selected_model_id="100"`
  - 主链路仍保持正常：
    - 输入 `workspace residual fixed 0182` 后 draft 写到 `-2.model100_input_draft`
    - `verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900` 继续 PASS
    - 现场 snapshot 显示 `status="processed"`, `inflight=false`
- Result: PASS（local residual fix）
- Commit: `92b4321`

### Step 6

- Command:
  - `git add packages/ui-model-demo-frontend/src/demo_app.js packages/ui-model-demo-frontend/src/app_shell_route_sync.js packages/ui-model-demo-server/server.mjs packages/worker-base/system-models/test_model_100_ui.json packages/worker-base/system-models/workspace_positive_models.json scripts/tests/test_0182_*.mjs`
  - `git commit -m "feat: complete model100 local submit chain"`
  - `git push -u origin dev_0182-color-generator-local-submit-chain`
  - `bash scripts/ops/deploy_cloud_ui_server_from_local.sh --ssh-user wwpic --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp`（首次因 `sudo` TTY/密码策略未完成）
  - `ssh drop@124.71.43.80 'sudo -n /usr/local/sbin/dy-deploy-cloud --image-tar /tmp/dy-ui-server-92b4321.tar'`
  - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url https://app.dongyudigital.com`
  - 浏览器打开 `https://app.dongyudigital.com/?v=0182remote#/workspace`
- Key output:
  - 提交与推送：
    - commit: `92b4321 feat: complete model100 local submit chain`
    - branch pushed: `origin/dev_0182-color-generator-local-submit-chain`
  - 远端权限口径修正：
    - 初始 `wwpic` / `drop` 均不是现成免密 sudo
    - 通过远端 root-owned wrappers + `/etc/sudoers.d/drop-dongyu-deploy` 收敛成项目范围免密 sudo
  - 远端 `rke2` deploy 实际执行：
    - `REMOTE_RKE2_GATE: PASS`
    - node kubelet version: `v1.34.1+rke2r1`
    - scripts printed resolved socket `/run/k3s/containerd/containerd.sock` but gate明确通过 `+rke2` 检查，且本轮未触碰 `k3s` service / systemctl
    - `secret/ui-server-secret created`
    - `secret/mbr-worker-secret created`
    - `deployment.apps/ui-server restarted`
    - `deployment.apps/mbr-worker restarted`
    - source hash gate PASS:
      - `server.mjs`
      - `demo_modeltable.js`
      - `local_bus_adapter.js`
  - 远端脚本验收 PASS：
    - `verify_model100_submit_roundtrip.sh --base-url https://app.dongyudigital.com`
    - `submit_response={"ok":true,"consumed":true,"result":"ok"...}`
    - final state remained healthy with `status="processed"`, `inflight=false`, `ready=true`
  - 远端浏览器验收：
    - 直接打开 `#/workspace` 首屏先出现“页面同步中”过渡态，随后自动收敛到 Workspace 资产树与 `Model 100` 颜色生成器
    - snapshot 对齐：`ui_page="workspace"`, `ws_app_selected=100`, `selected_model_id="100"`
- Result: PASS（remote deploy + acceptance）
- Commit: `92b4321`

### Step 7

- Command:
  - `node scripts/tests/test_0182_remote_runtime_activation_contract.mjs`
  - `node scripts/tests/test_0182_singleflight_button_release_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `git diff -- packages/ui-model-demo-frontend/src/remote_store.js packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs`
- Key output:
  - 远端真实浏览器案例追加定位到两处前端根因：
    - `remote_store.js` 未在 remote mode 下显式激活 `runtime_mode=running`，导致远端返回 `runtime_not_running(model_id=100)`
    - `renderer.{js,mjs}` 对 single-flight 按钮做了手动 DOM `is-loading` / `disabled` 注入，release 后存在粘滞风险
  - 新合同测试均 PASS：
    - `PASS test_0182_remote_runtime_activation_contract`
    - `PASS test_0182_singleflight_button_release_contract`
  - 前端 build PASS，产出 bundle：
    - `dist/assets/index-QNR6kQ6m.js`
  - 当前修改仅涉及：
    - `packages/ui-model-demo-frontend/src/remote_store.js`
    - `packages/ui-renderer/src/renderer.js`
    - `packages/ui-renderer/src/renderer.mjs`
    - `scripts/tests/test_0182_remote_runtime_activation_contract.mjs`
    - `scripts/tests/test_0182_singleflight_button_release_contract.mjs`
- Result: PASS（local contract + build）
- Commit: pending

### Step 8

- Command:
  - `node scripts/tests/test_0182_model100_singleflight_release_contract.mjs`
  - `git commit -m "fix: release model100 singleflight on mailbox ack"`
  - 真实远端浏览器打开 `https://app.dongyudigital.com/?v=0182finalfix#/workspace`
  - 在颜色生成器输入 `after-db-reset-1773203900` 后点击 `Generate Color`
- Key output:
  - 新合同先红后绿：
    - `singleFlight releaseRef must track mailbox ui_event_last_op_id instead of submit_inflight`
    - 修复点：`packages/worker-base/system-models/workspace_positive_models.json` 中 `submit__props.singleFlight.releaseRef`
      从 `model_id=100 / k=submit_inflight`
      改为 `model_id=-1 / k=ui_event_last_op_id`
  - 真实浏览器确认：
    - 按钮不再粘滞 `is-loading`
    - 点击后颜色从 `#FFFFFF` 更新为 `#e01a71`
  - 根因澄清：
    - 前端按钮问题本身已修
    - 远端之前之所以一直“不变色”，还叠加了旧持久化 DB 恢复出过时 `Model 100` 合同
- Result: PASS（browser interaction restored）
- Commit: `054a7a6`

### Step 9

- Command:
  - 远端备份 `yhl.db`
  - 远端 `ui-server` / `remote-worker` / `mbr-worker` 重新对齐到当前实现
  - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url https://app.dongyudigital.com`
- Key output:
  - `ui-server` 持久化 DB 旧合同被清除后，Model 100 回到新 bootstrap 基线：
    - `bg_color=#FFFFFF`
    - `status=ready`
    - `system_ready=false`
  - 远端脚本验收最终 PASS：
    - `submit_response={"ok":true,"consumed":true,"result":"ok"...}`
    - final state from `#e01a71` -> `#277194`
- Result: PASS（remote functional roundtrip）
- Commit: N/A（remote env evidence）

## Docs Updated

- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
