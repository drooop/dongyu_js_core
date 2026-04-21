---
title: "0310 — slide-frontend-pin-addressing-freeze Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0310-slide-frontend-pin-addressing-freeze
id: 0310-slide-frontend-pin-addressing-freeze
phase: phase1
---

# 0310 — slide-frontend-pin-addressing-freeze Plan

## Goal

- 冻结前端 pin 直寻址协议，让前端不再以 `action` 作为正式业务语义。
- 冻结投影协议的扩展方式，使前端能从投影节点直接知道“这个节点可写哪个 pin”。
- 冻结系统动作按钮的 cell 化原则，为 `0311` 的页面 pin 化实现提供明确边界。

## Scope

- In scope:
  - 冻结新的前端事件 envelope
  - 冻结投影节点如何携带 pin 入口信息
  - 审计当前内置页面里系统动作按钮是否已有独立 cell
  - 定义 `0311` 的实施边界与验收前提
- Out of scope:
  - 不修改运行时代码
  - 不修改前端 renderer/store
  - 不开放执行型导入
  - 不编写最终同事 Matrix 投递文档

## Invariants / Constraints

- `action` 可以保留在兼容层，但不再作为新的正式业务协议字段。
- `action` 的兼容层退役窗口固定为 `0308`：
  - `0310/0311/0307` 阶段允许兼容读取
  - `0308` 负责清理正式路径中的 `action`
  - `0308` 之后，`action` 不得再出现在任何正式业务事件协议中
- 正式协议必须与模型表内部 pin 语义一致：
  - 前端只描述“把值写到哪个 cell 的哪个 pin”
  - server 只做 transport / mailbox / snapshot，不做长期业务路由决策
- 若某个按钮没有对应 cell，则该按钮在 `0311` 前不得声称自己已满足 pin 直寻址协议。

## Envelope Freeze

正式目标方向：

- 必填：
  - `meta.op_id`
  - `target.model_id`
  - `target.p`
  - `target.r`
  - `target.c`
  - `pin`
- 选填：
  - `value`
  - `meta.client_ts`
  - `meta.local_only`

明确约束：

- `pin` 是正式目标语义，不再要求 `action`
- `target` 表示“哪个 cell”
- `pin` 表示“这个 cell 上哪个可写入口”
- `value` 只承载 pin 输入值，不承载额外路由决策

## Projection Freeze

`0310` 必须冻结投影协议如何把 pin 信息交给前端。

至少要冻结：

- AST 节点如何携带可写 pin 信息：
  - `writable_pins`
  - 或一个等价、同样明确的字段
- 前端如何从投影节点得到：
  - 当前节点所属 `cell_ref`
  - 当前节点允许写入的 `pin` 名
- 按钮、输入、选择类控件的推荐映射方式

并且必须明确：

- 字段名
- 值类型
- 是否支持多个 pin
- 是否区分 pin 方向

## Audit Requirement

在进入 `0311` 前，必须先完成一次现状审计：

- 哪些内置按钮已经有独立 cell
- 哪些内置按钮还没有独立 cell
- 哪些控件已经天然可 pin 化
- 哪些控件需要先补 page_asset cell 才能 pin 化

审计对象至少包括：

- `Model 100 submit`
- `slide_app_import`
- `slide_app_create`
- `ws_app_add`
- `ws_app_delete`
- `ws_select_app`
- `ws_app_select`

## Success Criteria

1. 新的前端 envelope 形状被明确冻结，`pin` 成为正式目标语义。
2. 投影节点如何携带 pin 入口信息被明确冻结。
3. 系统动作按钮的 cell 化原则被明确冻结。
4. 内置页面按钮的现状审计结果被记录，可直接作为 `0311` 输入。
5. `0311` 的范围、风险和前置依赖被重新校正。

## Open Questions

### 1. `action` 的兼容层保留多久

- 当前裁决：
  - `0310` 只冻结正式方向，不立即删除兼容字段
  - 兼容层的退役固定放到 `0308`

### 2. `pin` 是否进入 `target`

- 当前裁决：
  - 不把 `pin` 放进 `target`
  - 保持：
    - `target = cell`
    - `pin = port`
- 这需要在 SSOT 正文里冻结，而不只是保留在本计划里

### 3. 系统按钮是否必须全部 page_asset 化

- 当前建议：
  - `0310` 先审计事实
  - 若某些按钮目前不是 page_asset cell，`0311` 需要先补 cell，再做 pin 化

## Inputs

- Created at: 2026-04-09
- Iteration ID: `0310-slide-frontend-pin-addressing-freeze`
