# 0142 — Resolution (HOW)

## Step 1: BUS_IN/BUS_OUT 标签处理

### 1.1 新增数据结构
在 `runtime.js` 的 ModelTableRuntime constructor 中新增：
```javascript
this.busInPorts = new Map();   // key: label.k (端口名) → value: true
this.busOutPorts = new Map();  // key: label.k (端口名) → value: true
```

### 1.2 BUS_IN 标签处理
在 `_applyBuiltins` 中新增 `label.t === 'BUS_IN'` 分支：
1. 验证位置：`model.id === 0 && p === 0 && r === 0 && c === 0`
2. 位置错误时 → `this._recordError(model, p, r, c, label, 'bus_in_wrong_position')` 并 return
3. 注册到 `this.busInPorts`: key = `label.k`
4. 如果 label.v 不为 null（运行时有新值写入）→ 触发 cell_connection 路由
   ```javascript
   if (label.v !== null && label.v !== undefined) {
     this._routeViaCellConnection(0, 0, 0, 0, label.k, label.v);
   }
   ```
   注意：路由仅在 `_applyBuiltins` 中触发，不在 `_handleBusInMessage` 中重复调用

### 1.3 BUS_OUT 标签处理
在 `_applyBuiltins` 中新增 `label.t === 'BUS_OUT'` 分支：
1. 验证位置同上
2. 位置错误时 → 记录错误并 return
3. 注册到 `this.busOutPorts`: key = `label.k`
4. 如果 label.v 不为 null 且 mqttClient 存在 → 拼接 topic → MQTT 发布
   ```javascript
   if (label.v !== null && label.v !== undefined && this.mqttClient) {
     const topic = this._topicFor(0, label.k, 'out');
     if (topic) this.mqttClient.publish(topic, label.v);
   }
   ```

### 1.4 MQTT 入站路由
在 `mqttIncoming` 中新增 BUS_IN 路由分支（在 legacy PIN_IN 路由之前，短路逻辑）：
```javascript
// 在 9layer 模式下，先检查是否匹配 BUS_IN 端口
if (this.busInPorts.has(pinName) && modelId === 0) {
  this._handleBusInMessage(pinName, payload);
  return true;  // 短路，不再进入 legacy PIN_IN 路由
}
// fallthrough to legacy PIN_IN handling (unchanged)
```

### 1.5 _handleBusInMessage
```javascript
_handleBusInMessage(portName, payload) {
  const model0 = this.getModel(0);
  if (!model0) return;
  // 写入 BUS_IN.v（addLabel 会触发 _applyBuiltins → 路由）
  this.addLabel(model0, 0, 0, 0, { k: portName, t: 'BUS_IN', v: payload });
  this.mqttTrace.record('bus_inbound', { port: portName, payload });
  // 注意：不在此处显式调用 _routeViaCellConnection
  // 路由由 _applyBuiltins 中的 BUS_IN 分支触发（单一路由入口）
}
```

### 1.6 initMqtt 扩展
`initMqtt` 由外部 worker script 在所有 patch（model_0_framework.json + system_models.json + 应用模型）加载完成后调用。此时 Model 0 的 MQTT 配置 labels（`mqtt_topic_mode`、`mqtt_base_topic` 等）已就位。

在 `initMqtt` 中追加 BUS_IN 端口的 MQTT 订阅：
```javascript
// _topicFor() 通过 _getConfigFromPage0() 读取 Model 0 (0,0,0) 上的 MQTT 配置
// 配置 labels 在 model_0_framework.json 或 system_models.json 中声明
for (const [portName] of this.busInPorts) {
  const topic = this._topicFor(0, portName, 'in');
  if (topic) this.mqttClient.subscribe(topic);
}
```

### Files
- `packages/worker-base/src/runtime.js`
- `packages/worker-base/src/runtime.mjs`: 同步更新

### Verify
```bash
bun scripts/tests/test_bus_in_out.mjs
```
预期: BUS_IN 订阅 MQTT、收到消息后 cell_connection 路由正确（仅执行一次）、BUS_OUT 写入后发布正确、位置错误时安全跳过、BUS_IN 优先于 legacy PIN_IN

### Rollback
删除 busInPorts/busOutPorts 和处理分支

---

## Step 2: subModel 声明 + parentChildMap

### 2.1 新增数据结构
```javascript
this.parentChildMap = new Map();
// key: childModelId (number)
// value: { parentModelId: number, hostingCell: {p, r, c} }
```

### 2.2 subModel 标签处理
在 `_applyBuiltins` 中新增 `label.t === 'subModel'` 分支：
1. `label.k` = 子模型 ID（字符串形式的整数）
2. `label.v` = `{alias: string}`（可选）
3. 解析 childModelId = `parseInt(label.k, 10)`
4. 验证 childModelId 为有效整数，否则记录错误并跳过
5. 注册到 `parentChildMap`: key = childModelId, value = `{ parentModelId: model.id, hostingCell: {p, r, c} }`
6. 如果子模型尚未创建 → `this.createModel({id: childModelId, name: label.v?.alias || String(childModelId), type: 'sub'})`

### Files
- `packages/worker-base/src/runtime.js`
- `packages/worker-base/src/runtime.mjs`: 同步更新

### Verify
```bash
bun scripts/tests/test_submodel_register.mjs
```
预期: subModel 注册正确、parentChildMap 查询正确、无效 k 安全跳过

### Rollback
删除 parentChildMap 和 subModel 处理分支

---

## Step 3: MODEL_IN/MODEL_OUT 边界

### 3.1 新增数据结构
```javascript
this.modelInPorts = new Map();   // key: "${modelId}:${label.k}" → value: true
this.modelOutPorts = new Map();  // key: "${modelId}:${label.k}" → value: true
```

### 3.2 MODEL_IN 标签处理
在 `_applyBuiltins` 中新增 `label.t === 'MODEL_IN'` 分支：
1. 验证位置：`p === 0 && r === 0 && c === 0`，否则记录错误并跳过
2. 注册到 `modelInPorts`: key = `${model.id}:${label.k}`
3. 当 MODEL_IN.v 被写入时（label.v !== null）：
   - 触发子模型内 cell_connection 路由: `this._routeViaCellConnection(model.id, 0, 0, 0, label.k, label.v)`
   - 触发子模型 (0,0,0) 的 CELL_CONNECT（如果有）:
     ```javascript
     const cellKey = `${model.id}|0|0|0`;
     if (this.cellConnectGraph.has(cellKey)) {
       this._propagateCellConnect(model.id, 0, 0, 0, 'self', label.k, label.v)
         .catch(err => { /* 记录错误 */ });
     }
     ```

### 3.3 MODEL_OUT 标签处理
在 `_applyBuiltins` 中新增 `label.t === 'MODEL_OUT'` 分支：
1. 验证位置同上
2. 注册到 `modelOutPorts`: key = `${model.id}:${label.k}`
3. 当 MODEL_OUT.v 被写入时（label.v !== null）：
   - 查 parentChildMap 获取父模型和 hosting cell
   ```javascript
   const childInfo = this.parentChildMap.get(model.id);
   if (!childInfo) return;
   const { parentModelId, hostingCell: {p: hp, r: hr, c: hc} } = childInfo;
   // 在父模型的 hosting cell 上以 (childModelId, portName) 为源端口触发 CELL_CONNECT
   this._propagateCellConnect(parentModelId, hp, hr, hc, String(model.id), label.k, label.v)
     .catch(err => { /* 记录错误 */ });
   ```

### Files
- `packages/worker-base/src/runtime.js`
- `packages/worker-base/src/runtime.mjs`: 同步更新

### Verify
```bash
bun scripts/tests/test_model_in_out.mjs
```
预期: MODEL_IN 写入触发子模型路由 + CELL_CONNECT、MODEL_OUT 写入通知父模型、位置错误安全跳过

### Rollback
删除 modelInPorts/modelOutPorts 和处理分支

---

## Step 4: CELL_CONNECT 数字 ID 前缀路由逻辑

### 4.1 扩展 _propagateCellConnect
在 0141 的 `_propagateCellConnect` 中，数字前缀分支（当前为 `Promise.resolve()`）替换为：
```javascript
if (!isNaN(Number(t.prefix))) {
  const childModelId = Number(t.prefix);
  const childInfo = this.parentChildMap.get(childModelId);
  if (!childInfo) {
    // 子模型未注册，记录错误
    this.eventLog.record({
      op: 'cell_connect_error', cell: {model_id: modelId, p, r, c},
      label: {k: `${t.prefix}:${t.port}`}, result: 'failed', reason: 'submodel_not_registered'
    });
    return Promise.resolve();
  }
  // 写入子模型 MODEL_IN
  const childModel = this.getModel(childModelId);
  if (!childModel) return Promise.resolve();
  this.addLabel(childModel, 0, 0, 0, { k: t.port, t: 'MODEL_IN', v: value });
  return Promise.resolve();
}
```

### 4.2 MODEL_OUT 反向路由
MODEL_OUT 被写入时（Step 3.3），通过 `_propagateCellConnect` 在父模型 hosting cell 上传播，以 `(childModelId, portName)` 为源端口 → 查 CELL_CONNECT 图 → 目标。

### Files
- `packages/worker-base/src/runtime.js`
- `packages/worker-base/src/runtime.mjs`: 同步更新

### Verify
```bash
bun scripts/tests/test_submodel_connect.mjs
```
预期: 数字前缀路由到子模型 MODEL_IN、子模型 MODEL_OUT 回传到父模型、未注册子模型安全跳过

### Rollback
恢复数字前缀分支为 `Promise.resolve()`

---

## Step 5: Model 0 框架 JSON + 集成测试

### 5.1 创建 Model 0 框架
`packages/worker-base/system-models/model_0_framework.json`:
```json
{
  "version": "mt.v0",
  "records": [
    {"op": "create_model", "model_id": 0, "name": "system_root", "type": "system"},
    {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0,
     "label": {"k": "test_in", "t": "BUS_IN", "v": null}},
    {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0,
     "label": {"k": "test_out", "t": "BUS_OUT", "v": null}},
    {"op": "add_label", "model_id": 0, "p": 1, "r": 0, "c": 0,
     "label": {"k": "100", "t": "subModel", "v": {"alias": "color_gen"}}},
    {"op": "add_label", "model_id": 0, "p": 1, "r": 0, "c": 0,
     "label": {"k": "bridge", "t": "CELL_CONNECT", "v": {
       "(self, cmd)": ["(100, cmd)"],
       "(100, result)": ["(self, result_out)"]
     }}},
    {"op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0,
     "label": {"k": "routing", "t": "cell_connection", "v": [
       {"from": [0,0,0,"test_in"], "to": [[1,0,0,"cmd"]]},
       {"from": [1,0,0,"result_out"], "to": [[0,0,0,"test_out"]]}
     ]}}
  ]
}
```

**加载顺序说明**：
- `model_0_framework.json` 先加载 → 创建 Model 0、注册 subModel、建立 parentChildMap 和路由
- `system_models.json` 后加载 → 填充 Model -10 等系统子模型内容（MQTT 配置、函数等）
- `initMqtt` 在两者都加载后调用 → 此时 `_topicFor()` 可正确读取 Model 0 的 `_getConfigFromPage0` 配置

### 5.2 集成测试
```bash
bun scripts/tests/test_0142_integration.mjs
```
测试内容：
1. 加载 Model 0 框架 + 测试子模型（Model 100 简化版）
2. 模拟 MQTT 消息到达 BUS_IN
3. 验证 BUS_IN → cell_connection → hosting cell CELL_CONNECT → subModel MODEL_IN → 子模型处理 → MODEL_OUT → 父模型 CELL_CONNECT → cell_connection → BUS_OUT
4. 验证 mqttIncoming 短路（BUS_IN 优先于 legacy PIN_IN）

### 5.3 回归验证
```bash
bun scripts/tests/test_model100_records_only.mjs
```
预期: 现有 Model 100 行为不受影响

### Files
- `packages/worker-base/system-models/model_0_framework.json`
- `scripts/tests/test_0142_integration.mjs`

### Verify
两个测试脚本全部 PASS

### Rollback
删除 model_0_framework.json 和测试文件

---

## Step 6: Living Docs 评估

### 6.1 更新 `docs/ssot/runtime_semantics_modeltable_driven.md`
新增章节（在 0141 新增的章节之后）：
- §Y.1 BUS_IN/BUS_OUT 运行时语义（位置限制、MQTT 订阅/发布、路由触发、与 PIN_IN 的优先级）
- §Y.2 MODEL_IN/MODEL_OUT 运行时语义（边界数据传递、与 CELL_CONNECT 的交互）
- §Y.3 subModel 声明与 parentChildMap 语义
- §Y.4 Bootstrap 加载顺序

### 6.2 更新 `docs/user-guide/modeltable_user_guide.md`
新增 BUS_IN/OUT、MODEL_IN/OUT、subModel 的用法说明和示例。

### 6.3 验证 `docs/handover/dam-worker-guide.md`
确认三层连接架构描述与实现一致。

### Files
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/user-guide/modeltable_user_guide.md`

### Verify
文档内容与实现一致

### Rollback
git revert 文档变更
