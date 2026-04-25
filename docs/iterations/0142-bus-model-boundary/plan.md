---
title: "0142 — BUS_IN/OUT System Boundary + MODEL_IN/OUT + subModel Lifecycle"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0142-bus-model-boundary
id: 0142-bus-model-boundary
phase: phase1
---

# 0142 — BUS_IN/OUT System Boundary + MODEL_IN/OUT + subModel Lifecycle

## 0. Metadata
- ID: 0142-bus-model-boundary
- Date: 2026-02-11
- Owner: AI (Auto-Approved)
- Branch: dev_0142-bus-model-boundary
- Related:
  - [[plans/2026-02-11-pin-isolation-and-model-hierarchy-design]] (§2, §3.1, §3.2)
  - docs/iterations/0141-cell-connect-engine/ (前置依赖)
  - packages/worker-base/src/runtime.js
  - packages/worker-base/src/runtime.mjs (ESM 变体，需同步更新)
  - scripts/worker_engine_v0.mjs

## 1. Goal
实现三层连接架构的系统边界层 (BUS_IN/OUT) 和模型层级通信 (MODEL_IN/OUT + subModel)，建立 Model 0 作为系统根的框架。

## 2. Background
0141 已实现 Cell 内连接 (CELL_CONNECT) 和 Cell 间路由 (cell_connection)。本迭代在此基础上：
- 在 Model 0 的 (0,0,0) 实现 BUS_IN/BUS_OUT 作为唯一 MQTT 入口/出口
- 实现 MODEL_IN/MODEL_OUT 子模型边界声明
- 实现 subModel 声明与生命周期
- 完成 CELL_CONNECT 数字 ID 前缀的路由逻辑（0141 已实现解析）

## 3. Invariants (Must Not Change)
- 现有 PIN_IN/PIN_OUT 机制保持不变（直到 0143 迁移）
- MQTT topic 构造逻辑（uiput_9layer_v2）不变
- mt.v0 patch 格式不变
- 0141 建立的 CELL_CONNECT/cell_connection 机制不变
- 0141 的 cellConnectGraph/cellConnectionRoutes 数据结构和 key 格式不变
- worker_engine_v0.mjs 的 executeFunction + tick() 同步循环不变

## 4. Scope

### 4.1 In Scope
1. **BUS_IN label 处理**：
   - 在 `_applyBuiltins` 中新增 `label.t === 'BUS_IN'` 调度
   - 位置限制：仅 Model 0 的 (0,0,0)，其他位置记录 eventLog 错误并跳过
   - `BUS_IN.k` = 本地端口名
   - MQTT topic 拼接：沿用 `_topicFor()` 函数（读 Model 0 的 `_getConfigFromPage0` 配置），不是从 Model -10 读
   - MQTT 消息到达时调用 `_handleBusInMessage`，该函数写入 BUS_IN.v 并通过 cell_connection 路由
   - MQTT 路由优先级：在 `mqttIncoming` 中 BUS_IN 检查在 legacy PIN_IN 之前（if/else 短路）

2. **BUS_OUT label 处理**：
   - 在 `_applyBuiltins` 中新增 `label.t === 'BUS_OUT'` 调度
   - 位置限制同上
   - `BUS_OUT.v` 被写入时，拼接 topic 后发布到 MQTT

3. **MODEL_IN/MODEL_OUT**：
   - 在 `_applyBuiltins` 中新增 `label.t === 'MODEL_IN'` / `label.t === 'MODEL_OUT'` 调度
   - 位置限制：任何模型的 (0,0,0)，其他位置记录错误并跳过
   - MODEL_IN: v 被写入时 → 触发子模型 cell_connection + CELL_CONNECT 传播
   - MODEL_OUT: v 被写入时 → 查 parentChildMap 获取父模型 hosting cell → 触发父模型 CELL_CONNECT 传播

4. **subModel 声明**：
   - 在 `_applyBuiltins` 中新增 `label.t === 'subModel'` 调度
   - k = 子模型 ID（字符串形式的数字），v = `{alias: string}`
   - 注册父子关系到 parentChildMap
   - 可自动创建子模型（如尚未存在）

5. **CELL_CONNECT 数字 ID 前缀路由逻辑**：
   - 在 0141 的 `_propagateCellConnect` 中替换数字前缀的 `Promise.resolve()` 占位
   - 数字前缀 → 查 parentChildMap → 写入子模型 MODEL_IN
   - MODEL_OUT 写入 → 在父模型 hosting cell 上以 `(childModelId, portName)` 为源端口触发 CELL_CONNECT 传播

6. **Bootstrap 顺序**：
   - `model_0_framework.json` 先加载（创建 Model 0 + 注册 BUS_IN/OUT + subModel 声明）
   - `system_models.json` 后加载（填充 Model -10 等系统子模型的内容）
   - subModel 注册触发 parentChildMap 构建
   - `initMqtt` 由外部调用者（worker script）在所有 patch 加载完成后调用
   - `initMqtt` 中统一订阅 BUS_IN 端口（此时 Model 0 的 MQTT 配置和 Model -10 的函数定义均已就绪）
   - `_topicFor()` 通过 `_getConfigFromPage0` 读取 Model 0 的 (0,0,0) 上的 MQTT 配置 labels（如 `mqtt_topic_mode`、`mqtt_base_topic` 等），不直接读 Model -10

7. **Model 0 框架 JSON**：
   - 创建 `model_0_framework.json`：Model 0 + BUS_IN/OUT + subModel 声明 + cell_connection + hosting cell CELL_CONNECT 桥接

8. **回归验证**：现有 Model 100 E2E 不受影响

9. **Living Docs 评估**：
   - `docs/ssot/runtime_semantics_modeltable_driven.md` — 新增 BUS_IN/OUT、MODEL_IN/OUT、subModel 运行时语义章节
   - `docs/user-guide/modeltable_user_guide.md` — 新增 BUS_IN/OUT、subModel 用法说明
   - `docs/handover/dam-worker-guide.md` — 验证与实现一致

### 4.2 Out of Scope
- 删除 legacy PIN 机制（→ 0143）
- 迁移现有 system_models.json（→ 0143）
- Worker Threads 同步阻塞保护（KNOWN_LIMITATION）
- BUS_IN/OUT 扩展到非 Model 0 位置（当前设计限制，KNOWN_LIMITATION）

## 5. Success Criteria
- BUS_IN 声明后 MQTT 订阅正确建立（限 Model 0 的 (0,0,0)）
- BUS_IN 位置错误时记录 eventLog 错误，不崩溃
- MQTT 消息到达 BUS_IN 后通过 cell_connection 路由到目标 Cell（仅执行一次，无双重路由）
- BUS_OUT 写入后 MQTT 发布正确
- MODEL_IN 接收父模型数据并触发子模型 cell_connection + CELL_CONNECT
- MODEL_OUT 回传数据到父模型 hosting cell 的 CELL_CONNECT
- subModel 声明正确注册父子关系
- CELL_CONNECT 数字 ID 前缀正确路由到子模型 MODEL_IN/OUT
- 同一 MQTT topic 同时被 BUS_IN 和 legacy PIN_IN 订阅时，仅 BUS_IN 处理（mqttIncoming 短路）
- 验证脚本全部 PASS
- 现有 Model 100 E2E 不受影响（旧机制不变）

## 6. Risks
- BUS_IN 与现有 PIN_IN 共存时可能产生重复订阅 → BUS_IN 使用独立的 busInPorts 注册表；mqttIncoming 中 BUS_IN 检查优先于 legacy PIN_IN，通过 if/else 短路确保同一消息只处理一次
- Model 0 框架 JSON 与现有 system_models.json 并行加载顺序 → model_0_framework.json 先加载（创建 Model 0 + 注册 subModel），system_models.json 后加载（填充内容）
- Model -10 配置尚未加载时 BUS_IN 拼接 topic 可能失败 → 延迟订阅到 initMqtt 统一处理（此时 system_models.json 已加载完成）
