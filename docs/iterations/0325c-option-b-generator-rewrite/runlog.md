---
title: "0325c — option-b-generator-rewrite Runlog"
doc_type: iteration-runlog
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0325c-option-b-generator-rewrite
id: 0325c-option-b-generator-rewrite
phase: phase1
---

# 0325c — option-b-generator-rewrite Runlog

## Environment

- Date: 2026-04-21
- Branch: `dev_0325c-option-b-generator-rewrite`
- Base: 分支起点 = `dev_0325b-legacy-system-models-ctx-migration` HEAD `d26b82b`（含 templates V1N 迁移 + Option B 清单）
- Runtime: phase1 planning; phase3 执行待 phase2 Approved

## Planning Record

### Record 1 — Initial (2026-04-21)

- Trigger: 0325b 在 phase3 执行中 sub-agent 第二次 review 发现架构误判（programEngine ctx 分离 leaky / Bucket C 重分类 / 算术），需要独立 iteration 做 Option B 实施
- Inputs reviewed:
  - 0325b runlog Step 5（二次 REJECT 后的 Option B 清单）
  - 0325 runtime V1N 基础（commit 7b4e269）
  - 0324 mt_write + default_table_programs.json
  - memory `project_0323_implementation_roadmap.md`
- Locked conclusions:
  - 纯 Tier 2 迁移，不改 runtime.mjs
  - 3 类目标：owner_materializer 生成器 / legacy forward funcs / Bucket C handler
  - 每类配合 shared bucket_c_cell_routes + V1N.table 规则
  - 0325 + 0325b + 0325c 三分支 triple-merge 到 dev

## Review Gate Record

### Review 1 — pending

- Iteration ID: `0325c-option-b-generator-rewrite`
- Review Date: pending
- Review Type: User + Sub-agent
- Review Index: 1
- Decision: pending
- Notes: 本迭代作为 0325 / 0325b 的完成补齐；phase1 docs 经 sub-agent review 给出意见，phase2 Approve 与否由 user 最终裁决

## Execution Records

### Step 1 — 契约测试

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 2 — 重写 ensureGenericOwnerMaterializer + ensureHomeOwnerMaterializer

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 3 — 迁移 workspace_positive_models.json legacy forward funcs

- Decision pre-step（触发路径裁决 + scope 扩展）:
  - `forward_workspace_filltable_submit_from_model0`: runtime entry = `ws_filltable_submit_wiring` pin.connect.label (workspace_positive_models.json 原 3576-3591); programEngine entry = `server.mjs:3840` 通用 egressFunc（Model 1010 dualBusConfig.model0_egress_func）→ **dual-route** → 降级 programEngine-only
  - `forward_matrix_phase1_send_from_model0`: runtime = `matrix_phase1_submit_wiring` (workspace_positive_models.json 原 12857-12872); programEngine = server.mjs:3840（Model 1020 dualBusConfig）→ **dual-route** → 降级 programEngine-only
  - `forward_model100_submit_from_model0`: runtime grep `(func, forward_model100_submit_from_model0:in)` 0 命中; programEngine = server.mjs:3840 + 3863 → **programEngine-only** → 不动
  - **Scope 扩展说明（per sub-agent MEDIUM 建议）**：Bucket B Model 100 `owner_materialize` (test_model_100_ui.json，runtime pin.connect.label `owner_route` 触发) 一并迁移到 V1N.table.addLabel/removeLabel；越界合理，因该函数若保留 ctx.* 在 post-0325 runtime ctx 会抛错，属已存在的 latent bug，顺手修复
  - **SC #7 豁免清单补录（per sub-agent MEDIUM 建议）**：plan.md SC #7 原豁免仅列 `server.mjs:3042-3080` + `server.mjs:1589-1609`；Step 3 迁移后补录如下 programEngine-only 代码进入豁免范围（runtime 入口已断，仅 programEngine ctx 执行）：
    - `packages/worker-base/system-models/workspace_positive_models.json` 里 k=`forward_workspace_filltable_submit_from_model0` 的 func.js body
    - `packages/worker-base/system-models/workspace_positive_models.json` 里 k=`forward_matrix_phase1_send_from_model0` 的 func.js body
    - `packages/worker-base/system-models/test_model_100_ui.json` 里 k=`forward_model100_submit_from_model0` 的 func.js body
- Command:
  - `node scripts/tests/test_0325c_generator_rewrite.mjs`
  - `node scripts/tests/test_0324_root_scaffold.mjs`
  - `node scripts/tests/test_0325_{v1n_api_shape,cross_model_read_denied,selfcell_write_guard}.mjs`
- Key output:
  - `test_0325c_generator_rewrite.mjs`: 5/7 PASS（tests 4/5 Bucket C 留 Step 4）
  - 0324/0325 regression 全 PASS
- Result: PASS（Step 3 目标达成；Step 4 待实施）
- Commit: `12c0df9`

### Step 4 — Bucket C handler 实装（mt_write_req + shared bucket_c_cell_routes）

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 5 — 全量回归 + grep 清零

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 6 — docs + runlog

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 7 — Merge 三分支到 dev

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

## Docs Updated

- [ ] `docs/ssot/host_ctx_api.md` §7 — 0325c owner_materializer + legacy forward 全 V1N 化
- [ ] `docs/ITERATIONS.md` — 0325c Completed
