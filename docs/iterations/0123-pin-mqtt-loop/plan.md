# Iteration 0123-pin-mqtt-loop Plan

## 0. Metadata
- ID: 0123-pin-mqtt-loop
- Date: 2026-01-23
- Owner: TBD
- Branch: dev_0123-pin-mqtt-loop
- Related: docs/roadmap/dongyu_app_next_runtime.md

## 1. Goal
实现 PIN_IN/OUT + 本地 Docker MQTT loop 的最小闭环，并按 Validation Protocol 完成对照验证（不引入 Matrix/双总线/ UI / E2EE / 打包）。

## 2. Background
Stage 2.2 已完成 builtins-v0 实现与验证。Stage 2.3 仅聚焦控制总线闭环：MQTT pub/sub 与 PIN_IN/OUT 行为对齐 PICtest。

## 3. Invariants (Must Not Change)
- ModelTable（p/r/c/k/t/v）是唯一事实与显示数据源。
- UI 事件只能表现为“写单元格”，不得直接产生副作用。
- 第一阶段仅控制总线（MQTT + PIN_IN/OUT），不引入 Matrix/双总线。
- 行为真值规则：在不违反 SSOT/Charter 的前提下，运行时行为以 PICtest 可观测行为为准；若有冲突，必须记录而不擅自裁决。
- 本迭代不实现 UI、Matrix、Element Call、E2EE、打包。

## 4. Scope
### 4.1 In Scope
- PIN_IN / PIN_OUT 的 MQTT pub/sub 最小闭环（本地 Docker MQTT）。
- 与 PICtest 证据表对齐的触发/副作用路径。
- Validation Protocol 与 runlog 逐条 PASS（含命令与输出摘要）。
- MQTT target 配置的写入/读取/校验/失败语义（以 ModelTable page0 为唯一事实）。

### 4.2 Out of Scope
- Matrix 管理总线、双总线。
- UI AST/Renderer。
- Element Call / E2EE / 打包。

## 5. Non-goals
- 不扩展 built-in 语义 beyond PICtest evidence。
- 不引入真实业务逻辑，仅验证控制总线闭环。

## 6. Success Criteria (Definition of Done)
- PIN_IN / PIN_OUT 与 MQTT 的闭环可验证。
- Validation Protocol 逐条 PASS 记录在 runlog（含命令与输出摘要）。
- 无 UI/Matrix/E2EE/打包引入。
- MQTT target 配置的启动语义可审计（EventLog + ModelTable）。

## 7. Risks & Mitigations
- Risk: MQTT 环境不一致导致验证失败。
  - Impact: 无法完成 PASS。
  - Mitigation: 明确本地 Docker MQTT 版本与配置。

## 8. Open Questions
- PICtest 是否提供明确 MQTT payload 约定？若无，如何最小化对照验证？

## 9. SSOT Alignment Checklist (REQUIRED)
- SSOT 0.2/3/4/5：模型驱动、UI 投影、执行在工人、控制总线边界保持一致。
- SSOT 8.2：必须具备脚本化验收路径。
- 若发现 PICtest 行为与 SSOT 冲突，记录冲突而不擅自更改。

## 10. Charter Compliance Checklist (REQUIRED)
- Charter 3.2/3.3/3.4：Cell 固定、built-in k 以 PICtest 行为为准、PIN_IN/OUT。
- Charter 6.1：仅控制总线（MQTT + PIN），不引入 Matrix/Element Call/E2EE/打包。
- Charter 7.1/7.2：PICtest 为行为 Oracle；不确定项需文档化。

## 11. Behavior First (REQUIRED)
- 行为证据来源以 PICtest 为唯一真值源。
- 约束来源：
  - `docs/iterations/0122-pictest-evidence/evidence.md`
  - `docs/iterations/0122-oracle-harness-plan/harness_plan.md`
  - `docs/ssot/modeltable_runtime_v0.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`

## 11.1 MQTT Target Configuration Cell Spec (REQUIRED)
唯一事实来源：ModelTable page0 主配置 Cell（默认 `p=0, r=0, c=0`，如现有结构不同以现有为准）。

**配置 labels（v0 必填/可选）**
- `k="mqtt_target_host"` `t="str"` `v="<host-or-ip>"`
- `k="mqtt_target_port"` `t="int"` `v=1883`
- `k="mqtt_target_client_id"` `t="str"` `v="<client_id>"`
- `k="mqtt_target_username"` `t="str"` `v="<optional>"`
- `k="mqtt_target_password"` `t="str"` `v="<optional>"`
- `k="mqtt_target_tls"` `t="bool"` `v=false`
- `k="mqtt_target_topic_prefix"` `t="str"` `v="<prefix>"`

> 不推荐单 label JSON；分 label 便于 EventLog 与 Harness 对照。

## 11.2 Deterministic Startup Algorithm (REQUIRED)
1) **Parse args**：读取启动参数中的 mqtt target（若有）。\n
2) **Args 覆盖写入**：若 args 提供 mqtt target，初始化阶段先对 page0 配置 labels 执行 `add_label` 覆盖写入（形成事实）。\n
3) **Read config**：从 ModelTable page0 读取 mqtt target 配置。\n
4) **Validate config**：缺必填项 → FAIL。\n
5) **Connect MQTT**（Stage 2.3 执行）：建立连接并进入订阅/发布 loop。\n
6) **Record status**：写入 `mqtt_runtime_status = running|failed`。\n

## 11.3 Failure Semantics (Auditable) (REQUIRED)
启动失败必须写入 ModelTable（非 stdout）：\n
- `k="mqtt_runtime_error_code"` `t="str"` `v="missing_config|invalid_config|connect_failed"`\n
- `k="mqtt_runtime_error_reason"` `t="str"` `v="<human readable>"`\n
- `k="mqtt_runtime_error_detail"` `t="json"` `v={missing_fields:[...], ...}`\n

## 11.4 Validation Cases (REQUIRED)
至少包含三类启动用例（必须写入 Phase1）：\n
1) **Args 覆盖写入用例**：启动参数提供 mqtt target → 断言 page0 labels 被覆盖写入（EventLog 可观测），连接使用该配置。\n
2) **无 args 读取用例**：启动参数不含 mqtt target → page0 预置配置，断言成功连接。\n
3) **缺配置失败用例**：无 args 且 page0 缺必填项 → 启动失败，写入 `mqtt_runtime_error_*`。\n

## 11.5 Stage 2.3 Boundary (REQUIRED)
- MQTT target 配置必须存放于 ModelTable page0。\n
- 参数仅作为“事实写入手段”，不得绕过 ModelTable。\n
- 若 page0 不完整：启动失败并记录错误；不进入 MQTT loop。\n
- 不引入 Matrix/双总线/UI/E2EE/打包。\n

## 12. Iteration Decomposition (Conditional)
- 后续 Stage 3.x 按 Roadmap 执行。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
- MQTT target 配置必须存放于 ModelTable page0。
- 参数仅作为“事实写入手段”，不得绕过 ModelTable。
- 若 page0 不完整：启动失败并记录错误；不进入 MQTT loop。
- 不引入 Matrix/双总线/UI/E2EE/打包。

## 11.6 PIN Cell Spec v0 (REQUIRED)
目标：明确 PIN_IN/PIN_OUT 在 ModelTable 的落点与实际 key（label.k）。

**PIN registry cell（v0 约定）**
- 默认放在 page0：`p=0, r=0, c=1`（如现有结构不同，以现有为准）。\n
- PIN 描述 labels（实际 key / label.k）：\n
  - `k="pin_in"` `t="str"` `v="<pin_name>"`\n
  - `k="pin_out"` `t="str"` `v="<pin_name>"`\n

**可观测副作用（对齐 PICtest PIN.receive/save_）**
- MQTT IN → `add_label` 写入：\n
  - `k="<pin_name>"` `t="IN"` `v="<payload>"` 写入 PIN registry cell。\n
- PIN OUT → MQTT publish：\n
  - `k="<pin_name>"` `t="OUT"` `v="<payload>"` 触发 MQTT 发布。\n

## 11.7 MQTT Topic & Payload Contract v0 (REQUIRED)
> 若 PICtest 未明确 topic/payload，本合同视为项目 v0 约定；对齐点限定为 **PIN 行为副作用**，而非 topic 字符串完全一致。

**Topic naming**
- `mqtt_target_topic_prefix` 为前缀（来自 page0 配置）。\n
- IN topic：`<prefix>/<pin_name>/in`\n
- OUT topic：`<prefix>/<pin_name>/out`\n

**Payload schema (v0)**
- JSON: `{ \"pin\": \"<pin_name>\", \"value\": <payload>, \"t\": \"IN|OUT\" }`\n

**QoS/retain**
- QoS: `0`\n
- Retain: `false`\n

## 11.8 Stage 2.3 Validation Protocol (REQUIRED)
- 本 iteration 需新增专用验证协议：\n
  - `docs/iterations/0123-pin-mqtt-loop/validation_protocol.md`\n
- 必须捕获 `mqtt_trace`，并将三类启动用例映射到 EventLog/snapshot/intercepts + mqtt_trace 断言点。\n
