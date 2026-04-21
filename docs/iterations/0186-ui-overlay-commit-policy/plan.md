---
title: "0186 — UI Overlay Commit Policy"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0186-ui-overlay-commit-policy
id: 0186-ui-overlay-commit-policy
phase: phase1
---

# 0186 — UI Overlay Commit Policy

## Goal

- 把 UI 高频交互从“每步都必须先落后端 ModelTable 再回显”收敛为正式规约：
  - `committed state = ModelTable`
  - `transient interaction state = client overlay`
  - 由 label/model 定义侧声明 `commit_policy`
- 在不削弱 “ModelTable 是唯一 committed/shared truth” 的前提下，明确 slider / input 等高频控件的交互语义。
- `0187` 已完成；本迭代进入正式实现。

## Scope

- In scope:
- 为高频交互定义 `commit_policy`、`interaction_mode`、`commit_target` 的目标规约。
- 明确默认推导：
  - `immediate -> committed_direct`
  - `on_change|on_blur|on_submit -> overlay_then_commit`
- 明确 `overlayStore` 与 `snapshot.models` 的边界：
  - overlay 不进入 committed snapshot
  - renderer 读取 `effectiveValue = overlay ?? committed`
- 明确 commit/ack/error 生命周期与 SSE 回流冲突策略。
- Out of scope:
- 不修改 runtime / system-models 解释语义。
- 不把 overlay 默认施加到所有正数模型；仅对显式声明 `commit_policy != immediate` 的 label 生效。
- 不回退或重建 legacy 外发通路；该工作已在 `0187` 完成。

## Invariants / Constraints

- `UI is projection of ModelTable. never truth source.` 仍成立，但需精化为：
  - UI 是 committed ModelTable 的投影 + transient interaction overlay。
- overlay 不是 SSOT，不得伪装成 committed ModelTable。
- 不允许把正数业务模型的未提交交互态直接乐观写入 `snapshot.models`。
- `commit_policy` 必须是模型/label 侧声明，不得按控件类型在 renderer 中写死。
- `0187` 已完成，legacy mailbox->Matrix 外发通路已移除；当前实现不得重新引入任何 direct Matrix forward 旁路。

## Success Criteria

- 形成一套可实施的 SSOT 设计，至少回答：
  - 哪些 label 允许 overlay
  - overlay 存在哪里
  - renderer 如何读取 `overlay ?? committed`
  - commit 成功/失败/并发回包时的行为
- 给出 slider 与 input 两个示例：
  - `on_change` / `on_submit`
  - `immediate` 逐帧 commit 的显式声明方式
- 明确指出：如果用户确实要求 `0 -> 100 -> 0` 全轨迹进入 ModelTable，应使用 `commit_policy=immediate`。
- 形成可运行的最小实现：
  - `remote_store` 持有 overlayStore
  - renderer 按 `commit_policy` 选择 stage / commit
  - 未声明 `commit_policy` 的现有节点保持现状

## Inputs

- Created at: 2026-03-11
- Iteration ID: 0186-ui-overlay-commit-policy
- Dependency:
  - `0187-remove-legacy-ui-egress-paths` completed before execution
- Decision:
  - user approved resuming implementation after `0187` completion
