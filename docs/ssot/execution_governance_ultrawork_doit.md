---
title: "执行治理规范：ultrawork / doit / doit-auto"
doc_type: ssot
status: active
updated: 2026-05-10
source: ai
---

# 执行治理规范：ultrawork / doit / doit-auto

## 定位说明（必须写在文件开头）

本文件用于为当前项目建立并长期遵守一套【执行治理规范】。

- 本文件属于“制度建立 + 执行约束”，不是一次性分析材料。
- 本文件**不**改变架构 SSOT、运行时语义宪法或 Project Charter 的内容与优先级。
- 当本文件与更高层规范冲突时，必须停下并报告冲突（见“冲突处理”）。

---

========================
【规约撰写方法（必须先分类）】
========================

本节用于约束以后如何写 AGENTS / CLAUDE / SSOT / user-guide 中的 AI 协作规则。

来源依据：
- OpenAI Prompt guidance: outcome-first prompts usually work better than process-heavy prompt stacks.
- OpenAI Prompt engineering: clear structure, relevant context, examples, and prompt caching all favor stable reusable instructions.
- OpenAI Reasoning best practices: reasoning models prefer simple, direct instructions and clear delimiters.
- OpenAI Structured Outputs: when exact fields matter, schema is stronger than repeated formatting emphasis.
- OpenAI Codex best practices: stable repository guidance belongs in AGENTS.md and should stay practical, short, and updated from repeated friction.

写规则前先分类：

1) 硬约束（Invariant）
- 适用：安全禁区、数据真源、流程闸门、禁止操作、必填字段、语义合同、验证要求。
- 写法：可以使用“必须 / 禁止 / 不得 / MUST / NEVER”。
- 要求：说明约束对象、违反后果、验证方式或停机条件。

2) 判断规则（Decision Rule）
- 适用：是否搜索、是否追问、是否生成 artifact、是否用 HTML、是否继续探索、是否升级验证范围。
- 写法：条件 → 动作 → 停止条件 → 验证。
- 要求：不得写成无条件“永远 / 绝不”；必须允许上下文证据改变路径。

3) 偏好建议（Preference）
- 适用：语气、篇幅、汇报顺序、默认格式、协作节奏。
- 写法：默认倾向 + 让位条件。
- 要求：不得冒充硬约束；显式用户要求可覆盖。

Prompt / 规约内容组织：
- 先写目标和成功标准，再写约束和证据来源。
- 把稳定内容放在长期文档里，把本次变化内容放在用户请求或 iteration 文档里。
- 对输出格式有硬要求时，优先给 schema、字段表或例子。
- 对质量有要求时，写可执行验证或 eval 条件。
- 避免把“先做 A，再做 B，再做 C”写成默认脚本；只有每一步确实影响正确性、审计或安全时才固定顺序。

HTML / visualized artifact 边界：
- 默认交付格式是 Markdown / 文本。
- HTML 不作为默认交付格式。
- 只有以下情况使用 HTML 或其他显式 artifact：
  - 用户明确要求 HTML；
  - 需要 visualized 文档；
  - 需要可交互阅读、筛选、对比、导出；
  - 复杂图解比纯文本更能减少误解。
- HTML artifact 是阅读和交互产物，不是 SSOT；除非更高优先级文档显式提升，否则真实规则仍以 AGENTS / CLAUDE / SSOT / iteration 记录为准。

---

========================
【角色与权限模型（必须遵守）】
========================

系统中存在三类能力，权限严格分层，不得越权：

1) ultrawork（并行评审层 / 智囊团）
- 职责：
  - 架构评审、语义盲区扫描、风险清单、验证缺口建议
  - Stage 切换前的 Phase0 评审
  - Phase3 完成后的 postmortem 复盘
- 禁止：
  - 不得修改代码
  - 不得直接生成 Phase3 实现
  - 不得修改 SSOT / Charter / Spec
  - 不得直接推进 Roadmap 状态

2) doit（执行宪法）
- 职责：
  - Phase1：生成 plan / resolution / validation contract
  - Phase3：实现、运行验证、生成 runlog
- 必须：
  - 严格遵守 SSOT / Charter / Spec / Validation Protocol
- 禁止：
  - 不得跳过 Phase
  - 不得在未通过 Gate 时推进 Stage

3) doit-auto（编排器 + 状态机）
- 职责：
  - 根据 Roadmap 推进 Stage
  - 创建 iteration
  - 更新 Roadmap / [[ITERATIONS]]
- 禁止：
  - 未通过 Gate 不得标记 Completed
  - 不得回退已 Completed Stage（除非显式 Reopen）

========================
【SSOT 与规范层级（必须遵守）】
========================

解释优先级（由高到低）：
1) [[architecture_mantanet_and_workers]]        （唯一 SSOT）
2) [[ssot/runtime_semantics_modeltable_driven]] （运行时语义宪法）
3) Project Charter
4) Stage Spec / Ledger / Validation Protocol
5) Iteration Plan / Resolution

低层内容不得违反高层；若冲突，必须停下并报告。

========================
【治理条目：应用层能力模型化】
========================

- 应用层能力必须通过 ModelTable 的模型能力表达（数据/程序/流程/UI/文档）。
- 系统级扩展必须通过系统负数 model_id 模型承载，避免在基座核心层引入旁路语义。
- 运行时核心的变更仅允许为“通用解释器能力增强”，不得为特定业务硬编码。

========================
【Stage 执行模型（统一规则）】
========================

每个 Stage 必须遵循以下固定流程：

A) Phase0（可选，但推荐）
- 由 ultrawork 执行
- 只输出：风险点 / 语义盲区 / 测试缺口
- 输出不得直接进入实现

B) Phase1（documents-only）
- 由 doit 生成
- 产出：plan / resolution / validation contract
- 进入审核流程

C) Phase1 审核规则（强制）
- 允许最多 3 次 **major revision**
- major revision 定义：影响 scope / 契约 / 验证口径
- minor wording 修订不计数
- Gate（Phase1）：
  - 规范是否可裁决
  - 验证是否可执行
- Gate 通过即停止 Phase1 迭代（不强行凑三次）

D) Phase3（实现型 or documents-only，按 Stage 类型）
- 由 doit 执行
- 必须严格按 Phase1 契约
- 产出 runlog 作为唯一事实

E) Phase3 审核规则（强制）
- 允许最多 3 次 **major revision**
- Gate（Phase3）：
  - Validation Protocol 全部 PASS
  - runlog 可审计
- 未通过 Gate 不得推进 Stage

F) Stage 收尾
- doit-auto 更新 Roadmap 状态
- ultrawork 可做 postmortem（不改代码）
- 单人项目默认不要求 PR；若本地 Gate 已通过，允许直接 merge 到 `dev` 并 push。
- 只有用户明确要求 review / PR 时，才进入 PR 流程。

========================
【Roadmap 动态更新规则（非常重要）】
========================

- 已标记 Completed 的 Stage：
  - 状态不可回退
  - 只能追加 Notes / Follow-ups
- 未开始或进行中的 Stage：
  - 可调整顺序与细节
  - 必须注明变更原因（来自 runlog 事实或新证据）
- Roadmap 是状态机，不是随想文档

========================
【ultrawork 的使用约束（硬规则）】
========================

- ultrawork 的输出：
  - 只能作为“评审材料”
  - 必须先被人类或 doit 转写为文档（spec/plan）
- ultrawork 输出不得：
  - 直接进入 Phase3
  - 直接修改代码
  - 直接修改 Roadmap 状态

========================
【doit-auto 最小规则增补（强制）】
========================

- 必须区分 Stage 类型：
  - DOCS stage：仅 Phase0/Phase1 的 documents-only 产出与审核；不得触发任何实现；不得标记 Completed（除非该 Stage 的完成定义就是文档 Gate + PASS）。
  - IMPL stage：必须走完整 Phase1 → Gate → Phase3 → Gate；必须由 doit 执行实现与验证；doit-auto 仅负责编排与状态推进。
- 强制 Gate 判定：
  - Phase1 Gate：必须明确 Approved / Change Requested / On Hold；不允许模糊通过。
  - Phase3 Gate：必须以 Validation Protocol 全部 PASS + runlog 可审计为通过条件。
- 强制最多三轮 major revision：
  - Phase1：最多 3 次 major revision；超过则必须 On Hold 并要求人类裁决。
  - Phase3：最多 3 次 major revision；超过则必须 On Hold 并要求人类裁决。

========================
【冲突处理（硬规则）】
========================

当出现以下任一情况，必须停止并报告，禁止自行裁决：
- 本文件与更高层规范（SSOT / 运行时语义宪法 / Charter）冲突
- 本文件与 `docs/WORKFLOW.md` 的 Phase 定义、Gate 口径、证据要求冲突
- 不清楚某个 Stage 是 DOCS 还是 IMPL
- 不清楚某次修改是否属于 major revision

报告最小格式（必须包含）：
- 冲突类型：语义 / 流程 / 权限 / 验证
- 冲突文件路径：A vs B
- 冲突条款：逐字引用
- 阻塞点：为什么无法继续
- 需要谁裁决：User / doit / doit-auto / ultrawork

---

## 首次落地要求（本文件发布后立即生效）

1) 本文件必须被所有执行相关 agent/skill 作为参考文档加载（至少 doit-auto）。
2) 后续所有工作默认遵守本文件；若发现冲突，按“冲突处理”停下并报告。
