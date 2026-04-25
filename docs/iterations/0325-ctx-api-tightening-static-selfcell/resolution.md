---
title: "0325 — ctx-api-tightening-static-selfcell Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0325-ctx-api-tightening-static-selfcell
id: 0325-ctx-api-tightening-static-selfcell
phase: phase1
---

# 0325 — ctx-api-tightening-static-selfcell Resolution

## Execution Strategy

1. 契约测试锁定 V1N 形状 + 静态本 cell + 跨模型读拒绝
2. 先 grep 清点所有 `ctx.writeLabel / ctx.getLabel / ctx.rmLabel` 调用点，形成 migration 清单
3. runtime.mjs 改造 ctx：注入 V1N，移除 `ctx.writeLabel/getLabel/rmLabel`
4. 迁移所有调用点（同 PR），无兼容层
5. 回归 + docs + runlog

## Step 1 — 契约测试

- Scope: 锁定 V1N API 形状 + 守卫行为
- Files:
  - `scripts/tests/test_0325_v1n_api_shape.mjs`（新）
  - `scripts/tests/test_0325_cross_model_read_denied.mjs`（新）
  - `scripts/tests/test_0325_selfcell_write_guard.mjs`（新）
- Test cases:
  - `v1n_addLabel_signature`: 调 `V1N.addLabel('k', 'str', 'v')` 产生 addLabel on current cell；多参数抛 `invalid_v1n_api_signature`
  - `v1n_removeLabel_signature`: 调 `V1N.removeLabel('k')` 删本 cell label
  - `v1n_readLabel_within_model`: 调 `V1N.readLabel(p, r, c, k)` 读本模型任意 cell
  - `v1n_readLabel_no_model_id_param`: 若调 `V1N.readLabel({model_id:..., p, r, c, k})` ref 形态 → throw
  - `ctx_writeLabel_removed`: `typeof ctx.writeLabel === 'undefined'`
  - `ctx_getLabel_removed`: 同上
  - `ctx_rmLabel_removed`: 同上
  - `selfcell_write_static`: func 在 (0,1,0) 里 V1N.addLabel → 只改 (0,1,0)
  - `cross_model_read_denied`: 任何跨 model_id 读都 throw
- Verification: 所有新测试初始 FAIL（runtime 未改）
- Acceptance: 契约明确
- Rollback: 删新增测试文件

## Step 2 — Migration 清单

- Scope: 全代码库 grep 形成清单
- Commands:
  - `grep -rn "ctx\.writeLabel\|ctx\.getLabel\|ctx\.rmLabel" packages/ scripts/ deploy/ | tee /tmp/0325_migration.txt`
- Expected hit locations:
  - `packages/ui-model-demo-server/server.mjs`（forward func 代码模板、其它 programEngine ctx 代码）
  - `packages/worker-base/system-models/*.json`（func.js 代码字符串 literal）
  - `packages/worker-base/system-models/default_table_programs.json`（0324 新文件 — mt_write 自身 code 可能仍用 ctx.writeLabel）
  - `deploy/sys-v1ns/**/*.json`
  - `scripts/tests/test_0322_*.mjs` fixture
  - Model -10 handler code
- Verification: 清单落入本迭代 runlog
- Acceptance: 所有 hit 有归属（迁移 / 保留 / 延后）

**注**：`mt_write` 程序模型的 code（0324 seed 到 `default_table_programs.json`）内部可能仍用 `ctx.writeLabel`（因 mt_write 需要 privileged 跨 cell 写）。本迭代讨论：
- 选项 A：mt_write code 在 `_executeFuncViaCellConnect` ctx 里执行，但构造 ctx 时**检测 model-privileged flag**给它 ctx.writeLabel 全 ref 形态；用户程序不给
- 选项 B：mt_write 特殊路径，不走 `_executeFuncViaCellConnect`，由 runtime 独立调 addLabel
- 选项 C：mt_write 走 programEngine.executeFunction（ctx 含 writeLabel 全 ref 形态） — 同 0322 forward func 机制

推荐 **C**（复用 programEngine 路径；与 forward func 一致）。落地细节在 Step 3 实装。

## Step 3 — runtime.mjs ctx 改造

- Scope: `_executeFuncViaCellConnect` ctx 构造
- Files:
  - `packages/worker-base/src/runtime.mjs`
- Changes:
  - ctx 对象新增 `V1N: { addLabel, removeLabel, readLabel }`；各 API 按本 cell 闭包坐标构造
  - ctx 移除 `writeLabel / rmLabel / getLabel` 属性
  - `_assertScopedDirectAccess` 函数删除（不再有调用方）
- Verification: Step 1 三个测试 PASS（`ctx_*_removed` + `v1n_*_signature` + `cross_model_read_denied`）
- Acceptance: V1N 接口生效；旧 API 消失
- Rollback: 回退 runtime.mjs

## Step 4 — 迁移所有调用方（无兼容层）

- Scope: Step 2 清单全部 hit 点改写
- Files:
  - 按清单
- Migration rules:
  - 本 cell 写：`ctx.writeLabel({model_id: SELF, p:self.p, r:self.r, c:self.c, k:'x'}, t, v)` → `V1N.addLabel('x', t, v)`
  - 跨 cell 写：`ctx.writeLabel({model_id: SELF, p≠self, ...}, t, v)` → 构造 request `V1N.addLabel('mt_write_req', 'pin.in', { op:'write', records:[{p,r,c,k,t,v}] })`，经由 `(0,0,0) mt_write` pin 链落盘
  - 跨模型写（旧代码中极少，通常是 privileged path）：必须通过 pin 链路跨模型；V1N 面不支持；若是 mt_write / programEngine.executeFunction 路径则允许
  - 本模型读：`ctx.getLabel({model_id: SELF, p, r, c, k})` → `V1N.readLabel(p, r, c, k)`
  - 跨模型读：**禁止**；改为依赖 pin 链上游传 value
  - 本 cell 删：`ctx.rmLabel({model_id: SELF, p:self.p, r:self.r, c:self.c, k})` → `V1N.removeLabel(k)`
  - 跨 cell 删：同跨 cell 写，走 mt_write remove 请求
- Verification: 所有 0321 / 0322 / 0324 + bus_in_out 回归 PASS；grep `ctx.writeLabel\|ctx.getLabel\|ctx.rmLabel` in `packages/` + `scripts/tests/` 返回 0
- Acceptance: 无旧 API 残留；无 silent failure
- Rollback: revert commit

## Step 5 — docs 同步 + runlog

- Scope:
  - `docs/ssot/host_ctx_api.md` — §7 Deprecated API 段落更新为"0325 已移除"（0323 原文写的是 DEPRECATED + 兼容期；本迭代把这两个都变过去式）
  - `docs/ssot/runtime_semantics_modeltable_driven.md` — §5.3b 或等价位置新增 "0325 ctx API 收紧结果" 段落
  - `docs/handover/dam-worker-guide.md` — 开发者迁移提示
- Files:
  - 以上 docs
- Commands:
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs` PASS
- Acceptance: docs 口径与 V1N 实装一致
