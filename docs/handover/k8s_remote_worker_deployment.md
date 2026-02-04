# K8s 远端软件工人部署任务交接文档

**创建日期**: 2026-02-04
**任务优先级**: 高
**预计工作量**: 2-4 小时

---

## 任务概述

在本地 K8s (Docker Desktop) 中部署一个远端软件工人，并跑通 **UI → Matrix → MBR → MQTT → K8s Worker** 的完整端到端测试。

## 已完成工作

### ✅ 基础设施已疏通

1. **Matrix 总线（管理总线）**
   - Matrix homeserver: `https://matrix.localhost` ✅
   - 用户: `@drop:localhost` (UI Server), `@mbr:localhost` (MBR Bot) ✅
   - DM Room: `!rvgIBRtgXATQGGRWiS:localhost` ✅

2. **MQTT 总线（控制总线）**
   - MQTT Broker: `localhost:1883` ✅
   - 可从 Docker 容器访问（使用 `host.docker.internal:1883`）

3. **核心组件运行中**
   - UI Server: `http://127.0.0.1:9000` (bun 进程)
   - MBR Worker: 后台运行，连接 Matrix + MQTT
   - 程序模型: `forward_ui_events` 已加载并工作 ✅

4. **验证完成**
   - UI 点击 Submit → Matrix 消息成功发送 ✅
   - 两条测试消息已到达 Matrix room ✅

### 📁 相关文档

- **架构文档**: `docs/ssot/ui_to_matrix_event_flow.md`
- **用户指南**: `docs/user-guide/ui_event_matrix_mqtt_configuration.md`
- **Patch 操作**: `docs/ssot/mt_v0_patch_ops.md`
- **运行时 API**: `docs/ssot/host_ctx_api.md`

### 🔧 环境配置

**.env 文件**（已配置）:
```bash
# Matrix 配置
MATRIX_HOMESERVER_URL=https://matrix.localhost
MATRIX_MBR_USER=@drop:localhost
MATRIX_MBR_PASSWORD=TQcps@123
MATRIX_MBR_ACCESS_TOKEN=mct_tpCHxeQmpiU7akBR6NFdAnprmclyFJ_0q0kc3

# MQTT 配置
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883

# DM Room
DY_MATRIX_ROOM_ID=!rvgIBRtgXATQGGRWiS:localhost

# Node 配置
NODE_TLS_REJECT_UNAUTHORIZED=0
```

**现有后台进程** (由前一轮 Claude 启动):
- UI Server (bdb8251): `bun packages/ui-model-demo-server/server.mjs --port 9000`
- MBR Worker (b8b01df): `node scripts/run_worker_mbr_v0.mjs`

**⚠️ OpenCode 注意**: 这些进程由 Claude 启动，OpenCode 需要自己启动新的进程（见下方"服务管理"章节）。

---

## 服务管理

### 查看现有后台任务

```bash
# Claude Code 内置命令（如果可用）
/tasks

# 或使用 TaskOutput 工具查看输出
# Task bdb8251: UI Server 输出
# Task b8b01df: MBR Worker 输出
```

### 停止现有服务（如果需要）

如果 Claude 启动的后台服务还在运行，可以：

1. **使用 TaskStop 工具**（推荐）
   - 停止 UI Server: `TaskStop(task_id="bdb8251")`
   - 停止 MBR Worker: `TaskStop(task_id="b8b01df")`

2. **使用 lsof + kill**（备选）
   ```bash
   # 查找并停止 UI Server (端口 9000)
   lsof -ti:9000 | xargs kill -9

   # 查找并停止 MBR Worker (查找进程)
   ps aux | grep run_worker_mbr_v0.mjs | grep -v grep | awk '{print $2}' | xargs kill -9
   ```

### 启动服务

**启动 UI Server**:
```bash
# 使用 Bash 工具的 run_in_background 参数
bun packages/ui-model-demo-server/server.mjs --port 9000
```

**启动 MBR Worker**:
```bash
# 使用 Bash 工具的 run_in_background 参数
node scripts/run_worker_mbr_v0.mjs
```

**验证服务启动成功**:
```bash
# 检查 UI Server
curl -s http://127.0.0.1:9000/snapshot | jq '.snapshot.models | keys'

# 检查端口占用
lsof -i:9000
```

### 重启服务

```bash
# 1. 停止（如上）
# 2. 等待 2-3 秒
sleep 3
# 3. 重新启动（如上）
```

---

## 待完成任务

### 目标

部署一个 K8s 远端软件工人，接收来自 UI 的事件并处理。

### 架构图

```
浏览器 UI (http://127.0.0.1:9000)
    ↓ POST /ui_event
UI Server (@drop:localhost)
    ↓ Matrix DM
MBR Worker (@mbr:localhost)
    ↓ MQTT publish: UIPUT/ws/dam/pic/de/sw/2/...
MQTT Broker (localhost:1883)
    ↓ subscribe
K8s Pod: 远端软件工人
    ↓ 处理事件
    ↓ 更新 ModelTable Cell
    ↓ (可选) 发送响应
```

---

## 实施步骤

### ⚠️ 当前进度 (2026-02-04 更新)

**已完成** ✅:
- ✅ 步骤 1: 程序模型配置已创建 (`packages/worker-base/system-models/remote_worker_model.json`)
- ✅ 步骤 2: Worker 启动脚本已创建 (`scripts/run_remote_worker_k8s.mjs`)
- ✅ 步骤 3: Dockerfile 已创建 (`Dockerfile.remote-worker`)
- ✅ 步骤 4: K8s 资源文件已创建 (`k8s/remote-worker-config.yaml`, `k8s/remote-worker-deployment.yaml`)

**待完成** 🔄 (**OpenCode 从这里开始**):
- 🔄 步骤 0: 启动服务并验证基础链路
- 🔄 步骤 5: 部署到 K8s 并测试

---

### 步骤 0: 启动服务并验证基础链路 🔄 OpenCode 从这里开始

#### 0.1 停止现有后台服务（如果存在）

```bash
# 查找并停止 UI Server (端口 9000)
lsof -ti:9000 | xargs kill -9 2>/dev/null || echo "No UI Server running"

# 查找并停止 MBR Worker
pkill -f run_worker_mbr_v0.mjs || echo "No MBR Worker running"

# 等待进程完全退出
sleep 2
```

#### 0.2 启动 UI Server（后台运行）

```bash
# 使用 Bash 工具的 run_in_background=true 参数
bun packages/ui-model-demo-server/server.mjs --port 9000 &

# 等待服务启动
sleep 3

# 验证启动成功
curl -s http://127.0.0.1:9000/snapshot | jq -e '.snapshot.models' > /dev/null && echo "✅ UI Server started" || echo "❌ UI Server failed"
```

**预期输出**:
```
ui-model-demo-server listening on http://127.0.0.1:9000
✅ UI Server started
```

#### 0.3 启动 MBR Worker（后台运行）

```bash
# 使用 Bash 工具的 run_in_background=true 参数
node scripts/run_worker_mbr_v0.mjs &

# 等待连接建立
sleep 3
```

**预期输出**:
```
[mbr-worker] Starting...
[mbr-worker] Connecting to Matrix...
[mbr-worker] Matrix client ready
[mbr-worker] Connecting to MQTT...
[mbr-worker] MQTT connected
```

#### 0.4 使用 Playwright 验证基础链路

**目标**: 复现之前成功的测试，验证 UI → Matrix → MQTT 链路已疏通。

**📖 详细指南**: `docs/handover/PLAYWRIGHT_TEST_GUIDE.md` - 完整的 Playwright 测试步骤和故障排查

**快速步骤**:

```javascript
// 使用 Playwright MCP 工具执行以下操作

// 1. 导航到 UI
browser_navigate({ url: "http://127.0.0.1:9000" })

// 2. 等待页面加载
browser_wait_for({ time: 3 })

// 3. 获取页面快照（查看页面结构，找到输入框和按钮的 ref）
browser_snapshot()

// 4. 找到颜色输入框并修改
// 根据 snapshot 结果，找到对应的 ref，然后：
browser_type({
  ref: "...",  // 从 snapshot 中获取实际 ref
  text: "#ff00ff",
  element: "color input field"
})

// 5. 找到 Submit 按钮并点击
browser_click({
  ref: "...",  // 从 snapshot 中获取实际 ref
  element: "Submit button"
})

// 6. 等待请求完成
browser_wait_for({ time: 2 })

// 7. （可选）截图验证
browser_take_screenshot({ filename: "after_submit.png" })

// 8. （可选）检查控制台错误
browser_console_messages({ level: "error" })
```

**⚠️ 重要提示**:
- `ref` 必须从 `browser_snapshot()` 的实际输出中获取，不要猜测
- 详细的故障排查步骤请参考 `PLAYWRIGHT_TEST_GUIDE.md`

#### 0.5 验证链路日志

**检查 UI Server 日志**:
```bash
# 如果后台任务有 task_id，使用 TaskOutput
# 否则查看终端输出或日志文件

# 应该看到：
# [forward_ui_events] Sending to Matrix: label_update
# Event sent to !rvgIBRtgXATQGGRWiS:localhost with event id $...
```

**检查 MBR Worker 日志**:
```bash
# 应该看到：
# [mbr-worker] Received Matrix message
# [mbr-worker] Publishing to MQTT: UIPUT/ws/dam/pic/de/sw/2/...
```

**检查 Matrix 房间（可选）**:
```bash
# 使用 Matrix client 或 curl 查看房间消息
# 应该能看到刚才发送的消息
```

#### 0.6 成功标准

步骤 0 成功完成的标志：
- ✅ UI Server 在 http://127.0.0.1:9000 响应
- ✅ MBR Worker 连接到 Matrix 和 MQTT
- ✅ Playwright 点击 Submit 后，UI Server 日志显示 Matrix 消息发送成功
- ✅ MBR Worker 日志显示收到 Matrix 消息并转发到 MQTT
- ✅ 没有错误日志

**如果步骤 0 失败，不要继续步骤 5**。请先排查基础链路问题。

---

### 步骤 1: 创建程序模型配置 ✅ 已完成

**位置**: `packages/worker-base/system-models/remote_worker_model.json`

**内容**:
```json
{
  "version": "mt.v0",
  "op_id": "remote_worker_model_v0",
  "records": [
    {
      "op": "create_model",
      "id": 2,
      "name": "remote_worker",
      "type": "main"
    },
    {
      "op": "add_label",
      "model_id": 2,
      "p": 0,
      "r": 0,
      "c": 0,
      "k": "worker_name",
      "t": "str",
      "v": "k8s_remote_worker_1"
    },
    {
      "op": "add_label",
      "model_id": -10,
      "p": 3,
      "r": 0,
      "c": 0,
      "k": "process_mqtt_message",
      "t": "function",
      "v": "const pinData = ctx.getLabel({ model_id: 2, p: 0, r: 1, c: 1, k: 'mqtt_in' });\nif (pinData) {\n  try {\n    const payload = typeof pinData === 'string' ? JSON.parse(pinData) : pinData;\n    console.log('[remote_worker] Received:', payload.action || 'unknown');\n    \n    // 存储到 Cell\n    ctx.setLabel(\n      { model_id: 2, p: 1, r: 0, c: 0 },\n      { k: 'last_event', t: 'json', v: payload }\n    );\n    \n    // 清空 PIN_IN\n    ctx.setLabel(\n      { model_id: 2, p: 0, r: 1, c: 1 },\n      { k: 'mqtt_in', t: 'event', v: null }\n    );\n    \n    console.log('[remote_worker] Event processed successfully');\n  } catch (err) {\n    console.error('[remote_worker] Error:', err.message);\n  }\n}"
    }
  ]
}
```

### 步骤 2: 创建 Worker 启动脚本 ✅ 已完成

**位置**: `scripts/run_remote_worker_k8s.mjs`

**内容**:
```javascript
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');
const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

// 配置
const MQTT_HOST = process.env.MQTT_HOST || 'host.docker.internal';
const MQTT_PORT = parseInt(process.env.MQTT_PORT || '1883');
const MODEL_ID = parseInt(process.env.WORKER_MODEL_ID || '2');
const TOPIC = `UIPUT/ws/dam/pic/de/sw/${MODEL_ID}/#`;

console.log('[remote_worker] Starting...');
console.log(`[remote_worker] MQTT: ${MQTT_HOST}:${MQTT_PORT}`);
console.log(`[remote_worker] Topic: ${TOPIC}`);

// 创建 Runtime
const runtime = new ModelTableRuntime();

// 加载程序模型
const patchPath = path.join(process.cwd(), 'packages/worker-base/system-models/remote_worker_model.json');
if (fs.existsSync(patchPath)) {
  const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
  runtime.applyPatch(patch, { allowCreateModel: true });
  console.log('[remote_worker] Program model loaded');
} else {
  console.error('[remote_worker] Patch file not found:', patchPath);
  process.exit(1);
}

// 连接 MQTT
const client = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
  clientId: `remote_worker_${Date.now()}`,
  clean: true,
  reconnectPeriod: 1000,
});

client.on('connect', () => {
  console.log(`[remote_worker] Connected to MQTT`);
  client.subscribe(TOPIC, (err) => {
    if (err) {
      console.error('[remote_worker] Subscribe error:', err);
    } else {
      console.log(`[remote_worker] Subscribed to ${TOPIC}`);
    }
  });
});

client.on('message', (topic, payload) => {
  console.log(`[remote_worker] <<< ${topic}`);

  try {
    const data = JSON.parse(payload.toString());
    console.log('[remote_worker] Payload:', JSON.stringify(data).substring(0, 100));

    // 写入 PIN_IN (Model 2, Cell 0,1,1)
    const model = runtime.getModel(MODEL_ID);
    if (!model) {
      console.error('[remote_worker] Model not found:', MODEL_ID);
      return;
    }

    runtime.addLabel(model, 0, 1, 1, {
      k: 'mqtt_in',
      t: 'json',
      v: data
    });

    console.log('[remote_worker] Data written to PIN_IN');

    // 执行程序模型 (需要实现 tick 机制或调用 run_ function)
    // 这里简化处理：直接执行函数
    const sysModel = runtime.getModel(-10);
    const funcCell = runtime.getCell(sysModel, 3, 0, 0);
    const funcLabel = funcCell.labels.get('process_mqtt_message');

    if (funcLabel && funcLabel.t === 'function') {
      // 创建 ctx 上下文
      const ctx = {
        getLabel: (ref) => {
          const m = runtime.getModel(ref.model_id);
          const c = runtime.getCell(m, ref.p, ref.r, ref.c);
          return c.labels.get(ref.k)?.v || null;
        },
        setLabel: (ref, label) => {
          const m = runtime.getModel(ref.model_id);
          runtime.addLabel(m, ref.p, ref.r, ref.c, label);
        },
        runtime
      };

      try {
        const fn = new Function('ctx', funcLabel.v);
        fn(ctx);
      } catch (err) {
        console.error('[remote_worker] Function execution error:', err);
      }
    }

  } catch (err) {
    console.error('[remote_worker] Message processing error:', err);
  }
});

client.on('error', (err) => {
  console.error('[remote_worker] MQTT error:', err);
});

client.on('close', () => {
  console.log('[remote_worker] MQTT connection closed');
});

// 心跳
setInterval(() => {
  const model = runtime.getModel(MODEL_ID);
  if (model) {
    const cellCount = model.cells?.size || 0;
    console.log(`[remote_worker] Heartbeat - Model ${MODEL_ID} has ${cellCount} cells`);
  }
}, 30000);

console.log('[remote_worker] Ready and listening...');
```

### 步骤 3: 创建 Dockerfile ✅ 已完成

**位置**: `Dockerfile.remote-worker`

**内容**:
```dockerfile
FROM oven/bun:latest

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json* ./
RUN bun install

# 复制必要的代码
COPY packages/worker-base/ ./packages/worker-base/
COPY scripts/run_remote_worker_k8s.mjs ./scripts/

# 确保 patch 文件存在
COPY packages/worker-base/system-models/remote_worker_model.json ./packages/worker-base/system-models/

CMD ["bun", "scripts/run_remote_worker_k8s.mjs"]
```

**构建命令**:
```bash
docker build -f Dockerfile.remote-worker -t dongyuapp-remote-worker:v1 .
```

### 步骤 4: 创建 K8s 资源 ✅ 已完成

**位置**: `k8s/remote-worker-config.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: remote-worker-config
data:
  MQTT_HOST: "host.docker.internal"
  MQTT_PORT: "1883"
  WORKER_MODEL_ID: "2"
```

**位置**: `k8s/remote-worker-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: remote-worker
  labels:
    app: remote-worker
spec:
  replicas: 1
  selector:
    matchLabels:
      app: remote-worker
  template:
    metadata:
      labels:
        app: remote-worker
    spec:
      containers:
      - name: worker
        image: dongyuapp-remote-worker:v1
        imagePullPolicy: Never
        envFrom:
        - configMapRef:
            name: remote-worker-config
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: remote-worker-svc
spec:
  selector:
    app: remote-worker
  ports:
  - port: 8080
    targetPort: 8080
```

**部署命令**:
```bash
kubectl apply -f k8s/remote-worker-config.yaml
kubectl apply -f k8s/remote-worker-deployment.yaml
```

### 步骤 5: 端到端测试 🔄 OpenCode 从这里开始

**5.1 部署前检查**:
```bash
# 1. 确认 K8s 可用
kubectl get nodes

# 2. 确认 MQTT broker 可达
nc -zv localhost 1883

# 3. 确认后台服务运行
# 使用 /tasks 命令查看 UI Server 和 MBR Worker
```

**5.2 部署 Worker**:
```bash
# 1. 构建镜像
docker build -f Dockerfile.remote-worker -t dongyuapp-remote-worker:v1 .

# 2. 部署到 K8s
kubectl apply -f k8s/

# 3. 查看 Pod 状态
kubectl get pods -l app=remote-worker

# 4. 查看日志
kubectl logs -f deployment/remote-worker
```

**5.3 触发测试**:
```bash
# 打开浏览器
open http://127.0.0.1:9000

# 操作步骤：
# 1. 修改颜色输入框（例如输入 #ff00ff）
# 2. 点击 Submit 按钮
```

**5.4 验证日志输出**:

预期看到的日志链路：

```
# UI Server 日志
[forward_ui_events] Sending to Matrix: label_update
sendEvent of type m.room.message

# MBR Worker 日志
[mbr-worker] Received Matrix message
[mbr-worker] Publishing to MQTT: UIPUT/ws/dam/pic/de/sw/2/...

# Remote Worker 日志 (kubectl logs)
[remote_worker] <<< UIPUT/ws/dam/pic/de/sw/2/...
[remote_worker] Payload: {"action":"label_update",...}
[remote_worker] Data written to PIN_IN
[remote_worker] Received: label_update
[remote_worker] Event processed successfully
```

---

## 故障排查

### 问题 1: Pod 无法连接 MQTT

**症状**: `[remote_worker] MQTT error: connect ECONNREFUSED`

**解决**:
- 确认使用 `host.docker.internal` 而不是 `localhost`
- 或者使用 `hostNetwork: true` (在 deployment.yaml 中)

### 问题 2: 镜像拉取失败

**症状**: `ImagePullBackOff` 或 `ErrImageNeverPull`

**解决**:
- 确认 `imagePullPolicy: Never`
- 重新构建镜像: `docker build -f Dockerfile.remote-worker -t dongyuapp-remote-worker:v1 .`

### 问题 3: MBR 没有发送到 MQTT

**症状**: Remote Worker 日志无输出

**解决**:
- 检查 MBR Worker 日志: 找到 task ID 后查看输出文件
- 确认 MQTT topic 匹配: `UIPUT/ws/dam/pic/de/sw/2/...`

### 问题 4: 程序模型函数未执行

**症状**: 收到消息但没有处理

**解决**:
- 检查函数是否正确加载: 查看启动日志 `Program model loaded`
- 检查 Cell 位置是否正确: Model -10, Cell (3,0,0)

---

## 验证成功标准

✅ **完整链路打通的标志**:
1. UI 点击 Submit 后，Remote Worker 日志显示收到消息
2. Remote Worker 成功解析 payload 并处理
3. 没有错误日志
4. （可选）Remote Worker 发送响应，UI 收到更新

---

## 清理命令

```bash
# 删除 K8s 资源
kubectl delete -f k8s/

# 删除镜像
docker rmi dongyuapp-remote-worker:v1

# 停止后台进程（如需要）
# 查看: /tasks
# 停止: 使用 TaskStop
```

---

## 联系信息

**相关文件位置**:
- 程序模型: `packages/worker-base/system-models/remote_worker_model.json`
- Worker 脚本: `scripts/run_remote_worker_k8s.mjs`
- K8s 资源: `k8s/remote-worker-*.yaml`
- Dockerfile: `Dockerfile.remote-worker`

**参考文档**:
- 完整架构: `docs/ssot/ui_to_matrix_event_flow.md`
- 配置指南: `docs/user-guide/ui_event_matrix_mqtt_configuration.md`

---

## 备注

- K8s 使用 Docker Desktop 提供的本地集群
- MQTT broker 运行在 host 上，通过 `host.docker.internal:1883` 访问
- UI Server 和 MBR Worker 已在后台运行，无需重启
- 当前 Matrix/MQTT 基础设施已完全配置并验证可用
