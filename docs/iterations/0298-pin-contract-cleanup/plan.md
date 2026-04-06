---
title: "0298 — pin-contract-cleanup Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-06
source: ai
iteration_id: 0298-pin-contract-cleanup
id: 0298-pin-contract-cleanup
phase: phase0
---

# 0298 — pin-contract-cleanup Plan

## Goal

- 清理 `pin.table.* / pin.single.* / pin.model.*` 在非主路径上的历史残留。

## Scope

- In scope:
  - `packages/worker-base/src/runtime.mjs` compat handler 残留
  - `packages/worker-base/system-models/intent_handlers_home.json`
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json`
  - `packages/worker-base/system-models/llm_cognition_config.json`
  - `CLAUDE.md` 中 `PIN_SYSTEM` 的同步更新
- Out of scope:
  - 新业务功能
  - Matrix / Slide UI / Three.js 业务实现
  - `0294` 主路径重构

## Invariants / Constraints

- 本 iteration 只做 cleanup，不重开合同设计。
- 以 `0292` / `0294` 的新 pin/payload 合同为唯一前提。
- 范围固定，不允许膨胀到其它历史残留。

## Success Criteria

- Phase 1 planning 完成后，执行者对 cleanup 范围无歧义。

## Inputs

- Created at: 2026-04-06
- Iteration ID: 0298-pin-contract-cleanup
