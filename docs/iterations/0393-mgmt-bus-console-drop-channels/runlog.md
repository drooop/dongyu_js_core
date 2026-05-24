---
title: "0393 Mgmt Bus Console Drop Channels Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-05-24
source: codex
---

# 0393 Mgmt Bus Console Drop Channels Runlog

## 2026-05-24

- Branch: `dropx/dev_0393-mgmt-bus-console-drop-channels`
- Requirement: `Mgmt Bus Console` 默认使用 `drop` 用户，并展示 `drop` 所在的所有 channel。
- Phase: plan registered; implementation waits for explicit `Approved` gate.

### Stage 1: Projection Contract

- Added projection coverage for Matrix joined rooms becoming `Mgmt Bus Console` subject rows.
- Preserved explicit empty/error subject states and redacted sensitive values before UI projection.
- Sub-agent review: first pass requested fixes for empty `subjects`, string room ids, and explicit subject redaction; fixes were applied and re-reviewed as approved.

### Stage 2: Server Discovery And Local State

- Added server-side joined-room discovery from Model 0 Matrix bootstrap labels.
- Kept Matrix access token out of frontend state and projection labels.
- Added explicit `/ui_event` handling for local UI state such as selected subject/event.
- Sub-agent review requested timeout handling, removal of generic env token fallback, and status preservation; fixes were applied and re-reviewed as approved.

### Stage 3: Desktop Entry And Browser Fix

- Restored `Mgmt Bus Console` as a built-in desktop slide app and verified its launch target is `workspace:1036`.
- Browser test initially found a real UI issue: `Subjects / Rooms` showed only the tab header because the tab pane had no active tab value.
- Fixed by adding Model `1036` label `selected_subject_tab=subjects` and binding `mgmt_bus_subject_tabs` to that label through cellwise UI labels.
- Sub-agent review approved the tab fix and required real browser retest.

### Verification

- `node scripts/tests/test_0382_workspace_entry_cleanup_contract.mjs`: PASS
- `node scripts/tests/test_0390_focused_app_shell_settings_contract.mjs`: PASS
- `node scripts/tests/test_0393_mgmt_bus_console_drop_channels.mjs`: PASS
- `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs`: PASS
- `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`: PASS
- `node scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`: PASS
- `npm -C packages/ui-model-demo-frontend run build`: PASS
- `git diff --check`: PASS
- Local deploy: `bash scripts/ops/deploy_local.sh`: PASS; all local pods running.
- Snapshot check after deploy: `mgmt_bus_console_subject_rows_json` contained joined-room rows and no token/secret text.
- Real browser test at `http://127.0.0.1:30900/#/`:
  - Desktop showed `Mgmt Bus Console` under Built-in apps.
  - Opening it rendered `Subjects / Rooms` with joined room rows and status `joined`.
  - Timeline showed `drop Matrix channels=77`.
  - Clicking `Refresh` preserved visible joined room rows.
  - Page text did not contain Matrix token/access-token/password strings.
