---
title: "0186 — UI Overlay Commit Policy Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0186-ui-overlay-commit-policy
id: 0186-ui-overlay-commit-policy
phase: phase1
---

# 0186 — UI Overlay Commit Policy Resolution

## Execution Strategy

- 先用红灯测试分别钉住：
  - `remote_store` 的 overlayStore / effectiveValue / on_submit flush 语义
  - `renderer` 对 `commit_policy` 的 stage/commit 行为
- 再以最小实现补 `remote_store + renderer + host adapter`，不先改所有模型表。
- 最后更新 SSOT / user-guide，并做回归验证；只有显式声明 `commit_policy` 的 label 才启用新语义。

## Step 1

- Scope:
  - 建立红灯合同，钉住 overlay/commit 的最小运行语义。
- Files:
  - `scripts/tests/test_0186_remote_store_overlay_contract.mjs`
  - `scripts/tests/test_0186_renderer_commit_policy_contract.mjs`
  - `docs/iterations/0186-ui-overlay-commit-policy/runlog.md`
- Verification:
  - `node scripts/tests/test_0186_remote_store_overlay_contract.mjs`
  - `node scripts/tests/test_0186_renderer_commit_policy_contract.mjs`
- Acceptance:
  - 两条测试先 FAIL，且失败点分别落在：
    - 缺失 `getEffectiveLabelValue` / `stageOverlayValue`
    - renderer 仍按 committed snapshot 读值、仍逐帧 dispatch
- Rollback:
  - 删除新增测试文件。

## Step 2

- Scope:
  - 实现 overlayStore / commit_policy，并补文档与回归验证。
- Files:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `docs/iterations/0186-ui-overlay-commit-policy/runlog.md`
- Verification:
  - `node scripts/tests/test_0186_remote_store_overlay_contract.mjs`
  - `node scripts/tests/test_0186_renderer_commit_policy_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
  - `node scripts/tests/test_0185_remote_negative_state_local_first_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Acceptance:
  - overlay 只对显式声明 `commit_policy != immediate` 的正数 label 生效
  - committed snapshot 不被 overlay 直接污染
  - `on_submit` overlay 会在触发 action 前先 commit 到 ModelTable
  - 未声明 `commit_policy` 的现有节点行为保持不变
- Rollback:
  - 还原 renderer/remote_store/demo_app 与 docs 到本迭代前版本，并删除新增测试。

## Notes

- Generated at: 2026-03-11
- Phase note:
  - execution resumed after `0187` completion
