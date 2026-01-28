# Iteration 0131-server-connected-editor-sse Resolution

## 0. Execution Rules
- Work branch: dev_0131-server-connected-editor-sse
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

Preflight (must be PASS before Step 1; no commits):

- Iteration registration exists in `docs/ITERATIONS.md`.
- Intended branch exists / is checked out: `dev_0131-server-connected-editor-sse`.

Executable check (example):

- `node -e "const fs=require('fs'); const ok=/\\| 0131-server-connected-editor-sse \\|/.test(fs.readFileSync('docs/ITERATIONS.md','utf8')); console.log(ok?'PASS: iterations_index':'FAIL: iterations_index'); process.exit(ok?0:1)"`

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Server runtime + mailbox consumer | Host ModelTableRuntime on server; consume editor mailbox events (contract) | `packages/worker-base/**`, `packages/**/server/**` | New smoke script (node) | Can apply event envelope and observe model diff + last_op_id/error updates | Revert Step 1 commit |
| 2 | SSE snapshot stream + GET snapshot | SSE pushes snapshot; GET snapshot for cold start | `packages/**/server/**` | `node ...validate_editor_server_sse.mjs --case stream` | Client observes snapshot advance after POST event | Revert Step 2 commit |
| 3 | Frontend remote host wiring | Renderer unchanged; host uses SSE+HTTP | `packages/ui-model-demo-frontend/src/**` | `npm -C packages/ui-model-demo-frontend run test` (plus new server test) | Demo usable; no mailbox_full thrash (basic) | Revert Step 3 commit |
| 4 | Verification + guards | Add executable server-connected suite; keep existing suites PASS | `scripts/**`, `packages/ui-model-demo-frontend/scripts/**` | Existing suites + new suite | All PASS; no Stage 4+ imports | Revert Step 4 commit |

## 2. Step Details

### Step 1 — Server runtime + mailbox consumer

**Goal**
- 把 “consume mailbox event → update runtime → write derived labels” 放到后端执行。

**Scope**
- 后端持有 `ModelTableRuntime`。
- 消费逻辑必须严格遵守：
  - `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`
  - `docs/iterations/0130-modeltable-editor-v1/contract_typed_values.md`
- 只实现“本地自滑”闭环（不做任何双总线/远端路由）。

**Must NOT touch**
- `docs/architecture_mantanet_and_workers.md`
- Any Matrix/MBR/dual-bus code paths

**Validation (Executable)**
- Add/Run a minimal node script that POSTs a known envelope and asserts server returns updated `ui_event_last_op_id`.

**Rollback Strategy**
- Revert Step 1 commit.

---

### Step 2 — SSE snapshot stream + GET snapshot

**Goal**
- 提供稳定的“投影流”：SSE 推送 snapshot；HTTP 提供冷启动 snapshot。

**Scope**
- `GET /snapshot`: return current snapshot.
- `GET /stream` (SSE): on connect send one `snapshot`; after each consume send another `snapshot`.
- Snapshot 内容至少包含 editor mailbox model 的 `ui_ast_v0`、`ui_event_error`、`ui_event_last_op_id`、`event_log`。

**Validation (Executable)**
- 新增 server-connected 验证脚本：订阅 SSE，发送 POST event，断言收到更新的 snapshot。

**Rollback Strategy**
- Revert Step 2 commit.

---

### Step 3 — Frontend remote host wiring

**Goal**
- 前端只保留渲染与事件上送；真值在后端。

**Scope**
- `packages/ui-renderer/src/renderer.js` 不改。
- demo 前端新增 remote host/store：
  - `getSnapshot()` 从 SSE 缓存读取
  - `dispatchAddLabel(label)` POST `label.v` (envelope) 到 server
  - `dispatchRmLabel(...)` 仅用于与 renderer host 适配（不改变 contract 语义）
- 高频输入默认 blur/enter 提交（避免 single-slot 导致 UI 被覆盖）。

**Validation (Executable)**
- demo 现有用例仍 PASS；新增用例覆盖 server-connected 交互。

**Rollback Strategy**
- Revert Step 3 commit.

---

### Step 4 — Verification + guards

**Goal**
- 确保 server-connected 也能脚本化验收，且不引入 Stage 4+。

**Validation (Executable)**
- Existing:
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `node scripts/validate_ui_renderer_v0.mjs --case editor --env jsdom`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `node scripts/validate_iteration_guard.mjs --case forbidden_imports`
  - `node scripts/validate_iteration_guard.mjs --case stage4`
- New:
  - `node packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs`

**Rollback Strategy**
- Revert Step 4 commit.

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
