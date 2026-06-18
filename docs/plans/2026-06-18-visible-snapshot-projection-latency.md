---
title: "Visible Snapshot Projection Latency Implementation Plan"
doc_type: note
status: active
updated: 2026-06-18
source: ai
---

# Visible Snapshot Projection Latency Implementation Plan

> **For Claude/Codex:** REQUIRED SUB-SKILL: use the repository iteration workflow, TDD, and sub-agent `codex-code-review` after every implementation stage.

**Goal:** reduce UI model first-screen and post-load latency by loading only shell/bootstrap data first and fetching visible slide app models on demand.

**Architecture:** server exposes `full`, `bootstrap`, and `visible` client snapshot profiles; frontend starts from `bootstrap`, then lazy-loads missing focused app models through the existing snapshot/projection store path. SSE connects with the same profile and loaded visible-model IDs, then continues to use `snapshot_patch` without silently expanding bootstrap clients back to full snapshots.

**Tech Stack:** Node/Bun server code in `packages/ui-model-demo-server/server.mjs`, Vue frontend store in `packages/ui-model-demo-frontend/src/remote_store.js`, deterministic Node contract tests under `scripts/tests/`, local browser verification through Playwright.

---

## Task 1: Contract Tests and Baseline Metrics

**Files:**
- Create/modify: `scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
- Modify: `docs/iterations/0418-visible-snapshot-projection-latency/runlog.md`

**Steps:**
1. Write failing tests for missing bootstrap/visible snapshot profile support.
2. Run `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs` and confirm RED for the expected missing behavior.
3. Record current local `/snapshot` bytes, model count, label count, and largest labels in runlog.
4. Request sub-agent review with `codex-code-review`; fix the test contract until approved.

## Task 2: Server Snapshot Profiles

**Files:**
- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
- Modify: `docs/iterations/0418-visible-snapshot-projection-latency/runlog.md`

**Steps:**
1. Implement `full`, `bootstrap`, and `visible` profile helpers.
2. Parse profile/model-id query params in `/snapshot`.
3. Parse profile/visible-model-id query params in `/stream`.
4. Make stream initial events and later patches use the profile baseline.
5. Preserve redaction and principal filtering before returning any profile.
6. Add fail-closed behavior for invalid/missing/unauthorized visible model IDs.
7. Run 0418/0414/0416/0417 tests.
8. Request sub-agent review; fix until approved.

## Task 3: Frontend Lazy Hydration

**Files:**
- Modify: `packages/ui-model-demo-frontend/src/remote_store.js`
- Modify as needed: `packages/ui-model-demo-frontend/src/demo_app.js`
- Modify as needed: `packages/ui-model-demo-frontend/src/desktop_focused_app_content.js`
- Modify: `scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`

**Steps:**
1. Make startup snapshot fetch use `profile=bootstrap`.
2. Make startup SSE connect use `profile=bootstrap`.
3. Add a model presence helper.
4. Add `ensureVisibleModelLoaded(modelId)` using `profile=visible&model_id=...`.
5. Track loaded visible model IDs.
6. Reconnect or update stream subscription with loaded visible model IDs.
7. Trigger lazy load when opening/focusing a workspace app whose model is absent.
8. Run 0418/0415/0417 tests and frontend build.
9. Request sub-agent review; fix until approved.

## Task 4: Patch/Profile Consistency and Metrics

**Files:**
- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `packages/ui-model-demo-frontend/src/remote_store.js`
- Modify: `scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`

**Steps:**
1. Ensure bootstrap clients do not receive unrelated model bodies in ordinary SSE patches.
2. Add explicit observable reset/recovery reason for full reset cases.
3. Add metrics assertions for full/bootstrap/visible/patch bytes.
4. Run 0418/0414/0416/0412 tests.
5. Request sub-agent review; fix until approved.

## Task 5: Docs, Deploy, Browser Verification, Final Review

**Files:**
- Modify docs only where developer-visible behavior changed.
- Modify: `docs/iterations/0418-visible-snapshot-projection-latency/runlog.md`
- Modify: `docs/ITERATIONS.md`

**Steps:**
1. Run all targeted deterministic tests.
2. Build frontend.
3. Deploy local stack with `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`.
4. Use real browser to verify desktop bootstrap, To Do Board lazy load, color generator update, input responsiveness, and scroll constraints.
5. Record measured before/after bytes and browser evidence in runlog.
6. Request final sub-agent full-diff review; fix until approved.
