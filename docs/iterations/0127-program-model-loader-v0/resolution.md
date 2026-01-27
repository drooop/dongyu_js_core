# Iteration 0127-program-model-loader-v0 Resolution

## 0. Execution Rules
- Work branch: dev_0127-program-model-loader-v0
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Implement program model loader v0 | Loader + replay semantics + validation script | packages/worker-base/src/runtime.js, packages/worker-base/src/program_model_loader.js, scripts/validate_program_model_loader_v0.mjs | `bun scripts/validate_program_model_loader_v0.mjs --case load_snapshot --db test_files/test7/yhl.db` | Loader constructs snapshot with deterministic events | Revert Step 1 changes |
| 2 | Validate trigger/connection cases | Run full validation cases | scripts/validate_program_model_loader_v0.mjs | `bun scripts/validate_program_model_loader_v0.mjs --case all --db test_files/test7/yhl.db` | All cases PASS | Re-run validation |
| 3 | Finalize iteration records | Update runlog + iterations index | docs/iterations/0127-program-model-loader-v0/runlog.md, docs/ITERATIONS.md | See Step 3 Validation (Executable, staged-based) | Iteration marked Completed | Revert docs/ITERATIONS.md changes |

## 2. Step Details

### Step 1 — Implement program model loader v0
**Goal**
- 新增 loader v0，支持从 yhl.db 回放 ModelTable，并通过 add_label/rm_label 触发结构性声明语义。

**Scope**
- Loader + replay semantics + 验证脚本。

**Files**
- Create/Update:
  - `packages/worker-base/src/program_model_loader.js`
  - `packages/worker-base/src/runtime.js`
  - `scripts/validate_program_model_loader_v0.mjs`
- Must NOT touch:
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/charters/dongyu_app_next_runtime.md`
  - `test_files/test7/*`

**Validation (Executable)**
- Commands:
  - `test -f test_files/test7/yhl.db`
  - `test -f test_files/test7/main.py`
  - `git add packages/worker-base/src/program_model_loader.js packages/worker-base/src/runtime.js scripts/validate_program_model_loader_v0.mjs`
  - `bun scripts/validate_program_model_loader_v0.mjs --case load_snapshot --db test_files/test7/yhl.db`
  - `git diff --name-only`
  - `test -z "$(git status --porcelain | rg '^\?\?' | rg -v '^(\?\? (\.opencode/oh-my-opencode\.json|\.sisyphus/|docs/concepts/|test_files/))')"`
  - `test -z "$(git diff --name-only | rg -n '^(docs/architecture_mantanet_and_workers\.md|docs/charters/dongyu_app_next_runtime\.md|test_files/)')"`
- Expected signals:
  - load_snapshot PASS
  - snapshot 包含主模型且 label 数量 > 0
  - EventLog 顺序确定且 event_id 单调
  - 非法数据产生 error 事件（无 silent fail）
  - 回放顺序与解析规则已写入验证输出摘要
  - 未修改 SSOT/Charter/test_files

**Acceptance Criteria**
- Loader 能从 yhl.db 构建 ModelTableRuntime。
- 回放语义符合 `modeltable_runtime_v0` 的校验与确定性要求。
- FunctionLabel 识别与 JS 函数注册策略可被验证脚本覆盖。
- Validation 脚本单用例 PASS。

**SSOT Violation Check**
- 核心约束：只通过 add_label/rm_label 触发副作用（`docs/ssot/runtime_semantics_modeltable_driven.md`）。
- 判定口径：无旁路副作用路径；未修改 SSOT 文件。

**Charter Violation Check**
- 核心约束：仅控制总线范围，不引入 Matrix/Element Call/E2EE（`docs/charters/dongyu_app_next_runtime.md`）。
- 判定口径：未新增超范围通道；未修改 Charter 文件。

**Rollback Strategy**
- 还原 Step 1 涉及的文件改动。

---

### Step 2 — Validate trigger/connection cases
**Goal**
- 验证 run_<func> 与 CONNECT allow-list 的最小可观测行为。

**Scope**
- 仅执行验证脚本并记录输出。

**Files**
- Update:
  - `docs/iterations/0127-program-model-loader-v0/runlog.md`
- Must NOT touch:
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/charters/dongyu_app_next_runtime.md`
  - `test_files/test7/*`

**Validation (Executable)**
- Commands:
  - `bun scripts/validate_program_model_loader_v0.mjs --case all --db test_files/test7/yhl.db`
  - `git diff --name-only`
  - `test -z "$(git status --porcelain | rg '^\?\?' | rg -v '^(\?\? (\.opencode/oh-my-opencode\.json|\.sisyphus/|docs/concepts/|test_files/))')"`
  - `test -z "$(git diff --name-only | rg -n '^(docs/architecture_mantanet_and_workers\.md|docs/charters/dongyu_app_next_runtime\.md|test_files/)')"`
- Expected signals:
  - all cases PASS
  - run_<func> 已注册触发 intercept，未注册产生 error
  - CONNECT allow-list 行为仅产生证据内副作用
  - 合成负例覆盖非法 label 与未注册函数路径

**Acceptance Criteria**
- 全量验证通过并记录到 runlog。

**SSOT Violation Check**
- 核心约束：初始化与运行期解释规则一致（`docs/ssot/runtime_semantics_modeltable_driven.md`）。
- 判定口径：验证脚本未要求“init 阶段抑制语义”；无 SSOT 文件改动。

**Charter Violation Check**
- 核心约束：built-in k 语义以 PICtest 证据为准（`docs/charters/dongyu_app_next_runtime.md`）。
- 判定口径：验证仅覆盖证据内行为；无 Charter 文件改动。

**Rollback Strategy**
- 重新执行验证并修复失败项。

---

### Step 3 — Finalize iteration records
**Goal**
- 完成 runlog 证据记录与 Iterations 索引状态更新。

**Scope**
- 更新 iteration 记录文档：
  - `docs/iterations/0127-program-model-loader-v0/runlog.md`
  - `docs/ITERATIONS.md`

**Files**
- Update:
  - `docs/iterations/0127-program-model-loader-v0/runlog.md`
  - `docs/ITERATIONS.md`
- Must NOT touch:
  - `docs/architecture_mantanet_and_workers.md`

**Validation (Executable)**
- Commands:
  - `git add docs/ITERATIONS.md docs/iterations/0127-program-model-loader-v0/runlog.md`
  - `git show :docs/ITERATIONS.md | rg -n '^\| 0127-program-model-loader-v0 \|.*\| dev_0127-program-model-loader-v0 \| Completed \| \./docs/iterations/0127-program-model-loader-v0/ \|'`
  - `git diff --cached --name-only`
  - `test -n "$(git diff --cached --name-only)"`
  - `test -n "$(git diff --cached --name-only | rg -n '^docs/ITERATIONS\.md$')"`
  - `test -n "$(git diff --cached --name-only | rg -n '^docs/iterations/0127-program-model-loader-v0/runlog\.md$')"`
  - `test -z "$(git diff --cached --name-only | rg -v '^(docs/iterations/0127-program-model-loader-v0/runlog\.md|docs/ITERATIONS\.md)$')"`
- Expected signals:
  - Iterations 状态为 Completed 且分支/入口一致
  - staged 仅包含 runlog 与 ITERATIONS

**Acceptance Criteria**
- runlog 中记录 Phase3 执行证据与验证结果。
- docs/ITERATIONS.md 中本迭代状态为 Completed。

**SSOT Violation Check**
- 核心约束：不修改 SSOT；只更新记录文件。
- 判定口径：staged 仅包含 runlog 与 ITERATIONS。

**Charter Violation Check**
- 核心约束：不修改 Charter；仅更新记录文件。
- 判定口径：staged 仅包含 runlog 与 ITERATIONS。

**Rollback Strategy**
- 还原 `docs/iterations/0127-program-model-loader-v0/runlog.md` 和 `docs/ITERATIONS.md`。

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
