---
title: "PIN Connection Hard-Cut Implementation Plan"
doc_type: implementation-plan
status: completed
updated: 2026-05-06
project: dongyuapp
source: ai
---

# PIN Connection Hard-Cut Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the 0356 PIN Connection Contract v2 without compatibility aliases or fallback paths.

**Architecture:** Runtime accepts only direct `pin.connect.label` endpoints and same-model `pin.connect.cell` routes. Cross-model communication is expressed through `model.submt` hosting Cell boundary pins plus `pin.connect.cell`, not `pin.connect.model`. Log pins use `pin.login` / `pin.logout`; `pin.log.*` is rejected.

**Tech Stack:** Node.js ESM tests, `ModelTableRuntime`, ui-model-demo-server host adapter generation, JSON system-model assets.

---

### Task 1: RED Test For Runtime Hard-Cut Contract

**Files:**
- Create: `scripts/tests/test_0357_pin_connection_hard_cut.mjs`
- Modify later: `packages/worker-base/src/runtime.mjs`

**Step 1: Write failing test**

Add tests covering:

- `pin.connect.model` writes are rejected and do not create a routing table.
- `pin.connect.label` accepts direct endpoints such as `cmd -> process:in` and `process:out -> result`.
- Old endpoints `(self, cmd)`, `(func, process:in)`, and numeric prefixes are rejected.
- `pin.connect.cell` rejects function endpoints such as `[1,0,0,"process:in"]`.
- `pin.login` / `pin.logout` route, while `pin.log.in` / `pin.log.out` are rejected.
- `model.submt` host bridge sends parent hosting Cell `pin.in` to child root `pin.in`, and child root `pin.out` back to parent hosting Cell `pin.out`.

**Step 2: Run test to verify RED**

Run:

```bash
node scripts/tests/test_0357_pin_connection_hard_cut.mjs
```

Expected: FAIL because current runtime still accepts `pin.connect.model`, old prefix endpoints, numeric prefixes, and `pin.log.*`.

### Task 2: Implement Runtime Hard-Cut

**Files:**
- Modify: `packages/worker-base/src/runtime.mjs`

**Step 1: Delete `pin.connect.model` runtime surface**

- Remove `modelConnectionRoutes`.
- Remove `_parseModelConnectionLabel`, `_rebuildModelConnectionForCell`, and `_routeViaModelConnection`.
- In `_applyBuiltins`, reject `pin.connect.model` via `_recordError(..., 'label_type_removed')`.
- In `rmLabel`, remove rebuild handling for `pin.connect.model`.

**Step 2: Replace cell connect endpoint parsing**

- Parse direct endpoint strings only.
- Treat an endpoint as function endpoint only when a same-Cell `func.js` / `func.python` label exists for the base name.
- Reject any endpoint wrapped in parentheses.
- Reject numeric prefix routes.
- Store graph targets internally as `{ kind: 'self' | 'func', port }`; internal naming can use `func`, but no external prefix syntax is accepted.

**Step 3: Enforce `pin.connect.cell` constraints**

- Endpoint arrays must be `[integer, integer, integer, non-empty string]`.
- Reject endpoint names that match a same-Cell function endpoint.
- Keep route target as Cell pin only.

**Step 4: Implement `model.submt` boundary bridge**

- Parent hosting Cell `pin.in` writes forward to child root `(0,0,0)` same-key `pin.in`.
- Child root `(0,0,0)` `pin.out` writes forward to parent hosting Cell same-key `pin.out`.
- Parent hosting Cell then uses normal parent `pin.connect.cell` routes.
- No numeric endpoint syntax is allowed.

**Step 5: Replace log pin dispatch**

- Accept `pin.login` like input pin.
- Accept `pin.logout` like output pin.
- Reject `pin.log.*` through normal unsupported/removed label behavior.

**Step 6: Run RED test to GREEN**

Run:

```bash
node scripts/tests/test_0357_pin_connection_hard_cut.mjs
```

Expected: PASS.

### Task 3: Migrate Server Generated Routes And Policy

**Files:**
- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `packages/ui-model-demo-server/filltable_policy.mjs`

**Step 1: Remove structural policy for deleted label types**

- Remove `pin.connect.model` from structural labels and prompt policy text.
- Remove legacy `pin.table.*` / `pin.single.*` if still listed as current structural types.

**Step 2: Migrate imported host ingress**

- Generate `pin.connect.cell` from Model 0 root `pin.bus.in` to imported app hosting Cell relay pin.
- Ensure hosting Cell declares `model.submt` and boundary `pin.in` / `pin.out`.
- Store generated labels in cleanup lists.

**Step 3: Migrate imported host egress**

- Replace numeric prefix bridge with child root `pin.out` -> parent hosting Cell `pin.out` bridge.
- Replace `(self, ...)` / `(func, ...)` generated wiring with direct endpoints.

**Step 4: Migrate repair helpers and built-in route constants**

- Replace any generated `pin.connect.model` routes with `pin.connect.cell`.
- Replace all generated `pin.connect.label` prefix endpoint strings with direct endpoints.

### Task 4: Migrate System Models And Deploy Patches

**Files:**
- Modify JSON under `packages/worker-base/system-models/**`
- Modify JSON under `deploy/sys-v1ns/**`

**Step 1: Rewrite `pin.connect.label` values**

- `(self, X)` -> `X`
- `(func, F:in)` -> `F:in`
- `(func, F:out)` -> `F:out`

**Step 2: Remove or replace `pin.connect.model` records**

- For Model 0 ingress routes, replace with `pin.connect.cell` through known hosting Cell boundary pins.
- For records that cannot be safely mapped from existing assets, fail tests and fix by tracing the owning route.

**Step 3: Replace `pin.log.*` labels**

- `pin.log.in` -> `pin.login`
- `pin.log.out` -> `pin.logout`
- Remove `pin.log.bus.*` unless a specific new system boundary log adapter is implemented.

### Task 5: Migrate Tests And Validators

**Files:**
- Modify affected files under `scripts/tests/**`
- Modify `scripts/validate_builtins_v0.mjs`
- Modify `scripts/validate_program_model_loader_v0.mjs`

**Step 1: Replace old positive tests**

- Tests that previously asserted `pin.connect.model` exists now assert it is rejected.
- Tests for prefix endpoint parsing now assert prefix endpoint rejection.
- Functional tests use direct endpoints and `model.submt` bridge routes.

**Step 2: Run targeted tests**

Run:

```bash
node scripts/tests/test_0357_pin_connection_hard_cut.mjs
node scripts/tests/test_cell_connect_parse.mjs
node scripts/tests/test_submodel_connect.mjs
node scripts/tests/test_bus_in_out.mjs
node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs
node scripts/validate_builtins_v0.mjs
node scripts/validate_program_model_loader_v0.mjs
```

Expected: PASS.

### Task 6: Global No-Compatibility Gate

**Files:**
- Modify: `docs/iterations/0357-pin-connection-hard-cut-implementation/runlog.md`
- Modify: `docs/ITERATIONS.md`

**Step 1: Run global grep gate**

Run:

```bash
rg -n "pin\.connect\.model|\(self,|\(func,|\([0-9-]+, [^)]+\)|pin\.log\.|:log\.out" packages deploy scripts --glob '!node_modules/**' --glob '!dist/**' --glob '!output/**' --glob '!logs/**' -S
```

Expected: no matches in runtime code, generated server code, system-model assets, deploy patches, or active tests.

**Step 2: Run diff and docs checks**

Run:

```bash
git diff --check
rg -n "pin\.connect\.model|\(self,|\(func,|pin\.log\.|:log\.out" CLAUDE.md docs/ssot docs/user-guide docs/architecture_mantanet_and_workers.md --glob '*.md' --glob '*.html' -S
```

Expected: no whitespace errors; docs matches only in explicit removed / migration history contexts.

**Step 3: Update iteration records**

- Mark 0357 Completed in `docs/ITERATIONS.md`.
- Record commands and PASS/FAIL evidence in runlog.

**Step 4: Commit and merge**

Commit:

```bash
git add .
git commit -m "refactor(pin): hard-cut 0357 connection contract"
```

Then merge to `dev` after verification.
