---
title: "Iteration 0430 Feishu Operational SSOT Implementation Resolution"
doc_type: iteration-resolution
status: in-progress
updated: 2026-07-01
source: ai
iteration_id: 0430-feishu-operational-ssot-impl
id: 0430-feishu-operational-ssot-impl
phase: execution
---

# Iteration 0430-feishu-operational-ssot-impl Resolution

## Execution Strategy

Execute the 0429 future blueprint as a real implementation iteration. Each
stage must end with deterministic checks and a sub-agent review using
`codex-code-review`. If review requests changes, fix them before the next
stage. Do not add compatibility parsing for stale labels or stale formal
payloads.

## Stage 0: Review Gate And Baseline

- Scope:
  - Register 0430 in `docs/ITERATIONS.md`.
  - Record user approval and sub-agent planning review.
  - Capture baseline search results before code changes.
- Files:
  - Modify: `docs/ITERATIONS.md`
  - Modify: `docs/iterations/0430-feishu-operational-ssot-impl/plan.md`
  - Modify: `docs/iterations/0430-feishu-operational-ssot-impl/resolution.md`
  - Modify: `docs/iterations/0430-feishu-operational-ssot-impl/runlog.md`
- Verification:
  - `git diff --check -- docs/ITERATIONS.md docs/iterations/0430-feishu-operational-ssot-impl`
  - `rg -n --glob '!runlog.md' "\\[(TO)DO\\]|Descri[b]e the iteration objective|Explai[n] implementation approach|PLACEHOLD[E]R|pendin[g]" docs/iterations/0430-feishu-operational-ssot-impl docs/ITERATIONS.md`
- Acceptance:
  - 0430 is registered as `In Progress`.
  - Sub-agent planning review is `APPROVED`.
  - Baseline evidence is recorded.
- Rollback:
  - Remove 0430 iteration docs and registry row.

## Stage 1: Operational SSOT Propagation

- Scope:
  - Update operational SSOT docs so 0428 target is current operational wording.
  - Make `pin_payload.v2` the named target for formal non-nested bus/pin
    transport.
  - Map Feishu full-topic `origin_pin` / `endpoint_pin` / `response_pin`
    examples to project `topic` / `response_topic` plus structured
    endpoint/origin/reply-target records.
- Files:
  - Modify: `docs/ssot/label_type_registry.md`
  - Modify: `docs/ssot/runtime_semantics_modeltable_driven.md`
  - Modify: `docs/ssot/pin_connection_contract_v2.md`
  - Modify: `docs/ssot/temporary_modeltable_payload_v1.md`
  - Modify: `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - Assess: `docs/user-guide/modeltable_user_guide.md`
- Verification:
  - `rg -n "model.v1n|model.subtableconnection|model.submtconnection|pin.connect.model|pin_payload.v1|pin_payload.v2|payload\\.v|bundle_payload\\.v" docs/ssot docs/user-guide`
  - `git diff --check -- docs/ssot docs/user-guide`
  - `node scripts/ops/obsidian_docs_migrate.mjs --root docs --phase all`
- Acceptance:
  - Operational SSOTs clearly reject stale labels as current project input.
  - Formal transport examples use `pin_payload.v2` or mark older shapes as
    historical implementation debt.
  - No operational SSOT instructs developers to put a ModelTable record array
    inside `payload.v`, `bundle_payload.v`, or another `json` label for formal
    bus/pin payloads.
- Review:
  - Run sub-agent review for Stage 1 diff.
- Rollback:
  - Revert Stage 1 doc edits.

## Stage 2: Validation Contract And Failing Tests

- Scope:
  - Add tests before runtime changes.
  - Tests must prove stale label types and stale nested formal transport shapes
    are rejected.
  - Tests must prove target `pin_payload.v2` record-array shape is accepted by
    validators.
- Files:
  - Modify or create: `scripts/tests/test_*pin_payload*_*.mjs`
  - Modify or create: `scripts/tests/test_*label*_*.mjs`
  - Modify or create: `scripts/validate_*`
  - Assess: `packages/ui-model-demo-server/server.mjs`
  - Assess: `packages/worker-base/src/runtime.js`
  - Assess: `packages/worker-base/src/runtime.mjs`
- Verification:
  - Run newly added tests and confirm the first run fails before implementation.
  - `node scripts/tests/test_program_model_loader_v0.mjs`
  - `node scripts/tests/test_bus_in_out.mjs`
- Acceptance:
  - Tests fail before implementation for the intended reason.
  - Tests explicitly cover:
    - `model.v1n`
    - `model.subtableconnection`
    - `model.submtconnection`
    - `pin.connect.model`
    - nested formal ModelTable records inside `json` labels
    - missing `origin_table_id` / `reply_target_table_id` for App instance
      traffic.
- Review:
  - Run sub-agent review for test coverage before runtime changes.
- Rollback:
  - Revert new tests and validator scaffolding.

## Stage 3: Runtime And Server Hard-Cut

- Scope:
  - Implement the minimum runtime/server changes to make Stage 2 tests pass.
  - Use a single target path for formal transport:
    `pin_payload.v2` Temporary ModelTable record array with envelope and
    payload records in the same array.
  - Remove or hard-reject compatibility fallbacks for old nested formal shapes.
- Files:
  - Modify: `packages/worker-base/src/runtime.js`
  - Modify: `packages/worker-base/src/runtime.mjs`
  - Modify: `packages/ui-model-demo-server/server.mjs`
  - Modify relevant runtime/system-model validators discovered in Stage 2.
- Verification:
  - Run Stage 2 tests until PASS.
  - `node scripts/tests/test_cell_connect_parse.mjs`
  - `node scripts/tests/test_bus_in_out.mjs`
  - `node scripts/validate_builtins_v0.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
- Acceptance:
  - Runtime rejects stale labels and stale formal nested payloads.
  - Runtime/server accepts only the target non-nested formal transport path for
    newly refit flows.
  - CJS and ESM runtime files remain behavior-aligned.
- Review:
  - Run sub-agent review for runtime/server diff.
- Rollback:
  - Revert Stage 3 runtime/server edits.

## Stage 4: Fill-Table And Built-In Model Refit

- Scope:
  - Refill project-owned workers and built-in/system model assets to use the
    target shape.
  - Remove stale `pin_payload.v1` formal examples from active Tier2 assets
    unless explicitly marked historical.
- Files:
  - Modify: `deploy/sys-v1ns/mbr/patches/**`
  - Modify: `deploy/sys-v1ns/remote-worker/patches/**`
  - Modify: `deploy/sys-v1ns/workspace-manager/patches/**`
  - Modify: `packages/worker-base/system-models/**`
  - Modify: slide App payload examples under `docs/user-guide/**` as needed.
- Verification:
  - Run validators that load changed patches.
  - Run targeted scripts for MBR, Workspace Manager, and imported App contracts.
  - `rg -n "pin_payload.v1|payload'\\s*,\\s*'json'|bundle_payload|model.v1n|model.subtableconnection|model.submtconnection|pin.connect.model" deploy packages/worker-base/system-models docs/user-guide`
- Acceptance:
  - Active fill-table patches use `pin_payload.v2` / non-nested formal
    Temporary ModelTable message shape.
  - Active fill-table patches do not require compatibility parsing of old
    nested formal payloads.
  - MBR routing still uses `topic` as transport truth and `response_topic` for
    replies.
- Review:
  - Run sub-agent review for fill-table refit.
- Rollback:
  - Revert Stage 4 patch/model asset edits.

## Stage 5: Slide App Examples And Developer Docs

- Scope:
  - Update Minimal Submit, E2E Color Generator, To Do Board, and provider-owned
    install examples to the target payload shape.
  - Explain outbound submit, inbound response, and UI materialization without
    nested JSON patch payloads.
- Files:
  - Modify: `docs/user-guide/slide-app-runtime/**`
  - Modify: `docs/user-guide/**ui*` docs discovered in Stage 1.
  - Modify example JSON payloads discovered by `rg`.
- Verification:
  - `rg -n "pin_payload.v1|payload\\.v|bundle_payload\\.v|json_patch|model_id.*developer" docs/user-guide`
  - Validate example JSON files with existing JSON validators or `node -e`
    parse checks.
- Acceptance:
  - Developer docs explain exact labels for submit-style buttons, response
    materialization, and provider bundle install.
  - Developer examples do not ask App authors to fill deployment-assigned
    `model_id` / `table_id` as authority.
- Review:
  - Run sub-agent review for docs/examples.
- Rollback:
  - Revert Stage 5 docs/example edits.

## Stage 6: Local Deployment And Browser E2E

- Scope:
  - Deploy locally after Stages 1-5 pass.
  - Use real browser testing, not script-only verification.
- Files:
  - No planned source files unless failures require fixes.
  - Store screenshots or evidence under
    `docs/iterations/0430-feishu-operational-ssot-impl/assets/` if needed.
- Verification:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `bash scripts/ops/ensure_runtime_baseline.sh`
  - Browser:
    - Open `http://127.0.0.1:30900/#/workspace` or current local entry.
    - Install/open Minimal Submit.
    - Submit request and observe response materialization.
    - Open E2E Color Generator and confirm color changes after Generate.
    - Open provider-owned install flow from Workspace Manager and confirm
      install/open/submit path.
- Acceptance:
  - Minimal Submit request/response completes through refit bus path.
  - E2E Color Generator visibly changes color after Generate.
  - Provider-owned install produces a visible installed App and can open it.
  - Browser evidence is recorded in runlog.
- Review:
  - Run sub-agent review for E2E evidence and residual risks.
- Rollback:
  - Revert code/fill-table changes and redeploy previous local baseline.

## Stage 7: Completion

- Scope:
  - Record all stage evidence.
  - Run final sub-agent review.
  - Update `docs/ITERATIONS.md` only after all checks pass.
- Files:
  - Modify: `docs/iterations/0430-feishu-operational-ssot-impl/runlog.md`
  - Modify: `docs/ITERATIONS.md`
- Verification:
  - `git status --short`
  - `git diff --check`
  - Final command set from Stages 1-6.
- Acceptance:
  - All stages have PASS records and review notes.
  - Final sub-agent review is `APPROVED`.
  - `docs/ITERATIONS.md` status is accurate.
- Review:
  - Run final full-iteration sub-agent review.
- Rollback:
  - Restore `docs/ITERATIONS.md` status and leave branch unmerged.

## Notes

- If Stage 3 shows that `pin_payload.v2` cannot be hard-cut without a larger
  migration window, stop and mark Change Requested rather than adding
  compatibility parsing.
