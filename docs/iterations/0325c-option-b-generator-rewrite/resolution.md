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
4. 实装 Bucket C handler 的 mt_write_req 路径 + 本模型 root shared bucket_c_cell_routes
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
  - `shared_bucket_c_cell_routes_label_exists_per_model`: 每个含 Bucket C handler 的模型 (0,0,0) 有且仅有一个 `bucket_c_cell_routes` pin.connect.cell label 聚合所有 C-bucket 源（与同名 `root_routes`.t=`pin.connect.label` 不冲突）
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
- Decision pre-step（必须在改 code 之前执行）:
  - 对每个 forward grep 出所有触发点:
    - runtime 入口: `pin.connect.label` 连到该 forward label 名
    - programEngine 入口: `server.mjs` / `programEngine` 里的直接调用或 wiring
  - 按 plan.md Invariants 分类为 runtime-only / programEngine-only / dual-route 三种之一，结果写到 runlog Step 3
- Strategy（per 分类）:
  - **runtime-only**（code 里有 `ctx.writeLabel` 但 `ctx.sendMatrix` 无实际消费者）:
    - `ctx.writeLabel({model_id: 0, p: 0, r: 0, c: 0, k}, t, v)` → `V1N.addLabel(k, t, v)`
    - `ctx.writeLabel({model_id: 0, p!=0 || r!=0 || c!=0, k}, t, v)` → `V1N.table.addLabel(p, r, c, k, t, v)`
    - `ctx.getLabel(...)` → `V1N.readLabel(...)`（null-guard）
    - `ctx.rmLabel(...)` → `V1N.removeLabel(k)` 或 `V1N.table.removeLabel(p,r,c,k)`
    - **删除** `ctx.sendMatrix` 调用（该路径下无消费者，本就 dead code），不留兼容
  - **programEngine-only**（runtime pin.connect.label 无 wiring，仅 programEngine 触发）:
    - code 保留原样（含 `ctx.sendMatrix`）
    - 本迭代**不 touch** func body
    - 但若所在 cell 仍挂有 runtime pin.connect.label 且实际未被走通，则**移除该 pin.connect.label 源**以断歧义入口
  - **dual-route**（runtime + programEngine 并存触发）:
    - 拆成两个独立 func.js label:
      - `<orig>_rt`（runtime body）: V1N.table.addLabel 写 + 若必须触发 Matrix publish 则 `V1N.addLabel('mt_bus_send_req', 'pin.in', {...packet})` 写到本 cell 等待 0326 mt_bus_send 处理；本迭代若 mt_bus_send 未实装则**不追加此 packet**，仅保留 V1N 写部分
      - `<orig>_pe`（programEngine body）: 仅保留 `ctx.sendMatrix(packet)`
    - 调整 pin.connect.label wiring:
      - runtime 触发路径连到 `_rt`
      - programEngine 触发路径连到 `_pe`
    - **不保留原 label 名**（不为兼容留旧 code）
- Verification:
  - Step 1 `legacy_forward_func_uses_v1n_table` PASS
  - 整合回归（0321/0322/0324/0325）PASS
  - runlog Step 3 记录每个 forward 的分类裁决 + grep 证据
- Acceptance: 3 个 forward funcs 的 runtime-ctx 触发路径下 no throw；programEngine 触发路径（如仍保留）code 未破坏
- Rollback: revert workspace_positive_models.json

## Step 4 — Bucket C handler 实装（mt_write_req + shared bucket_c_cell_routes）

- Scope: 非 root 但写本模型跨 cell 的 handler
- Files:
  - `packages/worker-base/system-models/workspace_positive_models.json` (Model 1030 的 handle_slide_import_click / handle_slide_create_click 等)
- Label naming decision (committed):
  - 聚合 label 名 = `bucket_c_cell_routes`（**不**复用 `root_routes`）
  - 原因：`deploy/sys-v1ns/remote-worker/patches/*.json` 里已有同名 `root_routes`.t=`pin.connect.label` 不同语义标签；虽然不同 cell 的 label 在 (k,t) 维度技术合法，但重名易混淆 routing 调试，选用新名避坑
- Strategy:
  - handler code 里 `ctx.writeLabel({model_id: SELF, p, r, c, k}, t, v)` 其中 (p,r,c) ≠ handler 所在 cell → 构造 mt_write_req：
    ```js
    V1N.addLabel('mt_write_req', 'pin.in', { op: 'write', records: [{p, r, c, k, t, v}] });
    ```
  - 在本模型 (0,0,0) root 加或合并到 shared `bucket_c_cell_routes` pin.connect.cell label：
    - 若本模型 root 已有同名 `bucket_c_cell_routes`（同一模型的多 Bucket C handler 聚合复用），追加 entry `{from: [handlerP, handlerR, handlerC, 'mt_write_req'], to: [[0,0,0, 'mt_write_in']]}`
    - 若无，新增一个 `bucket_c_cell_routes` label，含所有 Bucket C handler 源 cell 的 entry
  - 命名冲突校验：迁移完后 grep 同模型同 cell 是否同时存在 `root_routes`.t=`pin.connect.label` 与 `bucket_c_cell_routes`.t=`pin.connect.cell`；若存在，在 runlog 登记共存关系
- Verification: Step 1 `handle_slide_import_click_uses_mt_write_req` + `shared_bucket_c_cell_routes_label_exists_per_model` PASS
- Acceptance: 所有 Bucket C handler 改走 mt_write_req；模型 root 有且仅一个 `bucket_c_cell_routes` 聚合；与既有 `root_routes` 不冲突
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
  - `grep -rn "ctx\.writeLabel\|ctx\.getLabel\|ctx\.rmLabel" packages/worker-base/system-models/ packages/ui-model-demo-server/server.mjs` — 除 programEngine 专属行段（`server.mjs:3042-3080` + `server.mjs:1589-1609`）其余 0
- Verification: 所有测试 PASS + grep 结果合规
- Acceptance: 回归全绿；0321/0322 server_flow 恢复 PASS

## Step 6 — docs + runlog

- Files:
  - `docs/iterations/0325c-option-b-generator-rewrite/runlog.md` — 填实
  - `docs/ITERATIONS.md` — 登记 0325c Completed
  - `docs/ssot/host_ctx_api.md` — §7 更新"0325c owner_materializer + legacy forward 全部 V1N 化"
- Verification: `obsidian_docs_audit` PASS

## Step 7 — Merge 0325 + 0325b + 0325c 到 dev（atomic batch）

- Semantics: 三分支 merge 视为**单个原子操作序列**；gate 只在 batch 完成后评估，不在中间 merge 之间评估（因 0325 单独 merge 会让 dev 暂时失去 workspace_positive_models.json 清理，属预期中间态，不触发 FAIL 判定）
- Pre-batch gate（执行 3 次 merge 之前必须满足）:
  - 三分支本地（尚未 merge）状态:
    - dev_0325 / dev_0325b / dev_0325c 各自 runlog 标 Completed 且记录真实 commit sha
    - 每个分支独立执行 full 回归（`0321/0322/0324/0325` 目标测试集 + 本分支新增测试）PASS
    - `grep -rn "ctx\.writeLabel\|ctx\.getLabel\|ctx\.rmLabel" packages/worker-base/ packages/ui-model-demo-server/server.mjs` 在 0325c HEAD 上除 plan.md SC #7 列明的两处 programEngine 专属行段（server.mjs:1589-1609 + 3042-3080）外返回 0
- Action（按依赖顺序 merge；中间不跑测试、不评估 gate）:
  - `git checkout dev`
  - `git merge --no-ff dev_0325-ctx-api-tightening-static-selfcell`
  - `git merge --no-ff dev_0325b-legacy-system-models-ctx-migration`
  - `git merge --no-ff dev_0325c-option-b-generator-rewrite`
- Post-batch gate（三次 merge 全部完成后立即评估）:
  - `0321/0322/0324/0325 + 0325c` 全套在 dev HEAD 上 PASS
  - `grep ctx.writeLabel packages/` 除 programEngine 专属（1589-1609 + 3042-3080）返回 0
  - 若 post-batch gate 任一 FAIL → `git revert -m 1` 三个 merge commits（逆序）恢复到 dev pre-batch HEAD
- Abort clause: 因 batch 语义，中间 merge 后即使 dev 测试临时 FAIL 也不立即 revert；只以 post-batch gate 为准

## Rollback（整 iteration 级别）

- 分支层面：0325c 不 merge 即未 landed
- Merge 后回退：`git revert -m 1 <merge-sha>` 连同 0325b + 0325 三个 merge commits；回到 dev HEAD 0324 时的 baseline
- 若单独 0325c 遇阻碍但 0325 + 0325b 值得 land：降级到"只 merge 0325 + 0325b，不 merge 0325c"（但 0321/0322 server_flow 仍 FAIL）— **不推荐**，违反"无兼容层"口径；优先完成 0325c
