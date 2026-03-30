---
title: "0151 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0151-server-model100-decouple
id: 0151-server-model100-decouple
phase: phase1
---

# 0151 — Resolution (HOW)

## 0. Execution Rules
- Work branch: `dev_0151-server-model100-decouple`
- Steps execute in order; real outputs only in `runlog.md`.
- Verification must be deterministic PASS/FAIL.

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Submit guard 函数化 | 新增 submit_guard 模型函数 | `packages/worker-base/system-models/test_model_100_ui.json` | 函数 require + 手动测试 | guard 函数存在且可编译 | revert patch |
| 2 | Model 100 初始值 patch 化 | submit_inflight 等初始值移入 patch | `packages/worker-base/system-models/test_model_100_ui.json` | patch import → label 值正确 | 初始值由 patch 声明 | revert patch |
| 3 | MOCK_SLIDING_APPS → patch | 样例 Model 1001/1002 转 JSON patch | `packages/worker-base/system-models/workspace_demo_apps.json` | import patch → 模型存在 | patch 可加载 | revert file |
| 4 | Server 删除 Model 100 特判 | 删除 server.mjs 中所有 model-100 特定逻辑 | `packages/ui-model-demo-server/server.mjs` | rg 验证零命中 | 无 model-specific 分支 | revert server.mjs |
| 5 | Server 删除 MOCK_SLIDING_APPS | 删除常量 + SEED 逻辑，改用 patch | `packages/ui-model-demo-server/server.mjs` | rg 验证零命中 | 无内嵌样例 | revert server.mjs |
| 6 | 本地 E2E 验证 | submit guard + workspace 列表 | (no new files) | baseline + burst click | PASS | rollback deploy |

## 2. Step Details

### Step 1 — Submit guard 函数化

**Goal**
在 `forward_model100_events` 函数（Model -10 上的 function label）头部集成 submit guard 逻辑，替代 server.mjs 中的 `isModel100SubmitPayload` + `submitEnvelope` 分支。

**Implementation**
修改 `packages/worker-base/system-models/test_model_100_ui.json` 中的 `forward_model100_events` 函数，在函数头部增加：

```javascript
// --- submit guard (方案 a: 状态存 ModelTable label) ---
const m100 = ctx.runtime.getModel(100);
if (!m100) return;
const inflight = ctx.runtime.getLabelValue(m100, 0, 0, 0, 'submit_inflight');
const startedAt = Number(ctx.runtime.getLabelValue(m100, 0, 0, 0, 'submit_inflight_started_at') || 0);
const TIMEOUT_MS = 30000;
const now = Date.now();
if (inflight === true) {
  const stale = !Number.isFinite(startedAt) || (now - startedAt > TIMEOUT_MS);
  if (stale) {
    // 超时恢复
    ctx.runtime.addLabel(m100, 0, 0, 0, { k: 'submit_inflight', t: 'bool', v: false });
    ctx.runtime.addLabel(m100, 0, 0, 0, { k: 'submit_inflight_started_at', t: 'int', v: 0 });
    ctx.runtime.addLabel(m100, 0, 0, 0, { k: 'status', t: 'str', v: 'ready' });
  } else {
    // 单飞拒绝：清空事件，写 error
    ctx.runtime.addLabel(ctx.runtime.getModel(-1), 0, 0, 1, {
      k: 'ui_event_error',
      t: 'json',
      v: { code: 'busy', detail: 'model100_submit_inflight' },
    });
    ctx.runtime.addLabel(ctx.runtime.getModel(-1), 0, 0, 1, { k: 'ui_event_last_op_id', t: 'str', v: '' });
    ctx.runtime.addLabel(m100, 0, 0, 2, { k: 'ui_event', t: 'event', v: null });
    return; // 不转发
  }
}
// 设置 inflight
ctx.runtime.addLabel(m100, 0, 0, 0, { k: 'submit_inflight', t: 'bool', v: true });
ctx.runtime.addLabel(m100, 0, 0, 0, { k: 'submit_inflight_started_at', t: 'int', v: now });
ctx.runtime.addLabel(m100, 0, 0, 0, { k: 'status', t: 'str', v: 'loading' });
// --- end submit guard ---
```

然后保留原有的 Matrix 转发逻辑。

**注意**：guard 逻辑在函数内执行，利用 runtime 单线程特性保证原子性。超时阈值 30000ms 与原 `MODEL100_SUBMIT_INFLIGHT_TIMEOUT_MS` 默认值一致。

**Validation**
- `node -e "const p = require('./packages/worker-base/system-models/test_model_100_ui.json'); const f = p.records.find(r => r.k === 'forward_model100_events'); console.log(f.v.includes('submit_inflight') ? 'PASS' : 'FAIL')"`

**Rollback**
- 恢复 `test_model_100_ui.json` 到修改前版本。

---

### Step 2 — Model 100 初始值 patch 化

**Goal**
确保 `test_model_100_ui.json` patch 中声明 Model 100 的初始状态标签，使 server 的 `sanitizeStartupCatalogState` 不再需要硬编码 Model 100 行。

**Implementation**
在 `test_model_100_ui.json` 的 records 中追加（如果尚不存在）：

```json
{ "op": "add_label", "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "submit_inflight", "t": "bool", "v": false },
{ "op": "add_label", "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "submit_inflight_started_at", "t": "int", "v": 0 },
{ "op": "add_label", "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "status", "t": "str", "v": "ready" },
{ "op": "add_label", "model_id": 100, "p": 0, "r": 0, "c": 1, "k": "ui_event", "t": "event", "v": null },
{ "op": "add_label", "model_id": 100, "p": 0, "r": 0, "c": 1, "k": "ui_event_last_op_id", "t": "str", "v": "" },
{ "op": "add_label", "model_id": 100, "p": 0, "r": 0, "c": 1, "k": "ui_event_error", "t": "json", "v": null }
```

**Validation**
- `node -e "const p = require('./packages/worker-base/system-models/test_model_100_ui.json'); const has = p.records.some(r => r.k === 'submit_inflight' && r.model_id === 100); console.log(has ? 'PASS' : 'FAIL')"`

**Rollback**
- 恢复 patch 文件。

---

### Step 3 — MOCK_SLIDING_APPS → patch

**Goal**
新增 `workspace_demo_apps.json`，承载原 MOCK_SLIDING_APPS 中 Model 1001/1002 的定义。

**Implementation**
- 创建 `packages/worker-base/system-models/workspace_demo_apps.json`
- 格式：mt.v0 patch，op_id: `workspace_demo_apps_v0`
- 内容：
  - Model 1001 (请假申请)：create_model + p=0 data labels + p=1 schema labels
  - Model 1002 (设备报修)：create_model + p=0 data labels + p=1 schema labels
  - 每个模型增加 `app_name` 和 `source_worker` 标签（workspace registry 所需）
- Model 100 的 schema 不重复（已在 `test_model_100_ui.json` + `workspace_positive_models.json` 中）。
  需确认 `workspace_positive_models.json` 中 Model 100 的 schema 是否完整覆盖 MOCK_SLIDING_APPS 中的 100 定义。
  如缺失则补充到 `workspace_positive_models.json`。

**Validation**
- `node -e "const p = require('./packages/worker-base/system-models/workspace_demo_apps.json'); console.log(p.records.length > 0 ? 'PASS' : 'FAIL')"`

**Rollback**
- 删除新文件。

---

### Step 4 — Server 删除 Model 100 特判

**Goal**
从 `server.mjs` 中移除所有 Model 100 特判逻辑。

**Implementation**
删除：
1. `isModel100SubmitPayload()` 函数 (~L378-387)
2. `setModel100SubmitState()` 函数 (~L389-400)
3. `MODEL100_SUBMIT_INFLIGHT_TIMEOUT_MS` 常量 (~L38)
4. `submitEnvelope()` 中的 `isModel100Submit` 检测及其整个 if 分支 (~L2023, L2036-2058)
5. `sanitizeStartupCatalogState()` 中 model_id=100 的硬编码行 (~L1490-1498)

修改 `submitEnvelope()` 使其对所有 payload 统一处理：
- 写入 mailbox
- 触发 programEngine.tick()
- 返回结果

**Validation**
```bash
rg -n "isModel100SubmitPayload|setModel100SubmitState|MOCK_SLIDING_APPS|MODEL100_SUBMIT_INFLIGHT_TIMEOUT" packages/ui-model-demo-server/server.mjs
```
期望：0 命中。

```bash
rg -n "model_id === 100|model_id===100" packages/ui-model-demo-server/server.mjs
```
期望：0 命中（排除注释）。

**Rollback**
- `git checkout -- packages/ui-model-demo-server/server.mjs`

---

### Step 5 — Server 删除 MOCK_SLIDING_APPS

**Goal**
删除 `MOCK_SLIDING_APPS` 常量及 `SEED_POSITIVE_MODELS_ON_BOOT` 相关逻辑，改用 patch 加载。

**Implementation**
1. 删除 `MOCK_SLIDING_APPS` 常量定义 (~L1265-1370)。
2. 删除 `SEED_POSITIVE_MODELS_ON_BOOT` 环境变量读取 (~L1264)。
3. 修改 `deriveWorkspaceRegistry()` 中对 `MOCK_SLIDING_APPS` 的引用：
   - 删除 `if (SEED_POSITIVE_MODELS_ON_BOOT)` 分支中的 MOCK 注入逻辑。
   - 改为仅从 runtime 中已存在的 model 中推导 workspace registry（patch 在 init 阶段已加载）。
4. 在 server init 阶段增加 `workspace_demo_apps.json` 的 patch import（与现有 system-models import 并列）。

**Validation**
```bash
rg -n "MOCK_SLIDING_APPS|SEED_POSITIVE_MODELS_ON_BOOT" packages/ui-model-demo-server/server.mjs
```
期望：0 命中。

**Rollback**
- `git checkout -- packages/ui-model-demo-server/server.mjs`

---

### Step 6 — 本地 E2E 验证

**Validation**
1. 基线：
   ```bash
   bash scripts/ops/ensure_runtime_baseline.sh
   bash scripts/ops/check_runtime_baseline.sh
   ```
2. 核心单元测试：
   ```bash
   node scripts/tests/test_cell_connect_parse.mjs
   node scripts/tests/test_bus_in_out.mjs
   node scripts/validate_builtins_v0.mjs
   ```
3. Submit guard 功能验证：
   - 启动 server → 打开 workspace → Model 100 → 点击 submit → 颜色返回 → submit_inflight 恢复 false
   - 快速双击 submit → 第二次应被拒绝（inflight guard 生效）
4. Workspace 列表验证：
   - 启动 server → workspace 列表包含 Model 100 / 1001 / 1002
   - 确认来源为 patch（server.mjs 中无 MOCK 常量）

**Acceptance**
- 所有验证步骤 PASS。
- `rg` 零命中验证全部通过。

**Rollback**
- 回退至 Step 4/5 之前的 server.mjs + 删除新增 patch 文件。
