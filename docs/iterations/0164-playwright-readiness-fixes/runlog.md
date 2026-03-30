---
title: "Iteration 0164-playwright-readiness-fixes Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0164-playwright-readiness-fixes
id: 0164-playwright-readiness-fixes
phase: phase3
---

# Iteration 0164-playwright-readiness-fixes Runlog

## Environment

- Date: 2026-03-06
- Branch: `dev_0164-playwright-readiness-fixes`
- Runtime: Node.js

Review Gate Record
- Iteration ID: 0164-playwright-readiness-fixes
- Review Date: 2026-03-06
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: 用户要求继续实施；若条件具备，可在本轮修复后直接进入 Playwright 浏览器验证。

Review Gate Record
- Iteration ID: 0164-playwright-readiness-fixes
- Review Date: 2026-03-21
- Review Type: AI-assisted (Claude Code review relay)
- Review Index: 2
- Decision: Change Requested
- Notes: `validate_builtins_v0.mjs` 当前 FAIL，阻塞 Step 3 的 Go 裁决；`test_0164_migration_readiness.mjs`、`test_0144_remote_worker.mjs` 与 legacy `rg` 检查均 PASS。

## Execution Records

### Step 0 — 迭代登记与根因确认

- Command:
  - `git checkout -b dev_0164-playwright-readiness-fixes`
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0164-playwright-readiness-fixes --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - `rg -n 'PIN_IN|PIN_OUT|\\bIN\\b|CELL_CONNECT|cell_connection|MODEL_CONNECT|V1N_CONNECT' packages/worker-base/system-models packages/ui-model-demo-server scripts packages/worker-base/src`
- Key output:
  - 活跃文件仍命中：
    - `packages/worker-base/system-models/test_model_100_ui.json`
    - `packages/worker-base/system-models/workspace_positive_models.json`
    - `packages/ui-model-demo-server/server.mjs`
    - `scripts/run_worker_remote_v0.mjs`
- Result: PASS
- Commit: N/A

### Step 1 — 定向失败验证

- Command:
  - `node scripts/tests/test_0144_remote_worker.mjs`
  - `node scripts/validate_builtins_v0.mjs`
  - `node scripts/tests/test_0164_migration_readiness.mjs`
- Key output:
  - `test_0144_remote_worker.mjs`: PASS
  - `validate_builtins_v0.mjs`: PASS
  - `test_0164_migration_readiness.mjs`: 4/4 FAIL，直接命中：
    - `test_model_100_ui.json` 中 `PIN_IN`
    - `test_model_100_ui.json` 中 `inLabel.t !== 'IN'`
    - `server.mjs` 中 `{ k: pinName, t: 'IN', v: patch }`
    - `run_worker_remote_v0.mjs` 中 `PIN_IN` / `PIN_OUT`
- Result: PASS
- Commit: N/A

### Step 2 — 迁移残留最小修复

- Command:
  - `apply_patch` 更新：
    - `packages/worker-base/system-models/test_model_100_ui.json`
    - `packages/worker-base/system-models/workspace_positive_models.json`
    - `packages/ui-model-demo-server/server.mjs`
    - `scripts/run_worker_remote_v0.mjs`
    - `scripts/validate_builtins_v0.mjs`
    - `scripts/tests/test_0164_migration_readiness.mjs`
- Key output:
  - `test_model_100_ui.json` / `workspace_positive_models.json`: `PIN_IN -> pin.in`，并将静态值改为 `null`
  - `test_model_100_ui.json`: patch handler 条件改为 `inLabel.t !== 'pin.in'`
  - `server.mjs`: dual-bus patch 路由改为 `this.runtime._modelInputLabelType(targetModel)`
  - `run_worker_remote_v0.mjs`: 邮箱位统一到 `(0,1,1)` 且使用 `pin.in` / `pin.out`
  - `validate_builtins_v0.mjs`: 旧 `CELL_CONNECT/MODEL_CONNECT/V1N_CONNECT` 校验替换为 `pin.connect.label/cell/model`
- Result: PASS
- Commit: N/A

### Step 3 — 定向复验与 Playwright 准入判断

- Command:
  - `node scripts/tests/test_0164_migration_readiness.mjs`
  - `node scripts/tests/test_0144_remote_worker.mjs`
  - `node scripts/validate_builtins_v0.mjs`
  - `rg -n --glob '!**/*.legacy*' -e 'PIN_IN' -e 'PIN_OUT' packages/worker-base/system-models deploy scripts packages/ui-model-demo-server`
  - `rg -n --glob '!**/*.legacy*' -e "\\.t\\s*!==\\s*'IN'" -e "\\.t\\s*===\\s*'IN'" -e "t: 'IN'" packages/worker-base/system-models deploy scripts packages/ui-model-demo-server`
- Key output:
  - `test_0164_migration_readiness.mjs`: 4/4 PASS
  - `test_0144_remote_worker.mjs`: 7/7 PASS
  - `validate_builtins_v0.mjs`: PASS（`pin.connect.*` 口径）
  - `rg PIN_IN|PIN_OUT`: 仅剩注释/测试说明，不在活跃实现链路
  - `rg legacy IN`: 仅剩 `validate_dual_bus_harness_v0.mjs` 的兼容分支与测试脚本自检字符串
  - Decision: 已满足“活跃软件工人模型表按新版填写”的前置条件，可进入 Color Generator Playwright 实测
- Result: PASS
- Commit: N/A

### Step 3R — 审查触发的 builtins 校验修复（2026-03-21）

- Command:
  - `node scripts/validate_builtins_v0.mjs`
  - `sed -n '388,430p' packages/worker-base/src/runtime.mjs`
  - `sed -n '1715,1735p' packages/worker-base/src/runtime.mjs`
  - `apply_patch` 更新 `scripts/validate_builtins_v0.mjs`
  - `node scripts/tests/test_0164_migration_readiness.mjs`
  - `node scripts/tests/test_0144_remote_worker.mjs`
  - `node scripts/validate_builtins_v0.mjs`
  - `rg -n --glob '!**/*.legacy*' -e 'PIN_IN' -e 'PIN_OUT' -e "t: 'IN'" -e "inLabel\\.t !== 'IN'" packages/worker-base/system-models packages/ui-model-demo-server scripts`
- Key output:
  - 首次复现：`VALIDATION FAILED` / `local_mqtt: expected 1 event`
  - 根因确认：`ModelTableRuntime` 构造时会先写入 `runtime_mode=boot`；`run_*` 只有在 `setRuntimeMode('edit') -> setRuntimeMode('running')` 后才会触发 `run_func` / `func_not_found`
  - 最小修复：`validate_builtins_v0.mjs` 增加 `createIsolatedRuntime()` 以隔离 bootstrap 事件，并增加 `activateRuntime()` 以按当前生命周期验证 `run_*`
  - 修复后：`test_0164_migration_readiness.mjs` 4/4 PASS
  - 修复后：`test_0144_remote_worker.mjs` 7/7 PASS
  - 修复后：`validate_builtins_v0.mjs` 全部 PASS（`local_mqtt` / `global_mqtt` / `model_type` / `data_type` / `v1n_id` / `pin.connect.*` / `run_*`）
  - 修复后：legacy `rg` 仅剩注释、历史测试说明与自检字符串，不构成 active implementation blocker
  - Decision: builtins validator blocker cleared，Step 3 Go 裁决恢复成立
- Result: PASS
- Commit: N/A

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed（本轮无需改动）
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed（本轮无需改动）
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed（本轮无需改动）

```
Review Gate Record
- Iteration ID: 0164-playwright-readiness-fixes
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: EXECUTION
- Review Index: 0
- Decision: On Hold
- Revision Type: N/A
- Notes: Branch guard failed: Branch mismatch: expected "dropx/dev_0164-playwright-readiness-fixes", got "dev"

Review history:

```

```
Review Gate Record
- Iteration ID: 0164-playwright-readiness-fixes
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: 评审已完成。上方包含完整的 JSON verdict 和逐项合规检查记录。
```

```
Review Gate Record
- Iteration ID: 0164-playwright-readiness-fixes
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 2
- Decision: APPROVED
- Revision Type: minor
- Notes: plan/resolution 结构完整、scope 收敛、约束遵守良好，可进入 Phase 2 Review Gate
```

```
Review Gate Record
- Iteration ID: 0164-playwright-readiness-fixes
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 3
- Decision: APPROVED
- Revision Type: minor
- Notes: 计划结构完整、scope 合理、验证闭环完备，approved 可进入 Phase 2 Review Gate。
```

```
Review Gate Record
- Iteration ID: 0164-playwright-readiness-fixes
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 1
- Decision: APPROVED
- Revision Type: minor
- Notes: 审查已完成，verdict JSON 已在上方输出。等待确认退出 plan mode。
```

```
Review Gate Record
- Iteration ID: 0164-playwright-readiness-fixes
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 2
- Decision: NEEDS_CHANGES
- Revision Type: major
- Notes: 审查结论已输出。核心问题：`validate_builtins_v0.mjs` 当前 FAIL，阻塞 Step 3 的 Go 裁决。其余两个验证脚本和 legacy rg 检查均 PASS。
```

```
Review Gate Record
- Iteration ID: 0164-playwright-readiness-fixes
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 3
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查已完成，verdict 在上方。本轮是纯审查任务，无需实施计划。
```

```
Review Gate Record
- Iteration ID: 0164-playwright-readiness-fixes
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 4
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查完成。Verdict: **APPROVED**，所有 4 项验证命令全部 PASS，上轮 builtins validator 阻塞已清除。
```

```
Review Gate Record
- Iteration ID: 0164-playwright-readiness-fixes
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 5
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查完成。Verdict JSON 已在上方输出，核心结论：**APPROVED**，0164 所有交付物验证通过，可进入后续 Playwright 浏览器验收阶段。
```
