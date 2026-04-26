---
title: "0345 — DAM Worker Guide Pin Payload Current Truth Plan"
doc_type: iteration-plan
status: completed
updated: 2026-04-27
source: ai
iteration_id: 0345-dam-worker-guide-pin-payload-current-truth
id: 0345-dam-worker-guide-pin-payload-current-truth
phase: planning
---

# Iteration 0345-dam-worker-guide-pin-payload-current-truth Plan

## Goal

- Fix the code review finding that `docs/handover/dam-worker-guide.md` still described formal bus payloads as `mt.v0` patch envelopes with legacy `op` / `model_id` records.

## Scope

- In scope:
- Update the DAM Worker handover guide to distinguish deployment `mt.v0 patch` from formal business pin payloads.
- Convert DAM bus examples and E2E flow text to `pin_payload v1` with temporary ModelTable record arrays.
- Add a focused docs regression test.
- Out of scope:
- Runtime behavior changes.
- Browser UI changes.
- Rewriting unrelated historical docs.

## Invariants / Constraints

- `mt.v0 patch` remains valid for deployment/initialization/import.
- Formal `pin.in/out` and `pin.bus.in/out` non-empty values remain temporary ModelTable record arrays.
- Formal payload records must not carry legacy `op` / `model_id`.

## Success Criteria

- The new docs test fails before the guide update and passes after it.
- The guide no longer claims current bus examples use `mt.v0` envelopes or legacy record fields.
- Existing 0332/0342/0343/0344 verification still passes after merging.

## Inputs

- Created at: 2026-04-27
- Iteration ID: 0345-dam-worker-guide-pin-payload-current-truth
- Gate: Required code review follow-up before merging `dev` into `main`.
