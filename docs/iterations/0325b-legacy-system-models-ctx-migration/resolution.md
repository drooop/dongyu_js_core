---
title: "0325b — legacy-system-models-ctx-migration Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0325b-legacy-system-models-ctx-migration
id: 0325b-legacy-system-models-ctx-migration
phase: phase1
---

# 0325b — legacy-system-models-ctx-migration Resolution

## Execution Strategy

1. 先把 0325 分支 merge（或 rebase）作为本迭代 base — 获得 runtime ctx V1N 化基础
2. 逐文件迁移 system-models JSON 里的 `ctx.*` 调用（按难度排序）
3. 迁移 server.mjs 的 `ensureGenericOwnerMaterializer` / `ensureHomeOwnerMaterializer`
4. 补 pin.connect.cell / pin.connect.label 路由（本模型跨 cell 写）
5. 识别并记录跨模型 case 给 0326（若无法本迭代独立完成）
6. 全量回归 + grep 复核 + docs 同步 + runlog

## Step 1 — Migration 清单与分类

- Scope: 对所有 ctx.* 调用分类
- Commands:
  - `grep -rn "ctx\\.writeLabel\\|ctx\\.getLabel\\|ctx\\.rmLabel" packages/worker-base/system-models/ packages/ui-model-demo-server/server.mjs | tee /tmp/0325b_migration.txt`
  - 按 (target cell 与 func 所在 cell / 目标模型 vs self 模型) 分类每个 hit
- Classification buckets:
  - A — 本 cell 写（target = self cell）
  - B — 跨 cell 本模型写，func 在 root
  - C — 跨 cell 本模型写，func 非 root
  - D — 跨模型写
  - E — 本模型读（跨 cell）
  - F — 跨模型读
- Verification: 清单记入 runlog；每项含 file:line / classification / migration target
- Acceptance: 所有 hit 被分类并决定迁移方式

## Step 2 — 按 bucket 迁移 (A/B/E)

- Scope: 最简单的三类（本 cell 写 + root func 跨 cell 写本模型 + 本模型读）
- Files: `intent_handlers_*.json`、`workspace_positive_models.json` 中 bucket A/B/E 对应位置
- Migration:
  - A: `ctx.writeLabel({model_id:SELF, p:self.p, ...}, t, v)` → `V1N.addLabel(k, t, v)`
  - B: `ctx.writeLabel({model_id:SELF, p:≠self, ...}, t, v)` → `V1N.table.addLabel(p, r, c, k, t, v)`（func 必须在 root）
  - E: `ctx.getLabel({model_id:SELF, p, r, c, k})` → `V1N.readLabel(p, r, c, k)`
- Verification: 针对每处迁移的 func 运行其 fixture 或触发 pin.in 验证
- Acceptance: A/B/E 三类 100% 迁移完

## Step 3 — 按 bucket 迁移 C（跨 cell 非 root func，需 pin wiring 辅助）

- Scope: func 在非 root cell 想改本模型其他 cell
- Strategy: 发请求给本模型 `(0,0,0) mt_write_in`
  - func code: `V1N.addLabel('mt_write_req', 'pin.in', {op:'write', records:[{p,r,c,k,t,v}]})` (本 cell 写 mt_write_req pin.out)
  - Wait — 用户程序 V1N 只能写 **本 cell**；所以 mt_write_req 也是**本 cell** 写；然后 **需要 pin.connect.cell 把本 cell mt_write_req 路由到 (0,0,0) mt_write_in**
- 每个 case 需要同 JSON 补一条 `pin.connect.cell` label（root 上）声明路由 `[self_cell_p, r, c, 'mt_write_req'] → [[0,0,0,'mt_write_in']]`
- 可能需要统一 helper：JSON 里定义共享 root_routes key 来避免每处声明 wiring
- Verification: 触发 func → 观察 target cell 被 mt_write 写入
- Acceptance: C bucket 100% 迁移完

## Step 4 — 按 bucket 迁移 D / F（跨模型）

- Scope: 跨模型写/读 — 最复杂
- Analysis: 现有 handler 里 `model_id: 100` / `model_id: 1010` 等跨模型 case
- Strategy options:
  - D1: handler 所在模型 root 的 `mt_bus_send` 发到 Model 0 → Model 0 mt_bus_send 转发到目标模型 `mt_bus_receive:in` → mt_bus_receive 分发（0326 尚未填业务，**本迭代可能阻塞**）
  - D2: 临时保留一个 **privileged `V1N.system.bridgeWrite(target_model_id, p, r, c, k, t, v)`** 仅 model.id ≤ 0 可见，作为**系统级** privileged path，直到 0326 mt_bus_receive 填完业务后收回
- Recommendation: 若跨模型写 case 仅出现在 Model -10 / 0 / -X 之间（系统内部），用 D2（简单）；若出现在正数模型 → 正数模型，必须 D1（等 0326）
- Classify 每个 D/F case，决定本迭代 vs 0326
- Files:
  - system-models JSON 各 handler
  - 可能 runtime.mjs 新增 V1N.system 子 namespace（仅负模型可见）
- Verification: 每个 case 按选项对应验证
- Acceptance: D/F 100% 迁移，或明确标注"延后 0326"

## Step 5 — M1 server.mjs ensureGenericOwnerMaterializer / ensureHomeOwnerMaterializer

- Scope: server.mjs 生成的 owner_materializer 代码也统一为 V1N / mt_write 请求
- Files: `packages/ui-model-demo-server/server.mjs` lines 2088-2184 / 2774-2803 附近
- Changes:
  - 生成的 owner_materializer func.js code 从 `return [{...}]` 数组 / `apply_records` 模式改为**发请求到本模型 (0,0,0) mt_write_in**
  - 删除 ad-hoc `ensureHomeOwnerMaterializer` 特化（home 走标准 mt_write 路径）
- Verification: 0322 server_flow + 任何 home intent handler 测试 PASS
- Acceptance: grep `apply_records\|owner_materialize\|owner_apply_route` 在 packages/ 返回 0（除 iteration docs）

## Step 6 — 全量回归 + grep + audit + runlog

- Commands:
  - `grep -rn "ctx\\.writeLabel\\|ctx\\.getLabel\\|ctx\\.rmLabel" packages/ scripts/ deploy/` → 0 results
  - `grep -rn "apply_records\\|owner_materialize" packages/` → 0 results
  - 跑 0321/0322/0324/0325 + bus_in_out 全部
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Files: runlog 填实；`docs/ssot/host_ctx_api.md` §7 updated；`docs/ssot/runtime_semantics_modeltable_driven.md`
- Acceptance: 全绿 + grep 清零

## Step 7 — Merge 0325 + 0325b 一起到 dev

- Action: 先 merge dev_0325-* 到 dev → 再 merge dev_0325b-* 到 dev（或者反向取 0325b 吸收 0325 历史 → 只合 0325b）
- 推荐: `git merge --no-ff dev_0325-*` 然后 `git merge --no-ff dev_0325b-*` — 保留两条独立 merge 记录
- Verification: dev 上 0321/0322/0324/0325 全绿；`grep ctx.writeLabel packages/` = 0
- Acceptance: "0325 partial + 0325b 完整迁移" 作为一组整体 landed 到 dev，维持"无兼容层"整体性
