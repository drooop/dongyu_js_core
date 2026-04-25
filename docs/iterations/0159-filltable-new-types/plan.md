---
title: "0159 — filltable_policy 与 FT skill 适配新类型"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0159-filltable-new-types
id: 0159-filltable-new-types
phase: phase1
---

# 0159 — filltable_policy 与 FT skill 适配新类型

## 0. Goal

在 filltable 链路中引入新 label type 体系的校验与提示能力，默认继续禁止结构性类型写入，只有显式允许才放开；同时保证现有 `test_0155_prompt_filltable` 行为不回归。

## 1. Scope

- In scope:
  - 更新 `filltable_policy.mjs`：
    - 新增结构性类型集合（`func.js`/`func.python`/`pin.connect.*`/`model.*`/`submt`）。
    - 增加 `allow_structural_types` 开关，默认拒绝结构性类型。
    - 扩展 `normalizeTypedValue`，支持新类型值格式校验与标准化。
  - 更新 prompt 模板（新 label type 口径）：`server.mjs` 默认模板 + `llm_cognition_config.json` 中系统模板标签。
  - 更新 `server.mjs` 的 prompt 规则文案，使 preview/apply 前置规则与策略一致。
- Out of scope:
  - system-models/deploy JSON 批量迁移（0160）。
  - runtime alias 清理（0163）。
  - worker/deploy 运行链路适配（0161）。

## 2. Constraints

- 0159 属于 filltable + server 混合改动：`fill-table-only` 必须 OFF（且 runlog 记录）。
- 分支名禁含 `-ft-`，避免 pre-commit 自动启用门禁。
- 保持默认安全策略：未显式开启时，结构性类型仍不允许由 filltable 写入。
- 新 value 口径：
  - `func.js`/`func.python`：`v` 必须为 `{ code: string, ... }`。
  - `pin.connect.*`：`v` 必须为数组。

## 3. Success Criteria

- `test_0155_prompt_filltable.mjs` PASS。
- filltable preview/apply 对新类型校验按预期生效：
  - 默认拒绝结构性类型；
  - 开启 `allow_structural_types` 时允许且按新 value 规则校验。
- runlog 中有可复现实证命令与关键输出。
