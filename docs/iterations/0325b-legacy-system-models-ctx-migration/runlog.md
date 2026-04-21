---
title: "0325b — legacy-system-models-ctx-migration Runlog"
doc_type: iteration-runlog
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0325b-legacy-system-models-ctx-migration
id: 0325b-legacy-system-models-ctx-migration
phase: phase1
---

# 0325b — legacy-system-models-ctx-migration Runlog

## Environment

- Date: 2026-04-21
- Branch: `dev_0325b-legacy-system-models-ctx-migration`
- Base: 分支起点 = `dev_0325-ctx-api-tightening-static-selfcell` HEAD `7b4e269` (0325 partial)
- Runtime: phase1 planning; execution pending phase2 Approved

## Planning Record

### Record 1 — Initial (2026-04-21)

- Trigger: 0325 phase3 执行中发现 plan scope 严重低估 — `ctx.writeLabel / ctx.getLabel / ctx.rmLabel` 在 system-models JSON 里还有 30+ 处跨模型/跨 cell 调用，全部迁移远超原 0325 单迭代估计
- 用户 2026-04-21 决策 C：保留 0325 部分进展不 merge；开 0325b 专项 legacy migration；0325 + 0325b 作为一组整体 merge 到 dev
- Inputs reviewed:
  - 0324 code-review report — M1 `ensureGenericOwnerMaterializer` / `ensureHomeOwnerMaterializer`
  - 0325 runlog / commit 7b4e269 — runtime ctx V1N 化已完成，fixture 迁移已完成
  - grep 结果：`workspace_positive_models.json` 14 处；`intent_handlers_*.json` 约 20 处；`cognition_handlers.json` + `test_model_100_*.json` + `templates/*.json` 散布
  - memory `project_0323_implementation_roadmap.md`
- Locked conclusions:
  - 迁移规则按 bucket A/B/C/D/E/F 分类
  - D/F 跨模型 case 有可能要跨 0326 协调（`mt_bus_receive` 业务未填）
  - 0325 + 0325b 合一组 merge；dev baseline 不出现 partial 状态

## Review Gate Record

### Review 1 — pending

- Iteration ID: `0325b-legacy-system-models-ctx-migration`
- Review Date: pending
- Review Type: User
- Review Index: 1
- Decision: pending
- Notes: 本 iteration 作为 0325 的延伸；phase2 review 与 0325b 一起或随后进行

## Execution Records

### Step 1 — Migration 清单与分类（2026-04-21 执行）

- Command:
  - `grep -rn "ctx\\.writeLabel\\|ctx\\.getLabel\\|ctx\\.rmLabel" packages/worker-base/system-models/ packages/ui-model-demo-server/server.mjs | grep -v legacy`
- Total hits: **82**（sub-agent phase2 review 精确统计）
- Already migrated (commit `f08aeb4`): **15 hits** in templates/data_{array,queue,stack}_v0.json (bucket B/E)
- Remaining: **67 hits across 17 files**

#### Per-file inventory of remaining 67 hits

| File | Hits | Dominant buckets | Iteration disposition |
|---|---|---|---|
| `packages/ui-model-demo-server/server.mjs` | 17 | A/B/C + **M1 code generators**（lines 1591-1608 forward func / 2060-2184 ensureGenericOwnerMaterializer / 2774-2803 ensureHomeOwnerMaterializer） | Step 5 in 0325b phase3 (代码改写) |
| `packages/worker-base/system-models/workspace_positive_models.json` | 14 | D 跨模型写（大量 handler 跨写 model 100 / -1 / 0 / -10）+ F 跨模型读 + G mailbox | 混合：D/F/G 列入延后清单；A/B/C/E 候选 per-case 迁移 |
| `packages/worker-base/system-models/workspace_catalog_ui.json` | 4 | 待 per-case 鉴定 | per-case 迁移 |
| `packages/worker-base/system-models/test_model_100_ui.json` | 4 | 含 mailbox 读 (G) + 本模型写 (A/B) | 混合：G 跳过；A/B 迁移 |
| `packages/worker-base/system-models/intent_handlers_three_scene.json` | 4 | **G（mailbox -1 读）+ D（写 -X 系统模型）+ D（跨正数模型）混合** | 主要 G/D 延后；极少 self-model 迁移 |
| `packages/worker-base/system-models/system_models.json` | 3 | 待 per-case 鉴定 | per-case |
| `packages/worker-base/system-models/intent_handlers_ws.json` | 3 | G/D 混合 | 主要延后 |
| `packages/worker-base/system-models/intent_handlers_static.json` | 3 | G/D 混合 | 主要延后 |
| `packages/worker-base/system-models/intent_handlers_matrix_debug.json` | 3 | G/D 混合 | 主要延后 |
| `packages/worker-base/system-models/intent_handlers_docs.json` | 3 | **G（读 -1 mailbox）+ D（写 -2 UI state）** | 全部延后 0326 |
| `packages/worker-base/system-models/intent_handlers_prompt_filltable.json` | 2 | G/D 混合 | 主要延后 |
| `packages/worker-base/system-models/intent_handlers_home.json` | 2 | **全部 G（mailbox 读 + mailbox 写）** | 完全延后 0326 |
| `packages/worker-base/system-models/test_model_100_full.json` | 1 | 待鉴定 | per-case |
| `packages/worker-base/system-models/intent_handlers_ui_examples.json` | 1 | 待鉴定 | per-case |
| `packages/worker-base/system-models/intent_handlers_slide_import.json` | 1 | 待鉴定 | per-case |
| `packages/worker-base/system-models/intent_handlers_slide_create.json` | 1 | 待鉴定 | per-case |
| `packages/worker-base/system-models/cognition_handlers.json` | 1 | 待鉴定 | per-case |

#### Coarse-grained bucket 统计（快速扫描结果）

- **负数 model_id 相关（-1 / -2 / -10 / -12）**：**31 hits** — 主要 Bucket G（mailbox ui_event 读）+ Bucket D（写 Model -2 UI 投影 / Model -10 系统模型）。按 0325b plan Invariants **全部 D/F/G 延后 0326**。
- **正数 model_id 相关（包括自模型跨 cell + 正→正跨模型）**：**36 hits** — 需要 per-case 鉴定。当前判断里，server.mjs 17 处多为 A/B/C（本模型内）+ M1 代码生成器；workspace_positive_models 14 处多为 D（正→正跨模型，如 `model_id:100`）。

#### 延后 0326 清单占比（Step 4 + 4b input）

- Bucket G（mailbox ui_event）**预估 17+ hits** — 0326 整体删除 mailbox 第一落点，这批 handler 由 0326 统一重写或删除
- Bucket D（跨模型写，含负数 system 和 正→正）**预估 15+ hits** — 等 0326 mt_bus_receive 业务
- Bucket F（跨模型读）**预估 5-10 hits** — 同上
- **总延后：预估 35-45 hits（53-67% 剩余量）**

- Result: PASS (清单产出完整；per-case 细分留到下轮会话实际迁移时按本清单驱动)
- Commit: (随 runlog 更新一起 commit)

### Step 2 — A/B/E migrations（部分完成 2026-04-21，其余延后下轮会话）

- Command: `for t in ... do node $t; done`
- Key output: templates 15 hits 全清零
- Completed:
  - `packages/worker-base/system-models/templates/data_array_v0.json` — 5 hits → V1N（bucket B/E）
  - `packages/worker-base/system-models/templates/data_queue_v0.json` — 5 hits → V1N
  - `packages/worker-base/system-models/templates/data_stack_v0.json` — 5 hits → V1N
- Remaining A/B/E work: 需要 per-case 分析 36 正数 hits 里哪些是 A/B/E — 下轮会话按 Step 1 清单进行
- Result: PASS (templates subset)
- Commit: `f08aeb4 feat(0325b): migrate data_{array,queue,stack}_v0 templates to V1N`

### Step 3 — C migrations (mt_write_req via pin.connect.cell)

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 4 — D/F migrations (cross-model)

- Command:
- Key output:
- D cases deferred to 0326 (if any):
- Result: PASS/FAIL
- Commit:

### Step 5 — M1 server.mjs owner-materializer 合并

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 6 — 回归 + grep + audit

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 7 — Merge 0325 + 0325b 到 dev

- Command: `git checkout dev && git merge --no-ff dev_0325-* && git merge --no-ff dev_0325b-*`
- Key output:
- Result: PASS/FAIL
- Commit:

## Docs Updated

- [ ] `docs/ssot/host_ctx_api.md` §7 Deprecated 改为"0325b 已彻底移除"
- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` — 对 legacy migration 的 post-mortem 段落（若适用）
- [ ] `docs/handover/dam-worker-guide.md` — V1N / mt_write 开发指引补充
