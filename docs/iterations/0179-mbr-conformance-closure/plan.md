---
title: "0179 — Plan (WHAT/WHY)"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0179-mbr-conformance-closure
id: 0179-mbr-conformance-closure
phase: phase1
---

# 0179 — Plan (WHAT/WHY)

## Goal

- 把当前 `MBR` 的“实现口径、验证口径、规约口径”重新对齐，使其可以被明确判定为符合现行规约，而不是只靠 `Model 100` 链路碰巧跑通。
- 清理已过时的 legacy MBR 验证预期，补齐现规约要求但当前缺失的 `runtime_mode` 窗口验证。

## Scope

- In scope:
  - 审核并收口 `MBR` 当前 product path：`scripts/run_worker_v0.mjs` + `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
  - 替换或重写当前失真的 `scripts/validate_mbr_patch_v0.mjs`
  - 补充 `edit -> running` 窗口下 `MBR` 不得产生业务副作用的合同测试
  - 评估并处理 `mbr_role_v0.json` 中误导性的旧 transport config labels
  - 更新相应 SSOT / runlog / iteration index
- Out of scope:
  - 不扩展新的业务桥接类型
  - 不新增通用 CRUD / create_model / cell_clear 的 MBR 兼容路径
  - 不重构 remote worker 业务逻辑，只处理 `MBR` 合规边界

## Invariants / Constraints

- `MBR` 只允许标准业务事件桥接；generic CRUD / `create_model` / `cell_clear` 不得再经 `Matrix -> MBR -> MQTT` 转发。
- Matrix / MQTT bootstrap 只允许从 Model 0 `(0,0,0)` 读取，不再依赖独立 env fallback 或负数模型旧配置标签。
- `runtime_mode=edit` 期间，连接可以建立，但业务桥接和副作用不得生效；只有 `running` 后才允许处理桥接。
- 负数系统模型可以承载 helper / policy / routing 规则，但不应保留会误导现行 product path 的死配置。
- 不做兼容；如果旧测试验证的是已废弃合同，应直接修正测试，而不是恢复旧行为。

## Success Criteria

- `MBR` 合规 gate 明确为一组现行测试，且全部 PASS。
- `scripts/validate_mbr_patch_v0.mjs` 不再要求 legacy generic CRUD / `submodel_create` / `mbr_remote_model_id` topic 这类旧合同。
- 新增或更新测试，能证明 `runtime_mode=edit` 时注入 Matrix/MQTT 消息不会产生 `mbr_mgmt_to_mqtt` / `mbr_mqtt_to_mgmt` 业务副作用。
- `mbr_role_v0.json` 中不再保留会误导审计的旧 transport config labels，或被显式清理/替换为现行 routing-only labels。
- 文档和 runlog 能让无上下文读者判断：当前 `MBR` 为什么算符合规约。

## Inputs

- Created at: 2026-03-08
- Iteration ID: 0179-mbr-conformance-closure
- Upstream:
  - `0176-worker-spec-audit`
  - `0177-worker-boundary-remediation`
