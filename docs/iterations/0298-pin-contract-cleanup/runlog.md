---
title: "0298 — pin-contract-cleanup Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-06
source: ai
iteration_id: 0298-pin-contract-cleanup
id: 0298-pin-contract-cleanup
phase: phase1
---

# 0298 — pin-contract-cleanup Runlog

## Environment

- Date: `2026-04-06`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Branch: `dev_0298-pin-contract-cleanup`
- Runtime: planning only

## Intake Record

### Record 1

- User direction:
  - cleanup iteration 紧跟 `0296`
  - 已知范围固定为：
    - `packages/worker-base/src/runtime.mjs`
    - `packages/worker-base/system-models/intent_handlers_home.json`
    - `packages/worker-base/system-models/home_catalog_ui.json`
    - `deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json`
    - `packages/worker-base/system-models/llm_cognition_config.json`
    - `CLAUDE.md` `PIN_SYSTEM`
- Result:
  - 采用空闲编号 `0298`
  - 已创建 skeleton

## Planning Record

### Record 2

- Context scan:
  - `runtime.mjs` 当前仍保留 4 处 compat handler：
    - `pin.table.in`
    - `pin.table.out`
    - `pin.single.in`
    - `pin.single.out`
  - `intent_handlers_home.json` 当前仍有 9 个 `pin.table.in`，以及 1 个 `pin.table.out`
  - `home_catalog_ui.json` 当前下拉仍暴露：
    - `pin.table.in`
    - `pin.table.out`
    - `pin.single.in`
    - `pin.single.out`
  - `10_ui_side_worker_demo.json` 当前仍有：
    - `pin.single.in`
    - `pin.table.out`
  - `llm_cognition_config.json` 当前 prompt 仍把旧 pin family 写给 LLM
  - `CLAUDE.md` 当前 `PIN_SYSTEM` 仍列出 `pin.model.*`
- Planning conclusion:
  - `0298` 适合做 scoped cleanup
  - 不需要重新设计 pin 合同

## Docs Updated

- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
