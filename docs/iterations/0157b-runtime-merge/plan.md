---
title: "0157b — Runtime 文件合并（mjs 主体 + CJS shim）"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0157b-runtime-merge
id: 0157b-runtime-merge
phase: phase1
---

# 0157b — Runtime 文件合并（mjs 主体 + CJS shim）

## 0. Metadata

- ID: `0157b-runtime-merge`
- Date: 2026-03-06
- Branch: `dev_0157b-runtime-merge`（计划分支）
- 前置：`0157a` 已完成并切换 SSOT

## 1. Goal

将 `packages/worker-base/src/runtime.mjs` 作为唯一实现主体，
`runtime.js` 收敛为 CJS 兼容壳，消除双文件并行维护风险。

## 2. Scope

### 2.1 In Scope

- 统一 runtime 主体到 `runtime.mjs`。
- `runtime.js` 改为 re-export shim：仅导出 `ModelTableRuntime`。
- 兼容 Node ESM 场景下 `mqtt` 延迟加载（`createRequire` 回退）。
- 新增 0157b 测试：验证 CJS shim 与 mjs 导出一致。

### 2.2 Out of Scope

- 新 label.t 语义迁移（0158 执行）。
- system-models/deploy JSON 迁移（0160 执行）。
- server/worker 引用适配（0161 执行）。

## 3. Invariants / Constraints

- 不改解释器行为语义（仅实现形态收敛）。
- CJS 调用方式必须可继续 `require('../../packages/worker-base/src/runtime.js')`。
- 回归口径使用显式文件清单（不使用 glob 作为最终验收入口）。

## 4. Success Criteria

- `runtime.js` 不再包含 `ModelTableRuntime` 实现。
- `runtime.js` 与 `runtime.mjs` 导出的 `ModelTableRuntime` 为同一构造器引用。
- 0157b 新增测试通过。
- 0141~0147 与核心 runtime 测试清单通过。
