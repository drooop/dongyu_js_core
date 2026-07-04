---
title: "Iteration 0437 Bootstrap SSE First Packet Latency Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-07-04
source: ai
iteration_id: 0437-bootstrap-sse-first-packet-latency
id: 0437-bootstrap-sse-first-packet-latency
phase: completed
---

# Iteration 0437-bootstrap-sse-first-packet-latency Runlog

## Environment

- Date: 2026-07-04
- Branch: `dropx/dev_0437-bootstrap-sse-first-packet-latency`
- Runtime: local Orbstack target for final verification

## Execution Records

### Step 1

- Command:
- `git switch -c dropx/dev_0437-bootstrap-sse-first-packet-latency`
- `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0437-bootstrap-sse-first-packet-latency --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output:
- Created iteration docs at `docs/iterations/0437-bootstrap-sse-first-packet-latency/`.
- Registered 0437 in `docs/ITERATIONS.md`.
- Baseline carried from 0436:
  - Bootstrap snapshot: `832.7ms`, `724.4ms`, `779.3ms`, `792.5ms`, `29102` bytes.
  - SSE first `snapshot` event: `730.2ms`, `43421` bytes.
  - App-table visible snapshot after 0436: `14ms`.
  - Host-table visible snapshot after 0436: `15.6ms`.
- Result: In Progress
- Commit:

### Step 2

- Command:
- `node scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs`
- Key output:
- RED: `test_ready_bootstrap_route_uses_scoped_builder_not_full_snapshot`, `test_ready_bootstrap_with_app_ref_route_uses_scoped_builder_not_full_snapshot`, and `test_ready_bootstrap_with_host_ref_route_uses_scoped_builder_not_full_snapshot` failed with `runtime_snapshot_forbidden_for_ready_bootstrap_route`.
- Root stack: `getProfiledClientSnapForRuntime` -> `getClientSnapForRuntime` -> `clientSnap` -> `buildClientSnapshot` -> `runtime.snapshot()`.
- RED: `test_ready_stream_first_snapshot_uses_scoped_builder_not_full_snapshot` connected to SSE, received only `retry: 1000`, then no `snapshot` event because `sendSnapshot(...)` still used the same full snapshot path and closed the stream after the poisoned snapshot call.
- Result: Expected FAIL (RED)
- Commit:

### Step 3

- Command:
- `node scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs`
- `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
- `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
- `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
- Key output:
- `test_0437_bootstrap_sse_first_packet_latency_contract.mjs`: `4 passed, 0 failed`
- `test_0436_runtime_snapshot_build_latency_contract.mjs`: `6 passed, 0 failed`
- `test_0418_visible_snapshot_projection_latency_contract.mjs`: `PASS 8/8`
- `test_0425_visible_model_refs_contract.mjs`: `7 passed, 0 failed out of 7`
- Implementation note: `profile=bootstrap` now builds bootstrap host models and requested table-qualified visible refs directly from runtime models after client/principal filtering; `profile=visible` remains on the 0436 scoped builder; `profile=full` remains on the full snapshot path.
- Result: PASS
- Commit:

### Step 4

- Command:
- `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
- `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
- `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
- `node scripts/tests/test_0425_principal_desktop_state_contract.mjs`
- `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
- `node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs`
- `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
- `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
- `node scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs`
- `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- `npm -C packages/ui-model-demo-frontend run build`
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Playwright CLI session `0437-latency` against `http://localhost:30900/auth/dev/fake-login?user=drop&returnTo=%2F`
- Playwright page-eval browser metrics saved to `output/playwright/0437-bootstrap-sse-first-packet-latency/browser-metrics-eval.txt`
- Playwright color generator check saved to `output/playwright/0437-bootstrap-sse-first-packet-latency/color-generator-eval.txt`
- Playwright screenshot saved to `output/playwright/0437-bootstrap-sse-first-packet-latency/color-generator-after.png`
- `playwright-cli list`
- `kubectl -n dongyu get pods`
- Final quick re-check after review:
  - `node scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs`
  - `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `git diff --check`
- Key output:
- Full regression:
  - `test_0418_visible_snapshot_projection_latency_contract.mjs`: `PASS 8/8`
  - `test_0423_snapshot_granularity_contract.mjs`: `13 passed`
  - `test_0425_visible_model_refs_contract.mjs`: `7 passed, 0 failed out of 7`
  - `test_0425_principal_desktop_state_contract.mjs`: `6 passed`
  - `test_0425_slide_app_subtable_install_contract.mjs`: `5 passed, 0 failed out of 5`
  - `test_0426_snapshot_patch_recovery_contract.mjs`: `4 passed, 0 failed out of 4`
  - `test_0435_visible_snapshot_app_slimming_contract.mjs`: `2 passed, 0 failed`
  - `test_0436_runtime_snapshot_build_latency_contract.mjs`: `6 passed, 0 failed`
  - `test_0437_bootstrap_sse_first_packet_latency_contract.mjs`: `4 passed, 0 failed`
  - `test_0414_snapshot_delta_sse_contract.mjs`: `7 passed`
- Frontend build: `✓ built in 2.93s`
- Local deploy:
  - `ui-server-6c448f445b-nc24z`: `1/1 Running`
  - `mbr-worker-6fff94494-9tplq`: `1/1 Running`
  - `remote-worker-64969569cd-5vrkx`: `1/1 Running`
  - `workspace-manager-7649f66f74-jjc4w`: `1/1 Running`
  - `mosquitto-8458ff74dd-pwp95`: `1/1 Running`
  - `synapse-6f67c89557-x26dn`: `1/1 Running`
- Browser metrics after local deploy:
  - Plain bootstrap: `143.3ms`, `28639` bytes, `6` host models, `0` tables.
  - Bootstrap + App ref: `104.4ms`, `43570` bytes, includes requested table `app:drop:e2e:2-0-20:1`.
  - SSE first `snapshot`: `101.4ms`, `43458` bytes read, includes requested table `app:drop:e2e:2-0-20:1`.
- Improvement against 0436 baseline:
  - Plain bootstrap improved from `724-833ms` to `143.3ms`, about `80-83%`.
  - SSE first `snapshot` improved from `730.2ms` to `101.4ms`, about `86%`.
- Browser functional check:
  - Desktop rendered via fake login.
  - Opened `E2E 颜色生成器`.
  - Clicked `Generate Color`.
  - Displayed color changed from `#45a350` to `#3fc59c`.
- Browser cleanup:
  - `playwright-cli list`: `(no browsers)`.
- Final quick re-check:
  - Fixed the 0437 SSE test reader to wait for a complete SSE event block before parsing JSON. The helper now ignores the final unterminated chunk from `text.split('\n\n')` and includes assertions that partial snapshot blocks are not parsed.
  - `test_0437_bootstrap_sse_first_packet_latency_contract.mjs`: `4 passed, 0 failed`
  - `test_0414_snapshot_delta_sse_contract.mjs`: `7 passed`
  - `test_0418_visible_snapshot_projection_latency_contract.mjs`: `PASS 8/8`
  - `git diff --check`: PASS
- Result: PASS
- Commit:

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed: no semantic contract change required; 0437 only changes bootstrap/SSE response construction.
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed: no user-facing fill-table behavior changed.
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed: no governance rule changed; review-gated iteration flow was followed.

## Review Gate

Review Gate Record
- Iteration ID: 0437-bootstrap-sse-first-packet-latency
- Review Date: 2026-07-04
- Review Type: AI-assisted / sub-agent
- Review Index: 1
- Decision: Approved
- Notes: Sub-agent approved the 0437 plan/resolution. Phase 3 may start.

Review Gate Record
- Iteration ID: 0437-bootstrap-sse-first-packet-latency
- Review Date: 2026-07-04
- Review Type: AI-assisted / sub-agent
- Review Index: 2
- Decision: Approved
- Scope: Step 2 failing-first contract test and RED evidence.
- Notes: Sub-agent approved the Step 2 test/runlog slice with no findings.

Review Gate Record
- Iteration ID: 0437-bootstrap-sse-first-packet-latency
- Review Date: 2026-07-04
- Review Type: AI-assisted / sub-agent
- Review Index: 3
- Decision: Approved
- Scope: Step 3 scoped bootstrap implementation.
- Notes: Sub-agent approved the server/test/runlog slice with no findings.

Review Gate Record
- Iteration ID: 0437-bootstrap-sse-first-packet-latency
- Review Date: 2026-07-04
- Review Type: AI-assisted / sub-agent
- Review Index: 4
- Decision: Approved
- Scope: Final 0437 implementation, tests, runlog, local deploy/browser evidence.
- Notes: Sub-agent approved the final slice with no findings or verification gaps.

Review Gate Record
- Iteration ID: 0437-bootstrap-sse-first-packet-latency
- Review Date: 2026-07-04
- Review Type: AI-assisted / sub-agent
- Review Index: 5
- Decision: Change Requested
- Scope: Final re-review after SSE test-reader adjustment.
- Notes: Sub-agent found that the SSE reader still parsed the final unterminated block from `text.split('\n\n')`.
- Fixes:
  - Added `extractCompletedSseSnapshotBlock(...)` that drops the final unterminated chunk before searching for `event: snapshot`.
  - Added test assertions for partial and complete SSE snapshot blocks.
- Re-verification:
  - `node scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs`: `4 passed, 0 failed`
  - `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`: `7 passed`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`: `PASS 8/8`
  - `git diff --check`: PASS

Review Gate Record
- Iteration ID: 0437-bootstrap-sse-first-packet-latency
- Review Date: 2026-07-04
- Review Type: AI-assisted / sub-agent
- Review Index: 6
- Decision: Approved
- Scope: Final re-review after completed SSE block parser fix.
- Notes: Sub-agent approved the final test/runlog/server slice with no findings or verification gaps.
