---
title: "0330 — model100-submit-v1n Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-22
source: ai
iteration_id: 0330-model100-submit-v1n
id: 0330-model100-submit-v1n
phase: phase1
---

# 0330 — model100-submit-v1n Plan

## Goal

- 修复本地 `Model 100` 当前仍执行旧 `ctx.getLabel/writeLabel` 语义，导致点击 `Generate Color` 后颜色不更新的问题
- 保持现有按钮释放修复不回退

## Scope

- In scope:
  - `packages/worker-base/system-models/test_model_100_ui.json`
  - 相关 contract tests
  - 本地重部署与真实浏览器验证
- Out of scope:
  - `remote-worker` / `mbr-worker` patch
  - renderer single-flight 再次改动

## Success Criteria

1. `Model 100` 本地 submit path 不再留下 `__error_prepare_model100_submit_from_pin`
2. 点击 `Generate Color` 后颜色值发生变化
3. 真实浏览器里按钮能恢复可点击
