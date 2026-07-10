---
title: "Iteration 0457 Feishu Message API v2 + Local DE Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-07-11
source: ai
iteration_id: 0457-feishu-message-api-v2-local-de
id: 0457-feishu-message-api-v2-local-de
phase: phase3
---

# Iteration 0457 Feishu Message API v2 + Local DE Runlog

## Environment

- Date: 2026-07-10
- Branch: `dropx/dev_0457-feishu-message-api-v2-local-de`
- Baseline commit: `e0c48fa`
- Runtime target: local OrbStack Kubernetes, namespace `dongyu`
- Stacked dependency: 0454 → 0455 → 0456 → 0457; none is merged to `dev` in this branch chain.
- Feishu boundary: read-only connection allowed; no Feishu write authorized.

## Phase 0 / Phase 1 Facts

### Intake and Registration

- Commands:
  - `git status --short --branch`
  - `git switch -c dropx/dev_0457-feishu-message-api-v2-local-de`
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0457-feishu-message-api-v2-local-de --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - Registered 0457 in `docs/ITERATIONS.md` before implementation.
- Key output:
  - Baseline worktree was clean at `e0c48fa`.
  - 0457 branch and iteration directory were created successfully.
- Result: PASS
- Commit: `ce32178`

### Read-Only OrbStack Baseline Check

- Commands:
  - `orb status`
  - `docker context show`
  - `kubectl config current-context`
  - `kubectl get deploy,pods,svc,pvc -n dongyu -o wide`
  - `bash scripts/ops/check_runtime_baseline.sh`
- Key output:
  - OrbStack is running; Docker and Kubernetes contexts are both `orbstack`.
  - Mosquitto, Synapse, remote-worker/R1, workspace-manager/WM1, mbr-worker, and ui-server are `1/1 Ready`.
  - Existing checker reported `[check] baseline ready`.
- Result: PASS as current checker behavior; not accepted as 0457 completion evidence.
- Commit: N/A

### Baseline False-Positive Reproduction

- Commands:
  - Read only `matrix.server` values from live `mbr-worker-secret` and `ui-server-secret`.
  - `kubectl -n dongyu logs deploy/mbr-worker --tail=300 | rg 'Matrix|matrix|TLS|fetch failed|adapter'`
  - `kubectl -n dongyu exec deploy/mbr-worker -- node -e "fetch('http://synapse.dongyu.svc.cluster.local:8008/_matrix/client/versions')..."`
- Key output:
  - Both live bootstrap patches use `https://matrix.dongyudigital.com`.
  - MBR logs show the remote Matrix `whoami` fetch fails.
  - The same MBR pod receives HTTP 200 from the local Synapse service.
  - Therefore local Synapse readiness plus remote bootstrap currently passes the checker incorrectly.
- Result: FAIL for the user's clarified all-local acceptance boundary; expected planning finding.
- Commit: N/A

### Actor/Contract Read-Only Findings

- Commands:
  - Inspected current worker identity/role/bus/model patches with `rg` and `jq`.
  - Inspected canonical runtime ingress, Feishu v1 parser, formal v2 validator, and response path.
- Key output:
  - MBR patch: `sys_worker_id=5/10/28/35/14`, `sys_worker_role=DEM`.
  - R1 patch: `sys_worker_id=5/10/28/35/15`, `sys_worker_role=V1N`, `mqtt_worker_id=R1`.
  - WM1 patch: `sys_worker_id=5/10/28/36/16`, `sys_worker_role=DEM`, `mqtt_worker_id=WM1`.
  - All three role patches currently omit worker-root `model.v1n`.
  - MBR currently keeps `mbr_cb_dispatch` on Model 0 and the runner writes Matrix/MQTT inbox labels directly to Model `-10` before direct function execution.
  - R1's MQTT path can write directly to positive model pins when `mqtt_ingress_pin` is absent.
  - Formal v2 validation already exists in canonical `runtime.mjs`; `runtime.js` is a CJS shim.
  - Current Feishu v1 special-case must be replaced by v2 business validation plus explicit legacy rejection.
- Result: PASS as planning evidence; implementation not started.
- Commit: N/A

## Phase 2 Review Gate

- Review round 1:
  - Parser reviewer: `Change Requested`.
  - Runtime/OrbStack reviewer: `Change Requested`.
  - SSOT/authority reviewer: `Change Requested`.
  - Shared blockers: unresolved `model.table`/`model.v1n` authority conflict; Tier 1 retained Feishu business ownership; no precise real actor endpoint/evidence; remote OIDC omitted; duplicated standalone/runtime validator design; premature SSOT/F-01 close; incomplete rollback.
  - Result: plan review count reset to zero; Phase 3 remains blocked.
- Revision:
  - Recorded the user-resolved root-form conflict and promoted it into the planned highest-contract update.
  - Replaced runtime Feishu business dispatch with an R1-owned Model 3200 Tier 2 actor.
  - Removed the standalone v2 parser design; runtime remains generic transport only.
  - Froze the exact Feishu v2 extension schema and endpoint discriminator.
  - Added local auth/no-remote acceptance, actor attestations, test ModelTable driver, deterministic rollback, staged SSOT/commit/review/F-01 close, and exact F-04-F-08 non-regression.
- Review round 2:
  - SSOT/authority reviewer: `Approved`.
  - Parser reviewer: `Change Requested` because the wording could remove generic v2 response materialization and the proposed E2E fixture lived under ignored `test_files/`.
  - Runtime reviewer: `Change Requested` because rollback omitted UI persistence/Synapse PVC state and `ensure` plus explicit deploy could deploy twice.
  - Result: review count reset to zero.
- Revision 2:
  - Explicitly retained generic table-qualified v2 response materialization and added 0450 to the Tier 1 gate.
  - Moved the deterministic E2E app fixture to committed `scripts/fixtures/0457/` and added a clean-checkout fixture guard.
  - Added consistent UI persistence/Synapse database backup and restore plus successful test-app cleanup.
  - Replaced the double-deploy sequence with one explicit `ensure_runtime_baseline.sh --force-rebuild` deployment entry.
- Review round 3:
  - Parser/schema reviewer: `Approved`; no findings, questions, or verification gaps.
  - Runtime/OrbStack reviewer: `Approved`; no findings or questions; implementation/live evidence remains correctly pending Phase 3.
  - SSOT/authority reviewer: `Approved`; no findings, questions, or verification gaps.
  - Consecutive approval count: 3.
- Decision: `Approved`.
- Phase 3 may begin only from the planning commit containing this Gate.

## Phase 3 Execution Records

- Phase 3 started from planning commit `ce32178` after the recorded 3/3 Approved Gate.
- Step 1 is TDD RED only: tests/helpers may change; production code, deployment configuration, actor patches, runtime behavior, and Feishu state remain unchanged until the expected RED results are recorded.

### Step 1 — Initial TDD RED

- Commands:
  - `node --check scripts/lib/ssot_de_actor_test_helpers.mjs`
  - `node --check scripts/tests/test_0457_local_orbstack_de_actor_contract.mjs`
  - `node scripts/tests/test_0457_local_orbstack_de_actor_contract.mjs`
  - `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
  - `node scripts/tests/test_0364_system_refill_contract.mjs`
  - `git diff --check`
- Key output:
  - Syntax checks: PASS.
  - Local baseline contract: expected RED with seven missing contract groups covering OrbStack context, local Synapse/Mosquitto, local auth, TLS, actor declarations, and the single force-rebuild path.
  - DE actor contract: expected RED, `2 passed / 4 failed`; missing worker-root `model.v1n`, MBR bus-boundary violations, R1 direct-positive ingress risk, and missing patch-derived attestations.
  - System refill contract: expected RED, `6 passed / 4 failed`; authority docs and loaded actor roots still disagree, and MBR lacks management ingress.
  - `git diff --check`: PASS.
- Result: expected RED observed; no production file changed.

### Step 1 RED Review Round 1

- Gate: `Change Requested`.
- Findings:
  - Source-token checks could pass without executable checker behavior.
  - Actor helper concatenated patch JSON instead of deriving final state from an applied `ModelTableRuntime`.
  - MBR checks did not prove Matrix → Model 0 management ingress and MQTT → Model 0 control ingress, or prohibit runner bypass to Model `-10`.
  - Attestation checks could pass from comments/dead text instead of actual post-load output.
  - Exact alias/topic-base and the positive Feishu external-read boundary were not locked.
  - The force-rebuild test overfit one shell spelling.
- Decision: keep production implementation blocked; strengthen Step 1 tests and repeat RED review.

### Step 1 — Strengthened Behavior RED

- Changes to test evidence:
  - The local baseline test now executes the real checker against fake `kubectl`, `docker`, and `orb` live-state fixtures instead of accepting source tokens as proof.
  - Local Matrix/MQTT/auth/actor fixtures and an explicit `https://open.feishu.cn` read-only fixture are positive cases; wrong Kubernetes/Docker contexts and remote Matrix/MQTT/OIDC are negative cases.
  - The force-rebuild test executes `ensure_runtime_baseline.sh` in a bounded sandbox and records deploy/check call order and count.
  - The actor helper now applies system and role patches through `ModelTableRuntime`, rejects any failed record, and derives actor facts from final loaded state with source provenance.
  - MBR runner checks use parsed JavaScript structure to require Matrix → Model 0 management ingress and MQTT → Model 0 control ingress while prohibiting direct Model `-10` writes/direct business-function calls.
  - R1 checks require a Model `-10` route-table dispatcher chain and prove malformed MQTT input cannot write an error label into a positive model.
  - Attestation checks require a pure loaded-state builder plus a five-second-bounded runner output probe; comments or dead strings cannot satisfy the contract.
- Commands:
  - `node --check scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
  - `node --check scripts/lib/ssot_de_actor_test_helpers.mjs`
  - `node --check scripts/tests/test_0457_local_orbstack_de_actor_contract.mjs`
  - `node --check scripts/tests/test_0364_system_refill_contract.mjs`
  - `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
  - `node scripts/tests/test_0457_local_orbstack_de_actor_contract.mjs`
  - `node scripts/tests/test_0364_system_refill_contract.mjs`
  - `git diff --check`
- Key output:
  - All syntax checks and `git diff --check`: PASS.
  - Local baseline: expected RED with nine failures. The complete local fixture and Feishu read-only fixture pass; both wrong contexts, remote Matrix/MQTT/OIDC, old local defaults/TLS, and missing force-rebuild behavior fail.
  - Actor contract: expected RED, `1 passed / 9 failed`, all tied to missing target behavior; the malformed R1 request currently writes `mqtt_inbound_error` into Model 100, proving the direct-positive mutation bug.
  - System refill: expected RED, `7 passed / 3 failed`; only the documented/declared/loaded worker-root `model.v1n` contracts remain missing.
- Result: expected strengthened RED observed; production implementation remains unchanged pending review approval.

### Step 1 RED Review Round 2

- Gate: `Change Requested`.
- Blocking findings:
  - R1 tests did not yet prove dispatcher output travels through declared PIN connections to positive models or prohibit cross-model host writes.
  - MBR runner checks did not yet prove adapters pass the inner record array rather than the outer packet, and direct function execution could be disguised.
  - The malformed R1 case checked only one known error key instead of proving every positive-model snapshot stays unchanged.
  - R1 boundary discovery selected the first `pin.in` and over-constrained route-table storage.
- Decision: production implementation remains blocked; close these false-green and false-red paths and repeat review.

### Step 1 — Round 2 Remediation

- MBR AST checks now require Matrix `event.payload` and parsed MQTT `packet.payload` to be the values written to their Model 0 bus inputs; any callback-level direct function execution or Model `-10` mutation fails.
- R1 boundary selection now follows the actual Model 0 ingress route instead of choosing the first `pin.in`.
- R1 dispatcher checks allow either root-direct or internal-cell declared wiring, prohibit cross-model host APIs, and require declared PIN output.
- A behavior probe now loads a fresh real R1 actor for every subscribed/mounted endpoint and requires delivery through the corresponding parent connection Cell into the positive-model input PIN.
- Malformed R1 MQTT input now compares the complete before/after snapshot of every positive model.
- Verification:
  - Actor syntax and helper syntax: PASS.
  - Actor contract: expected RED, `1 passed / 10 failed`; the additional failure is the intentionally missing subscribed-endpoint PIN chain.
  - `git diff --check`: PASS.
- Result: production implementation remains unchanged pending RED review round 3.

### Step 1 RED Review Round 3

- Gate: `Approved`.
- Findings: none.
- Open questions: none.
- Verification gaps: none.
- Decision: Step 1 behavior RED may be committed; production GREEN may begin from that commit.

### Step 2A — Worker Root Authority and Local OrbStack Baseline GREEN

- Implementation:
  - Clarified the highest contract so software-worker host Model 0 roots use `model.v1n`, while ordinary/non-worker ModelTable roots continue to use `model.table`.
  - Changed the local deployment contract to require exact Kubernetes and Docker context `orbstack`, namespace `dongyu`, local Synapse and Mosquitto services, `DY_AUTH=0`, no fake login, no remote OIDC, and no TLS-verification bypass.
  - Kept Feishu HTTPS access outside the remote-service deny checks; local test infrastructure is local, but Feishu remains connectable.
  - Changed `ensure_runtime_baseline.sh --force-rebuild` to execute exactly one image-enabled local deployment followed by the canonical checker.
  - Added executable fake-`kubectl`/`docker`/`orb` behavior coverage and shared local/cloud Secret-writer coverage.
- Initial independent review: `Change Requested`.
  - Local `DY_OIDC_SCOPE=` was expanded to the remote default by `${DY_OIDC_SCOPE:-...}`, causing the generated local Secret to violate its own checker.
  - The `CLAUDE.md` Tier 1 model-form enumeration still omitted `model.v1n`.
- TDD remediation:
  - Added a real `update_k8s_secrets` harness that first reproduced the local non-empty scope failure.
  - Changed the shared writer to preserve an explicitly empty local scope while retaining explicit cloud values and the default only when the variable is unset.
  - Added `model.v1n` to the Tier 1 model-form enumeration.
- Commands:
  - `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
  - `node scripts/tests/test_0403_deploy_sso_env_contract.mjs`
  - `node scripts/tests/test_0364_system_refill_contract.mjs`
  - `bash -n scripts/ops/_deploy_common.sh scripts/ops/check_runtime_baseline.sh scripts/ops/deploy_local.sh scripts/ops/ensure_runtime_baseline.sh`
  - `node scripts/ops/validate_obsidian_docs_gate.mjs`
  - `git diff --check`
- Key output:
  - Local baseline behavior contract: PASS.
  - Local empty OIDC values, explicit cloud OIDC values, and unset default semantics: PASS.
  - System refill/root-form contract: `10 passed / 0 failed`.
  - Shell syntax, docs gate, and diff check: PASS.
- Final independent review: `Approved`; no findings, questions, or verification gaps.
- Result: PASS for the versioned baseline contract. Live OrbStack deployment/acceptance remains pending the later rollback-backed E2E stage.

## Docs Review Checklist

- [x] `CLAUDE.md` runtime baseline reviewed/updated
- [x] `docs/architecture_mantanet_and_workers.md` reviewed
- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` updated
- [ ] `docs/ssot/label_type_registry.md` reviewed
- [ ] `docs/ssot/tier_boundary_and_conformance_testing.md` reviewed
- [ ] `docs/ssot/temporary_modeltable_payload_v1.md` updated
- [ ] `docs/ssot/feishu_model_label_alignment_v1.md` updated
- [ ] `docs/ssot/feishu_alignment_decisions_v0.md` updated after acceptance
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] contract manifest/backlog/summary updated after acceptance
