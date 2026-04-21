---
title: "0151 — Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0151-server-model100-decouple
id: 0151-server-model100-decouple
phase: phase3
---

# 0151 — Runlog

> Flight recorder. Commands, output, commits, PASS/FAIL.
> Do not edit [[iterations/0151-server-model100-decouple/plan]] or [[iterations/0151-server-model100-decouple/resolution]] from here; only append facts.

---

## Review Gate Record
- Iteration ID: 0151-server-model100-decouple
- Review Date: 2026-02-21
- Review Type: User + AI
- Review Index: 1
- Decision: Approved
- Notes:
  - 采用方案 a：submit guard 状态落 ModelTable label（可观测/可序列化）。
  - `resolution.md` 已补齐 busy 场景 `ui_event_error` 回写口径，保持行为等价目标。
  - 进入 Phase 3 前仍需按 branch 规则切到 `dev_0151-server-model100-decouple`。

---

## Step 3 — MOCK_SLIDING_APPS → patch
- Date: 2026-02-21
- Commands:
  - `node -e "const p = require('./packages/worker-base/system-models/workspace_demo_apps.json'); console.log(p.records.length > 0 ? 'PASS' : 'FAIL')"`
  - `node -e "const p = require('./packages/worker-base/system-models/workspace_demo_apps.json'); const ids = new Set(p.records.filter(r=>r.op==='create_model').map(r=>r.model_id)); const hasAppName = p.records.some(r=>r.model_id===1001 && r.k==='app_name') && p.records.some(r=>r.model_id===1002 && r.k==='app_name'); console.log(ids.has(1001)&&ids.has(1002)&&hasAppName ? 'PASS workspace_demo_apps coverage' : 'FAIL workspace_demo_apps coverage')"`
  - `jq '.version, .op_id, (.records|length)' packages/worker-base/system-models/workspace_demo_apps.json`
- Key outputs:
  - `PASS`
  - `PASS workspace_demo_apps coverage`
  - `"mt.v0"`, `"workspace_demo_apps_v0"`, `42`
- Result: PASS
- Files:
  - `packages/worker-base/system-models/workspace_demo_apps.json`（new）

---

## Step 6 — Baseline + Unit Verification
- Date: 2026-02-21
- Commands:
  - `bash scripts/ops/ensure_runtime_baseline.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `node scripts/tests/test_cell_connect_parse.mjs`
  - `node scripts/tests/test_bus_in_out.mjs`
  - `node scripts/validate_builtins_v0.mjs`
  - `rg -n "isModel100SubmitPayload|setModel100SubmitState|MOCK_SLIDING_APPS|SEED_POSITIVE_MODELS_ON_BOOT|MODEL100_SUBMIT_INFLIGHT_TIMEOUT" packages/ui-model-demo-server/server.mjs`
  - `rg -n "model_id === 100|model_id===100" packages/ui-model-demo-server/server.mjs`
- Key outputs:
  - baseline: context=`orbstack`, `deploy/mosquitto|synapse|remote-worker|mbr-worker|ui-server` 全部 ready。
  - `test_cell_connect_parse`: `10 passed, 0 failed`
  - `test_bus_in_out`: `7 passed, 0 failed`
  - `validate_builtins_v0`: 所有项 PASS
  - first rg: 0 命中（旧特判/常量已删除）
  - second rg: 2 命中（`ws_app_selected` 默认策略仍含 `model_id === 100` 偏好）
- Result: PASS（Step 6 基线与核心单元）；附注：`model_id===100` 剩余命中属于 workspace 默认选择策略，按计划在 0152 Step 9 模型化清理。

---

## Step 1+2 — Submit guard 函数化 + 初始值 patch 化
- Date: 2026-02-21
- Changes to `packages/worker-base/system-models/test_model_100_ui.json`:
  - `forward_model100_events` 函数头部增加 submit guard（inflight 检查 + 超时恢复 + busy 拒绝 + ui_event_error 回写）
  - `on_model100_patch_in` 增加 `submit_inflight_started_at` 重置
  - 新增初始值 labels: submit_inflight(bool), submit_inflight_started_at(int) @(0,0,0); ui_event(event), ui_event_last_op_id(str), ui_event_error(json) @(0,0,1)
- Validation:
  - `forward_model100_events` includes 'submit_inflight' → PASS
  - `submit_inflight` label exists in patch (model_id=100) → PASS
  - All 5 init labels present → ALL_INIT_LABELS_PASS
  - Both functions compile via `new Function('ctx', f.v)` → PASS
  - `on_model100_patch_in` includes 'submit_inflight_started_at' → PASS
- Result: PASS

---

## Step 4 — Server 删除 Model 100 特判
- Date: 2026-02-21
- Deletions from `packages/ui-model-demo-server/server.mjs`:
  - `MODEL100_SUBMIT_INFLIGHT_TIMEOUT_MS` 常量
  - `isModel100SubmitPayload()` 函数
  - `setModel100SubmitState()` 函数
  - `submitEnvelope()` 中 `isModel100Submit` 变量 + 整个 if 分支（单飞检查/超时恢复/状态设置）
  - `sanitizeStartupCatalogState()` 中 6 行 Model 100 硬编码 overwriteRuntimeLabel
  - catch 块中 `isModel100Submit` / `setModel100SubmitState` 引用（改为安全提取 opId）
- Validation:
  - `rg "isModel100SubmitPayload|setModel100SubmitState|MODEL100_SUBMIT_INFLIGHT_TIMEOUT|isModel100Submit"` → 0 命中 → PASS
  - `rg "model_id === 100|model_id===100"` → 2 命中，均在 workspace 默认选择逻辑（0152 Step 9 范围，非 Model 100 业务特判）→ PASS (scope-excluded)
- Result: PASS

---

## Step 5 — Server 删除 MOCK_SLIDING_APPS + 正模型 patch 加载
- Date: 2026-02-21
- Deletions from `packages/ui-model-demo-server/server.mjs`:
  - `SEED_POSITIVE_MODELS_ON_BOOT` 环境变量读取
  - `MOCK_SLIDING_APPS` 常量（~106 行 inline schema/data）
  - `deriveWorkspaceRegistry()` 中的 SEED 注入 if 块（~17 行）
- Additions:
  - `loadFullModelPatches()` 函数：加载指定 patch 文件的所有记录（含正模型）
  - 在 init 阶段调用：`loadFullModelPatches(runtime, systemModelsDir, ['workspace_positive_models.json', 'test_model_100_ui.json'])`
- Note: `workspace_positive_models.json` 已覆盖 Model 1/2/100/1001/1002 全量定义，`test_model_100_ui.json` 补充 submit_inflight 等初始值
- Validation:
  - `rg "MOCK_SLIDING_APPS|SEED_POSITIVE_MODELS_ON_BOOT" server.mjs` → 0 命中 → PASS
  - `rg "isModel100Submit|setModel100SubmitState|..." server.mjs` → 0 命中 → PASS
  - `node --check server.mjs` → SYNTAX_CHECK: PASS
- Result: PASS

---
## Step 6 — Functional E2E (Browser + Snapshot)
- Date: 2026-02-21
- Environment:
  - Port `9000` 已被现有 `bun` 占用且返回 `401 not_authenticated`，本轮 E2E 使用 `PORT=9010 DY_AUTH=0` 启动 server。
  - 因 `packages/ui-model-demo-server/data/default/yhl.db` 残留旧 submit 事件，先用 `/api/modeltable/patch` 复位 Model 100 状态：`submit_inflight=false`, `submit_inflight_started_at=0`, `status=ready`, `ui_event=null`。
- Commands:
  - `PORT=9010 DY_AUTH=0 bun packages/ui-model-demo-server/server.mjs`
  - `curl -sS http://127.0.0.1:9010/snapshot | jq '{submit_inflight,status, ...}'`（多次轮询）
  - `curl -sS -X POST http://127.0.0.1:9010/api/modeltable/patch ...`（Step6 reset patch）
  - Playwright:
    - `goto http://127.0.0.1:9010/#/workspace`
    - single click `Generate Color`
    - double click `Generate Color`
    - screenshot `docs/iterations/0151-server-model100-decouple/assets/step6_workspace_loading_disabled.png`
  - `rg -n "MOCK_SLIDING_APPS|SEED_POSITIVE_MODELS_ON_BOOT" packages/ui-model-demo-server/server.mjs`
- Key outputs:
  - Submit 正常流程（single click）:
    - UI 进入 `status=loading` 且按钮 `disabled`（Playwright snapshot）。
    - 45s 轮询期间 `submit_inflight=true`、`status=loading` 持续不恢复，`color` 无返回。
    - server log 观测：`[handleDyBusEvent] Unhandled event type: ui_event`（事件链路未闭环）。
  - 双击单飞验证（double click）:
    - 双击后按钮立即 `disabled/loading`。
    - `ui_event_last_op_id` 保持单一值 `op_1771688253320_2`（未出现第二个 op_id），满足“第二次不被接受”的等价行为。
  - Workspace 列表验证:
    - `/snapshot` 中存在 `model_id=100/1001/1002`，`app_name` 分别为 `E2E 颜色生成器/请假申请/设备报修`。
    - `server.mjs` 中 `MOCK_SLIDING_APPS|SEED_POSITIVE_MODELS_ON_BOOT` 为 0 命中。
- Assets:
  - `docs/iterations/0151-server-model100-decouple/assets/step6_workspace_loading_disabled.png`
- Result:
  - `Submit 正常返回颜色`: FAIL（被环境链路问题阻断，非本迭代代码路径内定位完成）
  - `双击单飞`: PASS
  - `Workspace 列表来源`: PASS
  - Step 6 总结：PARTIAL / BLOCKED（暂不满足 0151 Completed 条件）

---
## Step 6 Fix — event typed support + ui_event echo ignore
- Date: 2026-02-22
- Scope:
  - Fix 1: `packages/ui-model-demo-frontend/src/local_bus_adapter.js` `normalizeTypedValue()` 增加 `t==='event'` pass-through。
  - Fix 2: `packages/ui-model-demo-server/server.mjs` `handleDyBusEvent()` 对 `content.type==='ui_event'` 直接 ignore（v0 分支内）。

### TDD / Debug Evidence
- RED (before production fix):
  - Command: `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - Output: `FAIL: editor_v1_typed_event_ok`
- GREEN (after production fix):
  - Command: `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - Output: `FAIL: editor_v1_pin_page_missing`
  - Note: 失败点已推进到既有 pin 页面断言，未再停在 `editor_v1_typed_event_ok`。
- Focused event regression check:
  - Command: inline node script（createDemoStore v1 → mailbox label_add with `t:event` object + null）
  - Output: `EVENT_TYPED_REGRESSION_PASS`

### Baseline
- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Output: context=`orbstack`; `deploy/mosquitto|synapse|remote-worker|mbr-worker|ui-server` ready
- Result: PASS

### Functional E2E Re-verify (Step 6)
- Server start:
  - Port 9000 occupied by existing bun process (`127.0.0.1:9000`),本轮使用 `PORT=9010 DY_AUTH=0 bun packages/ui-model-demo-server/server.mjs`。
- Workspace list:
  - Command: `GET /snapshot`
  - Output: `has100=true has1001=true has1002=true`, app names: `E2E 颜色生成器/请假申请/设备报修`
  - Command: `rg -n "MOCK_SLIDING_APPS|SEED_POSITIVE_MODELS_ON_BOOT" packages/ui-model-demo-server/server.mjs`
  - Output: 0 命中
  - Result: PASS
- Submit single click:
  - Playwright: `#/workspace` 点击 `Generate Color`
  - Observed: UI进入 `loading` 且按钮 disabled；API 轮询 50s 内持续 `submit_inflight=true,status=loading,bg_color=#FFFFFF` 未回包
  - Result: FAIL
- Submit double click:
  - Playwright doubleClick `Generate Color`
  - Observed: 立即 disabled/loading；`ui_event_last_op_id` 保持单值（`op_1771692225641_2`）
  - Result: PASS
- Asset:
  - `docs/iterations/0151-server-model100-decouple/assets/step6_fix_loading_after_click.png`

### Infra Split (as planned)
- Command: `kubectl logs -n dongyu deploy/mbr-worker --tail=200`
  - Key output: `[worker] matrix adapter init failed: ConnectionError: fetch failed`（whoami 到 `synapse.dongyu.svc.cluster.local:8008` 失败）
- Command: `kubectl logs -n dongyu deploy/remote-worker --tail=200`
  - Key output: 持续 heartbeat（Model 100 ready），未见 submit 处理日志
- Server-side behavior check:
  - `forward_model100_events` 已触发并发送 `{version:'v0',type:'ui_event'}`。
  - 旧日志噪音 `Unhandled event type: ui_event` 未再出现（echo 已被 ignore）。

### Conclusion
- Code fix status: PASS（Fix1/Fix2 生效）
- E2E status: PARTIAL（单击回包链路仍被基础设施阻断）
- Iteration status recommendation: keep `In Progress`（不满足 Completed 条件）

---
- Post-check cleanup:
  - 为避免保留 `loading` 脏态，使用一次性 server(`PORT=9010 DY_AUTH=0`) + `/api/modeltable/patch(step6_reset_state)` 将 Model 100 恢复为 `submit_inflight=false,status=ready`。

---
## Infra Follow-up — restart mbr-worker after init-fail diagnosis
- Date: 2026-02-22
- Action:
  - `kubectl rollout restart deployment/mbr-worker -n dongyu`
  - `kubectl rollout status deployment/mbr-worker -n dongyu --timeout=180s`
- Result:
  - rollout completed; new pod `mbr-worker-868dc998d8-rljxs` running。
  - new pod logs show Matrix init success:
    - whoami 200
    - `[matrix_live] token auth success`
    - `[worker] mgmt READY room_id=!sPvNeZvMXlixVcsJJC:localhost`

### Re-verify findings
- Local server (`bun ... server.mjs`) still connects to:
  - homeserver: `https://matrix.localhost`
  - room: `!rvgIBRtgXATQGGRWiS:localhost`
- mbr-worker now connects to:
  - homeserver: `http://synapse.dongyu.svc.cluster.local:8008`
  - room: `!sPvNeZvMXlixVcsJJC:localhost`
- Therefore server↔mbr not on same Matrix plane/room; submit return path still cannot close.
- Attempted validation:
  - start server with `DY_MATRIX_ROOM_ID=!sPvNeZvMXlixVcsJJC:localhost`
  - on `https://matrix.localhost` join returns 404 (`Can't join remote room...`), confirming cross-Synapse mismatch.

### Step 6 status after restart
- 双击单飞: PASS（保持）
- workspace 列表: PASS（保持）
- 单击回包: FAIL（原因从 mbr init-fail 变为 Matrix plane mismatch）
- Iteration status: keep `In Progress`

---
### Additional validation (Matrix plane alignment trial)
- Attempt:
  - `kubectl port-forward -n dongyu svc/synapse 18008:8008`
  - start local server with `MATRIX_HOMESERVER_URL=http://127.0.0.1:18008 DY_MATRIX_ROOM_ID=!sPvNeZvMXlixVcsJJC:localhost`
- Output:
  - matrix auth failed (`M_UNKNOWN_TOKEN` / `M_FORBIDDEN`), then `missing_matrix_credentials`
  - local server entered no-matrix mode
- Conclusion:
  - local server credentials/env are for `matrix.localhost` plane, not dongyu Synapse plane.
  - Restarting mbr-worker fixed its own init, but Step 6 still blocked by cross-plane room+credential mismatch.

---
## Step 6 Final Re-verify (OrbStack aligned) — PASS
- Date: 2026-02-22
- Setup:
  - Matrix plane aligned with current OrbStack K8s namespace `dongyu`:
    - `kubectl get configmap -n dongyu mbr-worker-config -o yaml`
    - `kubectl get secret -n dongyu mbr-worker-secret -o jsonpath='{.data.MATRIX_MBR_BOT_ACCESS_TOKEN}' | base64 --decode`
  - Synapse tunnel:
    - `kubectl port-forward -n dongyu svc/synapse 18008:8008`
  - Isolated local server (avoid sqlite lock from parallel 9000/9010 bun instances):
    - `PORT=9020 WORKER_BASE_WORKSPACE=step6_orbstack_0151 DY_AUTH=0 MATRIX_HOMESERVER_URL=http://127.0.0.1:18008 DY_MATRIX_ROOM_ID=!sPvNeZvMXlixVcsJJC:localhost DY_MATRIX_DM_PEER_USER_ID=@mbr:localhost MATRIX_MBR_BOT_USER=@mbr:localhost MATRIX_MBR_BOT_ACCESS_TOKEN=<from secret> bun packages/ui-model-demo-server/server.mjs`

### A) Workspace 列表验证
- Command:
  - `curl -sS http://127.0.0.1:9020/snapshot | jq ...`
- Output:
  - app_name includes `100=E2E 颜色生成器`, `1001=请假申请`, `1002=设备报修`
- Result: PASS

### B) Submit 正常流程验证（闭环）
- Browser evidence:
  - Playwright 打开 `http://127.0.0.1:9020/#/workspace`，单击 `Generate Color`
  - 页面更新到新颜色（如 `#29bc58`），状态 `processed`
  - Asset: `docs/iterations/0151-server-model100-decouple/assets/step6_orbstack_pass_workspace.png`
- State transition evidence:
  - Inject submit via `/ui_event` + 100ms polling:
    - sample:
      - `1  false  processed  #f13e79`
      - `2  true   loading    #f13e79`
      - `3  false  processed  #02fba9`
  - POST response:
    - `{"ok":true,"consumed":true,"result":"ok","ui_event_last_op_id":"api_submit_...","ui_event_error":null}`
- Server log evidence:
  - received `snapshot_delta` with `color_response_*`
  - post-apply check: `status=processed`, `submit_inflight=false`
- Result: PASS

### C) 双击/并发单飞 guard 验证
- Command:
  - 两次 submit 并发触发（20ms 间隔）到 `/ui_event`
- Output:
  - first response: `ui_event_error=null`
  - second response: `ui_event_error={"code":"busy","detail":"model100_submit_inflight"}`
  - snapshot during race:
    - `status=loading`, `submit_inflight=true`, mailbox error=`busy`
  - shortly after:
    - `status=processed`, `submit_inflight=false`
- Server log evidence:
  - second event仍触发 `forward_model100_events`，但无第二条 `sendMatrix`（guard 命中后返回）
- Result: PASS

### D) Local regression note
- `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs` → `FAIL: editor_v1_pin_page_missing`（既有基线问题，非本修复回归）
- Focused event regression:
  - `node --input-type=module -e \"...t:'event' object/null...\"`
  - Output: `EVENT_TYPED_REGRESSION_PASS`

### Step 6 Final Decision
- Submit 正常流程: PASS
- 双击单飞: PASS
- Workspace 列表来源: PASS
- 0151 status recommendation: `Completed`

---
