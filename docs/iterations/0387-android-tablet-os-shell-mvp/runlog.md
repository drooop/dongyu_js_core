---
title: "0387 - Android Tablet OS Shell MVP Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-05-20
source: codex
iteration_id: 0387-android-tablet-os-shell-mvp
---

# Iteration 0387-android-tablet-os-shell-mvp Runlog

## Environment

- Date: 2026-05-20
- Branch: `dropx/dev_0386-0387-android-tablet-os-shell`
- Runtime: local Kubernetes context `orbstack`, namespace `dongyu`

## Execution Records

### Step 1 - Shell component foundation

- Command: `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
- Key output:
  - `[PASS] required_shell_components_registered`
  - `[PASS] renderer_supports_required_shell_components`
  - `[PASS] no_mui_or_quasar_runtime_dependency`
  - Remaining expected failures: app summary metadata, root shell model nodes, foreground quick settings / split pane.
- Result: PASS for Step 1 scope.
- Review: `019e446c-f8a6-7303-bd6d-9b4b85d556fa` returned `APPROVED`.
- Review note: reviewer flagged that the renderer test is source-match heavy; a later deterministic stage should include an executed render path.

### Step 2 - App summary metadata

- Command: `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
- Key output:
  - `[PASS] slide_apps_have_summary_metadata`
  - `[PASS] workspace_registry_exposes_app_summary`
  - The command exits non-zero because later-stage checks still fail: root shell nodes and foreground quick settings / split pane.
- Result: PASS for Step 2 scope; full 0386/0387 contract test remains RED until later 0387 stages.
- Review: `019e4470-999a-79a1-9af0-2f07bc12df87` returned `CHANGE_REQUESTED`.
- Findings fixed:
  - Added missing `slide_surface_type` on Model 1051.
  - Extracted server workspace registry derivation into `deriveWorkspaceRegistryFromSnapshot` and added test coverage for server-side summary/surface propagation.
- Recheck:
  - `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs` remains non-zero with 6 PASS / 2 later-stage failures.
- Re-review: `019e447a-10cc-7b63-9e8e-a328c04eb936` returned `APPROVED`.

### Step 3 - Desktop shell UI model

- Command:
  - `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
  - `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`
- Key output:
  - 0386 contract: `[PASS] root_projection_uses_android_tablet_shell_nodes`; command remains non-zero due to later foreground quick settings / split-pane check.
  - 0374 desktop regression: `13 passed, 0 failed out of 13`.
- Result: PASS for Step 3 scope.
- Review: `019e447e-aedd-75a0-a83b-b06fb49416ae` returned `APPROVED`.

### Step 4 - Foreground window / Quick Settings / split pane

- Command:
  - `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
  - `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`
- Key output:
  - 0386 contract: `8 passed, 0 failed out of 8`.
  - 0374 desktop regression: `13 passed, 0 failed out of 13`.
- Result: PASS.
- Review: `019e4484-32a1-7d30-a318-fc67d5d662f4` returned `APPROVED`.
- Review note: real browser visual and click-flow verification remains required in Step 6.

### Step 5 - Docs and deterministic verification

- Command:
  - `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
  - `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - 0386 contract: `8 passed, 0 failed out of 8`.
  - 0374 desktop regression: `13 passed, 0 failed out of 13`.
  - UI AST validation: `summary: PASS`.
  - Frontend build: `✓ built in 3.00s`.
  - Build warning: bundle chunk is larger than 500 kB; existing Vite warning, not introduced as a blocking failure here.
- Result: PASS.
- Review: `019e448a-061c-70b0-8a37-98cc38a4f050` returned `CHANGE_REQUESTED`.
- Findings fixed:
  - `slide_app_summary` is now documented as required for positive `slide_capable` Workspace apps.
  - The ModelTable user guide required label list now includes `slide_app_summary`.
- Re-review:
  - `019e448f-43e8-7ea1-bfed-975c3e3ff983` returned `APPROVED`.

### Step 6 - Local deploy and browser verification

- Commands:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `docker build -t dy-ui-server:v1 -f k8s/Dockerfile.ui-server .`
  - `kubectl -n dongyu rollout restart deployment/ui-server`
  - `kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`
  - `bash scripts/ops/sync_local_persisted_assets.sh`
  - `curl -fsS http://127.0.0.1:30900/snapshot`
  - Playwright CLI session `0387_shell` against `http://127.0.0.1:30900/#/`
- Key output:
  - Baseline: all local deployments ready.
  - Local persisted asset root synced to `/Users/drop/dongyu/volume/persist/assets`.
  - Server snapshot after restart: `ui_page=desktop`, `hasDesktop=true`, root catalog entry resolves `/` to Model `-28`.
  - Browser root URL stayed `http://127.0.0.1:30900/#/` and rendered the Android tablet OS shell.
  - Browser workspace app launch opened `E2E 颜色生成器` inside the foreground split-pane shell.
  - Browser Generate Color smoke check: before `#FFFFFF`, after `#271792`, status `processed`, no error text.
  - Browser Quick Settings check: `desktop-quick-settings-panel` visible after toggle.
  - Browser task switcher check: `desktop-task-switcher` visible after task button.
  - Browser system app check: `Doc` opens the Docs foreground app.
- Evidence:
  - `output/playwright/0387-android-tablet-os-shell-mvp/root-shell.png`
  - `output/playwright/0387-android-tablet-os-shell-mvp/foreground-color-app.png`
  - `output/playwright/0387-android-tablet-os-shell-mvp/quick-settings-verified.png`
  - `output/playwright/0387-android-tablet-os-shell-mvp/task-switcher-open.png`
  - `output/playwright/0387-android-tablet-os-shell-mvp/color-after-generate.png`
  - `output/playwright/0387-android-tablet-os-shell-mvp/system-docs-open.png`
- Finding fixed during verification:
  - Root path initially rendered `No UI AST` because the old route sync redirected `/` to `/workspace`, and the local persisted asset set did not include `desktop_catalog_ui.json`.
  - Fixed `resolveNavigableRoutePath` so `/` remains the desktop route.
  - Added desktop catalog to `sync_local_persisted_assets.sh` and re-synced/restarted local ui-server.
  - Added a deterministic assertion that `/` must not redirect to `/workspace`.
- Review finding fixed:
  - Updated old route contract test `scripts/tests/test_0201_route_local_ast_contract.mjs` so `/` after catalog bootstrap must remain the desktop OS shell route.
  - Upgraded the local persisted asset sync guard from source matching to executing `sync_local_persisted_assets.sh` against a temporary asset root and checking both `system/ui/desktop_catalog_ui.json` and `manifest.v0.json`.
- Recheck:
  - `node scripts/tests/test_0201_route_local_ast_contract.mjs`: `5 passed, 0 failed out of 5`.
  - `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`: `9 passed, 0 failed out of 9`.
  - `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`: `13 passed, 0 failed out of 13`.
- Result: PASS.
- Review: `019e44a1-55bd-78c1-a9b5-116cfc8d136d` returned `CHANGE_REQUESTED`; findings fixed.
- Re-review: `019e44a4-8e3b-7172-99d6-bfbc8e1f4dd3` returned `APPROVED`.

### Step 7 - Final review and close

- Commands:
  - `node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
  - `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - Route local AST: `5 passed, 0 failed out of 5`.
  - 0386/0387 shell contract: `10 passed, 0 failed out of 10`.
  - 0374 desktop regression: `13 passed, 0 failed out of 13`.
  - UI AST validation: `summary: PASS`.
  - Frontend build: `✓ built in 3.00s`.
  - Build warning: bundle chunk is larger than 500 kB; unchanged non-blocking Vite warning.
- Review: `019e44a7-85bc-70a1-98d6-8df550d52dfe` returned `CHANGE_REQUESTED`.
- Findings fixed:
  - Foreground shell now builds a model-like shell AST and renders registered `StatusBar`, `QuickSettingsPanel`, `SplitPaneWindow`, `AppWindow`, and `AppSwitcher` components through the UI renderer.
  - Added renderer `HostSlot` support for host-owned content insertion inside model-driven shell frames, registered it in the component registry, and documented it as an internal UI Server shell component.
  - `slide_app_summary` is now strict for desktop projection; summary-less slide apps are rejected instead of receiving a silent frontend fallback.
  - The no-registry fallback test now checks both `Button` and `AppCard` desktop slide app nodes.
- Recheck after fixes:
  - `node scripts/tests/test_0201_route_local_ast_contract.mjs`: `5 passed, 0 failed out of 5`.
  - `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`: `10 passed, 0 failed out of 10`.
  - `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`: `13 passed, 0 failed out of 13`.
  - `node scripts/validate_ui_ast_v0x.mjs --case all`: `summary: PASS`.
  - `npm -C packages/ui-model-demo-frontend run build`: `✓ built in 3.24s`.
- Local deploy after fixes:
  - Built `dy-ui-server:v1` with `k8s/Dockerfile.ui-server-prebuilt`.
  - Restarted `deployment/ui-server`; rollout completed.
- Browser recheck after fixes:
  - Playwright against `http://127.0.0.1:30900/#/`.
  - Result: `rootShell=true`, `foreground=true`, `split=true`, `inspector=true`, `qs=true`, `switcher=true`.
  - Generate Color result: before `#FFFFFF`, after `#83f3c2`, `changed=true`, `processed=true`, `hasError=false`.
  - Console: 0 errors, 0 warnings.
  - Evidence: `output/playwright/0387-android-tablet-os-shell-mvp/final-model-driven-color-after-generate.png`.
- Re-review: `019e44ce-4d73-76f0-ba06-eb20d8d2cd76` returned `CHANGE_REQUESTED`.
- Review finding fixed:
  - CommonJS renderer `packages/ui-renderer/src/renderer.js` now has parity with the ESM renderer for Android tablet shell components and `HostSlot`.
  - Added an executed CJS/ESM parity test that renders `StatusBar`, `HostSlot`, and `AppCard` through both renderers and compares `renderTree` plus `renderVNode` results.
- Final review: `019e44d8-78cf-7873-8b01-0d8f1f2474f3` returned `CHANGE_REQUESTED`.
- Final review findings fixed:
  - 0387 iteration status is now closed consistently in `docs/ITERATIONS.md`, `resolution.md`, and this runlog.
  - Summary-less slide-capable apps are now rejected explicitly in local registry derivation, server registry derivation, and desktop projection instead of being silently hidden.
  - Added an executed negative test that injects a slide-capable app without `slide_app_summary` and expects explicit rejection.
- Final re-review: `019e44df-aba3-7341-b0c8-6070725ece9c` returned `CHANGE_REQUESTED`.
- Final re-review findings fixed:
  - Slide app import validation now requires root `slide_app_summary`; summary-less import payloads fail with `missing_slide_app_summary`.
  - Fill-table slide app creation now writes `slide_app_summary`, and `wsAddApp` now creates a minimal valid slide app with summary, surface metadata, deletable flag, and a small UI root.
  - Existing local persisted slide-capable models were re-filled with `slide_app_summary`, and local persisted assets were re-synced.
  - Updated saved minimal Submit payload/zip, provider docs UI model, and repeated import fixtures so normal slide app payloads comply with the strict summary contract.
- Final recheck:
  - `node --check packages/ui-renderer/src/renderer.js`: PASS.
  - `node --check packages/ui-model-demo-server/server.mjs && node --check packages/ui-model-demo-frontend/src/demo_modeltable.js && node --check packages/ui-model-demo-frontend/src/route_ui_projection.js`: PASS.
  - `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs`: `1 passed, 0 failed out of 1`.
  - `node scripts/tests/test_0311_workspace_pin_addressing_server_flow.mjs`: `1 passed, 0 failed out of 1`.
  - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`: `4 passed, 0 failed out of 4`.
  - `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`: `11 passed, 0 failed out of 11`.
  - `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`: `13 passed, 0 failed out of 13`.
  - `node scripts/tests/test_0201_route_local_ast_contract.mjs`: `5 passed, 0 failed out of 5`.
  - `node scripts/tests/test_0321_imported_host_ingress_contract.mjs`: `3 passed, 0 failed out of 3`.
  - `node scripts/tests/test_0321_imported_host_ingress_server_flow.mjs`: `1 passed, 0 failed out of 1`.
  - `node scripts/tests/test_0322_imported_host_egress_contract.mjs`: `2 passed, 0 failed out of 2`.
  - `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`: `1 passed, 0 failed out of 1`.
  - `node scripts/tests/test_0353_slide_app_runtime_docs_publish_contract.mjs`: `5 passed, 0 failed out of 5`.
  - `node scripts/validate_ui_ast_v0x.mjs --case all`: `summary: PASS`.
  - `npm -C packages/ui-model-demo-frontend run build`: `✓ built in 2.66s`.
  - `bash scripts/ops/check_runtime_baseline.sh`: `baseline ready`.
- Final local deploy and browser recheck:
  - Built `dy-ui-server:v1` with `k8s/Dockerfile.ui-server-prebuilt`.
  - Restarted `deployment/ui-server`; rollout completed.
  - Playwright against `http://127.0.0.1:30900/#/`.
  - Root Android tablet OS shell rendered app cards with `slide_app_summary` text.
  - Opened `E2E 颜色生成器`, clicked `Generate Color`; color changed from `#FFFFFF` to `#1e41fc`, status became `processed`.
  - Opened Quick Settings and task switcher; browser console had 0 errors and 0 warnings.
  - Evidence: `output/playwright/0387-android-tablet-os-shell-mvp/final-strict-summary-browser.png`.
- Final re-review: `019e44f5-29f8-7f60-9a06-8fb9bc4baa1a` returned `APPROVED`.
- Decision: approved.
- Result: 0387 implementation complete after final sub-agent review.

## Docs Updated

- [x] `docs/user-guide/ui_components_v2.md`
- [x] `docs/user-guide/modeltable_user_guide.md`
- [x] 0387 runlog with deterministic and browser evidence
