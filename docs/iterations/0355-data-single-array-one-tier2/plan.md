---
title: "0355 Data Single Array One Tier2 Plan"
doc_type: iteration_plan
status: completed
updated: 2026-04-30
source: codex
---

# Iteration 0355-data-single-array-one-tier2 Plan

## Goal

Implement the first Feishu-aligned Data.* Tier 2 slice without compatibility
fallbacks:

- `Data.Single` as the canonical element shape.
- `Data.Array.One` as the smallest collection model that replaces the
  0296-era `Data.Array` target.
- Guard tests that reject the old `Data.Array` / underscore-pin / value-only
  target shape for this slice.

## Scope

- In scope:
  - Add a canonical `Data.Array.One` Tier 2 template under
    `packages/worker-base/system-models/templates/`.
  - Add shared deterministic validation helpers for Temporary ModelTable
    Message records used by the template tests.
  - Replace the old canonical `data_array_v0` target with a non-canonical
    historical artifact so it cannot be imported as the current target.
  - Update data-model user documentation for `Data.Single` and
    `Data.Array.One`.
  - Add tests proving canonical and remapped model ids work, colon pins only
    are exposed, malformed payloads are rejected, result values are Temporary
    ModelTable Message arrays, and old target names are not accepted.
- Out of scope:
  - Rewriting `Data.Queue`, `Data.Stack`, `Data.CircularBuffer`,
    `Data.LinkedList`, or `Data.FlowTicket`.
  - Adding compatibility aliases, fallback parsers, or automatic conversion
    from old Data.* templates.
  - Changing Tier 1 interpreter behavior unless a conformant Tier 2 template
    is otherwise impossible.

## Invariants / Constraints

- `CLAUDE.md` remains highest local authority.
- Data.* behavior belongs in Tier 2 fill-table templates/programs.
- Pin payload format is Temporary ModelTable Message record arrays:
  `{id,p,r,c,k,t,v}`.
- `format is ModelTable-like; persistence is explicit materialization`.
- Public Data.* pins use colon names only:
  `add_data:in`, `delete_data:in`, `update_data:in`, `get_data:in`,
  `get_data:out`, `get_all_data:in`, `get_all_data:out`,
  `get_size:in`, `get_size:out`.
- Legacy names such as `Data.Array`, `add_data_in`, and single `value`
  row storage are not compatibility targets.
- All formal writes must happen through current-model owner writes
  (`V1N.table.addLabel` / `V1N.table.removeLabel`) after validation.

## Success Criteria

- `Data.Array.One` template declares `model_type = Data.Array.One`, `max_r`,
  and only generic colon public pins.
- Added data records materialize as `Data.Single` element cells starting at
  `(0,1,0)`, not as value-only shortcut rows.
- `get_data`, `get_all_data`, and `get_size` return Temporary ModelTable
  Message arrays.
- Invalid payloads are rejected deterministically and do not materialize
  business labels.
- Applying the template to the canonical id and a remapped id both passes.
- Tests fail if old `Data.Array` or underscore pins reappear as the current
  target.
- Living docs review records the impact on runtime semantics, label registry,
  and user guide.

## Inputs

- Created at: 2026-04-30
- Iteration ID: 0355-data-single-array-one-tier2
- User direction: no compatibility layer; migration means replacing old
  usable paths, not preserving them.
