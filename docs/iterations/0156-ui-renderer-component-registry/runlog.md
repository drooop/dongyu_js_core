---
title: "Iteration 0156-ui-renderer-component-registry Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0156-ui-renderer-component-registry
id: 0156-ui-renderer-component-registry
phase: phase3
---

# Iteration 0156-ui-renderer-component-registry Runlog

## Environment

- Date: 2026-03-03
- Branch: `dev_0156-ui-renderer-component-registry`
- Mode: phase3 execution

## Review Gate Record

### Record 1

- Iteration ID: 0156-ui-renderer-component-registry
- Review Date: 2026-03-03
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 执行方向确认：完整两层化 + 一次切换 + Host 执行上传原语。
  - `node.type` 全部由 registry 管理。
  - upload 默认写 `mxc://`。

## Execution Records

### Step 1 — Iteration Gate

- Status: PASS
- Notes:
  - 创建 `plan.md` / `resolution.md` / `runlog.md`。
  - 分支已切换至 `dev_0156-ui-renderer-component-registry`。

### Step 2+ — Implementation

- Status: In Progress
- Commands / key outputs / PASS-FAIL evidence will be appended below.

### Step 2 — TDD RED（新增失败用例）

- Commands:
  - `node scripts/validate_ui_renderer_v0.mjs --case registry_upload --env jsdom`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
- Key output:
  - `FAIL: registry_upload:file_onChange_missing`
  - `ast.children[0]:type_invalid`（新增 `registry_icon_node` positive case 触发）
- Result: PASS（按 TDD 预期先失败）

### Step 3 — Renderer registry-first + upload_media

- Changed:
  - `packages/ui-renderer/src/component_registry_v1.json`
  - `packages/ui-renderer/src/component_registry_v1.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
- Key points:
  - `createRenderer({ registry })` 支持 registry 注入，默认加载 `component_registry_v1`。
  - renderTree/renderVNode 入口按 registry 校验 type；未知 type 直接报错。
  - 删除 `directUpload` / `window.__dyPendingFiles` 路径。
  - `FileInput` 改为调用 `host.uploadMedia`，成功后写 mailbox event。

### Step 4 — AST validator 动态 type

- Changed:
  - `scripts/validate_ui_ast_v0x.mjs`（`NODE_TYPES` 改为读取 registry）
  - `scripts/fixtures/ui_ast_v0x/positive/registry_icon_node.json`
- Result: PASS

### Step 5 — Static 上传链路切换到 mxc

- Frontend:
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
- Server/system-models:
  - `packages/ui-model-demo-server/auth.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/intent_handlers_static.json`
- Key points:
  - static 页面移除 directUpload props，改为 mailbox `static_project_upload`。
  - 新增 `/api/media/upload`，使用当前登录会话的 Matrix token 上传，返回 `mxc://`。
  - 删除 `/api/static/upload` 路由。
  - `handle_static_project_upload` 改为读取 `static_media_uri` 并调用 `staticUploadProjectFromMxc`。

### Step 6 — Verification

- Commands:
  - `node --check packages/ui-renderer/src/renderer.js`
  - `node --check packages/ui-renderer/src/renderer.mjs`
  - `node --check packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `node --check packages/ui-model-demo-frontend/src/remote_store.js`
  - `node --check packages/ui-model-demo-frontend/src/demo_app.js`
  - `node --check packages/ui-model-demo-server/auth.mjs`
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `node scripts/validate_ui_renderer_v0.mjs --case all --env jsdom`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - `validate_ui_renderer_v0`: all PASS（含 `registry_upload: PASS`）
  - `validate_ui_ast_v0x`: all PASS（含 `registry_icon_node: PASS`）
  - `frontend build`: PASS
- Known baseline issue:
  - `npm -C packages/ui-model-demo-frontend run test` -> `FAIL: editor_v1_pin_page_missing`（既有失败，非本迭代引入）

### Step 7 — Final Regression Re-run（收尾复验）

- Commands:
  - `node --check packages/ui-renderer/src/renderer.js`
  - `node --check packages/ui-renderer/src/renderer.mjs`
  - `node --check packages/ui-model-demo-server/auth.mjs`
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `node scripts/validate_ui_renderer_v0.mjs --case all --env jsdom`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `node scripts/validate_iteration_guard.mjs --case forbidden_imports`
- Key output:
  - PASS:
    - `node --check`（renderer/server/auth）全部通过
    - `validate_ui_renderer_v0 --case all --env jsdom` 全部 PASS（含 `registry_upload`）
    - `validate_ui_ast_v0x --case all` 全部 PASS
    - `frontend build` PASS（仅 chunk size warning）
  - FAIL（已知）:
    - `npm -C packages/ui-model-demo-frontend run test` -> `FAIL: editor_v1_pin_page_missing`
    - `validate_iteration_guard --case forbidden_imports` -> `FAIL: ...server.mjs:matrix`
- Conclusion:
  - 本迭代目标内改造完成，关键链路验证通过。
  - 保留 2 个非本次功能回归阻断项，作为基线问题记录。
