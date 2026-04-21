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
  - 因 V1N 只能写本 cell，mt_write_req 是本 cell 写；再由 pin.connect.cell 把本 cell mt_write_req 路由到 (0,0,0) mt_write_in
- **Pin wiring 决策（phase1 锁定）**：使用**单一共享 `root_routes` label**（label.t = `pin.connect.cell`）在本模型 `(0,0,0)` 聚合所有 C-bucket 源 cell 到 `mt_write_in` 的路由。每个模型**只有一个** `root_routes` label，其 value 是 `[{from:[p,r,c,'mt_write_req'], to:__DY_PROTECTED_WL_0__}, ...]` 列表聚合。**不采用**"每个 func 独立声明 pin.connect.cell"方案（会爆炸到 30+ 独立声明）
- Acceptance: C bucket 100% 迁移完；每个受影响模型的 (0,0,0) 有且仅有一个 `root_routes` label 聚合所有 C 来源

## Step 4 — D/F 全部延后 0326（本迭代不处理）

- Scope: 跨模型写（D）+ 跨模型读（F）— **全部延后至 0326**
- Rationale: 0323 正式路径通过 `mt_bus_send` / `mt_bus_receive` 完成跨模型，后者业务由 0326 填；0325b 是纯 Tier 2 数据迁移，**不引入新 Tier 1 特权路径**（先前 plan 草稿的 D2 方案 `V1N.system.bridgeWrite` 与本迭代 Invariants 冲突，已被 phase2 review 撤回）
- Action: 把本迭代扫到的 D/F case 列入 runlog "D/F 延后清单"，每条含：
  - `file:line`
  - 完整 func body（便于 0326 整体重写）
  - 分类 D (write) / F (read)
  - 对应 0326 prerequisite（例如 "0326 Step 3 mt_bus_receive fill business"）
- Verification: 清单完整，每条有 0326 prerequisite 引用
- Acceptance: D/F 完全识别分类；本迭代不改其代码；这些 handler 在 0326 phase3 统一重写

## Step 4b — Bucket G（mailbox `model_id:-1` ui_event handlers）

- Scope: 约 17 处 handler 以 `ctx.getLabel({ model_id: -1, c: 1, k: 'ui_event' })` 起手
- Rationale: 0326 plan 明言"彻底删除 mailbox (Model -1, (0,0,1)) 作为 UI 事件第一落点"；这些 handler 结构性 **废弃** 而非 V1N 化
- Action: 列入 runlog "G 跳过清单"，每条含 `file:line` + 整个 func 被 0326 标记为 delete/rewrite 的归属标注
- Verification: 清单完整；G 类 handler 在本迭代**不 touch**
- Acceptance: 0325b 不浪费精力 V1N 化这批 handler

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

- Action: 先 merge dev_0325-* 到 dev → 再 merge dev_0325b-* 到 dev（保留两条独立 merge 记录）
- 推荐: `git merge --no-ff dev_0325-*` 然后 `git merge --no-ff dev_0325b-*`
- **Merge gate conditions（ALL 必须满足）**：
  - 0321/0322/0324/0325 已 PASS 的 21+ 测试全绿
  - `grep ctx.writeLabel packages/` = 0（除 D/F/G 明确延后清单 + `*.legacy.json`）
  - D/F 延后清单 + G 跳过清单均已登记 + 每条有 0326 prerequisite ref
- **Abort / downgrade clauses**：
  - A: 若 D/F 延后后 **0321/0322 server_flow 仍 FAIL**，提议 downgrade 为 **0325 + 0325b + 0326 triple-merge**（等 0326 phase3 完成一起 land）；在 runlog 明确记录此 downgrade 决策并请求 user 批准
  - B: 若合入后出现新 regression（非 D/F 相关），**revert 两 merge commits**，回到 `dev` HEAD，在 runlog 记录 revert 原因；不保留 partial 状态
- Acceptance: "0325 partial + 0325b 完整迁移" 作为一组整体 landed 到 dev，且 dev baseline 测试全绿

## Rollback（整 iteration 级别）

- 分支层面：0325b 所有 commits 保留在本分支不 merge 即等于未 landed；无需特殊 rollback
- Merge 后回退：若 Step 7 Abort clause B 触发，`git revert -m 1 <merge-sha>` 两个 merge commits；回到 `dev` 8e11c26 baseline（0324 已 landed）
- D/F 延后清单 + G 跳过清单作为 0326 phase1 的 prerequisite input；不因 0325b rollback 丢失决策轨迹（docs 保留在 0325b 分支 iteration 目录）
