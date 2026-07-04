---
title: "Iteration 0431 Subtable Connection SSOT Correction Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-07-01
source: ai
iteration_id: 0431-subtable-connection-ssot
id: 0431-subtable-connection-ssot
phase: complete
---

# Iteration 0431-subtable-connection-ssot Runlog

## Environment

- Date: 2026-07-01
- Branch: `dropx/dev_0431-subtable-connection-ssot`
- Runtime: docs-only SSOT correction; no runtime/server/deploy/browser work in
  this iteration.
- Base context:
  - `cce842c fix(slide-app): route provider app tables [0430]`
  - User corrected the 0428/0430 interpretation:
    - `model.subtable` belongs on child ModelTable Model 0 `(0,0,0)`.
    - `model.subtableconnection` belongs on the main/parent table as an index.
    - `model.submt` belongs in the child model.
    - `model.submtconnection` belongs in the main/parent or secondary model as
      an index.
    - These are relationship/declaration labels, not two alternative pin wiring
      styles.

## Review Gate Record

- Iteration ID: `0431-subtable-connection-ssot`
- Review Date: 2026-07-01
- Review Type: User correction plus AI-assisted sub-agent
- Review Index: 1
- Decision: Approved
- Notes:
  - User said "同意,继续" after being told the next step should be a new
    correction iteration that freezes SSOT before implementation.
  - Sub-agent planning review approved the 0431 docs-only correction plan.

## Execution Records

### Stage 0.1: Create Correction Branch And Scaffold

- Command:
  - `git switch -c dropx/dev_0431-subtable-connection-ssot`
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0431-subtable-connection-ssot --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output:
  - `Switched to a new branch 'dropx/dev_0431-subtable-connection-ssot'`
  - `written .../docs/iterations/0431-subtable-connection-ssot/plan.md`
  - `written .../docs/iterations/0431-subtable-connection-ssot/resolution.md`
  - `written .../docs/iterations/0431-subtable-connection-ssot/runlog.md`
- Result: PASS
- Commit: pending

### Stage 0.2: Write Correction Plan

- Command:
  - Edited docs with `apply_patch`.
  - `git diff --check -- docs/ITERATIONS.md docs/iterations/0431-subtable-connection-ssot`
  - `rg -n --glob '!runlog.md' "\\[(TO)DO\\]|Descri[b]e the iteration objective|Explai[n] implementation approach|PLACEHOLD[E]R|pendin[g]" docs/iterations/0431-subtable-connection-ssot docs/ITERATIONS.md`
  - Spawned sub-agent with `codex-code-review` skill.
- Key output:
  - `plan.md` defines the corrected four-label placement model.
  - `resolution.md` keeps the iteration docs-only and separates future runtime
    implementation work.
  - `runlog.md` records the user correction as the superseding input.
  - `git diff --check` returned no whitespace errors.
  - Placeholder search returned no matches.
  - Sub-agent planning review:
    - Decision: APPROVED.
    - Findings: none.
    - Open questions: none.
    - Verification gaps: none.
- Result: PASS
- Commit: pending

### Stage 1: Correct SSOT Model Boundary Wording

- Command:
  - Edited docs with `apply_patch`.
  - `git diff --check -- CLAUDE.md docs/ssot`
  - `rg -n "hosting Cell|hosting cell|mount Cell" CLAUDE.md docs/ssot -g '*.md'`
  - Spawned sub-agent with `codex-code-review` skill.
- Key output:
  - `CLAUDE.md` now defines `model.subtable` / `model.submt` as child-side
    declarations.
  - `CLAUDE.md` now defines `model.subtableconnection` /
    `model.submtconnection` as parent/main-side relationship indexes.
  - Follow-up after renewed user challenge:
    `docs/architecture_mantanet_and_workers.md` had stale high-priority wording
    that still described `model.submt` / `model.subtable` as parent-side
    hosting/mount Cells; it was corrected to the same child-side declaration /
    parent-side index split.
  - `label_type_registry`, runtime semantics, PIN contract, Feishu alignment,
    principal-scoped subtable namespace, model layering, imported ingress,
    data-model, host ctx, and conformance docs now use the corrected placement.
  - `git diff --check` returned no whitespace errors.
  - `rg` returned no `hosting Cell` / `hosting cell` / `mount Cell` matches in
    `CLAUDE.md docs/ssot`.
  - First sub-agent SSOT review returned `CHANGE_REQUESTED` for stale mount /
    hosting wording.
- After fixes, second sub-agent SSOT review returned:
  - Decision: APPROVED.
  - Findings: none.
  - Open questions: none.
  - Verification gaps: none.
- Renewed sub-agent review after adding architecture SSOT correction returned:
  - Decision: CHANGE_REQUESTED.
  - Finding: two current relay rules still used legacy `cell_connection`
    wording instead of `pin.connect.cell`.
  - Fix: updated `docs/ssot/runtime_semantics_modeltable_driven.md` and
    `docs/user-guide/modeltable_user_guide.md` to use `pin.connect.cell`.
  - Additional cleanup: current runtime-semantics path wording now uses
    `pin.connect.cell` / `pin.connect.label` and split `pin.bus.cb.*` /
    `pin.bus.mb.*`; old `BUS_IN` / `BUS_OUT` / `CELL_CONNECT` /
    `cell_connection` names remain only in explicit historical-name,
    historical-implementation, or test-script-name contexts.
- Second renewed sub-agent review returned:
  - Decision: CHANGE_REQUESTED.
  - Findings:
    - `CLAUDE.md` still pointed legacy connection users to `CELL_CONNECT`.
    - `minimal_submit_app_provider_visualized.md` oversimplified the
      `pin.connect.model` replacement as only `pin.connect.cell`.
  - Fix:
    - `CLAUDE.md` now points legacy connection replacements to
      `pin.connect.label` / `pin.connect.cell`.
    - The visualized guide now states the full replacement path:
      parent-side `model.submtconnection` or `model.subtableconnection`
      boundary plus child root pins, with `pin.connect.cell` only inside one
      model/table.
- Third renewed sub-agent review returned:
  - Decision: CHANGE_REQUESTED.
  - Findings:
    - Several current route descriptions still mixed child-side declaration
      labels into the wiring path.
    - `modeltable_user_guide.md` still described historical `trigger_funcs`
      as if it were a current optional field.
  - Fix:
    - Route descriptions now use parent-side connection Cell boundary pins,
      child root boundary pins, and same-model/table `pin.connect.cell`.
    - `model.submt` / `model.subtable` are described only as child-side
      identity declarations in those route contexts.
    - `trigger_funcs` is marked historical and forbidden for new fill-table
      work.
- Fourth renewed sub-agent review returned:
  - Decision: CHANGE_REQUESTED.
  - Finding: `ui_model_pin_routing_architecture.md` overview still mixed
    child root `model.submt` declaration into a route/wiring path sentence.
  - Fix: the overview now uses parent-side `model.submtconnection` Cell
    boundary pins, child model root boundary pins, and same-model
    `pin.connect.cell`; it separately states that `model.submt` only declares
    child-side identity.
- Final sub-agent review after that fix:
  - Decision: APPROVED.
  - Findings: none.
  - Verification gaps: no HTML/browser rendering because this is docs-only
    SSOT review.
- Result: PASS
- Commit: pending

### Stage 2: Correct Developer-Facing Guidance

- Command:
  - Edited docs with `apply_patch`.
  - `rg -n 'hosting Cell|hosting cell|mount Cell|`model\\.submt` hosting|`model\\.subtable` hosting|`model\\.subtable` 边界|model\\.submt ->|model\\.submt 被|Model 0 写 model\\.submt|写 `model\\.subtable`' docs/user-guide -g '*.md' -g '*.html'`
  - `git diff --check -- docs/user-guide docs/ssot docs/iterations/0431-subtable-connection-ssot docs/ITERATIONS.md CLAUDE.md`
  - `node scripts/ops/obsidian_docs_migrate.mjs --root docs --phase all`
  - Spawned sub-agent with `codex-code-review` skill.
- Key output:
  - `modeltable_user_guide.md` now explains child-side declarations and
    parent-side indexes separately.
  - Minimal Submit Markdown / visualized / interactive HTML docs now say host
    Model 0 writes `model.subtableconnection`, while App table root declares
    `model.subtable`.
  - Runtime developer and fill-table example docs now use
    `model.submtconnection` + child root `model.submt`.
  - Old user-guide wording search returned no matches.
  - `git diff --check` returned no whitespace errors.
  - `obsidian_docs_migrate` dry-run exited 0 and reported global frontmatter
    normalization candidates; not applied because this iteration is a semantic
    correction, not a whole-doc-format migration.
- First sub-agent developer-doc review returned `CHANGE_REQUESTED` for stale
  mount / hosting wording in slide app runtime docs.
- After fixes, second sub-agent developer-doc review returned:
  - Decision: APPROVED.
  - Findings: none.
  - Open questions: none.
  - Verification gaps: none.
- Result: PASS
- Commit: pending

### Stage 3: Final Verification And Completion

- Command:
  - `git diff --check`
  - `rg -n 'hosting Cell|hosting cell|mount Cell|mount relay|host / mount|Model 0 mount|`model\\.submt` hosting|`model\\.subtable` hosting|`model\\.subtable` 边界|model\\.submt ->|model\\.submt 被|Model 0 写 model\\.submt|写 `model\\.subtable`' CLAUDE.md docs/ssot docs/user-guide -g '*.md' -g '*.html'`
  - `rg -n 'model\\.subtableconnection.*(not accepted|not an accepted|does not adopt|not adopt|rejected)|model\\.submtconnection.*(not accepted|not an accepted|does not adopt|not adopt|rejected)' CLAUDE.md docs/ssot docs/user-guide -g '*.md' -g '*.html'`
  - `rg -n --glob '!runlog.md' '\\[(TO)DO\\]|Descri[b]e the iteration objective|Explai[n] implementation approach|PLACEHOLD[E]R|pendin[g]' docs/iterations/0431-subtable-connection-ssot docs/ITERATIONS.md`
- Key output:
  - `git diff --check` returned no whitespace errors.
  - Old host/mount/submt wording search returned no matches.
  - Connection-label rejection wording search returned no matches.
  - Iteration placeholder search returned no matches.
- Final sub-agent review:
  - Decision: APPROVED.
  - Findings: none.
  - Open questions: none.
  - Verification gaps: none.
- Result: PASS
- Commit: pending

## Docs Updated / Assessed

- [x] `docs/ssot/feishu_model_label_alignment_v1.md`
- [x] `CLAUDE.md`
- [x] `docs/ssot/label_type_registry.md`
- [x] `docs/ssot/runtime_semantics_modeltable_driven.md`
- [x] `docs/ssot/pin_connection_contract_v2.md`
- [x] `docs/ssot/principal_scoped_subtable_namespace_v1.md`
- [x] `docs/ssot/temporary_modeltable_payload_v1.md` (assessed; no change needed)
- [x] `docs/user-guide/modeltable_user_guide.md`
- [x] `docs/user-guide/slide-app-runtime/*minimal_submit*`
