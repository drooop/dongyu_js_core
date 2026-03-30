---
title: "0163 — 清理旧类型兼容分支"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0163-cleanup-deprecated-labels
id: 0163-cleanup-deprecated-labels
phase: phase1
---

# 0163 — 清理旧类型兼容分支

## 0. Goal

在 runtime 层移除旧 label 类型兼容分支与旧值格式解析，完成旧类型零残留扫描，并确保回归可复现。

## 1. Scope

- In scope:
  - `packages/worker-base/src/runtime.mjs` 兼容分支清理。
  - 新规则落地：`pin.model.* -> pin.table.*`，并为 `model.single` 引入 `pin.single.*`。
  - `model_id=0` 仅保留 `pin.bus.in|pin.bus.out` 作为外部连接总线端口。
  - `ui-server` 环境移除 `MATRIX_MBR_BOT_ACCESS_TOKEN`，避免认证身份回退到 `mbr`。
  - 受影响 tests/validate 断言同步到“无兼容层”口径。
  - 0163 规定 grep 门控 + 显式测试清单执行并落盘。
- Out of scope:
  - 新功能开发（仅做兼容层删除和必要对齐）。
  - 与 Matrix/bun 外部环境相关的集成配置变更。

## 2. Constraints

- fill-table-only：OFF（本迭代为 Tier 1）。
- 仅在确认 0162 迁移已落盘后进入清理。
- 所有结论必须有命令输出或文件证据（runlog 记录）。

## 3. Success Criteria

- `runtime.mjs` 不再包含旧 label alias map 与旧格式兼容代码。
- 0163 规定 grep 命令对旧类型命中为 0（排除 `.legacy`）。
- 显式 tests/validate 清单在当前环境下可复现并给出 PASS/FAIL 说明。
