---
title: "Iteration 0171-prompt-filltable-owner-chain Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0171-prompt-filltable-owner-chain
id: 0171-prompt-filltable-owner-chain
phase: phase1
---

# Iteration 0171-prompt-filltable-owner-chain Resolution

## Execution Strategy

- 先用失败测试锁定三类回归：preview/apply 公共合同、owner materialization、system-model schema 合同。
- 再在 `server.mjs` 中引入 owner-chain 三层：LLM parse、owner preview、owner apply/materialization。
- 用 `filltable_policy.mjs` 承接 `candidate_changes` 的纯校验与 digest 计算。
- 最后同步 system-model prompt/schema、UI 文案、验收脚本、runbook 与共享知识库口径。

## Step 1

- Scope:
  - 建立 owner-chain 的失败测试，确认当前实现仍暴露旧 records 合同，并缺少 `candidate_changes` / owner materialization。
- Files:
  - `scripts/tests/test_0171_filltable_owner_chain_contract.mjs`
  - `scripts/tests/test_0171_filltable_owner_materialization.mjs`
  - `scripts/tests/test_0171_filltable_owner_schema_contract.mjs`
- Verification:
  - `node scripts/tests/test_0171_filltable_owner_chain_contract.mjs`
  - `node scripts/tests/test_0171_filltable_owner_materialization.mjs`
  - `node scripts/tests/test_0171_filltable_owner_schema_contract.mjs`
- Acceptance:
  - 3 个测试先失败，且失败原因与 owner-chain 缺口一致。
- Result:
  - PASS。3 个守卫测试已创建并用于锁定旧 bridge 残留。

## Step 2

- Scope:
  - 在宿主侧实现 `candidate_changes` preview/apply、owner resolver、owner materialization，并移除公共 payload 中的 records 口径。
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-server/filltable_policy.mjs`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Verification:
  - `node scripts/tests/test_0171_filltable_owner_chain_contract.mjs`
  - `node scripts/tests/test_0171_filltable_owner_materialization.mjs`
  - `node scripts/tests/test_0155_prompt_filltable_policy.mjs`
  - `node scripts/tests/test_0170_bun_and_filltable_prompt_contract.mjs`
- Acceptance:
  - preview 只返回 `accepted_changes/rejected_changes`。
  - apply 只接受 `accepted_changes`，旧 payload 被显式拒绝。
- Result:
  - PASS。`resolveFilltableOwner()` / `materializeFilltableChange()` 已落地，`model_id=0` 与负数模型在 owner-chain 中显式拒绝。

## Step 3

- Scope:
  - 更新 system-model prompt/schema、intent handler 状态文案与脚本验收口径。
- Files:
  - `packages/worker-base/system-models/llm_cognition_config.json`
  - `packages/worker-base/system-models/intent_handlers_prompt_filltable.json`
  - `packages/worker-base/system-models/server_config.json`
  - `scripts/ops/verify_0155_prompt_filltable.sh`
  - `scripts/ops/README.md`
- Verification:
  - `node scripts/tests/test_0171_filltable_owner_schema_contract.mjs`
  - `bash scripts/ops/verify_0155_prompt_filltable.sh --base-url http://127.0.0.1:30900`
- Acceptance:
  - prompt/schema 只要求 `candidate_changes`。
  - 0155 验收脚本不再依赖旧 records 字段作为主路径。
- Result:
  - PASS。系统模型、脚本和 README 已切到 owner-chain 主口径，并保留 legacy payload 显式拒绝测试。

## Step 4

- Scope:
  - 复跑本地 Orbstack + 浏览器验证，并更新 runlog / runbook / 共享知识库。
- Files:
  - `docs/iterations/0171-prompt-filltable-owner-chain/runlog.md`
  - `docs/user-guide/llm_cognition_ollama_runbook.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs-shared/software-worker/mt-table-local-generation-via-owner-chain.md`
- Verification:
  - `bash scripts/ops/ensure_runtime_baseline.sh`
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `bash scripts/ops/verify_0155_prompt_filltable.sh --base-url http://127.0.0.1:30900`
  - 浏览器 `http://127.0.0.1:30900/#/prompt` 的 `Preview -> Apply`
- Acceptance:
  - 本地 owner-chain 闭环完成，文档已切换为正式 owner-chain 口径。
- Result:
  - PASS。Orbstack 本地栈已重建并通过 `verify_0155`，浏览器 `Preview -> Apply` 成功显示 `accepted_changes` 与 `applied_changes`。
