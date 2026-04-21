---
title: "0325 — ctx-api-tightening-static-selfcell Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0325-ctx-api-tightening-static-selfcell
id: 0325-ctx-api-tightening-static-selfcell
phase: phase1
---

# 0325 — ctx-api-tightening-static-selfcell Plan

## Goal

- 按 0323 规约把 runtime `_executeFuncViaCellConnect` 构造的 func ctx 从 `ctx.writeLabel / ctx.getLabel / ctx.rmLabel` 替换为 **V1N 命名空间**：
  - `V1N.addLabel(k, t, v)` — 仅本 cell（静态，func 运行期所在 cell）
  - `V1N.removeLabel(k)` — 仅本 cell
  - `V1N.readLabel(p, r, c, k)` — 当前模型内任意 Cell（**单签名**；不提供双 API）
- **显式覆盖 0323 spec §7 "兼容期：直到后续实现迭代正式移除"条款** — 按用户 2026-04-21 决策"不允许兼容"，本迭代直接移除 `ctx.writeLabel / ctx.getLabel / ctx.rmLabel`；所有现有调用方同 PR 同步迁移
- 跨 cell 写必须通过触发本模型 `(0,0,0)` 的 `mt_write:in`（0324 已 seed）
- 跨模型读**禁止**：`V1N.readLabel` 只接受本模型内 (p, r, c, k)；若通过 ref 形态传 model_id 参数则抛 `cross_model_read_denied`

## Scope

- In scope:
  - `packages/worker-base/src/runtime.mjs` `_executeFuncViaCellConnect` ctx 构造（约行 1834+）
  - 删除旧 `ctx.writeLabel / ctx.getLabel / ctx.rmLabel`，不留 alias
  - 删除 `_assertScopedDirectAccess`（原是跨 cell 写的 scope 守卫，已不再需要）
  - 新增 `V1N` 命名空间对象挂到 ctx
  - `mt_write` 程序模型代码（定义在 0324 落位的 `default_table_programs.json`）：因 mt_write 是 model-privileged，需要能写任意 cell — 保留 `runtime.addLabel` 内部路径能力，**但不通过 V1N 面暴露**（privileged path 对用户程序仍不可见）
  - 迁移所有现有调用方（估 20+ 处）：
    - `packages/ui-model-demo-server/server.mjs`（forward func 代码模板等）
    - `packages/worker-base/system-models/*.json`（func.js 代码字符串）
    - `deploy/sys-v1ns/**/*.json`
    - `scripts/tests/test_0322_*.mjs` fixture 中的 `handle_submit` 代码（0324 已改一轮，本迭代再校对为 V1N.*）
    - Model -10 上 intent handlers 等
  - 新增 `scripts/tests/test_0325_v1n_api_shape.mjs` + `test_0325_cross_model_read_denied.mjs` + `test_0325_selfcell_write_guard.mjs`
- Out of scope:
  - 前端事件入口改造（留 0326）
  - CLAUDE.md / slide_delivery §3 legacy 文字清理（留 0327）
  - mt_write / mt_bus_receive / mt_bus_send 骨架种植（0324 完成）
  - `hostApi` / `sendMatrix` 保留不变（属 programEngine ctx，不在 runtime ctx 范围）

## Invariants / Constraints

- **静态本 cell**：ctx 构造时注入 `V1N.addLabel = (k, t, v) => runtime.addLabel(model, p, r, c, { k, t, v })`，这里 `model, p, r, c` 在构造时已从 `self` 参数闭包捕获；func 运行期 `V1N.addLabel('x', 'str', v)` 只能影响该 cell
- **单读签名**：`V1N.readLabel(p, r, c, k)` 返回 `{t, v} | null`；不支持 PRC→列表 形态（若未来需要再加 iteration）
- **跨模型读禁止**：所有 V1N API 内部用 `self.model_id`；不接收 model_id 参数；若用户程序传 `ref` 对象形态，抛 `invalid_v1n_api_signature`
- **无兼容层**：`ctx.writeLabel / ctx.getLabel / ctx.rmLabel` 彻底删除；`ctx` 不再有这些属性；调用方传旧签名调用会触发 `ctx.writeLabel is not a function` — 这是**正确**的破坏性行为，提示迁移未完成
- 破坏性变更：0322 forward func / fixture handle_submit / intent dispatch handlers 等所有用 `ctx.*` 的位置都在本 PR 内迁移
- `mt_write` 程序模型的代码内部**可能仍用 `runtime.addLabel`**（因为它在 programEngine.executeFunction 路径执行，ctx 不同；且作为 privileged model-level program）— 这是合法的，V1N 约束针对用户程序面（_executeFuncViaCellConnect ctx），不针对 privileged path

## Success Criteria

1. `V1N.addLabel / removeLabel / readLabel` 3 API 在 func ctx 上可用
2. `ctx.writeLabel / ctx.getLabel / ctx.rmLabel` 在 runtime.mjs 里 grep 不到（除 iteration docs 内历史引用）
3. `_assertScopedDirectAccess` 删除
4. 跨 cell 写用 V1N.addLabel 会抛 `invalid_v1n_api_signature`（传多参数）或直接作用于本 cell
5. 跨模型读用 `V1N.readLabel` 不接受 model_id 参数；任何试图通过 ref 传 model_id 的代码 throw
6. 新测试：
   - `test_0325_v1n_api_shape.mjs`：V1N 3 API 契约
   - `test_0325_cross_model_read_denied.mjs`：跨模型读 throw
   - `test_0325_selfcell_write_guard.mjs`：本 cell 静态守卫
7. 所有 0321 / 0322 / 0324 回归 PASS
8. `obsidian_docs_audit` PASS

## Inputs

- Created at: 2026-04-21
- Iteration ID: `0325-ctx-api-tightening-static-selfcell`
- Source: `docs/iterations/0323-modeltable-rw-permission-spec/resolution.md` Step 1（host_ctx_api V1N 命名空间定义）+ runlog "0323+5 兼容期终止"
- Depends on: 0324 (mt_write 已种在 (0,0,0))
- User decision (2026-04-21): 不允许兼容层（覆盖 0323 spec §7 兼容期条款）
- Upstream memory: `project_0323_implementation_roadmap.md`
