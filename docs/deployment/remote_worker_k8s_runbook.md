# Remote Worker K8s Runbook

> 目标：在本地开发环境中跑通  
> `UI -> Matrix -> MBR -> MQTT -> K8s Remote Worker`。

## 1. 前置条件

- UI Server 可启动：`bun packages/ui-model-demo-server/server.mjs --port 9000`
- MBR Worker 可启动：`node scripts/run_worker_mbr_v0.mjs`
- Matrix 可达：`https://matrix.localhost/_matrix/client/versions`
- MQTT 可达：`127.0.0.1:1883`
- Docker Desktop Kubernetes 已启用

关键文件：
- `k8s/Dockerfile.remote-worker`
- `k8s/remote-worker-config.yaml`
- `k8s/remote-worker-deployment.yaml`

## 2. 本地链路预检（部署前）

### 2.1 启动服务

```bash
bun packages/ui-model-demo-server/server.mjs --port 9000
node scripts/run_worker_mbr_v0.mjs
```

### 2.2 Playwright 冒烟验证

1. 打开 `http://127.0.0.1:9000`
2. 修改颜色输入并点击 `Submit`
3. 检查日志：
  - UI Server 出现 `sendMatrix` 成功记录
  - MBR Worker 出现 Matrix 收到并转发 MQTT 的记录

判定：本地链路不通时，不进入 K8s 部署。

## 3. K8s 部署步骤

### 3.1 构建镜像

```bash
docker build -f k8s/Dockerfile.remote-worker -t dongyuapp-remote-worker:v1 .
```

### 3.2 应用资源

```bash
kubectl apply -f k8s/remote-worker-config.yaml
kubectl apply -f k8s/remote-worker-deployment.yaml
```

### 3.3 验证运行状态

```bash
kubectl get pods -l app=remote-worker
kubectl logs -f deployment/remote-worker
```

预期日志要点：
- 连接 MQTT 成功
- 收到 `UIPUT/...` 相关消息
- 程序模型处理完成，无连续异常

## 4. 端到端验收

1. 浏览器触发一次 UI 事件（例如颜色变更 + Submit）
2. 观察：
  - UI Server 发送 Matrix 成功
  - MBR Worker 发布到 MQTT
  - Remote Worker 收到并处理
3. 满足以上 3 点即视为部署链路通过

## 5. 常见故障

### 5.1 Pod 连接 MQTT 失败
- 症状：`ECONNREFUSED`
- 排查：`MQTT_HOST`、`MQTT_PORT`、Docker Desktop 网络连通性

### 5.2 镜像拉取失败
- 症状：`ImagePullBackOff`
- 排查：`imagePullPolicy`、镜像标签与本地镜像是否一致

### 5.3 MBR 无转发
- 症状：Remote Worker 无入站日志
- 排查：MBR 进程状态、Matrix room 配置、MQTT publish topic

## 6. 关联文档

- `docs/deployment/infrastructure_recovery.md`
- `docs/ssot/ui_to_matrix_event_flow.md`
- `docs/user-guide/ui_event_matrix_mqtt_configuration.md`
