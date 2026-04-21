---
title: "0324 — runtime-root-default-program-models Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0324-runtime-root-default-program-models
id: 0324-runtime-root-default-program-models
phase: phase1
---

# 0324 — runtime-root-default-program-models Plan

## Goal

- 实装 0323 规约第 2/3/4 条：每个 `model.table` 的 `(0,0,0)` 必须自动持有 **三对默认程序模型**：
  - `mt_write` — 接收写请求，对当前 model.table 内任意 Cell 执行 addLabel/rmLabel
  - `mt_bus_receive` — 接收父模型下行消息，分发到内部 Cell（业务填充在 0326）
  - `mt_bus_send` — 汇集内部外发消息上行到父模型边界（业务填充在 0326）
- 新增 `packages/worker-base/system-models/default_table_programs.json`（Tier 2 source of truth for 三程序 code）
- runtime `_seedDefaultRootScaffold` 新增（Tier 1 种植机制），在 `createModel` 创建 `model.table` 时自动从 JSON patch 读取三程序骨架落到 `(0,0,0)`
- **废弃 `(0,1,0)` helper executor scaffold**：
  - 在 `model.table` 场景下 **完全删除** `_seedDefaultHelperScaffold` 调用与 `_defaultOwnerMaterializeCode` 模板
  - 本迭代**覆盖** 0323 spec 里 "model.single scenario retains helper scaffold" 的条款 — 按用户 2026-04-21 "helper 完全废弃" 决策，所有模型形态下 helper 都移除。未来如独立 model.single 场景需要跨 Cell 写能力，以重新开 iteration 方式加入；当前项目内正数模型均是 model.table。
- 同 PR 内迁移所有现有 `apply_records` 调用方（0322 forward func 的 handle_submit 链、intent handlers 等）到 "发请求给 `(0,0,0) mt_write:in`"

## Scope

- In scope:
  - `packages/worker-base/system-models/default_table_programs.json`（新，Tier 2 三程序默认 code）
  - `packages/worker-base/src/runtime.mjs`:
    - 新增 `_seedDefaultRootScaffold(model)` — 在 `createModel` 创建 `model.table` 时自动种（load patch → 注入 (0,0,0)）
    - 删除 `_seedDefaultHelperScaffold` / `_defaultOwnerMaterializeCode`
    - `createModel` 调用点改走 `_seedDefaultRootScaffold`
  - `packages/ui-model-demo-server/server.mjs` 的 `buildImportedHostEgressForwardCode` — forward func 里写 Model 0 pin.bus.out / egressLabel reset 改走请求到 Model 0 `(0,0,0)` `mt_write:in`（Model 0 本身也是 model.table 根）
  - 0322 测试 fixture 里的 `handle_submit` return apply_records 改写为 "发请求给 `(0,0,0) mt_write:in`" — 经由 `(0,0,0)` 的 `mt_write` 完成实际写入
  - 新增 `scripts/tests/test_0324_root_scaffold.mjs` 覆盖契约
- Out of scope:
  - `ctx.*` 到 `V1N.*` API 面替换（留 0325）
  - 前端事件入口改造（留 0326）
  - CLAUDE.md / SSOT legacy mailbox 条目的对齐（留 0327）

## Invariants / Constraints

- **Tier 边界**：
  - Tier 1：`_seedDefaultRootScaffold` 种植机制（runtime.mjs）
  - Tier 2：`default_table_programs.json` 里的三程序 code 字符串内容（`system-models/` 目录）
  - 禁止：把三程序 code 字符串硬编码在 runtime.mjs 里（违反 0323 spec §5.2g "三程序 code 属 Tier 2" 裁决）
- **Helper 完全废弃**：`_seedDefaultHelperScaffold` / `_defaultOwnerMaterializeCode` / `(0,1,0)` 的 `owner_apply / owner_apply_route / owner_materialize` 系列 **全部删除**，不留任何兼容代码
  - 已知影响面：0322 forward func、imported app `handle_submit` 返回 `{op:'apply_records', records:[...]}` 模式、可能的 system model JSON patches — 全部同 PR 改对
- **不允许兼容层**：不留 `_seedDefaultHelperScaffold` 别名；不留"如果 model.single 就种 helper"的分支
- 破坏性变更：0322 测试 fixture 需改；server_flow 预计初始 FAIL，修完 runtime + fixture 后应恢复 PASS
- V1N API 本迭代**不提供**；ctx.writeLabel 旧签名仍被 `mt_write` func 代码依赖（mt_write 自身用旧 API 是 transitional，由 0325 一并升级为 V1N 面）

## Success Criteria

1. 新 `createModel({id: 正数, type 暗示 model.table})` 触发 `_seedDefaultRootScaffold`，`(0,0,0)` 自动含三个 func.js 标签 `mt_write` / `mt_bus_receive` / `mt_bus_send` + 各自 pin 骨架
2. `default_table_programs.json` 作为 Tier 2 source：修改它即修改默认程序行为；runtime.mjs 里无三程序 code 硬编码
3. `(0,1,0)` helper scaffold 不再 seed：`grep -r "_seedDefaultHelperScaffold\|_defaultOwnerMaterializeCode\|owner_materialize" packages/worker-base/src/` 返回 0 结果
4. 0322 `test_0322_imported_host_egress_server_flow.mjs` 在 handle_submit 改为"请求 mt_write"后仍 PASS
5. 新 `test_0324_root_scaffold.mjs` 覆盖：
   - model.table 创建后三程序 seed 到位
   - Model 0 本身也得种（因为 Model 0 根是 model.table）
   - seed 幂等
   - helper 不再 seed
6. 全量回归 0321 / 0322 / 0322_runtime_bus_out_cleanup / bus_in_out PASS
7. `obsidian_docs_audit` PASS

## Inputs

- Created at: 2026-04-21
- Iteration ID: `0324-runtime-root-default-program-models`
- Source: `docs/iterations/0323-modeltable-rw-permission-spec/resolution.md` Step 2（§5.3 三程序定义）+ runlog Step 8 "0323+1 首要任务"
- Upstream memory: `project_0323_implementation_roadmap.md`
- User decision (2026-04-21): Helper 完全废弃（覆盖 0323 spec "model.single 保留" 条款）
