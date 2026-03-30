---
title: "0188 — Qwen3.5 Local FillTable Upgrade Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0188-qwen35-local-filltable
id: 0188-qwen35-local-filltable
phase: phase1
---

# 0188 — Qwen3.5 Local FillTable Upgrade Resolution

## Execution Strategy

- 先用 deterministic tests 锁定本轮要改的合同：Qwen3.5 本地模型入口、filltable 结构化输出、owner-chain preview/apply 不变量。
- 再在 `server.mjs` / system-model configs / local ops scripts 中做最小改动，优先复用现有 Ollama provider，而不是引入新 provider 面。
- 之后跑 unit-style contract tests，再跑本地 0155 验收；如果真实模型有 warm-up 特性，记录到 runlog 和 runbook。
- 最后补文档与备选模型清单，明确 canonical 本地链路和可选升级路径。

## Step 1

- Scope:
  - 补齐或修订红灯测试，覆盖 Qwen3.5 本地 filltable 需要锁定的关键合同。
- Files:
  - `scripts/tests/test_0170_bun_and_filltable_prompt_contract.mjs`
  - `scripts/tests/test_0172_local_mt_table_defaults.mjs`
  - `scripts/tests/test_0155_prompt_filltable_policy.mjs`
  - 必要时新增 `scripts/tests/test_0188_*`
- Verification:
  - `node scripts/tests/test_0170_bun_and_filltable_prompt_contract.mjs`
  - `node scripts/tests/test_0172_local_mt_table_defaults.mjs`
  - `node scripts/tests/test_0155_prompt_filltable_policy.mjs`
- Acceptance:
  - 至少一条测试先红，明确暴露当前 `mt-table`/prompt-only 假设与目标 Qwen3.5 路径之间的差距。
- Rollback:
  - 删除本轮新增测试，恢复被修改的测试合同文件。

## Step 2

- Scope:
  - 最小化调整本地 LLM 配置与 filltable 推理路径，使其面向 `qwen3.5:9b`。
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/server_config.json`
  - `packages/worker-base/system-models/llm_cognition_config.json`
  - `scripts/ops/start_local_ui_server_with_ollama.sh`
  - `scripts/ops/run_0155_prompt_filltable_local.sh`
  - 必要时 `k8s/local/workers.yaml`
- Validation:
  - `node scripts/tests/test_0171_ollama_stream_contract.mjs`
  - `node scripts/tests/test_0170_bun_and_filltable_prompt_contract.mjs`
  - `node scripts/tests/test_0172_local_mt_table_defaults.mjs`
- Acceptance:
  - 默认本地 filltable 模型入口切到 `qwen3.5:9b`。
  - preview 输出继续符合 owner-chain 合同，不回退到旧 records bridge。
  - 若采用 structured output，相关 parse/validation 路径有明确合同保护。
- Rollback:
  - 恢复 server/system-model/script 默认值到本轮前状态。

## Step 3

- Scope:
  - 跑通 deterministic tests 与本地 0155 验收，确认 preview/apply 主链路可用。
- Files:
  - `scripts/ops/verify_0155_prompt_filltable.sh`
  - `docs/iterations/0188-qwen35-local-filltable/runlog.md`
- Validation:
  - `node scripts/tests/test_0171_filltable_owner_chain_contract.mjs`
  - `node scripts/tests/test_0171_filltable_owner_schema_contract.mjs`
  - `node scripts/tests/test_0171_filltable_owner_materialization.mjs`
  - `bash scripts/ops/run_0155_prompt_filltable_local.sh --real-ollama --llm-model qwen3.5:9b`
- Acceptance:
  - 0155 roundtrip 在本机 `Qwen3.5 9B` 下得到明确 PASS/FAIL。
  - 若存在 warm-up 超时，runlog 中有事实记录和复跑结论。
- Rollback:
  - 回退本轮验证脚本改动与相关配置，保留 runlog 事实记录。

## Step 4

- Scope:
  - 同步用户文档与 ops 入口，补充更强本机可跑 Qwen3.5 模型清单。
- Files:
  - `docs/user-guide/llm_cognition_ollama_runbook.md`
  - `docs/user-guide/prompt_filltable_owner_chain_and_deploy.md`
  - `scripts/ops/README.md`
  - 必要时 `docs/user-guide/modeltable_user_guide.md`
- Validation:
  - `node scripts/ops/validate_obsidian_docs_gate.mjs`
  - 文档中的命令与实际脚本入口一致
- Acceptance:
  - 文档明确：canonical 本地 `Qwen3.5 9B` 路径、PASS 判定、warm-up 说明、备选模型清单。
- Rollback:
  - 恢复文档到本轮前版本。
