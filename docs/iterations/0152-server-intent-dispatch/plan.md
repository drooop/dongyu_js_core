---
title: "0152 — Server 通用 Intent Dispatch + Forward 触发映射模型化"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0152-server-intent-dispatch
id: 0152-server-intent-dispatch
phase: phase1
---

# 0152 — Server 通用 Intent Dispatch + Forward 触发映射模型化

## 0. Metadata
- ID: 0152-server-intent-dispatch
- Date: 2026-02-21
- Owner: AI (User Approved)
- Branch: dev_0152-server-intent-dispatch
- Depends on: 0151-server-model100-decouple (must be completed first)
- Related:
  - `CLAUDE.md` (CAPABILITY_TIERS, fill-table-first)
  - `docs/ssot/fill_table_only_mode.md`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/`

## 1. Goal
将 `server.mjs` 中基于 action prefix 的业务分支（`docs_*`、`static_*`、`ws_*`）替换为通用 intent dispatch 机制，并将 `processEventsSnapshot` 中硬编码的 `forward_ui_events` 触发路径改为模型声明的触发映射。完成后，新增业务 action 不需要修改 server 代码，只需添加模型函数。

## 2. Background
迭代 0151 消除了 Model 100 特判，但 server.mjs 仍有两处"应用层逻辑泄漏到服务层"：

**A. Action 分支 (L2070+)**
`submitEnvelope()` 中按 action prefix 分派到不同处理逻辑：
- `docs_*`：文档树浏览、搜索、打开（L2101-2153）
- `static_*`：静态站点管理、上传、删除（L2155-2230+）
- `ws_*`：workspace 应用管理（增删改查）

这些逻辑本质上是"收到 intent → 执行 action → 写结果到 ModelTable"，完全可以由模型函数实现。

**B. Forward 触发硬编码 (L946-958)**
`processEventsSnapshot()` 中检测 Model -1 (EDITOR_MODEL_ID) cell(0,0,1) 上的 `ui_event` 变化后，硬编码查找 `forward_ui_events` 函数名并触发。新增转发函数必须改 server 代码，违反 fill-table-first。

## 3. Invariants (Must Not Change)
- 运行时解释器行为不变：不改 `packages/worker-base/src/runtime.js`。
- 对外 MQTT/Matrix 消息格式不变。
- 现有 docs_/static_/ws_ 功能行为等价（用户操作体验不变）。
- submit guard（0151 实现）不受影响。

## 4. Scope

### 4.1 In Scope

**A. 通用 intent dispatch 机制**
- 设计 `intent_dispatch` label schema：模型上声明 action→函数的映射表。
  例如在 Model -10 上：
  ```json
  { "k": "intent_dispatch_table", "t": "json", "v": {
    "docs_refresh_tree": "handle_docs_refresh_tree",
    "docs_search": "handle_docs_search",
    "docs_open_doc": "handle_docs_open_doc",
    "static_project_list": "handle_static_project_list",
    "static_project_upload": "handle_static_project_upload",
    "static_project_delete": "handle_static_project_delete",
    "ws_app_add": "handle_ws_app_add",
    "ws_app_delete": "handle_ws_app_delete",
    "ws_app_select": "handle_ws_app_select"
  }}
  ```
- Server 的 `submitEnvelope()` 替换 `action.startsWith(...)` 分支为：
  1. 从 Model -10 读取 `intent_dispatch_table`
  2. 查表得到目标函数名
  3. 通过 intercept 机制触发该函数
  4. 如果未命中 → 走通用 mailbox 通道（现有默认行为）

**B. Action handler 函数化**
- 将 docs_/static_/ws_ 的每个 action handler 转为 Model -10 上的 function label。
- 函数通过 `ctx` 访问 runtime、filesystem（需评估 ctx 是否需要扩展 fs 能力）。
- 注意：docs/static 操作涉及文件系统读写。需要评估两种方案：
  - 方案 1：ctx 扩展 fs API（server 提供沙盒化的 fs helper 注入 ctx）
  - 方案 2：保留 server 侧的 fs 操作作为"host capability"，模型函数只负责路由决策

**C. Forward 触发映射模型化**
- 在 Model -1 (或 Model -10) 上声明 `event_trigger_map` label：
  ```json
  { "k": "event_trigger_map", "t": "json", "v": {
    "ui_event": ["forward_ui_events"]
  }}
  ```
- `processEventsSnapshot()` 中的硬编码 `forward_ui_events` 查找改为：
  1. 读取 `event_trigger_map`
  2. 按事件类型（label.k）查表得到目标函数列表
  3. 依次触发

**D. 中优先级项**
- Snapshot 过滤规则（`INTERNAL_LABEL_TYPES` / `EXCLUDED_LABEL_KEYS`）→ 改为从 Model 0 config label 读取。
- Workspace registry 默认选择策略（"优先 Model 100"）→ 改为从 config label 读取。

### 4.2 Out of Scope
- runtime.js 任何改动。
- 新增 label type（本迭代用现有 function/json type）。
- K8s 部署变更（本迭代不涉及 worker 改动）。

## 5. Success Criteria
1. `rg -n "action.startsWith.*docs_\|action.startsWith.*static_\|action.startsWith.*ws_" packages/ui-model-demo-server/server.mjs` → 0 命中。
2. `rg -n "forward_ui_events" packages/ui-model-demo-server/server.mjs` → 0 命中（仅模型 patch 中存在）。
3. 新增一个测试 action（如 `test_echo`）只需添加 dispatch table entry + function label，不改 server 代码 → PASS。
4. 现有 docs 浏览/搜索功能 → 行为不变。
5. 现有 static 上传/列表/删除功能 → 行为不变。
6. 现有 workspace 增删选功能 → 行为不变。
7. 基线测试全 PASS。

## 6. Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| ctx 缺少 fs 能力，docs/static handler 无法模型化 | 部分 action 仍需 server 特殊处理 | 评估后选择方案 1 或 2，声明 host capability 边界 |
| dispatch table 查找增加延迟 | 每次 submit 多一次 label 读取 | 单次 label 读取 <1ms，可忽略 |
| event_trigger_map 声明错误导致事件丢失 | forward 中断 | 保留 fallback：map 为空时按原逻辑处理 |
| action handler 函数化后调试困难 | 排障变慢 | 函数内保留 console.log 关键点，利用 eventLog |

## 7. Review Gate Decisions (Phase 2)
1. **ctx.fs 扩展 vs host capability**：采用 **host capability** 方案。
   - server 提供 `ctx.hostApi.*`（受限能力）；
   - 模型函数只负责调度与状态回写，不直接访问 fs。
2. **执行节奏**：采用 **渐进式**。
   - 先落 Step 1-4（dispatch table + trigger map）；
   - 再迁移 Step 5-7（docs/static/ws handlers）。
