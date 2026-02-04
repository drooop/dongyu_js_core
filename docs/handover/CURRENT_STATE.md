# 当前状态摘要 (2026-02-04)

## 📦 已创建的文件

以下文件已由 Claude 创建并就绪：

### 1. 程序模型配置
- **文件**: `packages/worker-base/system-models/remote_worker_model.json`
- **内容**: 包含 Model 2 (remote_worker) 的定义和 `process_mqtt_message` 函数
- **状态**: ✅ 已创建

### 2. Worker 启动脚本
- **文件**: `scripts/run_remote_worker_k8s.mjs`
- **功能**:
  - 连接 MQTT broker (host.docker.internal:1883)
  - 订阅 topic: `UIPUT/ws/dam/pic/de/sw/2/#`
  - 接收消息并写入 PIN_IN (Model 2, Cell 0,1,1)
  - 执行程序模型函数处理事件
- **状态**: ✅ 已创建

### 3. Dockerfile
- **文件**: `Dockerfile.remote-worker`
- **基础镜像**: `oven/bun:latest`
- **包含内容**: worker-base 包 + 启动脚本 + 程序模型配置
- **状态**: ✅ 已创建

### 4. K8s 资源文件
- **ConfigMap**: `k8s/remote-worker-config.yaml`
  - 配置 MQTT_HOST, MQTT_PORT, WORKER_MODEL_ID
- **Deployment + Service**: `k8s/remote-worker-deployment.yaml`
  - 1 replica
  - imagePullPolicy: Never (本地镜像)
  - 资源限制: 128Mi-256Mi 内存, 100m-500m CPU
- **状态**: ✅ 已创建

---

## 🔧 服务管理

### 现有后台服务（由 Claude 启动）

1. **UI Server** (Task ID: bdb8251)
   - 命令: `bun packages/ui-model-demo-server/server.mjs --port 9000`
   - 地址: http://127.0.0.1:9000
   - 状态: 运行中 ✅

2. **MBR Worker** (Task ID: b8b01df)
   - 命令: `node scripts/run_worker_mbr_v0.mjs`
   - 功能: Matrix DM ↔ MQTT 转发
   - 状态: 运行中 ✅

### OpenCode 应该如何处理

**推荐做法**: OpenCode 应该自己启动服务，而不是依赖现有后台进程。

#### 停止现有服务

```bash
# 停止 UI Server
lsof -ti:9000 | xargs kill -9 2>/dev/null || echo "No UI Server running"

# 停止 MBR Worker
pkill -f run_worker_mbr_v0.mjs || echo "No MBR Worker running"

# 等待进程完全退出
sleep 2
```

#### 启动新服务

```bash
# 启动 UI Server（后台）
bun packages/ui-model-demo-server/server.mjs --port 9000 &

# 等待启动
sleep 3

# 验证
curl -s http://127.0.0.1:9000/snapshot | jq -e '.snapshot.models' > /dev/null && echo "✅ UI Server OK"

# 启动 MBR Worker（后台）
node scripts/run_worker_mbr_v0.mjs &

# 等待连接
sleep 3
```

---

## 📋 待完成任务（OpenCode 的工作）

### 步骤 0: 启动服务并验证基础链路 ⭐ 先做这个

#### 0.1 停止现有后台服务
```bash
lsof -ti:9000 | xargs kill -9 2>/dev/null || echo "No UI Server running"
pkill -f run_worker_mbr_v0.mjs || echo "No MBR Worker running"
sleep 2
```

#### 0.2 启动 UI Server
```bash
bun packages/ui-model-demo-server/server.mjs --port 9000 &
sleep 3
curl -s http://127.0.0.1:9000/snapshot | jq -e '.snapshot.models' > /dev/null && echo "✅ UI Server OK"
```

#### 0.3 启动 MBR Worker
```bash
node scripts/run_worker_mbr_v0.mjs &
sleep 3
```

#### 0.4 使用 Playwright 复现测试
使用 Playwright MCP 工具：
1. `browser_navigate({ url: "http://127.0.0.1:9000" })`
2. `browser_snapshot()` 查看页面结构
3. 找到颜色输入框，使用 `browser_type()` 修改颜色
4. 找到 Submit 按钮，使用 `browser_click()` 点击
5. 验证 UI Server 日志中有 Matrix 消息发送成功
6. 验证 MBR Worker 日志中有 MQTT 转发消息

#### 0.5 成功标准
- ✅ UI Server 正常响应
- ✅ MBR Worker 连接到 Matrix 和 MQTT
- ✅ Playwright 点击 Submit 后链路畅通
- ✅ 日志显示 Matrix 和 MQTT 消息成功

---

### 步骤 5: K8s 部署和测试

#### 5.1 部署前检查
```bash
# 确认 K8s 可用
kubectl get nodes

# 确认 MQTT broker 可达
nc -zv localhost 1883

# （可选）确认后台服务状态
# 使用 /tasks 命令查看
```

#### 5.2 构建并部署
```bash
# 1. 构建 Docker 镜像
docker build -f Dockerfile.remote-worker -t dongyuapp-remote-worker:v1 .

# 2. 部署到 K8s
kubectl apply -f k8s/remote-worker-config.yaml
kubectl apply -f k8s/remote-worker-deployment.yaml

# 3. 查看 Pod 状态（应该是 Running）
kubectl get pods -l app=remote-worker

# 4. 查看日志（应该看到连接成功的消息）
kubectl logs -f deployment/remote-worker
```

#### 5.3 触发 UI 测试
1. 打开浏览器: http://127.0.0.1:9000
2. 修改颜色输入框（例如 #ff00ff）
3. 点击 Submit 按钮

#### 5.4 验证日志输出

预期在 Remote Worker 日志中看到：
```
[remote_worker] <<< UIPUT/ws/dam/pic/de/sw/2/...
[remote_worker] Payload: {"action":"label_update",...}
[remote_worker] Data written to PIN_IN
[remote_worker] Received: label_update
[remote_worker] Event processed successfully
```

---

## ✅ 成功标准

完整链路打通的标志：
1. ✅ K8s Pod 状态为 Running
2. ✅ Pod 日志显示成功连接到 MQTT
3. ✅ UI 点击 Submit 后，Remote Worker 日志显示收到消息
4. ✅ Remote Worker 成功解析并处理 payload
5. ✅ 没有错误日志

---

## 🐛 故障排查快速参考

### Pod 无法连接 MQTT
- **症状**: `connect ECONNREFUSED`
- **解决**: 确认使用 `host.docker.internal`，或者在 deployment.yaml 中添加 `hostNetwork: true`

### 镜像拉取失败
- **症状**: `ImagePullBackOff`
- **解决**: 确认 `imagePullPolicy: Never`，重新构建镜像

### MBR 没有发送到 MQTT
- **症状**: Remote Worker 无日志输出
- **解决**: 检查 MBR Worker 日志（Task ID: b8b01df 的输出文件）

### 程序模型函数未执行
- **症状**: 收到消息但没有处理
- **解决**: 检查启动日志中是否有 `Program model loaded`

---

## 📚 相关文档

- **完整指南**: `docs/handover/k8s_remote_worker_deployment.md`
- **架构说明**: `docs/ssot/ui_to_matrix_event_flow.md`
- **用户配置**: `docs/user-guide/ui_event_matrix_mqtt_configuration.md`

---

## 🎯 关键概念

### MQTT Topic 格式
```
UIPUT/ws/dam/pic/de/sw/<model_id>/<event_type>
```
当前订阅: `UIPUT/ws/dam/pic/de/sw/2/#` (Model 2 的所有事件)

### PIN_IN/PIN_OUT
- **PIN_IN**: MQTT 订阅，数据写入 Cell (Model 2, p=0, r=1, c=1)
- **PIN_OUT**: MQTT 发布，数据从 Cell 读取并发送

### 程序模型执行流程
1. MQTT 消息到达 → 写入 PIN_IN (mqtt_in label)
2. 执行 `process_mqtt_message` 函数
3. 函数读取 mqtt_in → 处理 → 存储到 last_event → 清空 mqtt_in

---

## 📞 需要帮助？

- 查看完整文档: `docs/handover/k8s_remote_worker_deployment.md`
- 检查后台服务: `/tasks` 命令
- 查看 MBR 日志: 读取 Task b8b01df 的输出文件
- 查看 UI Server 日志: 读取 Task bdb8251 的输出文件
