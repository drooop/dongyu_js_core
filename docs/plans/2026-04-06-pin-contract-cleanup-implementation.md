---
title: "Pin Contract Cleanup Implementation Plan"
doc_type: plan
status: active
updated: 2026-04-06
source: ai
---

# Pin Contract Cleanup Implementation Plan

## Goal

清理 `pin.table.* / pin.single.* / pin.model.*` 在已锁定范围内的历史残留。

## Implementation Order

1. 删 runtime compat handler
2. 迁 system-model / config 残留
3. 同步 `CLAUDE.md` 与相关文档
4. 本地 redeploy 与页面回归

## Exact Scope

- `packages/worker-base/src/runtime.mjs`
- `packages/worker-base/system-models/intent_handlers_home.json`
- `packages/worker-base/system-models/home_catalog_ui.json`
- `deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json`
- `packages/worker-base/system-models/llm_cognition_config.json`
- `CLAUDE.md`

## Verification Expectations

- grep 不再命中这些文件中的旧 family
- `0294` 主路径相关 tests 继续 PASS
- 本地浏览器继续确认：
  - 首页 CRUD
  - 颜色生成器
  - `0270`
  - `Static`
