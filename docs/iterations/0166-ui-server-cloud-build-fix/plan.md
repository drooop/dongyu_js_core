---
title: "Iteration 0166-ui-server-cloud-build-fix Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0166-ui-server-cloud-build-fix
id: 0166-ui-server-cloud-build-fix
phase: phase1
---

# Iteration 0166-ui-server-cloud-build-fix Plan

## Goal

- 修复 `ui-model-demo-frontend` production build 被 `packages/worker-base/src/runtime.mjs` 顶层 `node:module` 引用打断的问题，使 cloud deploy 可以继续。

## Scope

- In scope:
  - 复现并固化 frontend build fail。
  - 修复 `runtime.mjs` 的 browser bundle 兼容性回归。
  - 验证 frontend build 恢复通过，并继续 0165 远端 deploy。
- Out of scope:
  - 处理当前工作树中与 deploy 无关的 UI/renderer 脏改动。
  - 重构 MQTT 适配整体架构。

## Invariants / Constraints

- 必须先有 failing test，再写生产修复代码。
- 改动面限制在 build blocker 根因，不顺手改 unrelated behavior。
- 继续遵守 0165 的 remote deploy clean-source 约束。

## Success Criteria

- `npm -C packages/ui-model-demo-frontend run build` PASS。
- 远端 `dy-ui-server` 镜像构建不再因 `runtime.mjs` 顶层 `createRequire` 失败。
- 0165 deploy 可继续推进。

## Inputs

- Created at: 2026-03-06
- Iteration ID: 0166-ui-server-cloud-build-fix
