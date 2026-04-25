---
title: "UI 事件通过 Matrix/MQTT 到达设备的配置指南"
doc_type: user-guide
status: active
updated: 2026-04-21
source: ai
---

# UI 事件通过 Matrix/MQTT 到达设备的配置指南

适用场景：
- Web UI 的事件经由 `Matrix -> MBR -> MQTT -> worker` 到达设备或模型 PIN。

当前正式口径：
- 产品路径只接受一个启动入口：`MODELTABLE_PATCH_JSON`
- 进程启动时先 `applyPatch`
- Matrix / MQTT 运行参数只从 **Model 0, Cell (0,0,0)** 读取
- 不再把 `MATRIX_*` / `DY_MATRIX_*` 作为产品路径里的直接运行时配置
- `ui-server` 启动后默认是 `runtime_mode=edit`
- 只有显式切到 `running` 后，才允许真正的 Matrix / MQTT 软件工人副作用执行

## 一、必填 labels

### 1. Matrix

| Cell | k | t | v |
|---|---|---|---|
| (0,0,0) | `matrix_room_id` | `str` | DM room ID，例如 `!abc:localhost` |
| (0,0,0) | `matrix_server` | `matrix.server` | homeserver URL |
| (0,0,0) | `matrix_user` | `matrix.user` | 当前实例登录用户，例如 `@drop:localhost` / `@mbr:localhost` |
| (0,0,0) | `matrix_passwd` | `matrix.passwd` | 登录密码，可选；存在 `matrix_token` 时允许仅保留 token |
| (0,0,0) | `matrix_token` | `matrix.token` | access token |
| (0,0,0) | `matrix_contuser` | `matrix.contuser` | 对端用户数组，例如 `["@mbr:localhost"]` |

### 2. MQTT

| Cell | k | t | v |
|---|---|---|---|
| (0,0,0) | `local_ip` | `mqtt.local.ip` | broker 地址数组，例如 `["mosquitto.dongyu.svc.cluster.local"]` |
| (0,0,0) | `local_port` | `mqtt.local.port` | broker 端口数组，例如 `["1883"]` |

说明：
- `matrix_room_id` 是当前仓库保留的房间补充键；其余 Matrix 字段按 Feishu `matrix:*` 口径执行。
- `local_ip` / `local_port` 用于本地或集群内 MQTT；若存在云侧独立约定，可另行生成对应 patch，但运行时读取位置不变。
- 当前正式环境差异：
  - 本地 OrbStack baseline 使用 `mosquitto.dongyu.svc.cluster.local`
  - 远端 `rke2` baseline 使用 `emqx-emqx-enterprise.emqx.svc.cluster.local`
  - 两侧读取位置相同，只有 bootstrap patch / k8s config 的 broker 值不同

## 二、如何启动

### 1. 本地 host-side UI server

```bash
bash scripts/ops/start_local_ui_server_k8s_matrix.sh --port 9011 --force-kill-port
```

该脚本会：
- 从 k8s 读取 room / homeserver / user / token / password
- 生成 `MODELTABLE_PATCH_JSON`
- 用 patch 启动本地 `ui-server`

启动后若要进入真实运行态：

```bash
curl -fsS -X POST http://127.0.0.1:9011/api/runtime/mode \
  -H 'content-type: application/json' \
  -d '{"mode":"running"}'
```

说明：
- `ui-server` 先停在 `edit`，避免初始化阶段软件工人提前跑起来
- `running -> edit` 在当前规约里不支持

### 2. OrbStack pod baseline

```bash
bash scripts/ops/deploy_local.sh
```

该脚本会：
- 创建真实 Matrix room 和 access token
- 生成 `ui-server-secret.MODELTABLE_PATCH_JSON`
- 生成 `mbr-worker-secret.MODELTABLE_PATCH_JSON`
- 让 `ui-server` / `mbr-worker` 在启动时先把 patch 写进 ModelTable

### 3. Cloud rke2 baseline

远端 `124.71.43.80` 的正式部署细节：
- 集群类型是 `rke2`
- `remote-worker` / `mbr-worker` 连接的是 `emqx` namespace 下的 `EMQX`
- 正式 broker host 是 `emqx-emqx-enterprise.emqx.svc.cluster.local`
- `scripts/ops/deploy_cloud_full.sh` / `scripts/ops/deploy_cloud_app.sh` 只部署应用侧资源，不创建远端 broker

## 三、如何验证

### 1. 验证 patch 已落表

浏览器控制台：

```javascript
const root = window.__DY_STORE.snapshot.models["0"]?.cells?.["0,0,0"]?.labels || {};
console.log({
  runtime_mode: root.runtime_mode?.v,
  matrix_room_id: root.matrix_room_id?.v,
  matrix_server: root.matrix_server?.v,
  matrix_user: root.matrix_user?.v,
  matrix_contuser: root.matrix_contuser?.v,
  local_ip: root.local_ip?.v,
  local_port: root.local_port?.v,
});
```

### 2. 验证 baseline

```bash
bash scripts/ops/check_runtime_baseline.sh
```

PASS 判定：
- 5 个 deployment ready
- `mbr-worker-secret.MODELTABLE_PATCH_JSON` ready
- `ui-server-secret.MODELTABLE_PATCH_JSON` ready
- `snapshot.models["0"].cells["0,0,0"].labels.runtime_mode.v` 为 `edit` 或 `running`

### 3. 验证颜色生成器闭环

```bash
bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900
```

PASS 判定：
- `submit_response ... result:"ok"`
- `status` 从 `loading` 回到 `processed`
- `submit_inflight` 从 `true` 回到 `false`

## 四、故障排查

### 1. `matrix_not_ready`

优先检查：
- `Model 0 (0,0,0)` 是否存在 `matrix_room_id` / `matrix_server` / `matrix_user` / `matrix_token`
- `matrix_contuser` 是否为数组且非空
- `MODELTABLE_PATCH_JSON` 是否仍含 placeholder

不要先查 env；产品路径的根因通常是 patch 没生成或没落表。

### 2. MQTT 没有 publish

优先检查：
- `local_ip` 的 `t` 是否为 `mqtt.local.ip`
- `local_port` 的 `t` 是否为 `mqtt.local.port`
- 两者是否都写在 `Model 0 (0,0,0)`
- `runtime_mode` 是否已经切到 `running`
- 本地 OrbStack baseline 是否仍指向 `mosquitto.dongyu.svc.cluster.local`
- 远端 rke2 baseline 是否仍指向 `emqx-emqx-enterprise.emqx.svc.cluster.local`

### 3. `direct_patch_api_disabled`

原因：
- `0177` 起 `/api/modeltable/patch` 不再是公共建模旁路。

处理方法：
- 初始化时只通过 trusted bootstrap patch 直写
- 运行期只通过标准链路或 sanctioned authoring path（如 owner/materialization）改模

### 4. rollout 后短时出现 `database is locked`

这通常是 rollout 窗口里的旧 `ui-server` pod 尚未退出，而新旧 pod 共用同一 hostPath sqlite。

处理方法：
- 先执行 `kubectl -n dongyu get pods`
- 确认只剩一组新 pod 后，再执行闭环验收

## 五、相关文档

- [[ssot/ui_to_matrix_event_flow]]
- [[ssot/host_ctx_api]]
- [[iterations/0175-local-color-generator-smoke/runlog]]
- [[iterations/0177-worker-boundary-remediation/runlog]]
