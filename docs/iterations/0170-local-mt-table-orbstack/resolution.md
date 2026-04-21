---
title: "Iteration 0170-local-mt-table-orbstack Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0170-local-mt-table-orbstack
id: 0170-local-mt-table-orbstack
phase: phase1
---

# Iteration 0170-local-mt-table-orbstack Resolution

## Execution Strategy

- 先锁定本地链路的两个真实阻塞点：`prompt filltable` 的流式解析/截断，以及 `remote-worker` 的 `lazyMqtt()` 回归。
- 以 failing/guard tests 固化本轮 contract：本地默认模型参数必须指向 `mt-table`，Bun/ESM 下 `startMqttLoop({transport:'real'})` 不能再抛 `mqtt_package_unavailable`。
- 在本机 Orbstack 中完成本地 stack 部署与 `preview -> apply -> 浏览器` 的端到端验证。
- 成功后把方法、约束、排障经验写入共享知识库，并同步评估用户指南/SSOT 是否需要更新。

## Step 1

- Scope:
  - 固化本地 `mt-table` 默认值与 Ollama streaming contract，确保 `prompt filltable` 的 server 侧输入输出约束明确。
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/llm_cognition_config.json`
  - `k8s/local/workers.yaml`
  - `scripts/ops/start_local_ui_server_with_ollama.sh`
  - `scripts/ops/run_0154_llm_dispatch_local.sh`
  - `scripts/ops/run_0155_prompt_filltable_local.sh`
  - `scripts/tests/test_0171_ollama_stream_contract.mjs`
  - `scripts/tests/test_0172_local_mt_table_defaults.mjs`
- Verification:
  - `node scripts/tests/test_0171_ollama_stream_contract.mjs`
  - `node scripts/tests/test_0172_local_mt_table_defaults.mjs`
  - `node scripts/tests/test_0170_bun_and_filltable_prompt_contract.mjs`
- Acceptance:
  - 本地默认模型/超时/token 配置为 `mt-table/120000/512`。
  - `llmInfer()` 使用可解析的 streaming 路径，当前 prompt contract 由测试守住。
- Rollback:
  - 回退上述文件到 `4ff5206`，删除新增测试。

## Step 2

- Scope:
  - 修复 Bun/ESM 下 `remote-worker` 的 `mqtt_package_unavailable` 回归，并在 Orbstack 本地 stack 中跑通 `prompt filltable` preview/apply。
- Files:
  - `packages/worker-base/src/runtime.mjs`
  - `scripts/tests/test_0170_local_bun_real_mqtt.mjs`（如新增）
  - `k8s/local/synapse.yaml`
  - `docs/iterations/0170-local-mt-table-orbstack/runlog.md`
- Verification:
  - `node scripts/tests/test_0170_local_bun_real_mqtt.mjs`
  - 本地 deploy / rollout 命令
  - `curl http://localhost:30900/snapshot ...`
  - `llm_filltable_preview` / `llm_filltable_apply` 手工或脚本验证
  - Playwright 本地浏览器实测
- Acceptance:
  - `remote-worker` 不再因 `mqtt_package_unavailable` CrashLoop。
  - 本地 `preview -> apply` 成功，目标模型表产生预期改动。
  - 浏览器端可见成功状态与结果回写。
- Rollback:
  - 回退 `runtime.mjs` 与本地 manifest 改动，恢复到修复前版本并保留失败证据。

## Step 3

- Scope:
  - 把本轮方法、约束、经验沉淀到共享知识库和必要用户文档，重点说明新规约下不能再依赖 `op` 直接改表。
- Files:
  - `docs-shared/software-worker/mt-table-local-generation-via-owner-chain.md`
  - `docs/user-guide/llm_cognition_ollama_runbook.md`
  - `docs/user-guide/modeltable_user_guide.md`（如需）
  - `docs/user-guide/README.md`
  - `scripts/ops/README.md`
  - `docs/iterations/0170-local-mt-table-orbstack/runlog.md`
- Verification:
  - 文档中有清晰的本地 Orbstack + `mt-table` 操作步骤
  - 文档中明确写出 owner / preview-apply / hostApi 限制
- Acceptance:
  - 其他协作者读文档即可复现本地 `mt-table` 生成流程，并理解不能再走旧 `op` 直改模型表。
- Rollback:
  - 仅回退文档改动，不影响已验证通过的代码修复。

## Notes

- Generated at: 2026-03-06
