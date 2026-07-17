---
title: "Tier Boundary And Conformance Testing"
doc_type: ssot
status: active
updated: 2026-07-16
source: ai
---

# Tier Boundary And Conformance Testing

## Positioning

- Authority: below `CLAUDE.md`, architecture SSOT, runtime semantics, and label registry.
- Scope: all feature implementation, testing, and review work that might cross Tier 1 / Tier 2 boundaries.
- Rule type: conformance review decision rules and hard stop conditions.
- Conflict behavior: if this file conflicts with higher SSOT, higher SSOT wins; if an implementation passes functionally but fails this conformance gate, it is not deliverable.

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
- mailbox 事件入口到合法 pin ingress 的解释与传播
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
- 让 server 层长期持有独立于 runtime 的正式事件分发语义
- 让 imported slide app ZIP 提供或覆盖 `route.reply_to`
- 让 MBR 依赖每个 uploaded app 的 per-app 静态 route 才能转发

### 4.4 Approved Temporary Exceptions

0368 后当前没有已批准的 host-glue 总线出口例外。

如果后续确实需要临时例外，必须先新建 iteration、冻结退出条件，并在 runlog 中写明为什么不能使用当前 split bus pins。不得把 direct transport helper、旧管理总线标签或 raw JSON fallback 作为临时兼容入口。

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
- 该动作是否真的通过父侧 connection Cell 逐层 relay 到 Model 0？
- 是否存在“深层子模型直接跳到 Model 0”或“默认所有事件都进入外发候选池”的旁路？

颜色生成器类场景的最小 gate：
- 输入框变更后，Model 0 外发口不得出现新事件
- 切页 / 选中应用后，Model 0 外发口不得出现新事件
- 点击 `submit` 后，Model 0 外发口必须出现且只出现一次对应事件
- 断开任一级 relay 后，`submit` 必须止于本地，不得继续离开 runtime

### 5.4 Feishu v2 Actor / Local Acceptance（0457）

Tier 与 placement gate：

- generic `pin_payload.v2` parse、PIN transport、split-bus 传播与 response materialization 属于 Tier 1；不得含 Feishu resource/data/UI/task business special case。
- R1 Model 3200 的 schema、resource/data/UI/task handler 与 generic `result` response contract 属于 Tier 2 正数业务模型。
- endpoint whitelist/dispatcher 与 MBR bridge 属于负数系统模型；不得把业务状态移回 Model 0、Model -10 或 server helper。

Actor evidence gate：

- 必须加载并执行 authoritative fill-table role assets 后检查 actor state；只 grep 文件名、label 名或代码字符串不算证据。
- MBR、R1、WM1 的 Model 0 必须是 `model.v1n`，`sys_worker_id` / `sys_worker_role`、合法 split-bus pins、Model -10 route/mount 与 asset provenance 必须精确匹配 SSOT。
- 任意 bootstrap patch 后必须重新 attestation；不得通过额外 bootstrap operation 临时注入被测 actor truth 形成 false green。
- control response 必须由 R1 通过本地 MQTT 直达 UI Server，MBR 不得 republish/echo；management response 必须且只能经 MBR 一次。

Local environment gate：

- Docker 与 Kubernetes context 都必须是 `orbstack`，namespace 必须是 `dongyu`；Synapse 与 Mosquitto 必须部署在该本地环境。
- local-only test infrastructure 不等于 air-gapped。经 repo governance 识别的 Feishu `UpstreamConsensus` 可通过 exact `https://open.feishu.cn:443` 做 read-only evidence；这不允许 Feishu write。
- acceptance window 必须拒绝 remote Matrix、MQTT、OIDC/SSO endpoint，网络证据缺失、过期、格式错误或读取失败都必须 fail closed。

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
