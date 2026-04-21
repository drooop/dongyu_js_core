---
title: "0152 — Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0152-server-intent-dispatch
id: 0152-server-intent-dispatch
phase: phase3
---

# 0152 — Runlog

> Flight recorder. Commands, output, commits, PASS/FAIL.
> Do not edit [[iterations/0152-server-intent-dispatch/plan]] or [[iterations/0152-server-intent-dispatch/resolution]] from here; only append facts.

---

## Review Gate Record
- Iteration ID: 0152-server-intent-dispatch
- Review Date: 2026-02-21
- Review Type: User + AI
- Review Index: 1
- Decision: Approved
- Notes:
  - Open question 已裁决：docs/static 的文件系统操作采用 `ctx.hostApi`（host capability）方案。
  - 执行节奏采用渐进式：Step 1-4（dispatch/trigger）先落地，再做 Step 5-7（handlers 迁移）。
  - Phase 3 执行前置条件：0151 必须 Completed。

---

(awaiting 0151 completion)

---

## Phase 3 Start
- Date: 2026-02-22
- Branch:
  - `git switch -c dev_0152-server-intent-dispatch`
  - result: switched to new branch `dev_0152-server-intent-dispatch`
- Index status:
  - `docs/ITERATIONS.md` updated: 0152 `Planned` → `In Progress`

---

## Step 1+2 — intent_dispatch_table + event_trigger_map schema
- Date: 2026-02-22
- Files:
  - `packages/worker-base/system-models/intent_dispatch_config.json` (new)
- Added labels (Model -10, cell 0,0,0):
  - `intent_dispatch_table` (json)
  - `event_trigger_map` (json)
- Syntax checks:
  - `node --check packages/ui-model-demo-server/server.mjs` → PASS (exit 0)
  - `jq -r '.op_id, (.records[]|.k)' packages/worker-base/system-models/intent_dispatch_config.json`
    - `intent_dispatch_config_v0`
    - `intent_dispatch_table`
    - `event_trigger_map`
- Runtime validation (server boot + snapshot):
  - command sequence:
    - `MODELTABLE_PATCH_JSON=... PORT=9032 DY_AUTH=0 WORKER_BASE_WORKSPACE=step14_recheck bun packages/ui-model-demo-server/server.mjs`
    - `curl -sS http://127.0.0.1:9032/snapshot | jq ...`
  - output:
    - `dispatch` keys include `docs_*`, `static_*`, `ws_*` and `test_echo`
    - `trigger = {"ui_event":["forward_ui_events"]}`
- Result: PASS

---

## Step 3 — submitEnvelope intent dispatch 双轨
- Date: 2026-02-22
- File:
  - `packages/ui-model-demo-server/server.mjs`
- Change:
  - 新增 dispatch table 通道：
    - 读取 `intent_dispatch_table`
    - 命中且函数存在时：`runtime.intercepts.record('run_func', { func, payload })` + `programEngine.tick()`
    - 返回统一 consumed 结果并清理 mailbox
  - 保留旧 `docs_/static_/ws_` 分支作为回落（双轨护栏）
- Validation A (new path, no server code change for new action):
  - Boot patch 注入:
    - function label `handle_test_echo`
    - dispatch entry `test_echo -> handle_test_echo`
  - request:
    - `POST /ui_event` action=`test_echo`, op_id=`op_test_echo_step3`
  - response:
    - `{"ok":true,"consumed":true,"result":"ok","ui_event_last_op_id":"op_test_echo_step3","ui_event_error":null}`
  - state:
    - snapshot `-2/0,0,0/test_echo_result = {"ok":true,"action":"test_echo","op_id":"op_test_echo_step3"}`
  - log assert:
    - `[executeFunction] CALLED with name: handle_test_echo`
- Validation B (legacy fallback still works):
  - request:
    - `POST /ui_event` action=`docs_refresh_tree`, op_id=`op_docs_fallback_step3`
  - response:
    - `{"ok":true,"consumed":true,"result":"ok","ui_event_last_op_id":"op_docs_fallback_step3","ui_event_error":null}`
  - state:
    - `docs_status = "docs indexed: 164"`
- Result: PASS

---

## Step 4 — processEventsSnapshot trigger map 双轨
- Date: 2026-02-22
- File:
  - `packages/ui-model-demo-server/server.mjs`
- Change:
  - mailbox `ui_event` 触发改为：
    - 先查 `event_trigger_map[event.label.k]` 依次触发
    - 若 map 缺失/空/不可用，回落 `forward_ui_events`
- Validation A (map present path):
  - default `event_trigger_map = {"ui_event":["forward_ui_events"]}`
  - logs show `Resolving event_trigger_map...` and `forward_ui_events` execution.
- Validation B (fallback path):
  - apply patch:
    - `rm_label model_id=-10 k=event_trigger_map`
  - request:
    - `POST /ui_event` action=`docs_refresh_tree`, op_id=`op_trigger_fallback_step4`
  - response:
    - `{"ok":true,"consumed":true,"result":"ok","ui_event_last_op_id":"op_trigger_fallback_step4","ui_event_error":null}`
  - log assert:
    - `[processEventsSnapshot] event_trigger_map missing/empty, fallback to forward_ui_events`
- Result: PASS

---

## Step 1-4 Summary
- Status: PASS
- Implemented:
  - dispatch/trigger schema landed
  - submitEnvelope dual-track dispatch landed
  - processEventsSnapshot dual-track trigger landed
- Next:
  - Step 5-7 (`docs/static/ws` handlers modelization via `ctx.hostApi`)

---

## Step 5 — docs handlers 模型化 + ctx.hostApi 落地
- Date: 2026-02-22
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/intent_handlers_docs.json` (new)

### Change A — `ctx.hostApi` 注入（docs 受限能力）
- In `ProgramModelEngine.executeFunction()` ctx:
  - add `hostApi.docsRefreshTree()`
  - add `hostApi.docsSearch(query, limit)`
  - add `hostApi.docsOpenDoc(relPath)`
- Contract:
  - return shape fixed to `{ ok, code, detail, data }`
  - file access stays inside hostApi (function labels do not touch `fs`)
  - `docsOpenDoc` enforces allowlist + safe path join
  - markdown render uses `getMarkdownProcessor().processSync(...)` to match sync function-label path

### Change B — docs handlers as function labels
- Added patch file `intent_handlers_docs.json` with:
  - `handle_docs_refresh_tree`
  - `handle_docs_search`
  - `handle_docs_open_doc`
- Behavior:
  - reads state via `ctx.getState(...)`
  - calls host capability via `ctx.hostApi.*`
  - writes results to Model `-2` (`docs_tree_json`, `docs_search_results_json`, `docs_render_html`, `docs_status`)
  - writes structured error to mailbox `ui_event_error` on failure (with `op_id`)

### Small guard fix in dispatch path
- In submitEnvelope dispatch-table branch:
  - pre-clear `ui_event_error` before running dispatched function
  - avoid stale previous error affecting current success result

### Validation
- Syntax:
  - `node --check packages/ui-model-demo-server/server.mjs` → PASS
  - `jq -r '.op_id, (.records[]|.k)' packages/worker-base/system-models/intent_handlers_docs.json`
    - `intent_handlers_docs_v0`
    - `handle_docs_refresh_tree`
    - `handle_docs_search`
    - `handle_docs_open_doc`

- Runtime functional regression (`PORT=9034 DY_AUTH=0 WORKER_BASE_WORKSPACE=step5_docs_handlers`):
  1) `docs_refresh_tree`
  - request: `/ui_event` action=`docs_refresh_tree`, op_id=`op_step5_docs_refresh`
  - response: `result=ok`, `ui_event_error=null`
  - snapshot: `docs_tree_json` length `1`, `docs_status="docs indexed: 164"`
  - logs: `[executeFunction] CALLED with name: handle_docs_refresh_tree`

  2) `docs_search`
  - set state: `/api/modeltable/patch` write `docs_query="runtime"` to model `-2`
  - request: `/ui_event` action=`docs_search`, op_id=`op_step5_docs_search`
  - response: `result=ok`, `ui_event_error=null`
  - snapshot: `docs_search_results_json` length `50`, `docs_status="docs search results: 50"`
  - logs: `[executeFunction] CALLED with name: handle_docs_search`

  3) `docs_open_doc` (positive)
  - set state: `docs_selected_path="README.md"`
  - request: `/ui_event` action=`docs_open_doc`, op_id=`op_step5_docs_open_ok`
  - response: `result=ok`, `ui_event_error=null`
  - snapshot: `docs_render_html` contains `<h1`, `docs_status="opened: README.md"`
  - logs: `[executeFunction] CALLED with name: handle_docs_open_doc`

  4) Negative case: `doc_path_not_allowed`
  - set state: `docs_selected_path="../../../etc/passwd"`
  - request: `/ui_event` action=`docs_open_doc`, op_id=`op_step5_docs_open_bad`
  - response: `result=error`
  - `ui_event_error={"op_id":"op_step5_docs_open_bad","code":"invalid_target","detail":"doc_path_not_allowed"}`

  5) Negative case: `doc_not_found`
  - set state: `docs_selected_path="nonexistent_file_12345.md"`
  - request: `/ui_event` action=`docs_open_doc`, op_id=`op_step5_docs_open_nf`
  - response: `result=error`
  - `ui_event_error={"op_id":"op_step5_docs_open_nf","code":"invalid_target","detail":"doc_not_found"}`

  6) Legacy fallback still works
  - `/ui_event` action=`static_project_list` → `result=ok`
  - `/ui_event` action=`ws_select_app` → `result=ok`
  - confirms Step 3 dual-track fallback remains valid for actions without migrated handlers

### Extension check (`test_echo`)
- Note:
  - runtime patch adding function labels after startup does not refresh `ProgramModelEngine.functions` immediately (existing behavior).
  - verified by log: `WARNING: no code found for function: handle_test_echo` on hot patch path.
- Pass path:
  - boot-time inject `MODELTABLE_PATCH_JSON` with `handle_test_echo + intent_dispatch_table.test_echo`
  - request `/ui_event` action=`test_echo`, op_id=`op_step5_test_echo_boot`
  - response: `result=ok`
  - snapshot: `test_echo_result={"ok":true,"action":"test_echo","op_id":"op_step5_test_echo_boot"}`
  - log: `[executeFunction] CALLED with name: handle_test_echo` (no warning)

### Step 5 Result
- Status: PASS
- Outcome:
  - docs handlers moved to model functions + host capabilities
  - docs actions now hit dispatch new path when function exists
  - legacy fallback behavior preserved for non-migrated action groups

---

## Step 6 — static handlers 模型化 + /api/static/upload 复用 core
- Date: 2026-02-23
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/intent_handlers_static.json` (new)

### Changes
- add `staticUploadCore(name, kind, buf)` and make both paths reuse it:
  - mailbox dispatch path (`ctx.hostApi.staticUploadProject`)
  - direct upload path (`POST /api/static/upload`)
- add `ctx.hostApi` static capability set:
  - `staticListProjects()`
  - `staticUploadProject(name, kind, b64data)`
  - `staticDeleteProject(name)`
- add Model -10 function labels:
  - `handle_static_project_list`
  - `handle_static_project_upload`
  - `handle_static_project_delete`

### Validation
- Syntax:
  - `node --check packages/ui-model-demo-server/server.mjs` → PASS
  - `jq -r '.op_id, (.records[]|.k)' packages/worker-base/system-models/intent_handlers_static.json`
    - `intent_handlers_static_v0`
    - `handle_static_project_list`
    - `handle_static_project_upload`
    - `handle_static_project_delete`
- Runtime (PORT=9014, `WORKER_BASE_WORKSPACE=tmp_0152_full_reg`):
  - `POST /ui_event` action=`static_project_list` → `result=ok`
  - `POST /ui_event` action=`static_project_upload` (html base64) → `result=ok`, snapshot contains project `step10mailbox`
  - `POST /ui_event` action=`static_project_delete` → `result=ok`
- Direct upload path reuse check (PORT=9017):
  - `POST /api/static/upload?name=directafter&kind=html` → `{ok:true,message:"uploaded: directafter"}`
  - snapshot confirms `directafter` exists in `static_projects_json`
- Result: PASS

---

## Step 7 — ws handlers 模型化 + P0/P1/P2 修订落地
- Date: 2026-02-23
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/intent_handlers_ws.json` (new)

### Changes
- add `ctx.hostApi` workspace capability set:
  - `wsSelectApp(modelId)`
  - `wsAddApp(name)`
  - `wsDeleteApp(modelId)`
  - `wsRefreshCatalog()`
- inject closure bridge:
  - `programEngine._wsRefreshCatalog = refreshWorkspaceStateCatalog`
- API-only state keys init:
  - `ws_new_app_name` (str)
  - `ws_delete_app_id` (int)
  - `ws_status` (str)
- soft-delete visibility rule:
  - `deriveWorkspaceRegistry()` skips models with `ws_deleted=true`
- P0 fix (ID monotonic):
  - add `getMaxPositiveModelId()/resolveNextWorkspaceModelId()`
  - `refreshWorkspaceStateCatalog()` and `clearAndValidateWorkspaceSelection()` use full positive model scan (not visible registry only)
- P1 fix (`mgmt_func_error` path):
  - dispatch branch pre-clears `mgmt_func_error`
  - post-tick maps `mgmt_func_error` to mailbox `ui_event_error` as `func_exception`
  - `executeFunction` catch now writes `mgmt_func_error` to system root `(-10,0,0,0)`
- add model handlers:
  - `handle_ws_select_app`
  - `handle_ws_app_add`
  - `handle_ws_app_delete`

### Validation
- Syntax:
  - `node --check packages/ui-model-demo-server/server.mjs` → PASS
  - `jq -r '.op_id, (.records[]|.k)' packages/worker-base/system-models/intent_handlers_ws.json`
    - `intent_handlers_ws_v0`
    - `handle_ws_select_app`
    - `handle_ws_app_add`
    - `handle_ws_app_delete`
- Runtime (PORT=9014):
  - `POST /ui_event` action=`ws_app_add` (with state `ws_new_app_name`) → `result=ok`
  - `POST /ui_event` action=`ws_app_delete` (with state `ws_delete_app_id`) → `result=ok`
  - `POST /ui_event` action=`ws_select_app` → `result=ok`
  - protected delete (`ws_delete_app_id=-10`) → `result=error`, `ui_event_error.code=protected_model`
  - monotonic ID check: `WID1=1003`, delete, then `WID2=1004` → PASS
- `func_exception` mapping (PORT=9015, boot-time patch inject throw function):
  - `POST /ui_event` action=`test_throw`
  - response: `result=error`, `ui_event_error={code:"func_exception",detail:"boom_from_env"}`
- Result: PASS

---

## Step 8 — snapshot 过滤规则模型化
- Date: 2026-02-23
- Files:
  - `packages/worker-base/system-models/server_config.json` (new)
  - `packages/ui-model-demo-server/server.mjs`

### Changes
- add `server_config.json` labels on Model 0:
  - `snapshot_filter_config`
  - `workspace_default_app`
- include `server_config.json` in server-side `loadFullModelPatches(...)`
- `buildClientSnapshot()` now reads filter config from Model 0 with fallback to constants

### Validation
- Runtime (PORT=9014):
  - `curl /snapshot | jq '.snapshot.models["-10"].cells["0,0,0"].labels | to_entries | map(select(.value.t=="function")) | length'`
  - output: `0`
  - `curl /snapshot | jq '((.snapshot.models["-1"].cells["0,0,0"].labels.snapshot_json // null)==null) and ((.snapshot.models["-1"].cells["0,0,0"].labels.event_log // null)==null)'`
  - output: `true`
- Result: PASS

---

## Step 9 — workspace 默认选择模型化
- Date: 2026-02-23
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/server_config.json`

### Changes
- add helper `resolveDefaultAppId(runtime, apps)`
- replace hardcoded default logic in:
  - `refreshWorkspaceStateCatalog()`
  - `clearAndValidateWorkspaceSelection()`
- default source: Model 0 label `workspace_default_app` (fallback 100)

### Validation
- Default path (PORT=9019 fresh workspace registry):
  - registry includes required ids `100/1001/1002`
- Override path (PORT=9016, env patch `workspace_default_app=1001`):
  - `curl /snapshot | jq '.snapshot.models["-2"].cells["0,0,0"].labels.ws_app_selected.v'`
  - output: `1001`
- Result: PASS

---

## Step 10 — legacy docs/static/ws 分支清理 + 全量回归
- Date: 2026-02-23
- File:
  - `packages/ui-model-demo-server/server.mjs`

### Changes
- remove legacy intent branch:
  - removed `isLegacyIntentAction`
  - removed `if (isLegacyIntentAction) { ... }` block (docs/static/ws server hardcode)
- keep event-trigger fallback in `processEventsSnapshot` (0153 planned cleanup)
- keep startup readiness guard for dispatch execution:
  - `programEngineReady` awaited in `submitEnvelope()` before processing

### Validation
- grep checks:
  - `rg -n "action\.startsWith.*docs_|action\.startsWith.*static_|action\.startsWith.*ws_" packages/ui-model-demo-server/server.mjs` → 0 hit
  - `rg -n "isLegacyIntentAction" packages/ui-model-demo-server/server.mjs` → 0 hit
  - `rg -n "forward_ui_events" packages/ui-model-demo-server/server.mjs` → only fallback lines in `processEventsSnapshot`
- full runtime regression (PORT=9014):
  - docs: `docs_refresh_tree/docs_search/docs_open_doc` (positive + traversal negative) → PASS
  - static: `static_project_list/static_project_upload/static_project_delete` → PASS
  - ws(API-only): `ws_select_app/ws_app_add/ws_app_delete` + protected negative + monotonic id → PASS
- extensibility (`test_echo`, no server code change):
  - boot-time patch injection (PORT=9018) adds dispatch entry + function label
  - `POST /ui_event` action=`test_echo` → `result=ok`
  - snapshot `test_echo_result={"ok":true,"action":"test_echo"}`
- Result: PASS

---

## Step 6-10 Summary
- Status: PASS
- New files:
  - `packages/worker-base/system-models/intent_handlers_static.json`
  - `packages/worker-base/system-models/intent_handlers_ws.json`
  - `packages/worker-base/system-models/server_config.json`
- Core outcomes:
  - docs/static/ws actions all moved to dispatch-table + function labels path
  - server hardcoded docs/static/ws intent branch removed
  - snapshot/default-selection config moved to Model 0 labels
  - `/api/static/upload` and mailbox upload share the same core write path
  - ws add/delete supports API-only flow with monotonic model id

---

## Post-Review Fix (P1/P2) — startup seed overwrite + static_status clobber
- Date: 2026-02-23
- Source: reviewer findings after `006693e`

### Fix A (P1): avoid overwriting persisted positive-model state on startup
- File:
  - `packages/ui-model-demo-server/server.mjs`
- Change:
  - add helper: `countPositiveModels(runtime)`
  - `loadFullModelPatches(...)` split into:
    - always: `server_config.json`
    - conditional: `workspace_positive_models.json`, `test_model_100_ui.json` only when positive model count is 0
  - when skipped, emit log:
    - `[createServerState] skip positive seed patches (existing_positive_models=...)`

### Fix B (P2): keep static init failure observable
- File:
  - `packages/ui-model-demo-server/server.mjs`
- Change:
  - remove unconditional `overwriteStateLabel(runtime, 'static_status', 'str', '')` after successful `refreshWorkspaceStateCatalog()` in `clearAndRefreshAfterRuntimeBoot()`

### Targeted verification
- Syntax:
  - `node --check packages/ui-model-demo-server/server.mjs` → PASS

- P1 (restart persistence semantics):
  1) boot workspace `tmp_review_fix_p1`, write model 100 custom values via `/api/modeltable/patch`:
     - `bg_color=#123456`, `status=persisted_custom`
  2) restart same workspace
  3) snapshot after restart:
     - `bg_color=#123456`
     - `status=persisted_custom`
  4) startup log contains seed-skip marker
  - Result: PASS

- P1b (fresh workspace still seeded):
  - boot workspace `tmp_review_fix_p1_fresh`
  - snapshot registry contains `100`, `1001`, `1002`
  - Result: PASS

- P2 (static error visibility):
  - set `STATIC_PROJECTS_ROOT` to file path (non-directory)
  - boot workspace `tmp_review_fix_p2`
  - snapshot:
    - `static_status = "static list failed"`
    - `ws_apps_registry` still refreshed (len=6)
  - Result: PASS
