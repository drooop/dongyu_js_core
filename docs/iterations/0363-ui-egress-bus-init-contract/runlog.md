---
title: "0363 UI Egress Bus Init Contract Runlog"
doc_type: iteration_runlog
status: completed
updated: 2026-05-09
source: ai
iteration: 0363-ui-egress-bus-init-contract
---

# Iteration 0363-ui-egress-bus-init-contract Runlog

## Environment

- Date: 2026-05-09
- Branch: `dev_0363-ui-egress-bus-init-contract`
- Runtime: not used; docs-only contract freeze

## Execution Records

### Step 1

- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0363-ui-egress-bus-init-contract --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output: scaffold wrote `plan.md`, `resolution.md`, and `runlog.md`.
- Result: PASS
- Commit:
- Command: Stage 1 review by sub-agent `019e0c80-0dbb-7a90-b902-63fc07fe5a37`
- Key output: `Decision: APPROVED`; findings none; open questions none; verification gaps none.
- Result: PASS
- Commit:

### Step 2

- Command: `git diff --check`
- Key output: whitespace check PASS.
- Result: PASS
- Commit:
- Command: `rg -n "pin\\.bus\\.(cb|mb)\\.(in|out)" CLAUDE.md docs/architecture_mantanet_and_workers.md docs/ssot/pin_connection_contract_v2.md docs/ssot/label_type_registry.md docs/ssot/runtime_semantics_modeltable_driven.md`
- Key output: target control-bus and management-bus pin labels appear in the highest-priority repo contract and SSOT docs.
- Result: PASS
- Commit:
- Command: `rg -n "pin\\.log\\.\\* 不因本次|legacy pin\\.log\\.\\*|pin\\.log\\.\\*.*恢复|pin\\.log\\.\\*.*MUST NOT be restored" CLAUDE.md docs/ssot/pin_connection_contract_v2.md docs/ssot/label_type_registry.md docs/ssot/runtime_semantics_modeltable_driven.md`
- Key output: docs explicitly keep `pin.log.*` removed and do not restore it as a target surface.
- Result: PASS
- Commit:
- Command: Stage 2 review by sub-agent `019e0c80-0dbb-7a90-b902-63fc07fe5a37`
- Key output: `Decision: CHANGES_REQUESTED`; finding: `runtime_semantics_modeltable_driven.md` §7.4 still named `pin.bus.out` as an approved target. Fixed by changing Local-First Egress Authority to worker root system bus outlet, with current `pin.bus.out` window and 0363 `pin.bus.mb.out` / `pin.bus.cb.out` target.
- Result: FIXED
- Commit:
- Command: negative grep for old `pin.bus.out` target wording across the Stage 2 docs
- Key output: no remaining matches.
- Result: PASS
- Commit:
- Command: Stage 2 re-review by sub-agent `019e0c80-0dbb-7a90-b902-63fc07fe5a37`
- Key output: `Decision: APPROVED`; findings none; open questions none; verification gaps none.
- Result: PASS
- Commit:

### Step 3

- Command: `git diff --check`
- Key output: whitespace check PASS.
- Result: PASS
- Commit:
- Command: `rg -n "ui\\.egress\\.binding\\.v1" docs/ssot/imported_slide_app_host_ingress_semantics_v1.md docs/ssot/runtime_semantics_modeltable_driven.md docs/user-guide/modeltable_user_guide.md docs/ssot/label_type_registry.md`
- Key output: host-owned UI egress binding appears in imported slide app SSOT, runtime SSOT, user guide, and label registry.
- Result: PASS
- Commit:
- Command: `rg -n "provider ZIP.*ui\\.egress\\.binding|zip.*ui\\.egress\\.binding|不得.*ui\\.egress\\.binding|不允许.*ui\\.egress\\.binding|must not.*ui\\.egress\\.binding" docs/ssot/imported_slide_app_host_ingress_semantics_v1.md docs/ssot/runtime_semantics_modeltable_driven.md docs/user-guide/modeltable_user_guide.md docs/ssot/label_type_registry.md`
- Key output: provider ZIP / imported records are explicitly prohibited from declaring `ui.egress.binding.v1`.
- Result: PASS
- Commit:
- Command: `rg -n "remote_bus_endpoint_v1|host_pin_type.*pin\\.bus\\.mb\\.out|pin\\.bus\\.mb\\.out" docs/ssot/imported_slide_app_host_ingress_semantics_v1.md docs/ssot/runtime_semantics_modeltable_driven.md docs/user-guide/modeltable_user_guide.md docs/ssot/label_type_registry.md`
- Key output: remote endpoint intent and the 0363 management-bus egress target are both documented.
- Result: PASS
- Commit:
- Command: Stage 3 review by sub-agent `019e0c80-0dbb-7a90-b902-63fc07fe5a37`
- Key output: `Decision: APPROVED`; findings none; open questions none; verification gaps none.
- Result: PASS
- Commit:

### Step 4

- Command: `git diff --check`
- Key output: whitespace check PASS.
- Result: PASS
- Commit:
- Command: `rg -n '建立模型与层级关系|写入软件工人身份与角色|写入对外通讯参数|加载程序模型|声明引脚|声明连接|恢复可继续执行的运行态数据|不得只按 .*label\\.t|v1n_id|is_DEM' docs/ssot/runtime_semantics_modeltable_driven.md docs/user-guide/modeltable_user_guide.md`
- Key output: startup order, worker identity, and DEM role constraints are documented in runtime SSOT and user guide.
- Result: PASS
- Commit:
- Command: `rg -n 'ui-server.*mbr.*remote-worker|最小 Submit 双总线|真实浏览器|重新填表' docs/ssot/runtime_semantics_modeltable_driven.md docs/user-guide/modeltable_user_guide.md docs/iterations/0363-ui-egress-bus-init-contract/plan.md docs/iterations/0363-ui-egress-bus-init-contract/resolution.md`
- Key output: 0364 obligations include re-fill-table review, existing UI adjustment, minimal Submit JSON patch, and browser E2E.
- Result: PASS
- Commit:
- Command: `rg -n 'transport config|加载函数|初始化阶段通过 重放|重放 add_label' docs/ssot/runtime_semantics_modeltable_driven.md docs/user-guide/modeltable_user_guide.md docs/iterations/0363-ui-egress-bus-init-contract/plan.md docs/iterations/0363-ui-egress-bus-init-contract/resolution.md`
- Key output: no matches for forbidden startup wording.
- Result: PASS
- Commit:
- Command: Stage 4 review by sub-agent `019e0c80-0dbb-7a90-b902-63fc07fe5a37`
- Key output: `Decision: APPROVED`; findings none; open questions none; verification gaps none.
- Result: PASS
- Commit:

### Step 5

- Command: `git diff --check`
- Key output: whitespace check PASS.
- Result: PASS
- Commit:
- Command: `rg -n '[F]IXED_PENDING|^(status: [i]n_progress|- Command: [p]ending|- Key output: [p]ending|- Result: [p]ending|- \\[ \\])' docs/iterations/0363-ui-egress-bus-init-contract/runlog.md docs/ITERATIONS.md`
- Key output: no pending placeholders remain in the 0363 runlog or iteration index.
- Result: PASS
- Commit:
- Command: `rg -n '0363-ui-egress-bus-init-contract.*Completed' docs/ITERATIONS.md`
- Key output: 0363 iteration row is marked `Completed`.
- Result: PASS
- Commit:
- Command: Final review by sub-agent `019e0c80-0dbb-7a90-b902-63fc07fe5a37`
- Key output: `Decision: CHANGE_REQUESTED`; finding: Stage 2 still had a pending-review result marker. Fixed by changing that intermediate result to `FIXED` while retaining the later approved re-review evidence.
- Result: FIXED
- Commit:
- Command: Final re-review by sub-agent `019e0c80-0dbb-7a90-b902-63fc07fe5a37`
- Key output: `Decision: APPROVED`; findings none; open questions none; verification gaps none.
- Result: PASS
- Commit:

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed; no 0363-specific edit needed
- [x] `docs/ssot/pin_connection_contract_v2.md` reviewed
- [x] `docs/ssot/label_type_registry.md` reviewed
- [x] `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` reviewed
