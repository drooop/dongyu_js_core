# Runtime Baseline Default

## 1. 默认策略

1. 本仓库默认运行模式是 Docker + K8s 常驻基线。
2. 默认不使用本地 `scripts/run_worker_mbr_v0.mjs`。
3. Matrix/Element 服务以 `../element-docker-demo` 的 Docker 服务为准。
4. 不依赖 `metrics-server` 作为链路健康前置条件。

## 2. 常驻组件（应保持 Running）

1. Docker：
- `element-docker-demo-*`（至少 `synapse` / `nginx` / `element-web`）
- `mosquitto`
  - restart policy: `unless-stopped`
2. K8s（context=`docker-desktop`, namespace=`default`）：
- `deployment/mbr-worker` replicas = 1
- `deployment/remote-worker` replicas = 1
- `service/remote-worker-svc` 有 endpoint

## 2.1 MBR 位置记录（ModelTable 优先）

1. 能用则用 ModelTable Cell Label 记录 `mbr` 位置。
2. 推荐写入：
- `model_id=-10, p=0, r=0, c=0`
- `k=mbr_location, t=json`
- `v` 示例：
  - `{"mode":"k8s","context":"docker-desktop","namespace":"default","deployment":"mbr-worker","matrix_room_id":"!xxx:localhost"}`
3. 若当下不能使用该 Label，执行者必须先说明原因并与 User 讨论确认后，才能使用替代方式（env/doc/命令约定）。

## 3. 一键恢复与检查

工作目录：仓库根目录

```bash
bash scripts/ops/ensure_runtime_baseline.sh
bash scripts/ops/check_runtime_baseline.sh
```

## 4. 本地测试默认动作

1. 先执行第 3 节两条命令，确认基线 Ready。
2. 再按需启动本地 UI 侧软件工人：

```bash
node scripts/run_worker_ui_side_v0.mjs
```

3. 如无特别说明，后续所有手工测试均按该默认路径执行。

## 5. 旧入口归档

1. 归档：`archive/scripts/legacy/run_worker_mbr_v0.legacy.mjs`
2. 兼容壳：`scripts/run_worker_mbr_v0.mjs`
3. 仅应急可启用：

```bash
ALLOW_LEGACY_MBR=1 node scripts/run_worker_mbr_v0.mjs
```
