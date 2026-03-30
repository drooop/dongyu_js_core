---
title: "0151 — Server 去 Model 100 特判 + MOCK_SLIDING_APPS 外移"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0151-server-model100-decouple
id: 0151-server-model100-decouple
phase: phase1
---

# 0151 — Server 去 Model 100 特判 + MOCK_SLIDING_APPS 外移

## 0. Metadata
- ID: 0151-server-model100-decouple
- Date: 2026-02-21
- Owner: AI (User Approved)
- Branch: dev_0151-server-model100-decouple
- Related:
  - `CLAUDE.md` (CAPABILITY_TIERS, fill-table-first)
  - `docs/ssot/fill_table_only_mode.md`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/`

## 1. Goal
从 `server.mjs` 中删除所有 Model 100 特判逻辑和内嵌样例数据，改为模型函数（submit guard）和 JSON patch（应用定义），使 server 不再包含 model-specific 业务分支。

## 2. Background
当前 `server.mjs` 有两类违反 fill-table-first 原则的代码：

**A. Model 100 Submit 特判**
- `isModel100SubmitPayload()` (L378)：硬编码判断 model_id===100, p=0,r=0,c=2 的 submit action。
- `setModel100SubmitState()` (L389)：硬编码写 Model 100 的 submit_inflight/status 标签。
- `submitEnvelope()` 内 Model 100 分支 (L2036-2058)：单飞检查、超时清理、状态机控制。
- `sanitizeStartupCatalogState()` 内 Model 100 初始化 (L1490-1498)：硬编码重置 submit_inflight 等标签。

**B. MOCK_SLIDING_APPS 常量**
- L1265-1370：内嵌 Model 100/1001/1002 的完整 schema + data 定义。
- `SEED_POSITIVE_MODELS_ON_BOOT` 开关控制是否在启动时注入这些模型。

用户决策：submit guard 采用方案 a（状态存 ModelTable label，可观测/可序列化/SSOT）。

## 3. Invariants (Must Not Change)
- 运行时解释器行为不变：不改 `packages/worker-base/src/runtime.js`。
- 对外 MQTT/Matrix 消息格式不变。
- Model 100 E2E 功能（submit → 颜色生成 → 返回）行为等价。
- 并发 submit 仍保持单飞（inflight guard），超时后自动恢复。
- 非 Model 100 的 submit 通道不受影响。

## 4. Scope

### 4.1 In Scope

**A. Submit guard 模型化**
- 在 Model 100 (或 Model -10) 上新增 `submit_guard` 函数 label，实现：
  - 读取 `submit_inflight` label (model_id=100, p=0,r=0,c=0)
  - 如果 inflight=true 且未超时 → 写 ui_event_error (code=busy)，清 mailbox，return
  - 如果 inflight=true 且超时 → 重置 inflight=false, status=ready
  - 如果 inflight=false → 设置 inflight=true, status=loading，继续
- 触发方式：由 `processEventsSnapshot` 中检测到 Model 100 cell(0,0,2) 上的 ui_event add_label 事件时，通过 intercept 机制触发（复用 forward_model100_events 之前的路径，或在 forward_model100_events 函数头部自行判断）。
- 从 `submitEnvelope()` 中删除 `isModel100Submit` 整个分支（L2036-2058），让所有 envelope 走统一的 mailbox → programEngine.tick() 通道。

**B. MOCK_SLIDING_APPS → JSON patch**
- 新增 `packages/worker-base/system-models/workspace_demo_apps.json`（mt.v0 patch），包含 Model 1001/1002 的 schema + data。
- Model 100 的 schema 已有 `test_model_100_ui.json`，不重复；仅需确认 workspace 属性（app_name 等）已覆盖。
- 删除 `MOCK_SLIDING_APPS` 常量。
- 删除 `SEED_POSITIVE_MODELS_ON_BOOT` 环境变量及相关逻辑。
- Server 启动时统一通过 patch 加载（与现有 system-models import 路径合并）。

**C. sanitizeStartupCatalogState 清理**
- 移除 L1490-1498 中 model_id=100 的硬编码初始化。
- 这些初始值改为在 Model 100 patch（`test_model_100_ui.json`）中声明。

**D. 删除 server.mjs 中的辅助函数**
- `isModel100SubmitPayload()` — 删除。
- `setModel100SubmitState()` — 删除。
- `MODEL100_SUBMIT_INFLIGHT_TIMEOUT_MS` 常量 — 移入模型函数内（或作为 config label）。

### 4.2 Out of Scope
- action 分支改造（docs_/static_/ws_）→ 迭代 0152。
- forward_ui_events 硬编码触发改造 → 迭代 0152。
- Snapshot 过滤规则模型化 → 迭代 0152。
- runtime.js 任何改动。

## 5. Success Criteria
1. `rg -n "isModel100SubmitPayload\|setModel100SubmitState\|MOCK_SLIDING_APPS\|SEED_POSITIVE_MODELS_ON_BOOT" packages/ui-model-demo-server/server.mjs` → 0 命中。
2. `rg -n "model_id === 100\|model_id===100" packages/ui-model-demo-server/server.mjs` → 0 命中（排除注释/日志）。
3. Model 100 submit 并发点击仍保持单飞（submit_inflight guard 工作）。
4. Model 100 submit 超时后自动恢复（inflight=false, status=ready）。
5. Workspace 应用列表启动后正确展示（包含 Model 100/1001/1002），来源为 patch 而非 server 常量。
6. 基线测试全 PASS：`ensure_runtime_baseline.sh` + `check_runtime_baseline.sh`。
7. 核心单元测试 PASS：`test_cell_connect_parse.mjs`, `test_bus_in_out.mjs`, `validate_builtins_v0.mjs`。

## 6. Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| submit guard 函数时序与 server 硬编码不一致 | submit 可能漏判或误判 inflight | 用 E2E burst click 验证，对比前后行为 |
| MOCK_SLIDING_APPS 删除后 workspace 空 | 无应用可见 | 确保 patch 在 server 启动 init 阶段加载 |
| Model 100 初始状态丢失 | submit_inflight 启动时为 undefined | 在 patch 中显式声明初始值 |
