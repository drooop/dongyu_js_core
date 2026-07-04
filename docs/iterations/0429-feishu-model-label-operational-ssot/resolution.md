---
title: "Iteration 0429 Feishu Model Label Operational SSOT Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-07-01
source: ai
iteration_id: 0429-feishu-model-label-operational-ssot
id: 0429-feishu-model-label-operational-ssot
phase: planning
---

# Iteration 0429-feishu-model-label-operational-ssot Resolution

## Execution Strategy

This iteration is Phase1 / planning-only. It does not authorize runtime,
fill-table, user-guide, deployment, or browser-test implementation. It only
freezes the implementation blueprint that a follow-up Approved execution
iteration should use.

The follow-up implementation iteration must execute in small stages. After each
stage, spawn a sub-agent with `codex-code-review`, fix findings, and only then
move to the next stage.

## 0429 Planning Steps

### Step 1: Source And Current Contract Review

- Scope:
  - Read 0428 SSOT and the operational SSOT files that will be affected later.
  - Confirm that 0429 should not modify those operational SSOT files.
- Files:
  - Read: `docs/ssot/feishu_model_label_alignment_v1.md`
  - Read: `docs/iterations/0428-feishu-model-label-ssot-plan/resolution.md`
  - Read: `docs/ssot/label_type_registry.md`
  - Read: `docs/ssot/runtime_semantics_modeltable_driven.md`
  - Read: `docs/ssot/pin_connection_contract_v2.md`
  - Read: `docs/ssot/temporary_modeltable_payload_v1.md`
  - Read: `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
- Verification:
  - `rg -n "pin_payload.v1|pin_payload.v2|model.v1n|model.subtableconnection|model.submtconnection|pin.connect.model|payload\\.v|bundle_payload\\.v" docs/ssot docs/user-guide`
- Acceptance:
  - Affected operational SSOT areas are listed in the future blueprint.
  - No operational SSOT files are changed in 0429.
- Rollback:
  - Remove the 0429 iteration folder and `docs/ITERATIONS.md` row.

### Step 2: Freeze Follow-Up Implementation Blueprint

- Scope:
  - Define a future execution-stage plan for operational SSOT propagation,
    validators/tests, runtime/server hard-cut, fill-table refit, developer docs,
    and local browser E2E.
  - Keep all implementation work explicitly out of 0429.
- Files:
  - Modify: `docs/iterations/0429-feishu-model-label-operational-ssot/plan.md`
  - Modify:
    `docs/iterations/0429-feishu-model-label-operational-ssot/resolution.md`
  - Modify: `docs/iterations/0429-feishu-model-label-operational-ssot/runlog.md`
  - Modify: `docs/ITERATIONS.md`
- Verification:
  - `rg -n "0429-feishu-model-label-operational-ssot|pin_payload.v2|planning-only|follow-up implementation" docs/ITERATIONS.md docs/iterations/0429-feishu-model-label-operational-ssot`
  - `git diff --check -- docs/ITERATIONS.md docs/iterations/0429-feishu-model-label-operational-ssot`
- Acceptance:
  - The plan says 0429 is planning-only.
  - The future implementation stages have file scopes, verification commands,
    acceptance criteria, and rollback notes.
  - The future implementation stages cannot be read as authorized by the 0429
    Review Gate alone.
- Rollback:
  - Revert the 0429 planning docs and registry row.

### Step 3: Review Gate

- Scope:
  - Run sub-agent review for this planning diff.
  - Fix all Change Requested findings.
- Files:
  - Modify: `docs/iterations/0429-feishu-model-label-operational-ssot/runlog.md`
- Verification:
  - Sub-agent final decision is `APPROVED`.
  - `git diff --check -- docs/ITERATIONS.md docs/iterations/0429-feishu-model-label-operational-ssot`
- Acceptance:
  - Runlog records review decision and local checks.
- Rollback:
  - Revert review-record-only edits if review must be restarted.

## Future Implementation Blueprint

The stages below are not executed in 0429. They are the proposed structure for a
follow-up implementation iteration after explicit approval.

### Future Stage 1: Operational SSOT Propagation

- Scope:
  - Update operational SSOT docs so they no longer merely point to 0428 as a
    future target.
  - Make `pin_payload.v2` the named target for formal non-nested bus/pin
    transport.
  - Map Feishu `origin_pin` / `endpoint_pin` / `response_pin` topic examples
    to project `topic` / `response_topic` plus structured endpoint/origin/reply
    target records.
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
- Acceptance:
  - Current operational SSOTs clearly say rejected labels are not accepted
    project input.
  - Formal transport examples use `pin_payload.v2` or explicitly state old
    examples are historical/current implementation debt.
  - No operational SSOT tells developers to put a ModelTable record array inside
    `payload.v`, `bundle_payload.v`, or another `json` label for formal
    bus/pin payloads.
- Rollback:
  - Revert the SSOT doc edits for this stage.

### Future Stage 2: Validation Contract And Failing Tests

- Scope:
  - Add tests before runtime changes.
  - Tests must prove stale label types and stale nested formal transport shapes
    are rejected.
  - Tests must prove the target `pin_payload.v2` record-array shape is accepted
    by validators.
- Files:
  - Modify or create: `scripts/tests/test_*pin_payload*_*.mjs`
  - Modify or create: `scripts/tests/test_*label*_*.mjs`
  - Modify or create: `scripts/validate_*`
  - Assess: `packages/ui-model-demo-server/server.mjs`
  - Assess: `packages/worker-base/src/runtime.js`
  - Assess: `packages/worker-base/src/runtime.mjs`
- Verification:
  - Run the newly added tests and confirm the first run fails before
    implementation.
  - `node scripts/tests/test_program_model_loader_v0.mjs`
  - `node scripts/tests/test_bus_in_out.mjs`
- Acceptance:
  - Tests fail for missing `pin_payload.v2` support or missing hard rejection
    before runtime updates.
  - Tests explicitly cover:
    - `model.v1n`
    - `model.subtableconnection`
    - `model.submtconnection`
    - `pin.connect.model`
    - nested formal ModelTable records inside `json` labels
    - missing `origin_table_id` / `reply_target_table_id` for App instance
      traffic.
- Rollback:
  - Revert new tests and validator scaffolding.

### Future Stage 3: Runtime And Server Hard-Cut

- Scope:
  - Implement the minimum runtime/server changes to make Stage 2 tests pass.
  - Use a single target path for formal transport: `pin_payload.v2` as a
    Temporary ModelTable record array with envelope and payload records in the
    same array.
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
- Rollback:
  - Revert runtime/server edits and keep failing tests for rework, or revert
    the entire stage if implementation proves invalid.

### Future Stage 4: Fill-Table And Built-In Model Refit

- Scope:
  - Refill project-owned workers and built-in/system model assets to use the
    target shape.
  - Remove stale `pin_payload.v1` formal examples from active Tier2 assets
    unless they are explicitly marked historical.
- Files:
  - Modify: `deploy/sys-v1ns/mbr/patches/**`
  - Modify: `deploy/sys-v1ns/remote-worker/patches/**`
  - Modify: `deploy/sys-v1ns/workspace-manager/patches/**`
  - Modify: `packages/worker-base/system-models/**`
  - Modify: slide App payload examples under `docs/user-guide/**` as needed.
- Verification:
  - Run validators that load the changed patches.
  - Run targeted scripts for MBR, Workspace Manager, and imported App contracts.
  - `rg -n "pin_payload.v1|payload'\\s*,\\s*'json'|bundle_payload|model.v1n|model.subtableconnection|model.submtconnection|pin.connect.model" deploy packages/worker-base/system-models docs/user-guide`
- Acceptance:
  - Active fill-table patches use `pin_payload.v2` / non-nested formal
    Temporary ModelTable message shape.
  - Active fill-table patches do not require compatibility parsing of old
    nested formal payloads.
  - MBR routing still uses `topic` as transport truth and `response_topic` for
    replies.
- Rollback:
  - Revert patch/model asset edits for this stage.

### Future Stage 5: Slide App Examples And Developer Docs

- Scope:
  - Update Minimal Submit, E2E Color Generator, To Do Board, and provider-owned
    install examples to the target payload shape.
  - Explain to developers how to express outbound submit, inbound response, and
    UI materialization without nested JSON patch payloads.
- Files:
  - Modify: `docs/user-guide/slide-app-runtime/**`
  - Modify: `docs/user-guide/**ui*` docs discovered in Future Stage 1.
  - Modify example JSON payloads discovered by `rg`.
- Verification:
  - `rg -n "pin_payload.v1|payload\\.v|bundle_payload\\.v|json_patch|model_id.*developer" docs/user-guide`
  - Validate example JSON files with the existing JSON validators or `node -e`
    parse checks.
- Acceptance:
  - Developer docs explain the exact labels required for submit-style buttons,
    response materialization, and provider bundle install.
  - Developer examples do not ask App authors to fill deployment-assigned
    `model_id` / `table_id` as authority.
- Rollback:
  - Revert docs/example edits for this stage.

### Future Stage 6: Local Deployment And Browser E2E

- Scope:
  - Deploy locally after Future Stages 1-5 pass.
  - Use real browser testing, not script-only verification.
- Files:
  - No planned source files unless test failures require fixes.
  - Store screenshots or evidence under the follow-up iteration `assets/`
    folder if visual proof is needed.
- Verification:
  - Local baseline:
    - `bash scripts/ops/check_runtime_baseline.sh`
    - `bash scripts/ops/ensure_runtime_baseline.sh`
  - Browser:
    - Open `http://127.0.0.1:30900/#/workspace` or the current local entry.
    - Install/open Minimal Submit.
    - Submit request and observe response materialization.
    - Open E2E Color Generator and confirm color changes after Generate.
    - Open provider-owned install flow from Workspace Manager and confirm
      install/open/submit path.
- Acceptance:
  - Minimal Submit request and response complete through the refit bus path.
  - E2E Color Generator changes visible color after Generate.
  - Provider-owned install produces a visible installed App and can open it.
  - Browser evidence is recorded in runlog with command/output or screenshot
    path.
- Rollback:
  - Revert code/fill-table changes from earlier stages and redeploy previous
    local baseline.

### Future Stage 7: Completion And Merge Prep

- Scope:
  - Record all stage evidence.
  - Run final sub-agent review.
  - Update iteration status only after all execution-stage checks pass.
- Files:
  - Modify: future implementation iteration `runlog.md`
  - Modify: `docs/ITERATIONS.md`
- Verification:
  - `git status --short`
  - `git diff --check`
  - Final command set from Future Stages 1-6.
- Acceptance:
  - All resolution stages have PASS records and review notes.
  - `docs/ITERATIONS.md` is accurate.
  - Worktree is ready for the user-requested merge flow.
- Rollback:
  - Restore `docs/ITERATIONS.md` status and leave branch unmerged.

## Notes

- If Future Stage 3 shows that `pin_payload.v2` cannot be hard-cut without a
  larger migration window, the implementation iteration must stop and move to
  Change Requested rather than adding compatibility parsing.
