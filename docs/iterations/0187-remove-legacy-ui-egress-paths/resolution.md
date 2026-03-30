---
title: "0187 — Remove Legacy UI Egress Paths Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0187-remove-legacy-ui-egress-paths
id: 0187-remove-legacy-ui-egress-paths
phase: phase1
---

# 0187 — Remove Legacy UI Egress Paths Resolution

## Execution Strategy

- 先做基线审计，明确当前所有 legacy UI 外发路径与目标规约之间的差异。
- 再按“删除默认 direct-send、保留 Model 0 authority、补测试”的顺序实施。
- 完成后回到 `0186`，再做 overlay/commit-policy 的正式实现。

## Step 1

- Scope:
  - 建立审计基线与红灯测试，钉住 legacy UI egress 的真实入口。
- Files:
  - `packages/worker-base/system-models/ui_to_matrix_forwarder.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/*0187*`
  - `docs/iterations/0187-remove-legacy-ui-egress-paths/runlog.md`
- Verification:
  - 至少一条新测试先 FAIL，明确指出 legacy path 仍存在
- Acceptance:
  - 能以代码证据列出所有 legacy path，而不是只凭口头判断
- Rollback:
  - 删除新增审计测试与文档记录

## Step 2

- Scope:
  - 删除或迁移 legacy 外发通路，并补回归验证。
- Files:
  - `packages/worker-base/system-models/ui_to_matrix_forwarder.json`
  - `packages/worker-base/system-models/test_model_100_ui.json`
  - `packages/ui-model-demo-server/server.mjs`
  - 必要时相关 tests/docs
- Verification:
  - 新增 `0187` 合同测试 PASS
  - `node scripts/tests/test_0177_model100_submit_ui_contract.mjs`
  - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`
  - 如涉及远端，再补 cloud 验收
- Acceptance:
  - 默认 mailbox direct-send path 不再存在
  - 只有显式接入 Model 0 的动作仍能外发
  - `0186` 的依赖条件解除
- Rollback:
  - 还原 legacy path 相关文件到本迭代前版本，并撤销新增测试。

## Notes

- Generated at: 2026-03-11
- Review gate:
  - user approved starting this iteration plan before resuming `0186`
