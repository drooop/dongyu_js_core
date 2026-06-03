---
title: "0399 - Matrix Chat App UX Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-05-29
source: ai
iteration_id: 0399-matrix-chat-app-ux
id: 0399-matrix-chat-app-ux
phase: completed
---

# Iteration 0399-matrix-chat-app-ux Runlog

## Environment

- Date: 2026-05-29
- Branch: `dropx/dev_0399-matrix-chat-app-ux`
- Runtime: local repo `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Notes: User requested a formal chat-software UX. Existing `Matrix Suite` remains a test interface; new app will provide the user-facing messenger UI.

## Gate Records

Review Gate Record
- Iteration ID: 0399-matrix-chat-app-ux
- Review Date: 2026-05-29
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: User approved Codex to plan, sub-agent review, implement in small stages, review each stage, and finish before reporting.

## Execution Records

### Step 1 - Planning Review Gate

- Sub-agent review: `codex-code-review`
- Decision: APPROVED
- Key output: no findings, no open questions.
- Result: PASS

### Step 2 - Contract Tests

- Command: `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
- Key output: `0 passed, 7 failed out of 7`; failures point to the expected missing Matrix Chat app model, Model 0 mount/route, renderer chat components, and host action path.
- Sub-agent review: `codex-code-review`
- Decision: APPROVED
- Key output: no findings, no open questions after revisions for `ws_apps_registry`, `WORKSPACE_ENTRY_MODEL_IDS`, Model 0 route/mount, file pick binding, and Matrix host-action flow.
- Result: PASS (RED confirmed)

### Step 3 - UI Component Extension

- Command: `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
- Key output: `renderer_supports_chat_components_without_direct_matrix_calls` PASS; remaining failures are expected later-stage model/server gaps.
- Command: `node scripts/validate_ui_ast_v0x.mjs --case all`
- Key output: `summary: PASS`
- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output: Vite build completed successfully.
- Sub-agent review: `codex-code-review`
- Decision: APPROVED
- Key output: no findings, no open questions.
- Result: PASS

### Step 4 - Matrix Chat Model

- Command: `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
- Key output: `5 passed, 2 failed out of 7`; remaining failures are Step 5 server host-action gaps.
- Command: `node scripts/tests/test_0382_workspace_entry_cleanup_contract.mjs`
- Key output: `test_0382_workspace_entry_cleanup_contract: PASS`
- Command: `node scripts/validate_ui_ast_v0x.mjs --case all`
- Key output: `summary: PASS`
- Sub-agent review: `codex-code-review`
- Decision: APPROVED
- Key output: no findings, no open questions.
- Result: PASS

### Step 5 - Matrix Chat Host Action Path

- Root cause: Model 0 ingress and the 1083 request pin were connected, but the 1083 `handle_matrix_chat_event` program model did not compile because its generated Markdown string contained raw newlines inside a JavaScript string literal.
- Fix: escaped the room-detail Markdown newlines in the 1083 program model, added an explicit `MATRIX_CHAT_BUS_EVENT_KEY`, and extended the 0399 contract test to compile the 1083 program model before dispatch.
- Review revision: added Matrix Chat `edit_message` handling and expanded the host-action test to cover `edit_message`, `share_file`, and `create_channel`, in addition to `refresh_rooms` and `send_message`.
- Review revision 2: added a model-defined `Edit last` button, `Edit message` Dialog, edit input, and `Save edit` bus_event_v2 trigger so browser users can invoke `edit_message` from the formal Matrix Chat UI.
- Command: `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
- Key output: `7 passed, 0 failed out of 7`
- Command: `node scripts/tests/test_0398_matrix_suite_room_name_display.mjs && node scripts/tests/test_0397_matrix_suite_live_test_slide_app.mjs && node scripts/tests/test_0385_matrix_suite_real_comm_contract.mjs`
- Key output: `2 passed, 0 failed out of 2`; `4 passed, 0 failed out of 4`; `4 passed, 0 failed out of 4`
- Command: `node scripts/validate_ui_ast_v0x.mjs --case all`
- Key output: `summary: PASS`
- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output: Vite build completed successfully.
- Sub-agent review: `codex-code-review`
- Decision: APPROVED
- Key output: no findings, no open questions, no verification gaps after adding the UI-triggerable edit flow.
- Result: PASS

### Step 6 - Local Deploy & Browser QA

- Command: `docker build -t dy-ui-server:v1 -f k8s/Dockerfile.ui-server .`
- Key output: image build completed successfully.
- Command: `kubectl -n dongyu rollout restart deployment/ui-server && kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`
- Key output: `deployment "ui-server" successfully rolled out`
- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: `[check] baseline ready`
- Browser target: `http://127.0.0.1:30900/#/workspace`
- Browser evidence: `output/playwright/0399-matrix-chat-browser-verified.png`
- Browser result:
  - Opened `Matrix Chat` from Workspace.
  - Refreshed real Matrix rooms for the default Drop account; conversation list displayed room names such as `Remote Matrix Check` and `Dongyu Local Test`, while room id stayed out of the list body.
  - Opened `Room details`; dialog showed the selected room id, kind, members, and unread count.
  - Sent text `0399 Matrix Chat browser send after redeploy`; the message appeared in the timeline.
  - Edited the latest message to `0399 Matrix Chat browser edited after redeploy`; the timeline showed `edited` and the edit dialog closed after save.
  - Opened `Matrix Chat Settings`; settings were shown in a dialog with tabs instead of the main chat surface.
  - Opened `New conversation`; create-room / DM entry was shown in a dialog.
  - Chose one file `matrix-chat-preview.txt`; the composer showed a file preview card with Matrix media URI.
  - Clicked `Send File`; the timeline showed a file message card for `matrix-chat-preview.txt`.
- Command: `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
- Key output: `7 passed, 0 failed out of 7`
- Command: `node scripts/tests/test_0398_matrix_suite_room_name_display.mjs && node scripts/tests/test_0397_matrix_suite_live_test_slide_app.mjs && node scripts/tests/test_0385_matrix_suite_real_comm_contract.mjs`
- Key output: `2 passed, 0 failed out of 2`; `4 passed, 0 failed out of 4`; `4 passed, 0 failed out of 4`
- Command: `node scripts/validate_ui_ast_v0x.mjs --case all`
- Key output: `summary: PASS`
- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output: Vite build completed successfully.
- Result: PASS

### Step 7 - Final Review & Completion

- Sub-agent review: `codex-code-review`
- Decision: APPROVED
- Key output: no findings, no open questions, no verification gaps.
- Result: PASS
