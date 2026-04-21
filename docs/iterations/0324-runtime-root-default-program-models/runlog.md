---
title: "0324 — runtime-root-default-program-models Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-04-21
source: ai
iteration_id: 0324-runtime-root-default-program-models
id: 0324-runtime-root-default-program-models
phase: phase4
---

# 0324 — runtime-root-default-program-models Runlog

## Environment

- Date: 2026-04-21
- Branch: `dev_0324-runtime-root-default-program-models`
- Runtime: phase4 completed 2026-04-21; based on dev HEAD 8e11c26 (0323 phase3 merged + hotfix)

## Planning Record

### Record 1 — Initial (2026-04-21)

- Inputs reviewed:
  - `docs/iterations/0323-modeltable-rw-permission-spec/resolution.md`
  - `docs/iterations/0323-modeltable-rw-permission-spec/runlog.md`（含 0323+3 后续延后项）
  - `packages/worker-base/src/runtime.mjs` 当前 `_seedDefaultHelperScaffold` / `_defaultOwnerMaterializeCode` / `createModel`
  - memory `project_0323_implementation_roadmap.md`
- Locked conclusions:
  - 三程序 = mt_write / mt_bus_receive / mt_bus_send（0323 正式命名）
  - Tier 2 source = `default_table_programs.json`
  - Tier 1 机制 = `_seedDefaultRootScaffold`（新增）
  - Helper 完全废弃（覆盖 0323 spec "model.single 保留 helper" 条款）
  - 不允许兼容层

## Review Gate Record

### Review 1 — 2026-04-21 (BATCH_APPROVED)

- Iteration ID: `0324-runtime-root-default-program-models`
- Review Date: 2026-04-21
- Review Type: User + Sub-agent batch review
- Review Index: 1
- Decision: **Approved**
- Notes: 本迭代在 0324/0325/0326/0327/0319 batch review 中得到 APPROVED；sub-agent 确认 helper-elimination override 已在 plan.md Invariants 显式记录

## Execution Records

### Step 1 — 契约测试

- Command: `node scripts/tests/test_0324_root_scaffold.mjs`
- Initial key output: `0 passed, 4 failed out of 4` (TDD 预期全 FAIL)
- After implementation: `4 passed, 0 failed out of 4`
- Result: PASS
- Commit: 随 Step 3/5 合入（phase3 single commit）

### Step 2 — `default_table_programs.json`

- File: `packages/worker-base/system-models/default_table_programs.json` (新增)
- Key content:
  - 9 records: 3 `func.js` + 3 `pin.in` (`mt_*_in`) + 3 `pin.connect.label` (`mt_*_wiring`)
  - mt_write: 完整实现（接收 `{op:'write'|'remove', records:[...]}`，遍历 records 用 ctx.writeLabel/rmLabel 落盘，返回 `{status, applied|removed}`）
  - mt_bus_receive / mt_bus_send: `return;` 骨架（业务由 0326 填）
- Result: PASS (加载 + 契约 test case 4 `default_table_programs_json_is_source_of_truth` 通过)
- Commit: 随 Step 3/5 合入

### Step 3 — runtime `_seedDefaultRootScaffold` + 删 helper

- Files:
  - `packages/worker-base/src/runtime.mjs`
    - 新增 `_seedDefaultRootScaffold(model)` — 加载 `default_table_programs.json`（首次调用 lazy cache），对 `model.id >= 0` apply records 到 `(0,0,0)`（幂等）
    - 新增 `_loadDefaultTableProgramsJson()` — 同步 readFileSync + JSON.parse，失败写 eventLog
    - 删除 `_seedDefaultHelperScaffold` 全函数
    - 删除 `_defaultOwnerMaterializeCode` 全函数
    - `createModel` 调用改为 `_seedDefaultRootScaffold(model)`
    - 构造器 Model 0 创建后追加 `this._seedDefaultRootScaffold(root)`
  - 新增 top-level import: `readFileSync` / `fileURLToPath`; 新增常量 `DEFAULT_TABLE_PROGRAMS_URL`
- Verification:
  - `grep "_seedDefaultHelperScaffold\|_defaultOwnerMaterializeCode" packages/worker-base/src/` → 0 results (helper elimination 完成)
  - `node scripts/tests/test_0324_root_scaffold.mjs` → 4 passed
- Result: PASS
- Commit: 随 Step 5 合入

### Step 4 — apply_records 调用方迁移

- Files:
  - `scripts/tests/test_0322_imported_host_egress_server_flow.mjs` — handle_submit 从 `return {op:'apply_records', records:[...]}` 改为直接本 cell `ctx.writeLabel` (handle_submit 本身在 root，所有目标也在 root，等价)
  - `scripts/tests/test_0322_imported_host_egress_contract.mjs` — 同上
  - `scripts/tests/test_0321_imported_host_ingress_server_flow.mjs` — handle_submit 在 (2,2,0) 改为 `return { op: 'write', records: [...] }`；fixture 的 `submit_owner_route` 改名为 `mt_write_dispatch_route` 并改 wiring 把 handle_submit:out 路由到 (2,2,0) `mt_write_req` (pin.out)；`root_routes` 改为 `[2,2,0, mt_write_req] → [[0,0,0, mt_write_in]]`（正式 0323 §5.3b "用户程序 pin.out → pin.connect.cell → (0,0,0) mt_write:in" 路径）
- Verification: 0321/0322 contract + server_flow 全绿
- Result: PASS
- Commit: 随 Step 5 合入

### Step 5 — 回归 + docs + runlog

- Commands:
  - `node scripts/tests/test_0321_imported_host_ingress_contract.mjs` → **3 passed, 0 failed**
  - `node scripts/tests/test_0321_imported_host_ingress_server_flow.mjs` → **1 passed, 0 failed**
  - `node scripts/tests/test_0322_imported_host_egress_contract.mjs` → **2 passed, 0 failed**
  - `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs` → **1 passed, 0 failed**
  - `node scripts/tests/test_0322_runtime_bus_out_cleanup.mjs` → **3 passed, 0 failed**
  - `node scripts/tests/test_0324_root_scaffold.mjs` → **4 passed, 0 failed**
  - `node scripts/tests/test_bus_in_out.mjs` → **7 passed, 0 failed**
  - Total: **21/21 PASS**
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs` → `without_frontmatter: 0 / missing_required: 0 / bare_md_paths: 0` PASS
- Docs:
  - runtime_semantics §5.2f / §5.2g 的 0323 内容已含 "helper 仅 model.single 保留" 条款；本迭代 helper 全面废弃是对该条款的**实装层覆盖**，不再回写 docs（覆盖决策已在 0324 plan.md Invariants 显式记录 + 0323 runlog "已知延后项" 第 6 条交叉标注）
  - handover dam-worker-guide：三程序的行为层说明可由 0326 填业务时统一收口；本迭代仅 runtime seed 机制，不改 handover
- Result: PASS
- Commit: 即将 land 到本分支

## Docs Updated

- [x] `packages/worker-base/system-models/default_table_programs.json` — 新增 Tier 2 source
- [x] `packages/worker-base/src/runtime.mjs` — _seedDefaultRootScaffold 新增；helper 2 函数完全删除
- [x] 0321 / 0322 test fixture handle_submit 迁移
- [-] `docs/ssot/runtime_semantics_modeltable_driven.md` — 不改（0323 已含规约，0324 是实装）
- [-] `docs/ssot/label_type_registry.md` — 不改（无新 label type）
- [-] `docs/handover/dam-worker-guide.md` — 不改（等 0326 业务层统一收口）
