# Handoff: ModelTable Editor v1 (0130)

本文件沉淀 0130 迭代的“可复用知识”，用于下一步做前后端连接版 demo。

## 1. 当前形态（纯前端）

- 入口：`packages/ui-model-demo-frontend`
- Runtime：浏览器内 `ModelTableRuntime`（内存态，无持久化）
- UI AST：由 `buildEditorAstV1(snapshot)` 生成并写入 `model_id=99` 的 `ui_ast_v0`
- 消费方式：UI 写 mailbox → 本地 `LocalBusAdapter` 消费 → runtime 更新 → snapshot/派生 UI 更新

## 2. 核心契约（必须保持）

- Mailbox 位置与事件信封形状见 `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`
- 0130 仅新增 typed value 归一化，见 `docs/iterations/0130-modeltable-editor-v1/contract_typed_values.md`
- UI 只能写 mailbox（`model_id=99`, `Cell(0,0,1)`, `k=ui_event`, `t=event`）
- 错误优先级、reserved_cell/forbidden_k/forbidden_t 规则保持不变

## 3. 编辑器状态模型

- `model_id=99`: editor_mailbox
- `model_id=98`: editor_state（用于 UI 控件状态与草稿）
  - `selected_model_id`, `draft_p/r/c`, `draft_k`, `draft_t`
  - `draft_v_text`, `draft_v_int`, `draft_v_bool`

## 4. 关键实现点

- UI 事件封装与 mailbox 写入：`packages/ui-renderer/src/renderer.js`
- v1 typed normalization：`packages/ui-model-demo-frontend/src/local_bus_adapter.js`
- v1 UI AST 生成：`packages/ui-model-demo-frontend/src/demo_modeltable.js`
- UI AST 重新计算依赖 snapshot（避免“创建成功但仍显示 missing”）：
  - `packages/ui-model-demo-frontend/src/demo_app.js`

## 5. 本地 demo 运行方式

```bash
npm -C packages/ui-model-demo-frontend install
npm -C packages/ui-model-demo-frontend run dev
```

访问 `http://127.0.0.1:5173`。

## 6. 常见现象与原因

- “Selected model X missing. Create it first.”
  - 模型未创建，或 UI AST 未随 snapshot 更新（已修复）
- 输入“看似失效”
  - UI 是受控组件，事件未消费/被拒绝时会被 snapshot 覆盖
- `duplicate_id`
  - 重复点击创建相同 id 的 model

## 7. 面向前后端连接版的接入建议

目标：把 runtime/adapter 放到 server，前端只做渲染 + 事件发送。

### 7.1 后端职责

- 持有 `ModelTableRuntime` 与 `LocalBusAdapter`（v1 模式）
- 消费 mailbox 事件，更新 runtime
- 生成并维护派生 UI：`ui_ast_v0` / `snapshot_json` / `event_log`
- 提供持久化（下一步迭代重点）

### 7.2 前端改造要点

- `createDemoStore` 改为“远程 store”
  - `dispatchAddLabel`：POST mailbox event → 后端消费 → 返回最新 snapshot
  - `dispatchRmLabel`：仅用于清理 mailbox（保留 contract）
- `getUiAst`：从 snapshot 的 `ui_ast_v0` 读取
- `consumeOnce`：由后端处理，前端不再本地调用

### 7.3 推荐 API 形态（示例）

- `POST /ui_event`
  - body：`{ label: { p,r,c,k,t,v } }`（或直接传 event envelope）
  - response：`{ snapshot, ui_event_error, ui_event_last_op_id }`
- `GET /snapshot`
  - 用于冷启动或轮询/订阅

## 8. 验证策略延用

- 继续使用既有脚本断言（`validate_ui_ast_v0x` / `validate_ui_renderer_v0` / `validate_editor`）
- 后端接入后，增加一组“API 驱动”的 smoke 验证，确保 mailbox contract 不变

## 9. 关键文件索引

- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
- `packages/ui-model-demo-frontend/src/demo_app.js`
- `packages/ui-renderer/src/renderer.js`
- `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`
- `docs/iterations/0130-modeltable-editor-v1/contract_typed_values.md`
