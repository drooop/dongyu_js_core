---
title: "0356 PIN Connection Contract Realignment Plan"
doc_type: iteration_plan
status: completed
updated: 2026-05-06
source: ai
iteration: 0356-pin-connection-contract-realignment
---

# Iteration 0356 PIN Connection Contract Realignment Plan

## Goal

冻结新的模型引脚连接目标合同，并把当前高优先级规约里与该合同冲突的内容收口。

本轮依据用户提供的模型引脚文本执行，核心变化是：

- 去掉 `pin.connect.model`，跨模型连接改为 `model.submt` hosting Cell 边界 + 子模型 root `(0,0,0)` 边界 + 所在模型内 `pin.connect.cell`。
- `pin.connect.label` 只描述同一个 Cell 内的端点连接，端点直接写引脚名，不再写 `(self, ...)` / `(func, ...)` / numeric prefix。
- 函数引脚固定为 `{functionName}:in` / `{functionName}:out` / `{functionName}:logout`。
- 日志引脚目标命名为 `pin.login` / `pin.logout`。
- 引脚上传递的数据仍是 ModelTable-like record array，是否持久化由显式 materialization 决定。

## Scope

In scope:

- 新增 0356 目标合同 SSOT。
- 更新 `CLAUDE.md`、label registry、runtime semantics、architecture SSOT、host ctx、UI pin routing、imported slide app ingress 规约等活跃文档。
- 更新直接面向开发者的用户指南和示例，让新示例不再出现旧端点写法。
- 输出冲突清单，列明 runtime / tests / system-models / deploy patches 中的旧写法。

Out of scope:

- 不修改 runtime parser / dispatcher。
- 不修改 system model JSON、deploy patches 或 tests。
- 不声称当前本地/远端运行面已经支持新合同。
- 不做浏览器测试；本轮是 docs-only 规约收口。

## Invariants / Constraints

- `CLAUDE.md` 是最高优先级本地规约。
- 0356 是 docs-only 规约冻结，不得混入未验证 runtime 行为变更。
- 历史 iteration / historical plans 保留历史事实，不批量重写。
- 新文档必须明确区分 target contract 与 current implementation debt。
- 后续实现不得靠兼容层继续保留旧写法，除非用户显式批准。

## Success Criteria

- 存在独立 SSOT：`docs/ssot/pin_connection_contract_v2.md`。
- 活跃高优先级文档不再把 `pin.connect.model`、`pin.log.*`、`(self, ...)` / `(func, ...)` 当作新规约输入面。
- 用户指南中的最小 slide app 示例使用直接端点名。
- 冲突清单列出 runtime、测试、模型资产、部署补丁中的迁移范围。
- 本地检查：
  - `git diff --check` PASS
  - 高优先级 docs grep 只允许 legacy / removed / migration-debt 语境下出现旧字样

## Inputs

- Created at: 2026-05-06
- Iteration ID: 0356-pin-connection-contract-realignment
- User-provided source text: 本轮对话中的“模型引脚”规约段落。
