# Dual-Worker Sliding UI E2E (v0)

这份文档描述一个可重复的本地端到端测试：

- 2 个软件工人（UI-side worker + Remote worker）
- 1 个 MBR（桥接工人）
- 管理总线：Matrix（Synapse，`matrix.localhost`）
- 控制总线：MQTT（本地 broker，127.0.0.1:1883）

目标是验证一次“滑动过程”（最小闭环定义见下文）：

`UI-side -> MgmtBus -> MBR -> MQTT -> Remote -> MQTT -> MBR -> MgmtBus -> UI-side`

并且桥接消息体使用 `ModelTablePatch v0 (mt.v0)`。

## 0. 词汇与边界

- UI-side worker：代表洞宇 app 侧（滑动 UI 的入口侧），负责 UI 投影与 mgmt 收发。
- Remote worker：代表远端软件工人（滑动 UI 的处理侧），负责执行与回传。
- MBR：Management Bus ↔ Control Bus 的桥接与策略中枢。

约束（SSOT）：
- UI 不直连总线；UI 只写 mailbox。
- 所有副作用必须由 `add_label/rm_label` 驱动（ModelTable-driven）。

参考：
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/iterations/0132-dual-bus-contract-harness-v0/contract_dual_bus_v0.md`

## 1. 验收标准（必须全部满足）

### 1.1 功能链路（端到端）

1) UI-side worker 产生一次“滑动事件”对外发送：
- MgmtBus 上能看到一条 `MgmtBusEventV0`（`type="ui_event"`）
- `op_id` 非空

2) MBR 收到该 mgmt event 后必须：
- 以 `op_id` 幂等去重（重复投递不产生第二次下游 publish）
- 把消息转发到 MQTT（控制总线）

3) Remote worker 收到 MQTT 消息后必须：
- 能把其内容解析为 `ModelTablePatch v0`（`version="mt.v0"`，有 `op_id` 与 `records[]`）
- `applyPatch()` 后确实更新了某个可观测 label（用于验证）

4) Remote worker 必须回传一次结果：
- 通过 MQTT → MBR → MgmtBus
- UI-side worker 最终能观测到某个 label 值变化（用于验证）

### 1.2 可观测证据（必须能打印/保存）

- UI-side worker：能输出最新 snapshot 中目标 label 的值
- Remote worker：能输出被 apply 的 patch 概览（不含 secrets）和目标 label 的最终值
- MBR：能输出一次转发的 `op_id`、MQTT topic、MGMT event type
- MQTT：至少能验证 broker 端口可连接（1883）
- Matrix：至少能验证 `https://matrix.localhost/_matrix/client/versions` 返回 200

### 1.3 安全边界

- 不把 Matrix 密码/token 写入仓库文件、ModelTable snapshot、EventLog。
- 日志中不回显密码/token。

## 2. 部署与测试计划（高层）

1) 确认本地服务可达：
- Synapse：`https://matrix.localhost/_matrix/client/versions` 应为 200
- MQTT：127.0.0.1:1883 可连接

2) Matrix 准备：
- 用测试用户登录
- 创建/选择一个测试房间（room_id）

3) 启动 3 个进程：
- UI-side worker
- MBR worker
- Remote worker

4) 触发一次“滑动事件”（生成 op_id）

5) 等待回传，打印证据并判定 PASS/FAIL

## 3. 部署与测试步骤（可直接照抄执行）

### 3.1 前置检查（必须 PASS）

1) Synapse 可达（`matrix.localhost` 通常是 https 反代到 homeserver）：

```bash
curl -sk https://matrix.localhost/_matrix/client/versions
```

2) MQTT broker 可达（本地 docker 映射到 1883）：

```bash
nc -zv 127.0.0.1 1883
```

### 3.2 设置环境变量（不要写入 repo 文件）

本项目 Matrix live adapter 使用这些 env（来自 `packages/bus-mgmt/src/matrix_live.js`）：

```bash
export MATRIX_HOMESERVER_URL="https://matrix.localhost"
export MATRIX_MBR_USER="drop"
export MATRIX_MBR_PASSWORD="<your_password>"
export NODE_TLS_REJECT_UNAUTHORIZED=0
export DY_REMOTE_MODEL_ID=2
export DY_MQTT_HOST=127.0.0.1
export DY_MQTT_PORT=1883
export DY_MQTT_USER=u
export DY_MQTT_PASS=p
```

说明：
- `NODE_TLS_REJECT_UNAUTHORIZED=0` 仅用于本地自签/内网证书测试（不要在生产环境使用）。
- password/token 仅通过 env 注入，不写入 `.env` / docs / snapshot。

### 3.3 准备一个测试 room_id

Matrix live adapter 需要 `room_id` 或 `room_alias`。

推荐做法：用脚本创建一个临时房间并打印 room_id（不会输出 secrets）。

```bash
node scripts/matrix_bootstrap_room_v0.mjs
```

它会输出类似：

```
ROOM_ID=!xxxx:matrix.localhost
```

然后导出：

```bash
export DY_MATRIX_ROOM_ID="!xxxx:matrix.localhost"
```

### 3.4 启动 3 个进程（UI-side / MBR / Remote）

```bash
node scripts/run_worker_ui_side_v0.mjs
node scripts/run_worker_mbr_v0.mjs
node scripts/run_worker_remote_v0.mjs
```

每个进程都会打印自身的 worker_id、订阅 topic、以及当前状态。

### 3.5 触发一次“滑动事件”并等待回传

```bash
node scripts/validate_dual_worker_slide_e2e_v0.mjs
```

成功标准（脚本输出）：
- 打印 `PASS`
- 打印同一个 `op_id` 的完整链路证据（MGMT publish/recv、MQTT publish/recv、UI-side/Remote snapshot 变更）

## 4. 已验证结果（本地实测）

以下链路已经在本机跑通（Matrix live + 真实 MQTT broker）：

- Matrix: `dy.bus.v0`
- MBR: mgmt `ui_event` → MQTT `mt.v0 patch` → remote applyPatch → MQTT `mt.v0 patch` → mgmt `snapshot_delta`
- UI-side: 收到 `snapshot_delta` 后 `applyPatch` 更新 `model_id=1,p=0,r=0,c=0,k=slide_demo_text`

复现命令：

```bash
MATRIX_HOMESERVER_URL="https://matrix.localhost" \
MATRIX_MBR_USER="drop" \
MATRIX_MBR_PASSWORD="<your_password>" \
NODE_TLS_REJECT_UNAUTHORIZED=0 \
node scripts/validate_dual_worker_slide_e2e_v0.mjs
```
