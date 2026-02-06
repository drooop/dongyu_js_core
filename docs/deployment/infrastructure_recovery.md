# 基础设施部署恢复指南

**创建日期**: 2026-02-06  
**目的**: 在新机器上恢复完整的开发/测试环境

---

## 概述

本项目依赖三个核心基础设施服务：

| 服务 | 用途 | 部署方式 |
|------|------|---------|
| **EMQX** | MQTT Broker (控制总线) | Docker 独立容器 |
| **Element Docker Demo** | Matrix Homeserver (管理总线) | Docker Compose 多容器堆栈 |
| **K8S Remote Worker** | 远端软件工人 | Docker Desktop Kubernetes |

---

## 1. EMQX (MQTT Broker)

### 1.1 服务信息

| 属性 | 值 |
|------|-----|
| Docker 镜像 | `emqx/emqx:latest` |
| 容器名称 | `emqx` |
| 主要端口 | 1883 (MQTT), 18083 (Dashboard) |
| 认证 | 无 (本地开发) |

### 1.2 端口映射

| 宿主机端口 | 容器端口 | 用途 |
|-----------|---------|------|
| 1883 | 1883 | MQTT TCP |
| 8083 | 8083 | MQTT WebSocket |
| 8084 | 8084 | MQTT WebSocket (TLS) |
| 8883 | 8883 | MQTT TCP (TLS) |
| 18083 | 18083 | Dashboard Web UI |

### 1.3 部署命令

```bash
# 拉取镜像
docker pull emqx/emqx:latest

# 启动容器
docker run -d \
  --name emqx \
  --restart unless-stopped \
  -p 1883:1883 \
  -p 8083:8083 \
  -p 8084:8084 \
  -p 8883:8883 \
  -p 18083:18083 \
  emqx/emqx:latest

# 验证启动
docker logs emqx
curl -s http://localhost:18083/status | head -1
```

### 1.4 Dashboard 访问

- **URL**: http://localhost:18083
- **默认账号**: admin
- **默认密码**: public

### 1.5 验证连接

```bash
# 测试 MQTT 连接（需要安装 mosquitto-clients）
# macOS: brew install mosquitto
mosquitto_pub -h localhost -p 1883 -t "test/topic" -m "hello"
mosquitto_sub -h localhost -p 1883 -t "test/topic" -C 1
```

---

## 2. Element Docker Demo (Matrix Homeserver)

### 2.1 服务信息

| 属性 | 值 |
|------|-----|
| 项目位置 | `/Users/wwpic/codebase/element-docker-demo` |
| GitHub 仓库 | https://github.com/element-hq/element-docker-demo |
| 域名 | `*.localhost` (本地开发) |

### 2.2 包含的服务

| 服务 | 镜像 | 用途 |
|------|------|------|
| synapse | `ghcr.io/element-hq/synapse:latest` | Matrix Homeserver |
| synapse-generic-worker-1 | `ghcr.io/element-hq/synapse:latest` | Synapse Worker |
| synapse-federation-sender-1 | `ghcr.io/element-hq/synapse:latest` | Federation |
| mas | `ghcr.io/element-hq/matrix-authentication-service:latest` | 认证服务 |
| element-web | `vectorim/element-web:latest` | Web 客户端 |
| element-call | `ghcr.io/element-hq/element-call:latest-ci` | 音视频通话 |
| livekit | `livekit/livekit-server:latest` | WebRTC SFU |
| livekit-jwt | 自定义构建 | JWT 服务 |
| nginx | `nginx:latest` | 反向代理 + TLS |
| postgres | `postgres:latest` | 数据库 |
| redis | `redis:latest` | 缓存 |
| mailhog | `mailhog/mailhog:latest` | 本地邮件 |

### 2.3 端口映射

| 宿主机端口 | 用途 |
|-----------|------|
| 80 | HTTP |
| 443 | HTTPS |
| 8448 | Matrix Federation |
| 7881 | LiveKit TCP |

### 2.4 部署步骤

#### Step 1: 克隆仓库

```bash
cd /Users/wwpic/codebase
git clone https://github.com/element-hq/element-docker-demo.git
cd element-docker-demo
```

#### Step 2: 安装 mkcert (本地 TLS)

```bash
# macOS
brew install mkcert
mkcert -install
```

#### Step 3: 运行 setup.sh

```bash
./setup.sh
```

setup.sh 会:
1. 创建 `.env` 文件（如果不存在）
2. 生成本地 TLS 证书
3. 创建必要的目录结构

#### Step 4: 配置 /etc/hosts

```bash
# 添加以下条目到 /etc/hosts
sudo sh -c 'cat >> /etc/hosts << EOF
127.0.0.1 matrix.localhost
127.0.0.1 auth.localhost
127.0.0.1 element.localhost
127.0.0.1 call.localhost
127.0.0.1 livekit.localhost
127.0.0.1 livekit-jwt.localhost
EOF'
```

#### Step 5: 启动服务

```bash
docker compose up -d
```

#### Step 6: 验证启动

```bash
# 检查所有容器运行状态
docker compose ps

# 应该看到所有服务 "Up" 或 "healthy"
```

### 2.5 创建测试用户

```bash
# 通过 MAS CLI 注册用户
docker compose exec mas mas-cli -c /data/config.yaml manage register-user

# 或访问 https://element.localhost 自助注册
```

### 2.6 .env 配置参考

```bash
# ===== element-docker-demo local dev .env =====

# ---- filesystem / permissions ----
USER_ID=501    # 替换为你的 $(id -u)
GROUP_ID=20    # 替换为你的 $(id -g)

# Store stack data under ./volumes
VOLUME_PATH=./volumes

# ---- domain / fqdn (local) ----
DOMAIN=localhost
HOMESERVER_FQDN=matrix.${DOMAIN}
MAS_FQDN=auth.${DOMAIN}
ELEMENT_WEB_FQDN=element.${DOMAIN}
ELEMENT_CALL_FQDN=call.${DOMAIN}
LIVEKIT_FQDN=livekit.${DOMAIN}
LIVEKIT_JWT_FQDN=livekit-jwt.${DOMAIN}

# ---- telemetry ----
REPORT_STATS=no

# ---- SMTP (local mailhog) ----
SMTP_HOST=mailhog
SMTP_PORT=1025
MAIL_NOTIF_FROM_ADDRESS=noreply@${DOMAIN}

# ---- LiveKit ----
LIVEKIT_NODE_IP=127.0.0.1
```

### 2.7 Web 访问

| 服务 | URL |
|------|-----|
| Element Web | https://element.localhost |
| Element Call | https://call.localhost |
| Matrix API | https://matrix.localhost |
| Auth Service | https://auth.localhost |

---

## 3. K8S Remote Worker

### 3.1 前置条件

- Docker Desktop 已安装
- Kubernetes 已在 Docker Desktop 设置中启用

### 3.2 验证 K8S 可用

```bash
kubectl get nodes
# 应该看到: docker-desktop   Ready    control-plane   ...
```

### 3.3 项目相关文件

| 文件 | 用途 |
|------|------|
| `Dockerfile.remote-worker` | Worker 容器镜像构建 |
| `k8s/remote-worker-config.yaml` | ConfigMap (环境变量) |
| `k8s/remote-worker-deployment.yaml` | Deployment + Service |
| `scripts/run_remote_worker_k8s_v2.mjs` | Worker 启动脚本 |

### 3.4 ConfigMap 配置

```yaml
# k8s/remote-worker-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: remote-worker-config
data:
  MQTT_HOST: "host.docker.internal"  # 从 K8S Pod 访问宿主机
  MQTT_PORT: "1883"
  MQTT_USER: "u"
  MQTT_PASS: "p"
  WORKER_ID: "2"
```

### 3.5 部署命令

```bash
cd /Users/wwpic/codebase/cowork/dongyuapp_elysia_based

# 1. 构建 Docker 镜像
docker build -f Dockerfile.remote-worker -t dy-remote-worker:v2 .

# 2. 应用 K8S 配置
kubectl apply -f k8s/remote-worker-config.yaml
kubectl apply -f k8s/remote-worker-deployment.yaml

# 3. 验证部署
kubectl get pods -l app=remote-worker
kubectl logs -f deployment/remote-worker
```

### 3.6 Dockerfile 参考

```dockerfile
FROM oven/bun:latest

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json* ./
RUN bun install

# 复制必要的代码
COPY packages/worker-base/ ./packages/worker-base/

# 复制 K8s Worker v2 脚本及依赖
COPY scripts/run_remote_worker_k8s_v2.mjs ./scripts/
COPY scripts/worker_engine_v0.mjs ./scripts/

# 确保 patch 文件存在
COPY packages/worker-base/system-models/remote_worker_model.json ./packages/worker-base/system-models/
COPY packages/worker-base/system-models/test_model_100_full.json ./packages/worker-base/system-models/

# 使用 K8s Worker v2
CMD ["bun", "scripts/run_remote_worker_k8s_v2.mjs"]
```

### 3.7 清理命令

```bash
# 删除 K8S 资源
kubectl delete -f k8s/

# 删除镜像
docker rmi dy-remote-worker:v2
```

---

## 4. 洞宇应用环境变量 (.env)

项目根目录的 `.env` 文件配置：

```bash
# Matrix 配置（本地测试）
MATRIX_HOMESERVER_URL=https://matrix.localhost

# UI Server 使用的凭证 (drop 用户)
MATRIX_MBR_USER=@drop:localhost
MATRIX_MBR_PASSWORD=TQcps@123
MATRIX_MBR_ACCESS_TOKEN=mct_tpCHxeQmpiU7akBR6NFdAnprmclyFJ_0q0kc3

# MBR Worker 使用的凭证 (mbr 用户)
MATRIX_MBR_BOT_USER=@mbr:localhost
MATRIX_MBR_BOT_PASSWORD=TQcps@123
MATRIX_MBR_BOT_ACCESS_TOKEN=mct_YjtgVTrlXFPFhwmEh77b9yJB3Ynsan_vKFYV4

# DM Room (drop <-> mbr)
DY_MATRIX_ROOM_ID=!rvgIBRtgXATQGGRWiS:localhost

# 禁用 TLS 验证（自签名证书）
NODE_TLS_REJECT_UNAUTHORIZED=0

# MQTT 配置（本地 Docker）
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_CLIENT_ID=dongyuapp-service-runtime
```

**注意**: Access Token 需要在新环境中重新生成。参见下方「创建 Matrix 用户」章节。

---

## 5. 完整恢复流程

### 5.1 一键部署脚本（推荐）

```bash
#!/bin/bash
# deploy_infrastructure.sh

set -e

echo "=== Step 1: Start EMQX ==="
docker run -d \
  --name emqx \
  --restart unless-stopped \
  -p 1883:1883 \
  -p 8083:8083 \
  -p 8084:8084 \
  -p 8883:8883 \
  -p 18083:18083 \
  emqx/emqx:latest

echo "=== Step 2: Clone and setup Element Docker Demo ==="
cd /Users/wwpic/codebase
if [ ! -d "element-docker-demo" ]; then
  git clone https://github.com/element-hq/element-docker-demo.git
fi
cd element-docker-demo
./setup.sh

echo "=== Step 3: Add hosts entries ==="
sudo sh -c 'grep -q "matrix.localhost" /etc/hosts || cat >> /etc/hosts << EOF
127.0.0.1 matrix.localhost
127.0.0.1 auth.localhost
127.0.0.1 element.localhost
127.0.0.1 call.localhost
127.0.0.1 livekit.localhost
127.0.0.1 livekit-jwt.localhost
EOF'

echo "=== Step 4: Start Element Docker Demo ==="
docker compose up -d

echo "=== Step 5: Wait for services to be healthy ==="
sleep 30

echo "=== Step 6: Build and deploy K8S Worker ==="
cd /Users/wwpic/codebase/cowork/dongyuapp_elysia_based
docker build -f Dockerfile.remote-worker -t dy-remote-worker:v2 .
kubectl apply -f k8s/

echo "=== Done! ==="
echo "EMQX Dashboard: http://localhost:18083 (admin/public)"
echo "Element Web: https://element.localhost"
echo "Matrix API: https://matrix.localhost"
```

### 5.2 创建 Matrix 用户

新环境需要创建以下用户：

```bash
cd /Users/wwpic/codebase/element-docker-demo

# 创建 drop 用户 (UI Server 使用)
docker compose exec mas mas-cli -c /data/config.yaml manage register-user
# 输入: drop / TQcps@123

# 创建 mbr 用户 (MBR Worker 使用)
docker compose exec mas mas-cli -c /data/config.yaml manage register-user
# 输入: mbr / TQcps@123
```

### 5.3 获取 Access Token

```bash
# 使用 curl 登录获取 token
curl -X POST "https://matrix.localhost/_matrix/client/v3/login" \
  -H "Content-Type: application/json" \
  -d '{"type":"m.login.password","user":"drop","password":"TQcps@123"}' \
  --insecure

# 响应中的 access_token 即为 MATRIX_MBR_ACCESS_TOKEN
```

### 5.4 创建 DM Room

```bash
# 使用 drop 用户创建与 mbr 的 DM
curl -X POST "https://matrix.localhost/_matrix/client/v3/createRoom" \
  -H "Authorization: Bearer <drop_access_token>" \
  -H "Content-Type: application/json" \
  -d '{"is_direct":true,"invite":["@mbr:localhost"]}' \
  --insecure

# 响应中的 room_id 即为 DY_MATRIX_ROOM_ID
```

---

## 6. 验证检查清单

- [ ] EMQX 运行: `docker ps | grep emqx`
- [ ] EMQX Dashboard 可访问: http://localhost:18083
- [ ] Element Docker Demo 所有容器运行: `docker compose ps`
- [ ] Element Web 可访问: https://element.localhost
- [ ] K8S 集群可用: `kubectl get nodes`
- [ ] Remote Worker 运行: `kubectl get pods -l app=remote-worker`
- [ ] `.env` 文件已配置正确的 Token 和 Room ID
- [ ] UI Server 可启动: `bun packages/ui-model-demo-server/server.mjs`
- [ ] MBR Worker 可启动: `bun scripts/run_worker_mbr_v0.mjs`

---

## 7. 故障排查

### 问题: EMQX 无法启动

```bash
# 检查端口占用
lsof -i:1883
# 如果被占用，停止占用进程或更换端口
```

### 问题: Element Docker Demo 容器无法通信

```bash
# 检查 Docker 网络
docker network ls
docker network inspect element-docker-demo_backend

# 重启所有服务
cd /Users/wwpic/codebase/element-docker-demo
docker compose down && docker compose up -d
```

### 问题: K8S Pod 无法连接 MQTT

```bash
# 确认使用 host.docker.internal 而非 localhost
kubectl describe configmap remote-worker-config
# MQTT_HOST 应为 "host.docker.internal"
```

### 问题: Matrix 连接失败

```bash
# 检查证书
curl -v https://matrix.localhost --insecure

# 确认 NODE_TLS_REJECT_UNAUTHORIZED=0 已设置
```

---

## 8. 参考文档

- [EMQX 官方文档](https://www.emqx.io/docs/en/v5.0/)
- [Element Docker Demo README](https://github.com/element-hq/element-docker-demo)
- [Matrix Synapse Admin API](https://matrix-org.github.io/synapse/latest/usage/administration/admin_api/index.html)
- [Docker Desktop Kubernetes](https://docs.docker.com/desktop/kubernetes/)
