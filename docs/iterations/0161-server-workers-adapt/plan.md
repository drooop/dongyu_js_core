---
title: "0161 — Server + Workers 适配"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0161-server-workers-adapt
id: 0161-server-workers-adapt
phase: phase1
---

# 0161 — Server + Workers 适配

## 0. Goal

完成 server/worker 对 `func.js` 与结构化函数值的适配，确保 0160 迁移后的系统模型可正常注册与执行函数。

## 1. Scope

- In scope:
  - `packages/ui-model-demo-server/server.mjs`：函数标签识别由 `function` 迁移到 `func.js`（兼容 `func.python`）；函数代码读取支持 `v.code || v`。
  - `scripts/worker_engine_v0.mjs`：函数执行与 `run_*` 触发识别迁移到 `func.js`（兼容 `func.python`）；函数代码读取支持 `v.code || v`。
  - `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json`：复核是否存在旧类型残留。
  - `scripts/fixtures/`：复核是否存在 0161 需迁移的目标 fixture。
- Out of scope:
  - runtime 兼容层清理（0163）。
  - tests/validate 全量迁移（0162）。

## 2. Constraints

- 本迭代为 `ft OFF`（非 `-ft-` 分支）。
- 不回退已完成的 0160 JSON 迁移结果。
- 保留兼容窗口：`func.python` 在无 python worker 下不崩溃。

## 3. Success Criteria

- server/worker 不再硬编码仅匹配 `t === 'function'`。
- 函数值为 `{code: ...}` 的系统模型可正常注册与执行。
- 关键回归（0155/0158 + worker_engine 相关 validate）PASS。
