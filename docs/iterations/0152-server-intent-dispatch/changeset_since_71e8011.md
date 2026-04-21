---
title: "Changeset Summary since commit 71e8011"
doc_type: iteration-note
status: active
updated: 2026-04-21
source: ai
iteration_id: 0152-server-intent-dispatch
id: 0152-server-intent-dispatch
---

# Changeset Summary since commit 71e8011

> Scope: all uncommitted changes on branch `dev_0152-server-intent-dispatch`
> Base commit: `71e8011 Commit all changes except snake.html`
> Date: 2026-02-23
> Stats: 38 meaningful files changed (excl .playwright-cli), +980 / -4723 lines

---

## 1. 全局架构演进方向

本批变更横跨 4 个迭代（0149 补完、0150、0151、0152），核心推进方向一致：

**将 server.mjs 从"大一统业务服务器"转变为"纯运行时宿主"。**

具体拆解为三步：
1. **0150** — 基础设施下沉：Matrix adapter 从独立包迁入 worker-base 基座。
2. **0151** — 特判消除：Model 100 硬编码逻辑 + 内嵌样例数据迁出为模型定义。
3. **0152** — 通用调度：action 分支替换为查表 dispatch + event trigger map，handler 函数化。

演进前后对比：

```
Before (71e8011):
  server.mjs = runtime host + Matrix client + Model 100 特判 + docs/static/ws handler + workspace 种子
  bus-mgmt/  = 独立 Matrix adapter 包

After (current):
  server.mjs = runtime host + ctx.hostApi 注入 + 通用 dispatch 框架 + legacy fallback
  worker-base/ = runtime + Matrix adapter + loopback + mgmt event 校验（基座统一）
  system-models/*.json = dispatch table + trigger map + handler 函数 + 应用定义（填表层）
  bus-mgmt/ = DELETED
```

---

## 2. 迭代 0149 — Cloud 部署同步（补完）

**状态**: In Progress（runlog 补齐）

### 变更文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `docs/iterations/0149-.../runlog.md` | M | +229 行执行记录补齐 |
| `docs/iterations/0149-.../assets/` | NEW | K8s job YAML 模板（image import） |
| `k8s/cloud/workers.yaml` | M | hostPath 挂载替代 PVC，新增 env vars |
| `k8s/cloud/synapse.yaml` | M | rc_message 速率限制调优 |
| `k8s/cloud/mbr-update.yaml` | M | 镜像引用更新 |
| `deploy/env/cloud.env.example` | M | 新增 DOCS_ROOT/STATIC_PROJECTS_ROOT |

### 关键决策

- **Synapse 速率限制**：`rc_message.per_second: 10, burst_count: 50`（原默认 0.2/s），解决 dy.bus.v0 burst 模式 429 问题。
- **PVC → hostPath**：ui-server 静态文件存储从 PVC 改为 hostPath 挂载，简化本地/云端一致性。

---

## 3. 迭代 0150 — Matrix adapter 基座化

**状态**: In Progress（代码完成，[[ITERATIONS]] 未标 Completed）

### 目标

删除 `packages/bus-mgmt/`，将 Matrix/loopback adapter 迁入 `packages/worker-base/` 统一基座。

### 变更文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `packages/worker-base/src/matrix_live.js` | NEW | Matrix adapter（429 retry/backoff、placeholder 检查、insecureFetch） |
| `packages/worker-base/src/loopback.js` | NEW | Loopback adapter（本地测试） |
| `packages/worker-base/src/mgmt_bus_event_v0.js` | NEW | MGMT event v0 校验函数 |
| `packages/worker-base/src/index.js` | M | 新增导出 |
| `packages/bus-mgmt/src/adapter.js` | D | 删除 |
| `packages/bus-mgmt/src/loopback.js` | D | 删除 |
| `packages/bus-mgmt/src/matrix_live.js` | D | 删除 |
| `scripts/run_worker_v0.mjs` | M | import 路径更新 |
| `scripts/run_worker_ui_side_v0.mjs` | M | import 路径更新 |
| `scripts/validate_*.mjs` (5 files) | M | import 路径更新 |
| `archive/scripts/legacy/run_worker_mbr_v0.legacy.mjs` | M | 标记 legacy |
| `k8s/Dockerfile.mbr-worker` | M | 删除 COPY bus-mgmt 行 |
| `docs/handover/dam-worker-guide.md` | M | 路径引用更新 |
| `docs/iterations/0150-*/` | NEW | plan + resolution + runlog |

### 架构影响

- **Matrix client 职责转换**: server.mjs 不再自管 Matrix send queue/retry；统一调用 `adapter.publish()`。
- **Adapter 订阅机制**: `adapter.subscribe(fn)` / `adapter.unsubscribe()` 函数对。
- **包结构**: `bus-mgmt/` 完全删除，worker-base 成为唯一 adapter 来源。

### 文件系统结构变化

```
Before:
  packages/bus-mgmt/src/{adapter,matrix_live,loopback}.js    (独立包)
  packages/worker-base/src/{runtime,...}                      (不含 adapter)

After:
  packages/worker-base/src/{runtime,matrix_live,loopback,mgmt_bus_event_v0}.js  (统一基座)
  packages/bus-mgmt/                                          (DELETED)
```

---

## 4. 迭代 0151 — Server 去 Model 100 特判

**状态**: Completed

### 目标

消除 server.mjs 中所有 Model 100 硬编码逻辑和内嵌样例数据，迁移为模型函数 + JSON patch。

### 变更文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `packages/ui-model-demo-server/server.mjs` | M | 删除 6 个函数/常量，重构 workspace 初始化 |
| `packages/worker-base/system-models/test_model_100_ui.json` | M | 新增初始值标签 + submit guard 函数 |
| `packages/worker-base/system-models/workspace_demo_apps.json` | NEW | Model 1001/1002 定义（原 MOCK_SLIDING_APPS） |
| `packages/worker-base/system-models/ui_to_matrix_forwarder.json` | M | 增加模型 ID 范围检查（仅正模型） |
| `packages/ui-model-demo-frontend/src/local_bus_adapter.js` | M | 增加 `t==='event'` pass-through + isUiRendererSource 检查 |
| `packages/ui-model-demo-frontend/scripts/validate_editor.mjs` | M | 新增验证脚本 |
| `docs/iterations/0151-*/` | NEW | plan + resolution + runlog + 4 screenshot assets |

### Server 删除项

| 删除项 | 类型 | 原位置 |
|--------|------|--------|
| `isModel100SubmitPayload()` | 函数 | L378 |
| `setModel100SubmitState()` | 函数 | L389 |
| `MODEL100_SUBMIT_INFLIGHT_TIMEOUT_MS` | 常量 | — |
| `MOCK_SLIDING_APPS` | 常量 | L1265-1370 (~106 行) |
| `SEED_POSITIVE_MODELS_ON_BOOT` 逻辑 | 分支 | 启动初始化 |
| Model 100 submit 分支 | 代码块 | L2036-2058 |

### Server 新增项

| 新增项 | 类型 | 用途 |
|--------|------|------|
| `overwriteStateLabel()` | 工具函数 | 带覆盖的 state label 设置 |
| `overwriteRuntimeLabel()` | 工具函数 | 通用版（任意 model_id/p/r/c） |
| `loadFullModelPatches()` | 加载函数 | 多 patch 文件加载（支持正模型创建） |
| `deriveWorkspaceRegistry()` | 初始化 | 动态扫描现有模型构建 workspace 列表 |
| `refreshWorkspaceStateCatalog()` | 初始化 | 刷新 state model 上的 workspace catalog |

### 关键技术决策

1. **Submit guard 函数化**：inflight/started_at 存为 ModelTable label（可观测、SSOT），30s 超时自恢复，原子性由 runtime 单线程保证。
2. **MOCK_SLIDING_APPS → JSON patch**：`workspace_demo_apps.json` 包含 create_model + add_label records，启动时与 system-models 统一加载。
3. **Workspace registry 动态化**：扫描 runtime 中现有正模型，排除系统模型，取代原常量注入。

---

## 5. 迭代 0152 — Server 通用 Intent Dispatch

**状态**: In Progress（Step 1-5 PASS，Step 6-10 待续）

### 目标

将 server.mjs 中基于 action prefix 的分支（`docs_*`/`static_*`/`ws_*`）替换为通用 intent dispatch + event trigger map，使新增 action 无需改 server 代码。

### 变更文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `packages/worker-base/system-models/intent_dispatch_config.json` | NEW | dispatch table + trigger map 声明 |
| `packages/worker-base/system-models/intent_handlers_docs.json` | NEW | docs handlers 函数化（3 个 function labels） |
| `packages/ui-model-demo-server/server.mjs` | M | dispatch 通道 + trigger map 通道 + ctx.hostApi 注入 |
| `docs/iterations/0152-*/` | NEW | plan + resolution + runlog |

### 已落地 Step 明细

#### Step 1+2 — Schema 设计

在 Model -10 (cell 0,0,0) 声明两个核心 label：

**intent_dispatch_table** (json)：action → function 映射表
```json
{
  "docs_refresh_tree": "handle_docs_refresh_tree",
  "docs_search": "handle_docs_search",
  "docs_open_doc": "handle_docs_open_doc",
  "static_project_list": "handle_static_project_list",
  "static_project_upload": "handle_static_project_upload",
  "static_project_delete": "handle_static_project_delete",
  "ws_app_add": "handle_ws_app_add",
  "ws_app_delete": "handle_ws_app_delete",
  "ws_select_app": "handle_ws_select_app",
  "ws_app_select": "handle_ws_select_app"
}
```

**event_trigger_map** (json)：event.k → function[] 映射表
```json
{
  "ui_event": ["forward_ui_events"]
}
```

#### Step 3 — Intent dispatch 双轨通道

`submitEnvelope()` 新增 dispatch 路径（旧分支保留为 fallback）：

```
收到 ui_event
  → 查 intent_dispatch_table[action]
  → 命中 且 sysModel.hasFunction(funcName)?
    YES → intercepts.record('run_func', {func}) → tick() → 读 error → 返回
    NO  → 回落 legacy docs_/static_/ws_ 分支
```

关键实现：
- 执行前清空 `ui_event_error`（防 stale error 干扰）
- 执行后写 `ui_event_last_op_id`、清 `ui_event` mailbox
- 统一读 `getEventError()` 判断成功/失败

#### Step 4 — Event trigger map 双轨通道

`processEventsSnapshot()` 的 `forward_ui_events` 硬编码改为查表：

```
检测到 ui_event add_label (model_id == -1, cell 0,0,1)
  → 查 event_trigger_map[event.label.k]
  → 有函数列表?
    YES → 依次 intercepts.record('run_func', {func})
    NO  → fallback: 直接触发 forward_ui_events（兼容无 map 场景）
```

附加：Model 100 专用触发保留（`forward_model100_events`），后续 Step 完成后可迁入 trigger map。

#### Step 5 — Docs handlers 函数化 + ctx.hostApi

**ctx.hostApi 注入**（server.mjs，ProgramModelEngine.executeFunction）：

| 方法 | 返回 | 说明 |
|------|------|------|
| `docsRefreshTree()` | `{ok, data: {tree, fileCount}}` | 扫描 DOCS_ROOT 构建文档树 |
| `docsSearch(query, limit)` | `{ok, data: {results}}` | 按文件名+内容搜索 |
| `docsOpenDoc(relPath)` | `{ok, data: {html}}` | 路径校验 + markdown 渲染（processSync） |

hostApi 护栏：
- 返回值固定 `{ok, code, detail, data}` 结构
- path allowlist（`isAllowedDocRelPath`）
- `safeJoin()` 防目录遍历
- fs 操作封装在 hostApi 内部，function label 不接触 fs
- markdown 用 `processSync()`（同步，匹配 function label 执行路径）

**3 个 function labels**（intent_handlers_docs.json，Model -10）：

| Label key | 行为 |
|-----------|------|
| `handle_docs_refresh_tree` | hostApi.docsRefreshTree() → 写 docs_tree_json + docs_status |
| `handle_docs_search` | getState('docs_query') → hostApi.docsSearch() → 写 docs_search_results_json + docs_status |
| `handle_docs_open_doc` | getState('docs_selected_path') → hostApi.docsOpenDoc() → 写 docs_render_html + docs_status |

验证结果（Step 5 Runlog）：
- docs_refresh_tree: PASS（tree 非空，164 文件索引）
- docs_search: PASS（query="runtime"，50 条结果）
- docs_open_doc (positive): PASS（[[README]] → HTML 渲染）
- docs_open_doc (path traversal): PASS（`../../../etc/passwd` → `doc_path_not_allowed`）
- docs_open_doc (not found): PASS（`nonexistent_file_12345.md` → `doc_not_found`）
- legacy fallback: PASS（`static_project_list`, `ws_select_app` 仍走旧通道）

### 待完成 Steps

| Step | 内容 | 状态 |
|------|------|------|
| 6 | static_project_* handlers 函数化 | Pending |
| 7 | ws_app_* handlers 函数化 | Pending |
| 8 | Snapshot 过滤规则模型化 (INTERNAL_LABEL_TYPES → config label) | Pending |
| 9 | Workspace 默认选择模型化 ("优先 100" → config label) | Pending |
| 10 | 本地 E2E 全量功能回归 | Pending |

---

## 6. 跨迭代基础设施变更

### 6.1 K8s 配置

| 文件 | 变更 |
|------|------|
| `k8s/local/synapse.yaml` | +rc_message 速率限制（10/s, burst 50） |
| `k8s/cloud/synapse.yaml` | 同上 |
| `k8s/local/workers.yaml` | hostPath 挂载 + DOCS_ROOT/STATIC_PROJECTS_ROOT env + MATRIX token from secret |
| `k8s/cloud/workers.yaml` | 同上（cloud 路径） + SEED_POSITIVE_MODELS_ON_BOOT=0 |
| `k8s/Dockerfile.mbr-worker` | 删除 COPY packages/bus-mgmt |

### 6.2 部署脚本

| 文件 | 变更 |
|------|------|
| `scripts/ops/deploy_local.sh` | 大幅更新（+42/-42），适配新 volume 结构 |
| `scripts/ops/deploy_cloud.sh` | 镜像引用更新 |
| `scripts/ops/ensure_runtime_baseline.sh` | 检查逻辑更新（+64/-64） |
| `deploy/env/local.env.example` | 新增 DOCS_ROOT / STATIC_PROJECTS_ROOT 声明 |
| `deploy/env/cloud.env.example` | 同上 |

### 6.3 依赖

| 文件 | 变更 |
|------|------|
| `package.json` | +1 dependency |
| `package-lock.json` | 对应更新 |

### 6.4 文档

| 文件 | 变更 |
|------|------|
| `docs/ITERATIONS.md` | 新增 0150/0151/0152 注册 |
| `docs/deployment/infrastructure_recovery.md` | 路径引用修正 |
| `docs/deployment/remote_worker_k8s_runbook.md` | 命令更新 |
| `docs/deployment/runtime_baseline_default.md` | baseline 描述更新 |
| `docs/ssot/fill_table_only_mode.md` | tier1/tier2 边界补充 |
| `docs/user-guide/color_generator_e2e_runbook.md` | 命令参考更新 |

---

## 7. Model -10 系统模型扩展总览

本批变更后 Model -10 新增以下 labels（均在 cell 0,0,0）：

| Label key | Type | 来源 patch | 用途 |
|-----------|------|------------|------|
| `intent_dispatch_table` | json | intent_dispatch_config.json | action → function 映射 |
| `event_trigger_map` | json | intent_dispatch_config.json | event.k → function[] 映射 |
| `handle_docs_refresh_tree` | function | intent_handlers_docs.json | docs 树刷新 |
| `handle_docs_search` | function | intent_handlers_docs.json | docs 搜索 |
| `handle_docs_open_doc` | function | intent_handlers_docs.json | docs 打开 |

待 Step 6-7 完成后还将增加：
- `handle_static_project_list` / `handle_static_project_upload` / `handle_static_project_delete`
- `handle_ws_app_add` / `handle_ws_app_delete` / `handle_ws_select_app`

---

## 8. 验证状态汇总

| 迭代 | Step | 状态 | 关键验证点 |
|------|------|------|-----------|
| 0149 | runlog 补齐 | PASS | 云端部署记录完整 |
| 0150 | adapter 迁移 | PASS | docker build + Playwright burst 10/10 |
| 0151 | Step 1-5 | PASS | submit guard + workspace patch + 代码清理 |
| 0151 | Step 6 Fix | PASS | event type pass-through + ui_event echo ignore |
| 0152 | Step 1-2 | PASS | schema 加载 + snapshot 确认 |
| 0152 | Step 3 | PASS | test_echo dispatch + legacy fallback |
| 0152 | Step 4 | PASS | trigger map 查表 + map 缺失 fallback |
| 0152 | Step 5 | PASS | docs 3 actions + negative cases + legacy fallback |
| 0152 | Step 6-10 | PENDING | — |

---

## 9. 风险与注意事项

1. **双轨并存期**：Step 5 已将 docs 迁到新通道，但 static/ws 仍走旧分支。两套路径共存直到 Step 6-7 完成。
2. **[[ITERATIONS]] 状态**：0149 和 0150 在 [[ITERATIONS]] 中仍标 "In Progress"，代码已完成，需更新为 Completed。
3. **热加载限制**：runtime patch 在 server 运行中注入时，`ProgramModelEngine.functions` 不会自动刷新（已知限制，Step 5 runlog 记录）。function labels 必须在 boot-time 加载才生效。
4. **hostApi 同步约束**：`docsOpenDoc` 使用 `processSync()` 而非 `await process()`，因为 function label 执行路径是同步的。所有 unified plugin 必须支持同步处理。
