---
title: "Iteration 0454 Feishu Focused Current Diff Report"
doc_type: analysis-report
status: completed
updated: 2026-07-09
source: ai
iteration_id: 0454-feishu-focused-current-diff
id: 0454-feishu-focused-current-diff
---

# Iteration 0454 Feishu Focused Current Diff Report

> Authority notice: this report is non-normative iteration evidence. It does not define or override the current repository SSOT; every proposed adoption still requires an approved iteration.

## Source Read

- `feishu-model2`
  - URL: `https://bob3y2gxxp.feishu.cn/wiki/JYNWwQOOjiWcOLktv07cBvIVnOh`
  - Local ignored snapshot: `test_files/feishu_current/0454/state/snapshots/feishu-model2.md`
  - Lines/bytes: 4218 lines, 63694 bytes
  - SHA-256: `6f3b1803a9d54a05452e93a2ea9c041be424196a64a3931763b1ec571b9e129a`
- `feishu-message-api`
  - URL: `https://bob3y2gxxp.feishu.cn/wiki/WBZjwY3DSil6pAkQ8DZcpsrWnUf`
  - Local ignored snapshot: `test_files/feishu_current/0454/state/snapshots/feishu-message-api.md`
  - Lines/bytes: 715 lines, 32857 bytes
  - SHA-256: `7b3576ab5ce70956859957b1271a0e7116e06f94b6664053fc2518788c39b52c`

Read method:

- Used Feishu OpenAPI through `scripts/ops/feishu_source_watch.mjs`.
- Generated `test_files/feishu_current/0454/watch-report.md`.
- The fetch command emitted a local Node warning that `NODE_TLS_REJECT_UNAUTHORIZED=0` is set. No secret was printed or written, but this is a toolchain hygiene risk to fix before relying on the watcher in automation.

## Summary

Current implementation and SSOT are broadly aligned with the two focused Feishu documents after 0441-0453, especially around `model.v1n`, numeric `model.subtableconnection`, `0.1` payload child tables, public `sys_msg_type` families, and response materialization.

The new differences are not mostly "missed code"; they are sharper boundary questions:

- The message API document currently has an internal version mismatch: the opening says current API is `pin_payload.v2`, while the actual structure/examples still use `pin_payload.v1`.
- The model document contains one likely typo, `model.submtconnect`, while the rest of the same document and the repo use `model.submtconnection`.
- Feishu describes base/DEM/MBR auto-filling route data and permission checks when fields are omitted; the current repo validates explicit fields but does not implement that automatic routing policy.
- Feishu says `ui.refresh_data` causes UI model labels to change; the repo currently records a pending refresh only, because direct UI mutation would conflict with the ModelTable-as-truth rule unless expressed as authorized ModelTable writes.
- `add_task_return` is recognized as a documented pin, but the runtime does not synthesize a separate `add_task_return` message; it currently returns handler result through the response outbox contract.

## Findings

### F-01 Message API Version Mismatch

- Classification: `requires_user_confirmation`
- Source evidence:
  - `feishu-message-api.md:5` says the current API version is `pin_payload.v2`.
  - `feishu-message-api.md:124`, `:284`, and `:689` still set `__mt_payload_kind` to `pin_payload.v1`.
- SSOT evidence:
  - `docs/ssot/runtime_semantics_modeltable_driven.md` says Feishu-current public message API input is `pin_payload.v1`, while formal project bus/response transport is `pin_payload.v2`.
  - `docs/ssot/temporary_modeltable_payload_v1.md` says formal bus/pin transport target is `pin_payload.v2`.
- Implementation evidence:
  - `packages/worker-base/src/runtime.mjs` validates Feishu message API input as `pin_payload.v1`.
  - Runtime response outbox emits `packet_kind: "pin_payload.v2"`.
- Impact:
  - If the document header is intended, parser/runtime input needs a new `pin_payload.v2` Feishu message API shape.
  - If the body/examples are intended, the header should be corrected or clarified in Feishu.
- Next action:
  - Ask the team whether Feishu message API input should remain `pin_payload.v1` for the documented `0.1` child table shape, or whether the whole document is moving to a v2 input envelope.

### F-02 `model.v1n` Worker Root

- Classification: `aligned`
- Source evidence:
  - `feishu-model2.md:401` uses `model_type / model.v1n / ""` on Model 0 root.
- SSOT evidence:
  - `docs/ssot/label_type_registry.md` registers `model.v1n` as software worker main model table root, only at host table Model 0 `(0,0,0)`.
- Implementation evidence:
  - Runtime accepts `model.v1n` only at worker root and rejects it elsewhere.
  - `scripts/tests/test_0442_feishu_current_contract_alignment.mjs` covers both acceptance and rejection.
- Next action:
  - None.

### F-03 Numeric `model.subtableconnection`

- Classification: `aligned`
- Source evidence:
  - `feishu-model2.md:496` and repeated message API examples use numeric child ids in `model.subtableconnection.v`.
- SSOT evidence:
  - `docs/ssot/label_type_registry.md` accepts Feishu numeric child table id and object descriptors.
  - `docs/ssot/runtime_semantics_modeltable_driven.md` requires runtime normalization to table-qualified references.
- Implementation evidence:
  - Runtime normalizes numeric child table ids.
  - `scripts/tests/test_0442_feishu_current_contract_alignment.mjs` covers numeric normalization.
- Next action:
  - None.

### F-04 `model.submtconnect` Typo-Like Source Term

- Classification: `requires_user_confirmation`
- Source evidence:
  - `feishu-model2.md:519` uses `model.submtconnection`.
  - `feishu-model2.md:4108` later uses `model.submtconnect`.
- SSOT evidence:
  - Current SSOT only recognizes `model.submtconnection`.
- Implementation evidence:
  - Runtime only accepts `model.submtconnection`; no alias exists for `model.submtconnect`.
- Impact:
  - Adding a compatibility alias would violate the current no-compatibility default unless explicitly approved.
- Next action:
  - Treat `model.submtconnect` as a suspected document typo and ask the team to confirm. Do not add an alias automatically.

### F-05 `ui.refresh_data` Mutating UI Labels

- Classification: `requires_user_confirmation`
- Source evidence:
  - `feishu-message-api.md:523` says UI refresh data causes the UI model to change corresponding labels.
- SSOT evidence:
  - Current SSOT says UI is projection only, and side effects must remain on the ModelTable path.
  - `docs/ssot/runtime_semantics_modeltable_driven.md` currently states `ui.refresh_data` records pending refresh parameters and does not directly mutate UI labels or synthesize response.
- Implementation evidence:
  - Runtime records `feishu_ui_manager_state.refresh.pending`.
  - `scripts/tests/test_0447_feishu_ui_api_processor.mjs` asserts no synthesized response and no direct UI mutation.
- Impact:
  - If the Feishu text means "write ModelTable labels through authorized add_label/rm_label", this can be implemented as a later model-authorized update path.
  - If it means direct frontend/UI mutation, it conflicts with current hard rules and must be escalated.
- Next action:
  - Ask the team to clarify whether `ui.refresh_data` should produce authorized ModelTable writes, frontend projection refresh, or both.

### F-06 Base/DEM/MBR Auto-Fill And Permission Routing

- Classification: `requires_user_confirmation`
- Secondary classification: `implementation_gap`
- Source evidence:
  - `feishu-message-api.md:47`, `:53`, `:73`, `:79`, and `:143` describe software worker base auto-filling bus/endpoint data and DEM/MBR permission checks when fields are omitted.
- SSOT evidence:
  - Current SSOT covers explicit topic/endpoint/response metadata and fail-closed validation.
  - It does not yet define a full route directory, permission decision, or omitted-field fill policy for Feishu public message API.
- Implementation evidence:
  - Parser requires `origin_pin` and `endpoint_pin`; `message_server` and `between` are optional if present.
  - Runtime validates explicit values but does not infer missing target worker/model/pin from DEM/MBR registries.
- Impact:
  - Direct MQTT/manual-send mode works only with explicit metadata.
  - Base-assisted send semantics remain incomplete.
- Next action:
  - Plan a separate route-policy iteration: define source of truth for DEM/MBR connection directory, permission checks, default local/global server selection, and omitted-field materialization.

### F-07 Config Labels And Global MQTT Semantics

- Classification: `requires_user_confirmation`
- Secondary classification: `ssot_gap`
- Source evidence:
  - `feishu-model2.md:405` uses `mqtt.global.ip`.
  - `feishu-model2.md:407` uses `mqtt.global_port`.
  - The label table also describes `config.control` and `config.manage`.
- SSOT evidence:
  - `docs/ssot/feishu_alignment_decisions_v0.md` says `mqtt.global.*` was not promoted to fully frozen implemented semantics.
  - Existing user guide and bootstrap config support split `mqtt.local.*`, `mqtt.global.*`, and `matrix.*`, but runtime routing also uses `mqtt_topic_base` / `mqtt_worker_id`.
- Implementation evidence:
  - `packages/worker-base/src/bootstrap_config.mjs` reads `mqtt.global.ip` and `mqtt.global.port`.
  - Current runtime topic routing reads `mqtt_topic_base` and `mqtt_worker_id`.
  - No implementation evidence found for `config.control` / `config.manage` as canonical runtime input labels.
- Impact:
  - There are two configuration styles: Feishu conceptual config labels and repo operational routing labels.
  - `mqtt.global_port` in the Feishu example differs from the repo's `mqtt.global.port` type spelling.
- Next action:
  - Decide whether `config.control` / `config.manage` become canonical aggregate labels, remain explanatory, or are compiled into existing split labels. Confirm `mqtt.global_port` spelling before any registry update.

### F-08 `add_task_return` Response Semantics

- Classification: `requires_user_confirmation`
- Secondary classification: `implementation_gap`
- Source evidence:
  - The task API section says add-task success returns a task id through `add_task_return`.
- SSOT evidence:
  - Current SSOT says the task manager does not synthesize `add_task_return`; cross-worker reply remains bound to `response_topic`.
- Implementation evidence:
  - Runtime recognizes `add_task_return` as a documented task pin and validates its payload shape.
  - Runtime add-task handler returns task id in handler result and can publish the response outbox, but does not create a separate `add_task_return` message.
- Impact:
  - The current response path likely carries the needed data, but it does not match the literal pin-specific return described by Feishu.
- Next action:
  - Ask whether `add_task_return` must be an actual task pin message, or whether response outbox handler result is the accepted project mapping.

### F-09 Feishu Watcher TLS Hygiene

- Classification: `tooling_gap`
- Source evidence:
  - The fetch command emitted a Node warning that TLS certificate verification is disabled by environment variable.
- Impact:
  - Current manual run succeeded, but a recurring monitor should not run with TLS verification disabled.
- Next action:
  - Add a watcher preflight that reports or fails when `NODE_TLS_REJECT_UNAUTHORIZED=0` is present, unless an explicit local-debug flag is set.

## Existing Implementation Coverage

Implemented and verified by current repo:

- `model.v1n` worker root acceptance and out-of-scope rejection.
- Numeric `model.subtableconnection.v` normalization.
- Feishu `0.1` payload child table parsing.
- Public `sys_msg_type` families:
  - `resource.report`
  - `resource.request`
  - `resource.result`
  - `data.save_modeltable`
  - `data.load_modeltable`
  - `data.save_flow`
  - `data.load_flow`
  - `ui.update_data`
  - `ui.tmp_data`
  - `ui.form_data`
  - `ui.refresh_data`
  - `task_data`
- Task pins:
  - `add_task`
  - `add_task_return`
  - `edit_task`
  - `delete_task`
  - `receive_task`
  - `finish_task`
  - `archive_task`
- Response outbox and response materialization through formal `pin_payload.v2`.

Not implemented or not fully specified:

- Feishu API input as `pin_payload.v2`.
- Omitted-field auto-fill for base-assisted sends.
- DEM/MBR connection directory and permission evaluation for public message API routing.
- Direct `ui.refresh_data` label mutation path.
- Literal `add_task_return` message synthesis.
- `config.control` / `config.manage` as canonical runtime labels.

## How To Hold The Growing Codebase

The current repo has enough surface area that ad hoc search is becoming risky:

- tracked files: 1933
- package files: 126
- test files: 339
- SSOT docs: 22
- iteration evidence files: 1046
- core JS/SSOT/script line count checked in this pass: about 138748 lines

`rg` remains useful for verification, but it should not be the main memory system. The better path is a generated "contract intelligence layer".

### Recommended Architecture

Create a versioned contract manifest plus generated local indexes:

1. `docs/ssot/contract_surface_manifest.json`
   - Human-maintained contract cards.
   - Fields:
     - `contract_id`
     - `source_docs`
     - `ssot_files`
     - `implementation_files`
     - `test_files`
     - `known_terms`
     - `owner_iteration`
     - `status`
     - `risk_level`

2. `test_files/generated/code_symbol_index.json`
   - Generated, ignored.
   - Built from JS/MJS AST, not regex only.
   - Records classes, functions, methods, exported names, string constants, label types, `sys_msg_type` literals, and test names with file/line anchors.

3. `test_files/generated/feishu_impact_index.json`
   - Generated from Feishu Markdown snapshots and `contract_surface_manifest.json`.
   - Maps Feishu headings and keywords to contract ids, likely files, tests, and review class.

4. `docs/ssot/contract_coverage_summary.md`
   - Versioned summary only.
   - Lists each contract, its SSOT, implementation, and verification command.
   - This is the page an agent reads before touching runtime.

### Workflow Change

For each future Feishu change:

1. Watcher pulls changed Markdown.
2. Impact router maps changed headings to contract ids.
3. Agent reads the contract card first, not the whole repo.
4. Agent runs only the mapped tests first, then broader regressions if runtime/common files changed.
5. CI/docs gate checks that every changed contract has at least one SSOT file, implementation anchor, and test anchor.

### Why This Is Better

- Faster: read a small contract card before code search.
- More complete: every contract points to SSOT, code, and tests.
- Safer: Feishu doc changes get routed by heading/term instead of agent memory.
- Auditable: if a contract changes without tests, the coverage gate catches it.
- Scales with repo size: generated symbol indexes can grow without bloating versioned docs.

### First Implementation Slice

Recommended next iteration:

- Add `docs/ssot/contract_surface_manifest.json` with 8 starter contract cards:
  - `model.v1n.worker_root`
  - `model.subtableconnection.numeric`
  - `pin_payload.formal_v2`
  - `feishu_message_api.input_v1`
  - `feishu_message_api.response_outbox`
  - `feishu_message_api.response_materialization`
  - `feishu_message_api.resource_data_ui_task_handlers`
  - `feishu_source_watch.focused_docs`
- Add `scripts/ops/build_contract_index.mjs`.
- Add `scripts/tests/test_0455_contract_surface_index.mjs`.
- Make the test fail if any contract card lacks SSOT, implementation, or verification anchors.

This is deliberately small: it upgrades repo navigation without changing runtime behavior.
