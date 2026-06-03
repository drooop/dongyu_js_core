---
title: "0407 Current Model Reference Resolution"
doc_type: iteration-resolution
status: active
updated: 2026-06-03
iteration_id: 0407-current-model-ref
id: 0407-current-model-ref
source: ai
---

# 0407 Current Model Reference Resolution

## Stage 1: Contract Tests

Files:
- Add or modify `scripts/tests/test_0407_current_model_ref_contract.mjs`.

Steps:
1. Add a renderer-level test where `bind.read`, `target_ref`, `value_ref.$label`, `tasksRef`, and `filterRef` omit `model_id`.
2. Add a bus-event test where `bus_event_v2.value_ref` and `bus_event_v2.meta_ref` contain `$label` refs without `model_id`; assert that after frontend dispatch and server handling, the formal event is written to `Model 0 Cell(0,0,0)` as `k=<bus_in_key>` and `t=pin.bus.cb.in`.
3. Run the test and confirm it fails before implementation because omitted refs resolve incorrectly.
4. Keep the test focused on the current-model rule, not general UI behavior.

Verification:
- `node scripts/tests/test_0407_current_model_ref_contract.mjs` initially fails for the missing current-model behavior.

Review:
- Run sub-agent review for the test slice before implementing runtime changes.

## Stage 2: Renderer And Overlay Resolution

Files:
- Modify `packages/ui-renderer/src/renderer.mjs`.
- Modify `packages/ui-renderer/src/renderer.js`.
- Modify `packages/ui-model-demo-frontend/src/remote_store.js` if overlay/effective read needs normalized refs.

Steps:
1. Add a small helper that resolves label refs against current node context when `model_id` is omitted.
2. Apply the helper to renderer reads, `$label` deep resolution, write targets, commit targets, bus value/meta refs, and component `*Ref` reads.
3. Ensure explicit `model_id` values, including negative system models and Model 0, keep their current meaning.
4. Normalize refs before handing them to overlay storage or committed writes.

Verification:
- `node scripts/tests/test_0407_current_model_ref_contract.mjs` passes.
- `node scripts/tests/test_0405_todo_components_contract.mjs` passes.
- `node scripts/tests/test_0405_todo_submit_overlay_contract.mjs` passes.

Review:
- Run sub-agent code review for renderer/overlay changes and fix findings before moving on.

## Stage 3: Refill Models And Examples

Files:
- Modify `packages/worker-base/system-models/workspace_positive_models.json`.
- Modify `docs/user-guide/examples/ui_basic_filltable_validation_app_payload.json`.
- Search and update other non-built-in slide app payloads that use same-model `model_id: 0`.

Steps:
1. Rewrite To Do Board same-model refs without `model_id`.
2. Rewrite non-built-in app example refs without `model_id`.
3. Keep built-in/cross-model refs explicit.
4. Add checks that To Do Board and examples no longer rely on same-model hard-coded ids.

Verification:
- To Do Board contract tests pass.
- Current-model contract test passes.
- Search confirms targeted non-built-in payloads no longer use same-model `model_id: 0`.

Review:
- Run sub-agent code review for model/example refill and fix findings before moving on.

## Stage 4: Documentation

Files:
- Modify `docs/user-guide/ui_model_basic_filltable_guide.md`.
- Modify `docs/user-guide/ui_components_v2.md`.
- Modify any relevant slide-app runtime doc if it still teaches `model_id: 0` as current-model placeholder.
- Evaluate `docs/ssot/runtime_semantics_modeltable_driven.md`, `docs/user-guide/modeltable_user_guide.md`, and `docs/ssot/tier_boundary_and_conformance_testing.md`.

Steps:
1. Add a clear authoring rule: same-model refs omit `model_id`; cross-model refs include it.
2. Update the screenshot-adjacent business event example.
3. Update To Do Board extension docs to use omitted `model_id`.
4. Remove or correct old “installer remap model_id: 0” wording.
5. Record living docs review result in `runlog.md`, including which SSOT/user-guide/tier-boundary files were updated or marked not applicable.

Verification:
- Documentation grep confirms no updated guide tells developers to use `model_id: 0` for current model.
- `git diff --check` passes.
- Runlog contains PASS/NA living docs review evidence for runtime semantics, modeltable user guide, and tier-boundary conformance docs.

Review:
- Run sub-agent code review for docs and fix findings before final verification.

## Stage 5: Final Verification

Commands:
- `git diff --check`
- `node scripts/tests/test_0407_current_model_ref_contract.mjs`
- `node scripts/tests/test_0405_todo_components_contract.mjs`
- `node scripts/tests/test_0405_todo_slide_app_contract.mjs`
- `node scripts/tests/test_0405_todo_submit_overlay_contract.mjs`
- `node scripts/validate_ui_ast_v0x.mjs --case all`

Completion:
- Update `docs/iterations/0407-current-model-ref/runlog.md` with PASS evidence and review outcomes.
- Update `docs/iterations/0407-current-model-ref/runlog.md` with living docs review evidence.
- Update `docs/ITERATIONS.md` status to Completed.

Rollback:
- Revert the renderer/overlay helper, model ref rewrites, docs edits, and 0407 iteration row/files.
