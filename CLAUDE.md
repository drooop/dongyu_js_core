DOC_PRIORITY  high → low

1  CLAUDE.md
2  docs/architecture_mantanet_and_workers.md          (system SSOT)
3  docs/ssot/runtime_semantics_modeltable_driven.md   (runtime semantics)
4  docs/charters/*.md                                 (project charters)
5  docs/WORKFLOW.md                                   (iteration workflow)
6  docs/ITERATIONS.md                                 (iteration registry)
7  docs/ssot/execution_governance_ultrawork_doit.md   (governance)
8  docs/ssot/*.md  docs/roadmaps/*.md  docs/user-guide/*.md

lower doc MUST NOT override higher doc.


HARD_RULES

- plan before execute. no plan → no code change.
- phase1 = documents only. no code, no deps, no tests.
- phase3 = Approved gate required. no Approved → no execution.
- iteration must exist in docs/ITERATIONS.md before any work starts.
- all side effects via add_label / rm_label only. no bypass.
- UI is projection of ModelTable. never truth source.
- UI events write mailbox only (model_id=-1, cell 0,0,1).
- init and runtime use identical interpretation rules.
- conclusions based on repo facts: code, scripts, git history, docs.
- commands must be reproducible with explicit cwd.
- verification = deterministic PASS/FAIL. "looks ok" is not verification.
- key decisions persist to iteration docs or SSOT. chat-only = lost.
- living docs review mandatory on changes to:
    mailbox contract, PIN topic/payload, MGMT patch/routing, reserved model_ids/cells,
    BUS_IN/OUT declarations, cell_connection routing, CELL_CONNECT wiring, MODEL_IN/OUT boundaries.
    target: docs/ssot/runtime_semantics_modeltable_driven.md
            docs/user-guide/modeltable_user_guide.md
            docs/handover/dam-worker-guide.md


REMOTE_OPS_SAFETY

target server: 124.71.43.80 (dy-cloud), cluster type: rke2 (NOT k3s).

absolute prohibitions (no exception, no user override):
- NEVER start/stop/restart k3s. k3s conflicts with rke2 on port 10010 and will crash the cluster.
- NEVER run systemctl start/stop/restart/enable/disable on: rke2, k3s, containerd, docker, sshd, networking.
- NEVER modify files under /etc/rancher/ (k3s/ or rke2/).
- NEVER run iptables/nftables flush, restore, bulk deletion, or piped iptables-save modifications.
- NEVER modify CNI configs (/etc/cni/net.d/).
- NEVER modify firewall rules (ufw, firewalld, nftables chain policy).
- NEVER modify network interfaces (ip link, ip route, bridge).

allowed cluster operations:
- kubectl apply/delete/get/describe/logs/exec/port-forward ONLY.
- helm install/upgrade/uninstall (creates/modifies k8s resources via kubectl).
- docker build / docker save / docker load (image operations only, not daemon management).
- rsync / scp / git clone (file transfer).

critical-risk operations requiring explicit user confirmation + rollback plan:
- kubectl delete namespace (destroys all resources in namespace)
- helm uninstall (removes deployed services)
- any operation that could affect other namespaces or cluster-wide resources

procedure for critical-risk remote ops:
  1 state: what will change, what could break, estimated blast radius
  2 state: rollback plan (or "no rollback — requires console access")
  3 get explicit user confirmation
  4 verify SSH connectivity immediately after

incident record (2026-02-12):
  cause: started k3s on rke2 server → port 10010 conflict → rke2 containerd crash → cluster down.
  lesson: always identify cluster type first. never assume. never touch cluster runtime directly.

violation: executing any prohibited operation = forbidden. no exception.


FORBIDDEN

- secrets in repo (use .env / secret manager)
- code changes in phase1
- phase3 without Approved gate
- unregistered iteration work
- side effects outside add_label / rm_label
- UI direct bus connection (must go through mailbox)
- external MQTT writing to arbitrary cells (must go through BUS_IN on Model 0)
- using legacy connection types: label_connection, trigger_funcs, function_PIN_IN/OUT (use CELL_CONNECT)
- silent failure (all failures must write to ModelTable)
- implicit assumptions without declaring them
- debug artifacts / temp scripts in repo root
- test data in docs/ (use test_files/ or scripts/fixtures/)
- logs/*.log committed (must be gitignored)


WORKFLOW

branch: dev_<id> → dev → main (release/milestone only)
branch enforcement: all code changes MUST start on dev_<id>-<desc> branch.
  direct commits to dev forbidden except merge commits.
  dev_<id> naming: <id> = iteration number, <desc> = short kebab-case description.
  example: dev_0145-local-k8s-deploy

iteration dir: docs/iterations/<id>/
  plan.md        contract (WHAT/WHY). no steps. no execution records.
  resolution.md  implementation (HOW). steps, files, verify, rollback.
  runlog.md      flight recorder (FACTS). commands, output, commits, PASS/FAIL.

phase0  intake → assign <id>, create dir skeleton, register ITERATIONS.md
phase1  planning → plan.md + resolution.md. DOCS ONLY.
phase2  review gate → Approved | Change Requested | On Hold
phase3  execution → follow resolution step-by-step, evidence to runlog
phase4  completion → all steps PASS in runlog, ITERATIONS.md → Completed

exception: hotfix / security → may skip phases. must backfill iteration record.

detail: docs/WORKFLOW.md


CHANGE_OUTPUT

report per code change:
  1 problem
  2 risk
  3 proposed change
  4 file list + minimal diff
  5 verification commands
  6 rollback plan
  7 alternatives (≥2: pros / cons / cost / when)


ARCH_INVARIANTS

- model-driven: ModelTable = SSOT, code = runtime + extension
- app-as-OS: IA organized by apps/workstations, not single function
- bus decoupling: management bus (user-facing) + control bus (execution) + MBR bridge
- workspace isolation: data separated, comms encrypted, trust revocable
- capability detection: worker base must degrade gracefully, never crash silently
- application-layer = ModelTable models; system-level = negative model_id
- Model 0 = system root. all models (positive + negative) mount as children of Model 0.
- single external entry: BUS_IN/BUS_OUT on Model 0 (0,0,0) = only MQTT interface. no direct cell writes from external.
- 3-layer connection (no skip): BUS_IN/OUT (system boundary) → cell_connection (inter-cell routing) → CELL_CONNECT (intra-cell wiring)
- CELL_CONNECT = unified connection table. replaces: label_connection, trigger_funcs, function_PIN_IN/OUT.
- program model: function label, v = JS code string, compiled to AsyncFunction at init. ctx = sandboxed API.
- fill-table-first: new capabilities MUST be implemented by filling models (JSON patches) before considering runtime code changes.
- terminology: use §9 of docs/architecture_mantanet_and_workers.md
- pin isolation design: docs/plans/2026-02-11-pin-isolation-and-model-hierarchy-design.md (Design Approved)


CAPABILITY_TIERS

two tiers. clearly separated. do not mix.

tier 1: runtime base (基座运行能力)
  = the interpreter. only changes via iteration + code review.
  what it provides:
  - label type interpretation: _applyBuiltins dispatches on label.t
    recognized types: CELL_CONNECT, cell_connection, IN, BUS_IN, BUS_OUT,
    MODEL_IN, MODEL_OUT, subModel, MQTT_WILDCARD_SUB, function
  - MQTT loop: startMqttLoop, mqttIncoming, topic routing
  - AsyncFunction executor: _executeFuncViaCellConnect (30s timeout, sandboxed ctx)
  - graph management: cellConnectGraph, cellConnectionRoutes, busInPorts, busOutPorts
  - observability: eventLog, mqttTrace, intercepts
  files: packages/worker-base/src/runtime.js, runtime.mjs

tier 2: model definitions (填表能力)
  = capabilities built by "filling tables" — writing JSON patches that create models,
    add labels, declare routing, and define functions.
  what it provides:
  - all business logic (via function labels on model cells)
  - all routing topology (via cell_connection + CELL_CONNECT labels)
  - all system infrastructure functions (via system model labels)
  - MBR routing rules (via mbr_route_* labels)
  - MGMT send/receive (via function labels)
  - intent dispatch (via function labels)
  files: packages/worker-base/system-models/*.json, deploy/sys-v1ns/**/*.json

rule: if a capability can be expressed as a model definition, it MUST be.
      runtime code changes are only for adding new label.t interpretation or
      fixing interpreter bugs. never for business logic.

examples:
  - color picker behavior → tier 2 (function label on Model 100)
  - MBR routing logic → tier 2 (function label on Model -10)
  - MQTT topic parsing → tier 1 (interpreter logic)
  - new label type "STREAM_IN" → tier 1 (needs _applyBuiltins change)


MODEL_ID_REGISTRY

allocation rules (authoritative):

  Model 0        system root. BUS_IN/OUT, MQTT config, cell_connection to children.
                 the only model with external bus ports. never holds business logic.

  Model -1       UI event mailbox. Cell(0,0,1) receives ui_event envelopes.

  Model -10      system functions. infrastructure logic expressed as function labels:
                 mgmt_send, mgmt_receive, intent_dispatch, mbr_route_*, mqtt config helpers.
                 all MBR/MGMT/intent capabilities live here as "filled table" entries.

  Model -11..-99 reserved for future system services (monitoring, auth, workspace mgmt).
                 do not allocate without iteration.

  Model 1..99    reserved for framework/platform apps (settings, diagnostics, store).
                 do not allocate without iteration.

  Model 100+     application models. user-defined business models.
                 examples: color_form (100), future: task manager, data viewer, etc.

violation: using an unregistered model_id range → must register in this section first.

cell position conventions:
  (0,0,0)  root cell. routing declarations (cell_connection), config labels, BUS_IN/OUT.
  (1,0,0)  processing cell (typical). CELL_CONNECT wiring, function execution.
  (0,0,1)  reserved: legacy PIN registry (DEPRECATED). UI mailbox (Model -1 only).
  (0,1,1)  reserved: legacy PIN mailbox (DEPRECATED). do not use.


RUNTIME_BASELINE

default: Docker + K8s (not local MBR JS)

always-on:
  docker: element-docker-demo (Matrix/Element), mosquitto
  k8s (docker-desktop, default ns): deployment/mbr-worker=1, deployment/remote-worker=1

test classification:
  unit    = in-process ModelTableRuntime, no network, no Docker.
            files: scripts/tests/test_*.mjs
            pre-req: none (can run without Docker)
  e2e     = real MQTT + K8s workers + Matrix bus.
            files: scripts/test_e2e_*.mjs, scripts/validate_*.mjs
            pre-req: Docker + K8s running. MUST run pre-flight first.
  deploy  = K8s deployment verification.
            pre-req: Docker + K8s running. MUST run pre-flight first.

pre-flight (MANDATORY before e2e/deploy tests):
  bash scripts/ops/ensure_runtime_baseline.sh
  bash scripts/ops/check_runtime_baseline.sh

violation protocol:
  if pre-flight skipped for e2e/deploy → test results are INVALID.
  if pre-flight skipped for unit tests → acceptable (unit tests are self-contained).
  executor must declare test classification in runlog before running.
  "ran all tests" without declaring classification = violation.

legacy MBR: scripts/run_worker_mbr_v0.mjs → blocked unless ALLOW_LEGACY_MBR=1

mbr location record: prefer ModelTable Cell Label (model_id=-10, p=0, r=0, c=0, k=mbr_location, t=json).
  if Label not available → must explain why and get user confirmation before bypass.


DATA_SOURCES

default external: Git / GitHub only.
do not assume: Sentry, Linear, Notion, Figma (unless user confirms).
info insufficient but can proceed → state assumptions + verification method.
info insufficient and unreliable → declare gaps first, then give options.


COMMIT_CONVENTION

format: <type>: <description>
types: feat, fix, refactor, docs, test, chore, perf, ci
language: english


CONFLICT_PROTOCOL

on conflict between docs, permission boundary, or unclear stage type:
  1 stop immediately
  2 report: conflict_type | file_A vs file_B | quoted clauses | blocking reason | who decides
  3 do not self-resolve

template fields (mandatory):
  conflict_type: semantic | workflow | permission | verification
  conflict_files: A vs B
  conflict_clauses: verbatim quotes
  blocking_reason: why cannot continue
  deciding_role: User | executor | orchestrator


RESPONSE_STYLE

- lang: simplified chinese. english for proper nouns, field names, paths.
- conclusion first. short paragraphs. no nested lists.
- no: pleasantries, emotional language, marketing speak, emoji.
- max 3 clarifying questions when info is missing. each must reduce key uncertainty.


KNOWLEDGE_VAULT

docs/ is a symlink to ~/Documents/drip/Projects/dongyuapp/ (Obsidian vault).
docs-shared/ is a symlink to ~/Documents/drip/Knowledge/ (cross-project shared knowledge).

rules:
- docs/ and docs-shared/ are the real files inside the Obsidian vault. edits here appear in Obsidian immediately.
- use Obsidian Markdown format: wikilinks [[target]], frontmatter YAML, callouts.
- when writing to docs-shared/ (shared knowledge), include frontmatter: source (ai|human), status (draft|reviewed|stable), project (origin project name).
- AI-authored shared knowledge defaults to status: draft.
- when unsure about classification (which folder, which subfolder), ask the user.
- conventions for vault structure are evolving. check ~/.claude/projects/-Users-drop-codebase-cowork/memory/vault-conventions.md for current conventions.
