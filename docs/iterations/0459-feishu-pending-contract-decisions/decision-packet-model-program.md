---
title: "Iteration 0459 Model And Program Decision Packet"
doc_type: change-proposal
status: on_hold
updated: 2026-07-19
source: ai
iteration_id: 0459-feishu-pending-contract-decisions
id: 0459-feishu-pending-contract-decisions-model-program-packet
packet_id: 0459-PKT-MP-r14288-v1
packet_version: 1
decision_status: frozen_on_hold
---

# Iteration 0459 Model And Program Decision Packet

> Authority notice: this packet is a proposal, not repository SSOT, an adopted decision, implementation authorization, or Feishu-write authorization. Until an exact user choice is recorded, current repository contracts and fail-closed behavior remain authoritative.

> Freeze notice (2026-07-19): no decision in this packet was adopted. Before resuming, recheck the protected Feishu source read-only; if it changed, replace this packet with a new version based on a focused diff.

## Packet Baseline

- Packet ID: `0459-PKT-MP-r14288-v1`.
- UpstreamConsensus baseline: `feishu-model2` revision `14288`, SHA-256 `218e77f7a62961b940ad6c983cc43056eeeacc1fa2cabd7cb5d0d87464d0d252`.
- Focused refresh evidence: `source-recheck-report.md`.
- Decision order: F-14 -> F-10 -> F-11 -> F-12 -> F-13.
- Current repository truth remains authoritative until Step 4 records the exact user choice and Step 5 applies only that choice to repository decision views.

## Decision Protocol

- Each decision card is independent. A missing card is unanswered, not deferred.
- A valid answer uses the exact syntax printed on that card, for example `DEC-0459-F14@v1 = F14-O1`.
- `批准全部`, `按推荐项执行`, `同意 packet`, a bare option number, or similar bulk wording is not a valid decision.
- `DEFER` is an explicit option. It preserves current repository behavior and keeps the finding at `requires_user_confirmation`.
- If the user proposes a hybrid or changes an option's wording, the card becomes `Change Requested`; a new packet version must describe the new complete option before it can be selected.
- Exact syntax is necessary but not sufficient: the choice must also satisfy the dependency-compatibility rules below. An incompatible reply is recorded only as a rejected attempt, not as a product decision; no approximate mapping is allowed, and a new packet version must present the remaining valid choices.
- Decisions are first recorded in `runlog.md`. A later correction supersedes the earlier record; historical evidence is not deleted.

Dependency compatibility:

- `F11-O1` requires the already recorded F-14 choice to be `F14-O1` or `F14-O2`. `F11-O2`, `F11-O3`, and `F11-DEFER` do not require Flow lifecycle ownership.
- `F11-O1` and `F11-O2` also require the already recorded F-10 choice to be `F10-O1` or `F10-O2`, because both adopt a ProgramModel area contract. `F11-O3` and `F11-DEFER` are compatible with any F-10 choice.
- `F12-O1` or `F12-O2` requires the already recorded F-11 choice to be `F11-O1` or `F11-O2`. `F12-O3` and `F12-DEFER` remain valid with any F-11 choice.
- `F10-O1` or `F10-O2` may remain a dormant namespace contract when F-11 selects `F11-O3` or `F11-DEFER`; neither F-10 choice by itself activates or implements an area API.

## DEC-0459-F14@v1 — Independent Runtime Ownership

### Question

How should the statement “only Flow models can run independently” constrain Code, Data, UI, and Doc models?

### Evidence And Current Truth

- Model2 revision `14288`, heading `6 按功能划分的模型类型`, places Code, Data, UI, and Doc under `必须被放在流程模型中才能运行`; Flow is outside that restriction.
- The source does not define whether this is a structural-hosting rule or a lifecycle-ownership rule. It also does not define ancestry proof, infrastructure exceptions, migration, or failure behavior.
- Current repository contracts derive structural behavior from registered `model.*` labels and do not require a Flow ancestor. Model 0, negative system models, and injected table-root programs already execute infrastructure behavior without such a check.
- Where a category is used below, its grammar is case-sensitive: value is exactly `Flow`, `Code`, `Data`, `UI`, or `Doc`, or begins with that exact token plus `.`. For example, `Flow.Child` is Flow; `FlowLegacy`, `flow`, and an empty value are not.
- F-14 must be decided before F-11 and F-12 because lifecycle and scheduling ownership depend on it.

### F14-O1 — Flow Owns Business Lifecycle (Recommended)

- Canonical shape: keep `model_type` as the structural key. Derive functional category only with the exact-token-or-`Category.` grammar above; do not add another category label. The nearest ancestor whose category is `Flow` owns start, stop, scheduling, and business activation for descendant Code/Data/UI/Doc models. Structural creation, addressing, inspection, editing, and data storage do not themselves count as independent execution.
- Scope and exceptions: the rule applies to user/business models. Model 0 transport/bootstrap infrastructure, negative system models, connection models, and repository-mandated table-root infrastructure programs remain outside the business-lifecycle rule. A Flow model may itself be hosted structurally inside another model while still owning the lifecycle of its business descendants.
- Migration: no implicit wrapper, alias, or automatic reparenting. Existing business execution without a Flow owner remains readable/editable but must be inventoried and moved under an explicit Flow owner before enforcement is enabled. Enforcement ships only in a follow-on migration iteration.
- Tier and owner: Tier 1 validates declared structural category and exposes ancestry; a Tier 2 Flow manager owns business lifecycle policy and activation. Generic runtime does not invent business ancestry or silently create Flow models.
- Failure and default: a new or migrated Code/Data/UI/Doc business model with no unique Flow owner cannot be activated or scheduled. It remains inspectable and must receive a stable visible error. Unknown category, ambiguous ancestry, or missing owner fails closed. Infrastructure exceptions must be explicit registry entries, not name-based guesses.
- Dependencies: F-11 must bind ProgramModel lifecycle to the Flow owner; F-12 periodic scheduling must be owned by that lifecycle. A follow-on inventory/migration iteration is mandatory before enforcement.
- Verification: deterministic positive tests for one nearest Flow owner; negative tests for missing/ambiguous owners; explicit tests for Model 0, negative system models, connection models, and table-root infrastructure exceptions; local OrbStack E2E for start/stop/schedule through SSOT-conformant DE roles.
- Tradeoff: preserves the source's lifecycle intent without breaking structural data/UI composition or existing system infrastructure, but requires a deliberate ownership inventory and migration.

### F14-O2 — Literal Structural Hard Cut

- Canonical shape: keep `model_type`, derive the same five categories with the exact grammar above, and require every Code/Data/UI/Doc model to have a Flow ancestor before it may be created, loaded, rendered, addressed by an executable pin, or execute any function. Flow is the only category allowed at an independently runnable root.
- Scope and exceptions: no implicit infrastructure exception. Existing Model 0/root/negative behavior that uses a Code/Data/UI/Doc functional category must either be reclassified as Flow/system-only or wrapped under Flow before enforcement.
- Migration: hard cut after an explicit repository-wide rewrite. No dual behavior or fallback. All stored models, patches, fixtures, bootstrap assets, and local role deployments must be migrated together.
- Tier and owner: Tier 1 structure validation enforces Flow ancestry at create/load time; Tier 2 Flow managers own all later execution.
- Failure and default: missing, unknown, or ambiguous Flow ancestry rejects model creation/load before any partial state is written. Existing unmigrated inventory cannot run.
- Dependencies: blocks F-11/F-12 and all model loading until a full inventory, schema migration, and rollback snapshot exist.
- Verification: full corpus migration check; create/load/render/function negative tests without Flow; positive tests under Flow; clean-room local OrbStack rebuild of all SSOT-conformant roles; byte-stable rollback export.
- Tradeoff: closest literal enforcement of the source wording, but it is a broad breaking change and may force system infrastructure into an artificial Flow hierarchy.

### F14-O3 — Descriptive Classification Only

- Canonical shape: keep `model_type` and treat Flow/Code/Data/UI/Doc values as descriptive metadata. No ancestry or independent-run capability is inferred from the category.
- Migration: none. Existing models and runtime behavior remain unchanged.
- Tier and owner: the label registry validates only known structural label types; product models decide their own lifecycle in Tier 2.
- Failure and default: no new category-based failure. Existing runtime, PIN, and permission failures remain authoritative; unknown functional values remain subject to current registry behavior.
- Dependencies: F-11 and F-12 must define their own lifecycle/scheduling ownership without relying on Flow ancestry. F-14 can then be closed as non-normative alignment.
- Verification: tests prove no Flow-ancestor check is introduced and current model fixtures remain byte/behavior compatible; alignment tests record the source statement as intentionally non-normative.
- Tradeoff: lowest migration risk, but does not enforce the newly strengthened UpstreamConsensus rule and leaves lifecycle composition to each model.

### F14-DEFER — Keep The Finding Open

- Canonical shape: current repository `model_type` and structural rules remain the only executable truth; no Flow capability matrix is adopted.
- Migration: none.
- Tier and owner: unchanged current owners.
- Failure and default: unchanged current failures; no new ancestry inference. The watcher continues to stop on F-14.
- Dependencies: F-11 and F-12 cannot rely on a decided Flow lifecycle contract and may also need deferral or explicitly independent ownership.
- Verification: backlog, coverage, and watcher keep F-14 as `requires_user_confirmation / high`; no executable or SSOT behavior changes.
- Tradeoff: avoids premature adoption but preserves the core product ambiguity.

Recommendation: choose `F14-O1`. It treats Flow as the owner of business lifecycle while keeping structural models and explicit system infrastructure usable.

Valid reply: `DEC-0459-F14@v1 = F14-O1`, `DEC-0459-F14@v1 = F14-O2`, `DEC-0459-F14@v1 = F14-O3`, or `DEC-0459-F14@v1 = F14-DEFER`.

## DEC-0459-F10@v1 — Program Key Namespaces

### Question

Should `sys_`, `in_`, `out_`, `log_`, `user_`, `persis_`, and `status_`, plus `sys_model_type` / `sys_model_size`, replace current keys, apply only inside a ProgramModel contract, or remain descriptive?

### Evidence And Current Truth

- Model2 revision `14288` uses the seven prefixes for ProgramModel areas and examples use `sys_model_type` / `sys_model_size`.
- Current repository contracts use the registered structural key `model_type`. `model_size:model.matrix.size` appears in legacy probes/examples but is not registered or executable current truth. The repository does not reserve the seven prefixes globally and does not adopt `sys_model_type` / `sys_model_size`.
- The source does not define compatibility with existing pins, functions, protocol metadata, or non-ProgramModel labels.
- The selected F-10 policy must be compatible with F-11's area model.

### F10-O1 — Scoped ProgramModel Namespaces (Recommended)

- Canonical shape: `model_type` remains the sole structural declaration key. This option also freezes the future matrix-size declaration as `model_size:model.matrix.size` at a `model.matrix` root `(0,0,0)`, with value exactly `{min_p:int,min_r:int,min_c:int,max_p:int,max_r:int,max_c:int}` and each minimum less than or equal to its maximum; it is not executable until a follow-on registry/runtime iteration. `sys_model_type` and `sys_model_size` are rejected, not aliases. Inside a declared ProgramModel area contract only, materialized area keys must use their matching nonempty prefix: `sys_`, `in_`, `out_`, `log_`, `user_`, `persis_`, or `status_`. Protocol metadata, ordinary model labels, pin names, and function keys outside that area API are unaffected.
- Migration: no global rename. ProgramModel assets are migrated explicitly when F-11 is implemented. Existing unscoped labels are not auto-prefixed, dual-read, or silently moved between areas.
- Tier and owner: Tier 1 owns only registered structural-key shape/placement and generic label/PIN validation. The Tier 2 ProgramModel manager owns prefix-to-area interpretation, area read/write policy, and materialization; Tier 1 does not learn ProgramModel business permissions.
- Failure and default: a new ProgramModel area key with a missing/wrong prefix, empty suffix, reserved structural collision, or unauthorized STATUS/SYS write fails closed with no partial write. Outside ProgramModel scope, current registry behavior remains the default.
- Dependencies: if F-11 defines a ProgramModel area API, it must use this namespace rule. If F-11 does not adopt areas, this decision remains dormant and activates no behavior. F-13 may specialize `log_` payloads without changing the namespace rule.
- Verification: table-driven tests for every prefix, empty suffix, structural exemptions, cross-area writes, non-ProgramModel compatibility, and absence of `sys_model_type`/`sys_model_size` aliases.
- Tradeoff: adopts the useful area vocabulary without renaming the repository's structural contract, but requires a clear ProgramModel boundary.

### F10-O2 — Full Feishu Naming Hard Cut

- Canonical shape: `sys_model_type` replaces `model_type` while retaining the selected structural `model.*` type, value grammar, and placement. `sys_model_size:model.matrix.size` is allowed only at a `model.matrix` root `(0,0,0)` and has exactly `{min_p:int,min_r:int,min_c:int,max_p:int,max_r:int,max_c:int}`, with each minimum less than or equal to its maximum. The seven area prefixes are mandatory for all corresponding ProgramModel labels. Old structural keys and unprefixed area keys are invalid, with no aliases.
- Migration: repository-wide hard cut across persisted models, patches, fixtures, protocol examples, validators, and local deployments. All producers and consumers switch in one migration window.
- Tier and owner: Tier 1 registry/parser owns the new structural names, size bounds, and placement. Tier 2 ProgramModel policy owns prefix validation within ProgramModel areas and all per-area permissions/behavior.
- Failure and default: any old key or wrong prefix rejects the containing model/message atomically. No compatibility read or automatic rewrite occurs.
- Dependencies: blocks F-11 and all current model/protocol fixtures until a complete structural-key migration and rollback export are ready.
- Verification: repository-wide search and generated-fixture audit show zero old structural keys; negative compatibility tests reject them; full local OrbStack role and transport E2E passes using only new keys.
- Tradeoff: maximally aligns naming with the current source examples but breaks the most pervasive existing repository key and creates a high-risk all-at-once migration.

### F10-O3 — Namespaces Are Descriptive Only

- Canonical shape: keep current registry-defined keys, including `model_type`; do not register or enforce the seven area prefixes, `sys_model_type`, or `sys_model_size` as product contracts.
- Migration: none.
- Tier and owner: existing registry and model-specific Tier 2 functions continue to own labels without a generic area namespace.
- Failure and default: no new prefix validation; existing label, permission, and protocol behavior remains authoritative. Feishu-only keys may be retained inert by current implementation but are non-executable and do not count as supported aliases.
- Dependencies: F-11 must either avoid the Feishu area API or define a different key/ownership mechanism; F-13 remains independent of `log_` prefixes.
- Verification: alignment tests mark the namespace text intentionally non-normative and prove no aliases/prefix enforcement or executable behavior were added; a conformance assertion records any inert unknown-label retention.
- Tradeoff: safest for existing content but rejects the source's ProgramModel organization as an executable contract.

### F10-DEFER — Keep The Finding Open

- Canonical shape: current keys remain executable; no new prefix or alias is adopted.
- Migration: none.
- Tier and owner: unchanged.
- Failure and default: unchanged current behavior may retain new source keys inert but activates no namespace behavior; the watcher continues to stop on F-10.
- Dependencies: F-11 cannot freeze an area-key contract and must be deferred or explicitly avoid area materialization.
- Verification: keep F-10 `requires_user_confirmation / high` in backlog, coverage, manifest, and watcher tests.
- Tradeoff: avoids an unsafe rename but blocks a stable ProgramModel area API.

Recommendation: choose `F10-O1`. It confines the prefixes to the feature that gives them meaning and preserves the existing structural keys.

Valid reply: `DEC-0459-F10@v1 = F10-O1`, `DEC-0459-F10@v1 = F10-O2`, `DEC-0459-F10@v1 = F10-O3`, or `DEC-0459-F10@v1 = F10-DEFER`.

## DEC-0459-F11@v1 — ProgramModel Lifecycle And Areas

### Question

Should the ProgramModel lifecycle compile into existing PIN/runtime primitives, introduce a new generic runtime engine, or remain unadopted?

### Evidence And Current Truth

- Model2 revision `14288` describes SYS/IN/OUT/LOG/USER/PERSIS/STATUS areas, `sys_mng:pin.manage`, commands `START`, `STOP`, and `CLEAR_BUFFER`, FIFO input buffering, ordered functions, stop modes, and lifecycle status.
- Current repository runtime interprets registered PIN types and `func.js` / `func.python`; it has no `pin.manage` registry entry, generic area store, or MNG state machine.
- Current implementation retains unknown label types such as `pin.manage` as inert labels instead of rejecting them. That differs from the desired fail-closed registry boundary and must be treated as a conformance gap, not as ProgramModel support.
- Side effects must remain expressed through ModelTable label operations. Tier 2 business policy may be fill-table code; generic runtime must not absorb product-specific orchestration unnecessarily.
- This decision depends on F-14 lifecycle ownership and F-10 namespace policy.

### Shared Contract If F11-O1 Or F11-O2 Is Selected

- Opt-in and placement: a ProgramModel is an explicitly indexed non-connection model whose root `(0,0,0)` uses the structural key selected by F-10, has a case-sensitive `Code` or `Code.*` value, and contains `sys_program_contract:str="program_model.v1"`. A Code model without that marker keeps current event-triggered behavior and is not silently upgraded.
- Required root control/status labels: `sys_stop_mode:str` in `immediate_stop|wait_func|wait_loop` (default `wait_loop`); `sys_input_queue_limit:int` positive (default `1024`); `sys_func_order:list` of unique ProgramModel-relative function references exactly `{p:int,r:int,c:int,k:nonempty str}` that resolve to existing `func.js`/`func.python` labels; `sys_func_match:list` with exactly one entry per trigger function, shaped `{func:{p,r,c,k},input_pins:[nonempty str]}`, where `*` alone means any input pin; `status_program_state:str`; `status_run_step:str`; and `status_last_error:str` (empty when healthy). Cross-Cell duplicate function keys are allowed because coordinates are required. When the pending-input limit is reached, the newest input is rejected without altering the existing queue and a visible error is recorded.
- Persistence target: if any `persis_*` label exists, root must also contain `sys_persis_target:dict` exactly `{kind:"modeltable_pin.v1",worker_id:nonempty str,table_id:nonempty str,model_id:int,pin:nonempty str}`. The ProgramModel manager may emit PERSIS only through an existing authorized output route to that public pin; it never writes a foreign ModelTable or DAM directly. The trusted installer owns this descriptor and the target owner validates materialization. Missing, malformed, unresolved, or unauthorized target rejects START before any function runs; no default or alternate target exists.
- Logical areas: area is derived from the exact key prefix, not a fixed coordinate partition or hidden submodel. `sys_*` control and `status_*` labels are manager-owned at root. `in_<name>:pin.in`, `out_<name>:pin.out`, and `log_<name>:pin.logout` may be declared at ProgramModel-relative cells and carry `null` or Temporary ModelTable record arrays. `user_*` and `persis_*` may use registered non-structural label types at ProgramModel-relative cells. Function labels and structural labels are not area data and keep their registered names.
- Management command: `sys_mng` is the sole management pin. Its command is one Temporary ModelTable `Data.Single` root containing only the F-10-selected structural declaration and `user_set_status:str` in `START|STOP|CLEAR_BUFFER`. Commands are serialized FIFO and never inferred from ordinary input.
- State machine: initial state is `STOPPED/idle`. `START` is valid only from `STOPPED`: it moves through `STARTING/init` to `RUNNING/idle`; any initialization failure moves to `ERROR` and records the failing step. While running, each loop is `load -> run_func -> clean -> idle`. `STOP` from `STARTING`, `RUNNING`, or `ERROR` moves through `STOPPING/clean` to `STOPPED/idle`; `STOP` in `STOPPED` or `STOPPING` is an idempotent no-op success. `START` in any non-`STOPPED` state is rejected. `CLEAR_BUFFER` is valid in every state, changes no lifecycle state, and atomically removes only pending input—not the active snapshot or PERSIS. Recovery from `ERROR` therefore requires `STOP` and then `START`.
- Stop/failure semantics: `wait_loop` finishes the active loop, `wait_func` finishes only the active function and skips remaining functions, and `immediate_stop` requires a host-declared safe-cancellation capability or is rejected. Buffer, function, cleanup, or persistence failure moves the model to `ERROR`, preserves the last stable PERSIS state, and never claims a partial save.

### F11-O1 — Compile Program Lifecycle Into Existing PIN (Recommended)

- Canonical shape: adopt the complete shared ProgramModel shape/state machine above and expose `sys_mng` as the existing `pin.in`, not a new `pin.manage`. A Tier 2 ProgramModel manager materializes the selected F-10 areas and state.
- Runtime behavior: input messages enter an in-memory FIFO owned by the ProgramModel manager. Each loop snapshots at most one queued input into IN, builds the eligible function set under the shared F-12 scheduler, executes it by the coordinate-qualified `sys_func_order`, then cleans OUT/LOG/IN and emits only PERSIS (plus approved SYS facts) to the exact persistence target. Default function mode is trigger. Default stop mode is `wait_loop`; `wait_func` waits for the active function, and `immediate_stop` is accepted only when the function host proves safe cancellation.
- Migration: implement as fill-table-first Tier 2 manager functions and existing PIN connections. Existing event-triggered functions continue until an asset explicitly opts into ProgramModel lifecycle; no automatic wrapping and no `pin.manage` alias.
- Tier and owner: Tier 1 validates only generic Temporary ModelTable shape, existing PIN routing, registered function descriptor shape, and host cancellation capability. The nearest F-14 Flow owner and its Tier 2 ProgramModel manager parse the command vocabulary and own lifecycle, buffers, order, area permissions/writes, and visible status.
- Failure and default: use the shared transition/failure table. Malformed command, ambiguous owner, invalid transition, unsafe `immediate_stop`, buffer corruption, or persistence failure writes `status_last_error`, follows the specified state transition, and leaves ModelTable/PERSIS at the last atomic state.
- Dependencies: requires the compatible `F14-O1` or `F14-O2` choice and `F10-O1` or `F10-O2`, exactly as listed in the packet matrix. F-12 supplies function mode/timing; F-13 supplies log event shape. Implementation must be a follow-on iteration.
- Verification: deterministic transition table; coordinate-qualified same-key function tests; match-table and wildcard tests; FIFO/order and concurrent-arrival tests; all three stop modes; atomic clear-buffer tests; persistence descriptor/permission/failure-injection tests; CJS/ESM parity where Tier 1 changes; local OrbStack positive/negative E2E with SSOT-conformant MBR/DEM/R1 roles.
- Tradeoff: realizes the lifecycle without expanding generic PIN vocabulary, but requires a substantial Tier 2 manager and explicit opt-in migration.

### F11-O2 — New Generic `pin.manage` Program Engine

- Canonical shape: adopt the complete shared ProgramModel shape/state machine above, but register `sys_mng:pin.manage` as the sole management entry and implement the seven logical areas as generic runtime-managed ProgramModel surfaces.
- Runtime behavior: Tier 1 owns FIFO buffering, area permissions, function order, periodic loop, stop modes, cleanup, persistence dispatch, and status updates for every ProgramModel.
- Migration: hard cut ProgramModel assets from ordinary `pin.in`/function triggers to `pin.manage` and the seven areas. No long-term dual entry; existing assets require conversion before activation.
- Tier and owner: generic CJS/ESM runtime owns universal engine mechanics; the selected F-14 policy and its Flow/product owner still own business activation and orchestration policy where applicable.
- Failure and default: use the shared transition/failure table. Invalid command/transition/area write fails atomically; unsupported safe cancellation rejects `immediate_stop`; missing required persistence target moves the model to `ERROR` without claiming saved state.
- Dependencies: requires F-10 area names, F-12 timing, F-13 logs, dual-runtime implementation, persistence adapter contracts, and a full migration plan.
- Verification: complete CJS/ESM parity for every shared state/command/step; opt-in and inert-unmarked Code tests; coordinate/match/order and concurrency/FIFO/clear-buffer tests; area placement/ACL tests; persistence target permission/crash recovery; and all local roles rebuilt and tested in OrbStack.
- Tradeoff: gives every ProgramModel a uniform engine closest to the source, but violates the current fill-table-first boundary unless justified as universal interpreter semantics and creates the largest runtime risk.

### F11-O3 — Keep Current Event-Triggered Functions

- Canonical shape: no `pin.manage`, generic areas, MNG state machine, or input buffer contract. Programs remain `func.js` / `func.python` invoked by current PIN/label connections; model-specific Tier 2 functions may store their own state using registered labels.
- Migration: none.
- Tier and owner: existing Tier 1 runtime interprets functions/PIN only; each Tier 2 model owns any business lifecycle explicitly.
- Failure and default: no implicit START/STOP/CLEAR_BUFFER behavior. Current implementation may retain `pin.manage` or command labels inert instead of rejecting them; they must not trigger behavior or count as support. The existing SSOT-versus-runtime rejection gap remains explicit follow-on debt; current function and PIN errors remain authoritative.
- Dependencies: F-12 cannot assume a ProgramModel loop; any periodic feature needs a separate scheduler decision. F-13 may still define a log message schema.
- Verification: current runtime suites remain unchanged and negative tests prove `pin.manage` and MNG commands never trigger lifecycle behavior; a separate conformance test records whether the current runtime still retains them inert.
- Tradeoff: minimal risk and clear ownership, but does not adopt the source's core ProgramModel lifecycle.

### F11-DEFER — Keep The Finding Open

- Canonical shape: current event-triggered runtime remains executable; no area or lifecycle contract is adopted.
- Migration: none.
- Tier and owner: unchanged.
- Failure and default: new ProgramModel surfaces remain unsupported and may be retained inert by current implementation; they do not activate behavior. The watcher continues to stop on F-11.
- Dependencies: F-12 periodic execution cannot rely on an approved ProgramModel lifecycle; implementation planning remains blocked.
- Verification: F-11 remains `requires_user_confirmation / high` and no new labels or behavior appear.
- Tradeoff: avoids choosing an incomplete engine but preserves lifecycle ambiguity.

Recommendation: choose `F11-O1`. It makes the lifecycle explicit while keeping business orchestration in fill-table Tier 2 policy and reusing the existing PIN contract.

Valid reply: `DEC-0459-F11@v1 = F11-O1`, `DEC-0459-F11@v1 = F11-O2`, `DEC-0459-F11@v1 = F11-O3`, or `DEC-0459-F11@v1 = F11-DEFER`.

## DEC-0459-F12@v1 — Function Naming, Mode, Timer, And Timeout

### Question

Should mode and timing extend the current function descriptor, use new standalone label types, or remain unsupported?

### Evidence And Current Truth

- Model2 revision `14288` names `func.code.python`, `func.code.js`, `func.mode`, and `func.timer.ms`, but its examples still use `func.python` / `func.js`. It also overloads timer meaning: periodic interval versus trigger timeout, with zero meaning no trigger timeout.
- Current executable labels are `func.python` and `func.js` with object descriptors containing code and model scope; no function mode or per-function scheduler contract exists.
- Current implementation retains unknown function label types such as `func.code.js`, `func.mode`, and `func.timer.ms` as inert labels instead of rejecting them. They do not execute, but that retention differs from the desired fail-closed registry boundary.
- The source therefore cannot be adopted literally without choosing canonical names and separating or accepting overloaded timing semantics.

### Shared Scheduling Contract If F12-O1 Or F12-O2 Is Selected

- The entire ProgramModel has one execution lane: at most one function, regardless of key or Cell, is in flight. At each round boundary the manager loads at most one FIFO input snapshot, selects trigger functions whose coordinate-qualified `sys_func_match.input_pins` contains that input pin (or `*`), adds periodic functions already due, de-duplicates by full `{p,r,c,k}`, and executes the ready set serially in `sys_func_order`. New input and newly due periodic work arriving during a round waits for the next boundary. A function absent from `sys_func_order`, a missing/duplicate reference, a trigger function without exactly one match entry, a periodic function with a match entry, or a match to an undeclared input pin rejects ProgramModel activation.
- Periodic time is fixed-delay, not fixed-rate: the first invocation starts one full interval after the ProgramModel enters `RUNNING`; the next starts one full interval after the prior invocation finishes. Long calls create no overlap, catch-up burst, or queued missed tick. The periodic clock resets after every STOP/START cycle.
- Once state leaves `RUNNING`, no new invocation starts. Pending input remains in the F-11 queue unless `CLEAR_BUFFER` is issued; periodic ticks are not retained. Timeout, cancellation, or function failure is reported to the F-11 owner, moves the ProgramModel to `ERROR`, and suppresses further invocation until the defined STOP -> START recovery.

### F12-O1 — Extend Existing Function Descriptor (Recommended)

- Canonical shape: keep `func.js` and `func.python`. Extend each value to exactly `{code, modelName, mode, intervalMs, timeoutMs}`. `mode` is `trigger` or `periodic`; default is `trigger`. `intervalMs` is `null` for trigger and a positive integer for periodic. `timeoutMs` is always a positive per-execution limit and defaults to `30000`. Zero never means unlimited. Adopt the shared no-overlap/fixed-delay/FIFO scheduling contract. Do not register `func.code.*`, `func.mode`, or `func.timer.ms` aliases.
- Migration: existing `{code, modelName}` descriptors remain valid and normalize to trigger/`intervalMs:null`/`timeoutMs:30000`. Periodic behavior is opt-in; no code label rename or automatic timer creation.
- Tier and owner: Tier 1 validates descriptor shape and enforces the per-execution timeout/cancellation capability boundary; the F-11 Tier 2 lifecycle owner implements the fully specified shared scheduling and queue policy.
- Failure and default: unknown/extra descriptor fields, unknown mode, missing/invalid interval for periodic, interval on trigger, nonpositive timeout, unsafe cancellation, or attempted overlap fails visibly and does not silently fall back. Runtime execution failure follows the shared transition to `ERROR`. Default trigger execution preserves current behavior after descriptor normalization.
- Dependencies: periodic mode requires an approved F-11 lifecycle/scheduler owner and the F-14 ownership decision; trigger mode can remain compatible with current execution.
- Verification: descriptor compatibility tests; mode/timing boundary table; fake-clock periodic tests; timeout/cancellation tests for JS and Python; no-overlap/backpressure tests; local OrbStack scheduler E2E.
- Tradeoff: removes naming and timer ambiguity while preserving current function labels, but intentionally diverges from the source's standalone label presentation and zero-unlimited rule.

### F12-O2 — Standalone Feishu Function Labels

- Canonical shape: hard cut to `func.code.js` / `func.code.python` for code, plus `{functionName}:mode:func.mode` and `{functionName}:timer:func.timer.ms`. Mode is `periodic` or `trigger`. For periodic, timer is a required positive interval; for trigger, timer is a nonnegative function-level timeout and zero disables only that function-level limit. The host still enforces a mandatory `30000` ms safety ceiling when zero is used or when the periodic timer represents interval. Adopt the same shared no-overlap/fixed-delay/FIFO scheduling contract.
- Migration: rewrite every current `func.js` / `func.python` label and add explicit mode/timer labels. No aliases or dual-read after cutover.
- Tier and owner: Tier 1 atomically joins/validates the three labels and enforces the function/host timeout boundary; the F-11 lifecycle owner implements the fully specified shared scheduling and queue policy.
- Failure and default: missing/duplicate companion labels, unknown mode, negative timer, periodic zero, name mismatch, attempted overlap, or disabled host safety boundary rejects the function definition. Runtime execution failure follows the shared transition to `ERROR`. No implicit mode or timer default exists after hard cut.
- Dependencies: requires F-11 scheduler ownership, a multi-label atomic-load contract, CJS/ESM changes, and repository-wide asset migration.
- Verification: atomic companion-label tests, old-label rejection tests, periodic/trigger timer semantics, safety timeout tests, complete fixture migration, and local OrbStack E2E.
- Tradeoff: follows the visible source names and split shape, but multiplies consistency failure modes and retains two meanings for `func.timer.ms`.

### F12-O3 — Keep Current Function Contract

- Canonical shape: only `func.js` and `func.python` with current `{code, modelName}` values are executable. `func.code.*`, `func.mode`, `func.timer.ms`, periodic scheduling, and per-function timeout are not adopted.
- Migration: none.
- Tier and owner: unchanged current runtime/function host.
- Failure and default: new source label types may be retained inert by current implementation but never execute or modify current functions; they are not treated as supported aliases. Functions keep current trigger behavior and current host-level error handling. The inert-label retention versus fail-closed SSOT expectation remains explicit conformance debt.
- Dependencies: F-11, if adopted, must run current functions without per-function mode/timer or define timing in its own separate configuration.
- Verification: current function suites pass and negative tests prove retained new labels do not activate behavior; a separate conformance assertion records the current inert retention gap.
- Tradeoff: preserves compatibility but leaves periodic execution and explicit timeout unimplemented.

### F12-DEFER — Keep The Finding Open

- Canonical shape: current function labels remain executable; no new mode/timing decision is adopted.
- Migration: none.
- Tier and owner: unchanged.
- Failure and default: source labels remain non-executable and may be retained inert by current implementation; watcher continues to stop on F-12. No retained label counts as adoption.
- Dependencies: periodic F-11 behavior and any per-function timeout implementation remain blocked.
- Verification: F-12 stays `requires_user_confirmation / high`; no alias or scheduler behavior appears.
- Tradeoff: avoids encoding contradictory source text but preserves the scheduling gap.

Recommendation: choose `F12-O1`. One descriptor is easier to validate atomically, preserves current names, and separates interval from execution timeout.

Valid reply: `DEC-0459-F12@v1 = F12-O1`, `DEC-0459-F12@v1 = F12-O2`, `DEC-0459-F12@v1 = F12-O3`, or `DEC-0459-F12@v1 = F12-DEFER`.

## DEC-0459-F13@v1 — Program Log Event Schema

### Question

Should program logs use a table-qualified structured event over the existing log PIN, adopt the source row shape literally, or remain an application-defined payload?

### Evidence And Current Truth

- Model2 revision `14288` examples contain `log_type`, `log_info`, `log_model_id`, `log_p/r/c`, `log_func`, and `log_time`, but omit table identity and show repeated message-local coordinates. Severity strings include brackets and `log_model_id` is a string path.
- Current repository defines `pin.login` / `pin.logout` transport but does not define a business log-record schema, collector, retention, or persistence policy. Internal `eventLog` is diagnostic state, not a product log contract.
- Current implementation retains the value written to an unconnected `pin.logout`; it does not discard that label value. Retention in the pin cell is not durable collection and must not be reported as persistence.
- Any adopted event must remain table-qualified and must not silently imply durable storage.

### F13-O1 — Table-Qualified V2 Log Event (Recommended)

- Canonical shape: use the existing `pin.logout -> pin.login` connection. Each emission carries exactly one Temporary ModelTable `Data.Single` payload root identified by `log_schema:str="program_log.v1"`, with required labels: `log_type:str` in `INFO|WARN|ERROR`; nonempty `log_info:str`; nonempty `log_table_id:str`; `log_model_id:int`; `log_p:int`; `log_r:int`; `log_c:int`; nonempty `log_func:str` (use `__lifecycle__` for a lifecycle event); and `log_time:int` as epoch milliseconds. The trusted owner fills source identity/time; the producer supplies severity/message. Multiple events are separate emissions and therefore cannot collide at one message-local cell.
- Migration: no `pin.log.*` aliases and no conversion of internal `eventLog`. Existing application-defined log payloads continue until their producer/collector explicitly migrates; structured events use a versioned validation boundary.
- Tier and owner: Tier 1 validates Temporary ModelTable shape and log PIN transport. The Tier 2 ProgramModel/host owner attests table-qualified source/time. An explicit Tier 2 collector owns materialization, retention, redaction, and export.
- Failure and default: malformed, unknown-version, or untrusted events are rejected without recursive logging. With no collector, the current `pin.logout` value remains locally visible and may be replaced by a later write; nothing is durably persisted. ERROR must additionally write a stable local visible error-status label. There is no automatic persistence or retention default.
- Dependencies: compatible with F-11 LOG output but does not require a generic area engine. A follow-on privacy/retention decision is required before durable collection.
- Verification: exact-schema/type/range tests; spoofed source/time rejection; multiple-event identity tests; missing-collector INFO/WARN/ERROR behavior; collector retention/redaction tests; local OrbStack log transport E2E.
- Tradeoff: preserves Table ModelRef identity and current log PINs, but adds fields beyond the source and intentionally separates transport from storage.

### F13-O2 — Source-Literal Log Row/Subtable

- Canonical shape: emit a `Data` subtable root identified by `log_schema:str="feishu_program_log_rows.v1"`; each row has `log_type:str` as `[INFO]` or `[ERROR]`, nonempty `log_info:str`, `log_model_id:str` path, integer `log_p/r/c`, nonempty `log_func:str`, and epoch-millisecond `log_time:int`. Rows receive unique indices; no `log_table_id` is added. Output uses the existing log PIN.
- Migration: producers move to the row schema in one versioned cut; collectors must interpret the string model path. No automatic conversion from internal `eventLog` or arbitrary payloads.
- Tier and owner: Tier 1 validates the subtable/row shape and transports it; the ProgramModel owner fills source/time; a Tier 2 collector owns persistence and retention.
- Failure and default: malformed, unknown-version, or duplicate rows fail atomically. With no collector, the current subtable value remains in `pin.logout` and may be replaced later; there is no special durable ERROR state or automatic persistence.
- Dependencies: requires a repository-wide canonical meaning for string model paths and a collision policy across tables before cross-table aggregation.
- Verification: row/subtable schema tests, unique-row tests, string-path parsing/collision tests, producer/collector E2E, and explicit no-persistence tests.
- Tradeoff: closest to the source example, but source identity is not table-qualified and cross-table aggregation can be ambiguous.

### F13-O3 — Keep Log Payload Application-Defined

- Canonical shape: `pin.login` / `pin.logout` remain the only shared contract; each model defines its own Temporary ModelTable log payload. No shared fields, severity set, timestamp owner, collector, or retention policy is adopted.
- Migration: none.
- Tier and owner: Tier 1 transports valid PIN payloads; each Tier 2 application owns schema/storage.
- Failure and default: only current PIN/payload validation applies. An unconnected `pin.logout` retains its latest value in the pin cell but provides no durable collection; there is no repository-wide ERROR observability guarantee.
- Dependencies: F-11 may emit model-specific LOG payloads but cannot claim a common log API.
- Verification: current PIN tests remain authoritative and alignment tests record the Feishu row schema as intentionally non-normative.
- Tradeoff: no migration risk, but interoperability, diagnostics, and retention remain inconsistent.

### F13-DEFER — Keep The Finding Open

- Canonical shape: existing log PIN transport remains executable; no common event schema is adopted.
- Migration: none.
- Tier and owner: unchanged.
- Failure and default: unchanged current behavior retains an unconnected `pin.logout` value without durable collection; watcher continues to stop on F-13.
- Dependencies: F-11 cannot rely on a repository-wide structured log contract.
- Verification: F-13 remains `requires_user_confirmation / high`; no schema aliases or collector behavior appear.
- Tradeoff: avoids a premature storage/privacy commitment but preserves the log-contract gap.

Recommendation: choose `F13-O1`. It keeps the current transport, adds unambiguous table-qualified identity, and leaves persistence to an explicit collector.

Valid reply: `DEC-0459-F13@v1 = F13-O1`, `DEC-0459-F13@v1 = F13-O2`, `DEC-0459-F13@v1 = F13-O3`, or `DEC-0459-F13@v1 = F13-DEFER`.

## Packet Stop Condition

This packet stops at the User Decision Gate. It does not authorize changes to `docs/ssot/**`, product code, tests outside decision-package validation, deployment, local services, or Feishu.
