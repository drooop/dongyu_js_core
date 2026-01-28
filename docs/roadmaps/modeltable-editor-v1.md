# Roadmap: ModelTable Editor v1 (Sliding UI / UI Model)

SSOT: `docs/architecture_mantanet_and_workers.md`
Charter: `docs/charters/dongyu_app_next_runtime.md`

## Goal

在 Stage 3.x（无双总线/无远端执行）的边界内，用 UI 模型（UI AST + renderer）交付一个“相对完整、可脚本验收”的 ModelTable 编辑界面：

- UI 仅作为投影与事件入口（写 event mailbox）
- 真值更新由事件消费者（本地 LocalBusAdapter）解释并写回 ModelTableRuntime
- 所有可见状态与交互结果来自 ModelTable snapshot

## Non-Negotiable Constraints

- UI 不得直接发总线消息（MQTT/Matrix）；不得绕过 ModelTable 改真值
- 不引入 Matrix/MBR/双总线（Stage 4+）
- Mailbox contract 不变：参考 `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`

## Iterations (Linear)

### 0130-modeltable-editor-v1 (IMPL)

Primary domain: sliding-ui / UI AST

- Goal: 用 UI 模型方式完成“可用的编辑器 v1”，覆盖：模型选择、Cell/Label CRUD、类型选择、错误可视化、事件日志与快照。
- Dependencies: `0129-modeltable-editor-v0` (mailbox contract + demo wiring baseline)
- Non-goals: 双总线/远端工人、持久化回写 sqlite、权限系统、协作编辑。

### 0131-modeltable-editor-v1-hardening (IMPL)

Primary domain: sliding-ui / UI AST

- Goal: 编辑器可用性/一致性加固：键盘编辑/批量操作、性能（大表格渲染策略）、更强的错误/校验提示、回归用例扩展。
- Dependencies: `0130-modeltable-editor-v1`
- Non-goals: Stage 4+ 传输层、真实远端执行。

### Stage 4+ (Deferred)

Primary domain: bus (Matrix / MBR / MQTT)

- 将 LocalBusAdapter 从“本地消费者”替换为“经 MBR/双总线转发到远端 Software Worker 的消费者”。
- 注意：这是后续迭代，必须遵守 Charter 6.2；不在本 roadmap 的当前执行范围内。
