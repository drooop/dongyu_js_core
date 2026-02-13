# 0148 — Resolution (HOW)

## 0. Execution Rules
- Work branch: `dev_0148-ft-skill-branch-gate`
- Steps in order; evidence only in runlog.

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Branch-based pre-commit gate | ft 分支自动执行 guard，非 ft 分支静默跳过 | `.githooks/pre-commit` | `.githooks/pre-commit` (on dev vs on ft branch) | 满足自动启停与静默 | Revert hook |
| 2 | SSOT update | 写明 `$ft` 与分支命名约定 | `docs/ssot/fill_table_only_mode.md` | `rg -n "dev_.*-ft-|\$ft|pre-commit" docs/ssot/fill_table_only_mode.md` | 文档自洽 | Revert SSOT |
| 3 | Create ft skill | 安装 `ft` skill 到 codex skills | `/Users/drop/.codex/skills/ft/SKILL.md` | 读取文件 + quick validate | 下次 `$ft` 能触发 | Remove skill dir |
| 4 | Tests + evidence + close | 补测试、写 runlog、更新 Completed | `scripts/tests/test_0148_ft_branch_gate.mjs`, `docs/ITERATIONS.md` | `node scripts/tests/test_0148_ft_branch_gate.mjs` | PASS 且 index Completed | Revert |

## 2. Step Details

### Step 1 — Branch-based pre-commit gate
**Goal**
- 不需要任何 `on/off`，只靠分支名自动启停。

**Scope**
- `.githooks/pre-commit` 获取当前分支名：包含 `-ft-` 时执行：
  - `node scripts/validate_fill_table_only_mode.mjs --mode fill-table-only --staged`
- 非 ft 分支：直接 exit 0（无输出）。

**Validation (Executable)**
- 在 `dev`：运行 `.githooks/pre-commit` 预期 exit 0 且无输出。
- 在 `dev_0148-ft-...`：运行 `.githooks/pre-commit` 预期会输出 guard 结果（取决于 staged 内容）。

---

### Step 2 — SSOT update
**Goal**
- 让用户只需要 `$ft ...`，明确门禁绑定分支。

**Validation (Executable)**
- `rg -n "dev_.*-ft-|\$ft|pre-commit" docs/ssot/fill_table_only_mode.md`

---

### Step 3 — Create ft skill
**Goal**
- 新增 `ft` skill：触发后自动创建 ft 分支并以 Fill-Table-Only 方式推进任务。

**Scope**
- 生成 `/Users/drop/.codex/skills/ft/SKILL.md`（尽量短，强约束）。

---

### Step 4 — Tests + evidence + close
**Goal**
- 可执行验证 + 事实记录 + 完成收口。
