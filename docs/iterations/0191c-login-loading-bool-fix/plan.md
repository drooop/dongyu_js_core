---
title: "Iteration 0191c-login-loading-bool-fix Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0191c-login-loading-bool-fix
id: 0191c-login-loading-bool-fix
phase: phase1
---

# Iteration 0191c-login-loading-bool-fix Plan

## Goal

- 修复 `login_catalog_ui.json` 中 `login_loading` 的类型错误，使其符合布尔语义。

## Background

- 当前 `login_catalog_ui.json` 将 `login_loading` 声明为：
  - `t: "str"`
  - `v: "false"`
- 这会导致任何按 truthy/falsy 判定的消费者出现错误。
- 审查结论已明确这是应修项，建议在进入 `0191d` 前顺手修掉。

## Scope

- In scope:
  - 将 `login_loading` 改为 `t: "bool", v: false`
  - 用现有 `test_0191c_login_patch_schema.mjs` 补一条明确的布尔断言
- Out of scope:
  - 不处理 `Model -21` form label 显式标注
  - 不改其他 login 行为

## Invariants / Constraints

- 不改变 Login 页面结构与 endpoint 形态。
- 只修类型，不引入新的字段。

## Success Criteria

- `login_loading` 在 patch 应用后是布尔 `false`
- 登录 patch 测试通过

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0191c-login-loading-bool-fix
