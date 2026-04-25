---
title: "Iteration 0196-mbr-doc-conformance-fix Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0196-mbr-doc-conformance-fix
id: 0196-mbr-doc-conformance-fix
phase: phase1
---

# Iteration 0196-mbr-doc-conformance-fix Plan

## Goal

- 修复 `0196` 审查中指出的 3 条文档/注释不一致，使 MBR triggerless 路线的描述与事实完全一致。

## Scope

- In scope:
  - 更新 `worker_engine_v0` 中 `_processRunTriggers()` 的过时注释
  - 更新 `run_worker_v0` 文件头 JSDoc，反映 function-name 直调模式
  - 在 conformance 文档中补 `MGMT_OUT` 作为临时 host-glue 出口的 approved exception
- Out of scope:
  - 不修改运行时行为
  - 不修改 MBR patch / runner 逻辑
  - 不开启 `0197` 实现工作

## Invariants / Constraints

- 这是 docs/comment follow-up，不得引入任何行为改动。
- `MGMT_OUT` 例外描述必须与 `0196` runlog 中的实际说明一致。

## Success Criteria

- 3 条审查意见都被落实：
  - 注释更新
  - JSDoc 更新
  - conformance exception 落盘
- `test_0196_mbr_triggerless_contract` 继续 PASS。
- `git diff` 只涉及注释/文档，不涉及行为逻辑。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0196-mbr-doc-conformance-fix
