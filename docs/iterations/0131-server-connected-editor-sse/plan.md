# Iteration 0131-server-connected-editor-sse Plan

## 0. Metadata
- ID: 0131-server-connected-editor-sse
- Date: 2026-01-28
- Owner: Sisyphus (OpenCode)
- Branch: dev_0131-server-connected-editor-sse
- Related:
  - `docs/architecture_mantanet_and_workers.md` (SSOT)
  - `docs/charters/dongyu_app_next_runtime.md` (Charter)
  - `docs/roadmaps/modeltable-editor-v1.md` (Stage 3.x constraints)
  - `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md` (mailbox contract, frozen)
  - `docs/iterations/0130-modeltable-editor-v1/contract_typed_values.md` (typed value normalization, additive)
  - `packages/ui-renderer/` (Vue3 + Element Plus renderer)
  - `packages/worker-base/` (ModelTableRuntime)
  - `packages/ui-model-demo-frontend/` (current local-only demo baseline)

## 1. Goal
把 0130 的“纯前端本地自滑（LocalBusAdapter + in-memory runtime）”升级为“后端自滑 + 前端纯渲染”的可运行 demo：

- 后端持有 `ModelTableRuntime` 真值，并消费 editor mailbox event（0129/0130 contract）。
- 后端生成/维护 derived UI：`ui_ast_v0` / `snapshot_json` / `event_log`（仍写回 ModelTable）。
- 前端仅保留 UI AST 渲染能力（Vue3 + Element Plus via `packages/ui-renderer`）。
- 单通道拆分为：
  - SSE：后端 → 前端推送 `snapshot`（含 `ui_ast_v0`）
  - HTTP POST：前端 → 后端提交 mailbox envelope（`ui_event`）

## 2. Background

- Stage 3.x 的不变量：UI 是投影；UI 事件归一为“写格子”（mailbox）；不得引入双总线/远端滑动（Stage 4+）。
- 0129/0130 已将 editor mailbox event contract 做成“可回归、可审计”的硬契约（single-slot、op_id replay、error priority、reserved/forbidden guard）。
- 本迭代只把“事件消费者 + 真值运行时 + derived UI”迁移到后端，以便后续：持久化、协作、工作区隔离、以及远端滑动（Stage 4+）有明确接入点。

## 3. Invariants (Must Not Change)

- ModelTable 为唯一真值源；前端不得持有真值态绕开 ModelTable。
- UI 事件必须归一为“写 event mailbox”语义；UI 不得直接发 MQTT/Matrix 等总线消息。
- mailbox contract 冻结：不得改写 `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`。
- typed value normalization 仅为附加（0130），不得回写/破坏 0129 的 v0 contract 与验证用例。
- 本迭代不实现 Stage 4+：Matrix/MBR/双总线/远端滑动/Element Call/E2EE/打包。
- 本迭代不引入新 built-in k / trigger / PIN 语义。

## 4. Scope

### 4.1 In Scope

- 后端自滑闭环（本地自滑，非远端）：
  - 接收 mailbox envelope（HTTP POST），写入 mailbox cell（语义等价于 UI 写 `ui_event` label）
  - 消费 mailbox（contract 校验 + apply）
  - 回写 `ui_event_last_op_id` / `ui_event_error`，并清空 `ui_event`
  - 更新 derived UI：`ui_ast_v0` / `snapshot_json` / `event_log`
- SSE 推送：
  - `GET /stream` 连接建立即推一次全量 snapshot
  - 每次消费事件后推一次全量 snapshot（先不做 diff）
- 前端 remote host：
  - 通过 SSE 更新 `snapshot` 缓存
  - `dispatchAddLabel` 通过 HTTP POST 提交 envelope
  - 保持 `packages/ui-renderer/src/renderer.js` 不改（只换 host 实现）
- 交互体验兜底（不改变真值边界）：
  - 对高频输入不做“每键提交真值”；允许前端持有短暂 draft（不写 ModelTable），在 blur/enter 提交 mailbox event。

### 4.2 Out of Scope

- 远端滑动与双总线转发（Matrix ↔ MBR ↔ MQTT）。
- 持久化（sqlite/文件/云存储）。
- 多客户端并发编辑仲裁、冲突合并。
- UI AST 规范重写（沿用现有 spec/validator）。

## 5. Success Criteria (Definition of Done)

- 现有 suite 继续 PASS（不回归 0129/0130/renderer 资产）：
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `node scripts/validate_ui_renderer_v0.mjs --case editor --env jsdom`
  - `npm -C packages/ui-model-demo-frontend run test`
- 新增 server-connected 可执行验证：
  - 通过 HTTP 发送 editor mailbox envelope，后端消费后通过 SSE/GET snapshot 可观测到：
    - `ui_event_last_op_id` 更新
    - `ui_event_error` 错误码与优先级保持（含 typed normalization 的错误码）
    - `ui_ast_v0` 存在且可被 renderer 渲染
- Stage guard 继续 PASS（不得引入 Stage 4+ 代码路径）。

## 6. Risks & Mitigations

- Risk: single-slot mailbox + 网络延迟导致 UI 频繁 `mailbox_full`。
  - Mitigation: 前端严格等待 ack（last_op_id 变化）后再允许下一次提交；输入框采用 blur/enter 提交。
- Risk: server 与 client 对 envelope shape/typed normalization 解释不一致。
  - Mitigation: 直接复用 0129/0130 的 contract + 同一套验证脚本断言。
- Risk: 误把“单通道”当控制总线，偷渡 MQTT/Matrix 语义。
  - Mitigation: 代码与 guard 明确禁止；计划与验证写死“不引入双总线/远端滑动”。

## 7. Open Questions

- SSE 推送粒度：全量 snapshot vs diff（本迭代先全量）。
- server 运行时实例生命周期：单实例 vs per-session（本迭代先单实例，便于验证）。

## 8. Compliance Checklists

### 8.1 SSOT Alignment Checklist
- `docs/architecture_mantanet_and_workers.md`：UI 是投影；UI 事件可追踪到 Cell；管理/控制总线语义区分。

### 8.2 Charter Compliance Checklist
- `docs/charters/dongyu_app_next_runtime.md`：UI 不执行逻辑；UI 不得直接发总线消息；第一阶段仅控制总线（MQTT + PIN）。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
