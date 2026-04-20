---
title: "0324 — runtime-root-default-program-models Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0324-runtime-root-default-program-models
id: 0324-runtime-root-default-program-models
phase: phase1
---

# 0324 — runtime-root-default-program-models Resolution

## Execution Strategy

1. 写失败测试锁定三程序 seed 契约 + helper 已移除 + fixture 新路径
2. 新增 `default_table_programs.json` (Tier 2 source) 定义 mt_write / mt_bus_receive / mt_bus_send 默认 code
3. runtime.mjs 新增 `_seedDefaultRootScaffold` + 删除 `_seedDefaultHelperScaffold` / `_defaultOwnerMaterializeCode`
4. 同步修所有 apply_records 调用方（0322 forward func + imported app handle_submit fixture）
5. 全量回归 + docs 同步 + runlog

## Step 1 — 契约测试

- Scope: 锁定 0324 所有契约
- Files:
  - `scripts/tests/test_0324_root_scaffold.mjs`（新）
  - `scripts/tests/test_0322_imported_host_egress_server_flow.mjs`（改 fixture）
  - `scripts/tests/test_0322_imported_host_egress_contract.mjs`（改 fixture）
- Test cases:
  - `mt_programs_seeded_on_model_table_create`: 新模型创建后 `(0,0,0)` 有三 func.js + 各自 `:in/:out` pin + pin.connect.label 接线
  - `helper_scaffold_not_seeded`: `(0,1,0)` 不再含 `owner_apply / owner_materialize` 等
  - `mt_write_executes_cross_cell_write_request`: 从非本 cell 发 `{op:'write', records:[{p,r,c,k,t,v}]}` 到 `(0,0,0) mt_write:in`，验证实际落到目标 cell
  - `default_table_programs_json_is_source_of_truth`: 修改 JSON 代码字符串后再 seed 一个新模型，行为变化
- Verification: 所有新测试初始 FAIL（runtime 未改）
- Acceptance: 契约明确
- Rollback: 删测试文件

## Step 2 — Tier 2：`default_table_programs.json`

- Scope: 三程序默认 code 的 JSON patch source
- Files:
  - `packages/worker-base/system-models/default_table_programs.json`（新）
- Content outline:
  - Array of label patches (mt.v0 format) for (0,0,0) 的三个 func.js + 各自 pin.in/pin.out + pin.connect.label 接线
  - `mt_write` code 字符串：
    - 读 `(0,0,0) mt_write:in` 的 value（形态 `{op:'write'|'remove', records:[{p,r,c,k,t,v}...]}`）
    - 对每 record：`ctx.writeLabel({model_id: SELF_MODEL_ID, p, r, c, k}, t, v)`（mt_write 作为 model-privileged 程序，**暂时**用 ctx.writeLabel 跨 cell 写；0325 替换为 V1N 面时保留此 privileged 能力作为 V1N 内部实现）
    - 返回写结果结构 `{status:'ok', applied: n}` 经 `:out`
  - `mt_bus_receive` / `mt_bus_send` code 字符串：本迭代**仅骨架**（function body 为 `return;` 或最小 passthrough），业务由 0326 填
- Verification: Step 1 `default_table_programs_json_is_source_of_truth` PASS
- Acceptance: runtime.mjs 无三程序 code 字符串硬编码
- Rollback: 删 JSON 文件

## Step 3 — Tier 1：runtime `_seedDefaultRootScaffold`

- Scope: 种植机制 + helper 移除
- Files:
  - `packages/worker-base/src/runtime.mjs`
- Changes:
  - 新增 `_seedDefaultRootScaffold(model)`：
    - 若 `model.id !== 0 && model.id < 0` → 跳过（负数系统模型自行 seed）
    - Load `default_table_programs.json` (一次性 cache 到 runtime)
    - 把 patch 里每条 label apply 到 `(0,0,0)` — 仅在该 label key 不存在时 apply（幂等）
  - `createModel({id, name, type})` 调用最后：
    - 若 `id > 0` 或 `id === 0` → `_seedDefaultRootScaffold(model)`
    - 不再调 `_seedDefaultHelperScaffold`
  - 删除：
    - 函数 `_seedDefaultHelperScaffold`（全函数）
    - 函数 `_defaultOwnerMaterializeCode`（全函数）
- Verification: Step 1 `mt_programs_seeded_on_model_table_create` + `helper_scaffold_not_seeded` PASS
- Acceptance: 新正数模型只在 `(0,0,0)` 有三程序；`(0,1,0)` 清空
- Rollback: 恢复 runtime.mjs

## Step 4 — 修所有 apply_records 调用方

- Scope: 0322 测试 fixture + server.mjs forward func + 其他 system function JSON
- Files (预估):
  - `scripts/tests/test_0322_imported_host_egress_server_flow.mjs` 的 fixture `handle_submit` 代码字符串：
    - 从 `return { op:'apply_records', records:[...] }` 改为：
      - 本 cell 写（input_text / last_submit_payload / status_text 都在 (0,0,0)，handle_submit 可能也在 (0,0,0)）→ 视具体 cell 位置
      - 如果 handle_submit 在 (0,0,0)：用 `ctx.writeLabel({model_id: SELF, p:0, r:0, c:0, k:'status_text'}, 'str', 'payload_ready')` 直接写
      - `submit pin.out` 写法同上
      - 如果要改其他 cell：发请求给 `(0,0,0) mt_write:in`
  - `scripts/tests/test_0322_imported_host_egress_contract.mjs` fixture 同步改
  - `packages/ui-model-demo-server/server.mjs` 的 `buildImportedHostEgressForwardCode`：
    - forward func 在 Model -10 运行（programEngine.executeFunction ctx）— 它对 Model 0 `(0,0,0)` 的写（busOutKey / egressLabel reset）属跨 cell 写；本迭代继续用 ctx.writeLabel（0325 改 V1N 面）
    - 但若 forward func 想改 imported root 的 status_text（目前是 err 场景），需改为"发请求给 imported root `(0,0,0) mt_write:in`"
  - `packages/worker-base/system-models/*.json`：grep 出所有使用 `apply_records` 或 `owner_materialize` 模式的 JSON，改写
- Verification: 全量 0321 / 0322 回归 PASS
- Acceptance: grep `apply_records\|owner_materialize\|owner_apply_route` 返回 0（除 iteration docs 中提及）
- Rollback: revert commit

## Step 5 — 回归 + docs + runlog

- Commands:
  - `node scripts/tests/test_0324_root_scaffold.mjs`
  - `node scripts/tests/test_0322_imported_host_egress_{contract,server_flow}.mjs`
  - `node scripts/tests/test_0321_imported_host_ingress_{contract,server_flow}.mjs`
  - `node scripts/tests/test_0322_runtime_bus_out_cleanup.mjs`
  - `node scripts/tests/test_bus_in_out.mjs`
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Files:
  - `docs/ssot/runtime_semantics_modeltable_driven.md` — §5.2f/§5.2g 中 "(0,1,0) helper scaffold" 字段补 "(0324) 已移除"；§5.2g 补 `default_table_programs.json` 路径与 seed 时机
  - `docs/handover/dam-worker-guide.md` — 三程序 seed 机制说明；helper 完全废弃提示
  - `docs/iterations/0324-*/runlog.md` — 填实
- Verification: 全绿 + audit PASS
- Acceptance: 0324 完成
