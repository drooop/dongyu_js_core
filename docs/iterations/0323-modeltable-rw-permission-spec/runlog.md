---
title: "0323 — Runlog"
doc_type: iteration-runlog
status: active
created: 2026-04-17
updated: 2026-04-21
source: ai
iteration_id: 0323-modeltable-rw-permission-spec
id: 0323-modeltable-rw-permission-spec
phase: phase3
---

# 0323 — Runlog

## Classification: docs-only

本迭代为纯文档变更，无代码、无测试、无部署。

## Step 1: 修改 host_ctx_api.md — PASS

- 全面改写为 V1N 命名空间
- 新增 §0 权限模型总则、§1 V1N 数据访问 API、§2 跨 Cell 写入路径、§3 跨模型通信路径、§4 默认三程序、§7 Deprecated API
- ctx.writeLabel/getLabel/rmLabel 标注 DEPRECATED
- helper executor (0,1,0) 标注 DEPRECATED

## Step 2: 修改 runtime_semantics_modeltable_driven.md — PASS

- §5.3 model.table 条目增加 (0,0,0) 默认三程序基础设施表格
- 新增 §5.3b 运行时权限模型（权限分层、V1N API、跨 Cell/跨模型路径、禁止条款、Deprecated 列表）

## Step 3: 修改 architecture_mantanet_and_workers.md — PASS

- §3.4 model.table 段落增加 (0,0,0) 默认基础设施和权限模型概要
- §6 PIN 系统新增 §6.4 权限模型与 PIN 路由引用

## Step 4: 修改 CLAUDE.md — PASS

- MODEL_FORMS 节 model.table 条目增加默认三程序描述
- FUNCTION_LABELS 节增加保留 func.js key 列表
- 新增 PERMISSION_MODEL 节（权限分层、V1N API、跨 Cell/跨模型规则、Deprecated 列表）

## Step 5: 创建 runlog.md — PASS

本文件。

## 一致性验证

| 检查项 | 结果 |
|---|---|
| CLAUDE.md PERMISSION_MODEL 与 host_ctx_api.md 一致 | PASS |
| runtime_semantics §5.3b 与 host_ctx_api.md 一致 | PASS |
| architecture §3.4/§6.4 引用指向正确 | PASS |
| 所有 DEPRECATED 标注一致 | PASS |
| 未修改代码/依赖/测试 | PASS（docs-only） |

## Step 6: 子代理审查修复（2026-04-17） — PASS

feature-dev:code-reviewer 子代理审查发现 4 项 HIGH 规约冲突，已全部修复：

| # | 位置 | 问题 | 修复 | 状态 |
|---|---|---|---|---|
| H1 | CLAUDE.md ARCH_INVARIANTS L178 | "ctx = sandboxed API" 与 PERMISSION_MODEL 节 V1N 自相矛盾 | 改为 `ctx = runtime execution context (system-level); user program API face = V1N namespace (0323)` | PASS |
| H2 | runtime_semantics §5.2f vs §5.3 | (0,1,0) helper scaffold 与 (0,0,0) 三程序 DEPRECATED 并存无裁决 | §5.2f 开头加 (0323) 裁决行：helper scaffold 仅 model.single 适用，model.table 用 (0,0,0) 三程序 | PASS |
| H3 | runtime_semantics §5.2g | 三程序注入时机未说明 | 增加 (0323) 条款：createModel 自动植入，不占 bootstrap 步骤；Model 0 与负数模型独立裁决 | PASS |
| H4 | plan.md 后续迭代清单 | payload 格式冻结责任无追踪 | 0323+1 明确加上 payload 格式冻结；新增 0323+5 兼容期终止迭代 | PASS |

## 最终一致性验证（第一轮修复后）

| 检查项 | 结果 |
|---|---|
| CLAUDE.md 内部自洽（ARCH_INVARIANTS vs PERMISSION_MODEL） | PASS |
| runtime_semantics 内部自洽（§5.2f vs §5.3） | PASS |
| bootstrap 顺序完整（三程序有明确注入时机） | PASS |
| 后续迭代追踪完整（payload 格式 + 兼容期终止） | PASS |

## Step 7: 第二轮三 agent 并行审查修复（2026-04-17） — PASS

三个并行 agent（A 验证 H1-H4、B 扫描新 HIGH、C 引用/术语）报告了 5 个置信度 ≥80 的真实问题（排除 pedantic nitpicks 与下级文档可选项）：

| # | 来源 | 置信度 | 严重度 | 问题 | 修复 | 状态 |
|---|---|---|---|---|---|---|
| C2 | Agent C | 85 | HIGH | architecture §6.4 第 258/260 行乱码字符 `必��`/`权��` | 恢复为 `必须`/`权限` | PASS |
| C1 | Agent C | 90 | HIGH | `(0,1,0) helper executor DEPRECATED` 在 `§5.3` / `§5.3b` / `host_ctx_api §4` / `CLAUDE.md` 四处未加 "model.single 仍适用" 限定，与 `§5.2f` 权威裁决不一致 | 四处全部追加 "仅 model.table 场景；model.single 保留 helper scaffold，详见 §5.2f" | PASS |
| H5 | Agent B | 85 | HIGH | model.single 沙箱 "cannot reach other Cells" 与 V1N.readLabel 允许读当前模型任意 Cell 语义冲突 | CLAUDE.md MODEL_FORMS 的 model.single 条目 + runtime_semantics §1.4 均加入澄清：沙箱仅约束写，不约束读；嵌套在 model.table 内的 model.single 可跨 Cell 读，独立 model.single 无跨 Cell 读路径 | PASS |
| H6 | Agent B | 80 | HIGH | 三程序默认 code 的 Tier 归属未裁决，可能违反 fill-table-first 硬约束 | §5.2g 增加裁决段：三程序 code 字符串属 Tier 2（源自 `system-models/default_table_programs.json`，0323+1 冻结位置），植入机制属 Tier 1；运行时代码不得硬编码 code 字符串 | PASS |
| C3 | Agent C | 80 | MEDIUM | architecture §3.4 用 "默认基础设施"，其他文档统一用 "默认三程序" | §3.4 改为 "(0,0,0) 默认三程序" | PASS |

## 未修复项（已决策忽略或延后）

| # | 来源 | 置信度 | 决策 | 理由 |
|---|---|---|---|---|
| C4 | Agent C | 80 | 忽略 | "用户程序" vs "用户自定义程序" 属中文近义词，规约阅读不受影响 |
| C5 | Agent C | 80 | 忽略 | §3.4 对 host_ctx_api.md 双引用不对称，属结构层面 nitpick |
| C6 | Agent C | 80 | 忽略 | architecture 未提 ctx DEPRECATED 可接受——architecture 是概念层，DEPRECATED 属 host_ctx_api / runtime_semantics 细节 |
| M1 | Agent B | 78 | 延后 0323+1 | Model 0 外发机制细节（mt_bus_send 上行后如何触发 pin.bus.out）属实现细节，不是语义冲突 |

## 最终一致性验证（第二轮修复后）

| 检查项 | 结果 |
|---|---|
| CLAUDE.md 内部自洽 | PASS |
| runtime_semantics 内部自洽（§1.4 / §5.2f / §5.2g / §5.3 / §5.3b 五节） | PASS |
| 跨文档 DEPRECATED 表述一致（四处均注明 model.single 保留） | PASS |
| 跨文档术语一致（统一 "默认三程序"） | PASS |
| model.single 沙箱语义明确（写受限、读扩展） | PASS |
| 三程序 code Tier 归属裁决（code=Tier 2, 植入=Tier 1） | PASS |
| 无文件编码问题（乱码字符已清理） | PASS |

## Phase 4 完成标记（2026-04-17）

- runlog 所有步骤（Step 1–7）PASS
- ITERATIONS.md 状态已更新：`In Progress` → `Completed`
- 所有一致性验证通过
- 用户授权实施完成

## Step 8: 第三轮 post-commit 审查修复（2026-04-17） — PASS

Post-commit（73b0998 后）两个并行 agent 审查结果：
- Agent A（commit 范围/完整性验证）：**APPROVED** — 范围隔离清晰、内容完整、无 CRITICAL 安全问题
- Agent B（final spec review）：**NEEDS_WORK** — 2 项 HIGH：payload 格式冻结状态矛盾、default_table_programs.json 过渡期 undefined

**本轮修复（2 项 HIGH）：**

| # | 位置 | 修复 | 状态 |
|---|---|---|---|
| H1 | host_ctx_api.md §2 | 移除"建议"措辞，改为"0323 冻结 v1"；补齐 payload 字段约束（op/target/label/k/t/v）、返回结果格式（含 status/error 结构化码）、向后兼容承诺 | PASS |
| H2 | runtime_semantics §5.2g | 增加"本迭代与 0323+1 过渡期约定"段落：0323 期间 createModel 行为不变；0323+1 首要任务明确（创建 default_table_programs.json、修改 createModel 实现、硬约束生效时点）；过渡期 undefined 行为警示 | PASS |

## 最终一致性验证（第三轮修复后）

| 检查项 | 结果 |
|---|---|
| payload 格式冻结（可供 0323+1 实施依赖） | PASS |
| Tier 归属 + 过渡期语义完整（无 undefined window） | PASS |
| 规约"可冻结、可依赖"成熟度达标 | PASS |
| 与 8d5ed83 commit 无冲突（独立文件修改） | PASS |

## 已知延后项（纳入后续迭代）

| 项目 | 归属迭代 | 说明 |
|---|---|---|
| mt_write payload 字段冻结 | ✓ 本迭代已冻结 | host_ctx_api.md §2 含完整字段约束 + 返回格式 |
| mt_write / mt_bus_receive / mt_bus_send 运行时实现 + V1N API 面 | 0324 + 0325 | 0324 runtime seed 骨架；0325 ctx→V1N 替换 |
| 三程序默认 code 的 JSON patch 文件落位（`default_table_programs.json`） | 0324 | Tier 2 来源文件 |
| Model -10/-12 等系统函数从 ctx.writeLabel 到 pin 链路迁移 | 0325 Step 3 | 大规模重构，同 PR 改所有调用方 |
| Model 0 mt_bus_send 上行后的外发机制明确（pin.bus.out 触发链） | 0326 | 与 UI 事件 ingress 改造统一设计 |
| 移除 (0,1,0) helper executor scaffold（仅 model.table） | 0324 | 用户 2026-04-21 决策"helper 完全废弃"覆盖本条；model.single 独立场景的 helper 是否保留由 0324 plan 明确裁决 |
| 更新所有 system-models JSON patches 适配新权限模型 | 0325 Step 3 | 同 0325 代码迁移同 PR |
| 兼容期终止：移除 ctx.writeLabel / ctx.getLabel / ctx.rmLabel | 0325 | 用户 2026-04-21 决策"不允许兼容"覆盖本条 0323 spec "兼容期直到后续实现迭代正式移除" 的字面表述 — 0325 直接移除 |

## Phase 3 补执行（2026-04-21）— PASS

原始 73b0998 + 5e7af6b commits 此前仅在 `dev_0323-modeltable-rw-permission-spec` 分支，未 merge 到 `dev`。2026-04-21 发现这一空缺（0322 收尾后对照 0323 规约的 review 过程中），补执行：

- Action: `git rebase dev` on branch `dev_0323-modeltable-rw-permission-spec`
- Conflicts resolved:
  - `docs/ITERATIONS.md` — 保留 HEAD 的 0322 `Completed` 状态 + 保留 0323 行新增
  - `docs/ssot/runtime_semantics_modeltable_driven.md` — 保留 HEAD 的 §5.2f.1 EventLog Observer（0322 所加）+ 保留 0323 的 §5.2g "0323 增补" 标题
- Rebased HEADs: `7480e93` (0323 spec), `5580022` (0323 payload v1 freeze)
- Next: 本分支在补充本 runlog 追加记录后 merge 到 `dev`（no-ff），让 baseline `dev` 含 V1N / mt_write / PERMISSION_MODEL
- Downstream: 0324 / 0325 / 0326 / 0327 / 0319 的 phase1 docs 将基于 0323-merged dev 重写（memory `project_0323_implementation_roadmap.md` 已对齐正式命名）
