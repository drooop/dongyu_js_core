---
title: "Iteration 0458 Feishu Model2 Safe Alignment Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-07-17
source: ai
iteration_id: 0458-feishu-model2-safe-alignment
id: 0458-feishu-model2-safe-alignment
phase: phase2
---

# Iteration 0458-feishu-model2-safe-alignment Resolution

## Execution Strategy

Keep three slices independently reviewable: runtime direction safety, watcher classification precision, and evidence/decision routing. Use RED-before-GREEN for behavior changes, preserve current product SSOT for disputed semantics, then rebuild the affected local OrbStack images because `runtime.mjs` is an image input and prove the existing valid dual-bus chain still works.

## Phase 2 Gate

- Review the complete plan/resolution from runtime, watcher, and authority/governance perspectives.
- Record each review in `runlog.md`.
- Phase 3 starts only after the latest three consecutive reviews are `Approved`.
- Commit the Approved planning snapshot before implementation edits.
- Stage only `docs/ITERATIONS.md` and the 0458 `plan.md`, `resolution.md`, and `runlog.md`; verify the staged path set exactly and keep all 21 unrelated unstaged documents excluded.

## Step 1 - Freeze Bus Direction RED Contracts

- Scope: add parameterized CJS/ESM cases for both bus families, both connection forms, invalid bus-in destinations, invalid bus-out sources, legal-direction controls, and route-first/pin-first/type-replacement orderings.
- Files: `scripts/tests/test_0357_pin_connection_hard_cut.mjs` and any shared test helper already owned by that contract.
- Verification: run the focused test and observe exact RED failures caused by missing direction enforcement.
- Acceptance: existing cases remain GREEN; the new invalid-direction and late-endpoint cases fail because runtime accepts them or lacks visible error evidence.
- Rollback: revert only the new test cases.

## Step 2 - Enforce Bus Direction And Update Current PIN Docs

- Scope: add one canonical validation rule in `runtime.mjs` at both route-declaration and endpoint-pin add/replace boundaries; keep `runtime.js` as the unchanged CJS shim unless an export change is required; document the endpoint direction invariant in higher-priority runtime SSOT and PIN references.
- Files:
  - `packages/worker-base/src/runtime.mjs`
  - `packages/worker-base/src/runtime.js` (verification-only CJS shim unless exports change)
  - `packages/worker-base/src/program_model_loader.js`
  - `packages/ui-model-demo-frontend/src/local_persistence.js`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/pin_connection_contract_v2.md`
  - `docs/ssot/label_type_registry.md`
  - `scripts/tests/test_0425_persistence_table_key_contract.mjs` (trusted SQLite hydration round trip)
- Verification:
  - `node scripts/tests/test_0357_pin_connection_hard_cut.mjs`
  - `node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs`
  - `node scripts/tests/test_0457_local_orbstack_de_actor_contract.mjs`
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
  - `node scripts/tests/test_0425_persistence_table_key_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_persistence_local.mjs`
- Acceptance: the later invalid declaration is rejected with the frozen reason, prior valid state remains, the rejected route/endpoint is not stored or registered, `pin_connection_error:json` records the failure in ModelTable and survives both real persistence hydration paths, and existing connection/model/actor routing stays GREEN through both module entrypoints. The trusted hydration entry may bypass only reserved-key authorship; structural, placement, payload, and direction validation remain active.
- Rollback: revert runtime and the three current documentation changes together.

## Step 3 - Fix Watcher Risk Classification

- Scope: normalize Markdown punctuation escapes, derive the complete duplicate-aware added/deleted-line multiset independently from report truncation, match keyword rules only on those changed lines, apply separate exact heading protection, and add F-07 plus F-10 through F-14 rules only to `feishu-model2`.
- Files:
  - `scripts/ops/feishu_source_watch.mjs`
  - `docs/ssot/feishu_source_watch_manifest.json`
  - `scripts/tests/test_0441_feishu_source_watch_contract.mjs`
  - committed focused fixture files under `scripts/fixtures/feishu_source_watch/`
- Verification:
  - run the focused watcher test first as RED, then GREEN;
  - run a table-driven contract mapping every keyword and exact heading frozen in `plan.md` to an independent expected stop;
  - prove that every built-in UI/side-effect, removed-wiring, scheduling/deprecation, and compatibility rule also reads only the full changed-line multiset;
  - run the watcher against old/current same-format snapshots in a temporary fixture and assert the expected risk-family headings;
  - run Node syntax checks.
- Acceptance:
  - escaped and unescaped risk terms match identically;
  - additions and removals can stop;
  - stable surrounding risk text does not make a compatible changed line stop;
  - duplicate changed-line counts remain significant and a term beyond the displayed 40 lines still stops;
  - lifecycle heading protection applies only to the exact configured headings;
  - report truncation does not hide a risk term from classification;
  - existing TLS, event, filter, fixture, and raw-fallback cases remain GREEN.
- Recorded debt: duplicate heading identity and confirmation-stop snapshot persistence remain out of scope and are stated in the report; the ignored snapshot is local evidence, not cross-clone reproducibility.
- Rollback: revert watcher, manifest keywords, tests, and focused fixture as one slice.

## Step 4 - Persist Revision Evidence And Pending Routing

- Scope: write the factual revision report, retain the ignored local snapshot only as local recheck evidence, strengthen F-07 evidence, add F-10 through F-14 pending findings and four exact routing cards, then regenerate derived artifacts.
- Files:
  - `docs/iterations/0458-feishu-model2-safe-alignment/revision-diff-report.md`
  - ignored local evidence under `test_files/feishu_current/0458/`
  - `docs/ssot/feishu_contract_backlog.md`
  - `docs/ssot/contract_surface_manifest.json`
  - generated `docs/ssot/contract_coverage_summary.md`
  - `scripts/tests/test_0455_contract_surface_index.mjs`
- Verification:
  - `node scripts/ops/build_contract_index.mjs`
  - `node scripts/tests/test_0455_contract_surface_index.mjs`
  - hash/line/diff-stat checks against the ignored local snapshot
- Acceptance:
  - F-10 through F-14 appear exactly once as `requires_user_confirmation`;
  - `model.label_key_namespaces` routes F-10; `program_model.lifecycle_and_function_contract` routes F-11/F-12; `program_model.log_schema` routes F-13; `model.functional_type_capability_matrix` routes F-14; all use `risk_level=high`;
  - each new card uses `feishu-model2` as `source_refs`, the 0458 report as evidence, and the backlog as the decision file; current SSOT/code/test anchors prove the existing or absent behavior rather than pretending the new terms are implemented;
  - `feishu_alignment_decisions_v0.md` is not a decision route for F-10 through F-14 before user confirmation;
  - the original ten cards keep their 0454 evidence, all cards have evidence, and generated output is byte-stable;
  - no alignment decision or executable product semantics is added for the disputed source changes.
- Rollback: revert routing/report changes and regenerate derived artifacts; preserve iteration history.

## Step 5 - Full Verification, Review, Commit, And Close

- Scope: run the complete bounded regression set, tag current local images, rebuild only the three affected images and restart only the four consuming OrbStack application deployments, execute the valid dual-bus smoke, complete the living-doc assessment, obtain three-view closeout review, make separate logical commits, and close Phase 4.
- Verification:
  - Steps 2-4 focused commands;
  - `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs`;
  - `node scripts/tests/test_0377_workspace_manager_de_contract.mjs`;
  - `node --check` for every changed `.mjs` and `.js` file;
  - `node scripts/ops/validate_obsidian_docs_gate.mjs`;
  - `git diff --check` and staged-diff completeness checks.
- Local rollback/deploy sequence:
  1. require exact Docker/Kubernetes context `orbstack`; run the baseline check; capture SHA-256 fingerprints without printing secret values for the complete `deploy/env/local.generated.env`, `DY_MATRIX_ROOM_ID`, canonical `.data` of `ui-server-secret` and `mbr-worker-secret`, worker ConfigMaps, and the Synapse/Mosquitto pod UIDs;
  2. record current image IDs, then run `docker tag dy-ui-server:v1 dy-ui-server:pre-0458-2aefec0`, `docker tag dy-mbr-worker:v2 dy-mbr-worker:pre-0458-2aefec0`, and `docker tag dy-remote-worker:v3 dy-remote-worker:pre-0458-2aefec0`;
  3. run only `docker build --no-cache -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`, `docker build --no-cache -f k8s/Dockerfile.remote-worker -t dy-remote-worker:v3 .`, and `docker build --no-cache -f k8s/Dockerfile.mbr-worker -t dy-mbr-worker:v2 .`; do not run `deploy_local.sh`, `ensure_runtime_baseline.sh`, any manifest apply, asset sync, Matrix bootstrap, or Secret update;
  4. run `kubectl -n dongyu rollout restart deployment/ui-server deployment/mbr-worker deployment/remote-worker deployment/workspace-manager`, wait for each exact rollout, and rerun `bash scripts/ops/check_runtime_baseline.sh`; require all six deployments Ready and require the complete generated-env, room-ID, both Secret-data, worker ConfigMap, and Synapse/Mosquitto pod-UID fingerprints to equal their pre-build values;
  5. run `node scripts/test_e2e_0457_feishu_message_api_v2_orbstack.mjs`, `node scripts/tests/test_0377_workspace_manager_de_contract.mjs`, and the existing local actor contracts;
  6. on any build, rollout, state-fingerprint, or acceptance failure, restore with `docker tag dy-ui-server:pre-0458-2aefec0 dy-ui-server:v1`, `docker tag dy-mbr-worker:pre-0458-2aefec0 dy-mbr-worker:v2`, and `docker tag dy-remote-worker:pre-0458-2aefec0 dy-remote-worker:v3`; restart only `deployment/ui-server`, `deployment/mbr-worker`, `deployment/remote-worker`, and `deployment/workspace-manager`; rerun rollout status plus the baseline check; keep 0458 incomplete.
- State-fingerprint commands use `shasum -a 256`; `kubectl ... -o json | jq -cS` canonicalizes only the selected `.data` or pod-UID fields before hashing. Only hashes and the non-secret room identity comparison are recorded. Because the bounded path never calls `save_generated_env`, whole-file equality is required and no generated timestamp is rewritten.
- Living-doc assessment: explicitly review runtime semantics, user guide, execution governance, tier conformance, alignment decisions, PIN contract, label registry, `docs/handover/dam-worker-guide.md`, backlog, and contract index; record changed/no-change reasons.
- Conformance record: state Tier 1 interpreter placement, unchanged model/data owner and Tier 2 behavior, tightened invalid direction only, and preserved legal bus-in -> routing -> target / target -> routing -> bus-out chains.
- Review: independent runtime, watcher/security, and authority/docs views; any finding resets the approval sequence after remediation.
- Commit order: planning gate; runtime direction safety; watcher/routing/report; iteration closeout.
- Acceptance: all checks and fresh local OrbStack acceptance PASS, three latest closeout reviews are Approved, iteration registry is Completed, unrelated dirty docs remain untouched, and no Feishu write/remote deploy/merge/push/PR occurred.
- Rollback: revert accepted logical commits in reverse order; current disputed Feishu behavior remains unadopted.

## Notes

- Generated at: 2026-07-17
- Stacked integration order: 0454 -> 0455 -> 0456 -> 0457 -> 0458.
- A read-only Feishu refresh may confirm evidence, but it cannot authorize a Feishu write or SSOT adoption.
