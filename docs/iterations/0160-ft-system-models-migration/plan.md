---
title: "0160 — System Models JSON 全量迁移"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0160-ft-system-models-migration
id: 0160-ft-system-models-migration
phase: phase1
---

# 0160 — System Models JSON 全量迁移

## 0. Goal

将 `packages/worker-base/system-models/*.json` 与 `deploy/sys-v1ns/**/*.json` 中旧 label.t 与旧连接值格式迁移到新 PIN 体系，且不改 runtime/server 代码逻辑。

## 1. Scope

- In scope:
  - system-models 与 deploy patches JSON 的旧类型迁移。
  - `server_config.json` 中 `snapshot_filter_config.exclude_label_types` 同步到新名称。
- Out of scope:
  - `*.legacy*` 文件。
  - `scripts/fixtures/*.json`（按 v4 定稿移到 0161）。
  - runtime/server/worker 代码文件。

## 2. Constraints

- 本迭代为 `-ft-` 分支，按 fill-table-only 门禁执行；只改白名单路径。
- 转换规则固定：
  - `function -> func.js`，`v: string -> {code: string, modelName: string}`
  - `CELL_CONNECT -> pin.connect.label`（map 值转 `{from,to}` 数组）
  - `cell_connection -> pin.connect.cell`
  - `BUS_IN/BUS_OUT -> pin.bus.in/pin.bus.out`
  - `MODEL_IN/MODEL_OUT -> pin.model.in/pin.model.out`
  - `subModel -> submt`

## 3. Success Criteria

- system-models/deploy 非 legacy JSON 中不再出现旧类型字面量。
- 所有改动 JSON 解析通过。
- 关键测试（fill-table guard + 0155 + 0158）PASS。
