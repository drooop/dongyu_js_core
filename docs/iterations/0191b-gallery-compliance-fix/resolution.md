---
title: "Iteration 0191b-gallery-compliance-fix Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0191b-gallery-compliance-fix
id: 0191b-gallery-compliance-fix
phase: phase1
---

# Iteration 0191b-gallery-compliance-fix Resolution

## Execution Strategy

- 先补 registry 合规，再做常量一致性收口。
- 不改变 Gallery 功能，只做合规与一致性修复。

## Step 1

- Scope:
  - 在 `CLAUDE.md` 中补齐 `-101/-102/-103` 登记
  - 补齐 `-100..-199` 分配策略
- Files:
  - `CLAUDE.md`
- Verification:
  - `rg -n "Model -101|Model -102|Model -103|-100..-199" CLAUDE.md`
- Acceptance:
  - registry 中已出现 3 个具体 id 和区间策略
- Rollback:
  - 回退 `CLAUDE.md`

## Step 2

- Scope:
  - 将 `gallery_store.js` 中的硬编码 `-2` 改为常量
- Files:
  - `packages/ui-model-demo-frontend/src/gallery_store.js`
  - `packages/ui-model-demo-frontend/src/model_ids.js`
- Verification:
  - `rg -n "getModel\\(-2\\)|EDITOR_STATE_MODEL_ID" packages/ui-model-demo-frontend/src/gallery_store.js packages/ui-model-demo-frontend/src/model_ids.js`
- Acceptance:
  - `gallery_store.js` 不再直接写 `-2`
- Rollback:
  - 回退 `gallery_store.js`

## Step 3

- Scope:
  - 跑最小回归并收口
- Files:
  - `packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_gallery_events.mjs`
  - `docs/iterations/0191b-gallery-compliance-fix/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `node packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_gallery_events.mjs`
- Acceptance:
  - Gallery 验证保持通过
  - runlog / ITERATIONS 已记录
- Rollback:
  - 回退本轮文档登记与提交
