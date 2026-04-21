---
title: "0150 — Matrix adapter 基座化（删除 bus-mgmt，全量统一）"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0150-matrix-adapter-into-worker-base
id: 0150-matrix-adapter-into-worker-base
phase: phase1
---

# 0150 — Matrix adapter 基座化（删除 bus-mgmt，全量统一）

## 0. Metadata
- ID: 0150-matrix-adapter-into-worker-base
- Date: 2026-02-14
- Owner: AI (User Approved)
- Branch: dev_0150-matrix-adapter-into-worker-base
- Related:
  - `CLAUDE.md` (CAPABILITY_TIERS, fill-table-first)
  - `docs/ssot/fill_table_only_mode.md`
  - `packages/worker-base/`
  - `packages/bus-mgmt/` (to be removed)

## 1. Goal
把 Matrix mgmt adapter（原 `packages/bus-mgmt/src/matrix_live.js` + `loopback.js`）迁入 `packages/worker-base/` 作为 Tier1 基座能力，并删除 `packages/bus-mgmt/`，让以下入口全量统一复用同一基座实现：
- `mbr-worker`
- `ui-server`
- `scripts/*`（验证/worker bootstrap）

## 2. Background
Fill-Table-Only/`$ft` 的治理目标是：当任务被明确要求“只能填表实现”时，强制禁止旁路修改 runtime/服务逻辑。
但 mgmt adapter 属于“基座设施能力”而非业务填表能力；如果它长期作为独立包存在（`packages/bus-mgmt/`），会造成“服务并非由基座+填表形成”的架构偏差，也让 ft 合规口径难以一致。

用户决策：
- `packages/bus-mgmt/**` 不应长期存在于基座外。
- 迁移范围：全量（`mbr-worker + ui-server + scripts`）。
- 迁移完成后：本次直接删除 `packages/bus-mgmt/`。

## 3. Invariants (Must Not Change)
- 运行时语义不变：不得修改 `packages/worker-base/src/runtime.js` / `runtime.mjs` 的解释器行为（本迭代仅做 adapter 基座化与引用统一）。
- Fill-Table-Only 规则本身不变（本迭代不是 ft 任务）。
- 行为兼容：原先可用的脚本/worker 入口在迁移后仍可运行（或明确标注 archived-only）。
- 对外 mgmt event 格式不变（`dy.bus.v0`）。

## 4. Scope
### 4.1 In Scope
- 新增 `packages/worker-base/src/matrix_live.js`（Matrix live adapter，包含 send 429 retry/backoff）。
- 新增 `packages/worker-base/src/loopback.js`（Loopback adapter）。
- 全量替换引用路径：从 `packages/bus-mgmt/**` 切到 `packages/worker-base/**`。
- `ui-server` 改为复用基座 adapter（不再自带一套 Matrix 发送队列实现）。
- 删除 `packages/bus-mgmt/`。
- 更新相关文档引用（如 handover guide）。

### 4.2 Out of Scope
- 改动业务模型（deploy/sys-v1ns patches、system-models 语义）。
- 变更 Synapse/EMQX 的部署拓扑（仅在验证需要时调整配置参数，需记录 runlog）。

## 5. Success Criteria
- `rg -n "packages/bus-mgmt" -S .` 无命中（archive/historical 若保留需显式例外并写入 runlog）。
- `docker build -f k8s/Dockerfile.mbr-worker` 成功。
- 本地 e2e：`NODE_PATH=$PWD/node_modules node /tmp/test_color_latency_pw.cjs http://127.0.0.1:30900 10` 为 PASS。
- 关键脚本可运行：至少 `scripts/run_worker_v0.mjs` 与 `scripts/validate_mailbox_to_matrix_v0.mjs` 的 import 路径正确（能启动到连接阶段或给出可解释错误）。

