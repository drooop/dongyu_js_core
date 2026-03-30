---
title: "0187 — Remove Legacy UI Egress Paths"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0187-remove-legacy-ui-egress-paths
id: 0187-remove-legacy-ui-egress-paths
phase: phase1
---

# 0187 — Remove Legacy UI Egress Paths

## Goal

- 彻底移除当前仍残留的 legacy UI 外发通路，尤其是 mailbox -> `forward_ui_events` -> `ctx.sendMatrix(...)` 这一类不经过 Model 0 `pin.bus.out` authority 的路径。
- 把 “UI 是否外发” 的实际实现与现规约对齐为同一件事：
  - 只有显式接到 Model 0 `pin.bus.out` 的动作才允许离开本地 runtime。
- 为后续 `0186` 的 overlay/commit 实现提供干净边界，避免“交互态 commit”与 legacy 外发旁路混在一起。

## Scope

- In scope:
- 审计并列出当前仍存在的 legacy UI egress paths：
  - `ui_to_matrix_forwarder.json`
  - host ctx / server 侧相关 legacy direct-send hooks
  - 其他未走 Model 0 的 UI 外发入口
- 明确哪些是兼容保留、哪些必须删除、哪些需改为 relay 到 Model 0。
- 规划目标实现：
  - 删除 legacy mailbox direct sendMatrix path
  - 保留/迁移为 Model 0 `pin.bus.out` authority 的正式链
- 补充或更新 contract tests，证明未接到 Model 0 的动作不会外发。
- Out of scope:
- 不在本迭代中实现 overlay/commit-policy。
- 不放宽正数业务模型 direct mutation。
- 不改动与 UI 外发无关的 worker 业务逻辑。

## Invariants / Constraints

- 以 `docs/ssot/runtime_semantics_modeltable_driven.md` 7.4 为目标规约。
- 必须区分“目标规约”与“当前现状”：
  - 当前 repo 仍存在 legacy `forward_ui_events` 通路
  - 本迭代的目的就是去掉它，而不是假设它已经不存在
- 任何外发 authority 都必须最终收敛到 Model 0 `(0,0,0)` 的 `pin.bus.out`。
- 在 legacy 通路彻底删除前，不得宣布“逐帧外发天然做不到”。
- 实施时必须显式检查：
  - tier placement
  - data ownership
  - data flow
  - data chain

## Success Criteria

- 能明确列出并修正当前所有仍可绕过 Model 0 authority 的 UI 外发通路。
- 更新后，repo 中不再存在默认 `mailbox -> sendMatrix` 的 UI forward path。
- 新增/更新测试，至少证明：
  - 未接到 Model 0 `pin.bus.out` 的动作不会外发
  - 颜色生成器等显式接线 submit 仍能外发
- 为 `0186` 提供可继续实施的干净前提，并在 runlog 中明确记录。

## Inputs

- Created at: 2026-03-11
- Iteration ID: 0187-remove-legacy-ui-egress-paths
- Trigger:
  - user decided to prioritize removing legacy egress paths before implementing overlay/commit policy
- Upstream:
  - `0181-color-generator-local-egress-example`
  - `0182-color-generator-local-submit-chain`
