---
title: "0399 - Matrix Chat App UX Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-29
source: ai
iteration_id: 0399-matrix-chat-app-ux
id: 0399-matrix-chat-app-ux
phase: completed
---

# Iteration 0399-matrix-chat-app-ux Resolution

## 0. Execution Rules

- Work branch: `dropx/dev_0399-matrix-chat-app-ux`.
- Steps must be executed in order.
- Each step ends with deterministic verification and sub-agent `codex-code-review`.
- No step may proceed while the latest sub-agent review has unaddressed findings.
- Real command outputs and browser evidence belong in `runlog.md`.

## 1. Steps Overview

| Step | Title | Scope | Key Files | Validation | Acceptance | Rollback |
|------|-------|-------|-----------|------------|------------|----------|
| 1 | Planning Review Gate | Freeze UX contract, design references, execution plan | `docs/iterations/0399-matrix-chat-app-ux/*`, `docs/ITERATIONS.md` | sub-agent review | Plan/resolution approved | Revert 0399 docs and registry row |
| 2 | Contract Tests | Add failing tests for formal chat app structure and data path | `scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs` | `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs` | RED points to missing app/components/path | Delete test |
| 3 | UI Component Extension | Add reusable chat UI components for model-driven rendering | `packages/ui-renderer/src/renderer.mjs`, frontend styles if needed | 0399 test, `node scripts/validate_ui_ast_v0x.mjs --case all` | Components render from labels and emit only model events | Revert renderer/style changes |
| 4 | Matrix Chat Model | Add built-in formal chat slide app and desktop/workspace registry entries | `packages/worker-base/system-models/workspace_positive_models.json`, `runtime_hierarchy_mounts.json`, `desktop_catalog_ui.json` | 0399 test, UI AST validation | New app opens from Workspace/shell and is distinct from Matrix Suite | Remove Model 1083 records and registry entries |
| 5 | Host Actions & Projection | Generalize Matrix Suite host path for the new chat app and improve room/timeline/file projections | `packages/ui-model-demo-server/server.mjs`, relevant tests | 0399, 0398, 0397, 0385 tests | Refresh/select/send/file-share paths work for new app without breaking Matrix Suite | Revert server changes |
| 6 | Local Deploy & Browser QA | Build/deploy local stack and test real browser flows | deployment scripts, `output/playwright/` evidence | local baseline + Playwright browser test | Browser proves open, refresh rooms, select room, send text, file preview, dialogs | Redeploy previous image/assets |
| 7 | Final Review & Completion | Final sub-agent review, runlog completion, iteration status update | `docs/iterations/0399-matrix-chat-app-ux/runlog.md`, `docs/ITERATIONS.md` | sub-agent review, `git diff --check` | No findings remain and iteration docs are completed | Revert docs status only if implementation rollback needed |

## 2. Step Details

### Step 1 — Planning Review Gate

**Goal**
- Register the iteration and freeze the product/technical plan before implementation.

**Scope**
- Create `plan.md`, `resolution.md`, `runlog.md`.
- Register 0399 in `docs/ITERATIONS.md`.
- Run sub-agent review with `codex-code-review`.

**Validation**
- Sub-agent review decision must be `APPROVED`, or findings must be addressed and reviewed again.

**Acceptance Criteria**
- Plan records reference sources, UX layering, implementation slices, and per-step review requirement.

**Rollback Strategy**
- Remove the 0399 iteration directory and registry row.

---

### Step 2 — Contract Tests

**Goal**
- Capture the intended formal chat UX and data path before code changes.

**Scope**
- Add a test that verifies:
  - Formal chat app model exists separately from `Matrix Suite`.
  - Main shell contains conversation list, message timeline, composer, settings/create/detail dialogs.
  - Main shell does not expose login/password/debug/test panels as flat primary content.
  - Send/file actions target Model 0 bus ingress through existing UI event binding.
  - Room ids are not primary list text.

**Validation**
- `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`

**Acceptance Criteria**
- Initial run fails for the expected missing app/components/path reasons.

**Rollback Strategy**
- Delete the new test.

---

### Step 3 — UI Component Extension

**Goal**
- Provide enough model-driven UI primitives to render a real chat interface without raw HTML takeover.

**Scope**
- Add or extend reusable components:
  - `ConversationList` for channel/DM/room lists.
  - `MessageTimeline` for bubble/file/audio/image style message history.
  - `AttachmentPreview` for selected single-file preview.
  - `ComposerBar` only if existing Input/Button/FileInput composition cannot satisfy layout and interaction naturally.
- Components must receive data via refs/props and emit events through the existing host adapter.

**Validation**
- `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
- `node scripts/validate_ui_ast_v0x.mjs --case all`

**Acceptance Criteria**
- New components compile and do not introduce direct Matrix/network calls in the renderer.

**Rollback Strategy**
- Revert renderer/style files.

---

### Step 4 — Matrix Chat Model

**Goal**
- Add the new formal chat slide app as a built-in UI Server app.

**Scope**
- Add a positive model, planned id `1083`, unless occupied during implementation.
- Add labels for app name, summary, root node, conversation state, active room state, composer draft, pending file, dialogs, and UI component nodes.
- Add desktop/workspace registry entries so the app appears as a built-in app.
- Keep `Matrix Suite` model 1080 unchanged as a test app.

**Validation**
- `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
- `node scripts/validate_ui_ast_v0x.mjs --case all`

**Acceptance Criteria**
- New app is discoverable and its UI AST represents the formal chat layout.

**Rollback Strategy**
- Remove Model 1083 records and registry entries.

---

### Step 5 — Host Actions & Projection

**Goal**
- Make the formal chat app use real Matrix behavior, not static mock data.

**Scope**
- Generalize current Matrix Suite root read/write and host actions to support the formal chat app model id.
- Add select-room, refresh, send text, create room/DM, edit message, and file-share actions for the formal app.
- Render timeline data in a format suitable for `MessageTimeline`, including `m.text`, `m.file`, image-like file names, audio-like file names, and edited markers.
- Preserve 0397/0398 behavior for existing `Matrix Suite`.

**Validation**
- `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
- `node scripts/tests/test_0398_matrix_suite_room_name_display.mjs`
- `node scripts/tests/test_0397_matrix_suite_live_test_slide_app.mjs`
- `node scripts/tests/test_0385_matrix_suite_real_comm_contract.mjs`

**Acceptance Criteria**
- Both the new formal app and old test app can use Matrix host actions without regression.

**Rollback Strategy**
- Revert server changes.

---

### Step 6 — Local Deploy & Browser QA

**Goal**
- Prove the deployed local UI matches the new formal chat UX and core flows work in a real browser.

**Scope**
- Build and deploy the local UI Server.
- Sync persisted assets if required by the local stack.
- Use Playwright or Browser plugin to open `http://127.0.0.1:30900/#/workspace`.
- Open the new chat app, refresh rooms, select a room, send text, choose one file, inspect preview, open settings/create/detail dialogs.

**Validation**
- `bash scripts/ops/check_runtime_baseline.sh`
- Real browser test with screenshot under `output/playwright/`.

**Acceptance Criteria**
- Browser evidence shows the formal chat app, not the old test-style Matrix Suite panel.

**Rollback Strategy**
- Redeploy previous image/assets.

---

### Step 7 — Final Review & Completion

**Goal**
- Close the iteration only after review and verification evidence is complete.

**Scope**
- Run final sub-agent `codex-code-review`.
- Address findings until approved.
- Update `docs/ITERATIONS.md` and runlog status.

**Validation**
- `git diff --check`
- Final sub-agent decision `APPROVED`.

**Acceptance Criteria**
- No unresolved findings remain; runlog contains PASS evidence for all steps.

**Rollback Strategy**
- If final review finds a blocking issue, return to the relevant step and do not mark completed.
