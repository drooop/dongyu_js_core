---
id: 0368
title: worker-role-mbr-refill-submit-docs
doc_type: iteration_runlog
status: active
updated: 2026-05-11
source: ai
branch: dev_0368-worker-role-mbr-refill-submit-docs
iteration_id: 0368-worker-role-mbr-refill-submit-docs
phase: phase3
---

# Iteration 0368 Worker Role, MBR Refill, And Minimal Submit Docs Runlog

## Environment

- Date: 2026-05-11
- Branch: `dev_0368-worker-role-mbr-refill-submit-docs`
- Runtime: local macOS development workspace
- Starting point: `692f8da fix(frontend): seed model100 input draft`

## Review Gate Record

- Iteration ID: 0368-worker-role-mbr-refill-submit-docs
- Review Date: 2026-05-11
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: User approved starting this iteration after the readonly audit found active `is_DEM`, `MGMT_OUT`, and direct provider `ctx.publishMqtt` gaps.

## Execution Records

### Step 1 - Planning And Gate

- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0368-worker-role-mbr-refill-submit-docs --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output: scaffold wrote `plan.md`, `resolution.md`, and `runlog.md`.
- Command: `git diff --check`
- Key output: no whitespace errors.
- Review: `codex-code-review` requested unconditional local redeploy wording, `git diff --check` evidence, and execution-governance assessment. All fixes were made; final re-review returned `Decision: APPROVED`.
- Result: PASS
- Commit: `4019771 docs(iteration): plan 0368 worker role refill`

### Step 2/3 - Worker Role Contract And Runtime Enforcement

- Change: Replaced active worker role truth with `k=worker.role, t=str, v="dem"|"worker"` in runtime, UI server bootstrap, local demo/gallery stores, and worker role patches.
- Change: Runtime now rejects removed `is_DEM` labels visibly with `worker_role_label_removed`.
- Change: SSOT/user-guide wording now states `v1n_id` is first trusted-bootstrap write plus explicit maintenance only, and uses project terms for startup order.
- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: initially `6 passed, 0 failed out of 6`; after review fix `7 passed, 0 failed out of 7`.
- Command: `node scripts/tests/test_0364_system_refill_contract.mjs`
- Key output: `6 passed, 0 failed out of 6`.
- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: `31 passed, 0 failed out of 31`.
- Command: `node scripts/tests/test_0364_slide_import_bus_binding_contract.mjs`
- Key output: `2 passed, 0 failed out of 2`.
- Command: `node scripts/tests/test_0364_docs_split_bus_contract.mjs`
- Key output: `4 passed, 0 failed out of 4`.
- Command: `node scripts/validate_builtins_v0.mjs`
- Key output: all builtins PASS, including `v1n_id` lock and removed `pin.connect.model`.
- Command: `rg -n "k\"\\s*:\\s*\"is_DEM\"|is_DEM" packages scripts deploy docs/ssot docs/user-guide test_files -S`
- Key output: only removed-label negative checks and one SSOT removed-label statement remain.
- Command: `git diff --check`
- Key output: no whitespace errors.
- Review: `codex-code-review` requested a guard against downgrading `worker.role` from `"dem"` to `"worker"` after `pin.bus.mb.*` was installed, plus removal of stale 0364 future-tense wording from the user guide. Runtime guard and deterministic test were added; user guide wording was updated.
- Review fix 2: Re-review found `docs/handover/dam-worker-guide.md` still taught removed `pin.bus.in/out` and old connection terms. Updated it to split bus, `pin.connect.cell`, `pin.connect.label`, and `model.submt`; added it to `test_0364_docs_split_bus_contract.mjs`.
- Review: final Step 2/3 re-review returned `Decision: APPROVED`, no findings, no open questions, no verification gaps.
- Result: PASS
- Commit: pending

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` assessed; update required in Step 2.
- [x] `docs/user-guide/modeltable_user_guide.md` assessed; update required in Step 2.
- [x] `docs/ssot/label_type_registry.md` assessed; update likely required for `worker.role` wording.
- [x] `docs/architecture_mantanet_and_workers.md` assessed; update likely required for role terminology.
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed; no update required because this iteration changes runtime/dataflow contracts, not AI execution governance.
