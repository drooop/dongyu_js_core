---
title: "0141 — CELL_CONNECT Parser + cell_connection Router + AsyncFunction Engine"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0141-cell-connect-engine
id: 0141-cell-connect-engine
phase: phase1
---

# 0141 — CELL_CONNECT Parser + cell_connection Router + AsyncFunction Engine

## 0. Metadata
- ID: 0141-cell-connect-engine
- Date: 2026-02-11
- Owner: AI (Auto-Approved)
- Branch: dev_0141-cell-connect-engine
- Related:
  - [[plans/2026-02-11-pin-isolation-and-model-hierarchy-design]] (§4, §6)
  - packages/worker-base/src/runtime.js
  - packages/worker-base/src/runtime.mjs (ESM 变体，需同步更新)
  - scripts/worker_engine_v0.mjs

## 1. Goal
实现三层连接架构的底层两层：Cell 内统一连接表 (CELL_CONNECT) 和模型内 Cell 间路由 (cell_connection)，并为 CELL_CONNECT 触发的函数执行提供独立的 AsyncFunction + 超时保护路径。

这是 PIN 隔离设计的基础设施层。不改动现有 PIN_IN/trigger_funcs 机制（保留向后兼容直到 0143 迁移）。新旧机制并行存在。

## 2. Background
当前运行时（0140 状态）：
- CELL_CONNECT label key 已在 connectKeys 中预留（runtime.js L1261），但无解析逻辑
- cell_connection 无实现
- 函数执行使用同步 `new Function('ctx', code)`（worker_engine_v0.mjs L83），无超时保护
- PIN→函数触发通过 trigger_funcs 间接机制（runtime.js L982-1032）

设计文档 §4 定义了 CELL_CONNECT 格式，§6 定义了 AsyncFunction 执行模型。

**关键设计决策**：CELL_CONNECT 和 cell_connection 在设计文档中定义为 **label type**（t 字段），不是 label key。现有 `_applyBuiltins` 的 connectKeys 检查基于 label.k，新的解析逻辑需要基于 label.t 新增调度路径。

## 3. Invariants (Must Not Change)
- 现有 PIN_IN/PIN_OUT 机制保持不变（本迭代为增量新增，不删除旧代码）
- 现有 trigger_funcs 机制保持不变
- ModelTable 数据结构（Cell/Label/Model）不变
- MQTT 订阅/发布机制不变
- mt.v0 patch 格式不变
- `worker_engine_v0.mjs` 的 `executeFunction` 保持同步（不改动现有 tick() 循环）

## 4. Scope

### 4.1 In Scope
1. **CELL_CONNECT 解析器**：
   - 在 `_applyBuiltins` 中新增 **基于 label.t** 的调度路径（`label.t === 'CELL_CONNECT'`）
   - 解析 `{ "(prefix, port)": ["(prefix, port)", ...], ... }` 格式
   - 支持 `self` 前缀（Cell 自身 PIN）
   - 支持 `func` 前缀（函数端口，`funcname:in`/`funcname:out`）
   - 支持数字 ID 前缀（解析但不路由，路由逻辑在 0142 实现）
   - 输入格式校验和错误处理（解析失败记录 eventLog 错误，不中断）
   - init 时建立内存连接图（两级 Map）

2. **CELL_CONNECT 运行时传播**：
   - `_propagateCellConnect(modelId, p, r, c, prefix, port, value, visited?)`
   - **循环检测**：传入 visited Set，防止无限递归
   - 调用入口点：
     - PIN_IN 写入有 CELL_CONNECT 的 Cell 时（label.t === 'IN'）
     - `_executeFuncViaCellConnect` 完成后（func:out 传播）
   - `self` 目标 → 写入 Cell PIN label → 触发 cell_connection 路由
   - `func` 目标 → `:in` 执行函数 / `:out` 继续传播
   - 数字 ID 前缀 → 0142 实现路由（本迭代返回 `Promise.resolve()`）
   - 多目标使用 `Promise.all` 并发执行

3. **cell_connection 路由器**：
   - 在 `_applyBuiltins` 中新增 **基于 label.t** 的调度路径（`label.t === 'cell_connection'`）
   - 解析 `[{"from": [p,r,c,k], "to": [[p,r,c,k], ...]}, ...]` 格式
   - label 位置：各 Model 的 (0,0,0)（位置限制），其他位置记录错误
   - init 时建立路由 Map
   - `_routeViaCellConnection` 被写入时查路由表转发

4. **AsyncFunction 执行引擎（CELL_CONNECT 专用路径）**：
   - 新增 `_executeFuncViaCellConnect(modelId, p, r, c, funcName, inputValue)` 在 runtime.js 中
   - 使用 `new AsyncFunction('ctx', 'label', code)` + Promise.race 超时保护（30s）
   - 错误自动捕获并写入 Cell 的错误 label
   - **不改动** `worker_engine_v0.mjs` 的 `executeFunction`（保持同步 tick() 循环不变）
   - **路径隔离**：`_executeFuncViaCellConnect` 仅由 CELL_CONNECT 的 `func` 前缀触发；现有 trigger_funcs 路径走 `_applyMailboxTriggers` → `run_func` → `executeFunction`（同步）。两条路径在 0143 删除前完全独立，不存在同一函数名的执行方式歧义（触发机制不同）

5. **验证脚本 + 回归测试**

6. **Living Docs 评估**：
   - `docs/ssot/runtime_semantics_modeltable_driven.md` — 新增 CELL_CONNECT 和 cell_connection 运行时语义章节
   - `docs/user-guide/modeltable_user_guide.md` — 新增 CELL_CONNECT 用法说明
   - `docs/handover/dam-worker-guide.md` — 验证与实现一致

### 4.2 Out of Scope
- BUS_IN/BUS_OUT（→ 0142）
- MODEL_IN/MODEL_OUT 和 subModel（→ 0142）
- CELL_CONNECT 数字 ID 前缀的路由逻辑（→ 0142，本迭代仅实现解析）
- 删除 pinInBindings/trigger_funcs（→ 0143）
- system_models.json 迁移（→ 0143）
- 修改 worker_engine_v0.mjs 的 executeFunction 或 tick() 同步循环

## 5. Success Criteria
- CELL_CONNECT label（t='CELL_CONNECT'）被 addLabel 后，运行时建立正确的内存连接图
- cell_connection label（t='cell_connection'）被 addLabel 后，运行时建立正确的路由表
- 函数通过 CELL_CONNECT 的 func 前缀正确触发和传播
- _propagateCellConnect 的循环连接被检测并安全跳过（不崩溃）
- AsyncFunction 超时保护生效（30s 后 reject）
- 并发多目标通过 Promise.all 正确执行
- 格式错误的 CELL_CONNECT 值被安全忽略并记录错误
- 验证脚本全部 PASS
- 现有 Model 100 E2E 不受影响（旧机制不变，tick() 循环不变）

## 6. Risks
- CELL_CONNECT 解析性能：大量连接可能导致 init 变慢 → 可接受，init 只执行一次
- AsyncFunction 与现有同步函数兼容：现有函数代码不含 await → 同步代码在 async 中正常运行
- 命名冲突：`self`/`func` 只在 CELL_CONNECT.v 内解析，不影响其他 label
- label.t 调度与现有 label.k connectKeys 共存：新增路径独立于旧路径，不冲突
