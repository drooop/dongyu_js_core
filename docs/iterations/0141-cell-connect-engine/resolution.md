---
title: "0141 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0141-cell-connect-engine
id: 0141-cell-connect-engine
phase: phase1
---

# 0141 — Resolution (HOW)

## Step 1: CELL_CONNECT 解析器

### 1.1 数据结构
在 `runtime.js` 的 ModelTableRuntime constructor 中新增：
```javascript
this.cellConnectGraph = new Map();
// key: "${modelId}|${p}|${r}|${c}" (pipe 分隔，避免与 modelId 负数的歧义)
// value: Map<"${prefix}:${port}", [{prefix, port}]>  (源→目标列表)
```

采用两级 Map 设计：外层按 Cell 寻址（pipe 分隔），内层按 (prefix:port) 寻址。

### 1.2 解析函数
```javascript
_parseCellConnectEndpoint(str) {
  // 输入: "(self, topic_cellA)" 或 "(func, process_A1:in)" 或 "(10, from_parent)"
  // 1. trim + 验证括号包裹
  // 2. 去除 "()" → "self, topic_cellA"
  // 3. 按 ", " 或 "," 分割（兼容有无空格）
  // 4. 验证恰好 2 部分
  // 5. prefix: "self" | "func" | 数字字符串（parseInt 成功且为有效整数）
  // 6. port: 非空字符串
  // 7. 返回 {prefix, port} 或 null（解析失败）
}
```

### 1.3 CELL_CONNECT 标签处理
在 `_applyBuiltins` 中新增 **基于 label.t** 的调度（区别于现有 connectKeys 的 label.k 调度）：
```javascript
// 在 _applyBuiltins 中，connectKeys 检查之前或之后
if (label.t === 'CELL_CONNECT') {
  this._parseCellConnectLabel(model, p, r, c, label);
  return;
}
if (label.t === 'cell_connection') {
  this._parseCellConnectionLabel(model, p, r, c, label);
  return;
}
```

`_parseCellConnectLabel(model, p, r, c, label)`:
1. `label.v` 应为 Object（dict），否则记录错误并跳过
2. 对每个 entry `sourceStr: targetStrArray`：
   - 解析 sourceStr → `{prefix, port}`
   - targetStrArray 须为 Array，对每个 targetStr 解析
   - 存入 `cellConnectGraph[cellKey][sourceEndpointKey] = targets`
3. 解析失败时记录 eventLog 错误，不中断

### Files
- `packages/worker-base/src/runtime.js`: constructor 初始化 + `_parseCellConnectEndpoint` + `_parseCellConnectLabel` + _applyBuiltins 扩展
- `packages/worker-base/src/runtime.mjs`: 同步更新（ESM 变体）

### Verify
```bash
bun scripts/tests/test_cell_connect_parse.mjs
```
预期: self/func/数字 ID 前缀解析 PASS、格式错误安全跳过、多目标正确存储

### Rollback
删除 cellConnectGraph 初始化和解析代码

---

## Step 2: cell_connection 路由器

### 2.1 数据结构
```javascript
this.cellConnectionRoutes = new Map();
// key: "${modelId}|${p}|${r}|${c}|${k}"  (pipe 分隔，与 cellConnectGraph 风格一致)
// value: [{model_id, p, r, c, k}]  (目标列表)
```

### 2.2 解析逻辑
`_parseCellConnectionLabel(model, p, r, c, label)`:
1. 验证位置：`p === 0 && r === 0 && c === 0`，否则记录错误并跳过
2. `label.v` 须为 Array，否则记录错误跳过
3. 对每个 entry `{from: [p,r,c,k], to: [[p,r,c,k], ...]}`：
   - 验证 from 为 4 元素数组，to 为二维数组
   - key = `${model.id}|${from[0]}|${from[1]}|${from[2]}|${from[3]}`
   - value = to 列表映射为 `{model_id: model.id, p:to[0], r:to[1], c:to[2], k:to[3]}`
   - 存入 cellConnectionRoutes（追加，不覆盖）

### 2.3 路由传播函数
```javascript
_routeViaCellConnection(modelId, p, r, c, k, value) {
  const key = `${modelId}|${p}|${r}|${c}|${k}`;
  const targets = this.cellConnectionRoutes.get(key);
  if (!targets) return;
  for (const t of targets) {
    const targetModel = this.getModel(t.model_id);
    if (!targetModel) continue;
    this.addLabel(targetModel, t.p, t.r, t.c, {k: t.k, t: 'IN', v: value});
  }
}
```

调用时机：当 CELL_CONNECT 的 `self` 前缀目标写入 Cell PIN 后，触发 cell_connection 查表路由。

### Files
- `packages/worker-base/src/runtime.js`
- `packages/worker-base/src/runtime.mjs`: 同步更新

### Verify
```bash
bun scripts/tests/test_cell_connection_route.mjs
```
预期: from→to 路由正确、多目标扇出正确、无匹配时无操作、格式错误安全跳过、位置错误记录 eventLog

### Rollback
删除 cellConnectionRoutes 和路由传播函数

---

## Step 3: CELL_CONNECT 运行时传播 + AsyncFunction 引擎

### 3.1 _propagateCellConnect（带循环检测）
```javascript
async _propagateCellConnect(modelId, p, r, c, prefix, port, value, visited = new Set()) {
  const cellKey = `${modelId}|${p}|${r}|${c}`;
  const endpointKey = `${prefix}:${port}`;
  const visitKey = `${cellKey}|${endpointKey}`;

  // 循环检测
  if (visited.has(visitKey)) {
    this.eventLog.record({
      op: 'cell_connect_cycle', cell: {model_id: modelId, p, r, c},
      label: {k: endpointKey}, result: 'skipped', reason: 'cycle_detected'
    });
    return;
  }
  visited.add(visitKey);

  const cellGraph = this.cellConnectGraph.get(cellKey);
  if (!cellGraph) return;
  const targets = cellGraph.get(endpointKey);
  if (!targets) return;

  const tasks = targets.map(t => {
    if (t.prefix === 'self') {
      // 写入 Cell 的 PIN label → 然后触发 cell_connection 路由
      const targetModel = this.getModel(modelId);
      if (!targetModel) return Promise.resolve();
      this.addLabel(targetModel, p, r, c, {k: t.port, t: 'OUT', v: value});
      this._routeViaCellConnection(modelId, p, r, c, t.port, value);
      return Promise.resolve();
    }
    if (t.prefix === 'func') {
      if (t.port.endsWith(':in')) {
        const funcName = t.port.slice(0, -3);
        return this._executeFuncViaCellConnect(modelId, p, r, c, funcName, value, visited);
      }
      if (t.port.endsWith(':out')) {
        return this._propagateCellConnect(modelId, p, r, c, 'func', t.port, value, visited);
      }
    }
    // 数字 ID 前缀: 0142 实现路由逻辑
    return Promise.resolve();
  });
  await Promise.all(tasks);
}
```

### 3.2 调用入口点
在 `_applyBuiltins` 中，当 label.t === 'IN' 且目标 Cell 有 CELL_CONNECT 时：
```javascript
// 在 _applyBuiltins 的末尾，label.t === 'IN' 时检查
if (label.t === 'IN') {
  const cellKey = `${model.id}|${p}|${r}|${c}`;
  if (this.cellConnectGraph.has(cellKey)) {
    // 异步传播，不阻塞 addLabel 的同步流程
    this._propagateCellConnect(model.id, p, r, c, 'self', label.k, label.v)
      .catch(err => { /* 记录错误 */ });
  }
}
```

### 3.3 _executeFuncViaCellConnect（独立异步路径）
新增函数在 runtime.js 中（不修改 worker_engine_v0.mjs 的 executeFunction）。

**路径隔离说明**：此函数仅由 CELL_CONNECT 的 `func` 前缀触发。现有 trigger_funcs 路径走 `_applyMailboxTriggers` → `run_func` label → `_processRunTriggers` → `executeFunction`（同步）。两条路径在 0143 删除前完全独立：触发机制不同、执行方式不同、不存在同一函数名的执行歧义。
```javascript
async _executeFuncViaCellConnect(modelId, p, r, c, funcName, inputValue, visited) {
  // 1. 查找函数 label: 在 Cell(p,r,c) 的 labels 中查找 t='function'
  //    如果 Cell 中没有 → 查 Model -10 的 (0,0,0)
  const model = this.getModel(modelId);
  if (!model) return;
  const cell = this.getCell(model, p, r, c);
  let funcLabel = null;
  for (const [, lbl] of cell.labels) {
    if (lbl.k === funcName && lbl.t === 'function') { funcLabel = lbl; break; }
  }
  if (!funcLabel) {
    // fallback: Model -10
    const sysModel = this.getModel(-10);
    if (sysModel) {
      const sysCell = this.getCell(sysModel, 0, 0, 0);
      const sysLabel = sysCell.labels.get(funcName);
      if (sysLabel && sysLabel.t === 'function') funcLabel = sysLabel;
    }
  }
  if (!funcLabel || typeof funcLabel.v !== 'string') return;

  // 2. 编译为 AsyncFunction
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  const fn = new AsyncFunction('ctx', 'label', funcLabel.v);

  // 3. 构造受限 ctx
  const ctx = {
    runtime: this,
    getLabel: (ref) => { /* 同 worker_engine_v0.mjs 的 ctx.getLabel */ },
    writeLabel: (ref, t, v) => { /* 同上 */ },
    rmLabel: (ref) => { /* 同上 */ },
  };

  // 4. 执行 + 超时
  const FUNC_TIMEOUT_MS = 30000;
  try {
    const result = await Promise.race([
      fn(ctx, {k: funcName, t: 'IN', v: inputValue}),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Function ${funcName} timeout after ${FUNC_TIMEOUT_MS}ms`)), FUNC_TIMEOUT_MS)
      )
    ]);
    // 5. 有 result → 传播到 (func, funcName:out)
    if (result !== undefined) {
      await this._propagateCellConnect(modelId, p, r, c, 'func', `${funcName}:out`, result, visited);
    }
  } catch (err) {
    this.addLabel(model, p, r, c,
      {k: `__error_${funcName}`, t: 'json', v: {error: err.message, ts: Date.now()}});
  }
}
```

### Files
- `packages/worker-base/src/runtime.js`: _propagateCellConnect + _executeFuncViaCellConnect + 调用入口
- `packages/worker-base/src/runtime.mjs`: 同步更新

### Verify
```bash
bun scripts/tests/test_async_function_engine.mjs
```
预期: 正常执行 PASS、超时 30s 后 reject、多目标并发执行、函数错误被捕获、循环连接被检测并跳过

### Rollback
删除 _propagateCellConnect 和 _executeFuncViaCellConnect

---

## Step 4: 集成测试 + 回归验证

### 4.1 构造测试模型
创建 `scripts/tests/fixtures/test_cell_connect_model.json`：
- Model 999 (测试用)
- Cell(0,0,0): cell_connection 路由 `(0,0,0,"input") → (1,0,0,"cmd")`
- Cell(1,0,0): CELL_CONNECT `(self, cmd) → (func, process:in)`, `(func, process:out) → (self, result)`
- Cell(1,0,0): function "process" 返回 `input + "_processed"`
- cell_connection 路由 `(1,0,0,"result") → (0,0,0,"output")`

### 4.2 集成测试
```bash
bun scripts/tests/test_0141_integration.mjs
```
验证: 写入 Cell(0,0,0) k="input" → 经路由和函数处理 → 到达 Cell(0,0,0) k="output" 且值正确

### 4.3 回归验证
```bash
bun scripts/tests/test_model100_records_only.mjs
```
预期: 现有 Model 100 行为不受影响（tick() 同步循环不变）

### Files
- `scripts/tests/fixtures/test_cell_connect_model.json`
- `scripts/tests/test_0141_integration.mjs`

### Verify
两个测试脚本全部 PASS

### Rollback
删除测试文件

---

## Step 5: Living Docs 同步

### 5.1 更新 `docs/ssot/runtime_semantics_modeltable_driven.md`
新增章节（在现有 PIN 章节之后）：
- §X.1 CELL_CONNECT 标签的运行时语义（label.t 调度、解析、连接图构建）
- §X.2 cell_connection 标签的运行时语义（路由表构建、传播）
- §X.3 _propagateCellConnect 并发传播模型（Promise.all、循环检测）
- §X.4 _executeFuncViaCellConnect 执行模型（AsyncFunction 编译、超时、错误处理）

### 5.2 更新 `docs/user-guide/modeltable_user_guide.md`
新增 CELL_CONNECT 和 cell_connection 的用法说明和示例。

### 5.3 验证 `docs/handover/dam-worker-guide.md`
确认三层连接架构描述与实现一致。

### Files
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/user-guide/modeltable_user_guide.md`

### Verify
文档内容与实现一致

### Rollback
git revert 文档变更
