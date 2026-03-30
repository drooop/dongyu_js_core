---
title: "Tier Boundary And Conformance Testing"
doc_type: ssot
status: active
updated: 2026-03-21
source: ai
---

# Tier Boundary And Conformance Testing

## 0. Quick Gate

测试或审查任一功能时，先回答 5 个问题：

1. 这是 Tier 1 还是 Tier 2？
2. 如果不是用户直接要看到的能力，它是不是放在了负数系统模型？
3. 数据真值归谁所有？
4. 数据流向是否清晰且单向可解释？
5. 数据链路有没有跳层、绕过、旁路？

如果任一问题答不出来，不要继续说“功能已完成”。

## 1. Guided Disclosure

如果你现在在做：

- **Tier 判定**
  - 读本文件 §2
  - 再回到 `CLAUDE.md` 的 `CAPABILITY_TIERS`

- **模型放置判定**
  - 读本文件 §3
  - 再回到 `docs/ssot/runtime_semantics_modeltable_driven.md` 的 `System Negative Models`

- **所有权 / 数据流 / 数据链路审查**
  - 读本文件 §4
  - 再回到：
    - `docs/ssot/runtime_semantics_modeltable_driven.md`
    - `docs/ssot/host_ctx_api.md`
    - `docs/ssot/label_type_registry.md`

- **测试设计**
  - 读本文件 §5

- **runlog 记录**
  - 读本文件 §6
  - 再回到 `docs/WORKFLOW.md`

## 2. Tier 1 / Tier 2 判定

### 2.1 Tier 1

属于 Tier 1 的只有：

- 新的运行时解释语义
- 新的 `label.t` 解释
- 模型形态约束
- runtime/host 边界与解释器 bugfix

### 2.2 Tier 2

属于 Tier 2 的包括：

- 业务逻辑
- 平台辅助逻辑
- policy / guard / filter / helper worker
- routing topology
- intent / mgmt / bridge / flow manager

只要它可以通过模型定义表达，它就不该升级成 Tier 1。

## 3. 负数模型 / 正数模型放置

### 3.1 负数系统模型默认承载

以下能力默认应放在负数系统模型：

- 用户不应直接看到的 helper
- 平台策略 / 约束 / 守卫 / 过滤
- 平台侧 routing / bridge / observer
- system-owned context / audit / lifecycle state

### 3.2 正数模型默认承载

正数模型默认承载：

- 用户业务本身
- 用户显式可见、可理解、可操控的业务结构

不要为了少改基座，把隐藏平台辅助逻辑直接塞进用户会打开的正数模型。

## 4. Conformance Review

每次测试除“能跑通”外，还必须检查：

### 4.1 Data Ownership

- 这个数据归谁所有：用户业务、系统平台、还是临时派生态？
- owner 是否落在正确模型域里？

### 4.2 Data Flow

- 数据从哪里来？
- 经过哪些层？
- 最终落到哪里？

### 4.3 Data Chain

检查是否遵守允许的链路，不允许：

- 跳过 Model 0 / mailbox / routing table
- 从 UI 直接写业务真值
- 从外部直接写任意 cell
- 用 Tier 1 代码偷实现 Tier 2 能力

### 4.4 Approved Temporary Exceptions

以下例外只有在 iteration runlog 中被显式记录时才允许存在：

- `MGMT_OUT` 作为临时 host-glue 出口  
  当前仅允许作为 Matrix 发送能力尚未进入 runtime `func.js ctx` 时的过渡出口。
  使用条件：
  - 必须在 runlog 中写明为何当前无法继续下沉到 Tier 2 纯 patch 路径
  - 必须写明后续迁移条件，例如 runtime 提供 `ctx.sendMatrix`
  - 若已有规约路径可用，必须优先走规约路径，不得以“graceful degradation”名义长期保留

## 5. Test Design

每个功能至少应有 2 类测试：

### 5.1 Functional

- 证明功能能跑通

### 5.2 Conformance

- 证明它没有越 Tier
- 证明它没有放错模型域
- 证明它没有打破所有权
- 证明它没有引入错误的数据流向
- 证明它没有走非法数据链路

### 5.3 Local-First / Egress Authority

对带 UI 交互的模型，至少补以下审查：

- 哪些动作应当仅本地处理？
- 哪些动作允许外发？
- 外发 authority 是否只来自现有 pin 接线路径，而不是新的字段或宿主特判？
- 该动作是否真的通过父模型 hosting cell 逐层 relay 到 Model 0？
- 是否存在“深层子模型直接跳到 Model 0”或“默认所有事件都进入外发候选池”的旁路？

颜色生成器类场景的最小 gate：
- 输入框变更后，Model 0 外发口不得出现新事件
- 切页 / 选中应用后，Model 0 外发口不得出现新事件
- 点击 `submit` 后，Model 0 外发口必须出现且只出现一次对应事件
- 断开任一级 relay 后，`submit` 必须止于本地，不得继续离开 runtime

## 6. Evidence Recording

在 iteration runlog 中至少记录：

- 功能验证命令
- 边界验证命令
- 关键 PASS / FAIL 输出
- 若发现旁路或不规范可能，明确写成 finding，不留在聊天里

## 7. Outcome Rule

若功能能跑通，但 Tier / placement / ownership / flow / chain 任一不合规：

- 不能直接称为 Completed
- 至少应记录为 finding / risk / follow-up
- 必须明确是否接受为临时状态
