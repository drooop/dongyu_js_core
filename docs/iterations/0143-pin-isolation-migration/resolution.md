# 0143 — Resolution (HOW)

## Step 1: 盘点 Legacy 代码（调研）

### 1.1 grep 扫描
扫描整个项目（不限于 `packages/worker-base/src/` 和 `scripts/`）对以下符号的引用：
- `pinInBindings` / `pinOutSet` / `pinInSet`
- `_parsePinInBinding` / `_resolvePinInRouteForMode` / `resolvePinInRoute`
- `_applyPinDeclarations` / `_applyMailboxTriggers` / `_resolveTriggerModelId`
- `trigger_funcs` / `trigger_func` / `trigger_model_id`
- `label_connection` / `function_PIN_IN` / `function_PIN_OUT`
- `_pinRegistryCellFor` / `_pinMailboxCellFor` / `_pinKey`
- `findPinInBindingsForDelivery`
- `pin_demo_declare_pin_in` / `pin_demo_declare_pin_out` / `pin_demo_inject_in` / `pin_demo_send_out`

```bash
grep -rn "pinInBindings\|pinOutSet\|pinInSet\|trigger_funcs\|_parsePinInBinding\|_resolvePinInRouteForMode\|resolvePinInRoute\|_applyPinDeclarations\|_applyMailboxTriggers\|_resolveTriggerModelId\|findPinInBindingsForDelivery\|_pinRegistryCellFor\|_pinMailboxCellFor\|_pinKey\|label_connection\|function_PIN_IN\|function_PIN_OUT\|pin_demo_declare_pin_in\|pin_demo_declare_pin_out\|pin_demo_inject_in\|pin_demo_send_out" \
  --include="*.js" --include="*.mjs" --include="*.json" \
  packages/ scripts/
```

### 1.2 生成删除清单
按文件列出：要删除的函数/变量/代码块、行号范围。

已知涉及文件（2026-02-11 预扫描）：
- `packages/worker-base/src/runtime.js` — 主要删除目标
- `packages/worker-base/src/runtime.mjs` — ESM 变体，同步删除
- `packages/ui-model-demo-server/server.mjs` — L991 `findPinInBindingsForDelivery`, L994-997 `trigger_funcs`
- `scripts/run_remote_worker_k8s_v2.mjs` — L61-62 `pinInSet`/`pinOutSet` 日志
- `scripts/validate_pin_mqtt_loop.mjs` — 整个脚本依赖 legacy PIN 机制
- `scripts/validate_model100_records_e2e_v0.mjs` — `trigger_funcs` 测试断言
- `packages/worker-base/system-models/system_models.json` — legacy demo 函数
- `packages/worker-base/system-models/test_model_100_full.json` — PIN_IN 声明

### Files
- N/A（调研步骤）

### Verify
grep 输出完整，无遗漏。与预扫描结果对比确认。

### Rollback
N/A

---

## Step 2: 检查 MBR Worker 代码

### 2.1 MBR Worker 扫描
检查 `scripts/run_worker_mbr_v0.mjs` 及其引用的模块：
- 是否直接使用 `pinInBindings` / `pinInSet` / `pinOutSet`
- 是否依赖 `trigger_funcs` 机制
- 是否引用 `label_connection` / `function_PIN_IN` / `function_PIN_OUT`
- 是否直接操作 PIN registry cell (0,0,1) 或 PIN mailbox cell (0,1,1)

### 2.2 迁移决策
- 如果 MBR Worker 不依赖 legacy 格式 → 无需额外操作
- 如果有依赖 → 列出需要修改的代码点，在 Step 4/5 中一并处理

### Files
- `scripts/run_worker_mbr_v0.mjs`

### Verify
扫描报告完整

### Rollback
N/A

---

## Step 3: 迁移 system_models.json + test_model_100

### 3.1 备份
```bash
cp packages/worker-base/system-models/system_models.json packages/worker-base/system-models/system_models.json.legacy
cp packages/worker-base/system-models/test_model_100_full.json packages/worker-base/system-models/test_model_100_full.json.legacy
cp packages/worker-base/system-models/test_model_100_ui.json packages/worker-base/system-models/test_model_100_ui.json.legacy
```

### 3.2 迁移 system_models.json
- 删除 PIN_IN/PIN_OUT 声明
- 删除 legacy demo 函数：
  - `pin_demo_declare_pin_in` — 删除（写 PIN_IN 到 (0,0,1)）
  - `pin_demo_declare_pin_out` — 删除
  - `pin_demo_inject_in` — 删除（依赖 PIN_IN 路由机制）
  - `pin_demo_send_out` — 删除（依赖 PIN_OUT 路由机制）
- 保留不依赖 PIN 机制的函数：
  - `pin_demo_set_mqtt_config` — 保留（只操作 mqtt 配置 label）
  - `pin_demo_start_mqtt_loop` — 保留（只触发 MQTT 初始化）
- 评估 `intent_dispatch` 函数：
  - 如果内部引用 `pin_register`/`pin_send_out` 命令 → 删除对应分支或重写
  - 如果仅操作 label → 保留
- MBR 路由保留（不依赖 PIN）
- 系统函数保持在 Model -10
- 保留 MQTT 配置、MBR 路由等非连接 label

### 3.3 迁移 test_model_100_full.json（K8s Worker 侧）
- 删除 PIN_IN "event" 声明（Cell 0,0,1 上的 label）
- 在 Model 100 的 (0,0,0) 添加 MODEL_IN 声明：
  ```json
  {"k": "event", "t": "MODEL_IN", "v": null}
  ```
- 在 Model 100 的业务 Cell 添加 CELL_CONNECT：
  ```json
  {"k": "wiring", "t": "CELL_CONNECT", "v": {
    "(self, event)": ["(func, on_model100_event_in:in)"],
    "(func, on_model100_event_in:out)": ["(self, patch)"]
  }}
  ```
- 在 Model 100 的 (0,0,0) 添加 cell_connection 路由：
  ```json
  {"k": "routing", "t": "cell_connection", "v": [
    {"from": [0,0,0,"event"], "to": [[1,0,0,"event"]]},
    {"from": [1,0,0,"patch"], "to": [[0,0,0,"patch"]]}
  ]}
  ```
  注意：cell_connection 将 MODEL_IN 的端口路由到业务 Cell

### 3.4 迁移 test_model_100_ui.json（Server 侧）
- 类似结构调整

### Files
- `packages/worker-base/system-models/system_models.json`
- `packages/worker-base/system-models/test_model_100_full.json`
- `packages/worker-base/system-models/test_model_100_ui.json`

### Verify
```bash
bun scripts/tests/test_system_models_load.mjs
bun scripts/tests/test_model100_new_format.mjs
```
预期: 新格式加载成功，MODEL_IN 正确注册，BUS_IN/OUT 正确注册（从 Model 0 框架）

### Rollback
```bash
cp packages/worker-base/system-models/system_models.json.legacy packages/worker-base/system-models/system_models.json
cp packages/worker-base/system-models/test_model_100_full.json.legacy packages/worker-base/system-models/test_model_100_full.json
cp packages/worker-base/system-models/test_model_100_ui.json.legacy packages/worker-base/system-models/test_model_100_ui.json
```

---

## Step 4: 删除 runtime.js Legacy 代码

### 4.1 runtime.js 删除清单
按 Step 1 盘点结果，删除：
- Constructor: `pinInBindings` / `pinOutSet` / `pinInSet` 初始化
- `_pinKey` 函数（如无其他调用者）
- `_parsePinInBinding` 函数
- `_resolvePinInRouteForMode` / `resolvePinInRoute` 函数
- `findPinInBindingsForDelivery` 函数
- `_pinRegistryCellFor` / `_pinMailboxCellFor` 函数
- `_applyPinDeclarations` 中的 PIN_IN/PIN_OUT cell-owned binding 分支
  - 如果该函数中只剩 MQTT_WILDCARD_SUB 相关逻辑 → 重命名为 `_applyMqttWildcardSub` 或内联到 `_applyBuiltins`
  - 如果 `_applyPinDeclarations` 完全为空 → 删除整个函数 + 调用点
- `_applyMailboxTriggers` 整个函数
  - 删除 `_applyBuiltins` 或 `addLabel` 中的 `this._applyMailboxTriggers(...)` 调用点
  - **安全确认**：`_processRunTriggers`（worker_engine_v0.mjs L129-158）直接读取 `run_*` labels（通过 `Cell.labels` 遍历），不依赖 `_applyMailboxTriggers` 的输出。删除安全。
- `_resolveTriggerModelId` 函数
- `mqttIncoming` 中的 legacy PIN_IN 路由路径
  - 保留: BUS_IN 路径（0142 新增）、MQTT_WILDCARD_SUB 路径
  - 删除: legacy `pinInSet.has()` 检查 + `pinInBindings.get()` 路由 + mailbox (0,1,1) 写入路径
- `label_connection` type 处理（如 `_applyBuiltins` 中有 label.k === 'label_connection' 分支）
- Cell (0,0,1) PIN registry 硬编码引用
- Cell (0,1,1) PIN mailbox 硬编码引用（`_pinMailboxCellFor` 返回值）

### 4.1b worker_engine_v0.mjs 评估
经检查，该文件的 `_processRunTriggers`（L129-158）直接遍历 `cell.labels` 读取 `run_*` labels，不依赖 `_applyMailboxTriggers` 或 `pinInBindings`。`_processIntercepts`（L111-121）处理 `runtime.intercepts` 队列，当 `_applyMailboxTriggers` 被删除后不再有 `run_func` 类型的 intercept 写入，该函数安全退化为空操作。**结论：worker_engine_v0.mjs 无需修改。**

### 4.2 同步更新 runtime.mjs
runtime.mjs 是 runtime.js 的 ESM 变体，包含相同的 legacy 代码结构。
对照 runtime.js 的每项删除，在 runtime.mjs 中执行相同操作。
完成后 diff 两文件确认一致性（除 module.exports vs export 外）。

### 4.3 更新 consumer 文件

**server.mjs**（`packages/ui-model-demo-server/server.mjs`）：
- L991: 删除 `findPinInBindingsForDelivery` 调用
- L994-997: 删除 `trigger_funcs` 引用
- 替换为新架构路径：通过 addLabel 写入 BUS_IN.v 或 MODEL_IN.v 触发路由

**run_remote_worker_k8s_v2.mjs**：
- L61-62: 将 `pinInSet`/`pinOutSet` 日志替换为 `busInPorts`/`busOutPorts`

**validate_pin_mqtt_loop.mjs**：
- 选项 A: 删除整个脚本（纯 legacy 验证，已被 0141/0142/0143 测试取代）
- 选项 B: 重写为新架构验证
- 推荐: 选项 A（删除），因为 0143 E2E 测试已覆盖

**validate_model100_records_e2e_v0.mjs**：
- 更新 `trigger_funcs` 相关断言
- 改为验证 CELL_CONNECT + cell_connection 路径
- 或者：如果 0143 E2E 测试已完全覆盖 → 标记为 deprecated / 删除

### 4.4 验证无残留
```bash
grep -rn "pinInBindings\|pinOutSet\|pinInSet\|trigger_funcs\|_parsePinInBinding\|_resolvePinInRouteForMode\|resolvePinInRoute\|_applyPinDeclarations\|_applyMailboxTriggers\|_resolveTriggerModelId\|findPinInBindingsForDelivery\|_pinRegistryCellFor\|_pinMailboxCellFor\|label_connection\|function_PIN_IN\|function_PIN_OUT" \
  --include="*.js" --include="*.mjs" --include="*.json" \
  packages/ scripts/
```
预期: 无匹配（排除 .legacy 备份文件和 docs/iterations/ 中的文档引用）

注意：`_pinKey` 如果被 MQTT_WILDCARD_SUB 等非 legacy 逻辑使用，可能需要保留。grep 确认后决定。

### Files
- `packages/worker-base/src/runtime.js`
- `packages/worker-base/src/runtime.mjs`
- `packages/ui-model-demo-server/server.mjs`
- `scripts/run_remote_worker_k8s_v2.mjs`
- `scripts/validate_pin_mqtt_loop.mjs`
- `scripts/validate_model100_records_e2e_v0.mjs`
- `scripts/worker_engine_v0.mjs`

### Verify
grep 无匹配 + 现有测试不报错 + `_processRunTriggers` 和 `tick()` 正常工作

### Rollback
```bash
git checkout -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs
git checkout -- packages/ui-model-demo-server/server.mjs
git checkout -- scripts/run_remote_worker_k8s_v2.mjs scripts/validate_pin_mqtt_loop.mjs scripts/validate_model100_records_e2e_v0.mjs scripts/worker_engine_v0.mjs
```

---

## Step 5: E2E 验证

### 5.1 全链路测试
1. 创建测试脚本 `scripts/tests/test_0143_e2e.mjs`
2. 加载新格式 system_models + Model 0 框架（0142 创建）+ Model 100
3. 模拟 MQTT 消息到达 BUS_IN
4. 验证全链路: BUS_IN → cell_connection → CELL_CONNECT → MODEL_IN → 子模型 CELL_CONNECT → function → MODEL_OUT → cell_connection → BUS_OUT → MQTT 出站
5. 对比 0140 的行为：颜色生成响应格式/内容一致
6. 验证 `_processRunTriggers` 和 `tick()` 仍正常工作（写入 `run_*` label → tick 处理 → 函数执行）

### 5.2 运行验证
```bash
bun scripts/tests/test_0143_e2e.mjs
```

### 5.3 回归验证
运行所有已有的测试脚本（0141/0142 的测试），确认无 regression：
```bash
bun scripts/tests/test_cell_connect_parse.mjs
bun scripts/tests/test_cell_connection_route.mjs
bun scripts/tests/test_async_function_engine.mjs
bun scripts/tests/test_0141_integration.mjs
bun scripts/tests/test_bus_in_out.mjs
bun scripts/tests/test_submodel_register.mjs
bun scripts/tests/test_model_in_out.mjs
bun scripts/tests/test_submodel_connect.mjs
bun scripts/tests/test_0142_integration.mjs
```

### Files
- `scripts/tests/test_0143_e2e.mjs`

### Verify
```bash
bun scripts/tests/test_0143_e2e.mjs
```
预期: 全链路 PASS，行为与 0140 一致

### Rollback
全量 git revert（整个分支）

---

## Step 6: Living Docs 评估

### 6.1 更新 `docs/ssot/runtime_semantics_modeltable_driven.md`
- **前提**：0141/0142 已新增替代章节（CELL_CONNECT、cell_connection、BUS_IN/OUT、MODEL_IN/OUT、subModel 运行时语义）
- 删除或标记 deprecated 的 legacy 章节：
  - legacy PIN_IN binding 语义
  - trigger_funcs 机制
  - label_connection 语义
  - _applyMailboxTriggers 行为
  - Cell (0,0,1) PIN registry 语义
  - Cell (0,1,1) PIN mailbox 语义
- 确认 0141/0142 新增的章节与最终实现一致

### 6.2 更新 `docs/user-guide/modeltable_user_guide.md`
- 删除 legacy PIN 声明/使用说明
- 删除 `pin_demo_*` 相关示例
- 确认 0141/0142 新增的 CELL_CONNECT/cell_connection/BUS_IN/OUT 用法说明已就位

### 6.3 验证 `docs/handover/dam-worker-guide.md`
确认迁移后的架构描述与实现一致

### Files
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/user-guide/modeltable_user_guide.md`
- `docs/handover/dam-worker-guide.md`

### Verify
文档内容与实现一致

### Rollback
git revert 文档变更
