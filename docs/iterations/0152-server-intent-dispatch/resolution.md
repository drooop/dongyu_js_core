---
title: "0152 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0152-server-intent-dispatch
id: 0152-server-intent-dispatch
phase: phase1
---

# 0152 — Resolution (HOW)

## 0. Execution Rules
- Work branch: `dev_0152-server-intent-dispatch`
- Depends on: 0151 must be completed and merged first.
- Steps execute in order; real outputs only in `runlog.md`.
- Verification must be deterministic PASS/FAIL.

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | 设计 dispatch table schema | 定义 intent_dispatch_table label 格式 | `system-models/system_models.json` | patch import → label 存在 | schema 可加载 | revert patch |
| 2 | 设计 event trigger map schema | 定义 event_trigger_map label 格式 | `system-models/system_models.json` | patch import → label 存在 | schema 可加载 | revert patch |
| 3 | 实现 intent dispatch 通道 | server submitEnvelope 改为查表 dispatch | `server.mjs` | 添加 test_echo action 无需改 server | dispatch 生效 | revert server |
| 4 | 实现 event trigger map 通道 | processEventsSnapshot 改为查表触发 | `server.mjs` | rg 验证 forward_ui_events 不在 server | 查表触发生效 | revert server |
| 5 | Action handler 函数化 (docs) | docs_refresh_tree/search/open_doc → function labels | `system-models/*.json` + `server.mjs` | docs 操作正常 | 行为等价 | revert all |
| 6 | Action handler 函数化 (static) | static_project_* → function labels | `system-models/*.json` + `server.mjs` | static 操作正常 | 行为等价 | revert all |
| 7 | Action handler 函数化 (ws) | ws_app_* → function labels | `system-models/*.json` + `server.mjs` | workspace 操作正常 | 行为等价 | revert all |
| 8 | Snapshot 过滤规则模型化 | INTERNAL_LABEL_TYPES → config label | `system-models/*.json` + `server.mjs` | 客户端 snapshot 内容不变 | 过滤行为等价 | revert all |
| 9 | Workspace 默认选择模型化 | "优先 100" 策略 → config label | `system-models/*.json` + `server.mjs` | workspace 选择行为不变 | 策略可配置 | revert all |
| 10 | 本地 E2E 验证 | 全量功能回归 | (no new files) | baseline + 功能测试 | 全 PASS | rollback deploy |

## 2. Step Details

### Step 1 — 设计 dispatch table schema

**Goal**
在 Model -10 上声明 `intent_dispatch_table` label，定义 action→function 映射。

**Implementation**
在 `system_models.json` 或新文件 `system-models/intent_dispatch.json` 中追加：

```json
{
  "op": "add_label",
  "model_id": -10,
  "p": 0, "r": 0, "c": 0,
  "k": "intent_dispatch_table",
  "t": "json",
  "v": {
    "docs_refresh_tree": "handle_docs_refresh_tree",
    "docs_search": "handle_docs_search",
    "docs_open_doc": "handle_docs_open_doc",
    "static_project_list": "handle_static_project_list",
    "static_project_upload": "handle_static_project_upload",
    "static_project_delete": "handle_static_project_delete",
    "ws_app_add": "handle_ws_app_add",
    "ws_app_delete": "handle_ws_app_delete",
    "ws_app_select": "handle_ws_app_select"
  }
}
```

**Validation**
- Patch import 后 `runtime.getLabelValue(model_-10, 0, 0, 0, 'intent_dispatch_table')` 返回正确对象。

---

### Step 2 — 设计 event trigger map schema

**Goal**
在 Model -10 上声明 `event_trigger_map` label，定义 event_key→function_list 映射。

**Implementation**
```json
{
  "op": "add_label",
  "model_id": -10,
  "p": 0, "r": 0, "c": 0,
  "k": "event_trigger_map",
  "t": "json",
  "v": {
    "ui_event": ["forward_ui_events"]
  }
}
```

未来新增转发函数只需修改此 label 的 value array。

**Validation**
- Patch import 后 label 存在且值正确。

---

### Step 3 — 实现 intent dispatch 通道

**Goal**
`submitEnvelope()` 中的 `action.startsWith('docs_') || ...` 分支替换为查表 dispatch。

**Implementation**
```javascript
// 替换原有 action prefix 分支
const sysModel = runtime.getModel(-10);
const dispatchTable = sysModel
  ? runtime.getLabelValue(sysModel, 0, 0, 0, 'intent_dispatch_table')
  : null;

if (dispatchTable && typeof dispatchTable === 'object' && dispatchTable[action]) {
  const funcName = dispatchTable[action];
  // 通过 intercept 触发目标函数
  runtime.intercepts.record('run_func', { func: funcName, payload });
  await programEngine.tick();
  // 读取执行结果（由函数写入 ModelTable）
  // ...
}
```

**Validation**
- 新增 `test_echo` entry 到 dispatch table + 对应 function label。
- 发送 `{ action: 'test_echo', ... }` → 函数被触发 → 不改 server 代码。

---

### Step 4 — 实现 event trigger map 通道

**Goal**
`processEventsSnapshot()` 中删除硬编码 `forward_ui_events`，改为查 `event_trigger_map`。

**Implementation**
```javascript
// 原来：
// if (sys && sys.hasFunction('forward_ui_events')) {
//   this.runtime.intercepts.record('run_func', { func: 'forward_ui_events' });
// }

// 改为：
const triggerMap = runtime.getLabelValue(sysModel, 0, 0, 0, 'event_trigger_map');
const triggers = triggerMap && triggerMap[event.label.k];
if (Array.isArray(triggers)) {
  for (const funcName of triggers) {
    this.runtime.intercepts.record('run_func', { func: funcName });
  }
}
```

**Validation**
```bash
rg -n "forward_ui_events" packages/ui-model-demo-server/server.mjs
```
期望：0 命中。

---

### Steps 5-7 — Action handler 函数化

**Goal**
将 docs_/static_/ws_ 的 handler 逻辑从 server.mjs 迁移到 Model -10 function labels。

**关键决策点**
docs/static handler 涉及文件系统操作。采用 **host capability** 方案：
- Server 在 ctx 上提供受限 API：`ctx.hostApi.listDocs()`, `ctx.hostApi.readDoc(path)`, `ctx.hostApi.writeStaticProject(name, data)` 等。
- 模型函数通过 ctx.hostApi 调用，不直接访问 fs。
- host API 声明在 server 初始化阶段，属于 Tier1 基座能力（server 为 host，提供 host capability）。

**Implementation pattern** (以 docs_refresh_tree 为例)
```javascript
// Model -10 function label: handle_docs_refresh_tree
const files = ctx.hostApi.listDocs();
const tree = ctx.hostApi.buildDocsTree(files);
const stateModel = ctx.runtime.getModel(-2); // EDITOR_STATE_MODEL_ID
ctx.runtime.addLabel(stateModel, 0, 0, 0, { k: 'docs_tree_json', t: 'json', v: tree });
ctx.runtime.addLabel(stateModel, 0, 0, 0, { k: 'docs_status', t: 'str', v: 'docs indexed: ' + files.length });
```

每个 handler 独立验证，确保行为等价。

---

### Step 8 — Snapshot 过滤规则模型化

**Goal**
`INTERNAL_LABEL_TYPES` / `EXCLUDED_LABEL_KEYS` 从 server 常量改为 Model 0 config label。

**Implementation**
```json
{
  "op": "add_label",
  "model_id": 0,
  "p": 0, "r": 0, "c": 0,
  "k": "snapshot_filter_config",
  "t": "json",
  "v": {
    "exclude_label_types": ["function", "CELL_CONNECT", "cell_connection", "IN", "BUS_IN", "BUS_OUT", "MODEL_IN", "MODEL_OUT", "subModel", "MQTT_WILDCARD_SUB"],
    "exclude_label_keys": ["snapshot_json", "event_log"]
  }
}
```

`buildClientSnapshot()` 改为从 runtime 读取此 config。

---

### Step 9 — Workspace 默认选择模型化

**Goal**
`refreshWorkspaceStateCatalog()` 中的"优先 Model 100"策略改为 config label。

**Implementation**
```json
{
  "op": "add_label",
  "model_id": 0,
  "p": 0, "r": 0, "c": 0,
  "k": "workspace_default_app",
  "t": "int",
  "v": 100
}
```

---

### Step 10 — 本地 E2E 验证

**Validation**
1. 基线：`ensure_runtime_baseline.sh` + `check_runtime_baseline.sh`
2. 核心单元测试：`test_cell_connect_parse.mjs`, `test_bus_in_out.mjs`, `validate_builtins_v0.mjs`
3. 功能回归：
   - Docs 浏览/搜索/打开 → 行为不变
   - Static 项目列表/上传/删除 → 行为不变
   - Workspace 增删选 → 行为不变
   - Model 100 E2E (submit → 颜色返回) → 行为不变
4. 扩展性验证：
   - 添加 `test_echo` dispatch entry + function → 不改 server 代码 → PASS
   - 添加 `event_trigger_map` entry → 不改 server 代码 → PASS

**Acceptance**
- 所有功能回归 PASS。
- 扩展性验证 PASS（核心 DoD）。
