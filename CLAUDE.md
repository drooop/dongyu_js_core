DOC_PRIORITY  high → low

1  CLAUDE.md
2  docs/architecture_mantanet_and_workers.md          (system SSOT)
3  docs/ssot/runtime_semantics_modeltable_driven.md   (runtime semantics)
4  docs/ssot/label_type_registry.md                   (label type reference)
5  docs/charters/*.md                                 (project charters)
6  docs/WORKFLOW.md                                   (iteration workflow)
7  docs/ITERATIONS.md                                 (iteration registry)
8  docs/ssot/execution_governance_ultrawork_doit.md   (governance)
9  docs/ssot/*.md  docs/roadmaps/*.md  docs/user-guide/*.md

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
- hidden platform/policy/helper capabilities default to negative model_id system models.
- do not place non-user-facing helper workers into positive models just to avoid tier1 work.
- every implementation and verification MUST explicitly check:
    tier placement, model placement, data ownership, data flow, and data chain.
- fail fast on non-conformance: if an implementation bypasses a required spec path
    (tier boundary, model placement, data flow, connection layer) and still "works",
    it is NOT acceptable. stop immediately and report the violation.
    a working but non-conformant implementation has zero delivery value.
- conclusions based on repo facts: code, scripts, git history, docs.
- commands must be reproducible with explicit cwd.
- verification = deterministic PASS/FAIL. "looks ok" is not verification.
- key decisions persist to iteration docs or SSOT. chat-only = lost.
- living docs review mandatory on changes to:
    PIN declarations, PIN routing, pin.connect.* wiring,
    reserved model_ids/cells, model_type registry,
    flow.* contract, data model pin interface.
    target: docs/ssot/runtime_semantics_modeltable_driven.md
            docs/ssot/label_type_registry.md
            docs/user-guide/modeltable_user_guide.md
            docs/handover/dam-worker-guide.md


MODEL_FORMS

three model forms. all three are Tier 1 definitions.
cell model semantics are authoritative. every materialized Cell has exactly one effective model label.
for sparse/unmaterialized ordinary Cells inside a table/matrix scope, effective model label defaults to model.single.

  model.single   single Cell. programs operate on own Cell only.
                  add_label(k,t,v) — no p,r,c params.
                  structural sandbox: code in simple model cannot reach other Cells.
                  hard rule: one Cell = one type. a Cell CANNOT hold both Code.Python and Code.JS.

  model.matrix   matrix root Cell. the matrix's relative (0,0,0) MUST be explicitly labeled model.matrix.
                  other ordinary Cells inside the matrix default effectively to model.single unless explicitly overridden.
                  matrix absolute origin may differ from global (0,0,0); spec must define relative→absolute mapping.

  model.table    table root Cell. the model root (0,0,0) MUST be explicitly labeled model.table.
                  other ordinary Cells inside the table default effectively to model.single unless explicitly overridden.

  model.submt    child-model hosting Cell. value = child model id.
                  this Cell is the mounting/mapping point for a child model.
                  only pin.* and pin.log.* labels may coexist on a model.submt Cell.
                  model.submt is single-parent only: one child model may be mounted by only one parent hosting Cell at a time.

  model_type label encodes two dimensions:
    label.t = form (model.single | model.matrix | model.table | model.submt)
    label.v = type (Code.JS | Data.Array | Flow | Doc.Markdown | ...) for model.single/model.matrix/model.table
              child model id for model.submt
    invalid form×type combinations MUST be rejected at registration.


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
- external MQTT writing to arbitrary cells (must go through pin.bus.in on Model 0)
- using legacy connection types: label_connection, trigger_funcs, function_PIN_IN/OUT (use CELL_CONNECT)
- using DEPRECATED / historical label types in new models
- adding or preserving compatibility code/compatibility aliases without explicit user approval
- silent failure (all failures must write to ModelTable)
- graceful degradation that bypasses a required spec path
  (for example falling back to legacy code when the conformant path should be used,
  or swallowing a tier-boundary violation to keep the UI functional).
  if the conformant path fails, the failure must be visible, not hidden behind a fallback.
- implicit assumptions without declaring them
- debug artifacts / temp scripts / screenshots / media files in repo root
  (screenshots → output/playwright/, other artifacts → test_files/ or archive/)
- test data in docs/ (use test_files/ or scripts/fixtures/)
- logs/*.log committed (must be gitignored)
- Playwright MCP output in repo root (env PLAYWRIGHT_MCP_OUTPUT_DIR=output/playwright enforced via ~/.claude/settings.json)


WORKFLOW

branch: dev_<id> → dev → main (release/milestone only)
branch enforcement: all code changes MUST start on dev_<id>-<desc> branch.
  direct commits to dev forbidden except merge commits.
  dev_<id> naming: <id> = iteration number, <desc> = short kebab-case description.
  example: dev_0145-local-k8s-deploy
single-developer mode (authoritative):
  this repo is operated as a single-developer project.
  default completion path = verify locally on dev_<id>-<desc> → merge locally into dev → push dev.
  GitHub pull requests are NOT required for routine iteration completion and MUST NOT be created unless the user explicitly asks.
  pushing the iteration branch is optional; the required integration record is the merge commit on dev.

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


RESPONSE_EFFORT_GUIDANCE

- every assistant reply MUST include one explicit effort suggestion:
    `effort_suggestion: medium|high|xhigh — <short reason>`
- applies to both intermediary updates and final answers.
- default = `medium` when the task is scoped, local, and low-ambiguity.
- use `high` when the task has notable ambiguity, cross-file / cross-system coupling,
  historical recovery, or elevated verification burden.
- use `xhigh` only for unusually broad, architecture-shaping, or high-blast-radius work.
- the suggestion is guidance for how much reasoning / care to spend next,
  not a claim that the task is inherently difficult.


DROPMODE_PROTOCOL

- `dropmode` = session migration protocol for upgrade/downgrade handoff. this is developer workflow only.
- when the `$dropmode` skill is triggered, run this protocol.
- maintain session-local state:
    `dropmode_enabled = true|false`
    `dropmode_pending = none|upgrade|downgrade`
    `dropmode_session_mode = unknown|regular|large`
- repo default may set `dropmode_enabled=true`; if repo-local rules say so, follow them.
- infer `dropmode_session_mode` using best-effort evidence in this order:
    1. current-session `/status` output, when available to the assistant
    2. codex config/profile hints (for example context-window or large-profile settings)
    3. prior migration packet / compact_handoff `Session Mode`
    4. explicit user statement such as `1M`, `large`, `大窗`, `常规`, `非1M`
- treat config/profile evidence as heuristic, not proof.
- toggle behavior:
    flip `dropmode_enabled`
    clear `dropmode_pending`
    reply with exactly one line and nothing else:
      `dropmode 已开启：后续回复将执行升级/降级迁移判断。`
      or
      `dropmode 已关闭：后续回复不再主动给出升级/降级迁移建议。`
- exception to RESPONSE_EFFORT_GUIDANCE:
    the exact toggle acknowledgement above MUST NOT append `effort_suggestion`
    and MUST NOT append migration prompts or any extra explanation.
- when `dropmode_enabled=true`, silently evaluate only the final answer:
    first refresh `dropmode_session_mode` from available evidence
    if `dropmode_session_mode=large` and the task does not justify large context, append the downgrade line and set `dropmode_pending=downgrade`
    if `dropmode_session_mode=regular` or `dropmode_session_mode=unknown` and the task does justify large context, append the upgrade line and set `dropmode_pending=upgrade`
- do NOT run upgrade/downgrade suggestion logic in intermediary updates, commentary, progress notes, or other non-final output.
    upgrade line:
      `本方案建议升级到 1M 新会话后继续。若确认升级，请明确回复：升级后继续。`
    downgrade line:
      `接下来的任务建议降级并在新会话继续。若确认降级，请明确回复：降级后继续。`
- confirmation behavior:
    if user message is exactly `升级后继续` and `dropmode_pending=upgrade`,
    output the migration packet (`compact_handoff`, new-session launch, first prompt template)
    with target session mode = `large`
    and then clear `dropmode_pending`.
    if user message is exactly `降级后继续` and `dropmode_pending=downgrade`,
    output the same migration packet for downgrade with target session mode = `regular`
    and then clear `dropmode_pending`.
- if there is no matching pending migration, DO NOT fabricate a migration packet.
- never claim live hot-switch of the current session's real context window.


ARCH_INVARIANTS

- model-driven: ModelTable = SSOT, code = runtime + extension
- app-as-OS: IA organized by apps/workstations, not single function
- three model forms: simple (sandbox) / matrix (spatial, deferred) / table (dynamic)
- PIN decoupling: 3-layer pin architecture (label/cell/model), type-based differentiation
- bus decoupling: management bus (user-facing) + control bus (execution) + MBR bridge
- workspace isolation: data separated, comms encrypted, trust revocable
- capability detection: worker base must degrade gracefully, never crash silently
- application-layer = positive model_id user-created models; system-level = negative model_id software-worker capability layers.
- Model 0 = system root / intermediate layer. system boundary ports live here.
- every model except Model 0 MUST be explicitly mounted into the hierarchy via model.submt, including bootstrap children such as -1 and 1.
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
  - model form enforcement: model.single / model.matrix / model.table constraints
  - label type interpretation: _applyBuiltins dispatches on label.t
    recognized types:
      pin.in, pin.out, pin.model.in, pin.model.out, pin.bus.in, pin.bus.out,
      pin.log.in, pin.log.out, pin.log.model.in, pin.log.model.out, pin.log.bus.in, pin.log.bus.out,
      pin.connect.label, pin.connect.cell, pin.connect.model, model.submt, func.js, func.python
  - MQTT loop: startMqttLoop, mqttIncoming, topic routing
  - AsyncFunction executor: _executeFuncViaCellConnect (30s timeout, sandboxed ctx)
  - graph management: pinConnectLabelGraph, pinConnectCellRoutes, busInPorts, busOutPorts
  - observability: eventLog, mqttTrace, intercepts
  files: packages/worker-base/src/runtime.js, runtime.mjs

tier 2: model definitions (填表能力)
  = capabilities built by "filling tables" — writing JSON patches that create models,
    add labels, declare routing, and define functions.
  what it provides:
  - all business logic (via func.js / func.python labels)
  - all routing topology (via pin.connect.* labels)
  - all system infrastructure functions (via system model labels)
  - data model subtypes (Data.Array, Data.Queue, Data.Stack, etc.) as JSON patch templates
  - flow model (flow.* labels + flow manager function) as JSON patch templates
  - MBR routing rules (via mbr_route_* labels)
  - MGMT send/receive (via function labels)
  - intent dispatch (via function labels)
  files: packages/worker-base/system-models/*.json, deploy/sys-v1ns/**/*.json

placement rule:
  - tier 2 capabilities may live in positive or negative models.
  - if a capability is not meant to be directly user-visible or user-owned,
    it MUST default to negative model_id system models.
  - negative models are still system capability layers even when they carry built-in system applications.
  - as negative model_id absolute value grows, placement may move upward toward built-in system applications, but remains system-layer placement.

rule: if a capability can be expressed as a model definition, it MUST be.
      runtime code changes are only for adding new label.t interpretation or
      fixing interpreter bugs. never for business logic.

conformance review:
  - every feature/test review MUST consult docs/ssot/tier_boundary_and_conformance_testing.md
    and record whether the feature respects:
      1. tier 1 vs tier 2 boundary
      2. negative vs positive model placement
      3. data ownership
      4. data flow direction
      5. allowed data chain / routing path

examples:
  - Data.Array behavior → tier 2 (func.js template on data model)
  - flow step scheduling → tier 2 (flow manager function)
  - MBR routing logic → tier 2 (function label on Model -10)
  - MQTT topic parsing → tier 1 (interpreter logic)
  - new label type "pin.stream.in" → tier 1 (needs _applyBuiltins change)
  - model form enforcement → tier 1 (needs runtime constraint checks)


MODEL_ID_REGISTRY

allocation rules (authoritative):

  Model 0        system root / intermediate layer. pin.bus.in/out and root-side routing live here.
                 the only model with system boundary ports. never holds user business logic.
                 Model 0 (0,0,0) MUST explicitly carry model.table.

  Model -1       system capability layer: UI event mailbox. Cell(0,0,1) receives ui_event envelopes.

  Model -3       system capability layer: login ui model. auth login form state/schema projection.
                  reserved for login flow; do not reuse for cognition/system routing.

  Model -10      system capability layer: infrastructure logic expressed as function labels:
                  mgmt_send, mgmt_receive, intent_dispatch, mbr_route_*, mqtt config helpers.
                  all MBR/MGMT/intent capabilities live here as "filled table" entries.

  Model -12      system capability layer: cognition context model. scene_context and feedback-loop state carrier
                  (0153: perception→cognition→decision→action→feedback).

  Model -21      system capability layer: Prompt page asset model.
                 reserved for Prompt FillTable ui_ast_v0 page asset.

  Model -101     system capability layer: Gallery mailbox model.
                 reserved for local/remote Gallery ui_event inbox only.

  Model -102     system capability layer: Gallery state model.
                 reserved for Gallery demo state and fragment data; do not reuse for unrelated system UI.

  Model -103     system capability layer: Gallery catalog model.
                 reserved for Workspace-visible Gallery entry and its ui_ast_v0 page asset.

  Model -11..-99 reserved for future system capability layers (monitoring, auth, workspace mgmt),
                  except allocated ids above.
                  do not allocate without iteration.

  Model -100..-199 reserved for system-visible UI catalogs, demo entries, and their companion mailbox/state models,
                  except allocated ids above.
                  allocate only via iteration and register each concrete id in this section.

  Model >0       user-created model space.
                 do not infer framework/platform vs business solely from positive-id numeric ranges.
                 if future governance wants positive-id subranges, it MUST be documented as an explicit allocation policy,
                 not inferred from stale historical ranges.

violation: using an unregistered model_id range → must register in this section first.

cell position conventions:
  (0,0,0)  root cell. routing declarations, config labels, pin boundary ports.
  (1,0,0)  processing cell (typical). pin.connect.label wiring, function execution.
  (0,0,1)  reserved: legacy PIN registry (DEPRECATED). UI mailbox (Model -1 only).
  (0,1,1)  reserved: legacy PIN mailbox (DEPRECATED). do not use.


PIN_SYSTEM

3-layer PIN architecture. type-based differentiation (NOT position-based).

data channel:
  pin.in            Cell level input port
  pin.out           Cell level output port
  pin.model.in      Model boundary input port (only on (0,0,0), model_id != 0)
  pin.model.out     Model boundary output port (only on (0,0,0), model_id != 0)
  pin.bus.in        System boundary input port (only on Model 0 (0,0,0))
  pin.bus.out       System boundary output port (only on Model 0 (0,0,0))

log channel (identical routing behavior, type-isolated from data channel):
  pin.log.in            Cell level log input
  pin.log.out           Cell level log output
  pin.log.model.in      Model boundary log input (only on (0,0,0), model_id != 0)
  pin.log.model.out     Model boundary log output (only on (0,0,0), model_id != 0)
  pin.log.bus.in        System boundary log input (only on Model 0 (0,0,0))
  pin.log.bus.out       System boundary log output (only on Model 0 (0,0,0))

connection declarations:
  pin.connect.label     Cell intra-wiring (endpoint = pin name string)
  pin.connect.cell      Model intra-routing (endpoint = [p,r,c,pinName])
  pin.connect.model     Inter-model routing (endpoint = [model_id,pinName])

rules:
  - pin.in only connects to pin.out. pin.log.in only connects to pin.log.out. no cross-channel.
  - pin.model.* and pin.bus.* MUST be on (0,0,0) of their respective model.
  - pin.model.* does not handle model_id=0. model_id=0 external entry is pin.bus.* only.
  - sub-model external connections only through (0,0,0) boundary ports.
  - log pins have NO special runtime behavior. no wiring = log discarded.
  - each function has 3 pins: func:in / func:out / func:log.out.

historical aliases (non-normative):
  old docs/tests/code may still mention BUS_IN / BUS_OUT / cell_connection / CELL_CONNECT / MODEL_IN / MODEL_OUT.
  they are migration debt, not approved surface area for new work.


FUNCTION_LABELS

  type: func.js | func.python
  value: {"code": "async (ctx) => { ... }", "modelName": "optional_scope_name"}
  value MUST use structured object in new models.
  compatibility retention is forbidden unless the user explicitly approves it.
  each function has 3 pins: func:in, func:out, func:log.out.

  func.js: compiled to AsyncFunction, executed in sandboxed ctx.
  func.python: forwarded to Python worker. JS runtime writes error label if worker unavailable.


MODEL_TYPE_REGISTRY

  form (label.t): model.single | model.matrix | model.table
  type (label.v): {Category}.{SubType} or {Category}

  registered types (initial set):
    Code.JS
    Code.Python
    Data
    Data.Array
    Data.Queue
    Data.Stack
    Data.CircularBuffer
    Data.LinkedList
    Data.FlowTicket
    Flow
    UI.*
    Doc.Markdown
    Doc.StaticWeb

  violation: using unregistered model type → must register here first.


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
- use Obsidian Markdown format: wikilinks like [[docs/WORKFLOW]], frontmatter YAML, callouts.
- when writing to docs-shared/ (shared knowledge), include frontmatter: source (ai|human), status (draft|reviewed|stable), project (origin project name).
- AI-authored shared knowledge defaults to status: draft.
- when unsure about classification (which folder, which subfolder), ask the user.
- conventions for vault structure are evolving. check ~/.claude/projects/-Users-drop-codebase-cowork/memory/vault-conventions.md for current conventions.
