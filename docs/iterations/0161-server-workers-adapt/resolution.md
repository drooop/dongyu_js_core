---
title: "0161 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0161-server-workers-adapt
id: 0161-server-workers-adapt
phase: phase1
---

# 0161 — Resolution (HOW)

## 0. Strategy

先做最小行为改造（server + worker），再执行 targeted 回归；deploy/fixtures 采用“复核+最小必要改动”策略。

## 1. Steps

| Step | Scope | Files | Verify |
|---|---|---|---|
| 1 | server 函数识别与编译值兼容 | `packages/ui-model-demo-server/server.mjs` | server 启动相关测试/静态检查通过 |
| 2 | worker_engine 函数识别与执行值兼容 | `scripts/worker_engine_v0.mjs` | worker 引擎相关 validate 通过 |
| 3 | deploy/fixtures 复核与补丁 | `deploy/.../00_remote_worker_config.json`, `scripts/fixtures/**` | 旧类型扫描无残留 |
| 4 | 回归与归档 | tests + runlog | 关键测试 PASS |

## 2. Verification Commands

1. `rg -n "label\.t\s*===\s*'function'|\.t\s*===\s*'function'" packages/ui-model-demo-server/server.mjs scripts/worker_engine_v0.mjs`
2. `node scripts/tests/test_0155_prompt_filltable_policy.mjs`
3. `node scripts/tests/test_0158_new_label_types.mjs`
4. `node scripts/tests/test_0158_func_value_compat.mjs`
5. `node scripts/validate_model100_records_e2e_v0.mjs`
6. `node scripts/validate_intent_dispatch_pin_v0.mjs`

## 3. Gate Notes

- 分支：`dev_0161-server-workers-adapt`（禁含 `-ft-`）。
- fill-table-only：OFF（本迭代涉及 JS 运行逻辑文件）。
