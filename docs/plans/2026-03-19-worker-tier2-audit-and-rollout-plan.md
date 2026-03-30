---
title: "Worker Tier2 Audit And Rollout Plan"
doc_type: note
status: active
updated: 2026-03-21
source: ai
---

# Worker Tier2 Audit And Rollout Plan

## 1. Executive Summary

当前 3 个目标系统不在同一演进阶段：

| 系统 | 当前入口 | 当前结论 | 进入后续实现的优先级 |
|---|---|---|---|
| MBR | `k8s/Dockerfile.mbr-worker` → `scripts/run_worker_v0.mjs` → `deploy/sys-v1ns/mbr/patches/` | 部署入口不是 deprecated 脚本，但运行路径仍依赖 `WorkerEngineV0`、Matrix/MQTT 手工桥接与旧标签体系；必须重填 | 高 |
| 测试用远端软件工人角色 | `k8s/Dockerfile.remote-worker` → `scripts/run_worker_remote_v1.mjs` → `deploy/sys-v1ns/remote-worker/patches/` | runner 已接近 fill-table minimal bootstrap，但 patch 内容仍是旧语义；应优先重填模型表 | 高 |
| 测试用 UI-side 软件工人 | `scripts/run_worker_ui_side_v0.mjs`（当前无 K8s manifest） | 仍是 `WorkerEngineV0` + 手工 `createModel/addFunction/addLabel` + HTTP debug server；与新版 Tier 2 最远 | 最高 |

核心判断：

- MBR 和 remote worker 目前都不是“完全未迁移”，但都还没有达到新版规约要求的“业务能力主要由 Tier 2 patch 表达”。
- UI-side worker 当前更像一段实验性脚本，而不是一个已经制度化部署的软件工人角色。
- 后续 `0196/0197/0198` 应分别处理 3 个系统，不能合并成一个大迭代。
- `0199/0200` 必须把部署验证独立出来，并以真实浏览器动作为最终验收。

## 2. System Gap Matrix

| 系统 | 事实入口 | 与新版规约的主要差距 | 是否已有部署入口 | 建议后续迭代 |
|---|---|---|---|---|
| MBR | `scripts/run_worker_v0.mjs` + `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json` | 使用 `WorkerEngineV0`；依赖 `MGMT_OUT`、`MQTT_WILDCARD_SUB`、`run_mbr_*` 触发；逻辑在 generic worker + patch function 混合存在；没有按当前 `pin.bus.* / pin.connect.* / model.submt` 体系重填 | 有，本地/云端都通过 `dy-mbr-worker:v2` 部署 | `0196-mbr-tier2-rebase` |
| 远端软件工人角色 | `scripts/run_worker_remote_v1.mjs` + `deploy/sys-v1ns/remote-worker/patches/*.json` | runner 仅负责 `loadSystemPatch + role patch + startMqttLoop`，但 patch 仍使用旧标签与旧模型内容，如 `MQTT_WILDCARD_SUB`、`ui_type`、`routing/wiring` 自定义 key、system model 函数直写业务模型 | 有，本地/云端都通过 `dy-remote-worker:v3` 部署 | `0197-remote-worker-role-tier2-rebase` |
| 测试用 UI-side 软件工人 | `scripts/run_worker_ui_side_v0.mjs` | 仍使用 `WorkerEngineV0`；脚本内部 `createModel(-10/1)`、`addFunction`、`setLabel` 手工初始化；通过 Matrix adapter 订阅 `snapshot_delta`；没有 patch 目录，也没有部署 manifest | 无独立 K8s 部署入口 | `0198-ui-side-worker-tier2-rebase` |
| UI Server host（用于浏览器入口） | `packages/ui-model-demo-server/server.mjs` + `k8s/Dockerfile.ui-server` | 不是本轮三大重填对象，但它是 `0199/0200` 浏览器验收的前台入口；仍保留大量 host-owned state seed，需要与“测试用 UI-side 软件工人”区分 | 有，本地/云端都部署 | `0199/0200` 依赖项，不单独重填 |

## 3. Hardcoded Init vs Patch Init Matrix

### 3.1 MBR

| 项目 | 现状 | 判定 |
|---|---|---|
| 本地独立入口 | `scripts/run_worker_mbr_v0.mjs` 已 deprecated，默认退出 | 历史入口，不应作为后续主路径 |
| 实际部署入口 | `k8s/Dockerfile.mbr-worker` 运行 `scripts/run_worker_v0.mjs` | 当前真实入口 |
| system bootstrap | `loadSystemPatch(rt)` | 可接受但仍是旧 generic worker 体系 |
| role init | `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json` | patch 存在，但语义仍是旧桥接设计 |
| runtime glue | `run_worker_v0.mjs` 手工创建 MQTT/Matrix adapter、手工订阅 topic、手工将 Matrix/MQTT 事件写入 `mbr_mgmt_inbox` / `mbr_mqtt_inbox` | 非最小基座，后续需要重新界定哪些仍属于 host glue |
| bootstrap secret | `_deploy_common.sh` 生成 `mbr_worker_bootstrap_v0` → `MODELTABLE_PATCH_JSON` | 当前是正确方向，可继续保留为连接参数 bootstrap |

### 3.2 Remote Worker Role

| 项目 | 现状 | 判定 |
|---|---|---|
| 部署入口 | `k8s/Dockerfile.remote-worker` 运行 `scripts/run_worker_remote_v1.mjs` | 接近目标 |
| system bootstrap | `loadSystemPatch(rt)` | runner 层仍是旧 loader 名称，但模式简单 |
| role init | `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json` + `10_model100.json` | patch 已是主承载面，但模型表内容过旧 |
| runtime glue | runner 负责 `startMqttLoop`、打印 BUS/MQTT 诊断、载入 patch | 这部分接近“最小基座” |
| business logic | `10_model100.json` 中函数仍直接 `ctx.writeLabel` 业务 root，并 `ctx.publishMqtt(...patch_out)` | 必须按新版规约重填 |

### 3.3 UI-side Worker

| 项目 | 现状 | 判定 |
|---|---|---|
| 入口 | `scripts/run_worker_ui_side_v0.mjs` | 唯一入口，但仍是测试脚本风格 |
| patch 目录 | 无 | 明显缺口 |
| system init | `loadSystemPatch(rt)` 后手工 `createModel(-10)` 与 `createModel(1)` | 不符合 Tier 2 重填目标 |
| function init | `addFunction(rt, 'ui_apply_snapshot_delta', code)` | 典型硬编码 function 初始化 |
| state init | `setLabel(...slide_demo_text...)` | 典型硬编码模型表 |
| deployment | 当前没有对应 Dockerfile/manifest/ConfigMap/Secret | 需要在 `0198` 同步补齐部署路径或明确废弃 |

## 4. Current Patch/Model Ownership Map

### 4.1 建议保留为 role patch 的部分

| 角色 | 建议目录 | 内容 |
|---|---|---|
| MBR | `deploy/sys-v1ns/mbr/patches/` | 角色特有 routing / bridge / intent / relay patch |
| Remote Worker Role | `deploy/sys-v1ns/remote-worker/patches/` | 远端角色特有模型、端口、函数、业务演示模型 |
| UI-side Worker | 建议新增 `deploy/sys-v1ns/ui-side-worker/patches/` | UI-side worker 特有模型、端口、函数、debug surface |

### 4.2 建议保留为 bootstrap patch 的部分

| 来源 | 当前机制 | 后续建议 |
|---|---|---|
| `ui-server-secret` | `_deploy_common.sh` 生成 `MODELTABLE_PATCH_JSON` | 保留，仅承载连接/认证/bootstrap 参数 |
| `mbr-worker-secret` | `_deploy_common.sh` 生成 `MODELTABLE_PATCH_JSON` | 保留，仅承载连接/认证/bootstrap 参数 |

### 4.3 不应继续混入 bootstrap patch 的部分

| 类型 | 说明 |
|---|---|
| 业务模型表 | 例如 remote role 的 `Model 100`、UI-side worker 的测试模型 |
| 角色业务函数 | 例如桥接逻辑、业务处理逻辑、路由拓扑 |
| 页面/业务状态 | 不应靠 secret inline patch 临时塞入 |

## 5. Label / Form Compliance Findings

### 5.1 MBR patch 的主要旧语义

在 [mbr_role_v0.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/deploy/sys-v1ns/mbr/patches/mbr_role_v0.json) 中，当前可见的主要旧语义包括：

- `MQTT_WILDCARD_SUB`
- `MGMT_OUT`
- `run_mbr_*` string trigger
- system root `-10` 上的大量 role-specific state

这些并不等于“完全不可运行”，但它们表明：

- 该 patch 不是按当前 `label_type_registry` 主干口径重填的
- 它仍依赖旧 generic worker + old bridge 设计

### 5.2 Remote worker patch 的主要旧语义

在 [10_model100.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/deploy/sys-v1ns/remote-worker/patches/10_model100.json) 中可见：

- `create_model` + `type: "ui"`，但没有当前明确 `model_type = model.single/model.table` 根声明
- root 仍使用 `ui_type`
- `routing` / `wiring` 作为业务 key 承载 `pin.connect.*`
- 业务函数放在 `model_id: -10`
- 函数内直接 `ctx.writeLabel` 写业务 root，并 `ctx.publishMqtt` 外发 patch

判断：

- 该 runner 已接近目标
- 该 patch 本身仍需要重填，不能只靠 runner 保持现状

### 5.3 UI-side worker 的主要旧语义

在 [run_worker_ui_side_v0.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/run_worker_ui_side_v0.mjs) 中：

- 手工 `createModel`
- 手工 `addFunction`
- 手工 `setLabel`
- Matrix subscribe 回调里直接写系统 inbox + trigger
- 附带 HTTP 调试接口

这基本说明它尚未进入“patch-first software worker”阶段。

## 6. Deployment Prerequisites

### 6.1 Local (`0199`)

必须具备：

- 可用 Kubernetes context
- Docker daemon
- `deploy/env/local.env`
- `scripts/ops/ensure_runtime_baseline.sh` 可通过
- `mosquitto` / `synapse` / `remote-worker` / `mbr-worker` / `ui-server` rollout 正常
- `ui-server-secret` / `mbr-worker-secret` 中 `MODELTABLE_PATCH_JSON` 就绪
- 浏览器可访问本地入口：
  - `http://localhost:30900`
  - 或 `start_local_ui_server_k8s_matrix.sh` 启起的本地端口

当前 repo 已有可复用入口：

- [deploy_local.sh](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/ops/deploy_local.sh)
- [run_model100_submit_roundtrip_local.sh](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/ops/run_model100_submit_roundtrip_local.sh)
- [start_local_ui_server_k8s_matrix.sh](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/ops/start_local_ui_server_k8s_matrix.sh)

### 6.2 Remote (`0200`)

必须具备：

- 云端 root / sudo 权限
- rke2 kubeconfig
- `ctr` / docker 可用
- `deploy/env/cloud.env`
- `scripts/ops/deploy_cloud_full.sh` 可运行
- `ui-server` / `mbr-worker` / `remote-worker` 三镜像可构建导入
- 远端白名单操作限制：
  - kubectl
  - helm
  - docker / ctr
  - rsync / scp
- 不触碰 `CLAUDE` 禁止的集群级危险操作

## 7. Browser Test Matrix

后续 `0199/0200` 的浏览器验收建议按下表冻结：

| 测例 | 页面入口 | 操作 | 预期结果 | 主要覆盖 |
|---|---|---|---|---|
| Remote role / Model100 submit | `#/model100` 或等效 Workspace 入口 | 输入文本，点击 submit / Generate Color | UI 状态变化、业务结果回写、远端链路生效 | remote worker role |
| Workspace registry visibility | `#/workspace` | 从左侧选择能力应用 / worker app | 目标应用可见、可打开、可交互 | catalog / registry |
| MBR bridge roundtrip | 浏览器触发一次会进入桥接链的动作 | 页面动作触发后，最终 UI 观测到预期结果；trace / status 与桥接状态一致 | MBR |
| UI-side worker flow | 为其提供的测试页面或状态入口 | 在浏览器中触发 UI-side worker 专属动作 | 页面与 worker 状态同步成功 | test UI-side worker |

统一 DoD：

1. 合同测试 PASS  
2. 部署成功  
3. Playwright 测例 PASS  
4. 真实浏览器人工操作 PASS  
5. runlog 附步骤与截图/页面证据

## 8. Rollout Split

### 0196 — MBR Tier2 Rebase

目标：

- 将 MBR 的 role patch 按当前规约重填
- 明确 generic worker bootstrap 中哪些仍保留为 host glue，哪些迁入 Tier 2 patch

风险：

- 现有 `run_worker_v0.mjs` 与 `mbr_role_v0.json` 强耦合
- 需要同时处理 Matrix/MQTT/bootstrap 三层边界

回滚点：

- 保留当前 `mbr_role_v0.json`
- 不在同一轮中删除旧镜像或旧 patch

### 0197 — Remote Worker Role Tier2 Rebase

目标：

- 重填 remote worker role patch
- 让 remote role 与新版 `pin.* / model_type / model.submt / route` 口径一致

风险：

- Model100 仍是旧演示模型，可能需要同时重写 browser 测例

回滚点：

- runner `run_worker_remote_v1.mjs` 不动，先只替换 role patch

### 0198 — UI-side Worker Tier2 Rebase

目标：

- 为 UI-side worker 建立正式 patch 目录与部署入口
- 移除 `run_worker_ui_side_v0.mjs` 中的手工模型初始化

风险：

- 当前无现成部署 manifest
- 需要决定该角色是否保留独立 worker 形态，还是并入其它系统

回滚点：

- 新旧入口并存，先不删 `run_worker_ui_side_v0.mjs`

### 0199 — Local Integrated Browser Validation

目标：

- 在本地完成：
  - 部署
  - Playwright
  - 人工浏览器操作

风险：

- 很容易把环境问题和规约问题混在一起

回滚点：

- 仅记录验证，不在本轮改业务实现

### 0200 — Remote Integrated Browser Validation

目标：

- 在云端完成：
  - 部署
  - Playwright
  - 人工浏览器操作

风险：

- 远端网络、ingress、token、镜像版本漂移

回滚点：

- 通过保留上一版镜像/tag 与旧 patch 目录实现回退

## 9. Immediate Recommendations

1. `0196` 不要沿用 deprecated 的 [run_worker_mbr_v0.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/run_worker_mbr_v0.mjs) 作为实施对象。  
   真正应审的是 `dy-mbr-worker:v2` 当前跑的 [run_worker_v0.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/run_worker_v0.mjs) + role patch 路径。

2. `0197` 应优先利用 remote worker 已有的 minimal runner 优势。  
   重点不是重写 runner，而是重填 patch。

3. `0198` 需要先做一个明确决策：  
   “测试用 UI-side worker” 是保留为独立 worker，还是并入现有 UI-server host 体系。  
   当前审计倾向：先按独立 worker 处理，避免把 host server 和 worker role 混为一谈。

4. `0199/0200` 必须先冻结浏览器测例矩阵，再执行部署。  
   否则部署成功与业务验收会再次混在一起。
