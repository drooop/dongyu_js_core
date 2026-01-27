# Iteration 0127-program-model-loader-v0 Run Log

规则：只记事实（FACTS）。不要写计划、不要写愿景。每个 Step 只有 PASS 才算完成。

## Environment
- OS: macOS (darwin)
- Node/Python versions: Not recorded (Phase1)
- Key env flags: (none)
- Notes: Phase0 discovery references: docs/architecture_mantanet_and_workers.md, docs/charters/dongyu_app_next_runtime.md, docs/WORKFLOW.md, docs/ITERATIONS.md, docs/ssot/runtime_semantics_modeltable_driven.md, docs/ssot/modeltable_runtime_v0.md, docs/concepts/pictest_pin_and_program_model.md, docs/v1n_concept_and_implement.md, docs/iterations/0122-pictest-evidence/evidence.md, docs/iterations/0123-builtins-v0/ledger.md, test_files/test7/main.py, test_files/test7/yhl.db

### Review Gate Records (FACTS)
```text
Review Gate Record
- Iteration ID:
- Review Date:
- Review Type: User / OpenCode
- Reviewer: @oracle / @momus
- Review Index: 1/2/3...
- Decision: Approved / Change Requested / On Hold
- Notes:
```

Review Gate Record
- Iteration ID: 0127-program-model-loader-v0
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 1
- Decision: Change Requested
- Notes: 初始化阶段语义与 SSOT 冲突、add_label/rm_label 副作用入口表述需澄清、缺少 modeltable_runtime_v0 校验与确定性要求、每步需补 SSOT/Charter violation check。

Review Gate Record
- Iteration ID: 0127-program-model-loader-v0
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @momus
- Review Index: 2
- Decision: Change Requested
- Notes: 需固定 DB 回放顺序与解析规则、补充 FunctionLabel/run_<func> 注册策略与负例验证、完善 untracked 校验与工具依赖说明、同步 .sisyphus mirror。

Review Gate Record
- Iteration ID: 0127-program-model-loader-v0
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 3
- Decision: Approved
- Notes: 回放顺序与 label.v 解析规则已收敛；SSOT/Charter 风险点收口。

---

## Step 1 — Implement program model loader v0
- Start time: 2026-01-27 14:25:00 CST
- End time: 2026-01-27 14:31:00 CST
- Branch: dev_0127-program-model-loader-v0
- Commits:
  - None
- Commands executed:
  - `test -f test_files/test7/yhl.db`
  - `test -f test_files/test7/main.py`
  - `git add packages/worker-base/src/program_model_loader.js packages/worker-base/src/runtime.js scripts/validate_program_model_loader_v0.mjs`
  - `bun scripts/validate_program_model_loader_v0.mjs --case load_snapshot --db test_files/test7/yhl.db`
  - `git diff --name-only`
  - `git status -sb`
  - `git diff --cached --name-only`
  - `test -z "$(git status --porcelain | rg '^\?\?' | rg -v '^(\?\? (\.opencode/oh-my-opencode\.json|\.sisyphus/|docs/concepts/|test_files/))')"`
  - `test -z "$(git diff --name-only | rg -n '^(docs/architecture_mantanet_and_workers\.md|docs/charters/dongyu_app_next_runtime\.md|test_files/)')"`
- Key outputs (snippets):
  - `replay_order=mt_id,p,r,c,k,t,rowid`
  - `value_parse=json-if-string`
  - `VALIDATION RESULTS` / `load_snapshot: PASS`
  - `## dev_0127-program-model-loader-v0`
  - `A  packages/worker-base/src/program_model_loader.js`
  - `M  packages/worker-base/src/runtime.js`
  - `A  scripts/validate_program_model_loader_v0.mjs`
  - `M  docs/ITERATIONS.md`
- Result: PASS
- If FAIL:
  - Cause:
  - Fix commits:
  - Re-run commands:
  - Final result:

---

## Step 2 — Validate trigger/connection cases
- Start time: 2026-01-27 14:33:00 CST
- End time: 2026-01-27 14:36:00 CST
- Branch: dev_0127-program-model-loader-v0
- Commits:
  - None
- Commands executed:
  - `bun scripts/validate_program_model_loader_v0.mjs --case all --db test_files/test7/yhl.db`
  - `git diff --name-only`
  - `test -z "$(git status --porcelain | rg '^\?\?' | rg -v '^(\?\? (\.opencode/oh-my-opencode\.json|\.sisyphus/|docs/concepts/|test_files/))')"`
  - `test -z "$(git diff --name-only | rg -n '^(docs/architecture_mantanet_and_workers\.md|docs/charters/dongyu_app_next_runtime\.md|test_files/)')"`
- Key outputs (snippets):
  - `replay_order=mt_id,p,r,c,k,t,rowid`
  - `value_parse=json-if-string`
  - `VALIDATION RESULTS`
  - `load_snapshot: PASS`
  - `invalid_label: PASS`
  - `function_label: PASS`
  - `run_missing: PASS`
  - `connect_allowlist: PASS`
- Result: PASS
- If FAIL:
  - Cause:
  - Fix commits:
  - Re-run commands:
  - Final result:

---

## Step 3 — Finalize iteration records
- Start time: 2026-01-27 14:37:00 CST
- End time: 2026-01-27 14:41:00 CST
- Branch: dev_0127-program-model-loader-v0
- Commits:
  - None
- Commands executed:
  - `git add docs/ITERATIONS.md docs/iterations/0127-program-model-loader-v0/runlog.md`
  - `git show :docs/ITERATIONS.md | rg -n '^\| 0127-program-model-loader-v0 \|.*\| dev_0127-program-model-loader-v0 \| Completed \| \./docs/iterations/0127-program-model-loader-v0/ \|'`
  - `git diff --cached --name-only`
  - `test -n "$(git diff --cached --name-only)"`
  - `test -n "$(git diff --cached --name-only | rg -n '^docs/ITERATIONS\.md$')"`
  - `test -n "$(git diff --cached --name-only | rg -n '^docs/iterations/0127-program-model-loader-v0/runlog\.md$')"`
  - `test -z "$(git diff --cached --name-only | rg -v '^(docs/iterations/0127-program-model-loader-v0/runlog\.md|docs/ITERATIONS\.md)$')"`
- Key outputs (snippets):
  - `38:| 0127-program-model-loader-v0 | 2026-01-27 | Program model loader v0 (test7 yhl.db) | 3 | dev_0127-program-model-loader-v0 | Completed | ./docs/iterations/0127-program-model-loader-v0/ |`
  - `docs/ITERATIONS.md`
  - `docs/iterations/0127-program-model-loader-v0/runlog.md`
- Result: PASS
- If FAIL:
  - Cause: staged 包含实现文件，未满足 Step3 仅文档入 staged 的验证口径
  - Fix commits: None
  - Re-run commands:
    - `git reset packages/worker-base/src/program_model_loader.js packages/worker-base/src/runtime.js scripts/validate_program_model_loader_v0.mjs`
    - `git add docs/ITERATIONS.md docs/iterations/0127-program-model-loader-v0/runlog.md`
    - `git show :docs/ITERATIONS.md | rg -n '^\| 0127-program-model-loader-v0 \|.*\| dev_0127-program-model-loader-v0 \| Completed \| \./docs/iterations/0127-program-model-loader-v0/ \|'`
    - `git diff --cached --name-only`
    - `test -n "$(git diff --cached --name-only)"`
    - `test -n "$(git diff --cached --name-only | rg -n '^docs/ITERATIONS\.md$')"`
    - `test -n "$(git diff --cached --name-only | rg -n '^docs/iterations/0127-program-model-loader-v0/runlog\.md$')"`
    - `test -z "$(git diff --cached --name-only | rg -v '^(docs/iterations/0127-program-model-loader-v0/runlog\.md|docs/ITERATIONS\.md)$')"`
  - Final result: PASS
