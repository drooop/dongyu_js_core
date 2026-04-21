---
title: "0325c — option-b-generator-rewrite Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0325c-option-b-generator-rewrite
id: 0325c-option-b-generator-rewrite
phase: phase1
---

# 0325c — option-b-generator-rewrite Resolution

## Execution Strategy

1. 先写失败测试锁定三类迁移契约（owner_materialize / legacy forward / Bucket C handler）
2. 重写 server.mjs 两个 owner-materializer 生成器为 V1N.table 版本
3. 迁移 workspace_positive_models.json 的 legacy forward funcs（3 处）
4. 实装 Bucket C handler 的 mt_write_req 路径 + 本模型 root shared root_routes
5. 全量回归 + 确认 0321/0322 server_flow 恢复 PASS + grep 清零
6. 文档同步 + runlog + Step 7 三分支 merge 到 dev

## Step 1 — 契约测试

- Scope: 锁定 3 类迁移契约
- Files:
  - `scripts/tests/test_0325c_generator_rewrite.mjs`（新）
- Test cases:
  - `owner_materialize_generated_uses_v1n_table`: 调 `ensureGenericOwnerMaterializer(runtime, someModelId)` → 生成的 (0,0,0) `owner_materialize` func.js code 字符串不含 `ctx.writeLabel/getLabel/rmLabel`，含 `V1N.table.addLabel` 或 `V1N.table.removeLabel`
  - `owner_materialize_executes_cross_cell_write_via_v1n_table`: seed owner_materialize + 通过 pin.in 触发 → 观察 target cell 实际被 V1N.table 写入
  - `legacy_forward_func_uses_v1n_table`: workspace_positive_models.json 加载后 grep `forward_workspace_filltable_submit_from_model0` code 不含 `ctx.writeLabel`，含 `V1N.table.addLabel`（sendMatrix 允许保留因走 programEngine）
  - `handle_slide_import_click_uses_mt_write_req`: 触发 Model 1030 (2,4,0) click → 观察 Model 1030 (0,0,0) `slide_import_request` 被 mt_write 写入（经 shared root_routes 聚合）
  - `shared_root_routes_label_exists_per_model`: 每个含 Bucket C handler 的模型 (0,0,0) 有且仅有一个 `root_routes` pin.connect.cell label 聚合所有 C-bucket 源
- Verification: 所有 test 初始 FAIL
- Acceptance: 契约明确
- Rollback: 删测试文件

## Step 2 — 重写 ensureGenericOwnerMaterializer + ensureHomeOwnerMaterializer

- Scope: server.mjs 两个生成器函数的 code 输出
- Files:
  - `packages/ui-model-demo-server/server.mjs` (行 2133-2184)
- Strategy:
  - 识别当前生成的 code 模板里每一处 `ctx.writeLabel({model_id: targetModel, p, r, c, k}, t, v)` → 改为 `V1N.table.addLabel(p, r, c, k, t, v)`
  - `ctx.rmLabel` → `V1N.table.removeLabel(p, r, c, k)`
  - `ctx.getLabel({model_id: targetModel, p, r, c, k})` → `V1N.readLabel(p, r, c, k).v`（注意 null-guard）
  - 保留函数签名 (runtime, modelId) → 返回 bool
- Verification: Step 1 `owner_materialize_generated_uses_v1n_table` + `owner_materialize_executes_cross_cell_write_via_v1n_table` PASS
- Acceptance: 生成的 owner_materialize code 零 ctx.*；实际执行跨 cell 写到 target model 成功
- Rollback: revert server.mjs

## Step 3 — 迁移 workspace_positive_models.json legacy forward funcs

- Scope: 3 处 seed 的 forward func code 字符串迁移
- Files:
  - `packages/worker-base/system-models/workspace_positive_models.json`
- Targets:
  - `forward_workspace_filltable_submit_from_model0`（行 ~3587）
  - `forward_matrix_phase1_send_from_model0`
  - `forward_model100_submit_from_model0`
- Strategy:
  - func 在 Model 0 (0,0,0) root → 可用 V1N.table
  - code 里 `ctx.writeLabel({model_id: 0, p: 0, r: 0, c: 0, k})` → `V1N.addLabel(k, t, v)`（本 cell 写）
  - `ctx.writeLabel({model_id: 0, p!=0 || r!=0 || c!=0, k})` → `V1N.table.addLabel(p, r, c, k, t, v)`（跨 cell Model 0 内）
  - `ctx.writeLabel({model_id: 跨模型, ...})` → **这是 Bucket D**（跨模型），走 `V1N.addLabel` 写本 cell (Model 0 root) 某 mt_bus_send 请求；**或** 若纯 Matrix publish 则保留 `ctx.sendMatrix`（该函数只在 programEngine ctx 可用；注：如果 forward func 是 runtime-triggered，则需要把 sendMatrix 的跨模型写分离出去）
  - 具体逐函数决策在 phase3 执行时 per-function 处理
- Verification: Step 1 `legacy_forward_func_uses_v1n_table` PASS + 整合回归（0321/0322/0324/0325）PASS
- Acceptance: 3 个 forward funcs 的 runtime-ctx 触发路径下 no throw
- Rollback: revert workspace_positive_models.json

## Step 4 — Bucket C handler 实装（mt_write_req + shared root_routes）

- Scope: 非 root 但写本模型跨 cell 的 handler
- Files:
  - `packages/worker-base/system-models/workspace_positive_models.json` (Model 1030 的 handle_slide_import_click / handle_slide_create_click 等)
- Strategy:
  - handler code 里 `ctx.writeLabel({model_id: SELF, p, r, c, k}, t, v)` 其中 (p,r,c) ≠ handler 所在 cell → 构造 mt_write_req：
    ```js
    V1N.addLabel('mt_write_req', 'pin.in', { op: 'write', records: [{p, r, c, k, t, v}] });
    ```
  - 在本模型 (0,0,0) root 加或合并到 shared `root_routes` pin.connect.cell label：
    - 若模型 root 已有 `root_routes`（部分模型可能已有），追加 entry `{from: [handlerP, handlerR, handlerC, 'mt_write_req'], to: [[0,0,0, 'mt_write_in']]}`
    - 若无，新增一个 `root_routes` label，含所有 Bucket C handler 源 cell 的 entry
- Verification: Step 1 `handle_slide_import_click_uses_mt_write_req` + `shared_root_routes_label_exists_per_model` PASS
- Acceptance: 所有 Bucket C handler 改走 mt_write_req；模型 root 有且仅一个 `root_routes` 聚合
- Rollback: revert JSON 改动

## Step 5 — 全量回归 + grep 清零

- Commands:
  - `node scripts/tests/test_0325c_generator_rewrite.mjs`
  - `node scripts/tests/test_0321_imported_host_ingress_{contract,server_flow}.mjs`
  - `node scripts/tests/test_0322_imported_host_egress_{contract,server_flow}.mjs`
  - `node scripts/tests/test_0322_runtime_bus_out_cleanup.mjs`
  - `node scripts/tests/test_0324_root_scaffold.mjs`
  - `node scripts/tests/test_0325_{v1n_api_shape,cross_model_read_denied,selfcell_write_guard}.mjs`
  - `node scripts/tests/test_bus_in_out.mjs`
  - `grep -rn "ctx\.writeLabel\|ctx\.getLabel\|ctx\.rmLabel" packages/worker-base/system-models/ packages/ui-model-demo-server/server.mjs` — 除 programEngine 专属（server.mjs:3042-3080 + 1591-1608 忽略）其余 0
- Verification: 所有测试 PASS + grep 结果合规
- Acceptance: 回归全绿；0321/0322 server_flow 恢复 PASS

## Step 6 — docs + runlog

- Files:
  - `docs/iterations/0325c-option-b-generator-rewrite/runlog.md` — 填实
  - `docs/ITERATIONS.md` — 登记 0325c Completed
  - `docs/ssot/host_ctx_api.md` — §7 更新"0325c owner_materializer + legacy forward 全部 V1N 化"
- Verification: `obsidian_docs_audit` PASS

## Step 7 — Merge 0325 + 0325b + 0325c 到 dev

- Action: 按依赖顺序 merge
  - `git checkout dev`
  - `git merge --no-ff dev_0325-ctx-api-tightening-static-selfcell`
  - `git merge --no-ff dev_0325b-legacy-system-models-ctx-migration`
  - `git merge --no-ff dev_0325c-option-b-generator-rewrite`
- Merge gate conditions（ALL 必须）:
  - 0321/0322/0324/0325 + 0325c 全绿
  - `grep ctx.writeLabel packages/` 除 programEngine 专属返回 0
  - 三分支 runlog 均标 Completed + 有真实 commit sha
- Abort clause: 若 merge 后 dev 任何测试 FAIL，revert 三个 merge commits

## Rollback（整 iteration 级别）

- 分支层面：0325c 不 merge 即未 landed
- Merge 后回退：`git revert -m 1 <merge-sha>` 连同 0325b + 0325 三个 merge commits；回到 dev HEAD 0324 时的 baseline
- 若单独 0325c 遇阻碍但 0325 + 0325b 值得 land：降级到"只 merge 0325 + 0325b，不 merge 0325c"（但 0321/0322 server_flow 仍 FAIL）— **不推荐**，违反"无兼容层"口径；优先完成 0325c
