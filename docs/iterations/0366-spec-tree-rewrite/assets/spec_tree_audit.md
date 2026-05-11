---
title: "0366 Spec Tree Audit"
doc_type: iteration_asset
status: active
updated: 2026-05-10
source: ai
iteration: 0366-spec-tree-rewrite
---

# 0366 Spec Tree Audit

## Authority Tree

Current authoritative order is defined by `CLAUDE.md`:

1. `CLAUDE.md`
2. `docs/architecture_mantanet_and_workers.md`
3. `docs/ssot/runtime_semantics_modeltable_driven.md`
4. `docs/ssot/label_type_registry.md`
5. `docs/charters/*.md`
6. `docs/WORKFLOW.md`
7. `docs/ITERATIONS.md`
8. `docs/ssot/execution_governance_ultrawork_doit.md`
9. other `docs/ssot/*.md`, `docs/roadmaps/*.md`, `docs/user-guide/*.md`

Package-local `AGENTS.md` files are local navigation and working notes. They do not override the root authority tree.

## Current Normative Entry Points

- Root execution: `CLAUDE.md`
- Root repo navigation: `AGENTS.md`, `README.md`
- Docs navigation: `docs/README.md`
- Workflow: `docs/WORKFLOW.md`, `docs/ITERATIONS.md`
- System architecture SSOT: `docs/architecture_mantanet_and_workers.md`
- Project charter: `docs/charters/dongyu_app_next_runtime.md`
- Runtime / model SSOT:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/pin_connection_contract_v2.md`
  - `docs/ssot/host_ctx_api.md`
  - `docs/ssot/temporary_modeltable_payload_v1.md`
  - `docs/ssot/mt_v0_patch_ops.md`
  - `docs/ssot/tier_boundary_and_conformance_testing.md`
- Capability / product-area SSOT:
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - `docs/ssot/ui_model_pin_routing_architecture.md`
  - `docs/ssot/ui_to_matrix_event_flow.md`
  - `docs/ssot/feishu_alignment_decisions_v0.md`
  - `docs/ssot/feishu_data_model_contract_v1.md`
  - `docs/ssot/data_model_tier2_implementation_v1.md`
  - `docs/ssot/fill_table_only_mode.md`
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/ssot/execution_governance_ultrawork_doit.md`
  - `docs/ssot/program_model_pin_and_payload_contract_vnext.md`
  - `docs/ssot/model_layering_and_cell_model_labels_v0_1.md`
  - `docs/ssot/modeltable_runtime_v0.md`

## Findings

### F1 — docs index contradicts highest authority

- File: `docs/README.md`
- Problem: lists `AGENTS.md` as the highest-priority execution constitution.
- Current truth: `CLAUDE.md` is highest priority; `AGENTS.md` is repo-local navigation and collaboration guidance.
- Status: fixed in this iteration.
- Fix: rewritten docs index authority section.

### F2 — root README points to AGENTS only

- File: `README.md`
- Problem: points users to `AGENTS.md` as execution constraints and navigation, but misses `CLAUDE.md`.
- Status: fixed in this iteration.
- Fix: made `CLAUDE.md` the execution constraint entry and `AGENTS.md` the navigation entry.

### F3 — SSOT placeholder titles hide document purpose

- Files:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/mt_v0_patch_ops.md`
  - `docs/ssot/feishu_alignment_decisions_v0.md`
- Problem: frontmatter title and H1 say "定位说明（必须写在文件开头）" instead of the document's actual contract.
- Status: fixed in this iteration.
- Fix: renamed titles/H1 and kept positioning as document metadata.

### F4 — current/target migration windows are scattered

- Files: multiple PIN / UI / imported slide app docs
- Problem: `pin.bus.in/out` current window vs `pin.bus.cb/mb.*` target window is repeated in several places.
- Current decision: do not implement 0364 here; clarify "current implementation" vs "target contract" language where touched.
- Status: partially clarified; implementation deferred.
- Deferred follow-up: 0364 implementation remains separate.

### F5 — package-local AGENTS are local guidance, not versioned policy

- Files: `packages/*/AGENTS.md`, `scripts/**/AGENTS.md`, `deploy/sys-v1ns/AGENTS.md`
- Problem: these files can be useful as local guidance, but `.gitignore` ignores `AGENTS.md` outside the root file.
- Status: clarified in this iteration.
- Fix: the versioned rule tree treats only root `AGENTS.md` as repo-local tracked guidance. Ignored local AGENTS files may exist in the working tree but are not committed policy sources.

### F6 — mixed-language phrase obscures migration rule

- Files: `CLAUDE.md`, `docs/ssot/runtime_semantics_modeltable_driven.md`, `docs/ssot/pin_connection_contract_v2.md`, `docs/ssot/label_type_registry.md`
- Problem: phrase `目标作者ing口径` is unclear.
- Status: fixed in this iteration.
- Fix: replaced with `目标编写口径`.

### F7 — local docs should not be fully rewritten in one pass

- Files: historical iteration records, tutorials, deprecated notes.
- Problem: some old files contain superseded wording by design.
- Status: intentionally out of scope.
- Decision: do not rewrite historical evidence. When a historical document conflicts with current truth, current SSOT wins; if it is user-facing and active, fix it in a targeted follow-up.
