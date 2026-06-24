---
title: "Iteration 0424 Principal-Scoped Subtable SSOT Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-06-23
source: ai
iteration_id: 0424-principal-subtable-ssot
id: 0424-principal-subtable-ssot
---

# Iteration 0424-principal-subtable-ssot Runlog

## Environment

- Branch: `dropx/dev_0424-principal-subtable-ssot`
- Scope: docs-only SSOT iteration.
- Current worktree note: branch was created from the existing 0423 worktree with prior uncommitted changes present. This iteration will only modify 0424 docs and SSOT files.

## Phase 1: Iteration Registration And Conflict Map

Status: DONE

Commands:

```bash
sed -n '1,260p' CLAUDE.md
sed -n '1,260p' docs/WORKFLOW.md
rg -n "042[0-9]|041[0-9]|040[0-9]" docs/ITERATIONS.md | tail -n 80
find docs/ssot -maxdepth 1 -type f -name '*.md' | sort
sed -n '1,260p' docs/ssot/runtime_semantics_modeltable_driven.md
sed -n '1,260p' docs/ssot/label_type_registry.md
sed -n '1,260p' docs/ssot/pin_connection_contract_v2.md
sed -n '1,520p' docs/ssot/imported_slide_app_host_ingress_semantics_v1.md
sed -n '1,260p' docs/ssot/temporary_modeltable_payload_v1.md
sed -n '1,220p' docs/ssot/ui_model_pin_routing_architecture.md
sed -n '1,220p' docs/ssot/tier_boundary_and_conformance_testing.md
```

Observed current SSOT boundaries:

- `model.submt` currently means one hosting Cell mounts one child model.
- `pin.connect.cell` is intra-model only.
- `pin.connect.model` is already removed and must stay removed.
- `visible_model_id` and projection cache currently key by bare `model_id`; this iteration must freeze the target `ModelRef` shape before implementation.
- SSO/session filtering already exists as a snapshot concern, but user desktop state and app instance ownership need hard namespace isolation, not label-value-only filtering.

Result: PASS.

## Phase 2: New Namespace SSOT

Status: DONE

Created:

- `docs/ssot/principal_scoped_subtable_namespace_v1.md`

Key decisions frozen:

- `PrincipalRef` identifies the authenticated SSO principal.
- `table_id` identifies a ModelTable namespace.
- Durable model identity is `ModelRef = { table_id, model_id }`.
- Host table, user desktop table, and App instance table are separate ownership domains.
- `model.subtable` is a new target label type and is not an alias of `model.submt`.
- Negative system models remain host/system capabilities.
- Non-negative model ids are table-local.
- Cross-table routing can only pass through host-owned `model.subtable` hosting Cell and child table root boundary pins.

Result: PASS.

## Phase 3: Existing SSOT Cross-References

Status: DONE

Updated:

- `docs/architecture_mantanet_and_workers.md`
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/ssot/label_type_registry.md`
- `docs/ssot/pin_connection_contract_v2.md`
- `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
- `docs/ssot/temporary_modeltable_payload_v1.md`

Commands:

```bash
rg -n "principal_scoped_subtable_namespace_v1|model\\.subtable|table_id|ModelRef|PrincipalRef|visibleModelRefs|reply_target_table_id|origin_table_id" docs/ITERATIONS.md docs/iterations/0424-principal-subtable-ssot docs/architecture_mantanet_and_workers.md docs/ssot
rg -n "model\\.subtable.*alias|model\\.submt.*alias|best effort|pin\\.connect\\.model.*valid|pin\\.connect\\.model.*current" docs/ssot/principal_scoped_subtable_namespace_v1.md docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/label_type_registry.md docs/ssot/pin_connection_contract_v2.md docs/ssot/imported_slide_app_host_ingress_semantics_v1.md docs/ssot/temporary_modeltable_payload_v1.md
git diff -- docs/ITERATIONS.md docs/iterations/0424-principal-subtable-ssot docs/architecture_mantanet_and_workers.md docs/ssot/principal_scoped_subtable_namespace_v1.md docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/label_type_registry.md docs/ssot/pin_connection_contract_v2.md docs/ssot/imported_slide_app_host_ingress_semantics_v1.md docs/ssot/temporary_modeltable_payload_v1.md --stat
```

Observed:

- The first `rg` shows the new SSOT and all intended cross references.
- The conflict-pattern `rg` returns no current-valid `pin.connect.model`, no `model.subtable` alias wording, and no best-effort isolation wording.
- No current-valid `pin.connect.model` wording was found in the changed SSOT surface.
- Old `origin_model_id` / `reply_target_model_id` examples remain as current v1 examples, with explicit 0424 target notes requiring `origin_table_id` / `reply_target_table_id` for App instance traffic.

Result: PASS.

## Phase 4: Review And Fix

Status: DONE

Sub-agent review 1:

```text
Decision: CHANGE_REQUESTED

Findings:
- [medium] docs/ssot/principal_scoped_subtable_namespace_v1.md:16 — Authority states this SSOT is below runtime semantics, label registry, PIN contract, and temporary payload contract, but lines 24-27 say this document wins if those current docs conflict. That reverses the repo priority model and makes future conflict resolution ambiguous for exactly the contracts this iteration is trying to freeze.
- [low] docs/iterations/0424-principal-subtable-ssot/runlog.md:21 — Phase 1 is still marked IN PROGRESS even though the same phase records Result: PASS and later phases are marked DONE. This weakens the audit trail for the planning/review gate.

Open questions:
- none

Verification gaps:
- Phase 4 review result is not yet recorded in runlog.md; expected if this review is the pending gate, but it must be recorded before the iteration is treated as review-complete.
```

Fixes applied:

- Reworded `principal_scoped_subtable_namespace_v1.md` authority/conflict behavior so it does not claim unilateral priority over runtime semantics, label registry, PIN contract, or temporary payload contract.
- Marked Phase 1 as `DONE`.
- Recorded the review result in this runlog.

Sub-agent review 2:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] docs/architecture_mantanet_and_workers.md:38 — Higher-priority architecture SSOT still defines `model_id > 0 / = 0 / < 0` as global model-id semantics, while 0424 target requires `{ table_id, model_id }` and table-local non-negative ids. Because `principal_scoped_subtable_namespace_v1.md` is explicitly below architecture, this leaves the new SSOT target contradicted by an upstream authority.
- [high] docs/architecture_mantanet_and_workers.md:46 — Higher-priority architecture SSOT still enumerates effective model labels as only `model.single / model.matrix / model.table / model.submt`, while 0424 introduces `model.subtable` as a target label type. This blocks unambiguous implementation because label registry/runtime docs now mention a target label that the upstream architecture doc does not acknowledge.

Open questions:
- none

Verification gaps:
- none
```

Fixes applied:

- Updated `docs/architecture_mantanet_and_workers.md` to acknowledge 0424 `table_id` / `ModelRef` target semantics.
- Updated `docs/architecture_mantanet_and_workers.md` to include `model.subtable` as a target effective model label for child ModelTable namespace mounting.

Post-fix verification:

```bash
rg -n '模型 id 三层语义|model_id > 0|model_id = 0|Cell 有效模型标签来自 `model\\.single / model\\.matrix / model\\.table / model\\.submt`|model\\.subtable' docs/architecture_mantanet_and_workers.md
rg -n 'this document wins|this file wins|model\\.subtable.*alias|model\\.submt.*alias|best effort|pin\\.connect\\.model.*valid|pin\\.connect\\.model.*current' docs/architecture_mantanet_and_workers.md docs/ssot/principal_scoped_subtable_namespace_v1.md docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/label_type_registry.md docs/ssot/pin_connection_contract_v2.md docs/ssot/imported_slide_app_host_ingress_semantics_v1.md docs/ssot/temporary_modeltable_payload_v1.md
```

Observed:

- Architecture SSOT now contains the 0424 `ModelRef` and `model.subtable` target terms.
- Conflict-pattern `rg` returned no matches.

Sub-agent review 3:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] docs/architecture_mantanet_and_workers.md:155 — Detailed architecture section still says there are "四种 Cell 有效模型标签", while the same file's top-level invariant and the new SSOT now require `model.subtable` as a fifth target model form. This leaves an intra-document contradiction in a higher-priority architecture doc.
- [high] docs/architecture_mantanet_and_workers.md:183 — The detailed "模型类型二维编码" list still limits label.t forms to `model.single | model.matrix | model.table | model.submt`, omitting `model.subtable`. Implementers reading the detailed section would reject the new target label even though other SSOT files now require it.

Verification gaps:
- Post-fix grep in runlog only checked the top-level old phrase and `model.subtable`; it did not catch the detailed-section "四种 Cell 有效模型标签" and exact old `label.t = 形态(...)` line.
```

Fixes applied:

- Updated `docs/architecture_mantanet_and_workers.md` §3.4 so the detailed Model Forms section acknowledges current forms plus 0424 `model.subtable`.
- Added a dedicated `model.subtable` detailed subsection that defines it as a child ModelTable namespace mount boundary, not a child model id and not a `model.submt` compatibility alias.
- Expanded the detailed `label.t` / `label.v` encoding text to include `model.subtable`.
- Expanded verification patterns to catch both top-level and detailed-section old wording.

Post-fix verification:

```bash
rg -n '四种 Cell 有效模型标签|label\.t = 形态（model\.single \| model\.matrix \| model\.table \| model\.submt）|模型 id 三层语义|model_id > 0|model_id = 0' docs/architecture_mantanet_and_workers.md
rg -n 'model\.subtable|table_id|ModelRef|PrincipalRef|visibleModelRefs|reply_target_table_id|origin_table_id' docs/architecture_mantanet_and_workers.md docs/ssot/principal_scoped_subtable_namespace_v1.md docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/label_type_registry.md docs/ssot/pin_connection_contract_v2.md docs/ssot/imported_slide_app_host_ingress_semantics_v1.md docs/ssot/temporary_modeltable_payload_v1.md
```

Observed:

- The conflict-pattern `rg` returned no matches.
- The positive reference `rg` shows `model.subtable`, `table_id`, `ModelRef`, payload table metadata, and snapshot target terms across the architecture and SSOT surface.

Sub-agent review 4:

```text
Decision: APPROVED

Findings:
- none

Open questions:
- none

Verification gaps:
- none
```

Result: PASS.

Post-review self-check:

- A broader SSOT grep found `docs/ssot/runtime_semantics_modeltable_driven.md` still had wording that could be read as a long-term bare positive `model_id` rule and a four-item effective model label set.
- Clarified runtime semantics §1.3 so bare positive model ids are explicitly current implementation fact, while 0424 target requires table-local `model_id >= 0` and table-qualified `ModelRef`.
- Clarified runtime semantics §1.4 so the four current effective model labels are current implementation fact, while 0424 target adds `model.subtable`.

Sub-agent review 5:

```text
Decision: APPROVED

Findings:
- none

Open questions:
- none

Verification gaps:
- none
```

Final result: PASS.
