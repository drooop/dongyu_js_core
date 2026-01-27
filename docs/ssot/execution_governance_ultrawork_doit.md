# 执行治理规范：ultrawork / doit / doit-auto

## 定位说明（必须写在文件开头）

本文件用于为当前项目建立并长期遵守一套【执行治理规范】。

- 本文件属于“制度建立 + 执行约束”，不是一次性分析材料。
- 本文件**不**改变架构 SSOT、运行时语义宪法或 Project Charter 的内容与优先级。
- 当本文件与更高层规范冲突时，必须停下并报告冲突（见“冲突处理”）。

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
  - 更新 Roadmap / ITERATIONS.md
- 禁止：
  - 未通过 Gate 不得标记 Completed
  - 不得回退已 Completed Stage（除非显式 Reopen）

========================
【SSOT 与规范层级（必须遵守）】
========================

解释优先级（由高到低）：
1) docs/architecture_mantanet_and_workers.md        （唯一 SSOT）
2) docs/ssot/runtime_semantics_modeltable_driven.md （运行时语义宪法）
3) Project Charter
4) Stage Spec / Ledger / Validation Protocol
5) Iteration Plan / Resolution

低层内容不得违反高层；若冲突，必须停下并报告。

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
