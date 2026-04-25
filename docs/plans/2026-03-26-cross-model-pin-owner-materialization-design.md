---
title: "Cross-Model PIN Owner Materialization Design"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Cross-Model PIN Owner Materialization Design

## Goal

定义当 `0245` 已禁止 cross-model direct access 后，跨模型写入应如何继续成立。

目标不是恢复 direct write，而是冻结一条新的 canonical path：

- source handler 只发出 write intent
- write intent 通过 `func:out -> pin.connect.model -> target pin.*.in` 路由
- target model 作为 owner 自己执行最终 materialization

## Problem Statement

`0246` 已证明：

1. Home CRUD 的 pin path 可以到达 `Model -10`
2. 旧 handler 仍试图直接写：
   - `Model -2`
   - positive business model
3. `0245` scoped privilege rules 会正确拒绝这种行为：
   - `direct_access_cross_model_forbidden`

因此当前缺的不是：

- pin route
- handler trigger

而是：

- 当 source model 与 target model 不同，如何通过 pin 把“写入请求”发给 target owner

## Non-Negotiable Constraints

1. 默认范式仍然是 `PIN-only`
2. cross-model direct access 仍然禁止
3. cross-`model.submt` direct access 仍然禁止
4. source handler 不能以 privileged shortcut 绕过 target ownership
5. 最终 `addLabel / rmLabel` 必须由 target model owner path 自己执行
6. UI/Home/Prompt 等业务迁移不能重新引入 mailbox 风格的跨模型直写

## Recommended Model

### 1. Core Rule

当 source model 想影响其他 `model_id` 的状态时：

- source 只负责生成 typed write request
- source 不直接执行目标模型写入
- target model 必须接收 request 并自行 materialize

### 2. Canonical Data Flow

```text
source func:out
  -> pin.connect.model
  -> target model pin.model.in / pin.table.in / pin.single.in
  -> target root / privileged owner cell
  -> target-owned materialization
  -> addLabel / rmLabel on target model
```

### 3. Ownership Rule

- source model 拥有“表达意图”的权限
- target model 拥有“落地状态”的权限
- source model 不拥有 target labels 的 direct mutation 权

## Contract Elements To Freeze

### A. Write Request Shape

cross-model pin request 应是 typed envelope，而不是 source handler 直接把 `k/t/v` 写进 target。

最小字段集合：

- `op`
  - `add_label`
  - `rm_label`
- `target_model_id`
- `target_cell`
  - `{ p, r, c }`
- `label`
  - `{ k, t, v }` for `add_label`
  - `{ k }` for `rm_label`
- `origin`
  - source `model_id`
  - source cell
  - optional action/op name
- `request_id`
- `ts`

本稿冻结字段语义，不冻结最终 label key 名。

### B. Source Side

source func/handler 的职责：

1. 验证本地输入是否完整
2. 组装 typed request
3. 从 `func:out` 发出 request
4. 不执行 target write

source side 允许：

- same-model local state 更新
- request emission

source side 不允许：

- `ctx.writeLabel(targetModelId != selfModelId, ...)`
- `ctx.rmLabel(targetModelId != selfModelId, ...)`

### C. Routing Layer

route 必须通过显式 `pin.connect.model` 建立。

要求：

1. route 显式声明 source output pin 与 target input pin 的对应关系
2. route 本身不做业务写入
3. route 只负责把 envelope 送达 target owner boundary

### D. Target Side

target model 必须拥有正式的 input pin：

- `pin.model.in`
- 或更具体的 `pin.table.in` / `pin.single.in`

target side 的职责：

1. 接收 request
2. 校验 request 是否属于本 owner scope
3. 做最终 materialization：
   - `addLabel`
   - `rmLabel`
4. 将结果写回本模型自己的 status/error/trace 面

### E. Failure Model

失败不能回退成 silent no-op。

至少需要冻结这些 failure kinds：

- invalid_request_shape
- target_owner_missing
- target_scope_rejected
- unsupported_op
- target_materialization_failed

失败记录应发生在 target owner path，而不是 source 假装成功。

## Sanity Checks

### Home CRUD

| 操作 | Source | Target | 路径 |
|---|---|---|---|
| Home filter/select | Home/UI-local model | same Home/UI-local model | same-model direct / local path |
| Home create/edit/delete positive label | Home control model | positive model | `func:out -> pin.connect.model -> target owner materialize` |
| Home status text update | target owner or dedicated response model | Home/UI-local | separate explicit route, not cross-model direct write |

关键结论：

- Home CRUD 迁到 pin 后，`Model -10` 不应直接写正数模型
- 也不应直接写 `Model -2`
- UI feedback 也必须通过 formal response path 回来

### Parent / Child via `model.submt`

即便 parent 拥有 same-model scoped privilege：

- 也不能直写 child model
- parent -> child 仍然必须 pin-only

因此 cross-model owner materialization 不会破坏 `submt` boundary。

## Why This Is Needed

`0245` 之后，系统已经明确区分：

- same-model privileged direct access
- cross-model pin-only communication

但当前还缺第二段：

- communication 到达 target 之后，谁来合法落状态

本设计补的正是这段 owner materialization contract。

## Downstream Implementation Surface

未来实现至少会涉及：

1. Runtime
- `func:out` envelope typing / routing support
- target pin input receive path
- owner materialization helper contract

2. Model patches
- source handler patches
- target owner receive/materialize patches
- `pin.connect.model` declarations

3. Tests
- source cannot cross-model direct write
- source can emit request envelope
- request reaches target input pin
- target owner applies `addLabel / rmLabel`
- target-side rejection surfaces are deterministic

## Recommendation

后续正式 contract 和 implementation 应基于以下原则：

- cross-model communication: `PIN-only`
- cross-model state mutation: owner materialization only
- source emits intent
- target owns mutation

一句话：

- `cross-model write` 不应该存在；
- 应该存在的是 `cross-model write request + target-owned materialization`。
