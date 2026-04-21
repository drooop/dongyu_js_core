---
title: "0147 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0147-fill-table-only-auto-gate
id: 0147-fill-table-only-auto-gate
phase: phase1
---

# 0147 — Resolution (HOW)

## 0. Execution Rules
- Work branch: `dev_0147-fill-table-only-auto-gate`
- Steps in order; evidence only in runlog.
- Validation must be executable with deterministic PASS/FAIL.

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Define auto-gate contract | 明确 hook 自动门禁口径并更新 SSOT | `docs/ssot/fill_table_only_mode.md`, `docs/iterations/0147-fill-table-only-auto-gate/*` | `rg -n "pre-commit|core.hooksPath|on/off/status/check" docs/ssot/fill_table_only_mode.md` | 文档包含自动触发与 skill 接入口径 | Revert docs |
| 2 | Implement hook + mode control | 增加 pre-commit、安装脚本、模式开关脚本 | `.githooks/pre-commit`, `scripts/ops/install_git_hooks.sh`, `scripts/fill_table_only_mode_ctl.mjs`, `scripts/validate_fill_table_only_mode.mjs` | `bash scripts/ops/install_git_hooks.sh --dry-run` + `node scripts/fill_table_only_mode_ctl.mjs status` | 可安装、可开关、可自动校验 staged | Revert scripts/hook |
| 3 | Add tests for control flow | 覆盖 mode on/off/status 与 staged check 行为 | `scripts/tests/test_0147_fill_table_only_auto_gate.mjs` | `node scripts/tests/test_0147_fill_table_only_auto_gate.mjs` | 全 PASS | Revert test |
| 4 | Record evidence + complete index | 记录真实输出并收口迭代状态 | `docs/iterations/0147-fill-table-only-auto-gate/runlog.md`, `docs/ITERATIONS.md` | 运行 command evidence | runlog 完整 + ITERATIONS Completed | Revert runlog/index |

## 2. Step Details

### Step 1 — Define auto-gate contract
**Goal**
- 把“自动门禁 + skill 接入点”写入治理文档，避免口径分裂。

**Scope**
- 更新 Fill-Table-Only SSOT，新增自动化章节。
- 填充 0147 的 plan/resolution。

**Files**
- Create/Update:
  - `docs/ssot/fill_table_only_mode.md`
  - `docs/iterations/0147-fill-table-only-auto-gate/plan.md`
  - `docs/iterations/0147-fill-table-only-auto-gate/resolution.md`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`

**Validation (Executable)**
- `rg -n "pre-commit|core.hooksPath|on/off/status/check" docs/ssot/fill_table_only_mode.md`

**Acceptance Criteria**
- 文档明确 hook 安装、模式开关、skill 触发建议。

**Rollback Strategy**
- 回退文档变更。

---

### Step 2 — Implement hook + mode control
**Goal**
- 提供自动门禁执行链路：`mode on -> pre-commit auto guard`。

**Scope**
- 新建 `.githooks/pre-commit`。
- 新建 `scripts/ops/install_git_hooks.sh`（支持 `--dry-run`）。
- 新建 `scripts/fill_table_only_mode_ctl.mjs`（`on/off/status/check`）。
- 增强 `scripts/validate_fill_table_only_mode.mjs` 以支持 staged-only 校验（供 pre-commit 用）。

**Files**
- Create/Update:
  - `.githooks/pre-commit`
  - `scripts/ops/install_git_hooks.sh`
  - `scripts/fill_table_only_mode_ctl.mjs`
  - `scripts/validate_fill_table_only_mode.mjs`
- Must NOT touch:
  - Runtime core files

**Validation (Executable)**
- `bash scripts/ops/install_git_hooks.sh --dry-run`
- `node scripts/fill_table_only_mode_ctl.mjs status`
- `node scripts/fill_table_only_mode_ctl.mjs on`
- `node scripts/fill_table_only_mode_ctl.mjs check --paths "packages/worker-base/src/runtime.js"`
- `node scripts/fill_table_only_mode_ctl.mjs off`

**Acceptance Criteria**
- mode 状态可切换。
- check 能触发 guard PASS/FAIL。
- hook 可被安装并在启用模式时触发。

**Rollback Strategy**
- 删除 hook 与控制脚本，恢复 validator 到前一版本。

---

### Step 3 — Add tests for control flow
**Goal**
- 用脚本测试证明控制链路稳定。

**Scope**
- 增加 `scripts/tests/test_0147_fill_table_only_auto_gate.mjs`。
- 至少覆盖：
  - `status` 输出。
  - `on -> status(enabled)`。
  - `check` 违规时返回非 0 且包含 required action。
  - `off -> status(disabled)`。

**Files**
- Create/Update:
  - `scripts/tests/test_0147_fill_table_only_auto_gate.mjs`

**Validation (Executable)**
- `node scripts/tests/test_0147_fill_table_only_auto_gate.mjs`

**Acceptance Criteria**
- 全 PASS。

**Rollback Strategy**
- 回退新增测试。

---

### Step 4 — Record evidence + complete index
**Goal**
- 完成事实留痕并收口迭代状态。

**Scope**
- 在 runlog 写入命令与关键输出。
- `docs/ITERATIONS.md` 状态改为 Completed。

**Files**
- Create/Update:
  - `docs/iterations/0147-fill-table-only-auto-gate/runlog.md`
  - `docs/ITERATIONS.md`

**Validation (Executable)**
- `rg -n "0147-fill-table-only-auto-gate" docs/ITERATIONS.md`

**Acceptance Criteria**
- runlog 可审计，index 状态收口。

**Rollback Strategy**
- 回退 runlog/index 更新。
