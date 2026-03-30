---
title: "Color Generator E2E Runbook"
doc_type: user-guide
status: active
updated: 2026-03-21
source: ai
---

# Color Generator E2E Runbook

## 1. 目的

复现 Model 100（颜色生成器）的双总线链路：
UI Server -> Matrix (`dy.bus.v0`) -> MBR -> MQTT -> K8s Worker -> Matrix -> UI Server。

本 runbook 对应实测 iteration：`0134-color-generator-e2e-repro`。
补充验证：`0135-color-generator-patch-only-repro`（空 `yhl.db` 假设）。

## 2. 前置条件

1. 依赖服务可用：
- Matrix Homeserver
- MQTT Broker（1883）
- Node/Bun 运行时

2. `.env` 至少包含以下键：
- `MATRIX_HOMESERVER_URL`
- `MATRIX_MBR_USER` / `MATRIX_MBR_PASSWORD`
- `MATRIX_MBR_BOT_USER` / `MATRIX_MBR_BOT_ACCESS_TOKEN`（推荐）
- `MQTT_BROKER_HOST` / `MQTT_BROKER_PORT` / `MQTT_USERNAME` / `MQTT_PASSWORD`

3. 工作目录：仓库根目录。

## 2.1 Patch-only 可复现模式（推荐）

目标：避免仓库内 `yhl.db` 二进制差异，测试时将 `yhl.db` 视为“空白可重建”，由 JSON patch 驱动模型状态。

关键约束：
1. 负数模型（系统基座）在初始化时加载：
- `packages/ui-model-demo-server/server.mjs` 中 `loadSystemModelPatches(...)` 会加载 `system-models/*.json`。
- `scripts/worker_engine_v0.mjs` 中 `loadSystemPatch(...)` 会加载 `system_models.json`。
  - 注意：`server.mjs` 当前会过滤为 `model_id < 0` 记录后再应用。
2. 正数模型（业务模型）由测试流程注入：
- K8s Worker 在 `scripts/run_remote_worker_k8s_v2.mjs` 先 `startMqttLoop`，再 `applyPatch(test_model_100_full.json)`。
- UI Server 侧运行时配置可通过 `MODELTABLE_PATCH_JSON` 注入（如 room 绑定标签）。

证据索引（0135）：
- `docs/iterations/0135-color-generator-patch-only-repro/assets/patch_loading_evidence.txt`
- `docs/iterations/0135-color-generator-patch-only-repro/assets/runtime_env_0135.txt`

## 2.2 空 DB + 运行中导入正数模型（Workspace 动态显现）

目标：`bun packages/ui-model-demo-server/server.mjs` 启动时不含正数模型；通过脚本导入 `1/2/100/1001/1002` 后，Workspace 才出现应用列表。

约束说明：
1. server 启动时仅导入基座负数 patch（`model_id < 0`）。
2. 使用空 workspace（不存在 `yhl.db` 或全新目录）启动时，不会从 DB 恢复正数模型。
3. 正数模型导入 patch：`packages/worker-base/system-models/workspace_positive_models.json`。

步骤：
1. 用空数据目录启动 server（示例端口 19000）：
```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
export WORKER_BASE_DATA_ROOT=/tmp/dy_empty_db_workspace
export WORKER_BASE_WORKSPACE=ws_patch_only
rm -rf "$WORKER_BASE_DATA_ROOT/$WORKER_BASE_WORKSPACE"
PORT=19000 bun packages/ui-model-demo-server/server.mjs
```
2. 新终端执行动态导入脚本：
```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
UI_SERVER_URL=http://127.0.0.1:19000 bun scripts/import_positive_models_patch.mjs
```
3. PASS 判定：
- 导入脚本输出 `PASS imported_models=1,2,100,1001,1002 ...`
- Workspace 页面导入前无 worker apps，导入后出现应用并可进入模型 schema 渲染页面。

## 2.3 方案A分层压测（0137）

目标：在 2.2 的 patch-only 模式上，按固定顺序一次性验证：
空态 -> 动态导入 -> 幂等导入 -> `ui_event` 压力 -> Playwright 终验。

执行方式：
1. 启动空 workspace UI Server（同 2.2，端口可用 `19000`）。
2. 运行分层脚本：
```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
UI_SERVER_URL=http://127.0.0.1:19000 bun scripts/test_planA_layered_pressure.mjs
```
3. 脚本输出证据目录：
- `docs/iterations/0137-planA-layered-pressure-test/assets/`
- 关键文件：`step2_before_*.json`、`step3_import_*.json`、`step4_pressure_summary.json`、`stepA_D_summary_*.json`

判定口径：
1. Step2：`before_positive_count=0` 且 `before_ws_registry_len=0`
2. Step3：导入后存在 `1/2/100/1001/1002`，且 `idempotency_failures=0`
3. Step4：`error_count=0` 且 `p95_ms < 3000`
4. Step5（Playwright）：导入前 Workspace 空，导入后出现 `E2E 颜色生成器`，点击后颜色变化

0137 已知实测现象（用于排障）：
1. Step2/Step3/Step5 均 PASS。
2. Step4 出现固定节奏失败：30 轮中 round `11`、`22` 超时。
3. 超时轮次中 `/ui_event` 仍返回 `200` 且 `ui_event_last_op_id` 正常，说明请求已被 server 接收。
4. `remote-worker` 的 `planA_*` 日志缺失 round `11`、`22`；`mbr-worker` 可见 round `22` 入站并 publish，链路存在“节奏性丢轮”迹象。

建议排查命令：
```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
kubectl logs deploy/remote-worker --tail=2000 | rg 'planA_'
kubectl logs deploy/mbr-worker --tail=3000 | rg 'planA_'
jq '.step4.errors' docs/iterations/0137-planA-layered-pressure-test/assets/stepA_D_summary_*.json
```

## 2.4 OrbStack 一键复跑（0153 收口）

背景：本地 UI Server 若连接到与 k8s MBR 不同的 Matrix room，会出现 `Generate Color` 卡在 `loading`（`system_ready=false` 或无回包）。

新增脚本（`scripts/ops/`）：
1. `start_local_ui_server_k8s_matrix.sh`
- 自动从 `dongyu/mbr-worker-config` + `dongyu/mbr-worker-secret` 读取：
  - `DY_MATRIX_ROOM_ID`
  - `MATRIX_HOMESERVER_URL`
  - `MATRIX_MBR_BOT_USER`
  - `MATRIX_MBR_BOT_ACCESS_TOKEN`
- 自动注入本地 UI Server 环境并等待 `Matrix adapter connected`。

2. `verify_model100_submit_roundtrip.sh`
- 自动执行一次 `Model 100` submit；
- 判定闭环：`submit_inflight: true -> false`，`status: loading -> processed`，且颜色值变化/或 `last_op` 更新。

3. `run_model100_submit_roundtrip_local.sh`
- 一键串联：`baseline check -> start local ui-server -> verify submit roundtrip`。

一键命令（推荐）：
```bash
bash scripts/ops/run_model100_submit_roundtrip_local.sh --port 9011 --stop-after
```

等价命令链（拆分执行）：
```bash
bash scripts/ops/check_runtime_baseline.sh \
&& bash scripts/ops/start_local_ui_server_k8s_matrix.sh --port 9011 --force-kill-port \
&& bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:9011
```

产物路径（默认）：
- PID: `/tmp/dongyu-ui-server-9011.pid`
- Log: `/tmp/dongyu-ui-server-9011.log`

## 3. 启动顺序（推荐隔离端口）

1. 创建独立 Matrix room：

```bash
set -a; source .env; set +a
export MATRIX_MBR_ACCESS_TOKEN="${MATRIX_MBR_BOT_ACCESS_TOKEN:-${MATRIX_MBR_ACCESS_TOKEN:-}}"
export MATRIX_MBR_USER="${MATRIX_MBR_BOT_USER:-${MATRIX_MBR_USER:-}}"
node scripts/matrix_bootstrap_room_v0.mjs
# 输出: ROOM_ID=!xxxx:localhost
```

2. 启动 MBR Worker（默认：K8s，非本地 JS）：

```bash
kubectl config use-context "${K8S_CONTEXT:-orbstack}"
kubectl apply -f k8s/mbr-worker-config.yaml
kubectl apply -f k8s/mbr-worker-secret.yaml
kubectl apply -f k8s/mbr-worker-deployment.yaml
kubectl scale deploy/mbr-worker -n default --replicas=1
kubectl rollout status deploy/mbr-worker -n default --timeout=180s
```

本地旧版 MBR 仅应急：
`ALLOW_LEGACY_MBR=1 node scripts/run_worker_mbr_v0.mjs`

3. 启动 K8s Remote Worker v2（Model 100）：

```bash
set -a; source .env; set +a
export MQTT_HOST="${MQTT_BROKER_HOST:-127.0.0.1}"
export MQTT_PORT="${MQTT_BROKER_PORT:-1883}"
export MQTT_USER="${MQTT_USERNAME:-u}"
export MQTT_PASS="${MQTT_PASSWORD:-p}"
export WORKER_ID=2
node scripts/run_remote_worker_k8s_v2.mjs
```

4. 启动 UI Server（建议 19000，避免占用现有 9000）：

```bash
set -a; source .env; set +a
export PORT=19000
export WORKER_BASE_WORKSPACE=it_color_e2e
export WORKER_BASE_DATA_ROOT=/tmp/dy_patch_only_0135
rm -rf "$WORKER_BASE_DATA_ROOT/$WORKER_BASE_WORKSPACE"
export MATRIX_MBR_ACCESS_TOKEN="${MATRIX_MBR_BOT_ACCESS_TOKEN:-${MATRIX_MBR_ACCESS_TOKEN:-}}"
export MATRIX_MBR_USER="${MATRIX_MBR_BOT_USER:-${MATRIX_MBR_USER:-}}"
export ROOM_ID='<ROOM_ID>'
export MODELTABLE_PATCH_JSON=$(node -e 'const room=process.env.ROOM_ID||""; const peer=process.env.MATRIX_MBR_USER||""; process.stdout.write(JSON.stringify({version:"mt.v0",op_id:"runbook_server_env_patch",records:[{op:"add_label",model_id:0,p:0,r:0,c:0,k:"matrix_room_id",t:"str",v:room},{op:"add_label",model_id:0,p:0,r:0,c:0,k:"matrix_dm_peer_user_id",t:"str",v:peer}]}));')
bun packages/ui-model-demo-server/server.mjs
```

预期关键日志：
- `[ProgramModelEngine] Matrix client connected, room: ...`
- `[mbr-worker] READY`
- `[k8s-worker-v2] Ready and listening for events on Model 100...`

## 4. API 复现流程（可复制）

> 注意：当前 `server.mjs` 对 `/snapshot` 与 `/ui_event` 需要登录态。
> 因此直接运行 `scripts/test_e2e_model100.mjs` 会 401；建议使用下述“带登录态”方式。

```bash
set -a; source .env; set +a
node <<'NODE'
const base = 'http://127.0.0.1:19000';

async function postJson(url, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (_) {}
  return { status: r.status, headers: r.headers, text, json };
}

async function getJson(url, cookie) {
  const headers = cookie ? { Cookie: cookie } : {};
  const r = await fetch(url, { headers });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (_) {}
  return { status: r.status, json, text };
}

function getBg(snapshot) {
  const m = snapshot?.models?.['100'] || snapshot?.models?.[100];
  return m?.cells?.['0,0,0']?.labels?.bg_color?.v || null;
}

(async () => {
  const login = await postJson(`${base}/auth/login`, {
    homeserverUrl: process.env.MATRIX_HOMESERVER_URL,
    username: process.env.MATRIX_MBR_USER,
    password: process.env.MATRIX_MBR_PASSWORD,
  });
  if (login.status !== 200) throw new Error(`login_fail:${login.status}`);
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

  const s1 = await getJson(`${base}/snapshot`, cookie);
  const initial = getBg(s1.json.snapshot);

  const opId = `runbook_${Date.now()}`;
  const evt = {
    source: 'ui_renderer',
    type: 'label_add',
    payload: {
      action: 'label_add',
      meta: { op_id: opId },
      target: { model_id: 100, p: 0, r: 0, c: 2, k: 'ui_event' },
      value: { t: 'json', v: { action: 'submit', meta: { op_id: opId } } },
    },
  };

  const post = await postJson(`${base}/ui_event`, evt, cookie);
  if (post.status !== 200) throw new Error(`ui_event_fail:${post.status}`);

  const start = Date.now();
  let updated = null;
  while (Date.now() - start < 30000) {
    const s = await getJson(`${base}/snapshot`, cookie);
    const now = getBg(s.json.snapshot);
    if (now && now !== initial) { updated = now; break; }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!updated) throw new Error('timeout_color_not_changed');
  console.log(`PASS initial=${initial} updated=${updated} elapsed_ms=${Date.now()-start}`);
})();
NODE
```

PASS 判定：`bg_color` 在 30 秒内发生变化。

## 5. Playwright 终验（必须）

在登录态页面执行：
1. 登录 UI（`/auth/login`）。
2. 发送 `model_id=100` 的 `ui_event`（`label_add` + `action=submit`）。
3. 轮询 `/snapshot`，确认 `bg_color` 改变。

本次实测结果见：
- `docs/iterations/0134-color-generator-e2e-repro/assets/playwright_verify_result.json`
- `docs/iterations/0135-color-generator-patch-only-repro/assets/playwright_verify_result_0135.json`

## 6. 常见失败与排障

1. `No matrix_room_id configured`：
- 原因：UI Server 未注入 `matrix_room_id` label。
- 处理：启动 server 时注入 `MODELTABLE_PATCH_JSON`，包含 `matrix_room_id` 与 `matrix_dm_peer_user_id`。

2. `/snapshot` 或 `/ui_event` 返回 `401 not_authenticated`：
- 原因：Server 已启用认证。
- 处理：先调用 `/auth/login` 获取 `dy_session` cookie 再访问。

3. MBR 未转发到 `.../100/event`：
- 检查 `mbr_route_100` 是否存在（`system_models.json`）。
- 检查 MBR 日志是否出现 `ui_event, routing to 100/event`。

4. K8s Worker 没收到事件：
- 检查订阅日志是否包含 `UIPUT/.../100/event`。
- 检查 MQTT broker 1883 连通。

5. 回写未到 UI：
- 检查 MBR 是否收到 `.../100/patch`。
- 检查 server 是否触发 `on_model100_patch_in`。

## 7. 证据文件

- `docs/iterations/0134-color-generator-e2e-repro/assets/matrix_room_bootstrap.log`
- `docs/iterations/0134-color-generator-e2e-repro/assets/step2_api_repro.log`
- `docs/iterations/0134-color-generator-e2e-repro/assets/playwright_verify_result.json`
- `docs/iterations/0134-color-generator-e2e-repro/assets/execution_context.txt`
- `docs/iterations/0135-color-generator-patch-only-repro/assets/matrix_room_bootstrap_0135.log`
- `docs/iterations/0135-color-generator-patch-only-repro/assets/step2_api_repro_0135.log`
- `docs/iterations/0135-color-generator-patch-only-repro/assets/playwright_verify_result_0135.json`
- `docs/iterations/0135-color-generator-patch-only-repro/assets/runtime_env_0135.txt`
- `docs/iterations/0137-planA-layered-pressure-test/assets/step1_baseline_check.txt`
- `docs/iterations/0137-planA-layered-pressure-test/assets/stepA_D_summary_*.json`
- `docs/iterations/0137-planA-layered-pressure-test/assets/step4_pressure_summary.json`
- `docs/iterations/0137-planA-layered-pressure-test/assets/playwright_step5.json`
