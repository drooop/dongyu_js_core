---
title: "Iteration 0164-playwright-readiness-fixes Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0164-playwright-readiness-fixes
id: 0164-playwright-readiness-fixes
phase: phase1
---

# Iteration 0164-playwright-readiness-fixes Resolution

## 0. Execution Rules

- Work branch: `dev_0164-playwright-readiness-fixes`
- Working directory for every command: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must pass both functional validation and conformance review.
- This iteration is a readiness repair line, not a browser execution line:
  - Output is a Go/No-Go decision for follow-up Playwright validation.
  - Actual Playwright or manual browser execution belongs to a later approved verification iteration unless the user explicitly expands scope.
- Any real execution evidence must be written to `docs/iterations/0164-playwright-readiness-fixes/runlog.md`, not to this file.

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Freeze Readiness Gate | 用定向测试和静态校验冻结 active regression surface | `scripts/tests/test_0164_migration_readiness.mjs`, `scripts/validate_builtins_v0.mjs` | `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0164_migration_readiness.mjs` | 失败或通过都能精确指向 active readiness 路径，而不是 archive 噪音 | 回退本 Step 的测试/校验脚本提交 |
| 2 | Repair Active Pin Path | 以最小改动修复 model patch、server ingress、remote worker 声明 | `packages/worker-base/system-models/test_model_100_ui.json`, `packages/worker-base/system-models/workspace_positive_models.json`, `packages/ui-model-demo-server/server.mjs`, `scripts/run_worker_remote_v0.mjs` | `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0144_remote_worker.mjs` | 活跃路径只使用当前 pin family，且 remote worker 合同验证保持通过 | 回退本 Step 的代码提交 |
| 3 | Revalidate And Decide Go/No-Go | 复跑 readiness / builtins / conformance，产出是否允许进入后续浏览器验收的裁决 | `scripts/tests/test_0164_migration_readiness.mjs`, `scripts/validate_builtins_v0.mjs`, `docs/iterations/0164-playwright-readiness-fixes/runlog.md` | `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/validate_builtins_v0.mjs` | 形成 deterministic PASS/FAIL 证据，并给出明确 Go/No-Go 结论 | 回退本 Step 的文档与验证相关提交 |

## 2. Step Details

### Step 1 — Freeze Readiness Gate

**Goal**

- 把“Playwright 前置修复”从模糊的搜索结论收敛为可重复、可回归、可失败的 deterministic gate。

**Scope**

- 审计 0164 的活跃影响范围：
  - `packages/worker-base/system-models/test_model_100_ui.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/run_worker_remote_v0.mjs`
- 将上述影响范围固化到定向测试与最小 builtins 校验中。
- 确保测试失败时能明确指出：
  - legacy `PIN_IN` / `PIN_OUT`
  - legacy `IN`
  - server dual-bus ingress 的 legacy 写法
  - remote worker 声明与当前 pin family 的不一致

**Files**

- Create/Update:
  - `scripts/tests/test_0164_migration_readiness.mjs`
  - `scripts/validate_builtins_v0.mjs`
- Must NOT touch:
  - `packages/ui-model-demo-frontend/**`
  - `packages/ui-renderer/**`
  - `k8s/**`
  - `deploy/**`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0164_migration_readiness.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/validate_builtins_v0.mjs`
- Expected signals:
  - `test_0164_migration_readiness.mjs` 在失败时必须直接指出具体文件和具体 legacy 断言。
  - `validate_builtins_v0.mjs` 必须继续对当前 `pin.connect.*` builtins 给出 deterministic PASS/FAIL。

**Acceptance Criteria**

- readiness gate 的覆盖面仅限 active path，不误报 archive 或文档历史术语。
- 测试名称、断言信息、失败文案足以支持后续 Step 2 的最小修复。
- Step 1 完成后，执行者可以不依赖聊天上下文也能知道 0164 要修的是什么。

**Rollback Strategy**

- 回退 `scripts/tests/test_0164_migration_readiness.mjs` 与 `scripts/validate_builtins_v0.mjs` 在本 Step 引入的变更。
- 若 gate 设计错误导致误导执行，直接回退本 Step 提交并重新审定影响范围，不进入 Step 2。

---

### Step 2 — Repair Active Pin Path

**Goal**

- 以最小代码改动把活跃 readiness 路径收敛到当前 SSOT pin family，消除会让后续浏览器验收结论失真的 legacy 入口。

**Scope**

- 修复 Model 100 与 Workspace 正数模型相关的活跃 patch 资产，使其不再依赖 legacy pin 输入面。
- 修复 `server.mjs` 的 dual-bus patch ingress，使其按 runtime 当前模型输入类型投递，而不是写死 legacy `IN`。
- 修复 `scripts/run_worker_remote_v0.mjs` 的远端 worker mailbox 声明和注释口径，使其与当前 `pin.in` / `pin.out` 语义一致。
- 只处理 active readiness 路径，不把全仓库 legacy 名称扫除扩大为大重构。

**Files**

- Create/Update:
  - `packages/worker-base/system-models/test_model_100_ui.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/run_worker_remote_v0.mjs`
- Must NOT touch:
  - `packages/ui-model-demo-frontend/**`
  - `packages/ui-renderer/**`
  - `docs/ssot/**`
  - `docs/user-guide/**`
  - `k8s/**`
  - `deploy/**`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0164_migration_readiness.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0144_remote_worker.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n --glob '!**/*.legacy*' -e 'PIN_IN' -e 'PIN_OUT' -e "t: 'IN'" -e "inLabel\\.t !== 'IN'" packages/worker-base/system-models packages/ui-model-demo-server scripts`
- Expected signals:
  - `test_0164_migration_readiness.mjs` PASS。
  - `test_0144_remote_worker.mjs` PASS，证明 remote worker 合同未被修坏。
  - `rg` 结果不再命中 active implementation files 中的 legacy pin/input 写法；若仍有命中，必须能证明只是注释或历史说明，并在 runlog 记录。

**Acceptance Criteria**

- `test_model_100_ui.json` 的 patch ingress 判断与当前 `pin.in` 口径一致。
- `workspace_positive_models.json` 继续作为活跃正数模型导入资产，并保持对当前 pin family 的一致性。
- `server.mjs` 不再用 legacy `IN` 作为 dual-bus patch 路由默认输入面。
- `scripts/run_worker_remote_v0.mjs` 的声明、行为和注释口径与当前 pin family 一致。
- Step 2 没有引入新的 compatibility alias、没有触碰前端/渲染器工作线、没有把 Tier 2 问题上推成新的 runtime 语义。

**Rollback Strategy**

- 若 Step 2 任一修复破坏了 remote worker 合同或 readiness gate，回退本 Step 代码提交并重新定位最小修复面。
- 只按文件级回退本 Step 改动，不回退其他并行工作或无关变更。

---

### Step 3 — Revalidate And Decide Go/No-Go

**Goal**

- 用完整的 deterministic 证据判断：当前代码是否已经具备进入后续 Playwright 浏览器验收的前置条件。

**Scope**

- 复跑 readiness gate、remote worker 合同验证、builtins 校验。
- 对照 `CLAUDE.md` 与 `docs/ssot/tier_boundary_and_conformance_testing.md` 做 conformance review：
  - tier placement
  - model placement
  - data ownership
  - data flow
  - data chain
- 在 `runlog.md` 记录明确裁决：
  - `Go`: 允许进入后续浏览器验收
  - `No-Go`: 不允许进入，并写明 blocker 文件、失败命令、根因分类

**Files**

- Create/Update:
  - `scripts/tests/test_0164_migration_readiness.mjs`
  - `scripts/validate_builtins_v0.mjs`
  - `docs/iterations/0164-playwright-readiness-fixes/runlog.md`
- Must NOT touch:
  - `packages/ui-model-demo-frontend/**`
  - `packages/ui-renderer/**`
  - `docs/ssot/**`
  - `docs/user-guide/**`
  - `k8s/**`
  - `deploy/**`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0164_migration_readiness.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0144_remote_worker.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/validate_builtins_v0.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n --glob '!**/*.legacy*' -e 'PIN_IN' -e 'PIN_OUT' -e "t: 'IN'" -e "inLabel\\.t !== 'IN'" packages/worker-base/system-models packages/ui-model-demo-server scripts`
- Expected signals:
  - 三类脚本全部 PASS。
  - `rg` 结果要么为空，要么只剩历史说明/测试自检文本，并在 runlog 说明为何不构成 active blocker。
  - runlog 能用事实回答“是否允许进入 Playwright”，而不是只写“看起来没问题”。

**Acceptance Criteria**

- 0164 的 Go/No-Go 结论由命令输出和代码证据支撑，可被无上下文读者复查。
- 若结论为 `Go`，必须明确说明该结论只覆盖代码前置条件，不替代后续真实浏览器执行。
- 若结论为 `No-Go`，必须明确阻塞位于哪个文件、哪条链路、哪条验证命令，并停止进入后续浏览器验收。

**Rollback Strategy**

- 若 Step 3 的裁决依据不充分或引用了错误证据，回退本 Step 的文档提交并重新执行复验。
- 不因 Step 3 回退而隐式撤销 Step 1/2 已经验证成立的事实；若需要否定前序结论，必须在新的 runlog 记录中显式说明。

> 本文件只定义 HOW；不得记录 PASS/FAIL、命令输出、commit hash 或真实执行结果。
