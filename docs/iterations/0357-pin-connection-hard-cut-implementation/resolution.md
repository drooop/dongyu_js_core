---
title: "0357 PIN Connection Hard-Cut Implementation Resolution"
doc_type: iteration_resolution
status: completed
updated: 2026-05-06
source: ai
iteration: 0357-pin-connection-hard-cut-implementation
---

# Iteration 0357 PIN Connection Hard-Cut Implementation Resolution

## Execution Strategy

Follow `docs/plans/2026-05-06-pin-connection-hard-cut-implementation.md` task-by-task:

1. Add RED hard-cut tests.
2. Implement runtime rejection and new bridge semantics.
3. Migrate server generation and policy.
4. Migrate system models and deploy patches.
5. Migrate tests and validators.
6. Run global no-compatibility gate.

## Outcome

0357 is completed.

The runtime now hard-rejects removed PIN connection surfaces instead of accepting compatibility aliases:

- `pin.connect.model`
- prefix endpoints such as `(self, x)` / `(func, f:in)` / numeric prefixes
- `pin.log.*`
- function endpoints inside `pin.connect.cell`
- function-shaped endpoints inside `pin.connect.cell`, even when no same-Cell function exists
- undeclared target Cell pins in `pin.connect.cell`

Cross-model routing is expressed through `model.submt` hosting Cell boundary pins plus same-model `pin.connect.cell`. Formal pin payloads remain ModelTable-like record arrays.

The server, system-model assets, deploy patches, active tests, and SSOT/user-guide wording were migrated to the hard-cut contract. Inactive `*.legacy.json` system-model archives that still carried removed ctx / legacy PIN code were deleted.

## Step 1 — RED Contract Tests

Files:

- `scripts/tests/test_0357_pin_connection_hard_cut.mjs`

Verification:

- `node scripts/tests/test_0357_pin_connection_hard_cut.mjs` must fail before runtime changes.

Acceptance:

- Failure proves old runtime still accepts deleted syntax.

Rollback:

- Delete the new test file before production changes.

## Step 2 — Runtime Hard-Cut

Files:

- `packages/worker-base/src/runtime.mjs`

Verification:

- `node scripts/tests/test_0357_pin_connection_hard_cut.mjs`
- `node scripts/tests/test_cell_connect_parse.mjs`
- `node scripts/tests/test_submodel_connect.mjs`

Acceptance:

- New contract passes; old syntax is rejected.

Rollback:

- Revert runtime changes and new tests.

## Step 3 — Server / Policy Migration

Files:

- `packages/ui-model-demo-server/server.mjs`
- `packages/ui-model-demo-server/filltable_policy.mjs`

Verification:

- Server-related contract tests that cover imported host ingress/egress and slide importer repair pass.

Acceptance:

- Server no longer emits `pin.connect.model` or prefix endpoints.

Rollback:

- Revert Step 3 files only if Step 2 remains green.

## Step 4 — Asset And Test Migration

Files:

- `packages/worker-base/system-models/**`
- `deploy/sys-v1ns/**`
- `scripts/tests/**`
- `scripts/validate_*.mjs`

Verification:

- Targeted test matrix from the implementation plan passes.

Acceptance:

- `packages/`, `deploy/`, and `scripts/` have zero removed syntax matches.

Rollback:

- Revert asset/test migration with runtime rollback if tests cannot be restored without compatibility.

## Step 5 — Completion Gate

Verification:

```bash
git diff --check
rg -n "pin\.connect\.model|\(self,|\(func,|\([0-9-]+, [^)]+\)|pin\.log\.|:log\.out" packages deploy scripts --glob '!node_modules/**' --glob '!dist/**' --glob '!output/**' --glob '!logs/**' -S
```

Acceptance:

- All checks PASS and runlog records evidence.

Final verification evidence is recorded in `runlog.md` Step 5:

- 38 targeted tests PASS.
- Syntax checks PASS.
- Validators PASS.
- JSON parse check PASS.
- Active asset grep has no removed PIN / ctx label API matches.
- `model.submt` duplicate mount check PASS.
