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

- 把 0325 runtime ctx V1N 化后留下的 **legacy system-models JSON 中 30+ 处 `ctx.writeLabel` / `ctx.getLabel` / `ctx.rmLabel` 调用** 全部迁移到 0323 正式路径，使得 0321/0322 server_flow 等依赖这些 handler 的测试恢复 PASS。
- 合并 0324 review 发现的 M1：server.mjs 里 `ensureGenericOwnerMaterializer` / `ensureHomeOwnerMaterializer` 生成的 `apply_records` + `owner_materialize` 模式也在本迭代彻底清除（统一走 mt_write 请求路径）。
- 0325 分支与 0325b 分支**作为一组整体 merge 到 dev**：dev baseline 始终无 ctx.* 遗留、0321/0322 回归始终保持绿。

## Scope

本迭代是 0325 的**同批扩展**（依赖 0325 分支的 runtime ctx V1N 作为 base）。分离原因见 0325 runlog：plan 低估 scope，legacy system-models migration 涉及 14+ 个 JSON 文件 30+ 处 func.js 代码字符串修改 + 必要 pin wiring 重构。

- In scope:
  - `packages/worker-base/system-models/workspace_positive_models.json` — 14 处 `ctx.*`（大多数是跨模型写）
  - `packages/worker-base/system-models/intent_handlers_*.json`（9 个文件，约 20 处 `ctx.*`）
  - `packages/worker-base/system-models/cognition_handlers.json`
  - `packages/worker-base/system-models/test_model_100_ui.json` / `test_model_100_full.json`
  - `packages/worker-base/system-models/templates/*.json`（data_array_v0 / data_queue_v0 / data_stack_v0）
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
- 迁移规则（每处 ctx.* 调用的目标形态）：
  - **本 cell 写**：`V1N.addLabel(k, t, v)`
  - **跨 cell 本模型写**：
    - func 在 root → `V1N.table.addLabel(p, r, c, k, t, v)`
    - func 非 root → 发请求到本模型 `(0,0,0)` `mt_write_in`：`V1N.addLabel('mt_write_req', 'pin.in', {op:'write', records:[{p, r, c, k, t, v}]})`（需要 fixture 同步加 pin.connect.cell 路由）
  - **跨模型写**：0323 禁止 V1N 跨模型写；必须改为 `pin.connect.model` 跨模型路由 + 对端 `mt_bus_receive` 消化（后者 0326 才填业务，所以**跨模型写必须 0325b / 0326 协调**）
  - **本模型读**：`V1N.readLabel(p, r, c, k)`
  - **跨模型读**：0323 禁止；需要改为 pin 请求-响应模式（复杂）；本迭代把跨模型读归入"识别 + 缓存 label 到对端"的过渡实现
- 不允许兼容层：任何 migration 不得保留旧 API 的 shim
- 对于跨模型 / 跨 cell 写的复杂 case，如果 target cell 在当前模型 root，可以经本模型 root 的 `mt_write_in` 完成；如果 target 在不同模型，需要改走 `mt_bus_send` → 目标模型 `mt_bus_receive`（0326 业务填充前 skeleton 只做 passthrough，可能需要 0326 同步协调）

## Success Criteria

1. `grep -rn "ctx\.writeLabel\|ctx\.getLabel\|ctx\.rmLabel" packages/ scripts/ deploy/` 返回 0 结果（除 iteration docs 历史引用与 `*.legacy.json`）
2. 0321/0322 server_flow 回归 PASS（端到端链路恢复）
3. 0324 / 0325 已 PASS 的 21+ 测试仍 PASS
4. 新增 / 已有 system-models JSON 的 func.js 代码全部使用 V1N 面；server.mjs 生成的 owner_materializer 代码也统一为 V1N / mt_write 请求
5. 若某跨模型依赖无法按本迭代完成（需 0326 mt_bus_receive 业务），在 runlog 明确标注并生成对应 0326 prerequisite 条目
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
