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

## Review Gate Record

### Review 1 — AI-assisted

- Iteration ID: `0298-pin-contract-cleanup`
- Review Date: `2026-04-06`
- Review Type: `AI-assisted`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 范围已经被用户提前锁死，且 planning 文档没有再向外膨胀
  - plan / resolution 已明确：
    - runtime compat handler 退场
    - Home / ui-side-worker / LLM prompt / `CLAUDE.md` 各自的 cleanup 责任
    - deterministic tests 与本地浏览器回归要求
  - 未发现阻塞项，可进入 Phase 3

## Phase 3 Records

### 2026-04-06 — Step 1 Runtime Compat Removal

**Implemented**
- 删除了 `runtime.mjs` 中 4 处旧 pin compat handler：
  - `pin.table.in`
  - `pin.table.out`
  - `pin.single.in`
  - `pin.single.out`

**Deterministic tests**
- `node scripts/tests/test_0298_pin_cleanup_contract.mjs` → PASS
- `node scripts/tests/test_0158_new_label_types.mjs` → PASS
- `node scripts/tests/test_0142_integration.mjs` → PASS
- `node scripts/tests/test_0294_runtime_pin_contract.mjs` → PASS

### 2026-04-06 — Step 2 Scoped Patch / Config Cleanup

**Implemented**
- `intent_handlers_home.json`
  - 9 个 `home_*` input 改为 `pin.in`
  - `handle_home_emit_owner_requests` 输出改为 `pin.out`
- `home_catalog_ui.json`
  - 调试 CRUD 类型下拉移除：
    - `pin.table.in`
    - `pin.table.out`
    - `pin.single.in`
    - `pin.single.out`
- `10_ui_side_worker_demo.json`
  - `owner_request` 改为 `pin.in`
  - `ui_apply_snapshot_delta` 输出改为 `pin.out`
- `llm_cognition_config.json`
  - prompt 移除旧 local pin family 说明
  - 改为：
    - `pin.in / pin.out`
    - `pin.bus.*`

**Deterministic tests**
- `node scripts/tests/test_0249_home_crud_pin_migration_contract.mjs` → PASS
- `node scripts/tests/test_0198_ui_side_worker_patch_first_contract.mjs` → PASS
- `node scripts/tests/test_0198_ui_side_worker_followup_contract.mjs` → PASS
- `node scripts/tests/test_0170_bun_and_filltable_prompt_contract.mjs` → PASS
- `node scripts/tests/test_0248_cross_model_pin_owner_materialization_contract.mjs` → PASS

### 2026-04-06 — Step 3 CLAUDE Sync / Local Verification

**Implemented**
- `CLAUDE.md`
  - `CAPABILITY_TIERS` 中移除 `pin.model.* / pin.log.model.*`
  - `PIN_SYSTEM` 改为只保留：
    - `pin.in / pin.out`
    - `pin.bus.in / pin.bus.out`
    - `pin.log.in / pin.log.out`
    - `pin.log.bus.in / pin.log.bus.out`

**Deterministic verification**
- `node scripts/tests/test_0298_pin_cleanup_contract.mjs` → PASS
- `node scripts/ops/obsidian_docs_audit.mjs --root docs` → PASS

**Local deploy / browser verification**
- `bash scripts/ops/check_runtime_baseline.sh` → PASS
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` → PASS
- `bash scripts/ops/check_runtime_baseline.sh` → PASS

**Browser facts**
- 颜色生成器：
  - Workspace 中点击 `Generate Color`
  - 颜色值从 `#cb5bd0` 变为 `#091206`
- `0270 Fill-Table Workspace UI`：
  - 输入改为 `0298 cleanup verify`
  - 点击 `Confirm`
  - 色值从 `#1d7c5b` 变为 `#8d6c4e`
- `Static`：
  - `选择文件` 可弹出 file chooser
  - 点击 `Upload` 后 `/p/it0294-static/` 对应条目更新时间变化
  - 直接访问 `/p/it0294-static/` 返回静态页面
- 首页 CRUD：
  - `+ Add Label` 打开创建对话框
  - 类型下拉中不再出现 `pin.table.* / pin.single.*`
  - 创建临时 label `it0298_cleanup_tmp` 成功
  - 随后通过首页 `Delete` 删除成功

### Review 2 — AI Self-Verification

- Iteration ID: `0298-pin-contract-cleanup`
- Review Date: `2026-04-06`
- Review Type: `AI-assisted`
- Review Index: `2`
- Decision: **PASS**
- Notes:
  - cleanup 只动了锁定范围，没有扩到其它残留
  - `0294` 主链和页面回归均保持可用

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed (no change)
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed (no change)
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed (no change)
- [x] `CLAUDE.md` updated
