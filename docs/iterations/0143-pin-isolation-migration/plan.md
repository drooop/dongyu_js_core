# 0143 — Legacy PIN Cleanup + System-Models Migration + E2E Validation

## 0. Metadata
- ID: 0143-pin-isolation-migration
- Date: 2026-02-11
- Owner: AI (Auto-Approved)
- Branch: dev_0143-pin-isolation-migration
- Related:
  - docs/plans/2026-02-11-pin-isolation-and-model-hierarchy-design.md (§9)
  - docs/iterations/0141-cell-connect-engine/ (前置依赖)
  - docs/iterations/0142-bus-model-boundary/ (前置依赖)
  - packages/worker-base/src/runtime.js
  - packages/worker-base/src/runtime.mjs
  - packages/worker-base/system-models/*.json
  - scripts/worker_engine_v0.mjs

## 1. Goal
删除 legacy PIN 路由机制（pinInBindings、trigger_funcs、cell-owned binding、label_connection），将现有 system-models JSON 迁移到新的三层连接架构，并通过 E2E 验证确认全链路工作。

这是 PIN 隔离设计的最后一步：切换并清理。

## 2. Background
0141 + 0142 已建立完整的三层连接基础设施：
- CELL_CONNECT（Cell 内连接）
- cell_connection（Cell 间路由）
- BUS_IN/OUT（系统边界）
- MODEL_IN/OUT + subModel（模型层级）

本迭代将现有模型定义迁移到新架构，并删除不再需要的 legacy 代码。

设计文档明确：「本设计是架构级变更，不保留 legacy 兼容」。

**前置依赖**：0141 和 0142 的 Living Docs 章节（runtime_semantics 新增章节）必须在本迭代删除旧章节之前完成。

## 3. Invariants (Must Not Change)
- ModelTable 数据结构（Cell/Label/Model）不变
- MQTT topic 协议（uiput_9layer_v2）不变
- mt.v0 patch 格式不变
- Matrix 适配器接口不变
- Model 100 的业务逻辑（颜色生成）不变，只是路由方式改变
- 0141+0142 建立的新连接机制不变
- worker_engine_v0.mjs 的 `_processRunTriggers` / `_processIntercepts` / `tick()` 同步循环不变（仅依赖 `run_*` labels，不依赖 `_applyMailboxTriggers`）

## 4. Scope

### 4.1 In Scope
1. **盘点 Legacy 代码**（调研步骤）：
   - grep 扫描整个项目的 legacy 符号引用（不限于 `packages/worker-base/src/` 和 `scripts/`）
   - 扫描范围包括：
     - `packages/worker-base/src/runtime.js` — 主 runtime (CJS)
     - `packages/worker-base/src/runtime.mjs` — ESM 变体，与 runtime.js 同步维护
     - `packages/ui-model-demo-server/server.mjs` — 使用 `findPinInBindingsForDelivery` 和 `trigger_funcs`
     - `scripts/run_remote_worker_k8s_v2.mjs` — 日志中引用 `pinInSet`/`pinOutSet`
     - `scripts/validate_pin_mqtt_loop.mjs` — legacy PIN 验证脚本
     - `scripts/validate_model100_records_e2e_v0.mjs` — 引用 `trigger_funcs`
     - `scripts/worker_engine_v0.mjs` — `pin_binding` 处理
   - 生成按文件列出的删除清单

2. **检查 MBR Worker 代码**：
   - 检查 `scripts/run_worker_mbr_v0.mjs` 是否依赖 legacy 格式
   - 如有依赖，一并迁移或标记

3. **删除 runtime.js legacy 代码**：
   - Constructor: `pinInBindings` / `pinOutSet` / `pinInSet` 初始化
   - `_parsePinInBinding` / `_resolvePinInRouteForMode` / `resolvePinInRoute`
   - `findPinInBindingsForDelivery`
   - `_pinRegistryCellFor` / `_pinMailboxCellFor` / `_pinKey`（如无其他调用者）
   - `_applyPinDeclarations` 中的 PIN_IN/PIN_OUT cell-owned binding 分支（保留 MQTT_WILDCARD_SUB 相关逻辑；如果只剩 wildcard 逻辑则重命名为 `_applyMqttWildcardSub` 或类似）
   - `_applyMailboxTriggers` 整个函数 + 调用点（注意：`_processRunTriggers` 在 worker_engine_v0.mjs 中直接读取 `run_*` labels，不依赖 `_applyMailboxTriggers`，因此删除安全）
   - `_resolveTriggerModelId`
   - `mqttIncoming` 中的 legacy PIN_IN 路由路径（保留 BUS_IN 路径和 wildcard 路径）
   - `label_connection` type 处理（如有）
   - Cell (0,0,1) PIN registry 和 Cell (0,1,1) PIN mailbox 的硬编码引用

4. **同步更新 runtime.mjs**：
   - runtime.mjs 是 runtime.js 的 ESM 变体，legacy 代码结构相同
   - 执行与 runtime.js 相同的删除操作

5. **更新 consumer 文件**：
   - `packages/ui-model-demo-server/server.mjs`: 移除 `findPinInBindingsForDelivery` 调用 + `trigger_funcs` 引用，改用新的 BUS_IN/CELL_CONNECT 路径
   - `scripts/run_remote_worker_k8s_v2.mjs`: 移除 `pinInSet`/`pinOutSet` 日志行，改为日志 `busInPorts`/`busOutPorts`
   - `scripts/validate_pin_mqtt_loop.mjs`: 删除或重写为测试新架构的验证脚本
   - `scripts/validate_model100_records_e2e_v0.mjs`: 更新为使用新架构验证（BUS_IN + CELL_CONNECT + cell_connection）

6. **迁移 system_models.json**：
   - 备份为 `system_models.json.legacy`
   - 删除 PIN_IN/PIN_OUT 声明
   - 删除或迁移 legacy demo 函数：
     - `pin_demo_declare_pin_in` — 删除（写入 PIN_IN 到 (0,0,1)，legacy 格式）
     - `pin_demo_declare_pin_out` — 删除
     - `pin_demo_inject_in` — 删除（依赖 PIN_IN 路由）
     - `pin_demo_send_out` — 删除（依赖 PIN_OUT 路由）
     - `pin_demo_set_mqtt_config` — 保留（不依赖 PIN 机制）
     - `pin_demo_start_mqtt_loop` — 保留（不依赖 PIN 机制）
     - `intent_dispatch` — 评估：如果内部引用 `pin_register`/`pin_send_out`，需要迁移或删除对应分支
   - 改为 BUS_IN/OUT + cell_connection + CELL_CONNECT
   - 保留非连接相关的 label（mqtt 配置、MBR 路由等）

7. **迁移 test_model_100_full.json**（K8s Worker 侧）：
   - 删除 PIN_IN "event" 声明
   - 在 Model 100 的 (0,0,0) 添加 MODEL_IN 声明
   - 在 Cell 添加 CELL_CONNECT: `(self, event) → (func, on_model100_event_in:in)`, `(func, on_model100_event_in:out) → (self, patch)`
   - 在 Cell 添加 cell_connection 路由（如需模型内路由）

8. **迁移 test_model_100_ui.json**（Server 侧）：
   - 类似结构调整

9. **E2E 验证**：
   - 全链路: BUS_IN → cell_connection → CELL_CONNECT → MODEL_IN → 子模型 function → MODEL_OUT → cell_connection → BUS_OUT → MQTT 出站
   - 回归: Model 100 颜色生成响应格式/内容一致

10. **验证无残留**：
    - grep 确认所有 legacy 符号引用已清除（扫描整个项目，不限于 packages/worker-base/src/）
    - 确认 `label_connection` / `function_PIN_IN` / `function_PIN_OUT` / `trigger_funcs` / `pinInBindings` 无残留

11. **Living Docs 评估**：
    - `docs/ssot/runtime_semantics_modeltable_driven.md` — 删除 legacy 章节（前提：0141/0142 已新增替代章节）
    - `docs/user-guide/modeltable_user_guide.md` — 删除 legacy PIN 用法，确认新架构用法已在 0141/0142 中添加
    - `docs/handover/dam-worker-guide.md` — 验证迁移后的架构描述

### 4.2 Out of Scope
- 新增 DAM Worker 模型定义（后续迭代）
- Worker Threads 同步阻塞保护（KNOWN_LIMITATION）
- 嵌套子模型 E2E（0142 已覆盖基础路由）

## 5. Success Criteria
- legacy 代码全部删除，无残留引用（grep 全项目验证）
- runtime.js 和 runtime.mjs 同步更新
- `label_connection` / `function_PIN_IN` / `function_PIN_OUT` type 无残留
- `pinInBindings` / `pinOutSet` / `pinInSet` / `trigger_funcs` / `_applyMailboxTriggers` 无残留
- system_models.json 使用新格式（BUS_IN/OUT + cell_connection + CELL_CONNECT）
- legacy demo 函数（pin_demo_declare_pin_in/out, pin_demo_inject_in, pin_demo_send_out）已删除
- test_model_100 使用新格式（MODEL_IN + CELL_CONNECT）
- consumer 文件更新完成（server.mjs, run_remote_worker_k8s_v2.mjs, validate_pin_mqtt_loop.mjs, validate_model100_records_e2e_v0.mjs）
- E2E 全链路 PASS
- 无 regression（Model 100 颜色生成器行为不变）
- `_processRunTriggers` 和 `tick()` 循环正常工作

## 6. Risks
- 大范围删除可能遗漏依赖 → 通过全项目 grep 确认无残留引用
- JSON 迁移可能遗漏字段 → 通过 E2E 验证覆盖
- MBR Worker 可能依赖 legacy 格式 → Step 2 显式检查
- runtime.mjs 与 runtime.js 不同步 → 两文件同步修改 + 对比验证
- 删除 `_applyMailboxTriggers` 可能影响 `run_func` 处理 → 已确认 `_processRunTriggers` 直接读取 `run_*` labels（不经过 `_applyMailboxTriggers`），删除安全
- 全量 rollback 必要性 → 整个迭代在单独分支上执行，可整体 git revert
