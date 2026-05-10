---
title: "Iteration 0367 File Treatment Manifest"
doc_type: audit_asset
status: completed
updated: 2026-05-10
owner: codex
source: ai
---

# File Treatment Manifest

Treatment values:

- `rewrite`: edit content so it becomes current, clearer, and aligned with 0365/0366.
- `annotate`: add or preserve status/authority boundary without changing historical substance.
- `index`: update listing/navigation/classification only.
- `preserve`: do not edit unless verification finds a direct conflict.
- `defer`: record unresolved issue; do not guess.

## Root Docs

| File | Treatment | Reason |
|---|---|---|
| `docs/CODEX_HANDOFF_MODE.md` | annotate | Developer workflow supplement; clarify it does not override product/runtime SSOT. |
| `docs/ITERATIONS.md` | index | Register and close 0367 status only. |
| `docs/README.md` | rewrite | Primary docs tree entrypoint. |
| `docs/TODO.md` | annotate | Task notes; must not look like current policy. |
| `docs/UI_ITERATION_WAVE_POST_0201.md` | annotate | Historical wave notes. |
| `docs/WORKFLOW.md` | rewrite | Current workflow/gate policy. |
| `docs/ai-work-conventions.md` | annotate | Deprecated historical reference; not current policy. |
| `docs/architecture_mantanet_and_workers.md` | rewrite | Still discoverable architecture explanation; needs current/historical boundaries. |
| `docs/architecture_review.md` | annotate | Review evidence; not current authority. |
| `docs/v1n_concept_and_implement.md` | annotate | Concept/implementation note; status boundary needed. |

## Templates And Reviews

| File | Treatment | Reason |
|---|---|---|
| `docs/_templates/iteration_plan.template.md` | annotate | Keep template aligned with status/frontmatter expectations if needed. |
| `docs/_templates/iteration_resolution.template.md` | annotate | Keep template aligned with status/frontmatter expectations if needed. |
| `docs/_templates/iteration_runlog.template.md` | annotate | Keep template aligned with verification/runlog expectations if needed. |
| `docs/architecture-review-2026-04/REVIEW.md` | preserve | Historical review artifact. |

## Current Normative Or Near-Normative Docs

| File | Treatment | Reason |
|---|---|---|
| `docs/charters/dongyu_app_next_runtime.md` | rewrite | Active charter layer. |
| `docs/ssot/data_model_tier2_implementation_v1.md` | rewrite | Current SSOT. |
| `docs/ssot/execution_governance_ultrawork_doit.md` | rewrite | Current AI execution governance. |
| `docs/ssot/feishu_alignment_decisions_v0.md` | rewrite | Current alignment decisions; clarify maintenance chain. |
| `docs/ssot/feishu_data_model_contract_v1.md` | rewrite | Current data model contract. |
| `docs/ssot/fill_table_only_mode.md` | rewrite | Current fill-table policy. |
| `docs/ssot/host_ctx_api.md` | rewrite | Current host ctx boundary. |
| `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` | rewrite | Current imported app host ingress semantics. |
| `docs/ssot/label_type_registry.md` | rewrite | Current label registry. |
| `docs/ssot/model_layering_and_cell_model_labels_v0_1.md` | rewrite | Current model layering contract. |
| `docs/ssot/modeltable_runtime_v0.md` | rewrite | Current ModelTable runtime contract. |
| `docs/ssot/mt_v0_patch_ops.md` | rewrite | Current patch operations contract. |
| `docs/ssot/orchestrator_hard_rules.md` | rewrite | Current orchestrator hard rules; verify hard-rule wording. |
| `docs/ssot/pin_connection_contract_v2.md` | rewrite | Current pin connection contract. |
| `docs/ssot/program_model_pin_and_payload_contract_vnext.md` | rewrite | Current/next contract requires status clarity. |
| `docs/ssot/runtime_semantics_modeltable_driven.md` | rewrite | Current runtime semantics SSOT. |
| `docs/ssot/temporary_modeltable_payload_v1.md` | rewrite | Current temporary payload contract; clarify temporary boundary. |
| `docs/ssot/tier_boundary_and_conformance_testing.md` | rewrite | Current tier boundary/conformance SSOT. |
| `docs/ssot/ui_model_pin_routing_architecture.md` | rewrite | Current UI routing architecture. |
| `docs/ssot/ui_to_matrix_event_flow.md` | rewrite | Current UI-to-Matrix event flow. |

## Concept, Deployment, Roadmap, Handover, Prompt, Test, Tmp

| File | Treatment | Reason |
|---|---|---|
| `docs/concepts/pictest_pin_and_program_model.md` | annotate | Concept/historical context. |
| `docs/deployment/infrastructure_recovery.md` | annotate | Recovery note; clarify current applicability. |
| `docs/deployment/remote_worker_k8s_runbook.md` | rewrite | Potentially current runbook. |
| `docs/deployment/runtime_baseline_default.md` | rewrite | Potentially current baseline runbook. |
| `docs/handover/asdh.md` | preserve | Historical handover. |
| `docs/handover/dam-worker-guide.md` | annotate | Historical handover that may still be discoverable. |
| `docs/handover/handover-0212-model100-conformance.md` | preserve | Historical handover. |
| `docs/handover/rke2-cluster-diagnosis-0213.md` | preserve | Historical diagnosis. |
| `docs/handover/会议纪要0210.md` | preserve | Historical meeting note. |
| `docs/prompts/modeltable-label-assistant.md` | annotate | Prompt archive; not current policy. |
| `docs/prompts/Modelfile` | annotate | Prompt archive; tracked non-Markdown file. |
| `docs/roadmaps/dongyu-app-next-runtime.md` | annotate | Roadmap/target material. |
| `docs/roadmaps/modeltable-editor-v1.md` | annotate | Roadmap/target material. |
| `docs/roadmaps/sliding-ui-workspace-plan.md` | annotate | Roadmap/target material. |
| `docs/tests/color-generator-matrix-rate-limit-0137.md` | preserve | Test/evidence note. |
| `docs/tmp/hadnoff_2026-02-06T22-16-00-392Z.md` | preserve | Temporary historical material. |
| `docs/tmp/obsidian_migration_report_2026-02-24.md` | preserve | Temporary migration report. |

## Plans

All files in `docs/plans/` are historical or design-plan evidence unless a current SSOT explicitly promotes them. This iteration may add index/status boundary text but must not rewrite them as current policy.

| File | Treatment | Reason |
|---|---|---|
| `docs/plans/2026-02-11-pin-isolation-and-model-hierarchy-design.md` | preserve | Historical plan. |
| `docs/plans/2026-03-07-handoff-mode-protocol-design.md` | preserve | Historical plan. |
| `docs/plans/2026-03-07-handoff-mode-protocol-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-03-11-cloud-deploy-remote-build-split-design.md` | preserve | Historical plan. |
| `docs/plans/2026-03-11-cloud-deploy-remote-build-split-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-03-19-ui-tier-migration-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-03-19-worker-tier2-audit-and-rollout-plan.md` | preserve | Historical plan. |
| `docs/plans/2026-03-20-persisted-asset-loader-freeze.md` | preserve | Historical plan. |
| `docs/plans/2026-03-26-cross-model-pin-owner-materialization-design.md` | preserve | Historical plan. |
| `docs/plans/2026-03-26-pin-only-core-with-scoped-privilege-design.md` | preserve | Historical plan. |
| `docs/plans/2026-03-26-scoped-privilege-runtime-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-03-27-cellwise-ui-authoring-contract-v1.md` | preserve | Historical plan. |
| `docs/plans/2026-03-27-hard-cut-closeout-plan.md` | preserve | Historical plan. |
| `docs/plans/2026-03-27-hard-cut-ui-authoring-and-write-program.md` | preserve | Historical plan. |
| `docs/plans/2026-03-29-model100-submit-roundtrip-hardening-plan.md` | preserve | Historical plan. |
| `docs/plans/2026-03-30-scoped-patch-authority-design.md` | preserve | Historical plan. |
| `docs/plans/2026-03-30-scoped-patch-authority-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-03-31-home-all-models-filter-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-03-31-workspace-ui-filltable-example-design.md` | preserve | Historical plan. |
| `docs/plans/2026-03-31-workspace-ui-filltable-example-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-04-01-doc-page-filltable-design.md` | preserve | Historical plan. |
| `docs/plans/2026-04-01-doc-page-filltable-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-04-01-static-workspace-rebuild-design.md` | preserve | Historical plan. |
| `docs/plans/2026-04-01-static-workspace-rebuild-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-04-03-non-three-fine-grain-audit.md` | preserve | Historical plan. |
| `docs/plans/2026-04-03-slide-matrix-three-current-baseline.md` | preserve | Historical plan. |
| `docs/plans/2026-04-06-foundation-c-data-models-design.md` | preserve | Historical plan. |
| `docs/plans/2026-04-06-foundation-c-data-models-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-04-06-pin-contract-cleanup-design.md` | preserve | Historical plan. |
| `docs/plans/2026-04-06-pin-contract-cleanup-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-04-06-pin-payload-impact-inventory-and-migration.md` | preserve | Historical plan. |
| `docs/plans/2026-04-08-slide-app-zip-import-v1-design.md` | preserve | Historical plan. |
| `docs/plans/2026-04-08-slide-app-zip-import-v1-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-04-09-cloud-worker-sync-and-color-proxy-import-design.md` | preserve | Historical plan. |
| `docs/plans/2026-04-09-cloud-worker-sync-and-color-proxy-import-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-04-09-slide-runtime-followup-it-breakdown.md` | preserve | Historical plan. |
| `docs/plans/2026-04-14-imported-slide-app-host-ingress-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-04-26-mgmt-bus-console-and-slide-flow-design.md` | preserve | Historical plan. |
| `docs/plans/2026-04-26-mgmt-bus-console-and-slide-flow-implementation.md` | preserve | Historical plan. |
| `docs/plans/2026-05-06-pin-connection-hard-cut-implementation.md` | preserve | Historical plan. |

## User Guide

| File | Treatment | Reason |
|---|---|---|
| `docs/user-guide/README.md` | rewrite | User-facing entrypoint and classification map. |
| `docs/user-guide/ai_prompt_and_artifact_guidance.html` | preserve | HTML companion; only edit if Markdown changes require sync. |
| `docs/user-guide/ai_prompt_and_artifact_guidance.md` | rewrite | Current prompt/artifact guidance. |
| `docs/user-guide/claude_code_wave_launcher_0210_0217_prompt.txt` | annotate | Historical prompt archive. |
| `docs/user-guide/claude_code_wave_post_0232_prompt.txt` | annotate | Historical prompt archive. |
| `docs/user-guide/color_generator_e2e_runbook.md` | annotate | Runbook/example; verify current status. |
| `docs/user-guide/data_models_filltable_guide.md` | rewrite | Current user guide candidate. |
| `docs/user-guide/design_system_v2.md` | annotate | Design guide; clarify current status. |
| `docs/user-guide/diary/2026/2026-02-01_0122-0133_weekly/handoff_compact.md` | preserve | Diary/archive. |
| `docs/user-guide/diary/2026/2026-02-01_0122-0133_weekly/weekly-report.md` | preserve | Diary/archive. |
| `docs/user-guide/doc_page_filltable_guide.md` | rewrite | Current user guide candidate. |
| `docs/user-guide/doc_workspace_filltable_example.md` | rewrite | Current/example guide candidate. |
| `docs/user-guide/dual_worker_slide_e2e_v0.md` | annotate | E2E runbook; verify current status. |
| `docs/user-guide/filltable_capability_matrix.md` | rewrite | Current capability guide candidate. |
| `docs/user-guide/llm_cognition_ollama_runbook.md` | annotate | Runbook; verify current status. |
| `docs/user-guide/matrix_userline_phase1.md` | annotate | Phase guide; clarify historical/current status. |
| `docs/user-guide/matrix_userline_phase2.md` | annotate | Phase guide; clarify historical/current status. |
| `docs/user-guide/modeltable_user_guide.md` | rewrite | Current user guide. |
| `docs/user-guide/orchestrator_local_smoke.md` | annotate | Smoke runbook; verify current status. |
| `docs/user-guide/orchestrator_wave_0210_0217_prompt.txt` | annotate | Historical prompt archive. |
| `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt` | annotate | Historical prompt archive. |
| `docs/user-guide/orchestrator_wave_post_0232_prompt.txt` | annotate | Historical prompt archive. |
| `docs/user-guide/project_address_record.md` | annotate | Address/runbook record; verify current status. |
| `docs/user-guide/prompt_filltable_owner_chain_and_deploy.md` | annotate | Guide/runbook; verify current status. |
| `docs/user-guide/slide-app-runtime/README.md` | rewrite | Slide app runtime guide entrypoint. |
| `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md` | rewrite | Current provider guide candidate. |
| `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html` | preserve | Interactive HTML; only edit if linked guide changes require sync. |
| `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md` | rewrite | Visualized companion in Markdown. |
| `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md` | rewrite | Current developer guide candidate. |
| `docs/user-guide/slide-app-runtime/slide_app_runtime_flow_visualized.html` | preserve | Visualized HTML; only edit if linked guide changes require sync. |
| `docs/user-guide/slide_app_filltable_create_v1.md` | rewrite | Current slide guide candidate. |
| `docs/user-guide/slide_app_zip_import_v1.md` | rewrite | Current slide guide candidate. |
| `docs/user-guide/slide_delivery_and_runtime_overview_v1.md` | rewrite | Current overview candidate. |
| `docs/user-guide/slide_executable_import_v1.md` | rewrite | Current slide guide candidate. |
| `docs/user-guide/slide_matrix_delivery_preview_v0.md` | annotate | Preview guide; clarify status. |
| `docs/user-guide/slide_matrix_delivery_v1.md` | rewrite | Current slide guide candidate. |
| `docs/user-guide/slide_python_install_client_v1.md` | rewrite | Current install guide candidate. |
| `docs/user-guide/slide_ui_evidence_runbook.md` | annotate | Evidence runbook; clarify current status. |
| `docs/user-guide/slide_ui_mainline_guide.md` | rewrite | Current slide UI guide candidate. |
| `docs/user-guide/slide_upload_auth_and_cache_contract_v1.md` | rewrite | Current contract guide candidate. |
| `docs/user-guide/slide_workspace_generalization.md` | annotate | Guide/plan hybrid; clarify status. |
| `docs/user-guide/static_workspace_rebuild.md` | annotate | Runbook; clarify status. |
| `docs/user-guide/ui_binding_conversational.md` | rewrite | Current user-facing UI binding guide candidate. |
| `docs/user-guide/ui_components_v2.md` | rewrite | Current UI components guide candidate. |
| `docs/user-guide/ui_event_matrix_mqtt_configuration.md` | rewrite | Current event/config guide candidate. |
| `docs/user-guide/ui_model_filltable_workspace_example.md` | rewrite | Current/example guide candidate. |
| `docs/user-guide/workspace_ui_filltable_example.md` | rewrite | Current/example guide candidate. |
| `docs/user-guide/workspace_ui_filltable_example_visualized.html` | preserve | Visualized HTML; only edit if linked guide changes require sync. |
| `docs/user-guide/workspace_ui_filltable_example_visualized.md` | rewrite | Visualized companion in Markdown. |

## Iterations

`docs/iterations/**` historical body files are directory-level `preserve`. This iteration may only change:

- `docs/iterations/0367-docs-tree-rewrite/plan.md`
- `docs/iterations/0367-docs-tree-rewrite/resolution.md`
- `docs/iterations/0367-docs-tree-rewrite/runlog.md`
- `docs/iterations/0367-docs-tree-rewrite/assets/docs_tree_inventory.md`
- `docs/iterations/0367-docs-tree-rewrite/assets/file_treatment_manifest.md`
- `docs/iterations/0367-docs-tree-rewrite/assets/contradictions_and_deferred.md` if needed
