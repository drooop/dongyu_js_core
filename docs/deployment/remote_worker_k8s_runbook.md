---
title: "Remote Worker K8s Runbook"
doc_type: deployment
status: active
updated: 2026-03-21
source: ai
---

# Remote Worker K8s Runbook

> 目标：在本地开发环境中跑通  
> `UI -> Matrix -> MBR -> MQTT -> K8s Remote Worker`。
> 默认口径：MBR 与 Remote Worker 运行在 K8s，`scripts/run_worker_mbr_v0.mjs` 不再作为默认入口。

## 1. 前置条件

- Docker 可用，且 `../element-docker-demo` 可访问
- 本地 K8s 已启用（推荐 context: `orbstack`；兼容 `docker-desktop`）
- Matrix 可达：`https://matrix.localhost/_matrix/client/versions`
- MQTT 可达：`127.0.0.1:1883`
- 仓库脚本可用：
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/check_runtime_baseline.sh`

关键文件：
- `k8s/Dockerfile.remote-worker`
- `k8s/remote-worker-config.yaml`
- `k8s/remote-worker-deployment.yaml`

## 2. 本地链路预检（部署前）

### 2.1 固定运行基线

```bash
# 可选：显式指定 context
# export K8S_CONTEXT=orbstack
bash scripts/ops/ensure_runtime_baseline.sh
bash scripts/ops/check_runtime_baseline.sh
```

### 2.2 Playwright 冒烟验证

1. 打开 `http://127.0.0.1:9000`（或当前 UI 端口）
2. 修改颜色输入并点击 `Submit`
3. 检查日志：
  - UI Server 出现 `sendMatrix` 成功记录
  - K8s `mbr-worker` 出现 Matrix 收到并转发 MQTT 的记录
    - `kubectl logs -n default deploy/mbr-worker --tail=100`

判定：本地链路不通时，不进入 K8s 部署。

## 3. K8s 部署步骤

### 3.1 构建镜像（按需）

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
kubectl get pods -n default -l app=remote-worker
kubectl get pods -n default -l app=mbr-worker
kubectl logs -n default -f deployment/remote-worker
kubectl logs -n default -f deployment/mbr-worker
```

预期日志要点：
- 连接 MQTT 成功
- 收到 `UIPUT/...` 相关消息
- 程序模型处理完成，无连续异常

## 4. 端到端验收

1. 浏览器触发一次 UI 事件（例如颜色变更 + Submit）
2. 观察：
  - UI Server 发送 Matrix 成功
  - K8s `mbr-worker` 发布到 MQTT
  - Remote Worker 收到并处理
3. 满足以上 3 点即视为部署链路通过

## 5. 常见故障

### 5.1 Pod 连接 MQTT 失败
- 症状：`ECONNREFUSED`
- 排查：`MQTT_HOST`、`MQTT_PORT`、本地 K8s 网络连通性（OrbStack / Docker Desktop）

### 5.2 镜像拉取失败
- 症状：`ImagePullBackOff`
- 排查：`imagePullPolicy`、镜像标签与本地镜像是否一致

### 5.3 MBR 无转发
- 症状：Remote Worker 无入站日志
- 排查：`kubectl get deploy -n default mbr-worker`、Matrix room 配置、MQTT publish topic

## 6. 关联文档

- `docs/deployment/infrastructure_recovery.md`
- `docs/ssot/ui_to_matrix_event_flow.md`
- `docs/user-guide/ui_event_matrix_mqtt_configuration.md`
