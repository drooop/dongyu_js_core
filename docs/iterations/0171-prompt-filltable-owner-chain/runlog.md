---
title: "Iteration 0171-prompt-filltable-owner-chain Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0171-prompt-filltable-owner-chain
id: 0171-prompt-filltable-owner-chain
phase: phase3
---

# Iteration 0171-prompt-filltable-owner-chain Runlog

## Environment

- Date: 2026-03-06
- Branch: `dev_0171-prompt-filltable-owner-chain`
- Runtime: local repo + Orbstack kubernetes + local Ollama (`mt-table`)

Review Gate Record
- Iteration ID: 0171-prompt-filltable-owner-chain
- Review Date: 2026-03-06
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: 用户已审核 owner-chain 方案，并要求审核通过后再开始执行。

## Execution Records

### Step 1

- Command:
  - 新建 0171 scaffold 并登记 `docs/ITERATIONS.md`
  - 创建失败测试：
    - `node scripts/tests/test_0171_filltable_owner_chain_contract.mjs`
    - `node scripts/tests/test_0171_filltable_owner_materialization.mjs`
    - `node scripts/tests/test_0171_filltable_owner_schema_contract.mjs`
- Key output:
  - 新增 3 个 owner-chain 守卫测试。
  - 失败点分别锁定在：缺少 `validateFilltableCandidateChanges`、server 仍暴露旧 records 字段、system-model prompt/schema 仍要求 `records`。
- Result: PASS
- Commit: pending

### Step 2

- Command:
  - 改造 `packages/ui-model-demo-server/filltable_policy.mjs`
  - 改造 `packages/ui-model-demo-server/server.mjs`
  - 同步 `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - 语法/守卫测试：
    - `node --check packages/ui-model-demo-server/server.mjs`
    - `node --check packages/ui-model-demo-server/filltable_policy.mjs`
    - `node scripts/tests/test_0171_filltable_owner_chain_contract.mjs`
    - `node scripts/tests/test_0171_filltable_owner_materialization.mjs`
    - `node scripts/tests/test_0155_prompt_filltable_policy.mjs`
    - `node scripts/tests/test_0170_bun_and_filltable_prompt_contract.mjs`
- Key output:
  - `filltable_policy` 已从 `records` 切为 `candidate_changes`，默认字段改为 `max_changes_per_apply`。
  - `server.mjs` 已落地：
    - `parseLlmFilltableResult()` 解析 `candidate_changes`
    - `resolveFilltableOwner()`
    - `previewCandidateChangesByOwner()`
    - `materializeFilltableChange()`
  - preview/apply 公共 payload 已切到：
    - `accepted_changes`
    - `rejected_changes`
    - `applied_changes`
  - 旧 records-only preview payload 在 apply 阶段显式拒绝：`legacy_preview_contract`。
- Result: PASS
- Commit: pending

### Step 3

- Command:
  - 更新 system-models / scripts / README：
    - `packages/worker-base/system-models/llm_cognition_config.json`
    - `packages/worker-base/system-models/intent_handlers_prompt_filltable.json`
    - `packages/worker-base/system-models/server_config.json`
    - `scripts/ops/verify_0155_prompt_filltable.sh`
    - `scripts/ops/README.md`
  - 验证：
    - `node scripts/tests/test_0171_filltable_owner_schema_contract.mjs`
- Key output:
  - LLM prompt/output schema 已切为 `candidate_changes`。
  - handler 状态文案已改为 `accepted_changes/rejected_changes/applied_changes`。
  - `verify_0155` 已改为：
    - preview 断言 `accepted_changes`
    - apply 断言 `applied_changes`
    - legacy payload 断言 `legacy_preview_contract`
    - 上限断言 `too_many_changes`
- Result: PASS
- Commit: pending

### Step 4

- Command:
  - `bash scripts/ops/ensure_runtime_baseline.sh`
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `bash scripts/ops/verify_0155_prompt_filltable.sh --base-url http://127.0.0.1:30900`
  - Playwright CLI：打开 `http://127.0.0.1:30900/#/prompt`，执行 `Preview -> Apply`
- Key output:
  - `ensure_runtime_baseline.sh`：本地 context=`orbstack`，5 个 deployment ready。
  - `deploy_local.sh`：重建并 rollout `ui-server / remote-worker / mbr-worker` 新镜像。
  - `check_runtime_baseline.sh`：
    - `PASS deploy/mosquitto readyReplicas=1`
    - `PASS deploy/synapse readyReplicas=1`
    - `PASS deploy/remote-worker readyReplicas=1`
    - `PASS deploy/mbr-worker readyReplicas=1`
    - `PASS deploy/ui-server readyReplicas=1`
  - `verify_0155_prompt_filltable.sh` 完整 PASS：
    - `preview_response ... result:"ok"`
    - `apply_response ... result:"ok"`
    - `replay_response ... code:"preview_replay"`
    - `legacy_response ... code:"legacy_preview_contract"`
    - `too_many_changes_response ... code:"too_many_changes"`
  - 浏览器实测：
    - `preview ready (confirm then apply): accepted=2 rejected=0`
    - `apply done: applied=2 rejected=0`
    - Preview JSON 显示 `accepted_changes / owner_plan / policy.max_changes_per_apply`
    - Apply Result JSON 显示 `applied_changes / rejected_changes`
  - 证据文件：
    - `output/playwright/local-prompt-owner-chain-pass.png`
    - `.playwright-cli/page-2026-03-06T08-55-55-290Z.yml`
    - `.playwright-cli/page-2026-03-06T08-56-13-366Z.yml`
- Result: PASS
- Commit: pending

## Docs Updated

- [x] `docs/user-guide/modeltable_user_guide.md` updated（切换为 owner-chain 正式口径）
- [x] `docs/user-guide/llm_cognition_ollama_runbook.md` updated（本地 owner-chain + warm-up runbook）
- [x] `scripts/ops/README.md` updated（0155 验收脚本输出口径改为 changes）
- [x] `docs-shared/software-worker/mt-table-local-generation-via-owner-chain.md` updated（共享知识库改为正式 owner-chain 说法）
