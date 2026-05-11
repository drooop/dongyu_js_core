---
id: 0370
title: minimal-submit-patch-doc-review
doc_type: iteration_plan
status: Completed
updated: 2026-05-11
source: ai
branch: dropx/0370-minimal-submit-patch-doc-review
created_at: 2026-05-11
iteration_id: 0370-minimal-submit-patch-doc-review
phase: phase1
---

# Iteration 0370 Minimal Submit Patch Doc Review Plan

## Goal

- Re-review the "最小 Submit 双总线示例" JSON patch and matching HTML/Markdown docs for correctness, validity, and developer readability.
- Improve the docs so developers can understand what every label in the patch does, how Submit-like buttons bind events, how those events trigger backend program models, and how the dual-bus message is emitted.

## Scope

- In scope:
- Validate `test_files/minimal_submit_dual_bus_app_payload.json` and `test_files/minimal_submit_dual_bus.zip`.
- Review the remote-worker Model 3000 provider patch for the matching `submit1` target.
- Update `minimal_submit_app_provider_guide.md` and `minimal_submit_app_provider_interactive.html`.
- Add deterministic tests that lock the full label explanation and Submit chain explanation.
- Out of scope:
- Runtime behavior changes, MBR route changes, remote deployment, and compatibility aliases.

## Invariants / Constraints

- The zip payload remains ModelTable records only: no patch ops, no installed model id, no `route.reply_to`, no host-generated labels.
- `remote_bus_endpoint_v1` declares only remote worker/model defaults; `route.to.pin` comes from the triggered public pin.
- Submit buttons must enter the ModelTable pin chain; they must not send Matrix directly or write final business labels directly.
- No compatibility fallback for old `input_value`, `message_text`, `pin.connect.model`, or direct `ctx.writeLabel` style.

## Success Criteria

- Saved JSON patch imports successfully and the saved zip contains exactly `app_payload.json`.
- Docs explain the 61-label patch shape and every label key used by the patch.
- Docs explicitly explain the chain: `ui_bind_json` -> `click_chain` -> `root_routes` -> `submit_request_wiring` -> `handle_submit` -> `submit1 pin.out` -> generated host egress adapter -> Model 0 `pin.bus.mb.out`.
- Existing minimal Submit docs/import tests pass.
- `git diff --check` passes.

## Inputs

- Created at: 2026-05-11
- Iteration ID: 0370-minimal-submit-patch-doc-review
