---
title: "Iteration 0155-prompt-filltable-ui Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0155-prompt-filltable-ui
id: 0155-prompt-filltable-ui
phase: phase3
---

# Iteration 0155-prompt-filltable-ui Runlog

## Environment

- Date: 2026-02-24
- Branch: dev_0155-prompt-filltable-ui
- Runtime: Phase 3 execution (local mock-ollama + ui-server)

## Review Gate Record

### Record 1

- Iteration ID: 0155-prompt-filltable-ui
- Review Date: 2026-02-24
- Review Type: User + AI-assisted
- Review Index: 1
- Decision: Change Requested
- Notes:
  - dispatch 通道需 function-label 化，避免 server action-specific 分支回流。
  - Preview/Apply 增加 `preview_id` 一致性与重放防护。
  - policy 增加 type/key/size 上限。
  - filltable 事件需 `local_only`，避免 Matrix 转发。
  - 验证矩阵补并发/重放/超限场景。

### Record 2

- Iteration ID: 0155-prompt-filltable-ui
- Review Date: 2026-02-24
- Review Type: User
- Review Index: 2
- Decision: Approved
- Notes: 用户确认进入实施（Phase 3）。

## Execution Records

### Phase 0 — Intake

- Command:
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0155-prompt-filltable-ui --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - `git checkout -b dev_0155-prompt-filltable-ui`
- Key output:
  - scaffold created: `plan.md`, `resolution.md`, `runlog.md`
  - branch switched to `dev_0155-prompt-filltable-ui`
- Result: PASS
- Commit: (none yet)

### Phase 1 — Planning

- Command:
  - `sed/rg` inspection for router + current docs/static/workspace pages
  - update `plan.md` and `resolution.md` for decision-complete 0155 contract
- Key output:
  - 0155 scope明确：固定Prompt界面、Preview/Apply两阶段、默认正数模型可写
  - Step breakdown updated to 8 steps with verification/rollback
- Result: PASS
- Commit: (none yet)

### Phase 1 — Planning Revision (after review)

- Command:
  - update `plan.md` and `resolution.md` based on review findings
  - update `runlog.md` with review records and revision trace
- Key output:
  - 补充 function-label dispatch 要求（不新增 server action-specific 分支）
  - 补充 `preview_id` 一致性与重放防护
  - 补充策略字段（types/keys/size/records 上限）
  - 补充 `local_only` 与 Matrix forward skip 要求
  - 扩展验证矩阵（重放/超限/保护键）
- Result: PASS
- Commit: (none yet)

### Phase 3 — Step 0（TDD Red）

- Command:
  - `node scripts/tests/test_0155_prompt_filltable_policy.mjs`
- Key output:
  - `ERR_MODULE_NOT_FOUND: .../packages/ui-model-demo-server/filltable_policy.mjs`
- Result: PASS（按 TDD 预期先失败）
- Commit: (none yet)

### Phase 3 — Step 1（Policy 模块 + 单元测试）

- Command:
  - 新增 `packages/ui-model-demo-server/filltable_policy.mjs`
  - `node scripts/tests/test_0155_prompt_filltable_policy.mjs`
- Key output:
  - 首次实现后 1 条失败（`test_validate_records_size_limit`）
  - 修订测试数据后：`6 passed, 0 failed`
- Result: PASS
- Commit: (none yet)

### Phase 3 — Step 2（Server + System Models + Frontend）

- Command:
  - 修改 `packages/ui-model-demo-server/server.mjs`（hostApi preview/apply + state labels）
  - 新增 `packages/worker-base/system-models/intent_handlers_prompt_filltable.json`
  - 修改 `packages/worker-base/system-models/intent_dispatch_config.json`
  - 修改 `packages/worker-base/system-models/server_config.json`
  - 修改 `packages/worker-base/system-models/llm_cognition_config.json`
  - 修改 `packages/worker-base/system-models/ui_to_matrix_forwarder.json`
  - 修改前端路由/页面：`router.js` `demo_app.js` `demo_modeltable.js`
  - 修改渲染器：`packages/ui-renderer/src/renderer.mjs`（CodeBlock JSON 展示 + action meta_ref）
- Key output:
  - `node --check`（server/frontend/renderer）全部通过
  - `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs` 返回 `FAIL: editor_v1_pin_page_missing`（历史基线问题，非本迭代新增）
- Result: PASS（目标范围改动完成）
- Commit: (none yet)

### Phase 3 — Step 3（0155 一键脚本 + 回归）

- Command:
  - 新增 `scripts/ops/verify_0155_prompt_filltable.sh`
  - 新增 `scripts/ops/run_0155_prompt_filltable_local.sh`
  - 更新 `scripts/ops/mock_ollama_server.mjs`（支持 filltable prompt 返回）
  - 更新 `scripts/ops/README.md`
  - `bash scripts/ops/run_0155_prompt_filltable_local.sh`
- Key output:
  - 首次运行 FAIL：`llmFilltableApply(...).then is not a function`
  - 修复：`llmFilltableApply` 改为 async 后重跑
  - 重跑结果：
    - `preview_response ... result:"ok"`
    - `apply_response ... result:"ok"`
    - `replay_response ... code:"preview_replay"`
    - `negative_response ... code:"apply_failed"`
    - `[verify-0155] PASS`
    - `[run-0155] PASS`
- Result: PASS
- Commit: (none yet)

### Phase 3 — Step 4（构建验证）

- Command:
  - `npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - `vite build ... ✓ built`
- Result: PASS
- Commit: (none yet)

### Phase 3 — Step 5（文档收口 + 规约对齐）

- Command:
  - `ls -la docs docs-shared`
  - `cat __DY_PROTECTED_WL_0__ | sed -n '1,80p'`
  - 更新 `docs/user-guide/modeltable_user_guide.md`
  - 更新 `docs/ssot/runtime_semantics_modeltable_driven.md`
- Key output:
  - `docs` / `docs-shared` 均为 symlink（已对齐 Knowledge Vault 新架构）
  - 补充 0155 的 Prompt FillTable 约束：
    - Preview/Apply 两阶段与 `preview_id` 防重放
    - `meta.local_only=true` 的 forward skip 语义
- Result: PASS
- Commit: (none yet)

### Phase 3 — Step 6（交付前回归重跑）

- Command:
  - `bash scripts/ops/run_0155_prompt_filltable_local.sh`
- Key output:
  - `preview_response ... result:"ok"`
  - `apply_response ... result:"ok"`
  - `replay_response ... code:"preview_replay"`
  - `negative_response ... code:"apply_failed"`
  - `[verify-0155] PASS`
  - `[run-0155] PASS`
- Result: PASS
- Commit: (none yet)

### Phase 3 — Step 7（0155 脚本参数增强）

- Command:
  - 修改 `scripts/ops/run_0155_prompt_filltable_local.sh`（新增 `--llm-model`）
  - 更新 `scripts/ops/README.md`（补充指定模型标签示例）
  - `bash scripts/ops/run_0155_prompt_filltable_local.sh --llm-model qwen2.5:14b`
- Key output:
  - 首次检查发现 `--llm-model` 被默认值覆盖（启动日志仍为 `qwen2.5:32b`）
  - 修复覆盖逻辑后重跑，启动日志显示 `llm_model=qwen2.5:14b`
  - `[verify-0155] PASS`
  - `[run-0155] PASS`
- Result: PASS
- Commit: (none yet)

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` updated（新增 7.3 本地事件隔离语义）
- [x] `docs/user-guide/modeltable_user_guide.md` updated（新增 3.1 Prompt FillTable 使用与约束）
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed（no update required in Phase 1）
- [x] `scripts/ops/README.md` updated（新增 0155 一键命令）

---

## Phase 4 — Completion (2026-03-01)

- Branch `dev_0155-prompt-filltable-ui` merged to `dev`.
- Key commits:
  - `afeda52 feat(0155): switch default ollama model to mt-label and tighten prompt-filltable flow`
  - `77a5c09 fix(ui): skip llm routing for local editor actions`
  - (multiple earlier commits for policy module, server, frontend, scripts)
- 后续 dev 上的修复（`78f5418 merge: 0155 mt-label defaults and prompt UI routing fix` 等）已包含在交付内。
- ITERATIONS.md status: `In Progress → Completed`.
- All steps PASS. Iteration closed.
