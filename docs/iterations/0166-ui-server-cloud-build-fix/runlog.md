---
title: "Iteration 0166-ui-server-cloud-build-fix Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0166-ui-server-cloud-build-fix
id: 0166-ui-server-cloud-build-fix
phase: phase3
---

# Iteration 0166-ui-server-cloud-build-fix Runlog

## Environment

- Date: 2026-03-06
- Branch: `dev_0164-playwright-readiness-fixes`
- Runtime: local repo + dy-cloud deploy target

Review Gate Record
- Iteration ID: 0166-ui-server-cloud-build-fix
- Review Date: 2026-03-06
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: 用户要求继续部署；0165 暴露代码级 build blocker，需先修复再继续 deploy。

## Execution Records

### Step 1

- Command:
  - `npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - `../worker-base/src/runtime.mjs (2:9): "createRequire" is not exported by "__vite-browser-external"`
- Result: FAIL
- Commit:

### Step 2

- Command:
  - `node scripts/tests/test_0166_frontend_build_runtime_guard.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - 新增 failing test 后先稳定失败：`frontend_build_must_pass`
  - 根因确认：`packages/worker-base/src/runtime.mjs` 顶层 `import { createRequire } from 'node:module'` 被 Vite browser bundle externalize 后报错
  - 最小修复：移除顶层 `node:module` 引用，恢复为 MQTT require 的 lazy resolution
  - 修复后：`test_0166_frontend_build_runtime_guard: PASS`
  - 修复后：`npm -C packages/ui-model-demo-frontend run build` PASS
- Result: PASS
- Commit:

### Step 3

- Command:
  - `scp packages/worker-base/src/runtime.mjs dy-cloud:/home/wwpic/dongyuapp/packages/worker-base/src/runtime.mjs`
  - 回到 0165 继续远端 build/save/deploy
- Key output:
  - 0165 远端镜像构建恢复通过，后续 deploy 完成
- Result: PASS
- Commit:

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed（本轮无需改动）
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed（本轮无需改动）
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed（本轮无需改动）
