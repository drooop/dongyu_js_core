---
title: "Iteration 0189-feishu-spec-gap-analysis Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0189-feishu-spec-gap-analysis
id: 0189-feishu-spec-gap-analysis
phase: phase1
---

# Iteration 0189-feishu-spec-gap-analysis Plan

## Goal

- 使用 Feishu 读取 `软件工人模型2` 主文档及其直接引用文档，形成一份仓库内可复用的临时理解文档。
- 将该组外部规约与当前项目最高优先级规约进行对比，识别差异、冲突与模糊点，并给出执行层应对方案。
- 将临时分析收敛成正式 SSOT 决议文档，并输出可直接转发同事的 Feishu 文档改进建议。

## Scope

- In scope:
  - 读取主文档 `https://bob3y2gxxp.feishu.cn/wiki/JYNWwQOOjiWcOLktv07cBvIVnOh`
  - 读取主文档中直接 mention 的 5 个 Feishu 文档
  - 在 `docs/temp/` 下落盘摘要、差异分析、对同事的改进建议
  - 在 `docs/ssot/` 下落盘正式决议文档
  - 对照 `CLAUDE.md`、`docs/ssot/runtime_semantics_modeltable_driven.md`、`docs/ssot/label_type_registry.md`、`docs/ssot/host_ctx_api.md`
- Out of scope:
  - 不直接修改运行时代码实现 Flow/Data model
  - 不把临时分析直接提升为新的 SSOT
  - 不处理 Feishu 引用文档的二级递归引用

## Invariants / Constraints

- 以 `CLAUDE.md` 为最高优先级；低优先级文档不得覆盖。
- secrets 只能固化在本地忽略文件中，不得进入 git。
- 流程模型与数据模型当前视为“未实现能力”，重点给出实现路径。
- 其他已实现领域重点识别差异、冲突和模糊点，避免引入兼容债。

## Success Criteria

- `docs/temp/` 下至少生成三份文档：
  - Feishu 文档理解摘要
  - 与当前项目规约的差异/冲突/模糊点分析
  - 可直接转发同事的 Feishu 文档改进建议
- `docs/ssot/` 下生成一份正式对齐决议文档
- 差异分析必须明确区分：
  - 已实现能力的冲突/偏差
  - 未实现能力（Flow/Data）的落地建议
- runlog 记录 Feishu 抓取方式、引用文档列表、临时文档路径。

## Inputs

- Created at: 2026-03-17
- Iteration ID: 0189-feishu-spec-gap-analysis
- Source Feishu main doc:
  - `https://bob3y2gxxp.feishu.cn/wiki/JYNWwQOOjiWcOLktv07cBvIVnOh`
