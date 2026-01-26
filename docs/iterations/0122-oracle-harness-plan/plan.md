# Iteration 0122-oracle-harness-plan Plan

## 0. Metadata
- ID: 0122-oracle-harness-plan
- Date: 2026-01-22
- Owner: TBD
- Branch: dev_0122-oracle-harness-plan
- Related: docs/roadmap/dongyu_app_next_runtime.md

## 1. Goal
制定 JS 运行时与 PICtest 行为对齐的对照测试方案，并覆盖 PICtest 识别的**全部实际 built-in k key**（按具体 key 列表组织，不以抽象模块为覆盖边界）。

## 2. Background
当前已完成 PICtest 行为证据提取（Stage 1.1）。下一步必须在不实现运行时代码的前提下，明确对照测试的结构与判定方法，作为后续实现的验证边界。

## 3. Invariants (Must Not Change)
- ModelTable（p/r/c/k/t/v）是唯一事实与显示数据源。
- UI 事件只能表现为“写单元格”，不得直接产生副作用。
- 第一阶段仅控制总线（MQTT + PIN_IN/OUT），不引入 Matrix/双总线。
- 行为真值规则：在不违反 SSOT/Charter 的前提下，运行时行为以 PICtest 可观测行为为准；若有冲突，必须记录而不擅自裁决。
- 本迭代不得实现任何运行时代码或 UI AST/Renderer。

## 4. Scope
### 4.1 In Scope
- 定义输入等价规则（ModelTable 变更、PIN 消息、Label 触发等）。
- 定义输出比较规则（Cell 写入、副作用、日志、错误）。
- 定义幂等与去重判定标准。
- 定义证据等级（Level A/B/C）在测试中的使用方式与允许偏差范围。
- 明确 PASS/FAIL 标准与最小可执行测试结构（仅文档与示意，不写代码）。
- 产出 **Built-in k Discovery Protocol**，从 PICtest 穷举全部实际 key。
- 产出 **Concrete Key Coverage Matrix**，按实际 key 列表组织覆盖信息（不得按 PIN/Function/Connect 抽象模块组织）。

### 4.2 Out of Scope
- 任何运行时代码实现或测试代码编写。
- UI AST/Renderer 实现与 UI 相关代码改动。
- Matrix 管理总线、双总线、Element Call、E2EE、打包。

## 5. Non-goals
- 不对 PICtest 行为进行补全或推断。
- 不引入新的协议或结构超出证据表。
- 不以 PIN/Function/Connect 等抽象模块作为覆盖边界来替代具体 key 列表。

## 6. Success Criteria (Definition of Done)
- 形成清晰的输入等价规则、输出比较规则与错误等价规则。
- PASS/FAIL 判定标准明确且可复现。
- 证据等级（Level A/B/C）在测试中有明确使用方式与风险标注。
- 输出包含最小可执行测试结构（目录/脚本入口建议），但不实现代码。
- Built-in k Discovery Protocol 明确且可执行，至少包含四类信号源的穷举规则。
- Concrete Key Coverage Matrix 覆盖所有发现的实际 key，并包含：触发输入构造、期望副作用、Evidence Level、Harness 拦截点；组织方式以具体 key 列表为唯一索引。

## 7. Risks & Mitigations
- Risk: 证据等级未明确影响测试判定。
  - Impact: 后续实现与验证口径不一致。
  - Mitigation: 在规则中明确 Level A 必须严格一致，Level B/C 需标注允许偏差与补充验证方式。
- Risk: PICtest 行为存在歧义或缺口。
  - Impact: 测试规则无法落地。
  - Mitigation: 将歧义记录为 Open Questions 并回补 Stage 1.1 证据。

## 8. Open Questions
- 证据等级为 Level B/C 的行为是否需要最小复现实验？若需要，归属哪个迭代？
- MQTT 相关行为的对照测试是否拆分为独立子套件？

## 9. SSOT Alignment Checklist (REQUIRED)
- SSOT 0.2/3/4/5：模型驱动、UI 投影、执行在工人、控制总线边界保持一致。
- SSOT 8.2：必须具备脚本化验收路径（本迭代仅定义测试结构，不执行）。
- 若发现 PICtest 行为与 SSOT 冲突，记录冲突而不擅自更改。

## 10. Charter Compliance Checklist (REQUIRED)
- Charter 3.2/3.3/3.4：Cell 固定、built-in k 以 PICtest 行为为准、PIN_IN/OUT。
- Charter 6.1：仅控制总线（MQTT + PIN），不引入 Matrix/Element Call/E2EE/打包。
- Charter 7.1/7.2：PICtest 为行为 Oracle；不确定项需文档化。

## 11. Behavior First (REQUIRED)
- 行为证据来源以 PICtest 为唯一真值源；本迭代仅基于证据表制定对照测试规则。
- 证据来源：`docs/iterations/0122-pictest-evidence/evidence.md`（含 Evidence Level 标注）。

## 12. Built-in k Discovery Protocol (REQUIRED)
本协议用于**穷举 PICtest 实际识别的 built-in k key**，作为测试覆盖清单的唯一来源（不做抽象分类）。必须至少覆盖以下四类信号源：
1) **Label registry / dispatch maps**：Label 类型注册表、分发映射与工厂（用于识别可被运行时解释的 key）。
2) **add_label / save_ / receive 等入口 special-case 分支**：任何对 `label.k` 或 pin/label 类型的显式分支判断。
3) **Connect / ManageCell 对连接类 key 的识别**：对连接/引脚 key 的白名单、合法性校验或分支路径。
4) **系统 meta keys**：影响 v1n/config 的 key（例如 `local_mqtt` / `global_mqtt` / `data_type` / `v1n_id` 等）。

输出要求：
- 形成“Concrete Key Inventory（实际 key 列表）”，并逐条绑定源文件与符号。
- 对于仅作为业务数据键、且无运行时分支识别的 key，明确排除（不计入 built-in k）。

## 12.1 Built-in k Discovery Completion Rule (REQUIRED)
Concrete Key Inventory 视为完成的条件：
- Discovery Protocol 的四类信号源全部完成遍历，并逐条记录证据路径。
- Inventory 中每个 key 均绑定源文件与符号，并标注 Evidence Level（A/B/C）。
- 对“仅业务数据键、不具备运行时识别分支”的 key 明确排除且记录排除依据。
- 若发现新的 key，必须回填 Inventory 与 Coverage Matrix；否则本 Iteration 视为未完成。

## 13. Concrete Key Coverage Matrix (REQUIRED)
按实际 key 列表组织矩阵，并为**每个 key**提供：
- 触发输入构造
- 期望副作用（ModelTable diff / MQTT publish / 错误写入）
- Evidence Level（A/B/C）
- Harness 需要的拦截点

## 14. Iteration Decomposition (Conditional)
- 后续迭代按 `docs/roadmap/dongyu_app_next_runtime.md` 执行（Stage 2.1 起）。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
