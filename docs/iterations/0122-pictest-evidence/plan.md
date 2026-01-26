# Iteration 0122-pictest-evidence Plan

## 0. Metadata
- ID: 0122-pictest-evidence
- Date: 2026-01-22
- Owner: TBD
- Branch: dev_0122-pictest-evidence
- Related: docs/roadmaps/dongyu-app-next-runtime-elysia.md

## 1. Goal
产出 PICtest 中 built-in k / trigger / PIN 相关的“可观测行为证据表”与引用路径清单，为后续对照测试与 JS 实现提供唯一事实依据。

## 2. Background
当前重写必须以 PICtest 可观测行为为第一真值源。为避免“拍脑袋”实现，需要在任何运行时代码之前完成证据提取与归档。

## 3. Invariants (Must Not Change)
- ModelTable（p/r/c/k/t/v）是唯一事实与显示数据源。
- UI 事件只能表现为“写单元格”，不得直接产生副作用。
- 第一阶段仅控制总线（MQTT + PIN_IN/OUT），不引入 Matrix/双总线。
- 行为真值规则：在不违反 SSOT/Charter 的前提下，运行时行为以 PICtest 可观测行为为准；若有冲突，必须记录而不擅自裁决。
- 本迭代不得实现任何运行时代码或 UI AST/Renderer。

## 4. Scope
### 4.1 In Scope
- 定位 PICtest 中与 built-in k / trigger / PIN 行为相关的文件路径与关键符号。
- 提取“可观测行为证据表”（输入/条件/副作用/错误/幂等）。
- 记录与整理证据不一致/不明确之处，并给出澄清方法。
- 形成后续对照测试的最小断言清单（仅条目，不实现）。

### 4.2 Out of Scope
- 任何运行时代码实现。
- UI AST/Renderer 实现与 UI 相关代码改动。
- Matrix 管理总线、双总线、Element Call、E2EE、打包。

## 5. Non-goals
- 不追求补全或“推测” PICtest 未明确给出的行为。
- 不修改 PICtest 源码，不尝试修复或重构其实现。

## 6. Success Criteria (Definition of Done)
- 为 built-in k / trigger / PIN 形成完整证据表（含输入、条件、输出、副作用、错误与幂等）。
- 证据表逐条绑定 PICtest 具体文件路径与关键符号。
- 每条证据标注“证据等级”（Level A/B/C），区分直接可观测与推断行为。
- 不确定项被记录为显式问题，并标注验证/澄清方法。
- 产出对照测试的最小断言清单（仅条目）。

## 7. Risks & Mitigations
- Risk: PICtest 行为分散且隐式。
  - Impact: 证据表不完整或误读。
  - Mitigation: 以多处交叉引用与运行时日志输出路径为依据，标注证据等级。
- Risk: 行为存在歧义。
  - Impact: 后续实现分歧。
  - Mitigation: 明确“待确认”并要求补充样例或复现实验。

## 8. Open Questions
- PICtest 中 built-in k 的完整枚举与触发入口是否存在集中定义？
- PIN_IN/OUT 在 PICtest 中的“可观测行为”是否仅体现为 Label/PIN 机制，或还有上层协议？

## 9. SSOT Alignment Checklist (REQUIRED)
- SSOT 0.2/3/4/5：模型驱动、UI 投影、执行在工人、总线解耦、控制总线边界保持一致。
- SSOT 8.2：证据提取必须可审计、脚本化验收路径可复现（本迭代仅产出证据与清单）。
- 若发现 PICtest 行为与 SSOT 冲突，记录冲突而不擅自更改。

## 10. Charter Compliance Checklist (REQUIRED)
- Charter 3.2/3.3/3.4：Cell 结构固定、built-in k 以 PICtest 行为为准、PIN_IN/OUT 为显式 Cell。
- Charter 6.1：仅控制总线（MQTT + PIN），不引入 Matrix/Element Call/E2EE/打包。
- Charter 7.1/7.2：PICtest 为行为 Oracle；不确定项需文档化。

## 11. Behavior First (REQUIRED)
- 行为证据来源以 PICtest 为唯一真值源；本迭代仅做证据提取与归档。
- Phase0 仅负责定位证据锚点；本 Iteration 的 Phase3 目标是在此基础上形成完整、可审计的行为证据表。
- Phase0 证据锚点（Phase3 将据此形成完整证据表）：
  - `vendor/PICtest/yhl/core.py`：`Cell.add_label` 与 `rm_label` 触发 label_init 与引脚生命周期。
  - `vendor/PICtest/yhl/labels.py`：`RunLabel.label_init`、`FunctionLabel.label_init`、`ConnectLabel.label_init`、`InLabel/OutLabel/LogInLabel/LogOutLabel.label_init`。
  - `vendor/PICtest/yhl/Connect/PIN.py`：`PIN.receive`/`PIN.save_` 的消息分发与写回行为。
  - `vendor/PICtest/yhl/Connect/manageCell.py`：`init_pin`/`init_inner_connection`/`add_connect` 的连接与触发规则。
  - `vendor/PICtest/yhl/function.py`：`Function.handle_call`/`run` 与 pin_callout 行为。
