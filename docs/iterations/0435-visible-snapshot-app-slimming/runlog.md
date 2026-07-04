---
title: "Iteration 0435 Visible Snapshot App Slimming Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-07-03
source: ai
iteration_id: 0435-visible-snapshot-app-slimming
id: 0435-visible-snapshot-app-slimming
phase: completed
---

# Iteration 0435-visible-snapshot-app-slimming Runlog

## Environment

- Date: 2026-07-03
- Branch: `dropx/dev_0435-visible-snapshot-app-slimming`
- Runtime: local UI Server / OrbStack stack
- Worktree note: this branch intentionally inherited a dirty 0434/earlier worktree with existing production-code changes. 0435 Step 1 is RED-only; its write scope is limited to `docs/ITERATIONS.md`, `docs/iterations/0435-visible-snapshot-app-slimming/*`, and `scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`.

## Execution Records

Review Gate Record
- Iteration ID: 0435-visible-snapshot-app-slimming
- Review Date: 2026-07-03
- Review Type: AI-assisted
- Review Index: 1
- Decision: Change Requested
- Notes: Sub-agent review requested moving baseline facts out of PASS execution wording, adding reproducible measurement commands, and explicitly checking no `profile=full` request.

Review Gate Record
- Iteration ID: 0435-visible-snapshot-app-slimming
- Review Date: 2026-07-03
- Review Type: AI-assisted
- Review Index: 2
- Decision: Change Requested
- Notes: Sub-agent re-review confirmed baseline is no longer a Phase 3 PASS record and Step 4 includes no `profile=full` verification, but requested removing the non-standard Pending gate status and replacing the Playwright measurement placeholder with a copy-pastable command.

Review Gate Record
- Iteration ID: 0435-visible-snapshot-app-slimming
- Review Date: 2026-07-03
- Review Type: User
- Review Index: 3
- Decision: Approved
- Notes: User approved continuing with the next plan. Sub-agent findings from review 1 and review 2 were addressed before recording this gate.

### Pre-iteration diagnostic baseline captured before Phase 3

- Command:
  - These facts were gathered while diagnosing the user's reported localhost slowness before opening 0435. They are baseline context, not Phase 3 verification.
  - CWD: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - HTTP root command:
    - `curl -sS -o /tmp/dy_root.html -w 'root_http_code=%{http_code} dns=%{time_namelookup} connect=%{time_connect} ttfb=%{time_starttransfer} total=%{time_total} size=%{size_download}\n' http://localhost:30900/ && wc -c /tmp/dy_root.html`
  - Browser measurement setup:
    - `export CODEX_HOME="$HOME/.codex" PWCLI="$HOME/.codex/skills/playwright/scripts/playwright_cli.sh"`
    - `bash scripts/ops/playwright_session_guard.sh cleanup`
    - `bash scripts/ops/playwright_session_guard.sh session open http://localhost:30900 --headed`
    - Browser actions: `Fake Drop` -> open `E2E 颜色生成器` -> click `Generate Color`.
  - Snapshot measurement command pattern:
    - `bash scripts/ops/playwright_session_guard.sh session eval 'async () => { async function timedFetch(url) { const t0 = performance.now(); const r = await fetch(url, { credentials: "include" }); const txt = await r.text(); const t1 = performance.now(); let data = null; try { data = JSON.parse(txt); } catch {} return { url, status: r.status, ms: Number((t1 - t0).toFixed(1)), bytes: txt.length, timing: data && data.timing ? data.timing : null, models: data && data.snapshot && data.snapshot.models ? Object.keys(data.snapshot.models) : [], tables: data && data.snapshot && data.snapshot.tables ? Object.keys(data.snapshot.tables) : [] }; } const ref = encodeURIComponent(JSON.stringify({ table_id: "app:drop:e2e:2-0-20:1", model_id: 0 })); const out = []; for (let i = 0; i < 3; i += 1) out.push(await timedFetch("/snapshot?profile=bootstrap&initial_projection=1")); for (let i = 0; i < 3; i += 1) out.push(await timedFetch(`/snapshot?profile=visible&visible_model_ref=${ref}`)); return JSON.stringify(out, null, 2); }'`
  - Cleanup:
    - `bash scripts/ops/playwright_session_guard.sh cleanup`
- Key output:
  - HTTP root: `200`, total about `0.0025s`, size `397`.
  - Browser nav load: about `121ms`.
  - `/auth/me`: about `2.8ms`.
  - `/snapshot?profile=bootstrap&initial_projection=1`: repeated about `705ms / 787ms / 714ms`, size about `29KB`.
  - `/snapshot?profile=visible&visible_model_ref={"table_id":"app:drop:e2e:2-0-20:1","model_id":0}`: repeated about `782ms / 782ms / 718ms`, size about `44KB`.
  - Visible snapshot included host models `0`, `-102`, `-29`, `-28`, `-2`, `-1` plus App table `app:drop:e2e:2-0-20:1`.
  - E2E `Generate Color`: about `3.54s-3.74s` end-to-end; `/bus_event` about `1.51s-1.74s`.
  - Playwright cleanup: `PASS: no project Playwright session or project Playwright-managed browser process remains for dy-0400`.
- Result: Diagnostic baseline only. Phase 3 verification will rerun comparable commands after implementation.
- Commit:

### Step 1 — RED contract for visible App snapshot boundary

- Command:
  - `git ls-files --others --exclude-standard docs/iterations/0435-visible-snapshot-app-slimming scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs && git diff --name-only -- docs/ITERATIONS.md`
  - `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
- Key output:
  - Step 1 file scope:
    - `docs/iterations/0435-visible-snapshot-app-slimming/plan.md`
    - `docs/iterations/0435-visible-snapshot-app-slimming/resolution.md`
    - `docs/iterations/0435-visible-snapshot-app-slimming/runlog.md`
    - `scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
    - `docs/ITERATIONS.md`
  - `FAIL test_visible_profile_for_app_table_is_target_only`
  - `profile=visible for an App table must not repeat host bootstrap models; actual=["-2","-28","0"]`
  - `PASS test_bootstrap_with_visible_app_table_still_combines_shell_and_visible_model`
- Result: PASS — RED failure matched the expected broad visible payload behavior.
- Commit:

### Step 2 — Server profile fix and regression coverage

- Command:
  - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
  - `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
- Key output:
  - Root cause: explicit `profile=visible` reused bootstrap host allow-list, so App table visible snapshots repeated host shell models; startup seeded App subtable refresh also wrote derived projection labels into SQLite after persistence was re-enabled.
  - Fix:
    - `buildClientSnapshotProfile(..., { profile: "visible" })` now starts from an empty allow-list and only adds the requested visible ref.
    - `profile=bootstrap` keeps the existing shell allow-list, so bootstrap + visible App still returns shell + target App.
    - startup seeded App materialization and derived refresh now run under `withRuntimePersistenceDisabled(...)`, so startup-only projection/system seed rows do not pollute persistent user DBs.
  - `PASS test_0423_snapshot_granularity_contract: 13 passed`
  - `PASS test_visible_profile_for_app_table_is_target_only`
  - `PASS test_bootstrap_with_visible_app_table_still_combines_shell_and_visible_model`
  - `2 passed, 0 failed`
  - `PASS 8/8`
- Result: PASS
- Commit:

### Step 3 — Frontend merge contract and local build

- Command:
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - `PASS 8/8`
  - `PASS test_0423_snapshot_granularity_contract: 13 passed`
  - `vite v5.4.21 building for production...`
  - `✓ 1463 modules transformed.`
  - `✓ built in 3.30s`
  - Existing warning: `Some chunks are larger than 500 kB after minification.`
- Result: PASS
- Commit:

### Step 4 — Local deployment and browser performance verification

- Command:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/playwright_session_guard.sh cleanup`
  - `bash scripts/ops/playwright_session_guard.sh session open http://localhost:30900 --headed`
  - `bash scripts/ops/playwright_session_guard.sh session snapshot`
  - Browser actions:
    - click `Fake Drop`;
    - measure `/`, `/auth/me`, `/snapshot?profile=bootstrap&initial_projection=1`, and `/snapshot?profile=visible&visible_model_ref={"table_id":"app:drop:e2e:2-0-20:1","model_id":0}` through page `fetch`;
    - click `E2E 颜色生成器`;
    - click `Generate Color` and wait until visible color text changes;
    - inspect Playwright network requests and `/bus_event` request/response body.
  - `bash scripts/ops/playwright_session_guard.sh check-clean`
- Key output:
  - Local deploy:
    - `deployment "remote-worker" successfully rolled out`
    - `deployment "workspace-manager" successfully rolled out`
    - `deployment "mbr-worker" successfully rolled out`
    - `deployment "ui-server" successfully rolled out`
    - `UI Server: http://localhost:30900`
  - Login:
    - `Fake Drop` login succeeded.
    - `/auth/me`: `200`, about `1.4ms`, principal `dev-fake:drop`.
  - Browser snapshot measurements:
    - `/`: `200`, about `2.0ms`, `397` bytes.
    - `/snapshot?profile=bootstrap&initial_projection=1`: about `722.5ms / 703.6ms / 696.1ms`, `28639` bytes, host models `-1,-102,-2,-28,-29,0`.
    - `/snapshot?profile=visible&visible_model_ref={"table_id":"app:drop:e2e:2-0-20:1","model_id":0}`: about `762.9ms / 717.5ms / 717.1ms`, `15285` bytes, host `models=[]`, tables `{ "app:drop:e2e:2-0-20:1": ["0"] }`.
    - Before/after vs pre-iteration diagnostic baseline:
      - visible bytes: about `44KB` -> `15.3KB` (about `65%` smaller).
      - visible duration: about `718-782ms` -> `717-763ms` (roughly unchanged).
      - Interpretation: 0435 removed duplicated host payload; remaining snapshot latency is dominated by runtime snapshot/build work rather than response body transfer size.
  - E2E interaction:
    - App opened as `E2E 颜色生成器`, header `Workspace app · model 0`.
    - Displayed path includes `Model 0 mt_bus_send / pin.bus.cb.out -> MBR`, `MQTT UIPUT/.../R1/100/submit -> RemoteWorker R1 / Model 100 / submit`, and `response_topic -> MBR`.
    - `Generate Color` changed visible color from `#068855` to `#eaf473`.
    - Browser-observed color-change duration: about `3740.7ms`.
    - `/bus_event`: `200`, browser request duration `1592ms`.
    - `/bus_event` response timing: `server_queue_wait_ms=0.011`, `server_duration_ms=596.637`, `server_total_ms=596.648`, `bus_event_error=null`.
  - Normal-path request inspection:
    - Network requests included `profile=bootstrap`, `profile=visible`, `/ui_event`, and `/bus_event`.
    - No request contained `profile=full`.
  - Cleanup:
    - `PASS: no project Playwright session or project Playwright-managed browser process remains for dy-0400`
- Result: PASS
- Commit:

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed — no SSOT wording change required; this iteration narrows an existing server snapshot profile implementation and does not introduce a new ModelTable label/authoring contract.
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed — no developer-facing table-writing change required.
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed — no workflow/governance change required.

## Final Verification

- Command:
  - `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - `2 passed, 0 failed`
  - `PASS 8/8`
  - `PASS test_0423_snapshot_granularity_contract: 13 passed`
  - `✓ built in 3.31s`
- Review gates:
  - Step 2 sub-agent review: `Decision: APPROVED`, no findings, no verification gaps.
  - Step 3 sub-agent review: `Decision: APPROVED`, no findings, no verification gaps.
  - Step 4 sub-agent review: `Decision: APPROVED`, no findings, no verification gaps.
- Final status: `Completed`.
