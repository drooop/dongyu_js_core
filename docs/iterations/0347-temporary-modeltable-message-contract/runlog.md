---
title: "0347 — Temporary ModelTable Message Contract Run Log"
doc_type: iteration-runlog
status: completed
updated: 2026-04-27
source: ai
iteration_id: 0347-temporary-modeltable-message-contract
id: 0347-temporary-modeltable-message-contract
phase: completed
---

# Iteration 0347-temporary-modeltable-message-contract Runlog

## Environment

- Date: 2026-04-27
- Branch: `dev_0347-temporary-modeltable-message-contract`
- Runtime: docs-only; no local service restart/deploy required.

Review Gate Record
- Iteration ID: 0347-temporary-modeltable-message-contract
- Review Date: 2026-04-27
- Review Type: User requested direct freeze
- Review Index: 1
- Decision: Approved
- Notes: User requested auditing Data.* definitions and freezing the message/materialization contract in repo docs.

## Execution Records

### Step 1 — Data Model Current-State Audit

- Commands:
  - `rg -n "temporary ModelTable|临时模型表|materialize|materialization|Data\\.Array|Data\\.Queue|Data\\.Stack|data model|数据模型" docs/ssot docs/user-guide docs/plans docs/iterations/0190-data-array-tier2-template docs/iterations/0296-foundation-c-data-models packages/worker-base/src/data_models.js packages/worker-base/system-models/templates scripts/fixtures`
  - `sed -n '1,260p' docs/user-guide/data_models_filltable_guide.md`
  - `sed -n '1,260p' docs/plans/2026-04-06-foundation-c-data-models-design.md`
  - `sed -n '1,280p' docs/plans/2026-04-06-foundation-c-data-models-implementation.md`
  - `sed -n '1,260p' docs/ssot/temporary_modeltable_payload_v1.md`
  - `sed -n '1,260p' docs/ssot/program_model_pin_and_payload_contract_vnext.md`
  - `sed -n '1,260p' packages/worker-base/src/data_models.js`
  - `sed -n '1,240p' packages/worker-base/system-models/templates/data_array_v0.json`
  - `sed -n '1,240p' packages/worker-base/system-models/templates/data_queue_v0.json`
  - `sed -n '1,240p' packages/worker-base/system-models/templates/data_stack_v0.json`
  - `sed -n '1,260p' scripts/fixtures/0190_data_array_cases.json`
  - `sed -n '1,260p' scripts/fixtures/0296_data_model_cases.json`
- Key output:
  - `0296-foundation-c-data-models` 已把 `Data.Array / Data.Queue / Data.Stack` 定为第一批 Tier2 data model family。
  - `docs/user-guide/data_models_filltable_guide.md`、templates、fixtures 已使用临时模型表 record array 作为 pin 输入/输出 payload。
  - `packages/worker-base/system-models/templates/data_*_v0.json` 是 checked-in `mt.v0` template wrapper；它 materialize 正式 Data.* 模型，与 pin payload 格式不是同一层。
  - `packages/worker-base/src/data_models.js` 只包含 legacy `CircularBuffer` live dependency；0190 已说明它不是 `Data.Array` 当前正式实现路线。
  - 当前 Data.* 定义与本轮问题直接相关：它们已经体现“pin payload 是临时模型表数组”，但还需要更明确地冻结“临时传输不自动持久化”。
- Result: PASS
- Commit: pending

### Step 2 — Freeze Temporary ModelTable Message Contract

- Commands:
  - Edited SSOT/user-guide docs with 0347 boundary.
  - Added `scripts/tests/test_0347_temporary_modeltable_message_contract.mjs`.
  - `node scripts/tests/test_0347_temporary_modeltable_message_contract.mjs`
- Key output:
  - `[PASS] docs/ssot/temporary_modeltable_payload_v1.md`
  - `[PASS] docs/ssot/program_model_pin_and_payload_contract_vnext.md`
  - `[PASS] docs/ssot/label_type_registry.md`
  - `[PASS] docs/ssot/runtime_semantics_modeltable_driven.md`
  - `[PASS] docs/user-guide/data_models_filltable_guide.md`
  - `[PASS] docs/user-guide/modeltable_user_guide.md`
  - `[PASS] 0347 Temporary ModelTable Message contract docs`
- Result: PASS
- Commit: pending

### Step 3 — Verification And Review

- Commands:
  - `node scripts/tests/test_0347_temporary_modeltable_message_contract.mjs`
  - `git diff --check`
  - sub-agent `019dcd69-5b3d-7563-a5aa-1274f8c8983d` with `codex-code-review`
- Key output:
  - `node scripts/tests/test_0347_temporary_modeltable_message_contract.mjs`: all target docs PASS.
  - `git diff --check`: PASS, no whitespace errors.
  - Sub-agent review: `Decision: APPROVED`; findings none; open questions none; verification gaps none.
- Result: PASS
- Commit: pending

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed and updated for 0347 message/materialization current truth.
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed and updated for the same boundary.
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed for impact: no change needed because this iteration does not alter execution governance.
- [x] `docs/ssot/temporary_modeltable_payload_v1.md` updated as the primary contract.
- [x] `docs/ssot/program_model_pin_and_payload_contract_vnext.md` updated to point pin/event payload semantics at the 0347 boundary.
- [x] `docs/ssot/label_type_registry.md` updated under pin data channel constraints.
- [x] `docs/user-guide/data_models_filltable_guide.md` updated to explain Data.* input/output messages versus formal data rows.
