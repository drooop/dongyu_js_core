---
title: "0139 — Records-Only Patch: 全量 records 化代码改进"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0139-records-only-patch
id: 0139-records-only-patch
phase: phase1
---

# 0139 — Records-Only Patch: 全量 records 化代码改进

> 对应文档改动: `docs/handover/dam-worker-guide.md` §3.1 / §9.3 已完成纯 records 范式重写。
> 本文档是配套的代码改进计划。

## 背景

当前 mt.v0 信封允许 `action` / `data` 等扩展字段传递业务参数，但这与 ModelTable SSOT 原则冲突。
全量 records 化后，所有业务参数通过 `records` 中的 `add_label` 写入请求 Cell `(model_id, 1, 0, 0)`，
runtime 统一执行，无需额外分发逻辑。

---

## Step 1: runtime `mqttIncoming` 支持 records 模式

**文件**: `packages/worker-base/src/runtime.js` — `mqttIncoming()` (L1034)

**现状**: 收到 mt.v0 payload 后，整个 payload 作为一条 `IN` label 写入 PIN 邮箱 Cell:
```js
// L1082
this.addLabel(targetModel, route.target.p, route.target.r, route.target.c,
  { k: route.target.k, t: 'IN', v: payload });
```

**改动**:
- 当 payload 是 mt.v0 且 `records` 非空时，调用 `this.applyPatch(payload)` 逐条执行 records
- 若该 PIN_IN 的 binding 配置了 `trigger_funcs`：在 records 执行后，额外写入一条 `t:"IN"` 的 trigger label 到 PIN 投递目标 Cell，用于触发 PIN_IN binding 的 trigger_funcs
- **fallback**: records 为空时（`records: []`），仍写单条 `IN` label（兼容旧行为）

**伪代码**:
```js
if (payloadMode === 'mt_v0' && Array.isArray(payload.records) && payload.records.length > 0) {
  // records 模式：逐条 apply，写入目标 Cell
  this.applyPatch(payload, { allowCreateModel: false });
  // 若该 PIN_IN 绑定了 trigger_funcs，则补一条 IN trigger label 驱动触发
  if (pinHasTriggerFuncs(modelId, pinName)) {
    this.addLabel(targetModel, route.target.p, route.target.r, route.target.c,
      { k: route.target.k, t: 'IN', v: { op_id: payload.op_id } });
  }
  this.mqttTrace.record('inbound', { topic, payload, mode: 'records' });
  return true;
} else {
  // fallback：写 IN label（旧行为）
  this.addLabel(targetModel, route.target.p, route.target.r, route.target.c,
    { k: route.target.k, t: 'IN', v: payload });
}
```

**注意**: `applyPatch` 的 `allowCreateModel: false` 防止外部通过 MQTT 创建模型。

---

## Step 2: 触发约束（为什么需要 trigger IN label）

**文件**: `packages/worker-base/src/runtime.js` — `_applyMailboxTriggers()` (L982)

**现状（代码事实）**: PIN_IN binding 的 `trigger_funcs` 触发被 `_applyMailboxTriggers()` 严格门控。

- 任何 label 都会走 mailbox triggers（按 cell 坐标触发）
- 但 PIN_IN binding triggers 只对 `label.t === 'IN'` 生效（`if (label.t !== 'IN') return;`）

**结论**:
- records 中写入的业务参数 label（通常 `t:'str'/'json'`，例如 `k:'action'`）不会触发 PIN_IN binding 的 `trigger_funcs`
- 因此 records 模式要触发函数，必须额外写入一条 `t:'IN'` 的 trigger label 到该 PIN 的投递目标 Cell

---

## Step 3: 程序模型函数读参数方式变更

**文件**: 各 Worker 的程序模型函数（如 Model 100 的 `on_model100_event_in`）

**现状**:
```js
// 从 IN label 的 v 中读取
const inLabel = cell.labels.get('event');
const action = inLabel.v.action;
const mxc = inLabel.v.data.mxc;
```

**改动**: 从请求 Cell 的独立 label 中读取
```js
// 从请求 Cell (model_id, 1, 0, 0) 的 label 中读取
const action = ctx.getLabel({ model_id: 1010, p: 1, r: 0, c: 0, k: 'action' });
const mxc    = ctx.getLabel({ model_id: 1010, p: 1, r: 0, c: 0, k: 'mxc' });
```

**影响范围**:
- Model 100 (`on_model100_event_in`) — 示范模型，需更新
- 未来的 DAM Worker 模型 — 从一开始就用 records 模式
- MBR 的 `mbr_mgmt_to_mqtt` — 构造发给 Worker 的 payload 需改为 records 格式

---

## Step 4: 补充验证用例

**文件**: 新增或扩展 `scripts/validate_pin_mqtt_loop.mjs`

**新增 case**: `records_only_patch`
- 构造一个 mt.v0 payload，records 中包含多条 `add_label` 到请求 Cell
- 最后一条是 `action` label
- 验证:
  1. `applyPatch` 成功执行，所有 label 写入请求 Cell
  2. `action` label 写入后触发程序模型函数
  3. 程序模型函数能通过 `ctx.getLabel()` 读取所有参数
  4. 返回 patch 通过 OUT PIN 正常发出

---

## 涉及文件汇总

| 文件 | 改动类型 | Step |
|------|----------|------|
| `packages/worker-base/src/runtime.js` | 修改 `mqttIncoming` | 1 |
| `packages/worker-base/src/runtime.js` | 确认 `_applyMailboxTriggers` 适配 | 2 |
| Worker 程序模型函数 | 读参数方式变更 | 3 |
| MBR `scripts/run_worker_mbr_v0.mjs` | 构造 records 格式 payload | 3 |
| `scripts/validate_pin_mqtt_loop.mjs` | 新增 `records_only_patch` case | 4 |

## 兼容性

- Step 1 有 fallback：`records: []` 时仍写 IN label，旧 Worker 不受影响
- Step 3 按模型逐个迁移，不强制一步到位
- MBR 路由已支持 `mbr_route_<modelId>` label 驱动，无需改路由逻辑
