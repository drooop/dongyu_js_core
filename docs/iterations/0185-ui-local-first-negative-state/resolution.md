---
title: "Iteration 0185-ui-local-first-negative-state Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0185-ui-local-first-negative-state
id: 0185-ui-local-first-negative-state
phase: phase1
---

# Iteration 0185-ui-local-first-negative-state Resolution

## Execution Strategy

- 先用 remote store 红灯测试证明当前实现只对 `-2` 做本地优化，遗漏其他负数 UI state。
- 再以最小实现扩大“负数本地态即时更新”范围，同时保持远端后台同步和正数模型边界不变。
- 最后做浏览器回归，验证 input 与 slider 在 remote mode 下即时更新。

## Step 1

- Scope:
  - 建立规约审计与红灯测试，钉住当前 lag 的根因在 remote store 对负数本地态优化范围过窄。
- Files:
  - `scripts/tests/test_0185_remote_negative_state_local_first_contract.mjs`
  - `docs/iterations/0185-ui-local-first-negative-state/runlog.md`
- Verification:
  - `node scripts/tests/test_0185_remote_negative_state_local_first_contract.mjs`
- Acceptance:
  - 测试在修复前 FAIL，明确指出 `-102` 等负数本地态未被即时本地 patch。
- Rollback:
  - 删除新增测试文件。

## Step 2

- Scope:
  - 修复 remote store 本地优先策略，并验证浏览器 input / slider 交互。
- Files:
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - 必要时 `scripts/tests/*0185*`
  - `docs/iterations/0185-ui-local-first-negative-state/runlog.md`
- Verification:
  - `node scripts/tests/test_0185_remote_negative_state_local_first_contract.mjs`
  - `node scripts/tests/test_0177_model100_input_draft_contract.mjs`
  - `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - 浏览器 remote mode 手测 input / slider
- Acceptance:
  - 负数本地态控件在 remote mode 下即时更新
  - 正数业务模型 direct mutation 仍拒绝
  - submit/双总线链路不回退
- Rollback:
  - 还原 `remote_store.js` 到本迭代前版本，并回滚 0185 测试。

## Notes

- Generated at: 2026-03-11
