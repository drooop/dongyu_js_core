---
title: "Iteration 0451 Feishu Legacy V2 Test Refresh Plan"
doc_type: iteration-plan
status: completed
updated: 2026-07-09
source: ai
iteration_id: 0451-feishu-legacy-v2-test-refresh
id: 0451-feishu-legacy-v2-test-refresh
phase: phase1
---

# Iteration 0451-feishu-legacy-v2-test-refresh Plan

## Goal

Refresh historical tests that still assert legacy `pin_payload.v1` packet shapes so they verify the current Feishu `pin_payload.v2` request/response contract.

## Background

0450 completed response materialization for formal v2 response packets. Additional investigation found two older tests still constructing v1-style packets or expecting v1 metadata, which causes them to fail for the intended reason after 0442+ hard-cut behavior.

## Invariants

- Do not reintroduce `pin_payload.v1` compatibility or legacy nested payload acceptance.
- Preserve the formal v2 requirements: `reply_target_table_id`, `payload_model_id`, `response_topic`, and non-nested payload model records.
- Keep response materialization targeted at `reply_target_table_id + reply_target_model_id`.
- Any rejection must remain visible; no silent fallback to host or endpoint models.

## Scope

In scope:

- Update `scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs` to use formal v2 response packets.
- Update the still-current expectations in `scripts/tests/test_0332_modeltable_pin_payload_contract.mjs` to match v2 bus payload output.
- Apply minimal runtime fixes only if the refreshed tests reveal a current-contract defect.
- Update runlog and relevant SSOT notes if behavior changes are needed.

Out of scope:

- Re-enabling v1 packet support.
- Broad refactoring of principal workspace state projection.
- Real broker/browser end-to-end verification.

## Success Criteria

- `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs` passes.
- `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs` passes.
- 0442-0450 Feishu message/response tests remain green.
- Static checks pass for changed files.
- The runlog records any legacy-contract test expectation that was intentionally changed.

## Risks & Mitigations

- Risk: a historical test may be documenting a still-valid isolation behavior while using obsolete packet syntax.
  - Mitigation: keep the user-facing behavior assertions and only change packet construction/metadata expectations.
- Risk: changing tests could hide a real runtime regression.
  - Mitigation: run focused tests first, then Feishu 0442-0450 regression tests.

## Open Questions

None.

## Compliance Checklists

### SSOT Alignment Checklist

- `CLAUDE.md`: no compatibility aliases without approval; visible failures required.
- `docs/ssot/runtime_semantics_modeltable_driven.md`: current v2 response topic and materialization contract.
- `docs/ssot/feishu_model_label_alignment_v1.md`: Feishu current-contract alignment chain.

### Charter Compliance Checklist

- Tier/model/data placement must remain table-qualified.
- Test updates must not bypass `add_label` / `rm_label`.
- Verification must use deterministic PASS/FAIL commands.
