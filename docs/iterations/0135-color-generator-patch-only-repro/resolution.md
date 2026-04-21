---
title: "Iteration 0135-color-generator-patch-only-repro Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0135-color-generator-patch-only-repro
id: 0135-color-generator-patch-only-repro
phase: phase1
---

# Iteration 0135-color-generator-patch-only-repro Resolution

## Execution Strategy

先建立代码级证据，再在隔离工作区执行可超时复验，最后用 Playwright 做终验并把可复现知识写入 runbook。执行中不依赖仓库内既有 `yhl.db` 内容。

## Step 1

- Scope:
  - 固化“负数模型初始化加载 + 正数模型 patch 注入”的源码证据。
  - 记录环境基线与执行前状态。
- Files:
  - `docs/iterations/0135-color-generator-patch-only-repro/runlog.md`
  - `docs/iterations/0135-color-generator-patch-only-repro/assets/*`
- Verification:
  - `rg -n "loadSystemModelPatches|MODELTABLE_PATCH_JSON|loadSystemPatch|applyPatch|test_model_100_full" packages scripts -S`
  - `git status --short && git diff --stat`
- Acceptance:
  - 证据能支撑两段加载机制，不依赖推测。
- Rollback:
  - 回退 runlog 与 assets 记录。

## Step 2

- Scope:
  - 用独立数据根启动 Server/MBR/K8s Worker，执行认证态 API 复验。
- Files:
  - `docs/iterations/0135-color-generator-patch-only-repro/runlog.md`
  - `docs/iterations/0135-color-generator-patch-only-repro/assets/*`
- Verification:
  - 端口与进程检查通过。
  - API 脚本输出 `PASS initial=... updated=...`。
  - 服务日志出现转发与回写关键字（`ui_event`, `routing to`, `Detected event`）。
- Acceptance:
  - 在限定时间内得到 PASS 或可定位的 FAIL 根因。
- Rollback:
  - 停止本次新增进程并删除临时 PID 文件。

## Step 3

- Scope:
  - 使用 Playwright 完成最终可视化/交互式终验。
- Files:
  - `docs/iterations/0135-color-generator-patch-only-repro/assets/playwright_verify_result_0135.json`
  - `docs/iterations/0135-color-generator-patch-only-repro/runlog.md`
- Verification:
  - Playwright 登录并触发 `ui_event`。
  - 轮询 `/snapshot` 观察 `bg_color` 变化。
- Acceptance:
  - Playwright PASS 且与 Step 2 一致。
- Rollback:
  - 关闭浏览器会话，清理临时截图。

## Step 4

- Scope:
  - 更新 runbook 与索引文档，沉淀 patch-only 测试模式证据。
- Files:
  - `docs/user-guide/color_generator_e2e_runbook.md`
  - `docs/user-guide/README.md`
  - `docs/ITERATIONS.md`
  - `docs/iterations/0135-color-generator-patch-only-repro/runlog.md`
- Verification:
  - `rg -n "patch-only|yhl.db|负数模型|正数模型|证据" docs/user-guide/color_generator_e2e_runbook.md`
  - `rg -n "0135-color-generator-patch-only-repro" docs/ITERATIONS.md`
- Acceptance:
  - 文档可独立指导复验且与执行事实一致。
- Rollback:
  - 回退文档与索引变更。

## Notes

- Generated at: 2026-02-09
