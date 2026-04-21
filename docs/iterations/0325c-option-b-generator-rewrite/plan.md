---
title: "0325c — option-b-generator-rewrite Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0325c-option-b-generator-rewrite
id: 0325c-option-b-generator-rewrite
phase: phase1
---

# 0325c — option-b-generator-rewrite Plan

## Goal

- 执行 0325b runlog Step 5（二次 sub-agent REJECT 后）明确的 **Option B 实施清单**：把所有仍通过 runtime `_executeFuncViaCellConnect` tightened ctx 触发却使用旧 `ctx.writeLabel/getLabel/rmLabel` 的 code 全部迁移到 V1N API。
- 范围聚焦于**两类 runtime-ctx 消费者**：
  - **server.mjs 代码生成器产物**：`ensureGenericOwnerMaterializer` / `ensureHomeOwnerMaterializer` 生成的 owner_materialize func.js code（在 target model (0,0,0) root）
  - **system-models JSON 种的 legacy forward funcs**：`forward_workspace_filltable_submit_from_model0` / `forward_matrix_phase1_send_from_model0` / `forward_model100_submit_from_model0` 等在 Model 0 (0,0,0) root
- **Bucket C 路径实装**：`handle_slide_import_click` / `handle_slide_create_click` 等非 root self-model cross-cell handler 通过 `V1N.addLabel('mt_write_req', 'pin.in', ...)` + 本模型 root 加 shared `root_routes` pin.connect.cell 聚合 wiring
- 目标：恢复 0321/0322 server_flow 回归 PASS，使 0325 + 0325b + 0325c 可作为一组整体 merge 到 dev，维持"无兼容层 + 同 PR 整体达成"原则。

## Scope

- In scope:
  - `packages/ui-model-demo-server/server.mjs`:
    - `ensureGenericOwnerMaterializer` (行 2160-2184) — 生成 code 改用 `V1N.table.addLabel` / `V1N.table.removeLabel`
    - `ensureHomeOwnerMaterializer` (行 2133-2158) — 同上
    - `buildImportedHostEgressForwardCode` (行 1589-1609) — **确认**仅 programEngine 路径触发（0322 design）；本迭代不改，但 runlog 记录 dual-route 防御为 future follow-up
  - `packages/worker-base/system-models/workspace_positive_models.json`:
    - legacy forward funcs 3 处（在 Model 0 (0,0,0) root）→ V1N.table 版本
    - `handle_slide_import_click` + `handle_slide_create_click` + 其他 Bucket C 非 root handler → V1N.addLabel('mt_write_req', ...) + root 级 shared `root_routes` 聚合
  - 新增 `scripts/tests/test_0325c_generator_rewrite.mjs` 契约 + 回归测试
- Out of scope:
  - Bucket D/F/G handler 大规模迁移（保持 0325b Step 4 延后 0326 的裁决；本迭代不改这批）
  - 0326 mt_bus_receive / mt_bus_send 业务填充
  - runtime.mjs 任何改动（V1N API 已在 0325 定稿，不再触 Tier 1）

## Invariants / Constraints

- **承接 0325 / 0325b 约束**：
  - 不允许兼容层；ctx.* 在 runtime ctx 不能以任何形式复活
  - V1N API 形状保持 (k, t, v) / (k) / (p, r, c, k) 单签名不变
  - 迁移单位 = func body（不做 per-call 局部替换）
- **纯 Tier 2 数据 + 生成代码迁移**：runtime.mjs **不触碰**
- **handle_slide_import_click 等 Bucket C handler**：移至 `V1N.addLabel('mt_write_req', ...)` 路径；同时在本模型 root 统一加**一个** `root_routes` pin.connect.cell label（若已存在则追加 entry，不声明独立 label）
- **owner_materialize 生成 code**：因 runs at target (0,0,0) root，直接用 `V1N.table.addLabel(p, r, c, k, t, v)` 版本；**不使用 V1N.addLabel**（owner_materialize 业务就是跨 cell 写）
- **Legacy forward funcs** `forward_*` 在 Model 0 (0,0,0) root：
  - 需要 `ctx.sendMatrix` — 只在 programEngine ctx 可用；**需评估其触发路径**
  - 若仍被 runtime pin.connect.label 触发（dual-route）且同时走 programEngine，则保持 code 兼容两侧（即用 ctx.writeLabel 的版本也用 V1N.table 等价替代；Matrix 发送通过单独路径或延后 0326）
- **完成门**：0321/0322 server_flow 回归 PASS；全量 ctx.* grep 在 packages/worker-base/ + packages/ui-model-demo-server/ （除 legacy.json）返回 0（只允许 programEngine 专属路径里的 ctx.*）

## Success Criteria

1. `ensureGenericOwnerMaterializer` + `ensureHomeOwnerMaterializer` 生成的 code 不含 `ctx.writeLabel/getLabel/rmLabel`；使用 V1N.table.addLabel/removeLabel + V1N.readLabel
2. workspace_positive_models.json 的 3 个 legacy forward funcs（`forward_workspace_filltable_submit_from_model0` / `forward_matrix_phase1_send_from_model0` / `forward_model100_submit_from_model0`）在 pin.connect.label runtime 触发路径下无 throw（code 迁移到 V1N.table 或同时提供 Matrix send 新路径）
3. `handle_slide_import_click` 和至少 1 个类似 Bucket C handler 已迁移到 mt_write_req 路径；对应模型 root 存在聚合 `root_routes` pin.connect.cell label
4. 新 `test_0325c_generator_rewrite.mjs` 覆盖：
   - owner_materialize 生成 code 实际 seed 并可执行（使用 V1N.table）
   - handle_slide_import_click 新路径触发 → 观察 (0,0,0) `slide_import_request` 被 mt_write 写入
5. 0321/0322 server_flow 回归 PASS（原 FAIL 由本迭代修复）
6. 0324 / 0325 已 PASS 的 21+ 测试仍 PASS
7. `grep -rn "ctx\.writeLabel\|ctx\.getLabel\|ctx\.rmLabel" packages/worker-base/system-models/ packages/ui-model-demo-server/server.mjs` 除 programEngine 专属代码（server.mjs:3042-3080 的 programEngine ctx 构造 + buildImportedHostEgressForwardCode 因 programEngine-only 保留）外返回 0
8. `obsidian_docs_audit` PASS

## Inputs

- Created at: 2026-04-21
- Iteration ID: `0325c-option-b-generator-rewrite`
- Source:
  - 0325b runlog Step 5（二次 sub-agent REJECT 纠正后的 Option B 清单）
  - sub-agent review notes: programEngine 路径单独性 / Bucket C non-root 重分类 / arithmetic 纠正
- Depends on: 0325 + 0325b HEAD (`d26b82b`) — 0325 提供 runtime V1N + V1N.table API；0325b 完成 templates 迁移 + Option B 清单
- Merge plan: 0325 → 0325b → 0325c 三个一起 merge 到 dev（保持"无兼容层"整体达成）
- Upstream memory: `project_0323_implementation_roadmap.md`
- User 2026-04-21 decisions: 不允许兼容；按 sub-agent review 修正；按建议 2 开独立 iteration
