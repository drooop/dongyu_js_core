---
title: "0140 — Model 100 Records-Only E2E (MBR + Program Model Migration)"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0140-model100-records-e2e
id: 0140-model100-records-e2e
phase: phase1
---

# 0140 — Model 100 Records-Only E2E (MBR + Program Model Migration)

## 0. Metadata
- ID: 0140-model100-records-e2e
- Date: 2026-02-09
- Owner: Codex + User
- Branch: dev_0140-model100-records-e2e
- Related:
  - [[iterations/0139-records-only-patch/plan]]
  - [[ssot/mt_v0_patch_ops]]
  - [[ssot/runtime_semantics_modeltable_driven]]
  - deploy/sys-v1ns/mbr/patches/mbr_role_v0.json
  - packages/worker-base/system-models/test_model_100_full.json
  - scripts/validate_mbr_patch_v0.mjs

## 1. Goal
让 Model 100 的“UI 事件 → MBR → MQTT → Worker → 程序模型函数”链路使用 **纯 records 的 mt.v0 patch**，并让程序模型从“请求 Cell 的 labels”读取参数（`ctx.getLabel()`），不再依赖 `IN label.v.action/data`。

## 2. Background
0139 已落盘 runtime 的三路径 records 处理（records+trigger / records-only / fallback）。
但当前 Model 100 的 MBR 路由仍使用 `records: [] + action/data` 的 legacy 信封，导致 records-only 范式无法端到端闭环。

## 3. Invariants (Must Not Change)
- mt.v0 patch 信封字段保持最小集合：`version` / `op_id` / `records`（不新增 `action`/`data` 等外层字段）。
- MQTT 入站 applyPatch 仍使用 `allowCreateModel: false`（外部不能创建模型）。
- 对非 Model 100 的链路保持兼容：`records: []` 仍走 legacy fallback 行为。
- 不改动 topic 分段协议（`uiput_mm_v1` / `uiput_9layer_v2` 兼容保持）。

## 4. Scope

### 4.1 In Scope
- MBR：将 Model 100 的 `mbr_mgmt_to_mqtt` 路由改为构造 **records-only** payload（把 action/data/timestamp 写入请求 Cell）。
- Worker（Model 100 定义）：将 PIN_IN 声明升级为 cell-owned binding + `trigger_funcs`，让 runtime records+trigger 能触发函数。
- Worker（程序模型函数）：将 `on_model100_event_in` 从读取 `inLabel.v.action` 迁移到 `ctx.getLabel()` 读取请求 Cell labels。
- 验证：更新/新增脚本验证，至少覆盖：
  - MBR 发布到 MQTT 的 Model 100 payload 为 records-only
  - Worker 收到 records-only 后能触发函数路径
- 文档同步评估：`docs/user-guide/modeltable_user_guide.md`、`docs/ssot/runtime_semantics_modeltable_driven.md`（是否需要补一段“records-only 请求 Cell 约定”的说明）。

### 4.2 Out of Scope
- runtime 三路径逻辑去重（属于后续 P3）。
- Workspace Phase 1：p=0/p=1 schema 机制（单独 iteration）。
- 全量迁移所有模型的 program functions / MBR 路由（本次只收口 Model 100）。

## 5. Non-goals
- 不追求一次性删除 legacy fallback（`records: []`）逻辑。
- 不引入新的外部协议字段或新的 bus 类型。

## 6. Success Criteria (Definition of Done)
1. `node scripts/validate_mbr_patch_v0.mjs` PASS，且 Model 100 路径发布的 payload 为 records-only（`records.length > 0`，且不依赖外层 `action/data`）。
2. 新增/更新的验证脚本覆盖 Worker 侧：records-only 入站能触发 `on_model100_event_in`（通过 `trigger_funcs` intercept 路径）。
3. `node scripts/validate_pin_mqtt_loop.mjs` 仍保持 PASS（回归保证）。
4. 相关文档（若评估需要）更新完成，并在 iteration runlog 记录 “docs updated”。

## 7. Risks & Mitigations
- Risk: MBR / Worker topic mode 与 pinName 不一致（如 `event` vs `event_in`）。
  - Impact: 入站不被 runtime 接受（pin 未声明）。
  - Mitigation: 本 iteration 明确统一为 `pinName = "event"`（topic 末段为 `event`），并在验证脚本断言 topic。
- Risk: 触发 label key 与参数 labels key 冲突（覆盖 action 等）。
  - Impact: 参数丢失或重复触发。
  - Mitigation: 触发 label 使用 pinName（`event`），参数使用独立 keys（`action`, `data`, `timestamp`）。

## 8. Open Questions
- None（本 iteration 选择：请求 Cell 固定为 `Cell(100, 1, 0, 0)`，参数 keys 为 `action`/`data`/`timestamp`；触发 key 为 `event`）。

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - [[ssot/mt_v0_patch_ops]]
  - [[ssot/runtime_semantics_modeltable_driven]]
- Notes:
  - 参数通过 records 写入 ModelTable；触发通过 `label.t === 'IN'` 的显式 label 驱动。

### 9.2 Charter Compliance Checklist
- Charter references:
  - [[charters/dongyu_app_next_runtime]]
- Notes:
  - 保持“UI 只写格子，副作用由 ModelTable 驱动”的边界不变。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
