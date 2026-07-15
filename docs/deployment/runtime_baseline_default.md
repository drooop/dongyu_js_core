---
title: "Runtime Baseline Default"
doc_type: deployment
status: active
updated: 2026-07-16
source: ai
---

# Runtime Baseline Default

Status: current deployment/runbook baseline. Treat `ensure_runtime_baseline.sh` as mutating; use `check_runtime_baseline.sh` for read-only confirmation.

## 1. 默认策略

1. 本地测试与 acceptance 固定使用全 K8s 常驻基线，namespace=`dongyu`。
2. Docker context 必须精确为 `orbstack`，Kubernetes context 必须精确为 `orbstack`；任一不匹配都必须 fail closed。
3. 无独立 Docker 容器依赖。所有组件（MQTT、Synapse、Workers、UI Server）均在该本地 K8s 集群内运行。
4. 默认不使用本地 `scripts/run_worker_mbr_v0.mjs`。
5. 不依赖 `metrics-server` 作为链路健康前置条件。

## 2. 常驻组件（应保持 Running）

本地 K8s（Docker/Kubernetes context 均为 `orbstack`；namespace=`dongyu`）固定包含以下六个 deployment：
- `deployment/mosquitto` replicas = 1 (MQTT broker)
- `deployment/synapse` replicas = 1 (Matrix homeserver, server_name=localhost)
- `deployment/remote-worker` replicas = 1
- `deployment/workspace-manager` replicas = 1
- `deployment/mbr-worker` replicas = 1
- `deployment/ui-server` replicas = 1
- `service/ui-server-nodeport` NodePort 30900 (本地访问)

Manifests 位置：`k8s/local/`

## 2.1 MBR 位置记录（ModelTable 优先）

1. 能用则用 ModelTable Cell Label 记录 `mbr` 位置。
2. 推荐写入：
- `model_id=-10, p=0, r=0, c=0`
- `k=mbr_location, t=json`
- `v` 示例：
  - `{"mode":"k8s","context":"orbstack","namespace":"dongyu","deployment":"mbr-worker","matrix_room_id":"!xxx:localhost"}`
3. 若当下不能使用该 Label，执行者必须先说明原因并与 User 讨论确认后，才能使用替代方式（env/doc/命令约定）。

## 3. 一键恢复与检查

工作目录：仓库根目录

```bash
bash scripts/ops/ensure_runtime_baseline.sh --force-rebuild
bash scripts/ops/check_runtime_baseline.sh
```

首次部署，或代码、镜像、manifest、actor asset 发生变化时，必须使用上面的 `--force-rebuild` 入口；它会构建镜像、应用本地部署、等待 rollout，再执行基线检查。不得把单独执行 `docker build` 或无参数的 `ensure_runtime_baseline.sh` 当作变更后的部署完成证据。

UI Server 访问地址：`http://localhost:30900`

## 3.1 认证控制

- `DY_AUTH=0`：禁用服务端认证守卫，前端直接访问（本地开发默认）
- `DY_AUTH` 未设置或非 `0`：启用认证守卫，需登录后访问
- Model -3 (login_form) 始终创建，供后续 ModelTable 驱动登录页复用

## 4. 镜像构建

以下命令只用于单独排查镜像构建；它们不会应用 deployment 或替换正在运行的 Pod，不能作为 acceptance 的部署入口：

```bash
docker build -f k8s/Dockerfile.remote-worker -t dy-remote-worker:v3 .
docker build -f k8s/Dockerfile.mbr-worker -t dy-mbr-worker:v2 .
docker build -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .
```

## 5. Synapse 用户初始化（首次）

```bash
kubectl exec -n dongyu deploy/synapse -- register_new_matrix_user -u mbr -p <password> -c /data/homeserver.yaml --no-admin http://localhost:8008
kubectl exec -n dongyu deploy/synapse -- register_new_matrix_user -u drop -p <password> -c /data/homeserver.yaml --admin http://localhost:8008
```

## 6. 旧入口归档

1. 归档：`archive/scripts/legacy/run_worker_mbr_v0.legacy.mjs`
2. 兼容壳：`scripts/run_worker_mbr_v0.mjs`
3. 仅应急可启用：

```bash
ALLOW_LEGACY_MBR=1 node scripts/run_worker_mbr_v0.mjs
```
