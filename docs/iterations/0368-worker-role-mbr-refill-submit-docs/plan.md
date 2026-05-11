---
id: 0368
title: worker-role-mbr-refill-submit-docs
doc_type: iteration_plan
status: Approved
updated: 2026-05-11
source: ai
branch: dev_0368-worker-role-mbr-refill-submit-docs
created_at: 2026-05-11
iteration_id: 0368-worker-role-mbr-refill-submit-docs
phase: phase1
---

# Iteration 0368 Worker Role, MBR Refill, And Minimal Submit Docs Plan

## Goal

Bring the worker initialization contract, MBR/remote-worker fill-table truth, and the "最小 Submit 双总线示例" documentation back into alignment with the current split control/management bus model.

## Scope

In scope:

- Replace the worker role contract with `worker.role = "dem" | "worker"` and remove active `is_DEM` usage.
- Preserve the existing `v1n_id` lock: first trusted bootstrap writes the ID; later changes require an explicit maintenance path.
- Clarify startup ordering with project terms: create models and mount hierarchy, write worker identity and role, write Matrix/MQTT communication labels, load program models, declare pins, declare pin connections, then restore resumable runtime values.
- Refill MBR so management-bus input can produce either control-bus output or management-bus output through Tier 2 ModelTable paths.
- Refill remote-worker so ordinary workers only use control-bus pins and provider programs do not bypass the root bus outlet.
- Update deterministic checks for forbidden compatibility labels and direct transport shortcuts.
- Update the "最小 Submit 双总线示例" JSON patch and a matching HTML label explainer.
- Refresh local deployment and verify the Workspace slide flow, color generator, and minimal Submit dual-bus result in a real browser.

Out of scope:

- Adding compatibility aliases for `is_DEM`, legacy `pin.bus.in/out`, `pin.connect.model`, `MGMT_OUT` as a formal bus outlet, or direct `ctx.publishMqtt` provider replies.
- Redesigning Matrix, MQTT, or MBR identity formats beyond the route fields already required by existing payloads.
- Remote cloud deployment unless a local fix proves deployment assets are wrong and must be published separately.

## Invariants / Constraints

- `CLAUDE.md` remains authoritative: registered iteration, Approved gate, no compatibility fallback, no hidden conformant-path bypass.
- All official pin payloads remain temporary ModelTable record arrays; persistence happens only through explicit materialization.
- `pin.bus.mb.*` is DEM-only and only at worker root Model 0 `(0,0,0)`.
- Ordinary software workers use `pin.bus.cb.*` only.
- Positive UI/provider models do not directly declare bus boundary pins; host-owned installation creates the required root boundary route.
- Program models may transform payloads, but external bus emission must be represented by writing the correct root bus outlet, not by ad hoc direct transport from provider cells.

## Success Criteria

- Active runtime/server/deploy/system-model files contain no `is_DEM` as the worker role source of truth.
- Runtime role validation uses `worker.role`; invalid roles and illegal management-bus pins fail visibly.
- Active MBR fill-table content exposes two Tier 2 paths: management input to control output, and management input to management output.
- Active remote-worker fill-table content declares `worker.role="worker"`, rejects management-bus pins by role, and routes Model 3000 `submit1` replies through the control bus outlet path.
- The minimal Submit JSON patch and HTML document explain each significant label group and the button-to-program-to-bus flow.
- Local deployment is refreshed and Playwright verifies actual browser behavior at `http://127.0.0.1:30900/#/workspace`.
- Each stage receives a bounded `codex-code-review` sub-agent review; findings are fixed before continuing.

## Inputs

- Created at: 2026-05-11
- Iteration ID: 0368-worker-role-mbr-refill-submit-docs
- Branch: `dev_0368-worker-role-mbr-refill-submit-docs`
