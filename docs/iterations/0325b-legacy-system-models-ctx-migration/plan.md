---
title: "0325b — legacy-system-models-ctx-migration Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0325b-legacy-system-models-ctx-migration
id: 0325b-legacy-system-models-ctx-migration
phase: phase1
---

# 0325b — legacy-system-models-ctx-migration Plan

## Goal

- 把 0325 runtime ctx V1N 化后留下的 **legacy system-models JSON + server.mjs 中 82 处 `ctx.writeLabel` / `ctx.getLabel` / `ctx.rmLabel` 调用（分布 19 个文件）** 全部按 0323 正式路径处理（迁移 / 删除 / 延后 0326），使得 0321/0322 server_flow 等依赖这些 handler 的测试恢复 PASS。
- 合并 0324 review 发现的 M1：server.mjs `ensureGenericOwnerMaterializer`（行 2060-2184）+ `ensureHomeOwnerMaterializer`（行 2774-2803）+ forward func 代码模板（1591-1608）生成的 `apply_records` + `owner_materialize` 模式彻底清除（统一走 mt_write 请求路径）。
- 0325 分支与 0325b 分支**作为一组整体 merge 到 dev**：dev baseline 始终无 ctx.* 遗留（除 D/F 延后清单）、0321/0322 回归始终保持绿。

## Scope

本迭代是 0325 的**同批扩展**（依赖 0325 分支的 runtime ctx V1N 作为 base）。分离原因见 0325 runlog：plan 低估 scope — 2026-04-21 sub-agent phase2 review 精确统计为 **82 处 ctx.* 跨 19 个文件**（原 plan 估 30+，低估 ~2.5×）。

- In scope:
  - `packages/worker-base/system-models/workspace_positive_models.json` — 14 处 `ctx.*`（大多数是跨模型写）
  - `packages/worker-base/system-models/intent_handlers_*.json`（9 个文件，约 20 处 `ctx.*`）
  - `packages/worker-base/system-models/cognition_handlers.json`
  - `packages/worker-base/system-models/test_model_100_ui.json` / `test_model_100_full.json`
  - `packages/worker-base/system-models/templates/data_{array,queue,stack}_v0.json` — 15 处（每文件 5），**全部 bucket A/E 本模型内**，first-pass 最简单
  - `packages/ui-model-demo-server/server.mjs`:
    - `ensureGenericOwnerMaterializer`（M1 from 0324 review）
    - `ensureHomeOwnerMaterializer`（同上）
  - 其他 `.json` / `.mjs` 里残留的 `ctx.writeLabel` / `ctx.getLabel` / `ctx.rmLabel`
- Out of scope:
  - `*.legacy.json` 历史文件（保留原样）
  - `data/*/yhl.db` SQLite 持久化（不是代码）
  - 0325 分支范围内的 runtime ctx 改造（已完成）

## Invariants / Constraints

- 0325b 执行期间 0325 分支保持不 merge；0325 + 0325b 一起 merge 到 dev 以维持 "无兼容层 + 同 PR 整体达成"
- **迁移单位 = func body，不是单次 ctx.* 调用**：许多 handler 在同一 code 字符串里混合 A/B/D/E/F 多 bucket，必须整个 func body 一次重写，不能只改一行
- 迁移规则（每处 ctx.* 调用的目标形态）：
  - **本 cell 写（A）**：`V1N.addLabel(k, t, v)`
  - **跨 cell 本模型写**：
    - func 在 root（B）→ `V1N.table.addLabel(p, r, c, k, t, v)`
    - func 非 root（C）→ 发请求到本模型 `(0,0,0)` `mt_write_in`：`V1N.addLabel('mt_write_req', 'pin.in', {op:'write', records:[{p, r, c, k, t, v}]})` + 本模型 root 上补 `pin.connect.cell` 路由（**用单一共享 `root_routes` label 聚合所有 C-bucket 源 cell**，避免每处独立声明）
  - **本模型读（E）**：`V1N.readLabel(p, r, c, k)`
  - **跨模型写（D）** 与 **跨模型读（F）**：**全部延后 0326**。0326 填 `mt_bus_send` / `mt_bus_receive` 业务后这些 handler 统一改为 pin 链路。0325b phase3 在 runlog 维护 D/F 延后清单（每项引用 0326 prerequisite）。**本迭代不引入 V1N.system.bridgeWrite 或其他新 Tier 1 privileged 路径**（与本迭代"Tier 2 数据迁移"定位冲突；已被 phase2 review 明确拒绝）
  - **Bucket G（mailbox ui_event handlers）**：跳过，由 0326 整体删除
- 不允许兼容层：任何 migration 不得保留旧 API 的 shim
- 本迭代**纯 Tier 2 数据 + 生成代码迁移**，不修改 runtime.mjs

## Success Criteria

1. `grep -rn "ctx\.writeLabel\|ctx\.getLabel\|ctx\.rmLabel" packages/ scripts/ deploy/` 返回 0 结果，**除去**：
   - iteration docs 历史引用 + `*.legacy.json`
   - runlog "D/F 延后清单"中每条已明确延后 0326（含 0326 prerequisite 引用）
   - runlog "Bucket G mailbox 跳过清单"中每条由 0326 删除的 handler
2. 0321/0322 server_flow 回归 PASS（端到端链路恢复到可运行状态；如依赖 D/F 延后 case，则需在 runlog 明确说明 PASS 是否降级为"部分 PASS")
3. 0324 / 0325 已 PASS 的 21+ 测试仍 PASS
4. 所有 bucket A/B/C/E hit 100% 迁移完；server.mjs M1（3 处代码生成器）彻底清 apply_records
5. runlog 有完整 D/F + G 清单，每条含 `file:line` + 分类 + 0326 prerequisite ref
6. `obsidian_docs_audit` PASS

## Inputs

- Created at: 2026-04-21
- Iteration ID: `0325b-legacy-system-models-ctx-migration`
- Source:
  - 0325 分支 runlog "Scope split" 段（此处详列了本迭代实际对象）
  - 0324 review M1 — `ensureGenericOwnerMaterializer` / `ensureHomeOwnerMaterializer`
- Depends on: 0325 分支 HEAD `7b4e269`（runtime ctx V1N 化）
- Upstream memory: `project_0323_implementation_roadmap.md`
- User 2026-04-21 decisions（继续延续）: 不允许任何兼容层；跨 cell/跨模型写必须经由 mt_write / mt_bus_* 正式路径
