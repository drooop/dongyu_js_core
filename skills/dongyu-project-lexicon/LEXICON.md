# Project Lexicon (dongyuapp_elysia_based)

本文件用于沉淀本仓库的稳定术语。新增/修改术语必须补充：定义、边界、不可变约束（如有）。

优先级提示：如本文件内容与 `docs/architecture_mantanet_and_workers.md` 冲突，以后者为准。

## Core Terms

### SSOT (Single Source of Truth)
- 定义：仓库中对某类事实拥有最高优先级的文档/来源。
- 本仓库 SSOT：`docs/architecture_mantanet_and_workers.md`。

### Charter
- 定义：在 SSOT 之下、Iteration 计划/实现之上的阶段性约束与执行条款。
- 位置：`docs/charters/*.md`。

### Behavior Oracle / PICtest
- 定义：行为真值源（可观测行为对照），用于校验 built-in k / triggers / PIN 行为。
- 不变量：行为对齐优先 PICtest，除非违反 SSOT 或 Charter。

### Iteration (plan/resolution/runlog)
- 定义：按 `docs/WORKFLOW.md` 执行的工作包，目录为 `docs/iterations/<id>/`。
- 文件职责：
  - `plan.md`：合同（WHAT/WHY）
  - `resolution.md`：施工方案（HOW）
  - `runlog.md`：飞行记录仪（FACTS）

### ModelTable / Cell
- 定义：ModelTable 由 Cell 组成；Cell 字段固定为 `p/r/c/k/t/v`。
- 不变量：ModelTable 是显示与状态的唯一真值源；UI/渲染层不得绕开 ModelTable 持有真值态。

### Built-in k
- 定义：程序模型触发/副作用由内建 `k` 关键字驱动（例如 `k:"value"`, `k:"pin_in"`, `k:"pin_out"`）。
- 不变量：内建 `k` 语义必须先从 PICtest 提取证据表，再实现。

### PIN_IN / PIN_OUT
- 定义：控制总线针脚对应明确的 Cell 类型（`k:"pin_in"` / `k:"pin_out"`）。
- 不变量：第一阶段仅围绕控制总线语义实现（本地 docker MQTT pub/sub + PIN_IN/OUT 闭环）。

### Sliding UI / UI AST
- 定义：UI 模型解释为 AST，再由 renderer 渲染。
- 不变量：UI 事件必须归一为“写格子”（写某个 Cell 的 value/event mailbox）；UI 不得直接发总线消息。

### Control Bus / Management Bus / Workspace
- 定义：控制总线（MQTT）、管理总线（Matrix）、工作区隔离边界等概念以 SSOT 为准。
- 不变量：第一阶段只做控制总线（MQTT），双总线在后续迭代引入。

## Open / Unclear Semantics

- 在此记录发现的术语歧义与待证据确认点；禁止“拍脑袋”统一语义。
