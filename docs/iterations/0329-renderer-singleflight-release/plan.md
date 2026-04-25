---
title: "0329 — renderer-singleflight-release Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-22
source: ai
iteration_id: 0329-renderer-singleflight-release
id: 0329-renderer-singleflight-release
phase: phase1
---

# 0329 — renderer-singleflight-release Plan

## Goal

- 修复真实浏览器中 `E2E 颜色生成器` 已经完成处理，但 `Generate Color` 按钮仍持续 `loading/disabled` 的问题
- 保证 renderer 在跨页面重载后不会重复生成同一个 `op_id`，避免 single-flight 本地锁无法释放

## Scope

- In scope:
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `scripts/tests/test_0329_renderer_opid_uniqueness_contract.mjs`
  - `scripts/validate_ui_renderer_v0.mjs`（若旧断言仍依赖固定 `op_1`，同步对齐）
- Out of scope:
  - worker patch / deploy config
  - 业务协议变更

## Success Criteria

1. 新测试能证明两个 fresh renderer 会话第一次点击生成不同 `op_id`
2. 旧 renderer 验证面不会再硬编码 `op_1`
3. 本地浏览器再点 `Generate Color` 后，按钮不再无限 loading
