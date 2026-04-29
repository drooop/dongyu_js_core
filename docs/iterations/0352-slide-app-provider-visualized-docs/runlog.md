---
title: "Iteration 0352 Runlog - Slide App Provider Visualized Docs"
doc_type: iteration-runlog
status: active
updated: 2026-04-29
source: ai
---

# Iteration 0352-slide-app-provider-visualized-docs Runlog

## Environment

- Date: 2026-04-29
- Branch: `dev_0352-slide-app-provider-visualized-docs`
- Runtime: docs-only local checks, local browser verification, and remote ui-server verification
- Review Gate Record
- Iteration ID: `0352-slide-app-provider-visualized-docs`
- Review Date: 2026-04-29
- Review Type: AI-assisted sub-agent (`codex-code-review`)
- Review Index: 1
- Decision: Change Requested
- Notes: interactive HTML hid the display-label writeback after Submit by switching to the payload stage.
- Review Gate Record
- Iteration ID: `0352-slide-app-provider-visualized-docs`
- Review Date: 2026-04-29
- Review Type: AI-assisted sub-agent (`codex-code-review`)
- Review Index: 2
- Decision: Approved
- Notes: after keeping the writeback result visible and adding inline payload preview, no findings or gaps remained.
- Review Gate Record
- Iteration ID: `0352-slide-app-provider-visualized-docs`
- Review Date: 2026-04-29
- Review Type: AI-assisted sub-agent (`codex-code-review`)
- Review Index: 3
- Decision: Approved
- Notes: runtime blocker fix approved; reviewer requested adding a changed-payload scheduling assertion, which was added and passed.
- Review Gate Record
- Iteration ID: `0352-slide-app-provider-visualized-docs`
- Review Date: 2026-04-29
- Review Type: AI-assisted sub-agent (`codex-code-review`)
- Review Index: 4
- Decision: Change Requested
- Notes: importer install chain still had direct owner update / malformed click payload gaps; fixed by routing FileInput and click through Model 0 bus.in with temporary ModelTable payloads only.
- Review Gate Record
- Iteration ID: `0352-slide-app-provider-visualized-docs`
- Review Date: 2026-04-29
- Review Type: AI-assisted sub-agent (`codex-code-review`)
- Review Index: 5
- Decision: Approved
- Notes: Model 0 installer chain remediation approved with no findings or verification gaps.
- Review Gate Record
- Iteration ID: `0352-slide-app-provider-visualized-docs`
- Review Date: 2026-04-29
- Review Type: AI-assisted sub-agent (`codex-code-review`)
- Review Index: 6
- Decision: Change Requested
- Notes: app-level deploy assets sync needed post-cloud.env validation and behavior tests for disabled/invalid sync flags.
- Review Gate Record
- Iteration ID: `0352-slide-app-provider-visualized-docs`
- Review Date: 2026-04-29
- Review Type: AI-assisted sub-agent (`codex-code-review`)
- Review Index: 7
- Decision: Change Requested
- Notes: text-only deploy tests were insufficient; added executable harness coverage for default sync, disabled sync, invalid sync flag, and invalid CA flag.
- Review Gate Record
- Iteration ID: `0352-slide-app-provider-visualized-docs`
- Review Date: 2026-04-29
- Review Type: AI-assisted sub-agent (`codex-code-review`)
- Review Index: 8
- Decision: Approved
- Notes: deploy assets sync remediation approved with no findings or verification gaps.

## Execution Records

### Step 0 - Intake

- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0352-slide-app-provider-visualized-docs --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output:
- `written docs/iterations/0352-slide-app-provider-visualized-docs/plan.md`
- `written docs/iterations/0352-slide-app-provider-visualized-docs/resolution.md`
- `written docs/iterations/0352-slide-app-provider-visualized-docs/runlog.md`
- Result: PASS

### Step 1 - Visualized and interactive docs

- Command: edit provider visualized Markdown and interactive HTML.
- Key output:
- Added `minimal_submit_app_provider_visualized.md` with provider-facing flow, cell map, payload path, anti-patterns, and checklist.
- Added `minimal_submit_app_provider_interactive.html` as self-contained HTML with stage navigation, live payload preview, and submit writeback simulator.
- Updated `docs/user-guide/README.md` and `docs/user-guide/slide-app-runtime/README.md`.
- Result: PASS

### Step 2 - Contract and browser verification

- Command: `node scripts/tests/test_0352_slide_app_provider_visualized_docs_contract.mjs`
- Key output:
- `[PASS] visualized_doc_explains_provider_flow`
- `[PASS] visualized_doc_rejects_legacy_and_host_owned_shortcuts`
- `[PASS] interactive_html_is_self_contained`
- `[PASS] interactive_html_covers_submit_simulation_contract`
- `[PASS] user_guide_indexes_link_visual_and_interactive_docs`
- `5 passed, 0 failed out of 5`
- Result: PASS

- Command: `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- Key output:
- `[PASS] documented_payload_imports_and_submit_updates_display_label`
- `5 passed, 0 failed out of 5`
- Result: PASS

- Command: Playwright opened `http://127.0.0.1:43152/minimal_submit_app_provider_interactive.html`, filled `playwright visible writeback`, clicked `Submit`, captured `output/playwright/0352-local-interactive-guide.png`.
- Key output:
- Browser snapshot showed `Submitted: playwright visible writeback`.
- Browser snapshot showed the live payload preview containing `text = playwright visible writeback`.
- Result: PASS

### Step 3 - Closeout

- Command: `node scripts/ops/validate_obsidian_docs_gate.mjs`
- Key output: exit 0 after replacing the only new Markdown `.md` link with a plain filename reference.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

- Command: `node scripts/tests/test_0352_slide_app_provider_visualized_docs_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`
- Result: PASS

- Command: `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`
- Result: PASS
- Commits:
- `13eaa90 docs(slide): add 0352 provider visual guide`
- `0181019 fix(server): dedupe pending model0 egress [0352]`
- `8cde74e fix(slide): route installer through model0 [0352]`
- `9f45c50 fix(deploy): sync assets in app rollout [0352]`
- Final evidence commit: pending

### Step 4 - Runtime blocker fix for remote verification

- Observation: remote `/api/runtime/mode` timed out after Matrix boot; subsequent `/snapshot` also timed out.
- Evidence:
- Remote ui-server logs repeatedly printed `Recovering pending Model 0 egress for model 100, triggering forward_model100_submit_from_model0`.
- The same pending `model100_submit_out` payload could be scheduled again before it was cleared, occupying the runtime loop.
- Root cause: pending Model 0 egress recovery had no unchanged-payload dedupe across scheduling rounds.
- Fix:
- Added per-engine pending Model 0 egress dispatch signatures in `packages/ui-model-demo-server/server.mjs`.
- Unchanged pending payloads schedule once while present.
- Changed payloads schedule again.
- Cleared/null payloads forget the signature and allow future requeue.
- Command: `node scripts/tests/test_0303_model0_egress_recovery_server_flow.mjs`
- Key output:
- `[PASS] pending_model0_egress_is_not_rescheduled_while_unchanged`
- `6 passed, 0 failed out of 6`
- Result: PASS

### Step 5 - Remote deployment and browser verification

- Command: `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision 9f45c502c2f6c58fb54311e81a8e4386d2d2f255`
- Key output:
- Remote git did not have local-only commit `9f45c50`, so sync used the archive fallback.
- `.deploy-source-revision` on remote recorded `9f45c50`.
- Result: PASS

- Command: `sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_app.sh --target ui-server --revision 9f45c50 --rebuild`
- Key output:
- `REMOTE_RKE2_GATE: PASS`
- `SYNC_PERSISTED_ASSETS=1`
- `=== Sync authoritative assets ===`
- `[sync-local-assets] persisted assets synced to: /home/wwpic/dongyu/volume/persist/assets`
- `deployment "ui-server" successfully rolled out`
- target source hash gate matched for `server.mjs`, frontend source files, and renderer files.
- Result: PASS

- Command: `python3 scripts/examples/slide_app_install_client.py --base-url https://app.dongyudigital.com --zip /tmp/0352-minimal-submit-app.zip --timeout 120`
- Key output:
- `write_media_uri.result = ok`, `routed_by = model0_busin`
- `trigger_import.result = ok`, `routed_by = model0_busin`
- final status: `imported: Minimal Submit App`
- final registry match: `{ model_id: 1038, name: "Minimal Submit App", source: "provider-minimal-submit" }`
- Result: PASS

- Command: Playwright opened `https://app.dongyudigital.com/#/workspace`, selected `Minimal Submit App`, filled `hello from playwright 0352`, clicked `Submit`, captured `output/playwright/0352-remote-minimal-submit-app.png`.
- Key output:
- Browser snapshot showed `Submitted: hello from playwright 0352`.
- Result: PASS

- Command: Playwright opened local rendered doc page `http://127.0.0.1:43153/minimal_submit_app_provider_interactive.html`, filled `doc check 0352`, clicked `Submit`, captured `output/playwright/0352-doc-interactive-guide.png`.
- Key output:
- Browser snapshot showed `Submitted: doc check 0352`.
- Browser snapshot showed the live payload preview containing `text = doc check 0352`.
- Result: PASS

### Step 6 - Deploy pipeline remediation

- Observation: remote app deploy updated the ui-server image but initially left mounted persisted assets stale, so Model -10 did not have the slide importer handler available at runtime.
- Fix:
- `scripts/ops/deploy_cloud_app.sh` now syncs authoritative persisted assets by default before rollout.
- `SYNC_PERSISTED_ASSETS=0` is the only supported opt-out.
- `INSTALL_SYSTEM_CA` and `SYNC_PERSISTED_ASSETS` are validated after `cloud.env` is loaded, so invalid env values fail before preflight/sync/build/rollout.
- Commands:
- `node scripts/tests/test_0200_cloud_loader_chain_contract.mjs`
- `node scripts/tests/test_0349_remote_deploy_sync_contract.mjs`
- `node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
- Key output:
- `test_0200_cloud_loader_chain_contract`: `5 passed, 0 failed out of 5`
- `test_0349_remote_deploy_sync_contract`: `PASS`
- `test_0200b_persisted_asset_loader_contract`: `2 passed, 0 failed out of 2`
- Result: PASS

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed: no SSOT behavior change intended.
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed: no base ModelTable contract change intended.
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed: no governance contract change intended.
