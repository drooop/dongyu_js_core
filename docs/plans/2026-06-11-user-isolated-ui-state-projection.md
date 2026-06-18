---
title: "User-Isolated UI State Projection Implementation Plan"
doc_type: note
status: active
updated: 2026-06-18
source: ai
---

# User-Isolated UI State Projection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans-style task execution with a sub-agent `codex-code-review` checkpoint after every stage.

**Goal:** Make UI Server safe for multiple users while making common UI interactions local-first, responsive, and explicitly materialized only when required.

**Architecture:** Use a shared global runtime for system definitions/catalogs and a per-principal workspace runtime for user-owned app instances and app data. Add UI local state slots so Input/Dialog/Tabs/view switches/pending states can stay local/session-scoped unless explicitly persisted. Keep formal business events on the existing Model 0 / pin / Temporary ModelTable path.

**Tech Stack:** Node.js server, Vue frontend, `packages/ui-renderer`, `packages/ui-model-demo-frontend`, `packages/ui-model-demo-server`, deterministic `scripts/tests/*.mjs`.

---

## Iteration Source

Primary iteration records:

- `docs/iterations/0417-user-isolated-ui-state-projection/plan.md`
- `docs/iterations/0417-user-isolated-ui-state-projection/resolution.md`
- `docs/iterations/0417-user-isolated-ui-state-projection/runlog.md`

This plan mirrors the iteration resolution and exists as the implementation-plan entry point requested by the planning workflow.

## Task 1: Contract Tests

**Files:**

- Create: `scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
- Modify: `docs/iterations/0417-user-isolated-ui-state-projection/runlog.md`

**Step 1: Write failing tests**

Add tests for:

- principal workspace isolation;
- guest read-only behavior;
- Input default local-only submit policy;
- submit reads visible local overlay;
- Dialog/view state local-only behavior;
- pending/loading duplicate-submit lock;
- small post-load projection packets for local UI state.

The principal isolation test must cover all representative user-owned state, not only one label:

- installed app registry entry;
- app-local business label;
- input draft/local overlay;
- Dialog visibility;
- selected view/tab;
- materialized remote response label.

The submit test must prove the correct path:

- exactly one `bus_event_v2`;
- Temporary ModelTable payload includes the latest visible value;
- event enters the Model 0 / pin / bus path;
- UI/server does not direct-write the final business label;
- latest value comes from local overlay when debounce persistence has not run.

Each task must record conformance evidence for:

- tier placement;
- model placement;
- data ownership;
- data flow;
- data chain.

**Step 2: Run test to verify expected failure**

Run:

```bash
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
```

Expected:

- FAIL because production APIs do not yet expose the required boundaries.

**Step 3: Review**

Run sub-agent review using `codex-code-review` against:

- the test file;
- the 0417 plan/resolution;
- the expected failure output.
- the five conformance checks above.

## Task 2: Principal Runtime Boundary

**Files:**

- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`

**Step 1: Implement runtime selection**

Add principal key resolution and a per-principal runtime registry. Keep guest read-only. Keep shared system/global data separate from user-owned mutable state.

**Step 2: Wire snapshot/SSE/event endpoints**

Ensure `/snapshot`, `/stream`, `/ui_event`, `/bus_event`, import/materialization, and remote response handling use the selected runtime where user data is involved.

**Step 3: Verify**

Run:

```bash
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
node scripts/tests/test_0403_principal_authorization.mjs
node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs
node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs
```

**Step 4: Review**

Run sub-agent review focused on data ownership, response materialization, no shared mutable fallback, and mandatory conformance evidence for tier placement, model placement, data ownership, data flow, and data chain.

## Task 3: Local State and Submit Overlay

**Files:**

- Modify: `packages/ui-renderer/src/renderer.mjs`
- Modify: `packages/ui-renderer/src/renderer.js`
- Modify: `packages/ui-model-demo-frontend/src/remote_store.js`
- Modify: `packages/ui-model-demo-frontend/src/projection_store.js`
- Modify: `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Modify: `docs/user-guide/modeltable_user_guide.md`
- Modify: `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md`

**Step 1: Add local state slot semantics**

Support state declarations for `state_id`, `state_kind`, `scope`, `persist_policy`, `default`, and `reset_on`.

**Step 2: Make Input local-first**

Input default is `persist_policy: "submit"`. Submit must resolve local overlay first, then projection, then snapshot fallback.

**Step 3: Verify**

Run:

```bash
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
node scripts/tests/test_0415_reactive_projection_store_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs
npm -C packages/ui-model-demo-frontend run build
```

**Step 4: Review**

Run sub-agent review focused on stale-submit values, accidental persistence, proof that submit still uses Model 0 / pin / bus exactly once, and mandatory conformance evidence.

## Task 4: Dialog/View State and Pending Locks

**Files:**

- Modify: `packages/ui-renderer/src/renderer.mjs`
- Modify: `packages/ui-renderer/src/renderer.js`
- Modify: `packages/ui-model-demo-frontend/src/remote_store.js`
- Modify: `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Modify: UI model docs touched in Task 3

**Step 1: Implement local view controls**

Dialog visibility, tab/local page, drawer/dropdown, and selection state default to local/session unless explicitly persisted.

**Step 2: Implement pending declarations**

Support pending state id, text, lock scope, duplicate-submit blocking, timeout, and success/error release.

**Step 3: Verify**

Run:

```bash
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
node scripts/tests/test_0329_bus_event_last_op_id_snapshot_contract.mjs
node scripts/tests/test_0388_shell_route_state_stability_contract.mjs
npm -C packages/ui-model-demo-frontend run build
```

**Step 4: Review**

Run sub-agent review focused on stuck loading, over-broad locks, and mandatory conformance evidence.

## Task 5: Projection Delta Tightening

**Files:**

- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `packages/ui-model-demo-frontend/src/remote_store.js`
- Modify: `packages/ui-model-demo-frontend/src/projection_store.js`
- Modify: `scripts/tests/test_0416_post_load_projection_latency_contract.mjs` only if expectations must be tightened.

**Step 1: Prevent local-only state from producing server snapshots**

Local-only state should update browser projection or local overlay, not server truth.

**Step 2: Tighten post-load packet measurements**

Keep full snapshot for bootstrap/recovery/principal change/oversized patch only. Keep ordinary interaction patches below the documented limit.

**Step 3: Verify**

Run:

```bash
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
node scripts/tests/test_0416_post_load_projection_latency_contract.mjs
node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs
node scripts/tests/test_0415_reactive_projection_store_contract.mjs
```

**Step 4: Review**

Run sub-agent review focused on stale projection, recovery correctness, and mandatory conformance evidence.

## Task 6: Existing Apps and Browser Verification

**Files:**

- Modify: `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Modify: slide app payload/docs only where the new contract requires it
- Modify: `docs/iterations/0417-user-isolated-ui-state-projection/runlog.md`

**Step 1: Adapt representative apps**

Update To Do Board, E2E color generator, and relevant examples to use the new input/local state/pending contract.

**Step 2: Build and local deploy**

Run:

```bash
npm -C packages/ui-model-demo-frontend run build
bash scripts/ops/check_runtime_baseline.sh
```

Restart/redeploy the local UI Server using the current repo-local deployment command discovered during execution.

**Step 3: Browser verify**

Use a real browser to verify:

- Home loads without outer page scroll;
- To Do Board typing is smooth and submit captures latest visible text;
- pending/loading blocks duplicate submit and clears;
- Dialog/local page switch does not reset unexpectedly;
- E2E color generator still updates color;
- two users or two scripted principals do not share user-owned state.
- final conformance evidence covers tier placement, model placement, data ownership, data flow, and data chain.

**Step 4: Final review**

Run a full sub-agent review over the complete diff and verification evidence.
