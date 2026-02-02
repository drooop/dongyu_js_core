# “数据双向绑定效果”是怎么来的：现状、边界与通往真实滑动 UI 的路


## 0. 我们这里的“双向绑定”不是 Vue 的 v-model

你在页面上看到的“输入框改了 → 页面也跟着变”，确实像双向绑定。

但这个效果不是 UI 直接改业务真值，也不是 UI 直接发总线消息。

我们这个系统的核心口径是：

- ModelTable 是唯一真值；UI 只是投影。
- UI 的所有交互都要归一成“写格子”（写某个 Cell 的 label）。
- 任何副作用必须由 ModelTable 的结构性变化触发（`add_label`/`rm_label`）。

参考（概念与硬边界）：
- `docs/architecture_mantanet_and_workers.md`
- `docs/charters/dongyu_app_next_runtime.md`
- `docs/ssot/runtime_semantics_modeltable_driven.md`

## 1. “看起来像双向绑定”的真实机制

一句话：

> UI 从 `snapshot` 投影出显示；UI 交互写入 `event mailbox`；消费者消费后更新 ModelTable 真值；新的 `snapshot` 再投影回 UI。

所以“像双向绑定”的关键不是 UI 持有状态，而是“投影 → 事件 → 真值变化 → 再投影”的闭环。

## 2. 机制拆开讲：读、写、再读

### 2.1 读：UI 从 snapshot 投影出组件显示

UI AST 节点会带 `bind.read`（LabelRef），renderer 会从 `snapshot` 里取对应 label 的值，喂给组件的显示值。

UI AST 规范：
- `docs/iterations/0123-ui-ast-spec/spec.md`

renderer 验收（jsdom 下验证 render + event_write）：
- `docs/iterations/0123-ui-renderer-impl/runlog.md`

### 2.2 写：UI 不改业务态，只写 event mailbox

UI 的输入/点击不会直接写业务 label，而是写一个“事件信封”到 event mailbox。

Mailbox contract（位置、单槽、op_id、错误优先级、哪些 action 合法）：
- `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`

对外怎么解释最简单：
- UI 只负责把用户动作写成一个标准化事件（含 `op_id`），放进邮箱。
- 写进邮箱之后，UI 等“消费者”处理完再看结果。

### 2.3 再读：消费者更新真值后，UI 重新投影

消费者（LocalBusAdapter / server consumer / 未来的总线侧 consumer）把 event mailbox 里的事件消费掉，调用 runtime 的 `add_label/rm_label` 去更新 ModelTable。

更新后产生新的 snapshot，UI 下一轮渲染自然显示新值。

这就是为什么：你输入后如果事件被拒绝（比如 missing_model / forbidden_k），你会看到输入又被“弹回原值”。
因为真值没变，投影必须回到真值。

## 3. 当前实现状态到底到哪了？（三层）

### 3.1 Local（本地自滑：同进程 runtime + 本地消费者）

这是最直观的形态：前端本地有 runtime，事件也在本地消费。
它的价值是：把 UI AST + mailbox contract + runtime mutator 的闭环跑通，并且能用脚本验收。

证据：
- `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`
- `docs/iterations/0130-modeltable-editor-v1/handoff.md`

### 3.2 Remote（server-truth：后端持有真值，前端纯 renderer）

这个形态是：
- 真值在后端 runtime
- 前端拉/订阅 snapshot（例如 HTTP `/snapshot` + SSE `/stream`）
- 前端把 mailbox envelope POST 给后端
- 后端消费事件、更新真值，再把新 snapshot 推回前端

对外说法可以是：“从本地自滑，演进到 server-truth（前端只负责渲染与事件提交）”。

证据：
- `docs/iterations/0131-server-connected-editor-sse/handoff.md`

### 3.3 Dual-bus（Stage 4：MgmtBus ↔ MBR ↔ ControlBus 的 v0 contract + harness）

这里最容易被误解，所以要把话说得非常清楚：

- 0132 做到的是：定义并验证一条“最小可判定链路”的 contract/harness。
- 它证明了“MgmtBus/MBR/MQTT/PIN”在 v0 口径下可以脚本化跑通。
- 但它不等于“前端已经真实接入 MgmtBus 订阅投影更新”。

关键口径：
- UI 只写 event mailbox；UI 不得直连 Matrix/MQTT。
- `op_id` 是跨总线因果主键，MBR 必须去重/防重放。
- Matrix 只是 ManagementBusAdapter 的一种 concrete 实现，不是“管理总线本体”。

证据/合同/验收：
- `docs/iterations/0132-dual-bus-contract-harness-v0/contract_dual_bus_v0.md`
- `docs/iterations/0132-dual-bus-contract-harness-v0/runlog.md`

## 4. 真实“滑动 UI”形态下：远端程序模型改值 → 双总线更新 → 前端 text 变，会经历什么？

你可以把它理解成：

> 前端只负责把“人类交互”写成 mailbox event；真正的状态演进在远端 worker；worker 的状态变化再通过双总线回到前端投影。

用一个最小故事描述（以 text 更新为例）：

1) 远端 worker 的程序模型决定要更新某个 text 对应的 label（这一步仍然必须落到 `add_label/rm_label`）。
2) worker 把“投影所需的变化”（可映射为 patch / delta）发到 Management Bus（Matrix 只是 adapter）。
3) MBR 作为桥接层，把消息做 op_id 级别的幂等与策略处理。
4) 前端订阅 Management Bus 的投影更新，把 delta 应用到本地 snapshot 缓存，触发 UI 重渲染，于是 text 变了。

注意：这条链路里，UI 依然不触碰“业务真值”，它只是在更新“投影缓存”。

## 5. 现在能做到这条链路吗？还差哪些工作？

结论：
- “控制总线（MQTT/PIN）闭环”和“Stage 4 contract/harness”已经有可脚本验证的基础。
- 但“前端作为 MgmtBus subscriber 接入投影更新通道”还没有成为当前产品形态的一部分（目前 remote demo 主要走 HTTP/SSE）。

为了把“远端程序模型改值 → 双总线更新 → 前端 text 变”变成真实滑动 UI，还需要补齐/调整这些工作：

### 5.1 前端：接入 Management Bus 的投影更新（subscriber）

要做什么：
- 让前端能订阅 MgmtBus 的 `snapshot_delta`（或等价的 patch）并更新本地 snapshot。
- 让 UI 的渲染继续只依赖 snapshot（不持业务真值）。

不允许做什么：
- 不允许 UI 直接发 Matrix/MQTT。

### 5.2 远端 worker：把“真值变化”变成可回放的投影更新

要做什么：
- 明确哪些 ModelTable 变化需要对外发 delta（以及 delta 的 v0 schema）。
- 让这条发出的 delta 保持可审计：能追溯到 op_id 与触发源。

不允许做什么：
- 不允许绕过 `add_label/rm_label` 触发入口。

裁判规则：
- `docs/ssot/runtime_semantics_modeltable_driven.md`

### 5.3 MBR：把 MgmtBus 与 ControlBus 的因果链写死（op_id）

要做什么：
- 统一 op_id 的去重/防重放（跨总线），并保持与 mailbox single-slot 的“消费语义”一致。

证据口径：
- `docs/iterations/0132-dual-bus-contract-harness-v0/contract_dual_bus_v0.md`

### 5.4 验收：必须能脚本化证明“text 能被远端改、前端能看到”

建议验收姿势（不发明新脚本名，仅复用既有的 contract/harness 思路）：
- 能在无真实 Matrix 凭证时跑 loopback case
- 有真实 Matrix 凭证时跑 matrix-live case
- 每条 case 产出可审计字段：room_id/event_id/op_id（且不回显 secrets）

对应 runlog（已有类似记录）：
- `docs/iterations/0132-dual-bus-contract-harness-v0/runlog.md`

## 6. 常见误区（汇报时最容易被问到）

1) “你们是不是用 Vue 的 v-model 做双向绑定？”
- 不是。我们是“投影 + mailbox event + consumer 更新真值 + 再投影”。

2) “前端是不是已经能直接连 Matrix/MQTT？”
- 不能、也不允许。UI 只能写 event mailbox（Charter 硬约束）。


## 7. 参考

- 概念与边界（SSOT）：`docs/architecture_mantanet_and_workers.md`
- 运行时派生语义裁判：`docs/ssot/runtime_semantics_modeltable_driven.md`
- UI 约束（Charter）：`docs/charters/dongyu_app_next_runtime.md`
- UI AST spec：`docs/iterations/0123-ui-ast-spec/spec.md`
- Mailbox contract：`docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`
- 双总线 v0 合同：`docs/iterations/0132-dual-bus-contract-harness-v0/contract_dual_bus_v0.md`
