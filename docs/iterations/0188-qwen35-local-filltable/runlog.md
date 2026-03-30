---
title: "0188 — Qwen3.5 Local FillTable Upgrade Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0188-qwen35-local-filltable
id: 0188-qwen35-local-filltable
phase: phase3
---

# 0188 — Qwen3.5 Local FillTable Upgrade Runlog

规则：只记事实（FACTS）。不要写计划、不要写愿景。每个 Step 只有 PASS 才算完成。

## Environment
- Date: 2026-03-17
- Branch: `dev_0188-qwen35-local-filltable`
- Notes:
  - 2026-03-12 已完成 Phase 0/1 文档骨架与主要代码执行。
  - 2026-03-17 重新核对工作树、回放关键验证，并补齐 completion closeout。

### Review Gate Records (FACTS)
```text
Review Gate Record
- Iteration ID: 0188-qwen35-local-filltable
- Review Date: 2026-03-12
- Review Type: User
- Reviewer: user
- Review Index: 1
- Decision: Approved
- Notes: 用户要求先修复 Markdown LSP / Biome 安装问题，再删除 `qwen3:32b` 与旧 `mt-label`，然后以本机 `qwen3.5:9b` 为底座重建 `mt-label` 并继续做 filltable 验证。
```

---

## Planning Record
- Start time: 2026-03-12
- End time: 2026-03-12
- Branch: `dev_0188-qwen35-local-filltable`
- Commands executed:
  - `git status --short --branch`
  - `git switch -c dev_0188-qwen35-local-filltable`
- Key outputs (snippets):
  - `## dev...origin/dev`
  - `## dev_0188-qwen35-local-filltable`
- Result: PASS

---

## Step 1 — Local Tooling and Model Preparation
- Start time: 2026-03-12
- End time: 2026-03-12
- Branch: `dev_0188-qwen35-local-filltable`
- Commands executed:
  - `brew install marksman`
  - `npm install -g @biomejs/biome`
  - `ollama rm qwen3:32b mt-label:latest`
  - `bash scripts/ops/create_mt_label_qwen35.sh`
  - `curl -sS http://127.0.0.1:11434/api/generate -d '{"model":"mt-label",...}'`
- Key outputs (snippets):
  - `marksman 2026-02-08`
  - `Version: 2.4.6`
  - `deleted 'qwen3:32b'`
  - `deleted 'mt-label:latest'`
  - `success` (new `mt-label` manifest)
  - `response":"{\"ok\":true}"`
- Result: PASS

---

## Step 2 — FillTable Contract and Verification Update
- Start time: 2026-03-12
- End time: 2026-03-12
- Branch: `dev_0188-qwen35-local-filltable`
- Commands executed:
  - `node scripts/tests/test_0170_bun_and_filltable_prompt_contract.mjs`
  - `node scripts/tests/test_0172_local_mt_table_defaults.mjs`
  - `node scripts/tests/test_0171_ollama_stream_contract.mjs`
  - `node scripts/tests/test_0155_prompt_filltable_policy.mjs`
  - `node scripts/tests/test_0171_filltable_owner_chain_contract.mjs`
  - `node scripts/tests/test_0171_filltable_owner_schema_contract.mjs`
  - `node scripts/tests/test_0171_filltable_owner_materialization.mjs`
  - `node scripts/tests/test_0188_prompt_filltable_verify_runtime_mode.mjs`
  - `bash scripts/ops/verify_0155_prompt_filltable.sh --base-url http://127.0.0.1:9013`
  - `bash scripts/ops/run_0155_prompt_filltable_local.sh --real-ollama --llm-model mt-label`
- Key outputs (snippets):
  - `3 passed, 0 failed out of 3`
  - `test_0172_local_mt_table_defaults: PASS`
  - `test_0171_ollama_stream_contract: PASS`
  - `test_0155_prompt_filltable_policy: PASS`
  - `test_0171_filltable_owner_chain_contract: PASS`
  - `test_0171_filltable_owner_schema_contract: PASS`
  - `test_0171_filltable_owner_materialization: PASS`
  - `test_0188_prompt_filltable_verify_runtime_mode: PASS`
  - `[verify-0155] runtime_mode_response={"ok":true,"mode":"running"}`
  - `[verify-0155] PASS`
  - `[run-0155] PASS`
- Result: PASS

---

## Step 3 — Capability Matrix, Prompt Context, and 35B Validation
- Start time: 2026-03-12
- End time: 2026-03-12
- Branch: `dev_0188-qwen35-local-filltable`
- Commands executed:
  - `npm install -g bash-language-server`
  - `npm install -g yaml-language-server`
  - `node scripts/tests/test_0188_filltable_prompt_context.mjs`
  - `node scripts/tests/test_0188_filltable_capability_catalog.mjs`
  - `node scripts/tests/test_0170_bun_and_filltable_prompt_contract.mjs`
  - `node scripts/tests/test_0171_filltable_owner_schema_contract.mjs`
  - `node scripts/tests/test_0172_local_mt_table_defaults.mjs`
  - `bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label-35b --report-file /tmp/filltable-capability-35b.json`
  - `jq '{summary, results: [.results[] | {id, pass, errors}]}' /tmp/filltable-capability-35b.json`
- Key outputs (snippets):
  - `bash-language-server 5.6.0`
  - `yaml-language-server 1.21.0`
  - `test_0188_filltable_prompt_context: PASS`
  - `test_0188_filltable_capability_catalog: PASS`
  - `test_0172_local_mt_table_defaults: PASS`
  - `"passed": 7`
  - `"failed": 0`
  - `leave_form_model1001_exact_mapping -> pass=true`
  - `repair_form_model1002_exact_mapping -> pass=true`
  - `parent_child_submodel_model11_blocked -> pass=true`
- Result: PASS

---

## Step 4 — 2026-03-17 Completion Revalidation
- Start time: 2026-03-17
- End time: 2026-03-17
- Branch: `dev_0188-qwen35-local-filltable`
- Commands executed:
  - `node scripts/tests/test_0170_bun_and_filltable_prompt_contract.mjs`
  - `node scripts/tests/test_0171_filltable_owner_chain_contract.mjs`
  - `node scripts/tests/test_0171_filltable_owner_schema_contract.mjs`
  - `node scripts/tests/test_0171_filltable_owner_materialization.mjs`
  - `node scripts/tests/test_0172_local_mt_table_defaults.mjs`
  - `node scripts/tests/test_0188_filltable_prompt_context.mjs`
  - `node scripts/tests/test_0188_filltable_capability_catalog.mjs`
  - `node scripts/tests/test_0188_prompt_filltable_verify_runtime_mode.mjs`
  - `ollama show mt-label`
  - `ollama show mt-label-35b`
  - `bash scripts/ops/run_0155_prompt_filltable_local.sh --real-ollama --llm-model mt-label`
  - `bash scripts/ops/run_filltable_capability_matrix_local.sh --port 9026 --llm-model mt-label --workspace ws_filltable_capability_matrix_0188_9b --report-file /tmp/filltable-capability-mt-label.json`
- Key outputs (snippets):
  - `3 passed, 0 failed out of 3`
  - `test_0171_filltable_owner_chain_contract: PASS`
  - `test_0171_filltable_owner_schema_contract: PASS`
  - `test_0171_filltable_owner_materialization: PASS`
  - `test_0172_local_mt_table_defaults: PASS`
  - `test_0188_filltable_prompt_context: PASS`
  - `test_0188_filltable_capability_catalog: PASS`
  - `test_0188_prompt_filltable_verify_runtime_mode: PASS`
  - `MT_LABEL_OK`
  - `MT_LABEL_35B_OK`
  - `[verify-0155] PASS`
  - `[run-0155] PASS`
  - capability matrix summary:
    - `"passed": 7`
    - `"failed": 0`
- Notes:
  - 本轮曾并行启动多个本地 server，触发过 SQLite lock / port collision；改为独立 port + workspace 串行复验后，`9B` canonical path 全量 PASS。
  - `mt-label-35b` 在 2026-03-17 的补充 warm-up 过程中未进入 scenario 执行；本次 completion gate 不依赖该补充复验，正式 gating 证据仍以 `9B` canonical path 与 2026-03-12 的既有 35B 事实记录为准。
- Result: PASS

---

## Step 5 — Completion Closeout
- Start time: 2026-03-17
- End time: 2026-03-17
- Branch: `dev_0188-qwen35-local-filltable`
- Commands executed:
  - `git status --short`
  - `git diff --stat`
  - `apply_patch` update `docs/iterations/0188-qwen35-local-filltable/{plan,resolution,runlog}.md`
  - `apply_patch` update `docs/ITERATIONS.md`
- Key outputs (snippets):
  - `0188` relevant worktree still limited to local Qwen3.5 filltable config / prompt context / capability matrix / tests / ops docs
  - `docs/ITERATIONS.md` row updated from `Planned` to `Completed`
- Notes:
  - `AGENTS.md` / `CLAUDE.md` 仍有未提交修改，但不属于本次 `0188` 提交边界，收口时显式排除。
- Result: PASS

## Docs Updated

- [x] `docs/ITERATIONS.md` updated
- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
