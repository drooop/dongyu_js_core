---
title: "0223 — local-cluster-browser-evidence Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0223-local-cluster-browser-evidence
id: 0223-local-cluster-browser-evidence
phase: phase1
---

# 0223 — local-cluster-browser-evidence Plan

## Goal

- 用 Browser Task + Playwright MCP 为本地 cluster 生成 `0210-0217` 的脚本化浏览器取证。

## Scope

- In scope:
  - 本地 cluster browser test matrix
  - browser task request/result/artifact
  - 本地环境 browser evidence 裁决
- Out of scope:
  - 不做本地 rollout（留给 0222）
  - 不做远端浏览器（留给 0225）

## Invariants / Constraints

- `0222` 已冻结 local stale adjudication 与 canonical checklist。
- `0223` 开始前必须先由 `0229` 证明 local ops bridge 可用，并把本地 management-plane 带回可执行状态。
- 默认必须使用 browser task + Playwright MCP，而不是人工点击。
- artifact 必须可审计、可回放。

## Success Criteria

- 本地 cluster 核心路径有脚本化浏览器证据
- artifact、console、结构化结果齐全
- 输出 `Local environment effective|not effective`

## Inputs

- Created at: 2026-03-23
- Iteration ID: 0223-local-cluster-browser-evidence
- Depends on:
  - `0222-local-cluster-rollout-baseline`
  - `0229-local-ops-bridge-smoke`
