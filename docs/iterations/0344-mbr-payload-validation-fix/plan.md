---
title: "0344 — MBR Payload Validation Fix Plan"
doc_type: iteration-plan
status: completed
updated: 2026-04-27
source: ai
iteration_id: 0344-mbr-payload-validation-fix
id: 0344-mbr-payload-validation-fix
phase: planning
---

# Iteration 0344-mbr-payload-validation-fix Plan

## Goal

- Close the code review finding from the 0342/0343 merge review: MBR role functions must reject temporary ModelTable payload records that carry legacy `op` / `model_id` fields or omit the required `v` field.

## Scope

- In scope:
- `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json` MBR function labels.
- Focused contract coverage for `mbr_mgmt_dispatch` and `mbr_mgmt_to_mqtt`.
- Local deterministic verification needed before merging back to `dev`.
- Out of scope:
- Redesigning the MBR route topology.
- Changing valid Mgmt Bus Console send/ack behavior.
- Changing browser UI behavior.

## Invariants / Constraints

- Formal pin payloads remain temporary ModelTable record arrays.
- MBR must not publish or acknowledge malformed payload records.
- Generic CRUD / legacy object routes remain rejected.
- No direct browser Matrix send or direct model mutation may be introduced.

## Success Criteria

- New tests fail before the fix and pass after the fix.
- Mgmt Bus Console valid MBR send still returns an ack.
- Generic Model 100 route still publishes valid temporary ModelTable payloads.
- Legacy `op` / `model_id` record fields and missing `v` are rejected in both reviewed MBR paths.

## Inputs

- Created at: 2026-04-27
- Iteration ID: 0344-mbr-payload-validation-fix
- Gate: Approved as required follow-up to the sub-agent code review before merging `dev` into `main`.
