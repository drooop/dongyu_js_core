---
title: "PIN-only Core With Scoped Privilege Design"
doc_type: note
status: active
updated: 2026-03-26
source: ai
---

# PIN-only Core With Scoped Privilege Design

## Goal

为当前 ModelTable / pin / submodel 体系定义一套更稳定的权限与数据链路规则，回答以下问题：

- `PIN-only` 是否仍然是最核心的默认方式
- 同模型内部的 `table / matrix -> cell` 操作是否需要唯一链路
- `model.submt` 边界是否允许被父级 direct access 穿透
- `table`、`matrix`、`cell` 的权限范围应该如何划分

本稿是设计讨论稿，不是 SSOT。

## Problem Statement

当前讨论的冲突点是：

1. 如果坚持“所有操作都只能走 pin”，那么同一 `Model.table` 内部想管理自己的 cell，就必须显式拉大量 `pin.connect.*`，导致：
   - wiring 冗长
   - patch 体积增大
   - 使用不便

2. 如果反过来允许上层任意 direct access 下层，那么：
   - `pin` 的核心地位会被削弱
   - `submodel` / child boundary 的意义会被打穿
   - 跨模型 ownership 和审计边界会变得模糊

因此需要的是：

- 保住 `PIN-only` 作为默认核心范式
- 同时给同模型内部管理一个受控例外

## Non-Negotiable Constraints

以下边界在本讨论中固定：

1. `PIN-only` 仍然是默认、核心方式
2. 跨 `model_id` 一律不能 direct access
3. 跨 `model.submt` 一律不能 direct access
4. 父模型操作 child model 仍然必须走 `pin`
5. 例外特权只可能发生在同一 `model_id` 内
6. 特权不是自动发给所有 cell，只发给 privileged cell
7. `root (0,0,0)` 自动拥有 privileged capability label
8. 非 root cell 若要获得该能力，必须显式声明 privileged capability

## Candidate Approaches

### Option A — Pure PIN-only

所有读写都必须走 `pin.* / pin.connect.*`。

优点：
- 规则最单纯
- 数据链路唯一
- 权限和审计推理最容易

缺点：
- 同模型内 wiring 成本过高
- `table -> matrix -> cell` 的管理动作被迫建模成运输问题
- patch 体积和维护成本明显增加

结论：
- 不推荐作为最终方案

### Option B — Direct Access Priority

默认允许上层 direct access 下层，`pin` 只用于少数跨边界场景。

优点：
- 使用最方便
- 同模型管理动作表达最短

缺点：
- 会削弱 `PIN-only` 的核心地位
- 很容易进一步滑向“既然都能直达，为什么还要 pin”
- 边界、审计、ownership 会持续被侵蚀

结论：
- 不推荐

### Option C — Recommended: PIN-only Core + Scoped Privilege Exception

默认仍然是 `PIN-only`；只在**同一模型内部**给 privileged cell 一个 direct access 例外。

优点：
- 保住 `pin` 作为核心默认方式
- 同模型内部减少大量冗余 wiring
- `submodel` / cross-model boundary 继续稳定

缺点：
- 规则比纯 `PIN-only` 多一层
- 需要额外定义 privileged capability 的来源和作用域

结论：
- 推荐

## Recommended Model

### 1. Default Rule

默认规则仍然是：

- `PIN-only`

任何 cell 如果没有 privileged capability，就不能以 direct access 方式跨 cell 操作，只能：

- 读写自己
- 或通过 `pin` 连接到目标

### 2. Privileged Capability

定义一种显式的 privileged capability。

建议设计要求：

- `root (0,0,0)` 自动拥有该 capability label
- 非 root cell 必须显式声明后才拥有
- 普通 `model.single` cell 默认不拥有

本稿先不冻结 label 名称，只冻结语义。

### 3. Same-Model Scoped Privilege

privileged cell 的 direct access 权限只限同一 `model_id` 内。

#### 3.1 `Model.table`

若一个 privileged cell 属于 `Model.table`：

- 可 direct read/write 本 `model_id` 下所有普通 cell
- 可 direct read/write 本 `model_id` 下嵌套 `Model.matrix` 的内部 cell

也就是说：

- `table root -> table internal cell`：允许
- `table root -> nested matrix internal cell`：允许

#### 3.2 `Model.matrix`

若一个 privileged cell 属于 `Model.matrix`：

- 可 direct read/write 该矩阵作用域内的 cell
- 不自动获得其他同模型兄弟区域的权限

### 4. Hard Boundaries

以下边界一旦跨越，立即回到 `PIN-only`：

- 跨 `model_id`
- 跨 `model.submt`
- 父模型到 child model
- child model 到 parent model
- system/user boundary
- external ingress/egress

所以：

- `same-model internal management` 可以是 privileged direct access
- `cross-model communication` 仍然必须是 pin

## Why This Is Self-Consistent

关键不是“有没有 direct access”，而是：

- `pin` 仍然是 canonical default path
- direct access 只是同模型内部的受控 shortcut

这意味着：

- `pin` 的核心地位保住了
- 但不会为了同模型管理动作把整个 patch 变成 wiring 噩梦

## Sanity Check

### Home CRUD

| 操作 | 源 | 目标 | 同 model_id? | 路径 |
|---|---|---|---|---|
| Home UI 改 filter/selected | `Model -22 Cell` | `Model -22 / Model -2 related UI-local state` | 是（same local surface scope） | scoped privilege / direct local management |
| Home UI 写正数模型 label | `Model -22 Cell` | `Model 100 Cell` | 否 | PIN-only |
| Table root 管理自己的 Cell | `Model 100 (0,0,0)` | `Model 100 (1,0,0)` | 是 | scoped privilege |
| Table root 写 child model | `Model 100 (0,0,0)` | `Model 200 via submt` | 否 | PIN-only |

这说明：

- Home CRUD 写正数业务模型，仍然必须走 `pin`
- same-model privilege 只减少内部 wiring
- 两者并不冲突

### Nested Matrix

若 `Model.table T` 下包含若干内部 `Model.matrix A/B/C/D`：

- `T` 的 privileged root 可以 direct access `A/B/C/D` 内部 cell
- 这是 same-model privilege
- 但如果 `A/B/C/D` 里又通过 `model.submt` 挂了 child model：
  - `T` 仍然不能直穿 child
  - 必须回到 `PIN-only`

## Design Consequences

### 1. PIN Stays Core

`pin` 继续负责：

- cross-model communication
- parent/child communication
- system boundary
- bus / MQTT / Matrix
- 需要显式 contract 和审计的链路

### 2. Privilege Stays Local

scoped privilege 只负责：

- same-model internal management

它不是第二套主数据链路。

### 3. `model.submt` Boundary Stays Valuable

因为父级仍然不能 direct access child model，所以：

- `model.submt`
- child boundary
- pin routing

都继续有清晰价值。

## Open Questions

后续实现前仍需补定的点：

1. privileged capability 的正式 label 名
2. `table` 与 `matrix` 的作用域判定如何在 runtime 中表达
3. 同模型 privileged direct access 是否需要额外审计标签/trace
4. 是否允许同模型内部“读直达 / 写仍 pin-only”的更细粒度变体

## Recommendation

建议后续正式规范与实现都基于 Option C：

- `PIN-only` 为核心
- same-model scoped privilege 为受控例外
- cross-model / cross-submt 一律 `PIN-only`

这是当前最稳、也最符合现有架构方向的选择。
