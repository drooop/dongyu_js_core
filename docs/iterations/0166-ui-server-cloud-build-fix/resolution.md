---
title: "Iteration 0166-ui-server-cloud-build-fix Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0166-ui-server-cloud-build-fix
id: 0166-ui-server-cloud-build-fix
phase: phase1
---

# Iteration 0166-ui-server-cloud-build-fix Resolution

## Execution Strategy

- 先用 production build 做最小复现，确认失败稳定且根因落在 `runtime.mjs` 顶层 `node:module` 依赖。
- 再补一个直接覆盖该回归的 failing test，随后做最小修复，让 browser bundle 不再静态触达 Node-only import。
- 修复后立即复跑 build，并回到 0165 远端 deploy 流程。

## Step 1

- Scope:
  - 复现 frontend production build blocker，并记录根因证据。
- Files:
  - `packages/ui-model-demo-frontend/package.json`
  - `packages/worker-base/src/runtime.mjs`
- Verification:
  - `npm -C packages/ui-model-demo-frontend run build`
- Acceptance:
  - 失败栈明确指向 `runtime.mjs` 顶层 `createRequire`
- Rollback:
  - 无代码改动，无需回滚

## Step 2

- Scope:
  - 先写失败校验，再做最小修复。
- Files:
  - `scripts/tests/test_0166_frontend_build_runtime_guard.mjs`
  - `packages/worker-base/src/runtime.mjs`
- Verification:
  - 新测试先 FAIL 后 PASS
  - `npm -C packages/ui-model-demo-frontend run build`
- Acceptance:
  - browser bundle 不再因 `node:module` externalization 失败
- Rollback:
  - 回退新增测试与 `runtime.mjs` 修复

## Step 3

- Scope:
  - 回到 0165，继续远端 deploy。
- Files:
  - `docs/iterations/0165-cloud-deploy-aaf4083/runlog.md`
  - `docs/iterations/0166-ui-server-cloud-build-fix/runlog.md`
- Verification:
  - 0165 远端构建/发布命令
- Acceptance:
  - deploy 路径恢复推进
- Rollback:
  - 记录失败点后停止，不做猜测性变更

## Notes

- Generated at: 2026-03-06
