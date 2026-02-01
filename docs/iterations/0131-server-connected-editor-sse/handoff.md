# Handoff（Compact）：0131-server-connected-editor-sse

- Date: 2026-01-31
- Scope: server-connected ModelTable editor demo（SSE + HTTP mailbox）+ datatable 交互扩展

## 当前状态（可用行为）

- Server 持有真值（`ModelTableRuntime`），消费 editor mailbox event（`POST /ui_event`），并且保证把 `ui_event` 清空回 `null`。
- Server 产出 derived UI（`ui_ast_v0`）并通过 SSE 推送 snapshot（`GET /stream`, `event: snapshot`）。
- Frontend 在 remote mode 下是纯 renderer：订阅 SSE snapshot、渲染 `ui_ast_v0`、用 HTTP 上送 mailbox envelope。

## 如何运行

1) 启动 server（同源提供静态前端 + API）：

```bash
node packages/ui-model-demo-server/server.mjs
```

2) 打开：

- `http://127.0.0.1:9000/`

备注：
- 默认 `PORT=9000`（可用环境变量 `PORT` 覆盖）。
- 默认不启用 CORS；如果前端来自不同 origin，需要在 server 侧设置 `CORS_ORIGIN`。

## Datatable（Table-v2-like：用 Element Plus ElTable 实现）

目标：用表格把 label 浏览/复现/调试变得可用，避免巨大 `<pre>` 导致滚动与性能问题。

- Filters（editor_state, model -2）：
  - `dt_filter_model_query`（string，按 model id/name 模糊匹配）
  - `dt_filter_p` / `dt_filter_r` / `dt_filter_c`（string/int-like）
- Refresh：
  - Passive：SSE snapshot
  - Active：action `datatable_refresh`（server 返回 snapshot）
  - Pause SSE：`dt_pause_sse`（true 时忽略 SSE snapshot，但仍然会应用 `POST /ui_event` 的响应 snapshot）
- Row actions：
  - `datatable_select_row`：把 row 载入 editor draft（p/r/c/k/t/v）
  - `datatable_view_detail`：打开 Drawer 显示完整 value（写 `dt_detail_*`）
  - `datatable_remove_label`：删除 label

Detail Drawer 状态（editor_state, model -2）：
- `dt_detail_open`（bool）
- `dt_detail_title`（str）
- `dt_detail_text`（str）

## CellA/CellB Demo 按钮

新增两个“可重复、可调试”的按钮，用于最小 CellA/CellB workflow：

- `ADD_CellA` -> server action `cellab_add_cellA`
  - 从 `cellab_payload_json`（editor_state, model -2）读取 payload，并按 JSON parse。
  - JSON 非法会返回错误，但仍会清空 mailbox（避免 UI 锁死）。
- `ADD_CellB` -> server action `cellab_add_cellB`

## 关键修复："Mailbox Stuck" 导致 UI 不可交互

现象：
- 输入框/下拉框看起来“动不了”，datatable 也不再刷新，整体像被锁住。

根因：
- Renderer 把 `ui_event` 视为 single-slot mailbox；如果 `ui_event` 长时间非 null，后续 UI 事件会被阻塞。

修复：
- Server 侧 submit flow 对自定义分支加 `try/catch`，并保证：
  - 异常时写 `ui_event_error`
  - 始终把 `ui_event` 清空回 `null`

## 关键代码文件

- `packages/ui-model-demo-server/server.mjs`
  - Server runtime + endpoints（`/snapshot`, `/stream`, `/ui_event`）
  - Datatable actions + CellA/CellB actions
  - Mailbox 清空兜底
- `packages/ui-model-demo-frontend/src/remote_store.js`
  - SSE + HTTP 传输；`dt_pause_sse` gating；editor_state 的 draft coalescing（降低 per-keystroke 网络写入）
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - UI AST：datatable + filters + row actions + Drawer + CellA/CellB controls
- `packages/ui-renderer/src/renderer.mjs`
  - TableColumn scoped slots（row context）
  - props/binds 内 `$ref` 解析
  - Drawer 节点映射

## 可执行验证（已知 PASS）

```bash
npm -C packages/ui-model-demo-frontend run test
npm -C packages/ui-model-demo-frontend run build
node packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs
```

## 关联文档

- 0131 iteration docs：
  - `docs/iterations/0131-server-connected-editor-sse/plan.md`
  - `docs/iterations/0131-server-connected-editor-sse/resolution.md`
  - `docs/iterations/0131-server-connected-editor-sse/runlog.md`
- CellA/CellB 手动 addLabel 案例（更偏 Stage 4 叙事 / intent_dispatch 引用）：
  - `docs/iterations/0132-dual-bus-contract-harness-v0/manual_addlabel_case_cellA_cellB.md`
