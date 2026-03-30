---
title: "Model100 Submit Roundtrip Hardening Implementation Plan"
doc_type: plan
status: active
updated: 2026-03-29
source: ai
---

# Model100 Submit Roundtrip Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让颜色生成器（Model 100）重新符合当前 hard-cut 主线：浏览器按钮可用，submit 去程/回程按正式链路工作，truth 与 scene/lifecycle 投影一致，并拿到本地浏览器证据。

**Architecture:** 这不是单纯的页面 bug。当前 `Model 100` 仍然混用旧 submit/dual-bus 方案和新 hard-cut 主线，导致 stale inflight、server 误路由、remote-worker 回程 topic 漂移并存。方案必须先冻结 authoritative 路径，再分层修复：`submit authoritative routing`、`stale inflight recovery`、`worker return-path alignment`、`browser proof`。

**Tech Stack:** ModelTableRuntime, ui-model-demo-server, ui-renderer, ui-model-demo-frontend, MBR bridge patches, remote-worker patches, Playwright MCP, script-first contract tests.

---

### Task 1: Freeze The Authoritative Model100 Contract

**Files:**
- Modify: `docs/iterations/0260-model100-submit-roundtrip-hardening/plan.md`
- Modify: `docs/iterations/0260-model100-submit-roundtrip-hardening/resolution.md`
- Modify: `docs/ITERATIONS.md`

**Step 1: Register 0260**

Add `0260-model100-submit-roundtrip-hardening` to `docs/ITERATIONS.md` as `Planned`.

**Step 2: State the real problem**

Record in `plan.md`:
- browser button disabled because `submit_inflight=true`
- `submit` event is server-misrouted into home/llm path
- old local patch and remote-worker patch are not fully aligned

**Step 3: Freeze final DoD**

Success must require all of:
- browser `Generate Color` button enabled
- submit enters authoritative path
- return patch lands and clears inflight
- `bg_color`, `status`, `scene_context`, `action_lifecycle` all consistent
- local live browser proof exists

**Step 4: Commit docs later together with implementation**

No standalone commit required at this step.

---

### Task 2: Add RED Contracts For Model100 Failure Modes

**Files:**
- Create or modify: `scripts/tests/test_0260_model100_submit_authoritative_routing_contract.mjs`
- Modify: `scripts/tests/test_0144_remote_worker.mjs`
- Modify: `scripts/validate_model100_records_e2e_v0.mjs`

**Step 1: Write RED for server authoritative routing**

Add a focused test showing:
- `submit` must not be routed into `home_dispatch_blocked`
- `submit` must not be handled by generic llm/home dispatch

**Step 2: Write RED for stale inflight recovery**

Add a focused test showing:
- when `submit_inflight=true` and started_at is stale, next submit path resets stale guard and allows progress

**Step 3: Preserve existing failing chain evidence**

Keep or tighten:
- `test_0144_remote_worker`
- `validate_model100_records_e2e_v0`

These must remain failing until the root cause is actually fixed.

**Step 4: Run RED**

Run:
- `node scripts/tests/test_0260_model100_submit_authoritative_routing_contract.mjs`
- `node scripts/tests/test_0144_remote_worker.mjs`
- `node scripts/validate_model100_records_e2e_v0.mjs`

Expected:
- FAIL at least on authoritative routing and/or full chain assertions

---

### Task 3: Fix Submit Authoritative Routing On Server

**Files:**
- Modify: `packages/ui-model-demo-server/server.mjs`
- Inspect: `packages/worker-base/system-models/intent_dispatch_config.json`

**Step 1: Isolate `submit` from generic dispatch**

`submit` for `Model 100` must not enter:
- home pin-only blocked path
- llm dispatch fallback

**Step 2: Add explicit authoritative handling**

Implement minimal server routing that:
- recognizes `submit` destined for `Model 100`
- hands it to the correct authoritative submit chain
- writes proper mailbox/error/op-id outcomes

**Step 3: Re-run focused routing test**

Run:
- `node scripts/tests/test_0260_model100_submit_authoritative_routing_contract.mjs`

Expected:
- PASS

**Step 4: Re-run regression**

Run:
- `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`

Expected:
- PASS

---

### Task 4: Fix Stale Inflight Recovery And Button Availability

**Files:**
- Modify: `packages/worker-base/system-models/test_model_100_ui.json`
- Modify: `packages/worker-base/system-models/workspace_positive_models.json`
- Modify: `scripts/tests/test_0182_model100_singleflight_release_contract.mjs`
- Modify or create: `scripts/tests/test_0260_model100_submit_stale_inflight_contract.mjs`

**Step 1: Decide authoritative owner of inflight reset**

Prefer one place only:
- submit-preparation function
or
- server-side recovery hook

Do not let UI layer guess.

**Step 2: Encode stale recovery**

Stale inflight must:
- reset `submit_inflight=false`
- clear or reset `submit_inflight_started_at`
- restore usable `status`

**Step 3: Verify UI expectation**

Button may still show loading only when inflight is truly active, not stale.

**Step 4: Run**

Run:
- `node scripts/tests/test_0182_model100_singleflight_release_contract.mjs`
- `node scripts/tests/test_0260_model100_submit_stale_inflight_contract.mjs`

Expected:
- PASS

---

### Task 5: Align Return Path Contract (`patch` vs `patch_out`)

**Files:**
- Modify: `deploy/sys-v1ns/remote-worker/patches/10_model100.json`
- Modify: `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json`
- Modify if needed: `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
- Modify: `scripts/tests/test_0144_remote_worker.mjs`
- Modify: `scripts/validate_model100_records_e2e_v0.mjs`

**Step 1: Pick one authoritative return topic**

Decide whether return path is:
- `.../100/patch`
or
- `.../100/patch_out`

Then make producer, subscriber, and tests agree.

**Step 2: Keep directionality explicit**

Outgoing submit event and incoming patch response must remain distinguishable.

**Step 3: Re-run RED chain**

Run:
- `node scripts/tests/test_0144_remote_worker.mjs`
- `node scripts/validate_model100_records_e2e_v0.mjs`

Expected:
- PASS

---

### Task 6: Verify Full Local Runtime Flow

**Files:**
- Inspect: `packages/ui-model-demo-server/server.mjs`
- Inspect: `packages/ui-model-demo-frontend/src/demo_app.js`
- Inspect: `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- Optional test: `packages/ui-model-demo-frontend/scripts/validate_sliding_flow_server_sse.mjs`

**Step 1: Confirm pre-click state**

Before clicking:
- `submit_inflight=false`
- `status=ready`
- `scene_context.active_flow` sane
- `action_lifecycle.status=idle`

**Step 2: Confirm post-click progress**

After one click:
- `submit_inflight=true` only briefly
- `status` moves through expected stages
- `scene_context` and `action_lifecycle` update

**Step 3: Confirm final convergence**

At completion:
- `bg_color` changed
- `status=processed`
- `submit_inflight=false`
- `action_lifecycle` completed or equivalent success state

---

### Task 7: Browser Proof On Local Live Deploy

**Files:**
- Output only: `output/playwright/0260-model100-submit-roundtrip-hardening/**`
- Modify: `docs/iterations/0260-model100-submit-roundtrip-hardening/runlog.md`

**Step 1: Ensure live environment**

Run:
- `bash scripts/ops/deploy_local.sh`
- `bash scripts/ops/check_runtime_baseline.sh`
- set runtime mode to `running`

**Step 2: Real browser interaction**

Using Playwright MCP on `30900`:
- open Workspace
- ensure `Model 100 / E2E 颜色生成器` selected
- type text if needed
- click `Generate Color`

**Step 3: Capture proof**

Need:
- before screenshot
- after click/inflight screenshot if meaningful
- final processed screenshot

**Step 4: Cross-check snapshot**

Read `/snapshot` around the same time to confirm:
- `bg_color`
- `status`
- `submit_inflight`
- `scene_context`
- `action_lifecycle`

Only if browser and snapshot agree may 0260 be marked completed.

---

### Task 8: Final Closeout

**Files:**
- Modify: `docs/iterations/0260-model100-submit-roundtrip-hardening/runlog.md`
- Modify: `docs/ITERATIONS.md`

**Step 1: Record exact root cause(s)**

Write down whether the final fix set was:
- routing bug
- stale inflight bug
- return-path mismatch
- multiple combined causes

**Step 2: Mark status**

Set:
- `0260 = Completed`

Only if:
- contract tests PASS
- local runtime chain PASS
- browser proof PASS

**Step 3: Record residual risk**

If any remains, it must be concrete, e.g.:
- remote cluster still unverified
- no cloud proof yet
