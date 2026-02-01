# Iteration 0132-dual-bus-contract-harness-v0 Plan

## 0. Metadata
- ID: 0132-dual-bus-contract-harness-v0
- Date: 2026-01-28
- Owner: Sisyphus (OpenCode)
- Branch: dev_0132-dual-bus-contract-harness-v0
- Related:
  - `docs/architecture_mantanet_and_workers.md` (SSOT)
  - `docs/charters/dongyu_app_next_runtime.md` (Charter)
  - `docs/roadmap/dongyu_app_next_runtime.md` (Phase 4 – Dual Bus checkpoints)
  - `docs/iterations/0123-ui-ast-spec/spec.md` (UI AST: pure data; events=write Cell)
  - `docs/iterations/0123-ui-renderer-impl/plan.md` (renderer host adapter contract)
  - `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md` (event mailbox contract; frozen)
  - `docs/iterations/0130-modeltable-editor-v1/contract_typed_values.md` (typed normalization; additive)
  - `docs/iterations/0123-pin-mqtt-loop/validation_protocol.md` (control bus: MQTT + PIN loop)
  - `docs/ssot/modeltable_runtime_v0.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/v1n_concept_and_implement.md` (PICtest Matrix/MQTT channel pointers)

## 1. Goal
在不绕过 Stage 3 的“UI 只写 event mailbox / 无副作用”与 Stage 2 的“PIN_IN/OUT + MQTT loop”语义前提下，为 Stage 4（Dual Bus: Management Bus(Matrix) ↔ MBR ↔ Control Bus(MQTT)）建立一套 **v0 交互契约 + 可脚本验收的 harness**，并接入真实 Matrix（凭证来自 `.env`）：

- 定义 Management Bus / MBR / Control Bus 的最小消息形态与因果链口径（版本化）。
- 定义真实 Matrix adapter 的最小可用闭环（non-E2EE），作为 Management Bus 的 concrete 实现之一。
- 定义“无真实 Matrix 凭证”情况下也能验证的本地 harness（Loopback/Mock Management Bus），用于回归与降级验证。
- 明确真实 Matrix 接入所需的配置、边界、风险与验证扩展点。

## 2. Background
- SSOT 已明确抽象边界：管理总线/控制总线/MBR 是概念，不等同于某个 SDK；但 Phase 4 的目标实现是 Matrix ↔ MBR ↔ MQTT。
- Stage 3 已沉淀“renderer-only frontend + event mailbox contract + server-side truth”的可复用通道雏形（见 0131），但它不是双总线；本迭代只把它作为 harness 形态参考，避免偷渡。
- PICtest 中存在 MQTT topic 与 Matrix room 的线索（`docs/v1n_concept_and_implement.md`），需要以“证据表”方式重新抽取与裁决其是否属于对外契约。
- 本迭代明确要求接入真实 Matrix；Matrix 只能作为 ManagementBusAdapter 的 concrete 实现，仍需保持抽象总线叙事与 MBR 边界。

## 2.1 Phase 4 Gate / Charter Note
- 本迭代包含真实 Matrix 接入要求；用户已显式批准将本迭代作为 Charter 6.1/6.2 的例外（记录于 `docs/iterations/0132-dual-bus-contract-harness-v0/runlog.md`）。
- 该例外不自动推广到后续迭代；后续仍以 Charter/roadmap 的阶段边界为准。

## 3. Invariants (Must Not Change)
- ModelTable（Cell: `p/r/c/k/t/v`）是唯一真值与显示数据源。
- UI/renderer：只读 snapshot；事件只能写 `t="event"`（或现有 editor mailbox contract 指定的 event label），不得直接发 MQTT/Matrix/HTTP side effects。
- 运行时副作用只允许通过 `add_label` / `rm_label` 触发（`docs/ssot/runtime_semantics_modeltable_driven.md`）。
- 复用而不是改写 Stage 3 contract：
  - `docs/iterations/0123-ui-ast-spec/spec.md`
  - `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`
  - `docs/iterations/0130-modeltable-editor-v1/contract_typed_values.md`
- 不引入 Element Call / E2EE / 打包 / Workspace 安全体系（这些是后续 Phase 5/6）。
- Matrix 接入必须由程序模型驱动（ModelTable 结构性声明触发），不得由 UI 直连总线。
- 不把凭证写入 ModelTable / EventLog / runlog；`.env` 仅作为运行时配置入口。
- 不修改 SSOT / Charter（除非用户明确指示）。

## 4. Scope
### 4.1 In Scope
- Stage 4 v0 contract（文档 + schema）：
  - Management Bus 消息类型（至少覆盖：UI event 上行、snapshot/delta 下行）。
  - MBR 的桥接规则（去重/幂等/重放保护的最小口径）。
  - Control Bus 消息类型：严格复用 Stage 2.3 的 PIN_IN/OUT + MQTT 语义作为最小闭环（不先引入“通用 ModelTable mutation over MQTT”）。
- Harness（可脚本验收）：
  - Loopback/Mock 的 Management Bus Adapter（不需要真实 Matrix 凭证）。
  - 真实 Matrix adapter（non-E2EE），从 `.env` 读取配置，具备 join/send/recv 的最小闭环。
  - 可复用 0131 的“server truth + renderer-only frontend”形态做测试入口，但在命名与接口上保持：它是 harness，而不是管理总线实现。
- 证据提取：
  - 从 PICtest 抽取 Matrix/MQTT 通道相关的“可观测事实”（topic/room id/消息形态），并把“是否属于对外契约”标注为待确认项。
  - 明确 program model 触发链的结构性声明落点（不得新增未证据支持的 built-in `k`）。
 - 运行时配置（`.env`）键名与注入路径：
   - `MATRIX_HOMESERVER_URL`
   - `MATRIX_MBR_USER`
   - `MATRIX_MBR_PASSWORD`
   - `MATRIX_MBR_ACCESS_TOKEN`（可选）

### 4.2 Out of Scope
- E2EE / Element Call / 账号体系治理 / 复杂 room 管理策略。
- MBR 的完整策略体系（鉴权/限流/审计/重放保护全量），只做 v0 最小可判定规则。
- 远端协作编辑（多客户端冲突合并）与持久化回写。

## 5. Non-goals
- 不追求“把所有 UI 事件都变成控制总线命令”；v0 只闭合一条最小链路。
- 不发明 PICtest 未证据支持的 topic/room 语义；不确定项必须标注并给出验证方法。
- 不把 Matrix 作为“管理总线本体”，仅作为 adapter 实现之一。

## 6. Success Criteria (Definition of Done)
- 存在一份 Stage 4 v0 contract（版本化、可引用），并显式映射到 Stage 3 mailbox 与 Stage 2 PIN+MQTT 语义。
- 存在至少一条可执行验收脚本（harness），能在无真实 Matrix 凭证情况下验证：
  - UI event（mailbox envelope）进入 management bus adapter
  - 经过 MBR 桥接为 control bus（MQTT）上的 PIN_IN
  - 远端侧产出 PIN_OUT，并通过桥接回到 management bus，再更新本地 UI 投影（snapshot/delta）
- 存在真实 Matrix 的最小闭环验收入口（non-E2EE），当 `.env` 提供完整配置时必须 PASS，并输出可审计字段（room_id/event_id/op_id），不得回显敏感凭证。
- 明确列出“接入真实 Matrix”需要的额外输入（账号/room/凭证策略）与风险项。

## 7. Risks & Mitigations
- Risk: 把 harness 通道误当成管理总线实现，导致后续迁移困难。
  - Mitigation: 接口命名与目录分层明确区分；validation 里加 guard。
- Risk: MBR 语义（幂等/重放保护）不明确导致消息风暴或重复执行。
  - Mitigation: v0 先绑定到 editor mailbox 的 single-slot + op_id 规则；桥接层以 op_id 为去重键。
- Risk: PICtest 中 topic/room id 是硬编码且可能非契约。
  - Mitigation: 先做证据表并标注“上游是否依赖”；v0 contract 默认走配置化并版本化。
- Risk: 凭证泄露（日志/ModelTable/EventLog/runlog）。
  - Mitigation: 明确禁止把 token/密码写入 ModelTable；日志/校验输出必须 redact；`.env` 不入库。
- Risk: Matrix 网络不稳定导致验收波动。
  - Mitigation: loopback harness 作为稳定回归；matrix-live 可重试并单独标注环境依赖。

## 8. Open Questions
- Matrix 认证方式优先级：当 `MATRIX_MBR_ACCESS_TOKEN` 与 `MATRIX_MBR_USER/PASSWORD` 同时存在时如何取舍？
- Matrix room 加入策略：预先 join 还是运行时 join（失败是否重试）？
- PIN topic/payload：Stage 2.3 的 project v0 约定与 PICtest `USERPUT/...`/`UIPUT/...` 是否需要强一致？还是只对齐“PIN 行为副作用”？

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- `docs/architecture_mantanet_and_workers.md`：0.2（总线解耦/可审计）、4（UI 是投影）、5（管理总线/控制总线/MBR）、8.2（脚本化验收）。
- `docs/ssot/runtime_semantics_modeltable_driven.md`：2.1/2.2/3.1（副作用入口 add_label/rm_label；结构性声明驱动）。

### 9.2 Charter Compliance Checklist
- `docs/charters/dongyu_app_next_runtime.md`：4.1/4.2（UI 不执行逻辑/事件写 Cell）、3.2/3.4（Cell 固定、PIN 语义）、7（PICtest 行为真值）、9（禁止 UI 直连总线）。
- Note: 本迭代包含真实 Matrix 接入，属于用户显式批准的 Charter 6.1/6.2 例外（见 runlog Review Gate Record）。

## 10. Artifacts (Iteration-local)
- `docs/iterations/0132-dual-bus-contract-harness-v0/contract_dual_bus_v0.md`
- `docs/iterations/0132-dual-bus-contract-harness-v0/evidence_pictest_matrix_mqtt.md`
- `docs/iterations/0132-dual-bus-contract-harness-v0/schemas/mgmt_bus_event_v0.schema.json`
- `docs/iterations/0132-dual-bus-contract-harness-v0/schemas/matrix_room_event_v0.schema.json`
- `docs/iterations/0132-dual-bus-contract-harness-v0/schemas/control_bus_pin_message_v0.schema.json`
- `docs/iterations/0132-dual-bus-contract-harness-v0/manual_addlabel_case_cellA_cellB.md`

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
