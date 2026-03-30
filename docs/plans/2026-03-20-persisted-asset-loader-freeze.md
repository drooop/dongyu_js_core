---
title: "Persisted Asset Loader Freeze"
doc_type: note
status: active
updated: 2026-03-21
source: ai
---

# Persisted Asset Loader Freeze

## 1. Executive Summary

当前仓库已经实现了 patch-first worker 和 page asset modelization，但 **Tier 2 资产的部署 authority 仍然在镜像里**。

这意味着：

- 改 worker role patch 仍要重新 build 镜像
- 改 `ui-server` 读取的 system-model patch 仍要重新 build 镜像
- local mode 仍把多个 UI asset patch 编译进 bundle

因此，当前 Tier 1 / Tier 2 分层在“代码组织”上成立，但在“部署 authority”上尚未成立。

本轮冻结的目标是：

1. 所有 **model assets** 的 authoritative source 来自 persisted asset root
2. loader 由 **manifest + phase** 主导，而不是隐式散落在代码里
3. runtime writeback 与 authoritative asset 分离
4. 先解决 worker / ui-server 的 patch 外挂化，再处理 frontend thin shell

## 2. Current Fact Matrix

### 2.1 UI Server Remote Mode

当前路径：

1. `createServerState()` 创建 runtime
2. 如存在 `yhl.db`，先通过 sqlite persistence 加载 program model
3. `loadSystemModelPatches(runtime, systemModelsDir)` 从磁盘目录读取所有 `system-models/*.json`，但仅筛负数模型
4. `loadFullModelPatches(...workspace_positive_models.json, test_model_100_ui.json...)` 再按文件名显式读取部分正数 patch
5. `MODELTABLE_PATCH_JSON` 作为 bootstrap overlay 再 apply
6. server 再手工 `ensureStateLabel(...)` 补一批 host/editor state

事实结论：

- system-model patch 已是 runtime 从磁盘读取，不是 server 代码内联
- 但这些“磁盘文件”仍来自镜像内容，因为 [Dockerfile.ui-server](/Users/drop/codebase/cowork/dongyuapp_elysia_based/k8s/Dockerfile.ui-server) 在 build 时 `COPY` 整个相关目录
- 因此 patch 仍然是 build-time baked，只是 read-time 动态

### 2.2 MBR Worker

当前路径：

1. `run_worker_v0.mjs` 创建 runtime
2. `loadSystemPatch(rt)` 通过代码加载 `system_models.json`
3. 从 role patch 目录按文件名字母序 `readdirSync(...).sort()` 逐个 apply
4. `MODELTABLE_PATCH_JSON` 再 overlay
5. 启动 Matrix/MQTT host glue

事实结论：

- role patch 已是 patch-first
- 但 `system_models.json` 与 `deploy/sys-v1ns/mbr/patches` 都由 Dockerfile COPY 进镜像
- MBR 仍没有 persisted asset root 概念

### 2.3 Remote Worker

当前路径：

1. `run_worker_remote_v1.mjs`
2. `loadSystemPatch(rt)` 加载 `system_models.json`
3. 读取 role patch 目录，按文件名排序 apply
4. startMqttLoop + patch-configured subscriptions

事实结论：

- runner 已接近最小 glue
- 但 patch 来源仍是镜像内目录

### 2.4 UI-side Worker

当前路径：

1. `run_worker_ui_side_v0.mjs`
2. `loadSystemPatch(rt)` 加载 `system_models.json`
3. `loadRolePatches(rt, patchDirAbs)` 读取 role patch 目录
4. 读取 `MODELTABLE_PATCH_JSON`
5. 启动 Matrix adapter 与 HTTP debug surface

事实结论：

- 已 patch-first
- cloud/local manifest 已存在
- 但 patch 与 system models 同样 baked in image

### 2.5 Frontend Local Mode

当前路径：

1. `main.js` 在 `mode=local` 时创建 `createDemoStore()`
2. `demo_modeltable.js` 静态 `import ...json with { type: 'json' }`
3. local runtime apply 这些 patch
4. `localStorage` persistence overlay 再叠加到 runtime

事实结论：

- local mode 当前是显式 build-time baked
- 它是开发路径，不是 `0200` 的主要 blocker
- 但若长期目标是 thin shell，这条路径后续也应被重新设计

### 2.6 Component Registry

当前路径：

- [component_registry_v1.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-renderer/src/component_registry_v1.json) 由 renderer 直接 import

事实结论：

- 它是数据，不是代码
- 当前作为 build-time 常量进入 renderer bundle
- 按新的架构理解，它不应继续被视为“永久 baked 的 Tier 1 常量”

## 3. Core Decision

### 3.1 Authoritative Source Rule

正式冻结：

> 所有 model assets 的 authoritative source 必须来自 persisted asset root，而不是镜像内隐式 COPY 的工作目录。

这包括：

- `system_models.json`
- `packages/worker-base/system-models/*.json`
- `deploy/sys-v1ns/*/patches/*.json`
- 后续 component registry / page catalog / role patch manifest

### 3.2 Loader Rule

正式冻结：

> loader 以 manifest 为主，排序规则为辅。

即：

- 主规则：显式 manifest phase / entries
- 辅规则：同一 phase 内按 deterministic key 排序
- `model_id` 负到正、绝对值排序只能作为 fallback，不是唯一依赖规则

### 3.3 Writeback Rule

正式冻结：

> authoritative assets、bootstrap-generated overlays、runtime volatile state 必须分层处理，不得混为一类 persistence。

## 4. Target Directory Model

推荐目标根目录：

```text
persisted-assets/
├── manifest.v0.json
├── system/
│   ├── base/
│   │   └── system_models.json
│   ├── ui/
│   │   ├── nav_catalog_ui.json
│   │   ├── home_catalog_ui.json
│   │   ├── docs_catalog_ui.json
│   │   ├── static_catalog_ui.json
│   │   ├── workspace_catalog_ui.json
│   │   ├── prompt_catalog_ui.json
│   │   └── editor_test_catalog_ui.json
│   └── positive/
│       ├── workspace_positive_models.json
│       └── test_model_100_ui.json
├── roles/
│   ├── mbr/
│   │   └── patches/
│   ├── remote-worker/
│   │   └── patches/
│   └── ui-side-worker/
│       └── patches/
├── registry/
│   └── component_registry_v1.json
├── bootstrap-generated/
│   ├── ui-server/
│   ├── mbr-worker/
│   └── remote-worker/
└── volatile/
    ├── ui-server/
    ├── browser-local/
    └── traces/
```

说明：

- `system/` 和 `roles/` 是 authoritative assets
- `bootstrap-generated/` 是 deploy 脚本生成的 overlay，不能反写到 authoritative asset
- `volatile/` 是 runtime 层，不参与 authoritative load order

## 5. Manifest Schema

推荐最小 schema：

```json
{
  "version": "dy.asset_manifest.v0",
  "entries": [
    {
      "id": "system-base",
      "phase": "00-system-base",
      "path": "system/base/system_models.json",
      "kind": "patch",
      "scope": ["ui-server", "mbr-worker", "remote-worker", "ui-side-worker"],
      "authority": "authoritative",
      "filter": "full",
      "required": true
    }
  ]
}
```

每个 entry 至少包含：

- `id`
- `phase`
- `path`
- `kind`
- `scope`
- `authority`
- `filter`
- `required`

建议语义：

- `kind`: `patch | registry | overlay`
- `scope`: 适用宿主
- `authority`: `authoritative | bootstrap-generated | volatile`
- `filter`: `full | negative-only | positive-only`

## 6. Phase Ordering

推荐 phase：

1. `00-system-base`
   - `system_models.json`

2. `10-system-negative`
   - 所有负数系统/UI catalog 资产

3. `20-role-negative`
   - 各 worker 角色负数模型与 role config

4. `30-system-positive`
   - 可共享正数 demo / seeded models

5. `40-role-positive`
   - role-specific 正数业务模型

6. `50-bootstrap-generated`
   - `MODELTABLE_PATCH_JSON` 等 deploy generated overlays

7. `60-runtime-persistence`
   - sqlite/local persisted program data

8. `70-volatile-init`
   - 非 authoritative 的 host/editor/mailbox/init labels

规则：

- phase 之间严格顺序
- phase 内显式 list 优先，若无则按 `path` 排序
- `model_id` 排序仅用于 patch 内部 deterministic apply 的兜底，不作为跨文件主规则

## 7. Writeback / Volatile Classification

### 7.1 Authoritative Assets

只允许通过文件变更更新，不允许 runtime 直接写回：

- page catalogs / UI AST models
- role patches
- component registry
- shared positive demo models

### 7.2 Bootstrap-generated Overlays

由 deploy/scripts 生成，可被覆盖，但不应由 runtime 修改：

- Matrix room / token / mqtt bootstrap patch
- environment-derived secrets

### 7.3 Runtime Persistent Data

允许宿主持久化，但不应回写到 authoritative asset root：

- program data in sqlite
- 用户通过 UI 编辑后产生的真实业务模型数据

### 7.4 Volatile State

默认不进入 authoritative persistence：

- mailbox / ui_event / inflight
- route sync state
- editor filters / dialogs / temporary drafts
- trace/event log

## 8. Component Registry Decision

正式冻结：

> `component_registry_v1.json` 视为 Tier 2 / 类 Tier 2 数据资产，而非永久 baked 的 Tier 1 常量。

解释：

- renderer 代码仍是 Tier 1 解释器
- 但 registry 是“解释什么”的数据
- 它后续应进入 persisted asset loader 路径

这不要求本轮就实现前端 thin shell，只要求后续不要再把 registry 当作不动的 build-time 常量来设计

## 9. Immediate Implementation Split

### 0200b — Local Patch Externalization

目标：

- 先把 `ui-server + mbr-worker + remote-worker + ui-side-worker` 的 authoritative patch 目录改为外部挂载读取
- 保持现有业务逻辑不变

完成标准：

- 修改 patch 文件后，只需更新挂载内容 + rollout restart
- 不需要重新 build 镜像

### 0200c — Local Loader Validation

目标：

- 在本地证明 manifest/phase/外挂目录路径能稳定工作
- 补浏览器与脚本证据

### 0200 恢复条件

只有在以下条件满足后，`0200` 才从 On Hold 恢复：

1. 本地 authoritative patch 已可外挂化
2. 本地验证已证明“改 patch 不重建镜像”
3. cloud deploy 链已明确如何挂载同一套 persisted asset root

## 10. Explicit Non-Goals

本轮不做：

- 前端 thin shell 的完整实现
- local mode 全动态化
- component registry 动态拉取实现
- 远端部署

这些都属于后续迭代。

## 11. Final Recommendation

推荐后续顺序：

1. `0200a` 冻结规约
2. `0200b` 本地 patch 外挂化实现
3. `0200c` 本地验证
4. 恢复 `0200` 远端部署与浏览器验收
5. 再单独规划 frontend thin shell / registry 动态化
