# Iteration 0127-doit-auto-docs-refresh Resolution

## 0. Execution Rules
- Work branch: dev_0127-doit-auto-docs-refresh
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Update doit-auto roadmap summary | Clarify registration/loading references and test case in roadmap summary | docs/roadmaps/dongyu-app-next-runtime-elysia.md | See Step 1 Validation (Executable, staged-based) | Roadmap summary includes registration/loading references and test_files/test7 main.py + yhl.db as final test case | Revert file changes |
| 2 | Update execution roadmap | Reflect updated evidence pointers and test case in execution roadmap | docs/roadmap/dongyu_app_next_runtime.md | See Step 2 Validation (Executable, staged-based) | Execution roadmap includes test_files/test7 main.py + yhl.db and updated pointers | Revert file changes |
| 3 | Finalize iteration records | Update runlog evidence and Iterations index | docs/iterations/0127-doit-auto-docs-refresh/runlog.md, docs/ITERATIONS.md | See Step 3 Validation (Executable, staged-based) | Iteration status set to Completed with branch/entry fields | Revert docs/ITERATIONS.md changes |

## 2. Step Details

### Step 1 — Update doit-auto roadmap summary
**Goal**
- 在路线图摘要中补齐“程序模型注册/加载过程”的证据引用与说明，并明确 test_files/test7 为最终测试用例。

**Scope**
- 仅更新 `docs/roadmaps/dongyu-app-next-runtime-elysia.md`。

**Files**
- Update:
  - `docs/roadmaps/dongyu-app-next-runtime-elysia.md`
- Must NOT touch:
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/charters/dongyu_app_next_runtime.md`

**Validation (Executable)**
- Commands:
  - `git add docs/roadmaps/dongyu-app-next-runtime-elysia.md`
  - `test -f test_files/test7/main.py`
  - `test -f test_files/test7/yhl.db`
  - `test -f docs/concepts/pictest_pin_and_program_model.md`
  - `test -f docs/v1n_concept_and_implement.md`
  - `git show :docs/roadmaps/dongyu-app-next-runtime-elysia.md | rg -n "test_files/test7/main.py"`
  - `git show :docs/roadmaps/dongyu-app-next-runtime-elysia.md | rg -n "test_files/test7/yhl.db"`
  - `git show :docs/roadmaps/dongyu-app-next-runtime-elysia.md | rg -n "\]\([^)]*(pictest_pin_and_program_model\.md|v1n_concept_and_implement\.md)[^)]*\)"`
  - `git show :docs/roadmaps/dongyu-app-next-runtime-elysia.md | rg -n "程序模型注册/加载过程"`
  - `git diff --cached --name-only`
  - `test -n "$(git diff --cached --name-only)"`
  - `test -z "$(git diff --cached --name-only | rg -v '^docs/roadmaps/dongyu-app-next-runtime-elysia.md$')"`
  - `test -z "$(git diff --cached --name-only | rg -n '^(docs/architecture_mantanet_and_workers\.md|docs/charters/dongyu_app_next_runtime\.md|docs/concepts/pictest_pin_and_program_model\.md|docs/v1n_concept_and_implement\.md)$')"`
- Expected signals:
  - 至少 1 行命中 main.py
  - 至少 1 行命中 yhl.db
  - 至少 1 行命中证据文档引用
  - git diff 仅包含本 Step 目标文件
  - 不允许出现 SSOT/Charter/证据文档被修改

**Acceptance Criteria**
- Roadmap summary 中出现程序模型注册/加载过程的引用链接。
- Roadmap summary 中出现 test_files/test7 作为最终测试用例的明确说明。
- 证据指针必须为 markdown link（例如 `[text](docs/...)`）。

**Rollback Strategy**
- 还原 `docs/roadmaps/dongyu-app-next-runtime-elysia.md` 到上一步版本。

---

### Step 2 — Update execution roadmap
**Goal**
- 在执行路线图中补齐注册/加载与最终测试用例说明，并澄清 Current Phase 表述避免与 Charter 误读。

**Scope**
- 仅更新 `docs/roadmap/dongyu_app_next_runtime.md`。

**Files**
- Update:
  - `docs/roadmap/dongyu_app_next_runtime.md`
- Must NOT touch:
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/charters/dongyu_app_next_runtime.md`

**Validation (Executable)**
- Commands:
  - `git add docs/roadmap/dongyu_app_next_runtime.md`
  - `test -f test_files/test7/main.py`
  - `test -f test_files/test7/yhl.db`
  - `test -f docs/concepts/pictest_pin_and_program_model.md`
  - `test -f docs/v1n_concept_and_implement.md`
  - `git show :docs/roadmap/dongyu_app_next_runtime.md | rg -n "test_files/test7/main.py"`
  - `git show :docs/roadmap/dongyu_app_next_runtime.md | rg -n "test_files/test7/yhl.db"`
  - `git show :docs/roadmap/dongyu_app_next_runtime.md | rg -n "\]\([^)]*(pictest_pin_and_program_model\.md|v1n_concept_and_implement\.md)[^)]*\)"`
  - `git show :docs/roadmap/dongyu_app_next_runtime.md | rg -n "程序模型注册/加载过程"`
  - `git show :docs/roadmap/dongyu_app_next_runtime.md | rg -n "Current Phase:.*not current implementation scope"`
  - `git diff --cached --name-only`
  - `test -n "$(git diff --cached --name-only)"`
  - `test -z "$(git diff --cached --name-only | rg -v '^docs/roadmap/dongyu_app_next_runtime.md$')"`
  - `test -z "$(git diff --cached --name-only | rg -n '^(docs/architecture_mantanet_and_workers\.md|docs/charters/dongyu_app_next_runtime\.md|docs/concepts/pictest_pin_and_program_model\.md|docs/v1n_concept_and_implement\.md)$')"`
- Expected signals:
  - 至少 1 行命中 main.py
  - 至少 1 行命中 yhl.db
  - 至少 1 行命中证据文档引用
  - Current Phase 行包含边界说明
  - git diff 仅包含本 Step 目标文件
  - 不允许出现 SSOT/Charter/证据文档被修改

**Acceptance Criteria**
- Execution roadmap 中出现 test_files/test7 作为最终测试用例的明确说明。
- Execution roadmap 中出现注册/加载过程的指向或引用。
- Current Phase 表述不与 Charter 限制冲突，且包含边界说明。
- 证据指针必须为 markdown link（例如 `[text](docs/...)`）。

**Rollback Strategy**
- 还原 `docs/roadmap/dongyu_app_next_runtime.md` 到上一步版本。

---

### Step 3 — Finalize iteration records
**Goal**
- 完成 runlog 证据记录与 Iterations 索引状态更新。

**Scope**
- 更新 iteration 记录文档：
  - `docs/iterations/0127-doit-auto-docs-refresh/plan.md`
  - `docs/iterations/0127-doit-auto-docs-refresh/resolution.md`
  - `docs/iterations/0127-doit-auto-docs-refresh/runlog.md`
  - `docs/ITERATIONS.md`

**Files**
- Update:
  - `docs/iterations/0127-doit-auto-docs-refresh/plan.md`
  - `docs/iterations/0127-doit-auto-docs-refresh/resolution.md`
  - `docs/iterations/0127-doit-auto-docs-refresh/runlog.md`
  - `docs/ITERATIONS.md`
- Must NOT touch:
  - `docs/architecture_mantanet_and_workers.md`

**Validation (Executable)**
- Commands:
  - `git add docs/ITERATIONS.md docs/iterations/0127-doit-auto-docs-refresh/runlog.md`
  - `git show :docs/ITERATIONS.md | rg -n '^\| 0127-doit-auto-docs-refresh \|.*\| dev_0127-doit-auto-docs-refresh \| Completed \| \./docs/iterations/0127-doit-auto-docs-refresh/ \|'`
  - `git diff --cached --name-only`
  - `test -n "$(git diff --cached --name-only)"`
  - `test -n "$(git diff --cached --name-only | rg -n '^docs/ITERATIONS\.md$')"`
  - `test -n "$(git diff --cached --name-only | rg -n '^docs/iterations/0127-doit-auto-docs-refresh/plan\.md$')"`
  - `test -n "$(git diff --cached --name-only | rg -n '^docs/iterations/0127-doit-auto-docs-refresh/resolution\.md$')"`
  - `test -n "$(git diff --cached --name-only | rg -n '^docs/iterations/0127-doit-auto-docs-refresh/runlog\.md$')"`
  - `test -z "$(git diff --cached --name-only | rg -v '^(docs/iterations/0127-doit-auto-docs-refresh/(plan|resolution|runlog)\.md|docs/ITERATIONS\.md)$')"`
  - `git show :docs/iterations/0127-doit-auto-docs-refresh/runlog.md | rg -n "Result: PASS"`
  - `test "$(git show :docs/iterations/0127-doit-auto-docs-refresh/runlog.md | rg -c "Result: PASS")" -ge 3`
  - `test -z "$(git show :docs/iterations/0127-doit-auto-docs-refresh/runlog.md | rg -n "\`<hash>\`")"`
  - `test -z "$(git show :docs/iterations/0127-doit-auto-docs-refresh/runlog.md | rg -n "Result: PASS / FAIL")"`
  - `test -n "$(git show :docs/iterations/0127-doit-auto-docs-refresh/runlog.md | rg -n "\`[0-9a-f]{7,}\` -")"`
  - `git show :docs/iterations/0127-doit-auto-docs-refresh/runlog.md | rg -o "\`[0-9a-f]{7,}\`" | tr -d '\`' | xargs -n 1 git cat-file -e`
  - `test -z "$(git show :docs/iterations/0127-doit-auto-docs-refresh/runlog.md | rg -n '\(to be recorded\)')"`
  - `test -z "$(git show :docs/iterations/0127-doit-auto-docs-refresh/runlog.md | rg -n 'Decision: Approved / Change Requested / On Hold')"`
  - `test -z "$(git show :docs/iterations/0127-doit-auto-docs-refresh/runlog.md | rg -n 'Review Index: 1/2/3\.\.\.')"`
  - `test -z "$(git show :docs/iterations/0127-doit-auto-docs-refresh/runlog.md | rg -n 'Review Type: User / OpenCode')"`
- Expected signals:
  - 迭代条目存在且状态为 Completed
  - git diff 仅包含 plan/resolution/runlog 与 ITERATIONS
  - runlog 中 Step1/2/3 均有 PASS 记录
  - runlog 中无占位符

**Acceptance Criteria**
- runlog 中记录 Phase3 执行证据与验证结果。
- docs/ITERATIONS.md 中本迭代状态为 Completed。

**Rollback Strategy**
- 还原 `docs/iterations/0127-doit-auto-docs-refresh/runlog.md` 和 `docs/ITERATIONS.md`。

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
