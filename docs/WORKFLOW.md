# Iteration Workflow

本仓库的非紧急工作必须按 Iteration 工作流执行。Iteration 的目标是将“需求 → 计划 → 执行 → 验证 → 证据沉淀”固化为可复制流程，并支持 Codex 全自动推进。

## 核心概念

- **Iteration**：一次迭代工作包，目录为 `docs/iterations/<id>/`。
- **plan.md**：合同（WHAT/WHY）。定义目标、范围、不变量、成功标准。不得出现步骤编号和执行记录。
- **resolution.md**：施工方案（HOW）。以 Step 1..N 定义范围、文件、验证、验收、回滚。不得记录真实执行结果。
- **runlog.md**：飞行记录仪（FACTS）。只记录真实执行命令、关键输出、commit、PASS/FAIL、修复。不得写愿景与计划。
- **assets/**：截图、录屏、性能数据、对比图等证据（可选）。

## Phase 0 — Intake（需求录入）

输入：人类给出本次版本需求（可简短）。  
输出：确定 `<id>`（如 1216、1216-2、1220），并创建 iteration 目录骨架（可为空模板）。

约束：
- 未登记到 `docs/ITERATIONS.md` 的 iteration 不允许进入后续阶段。

## Phase 1 — Planning（生成计划）

输入：需求描述 + 模板 `docs/_templates/`。  
输出：
- `docs/iterations/<id>/plan.md`
- `docs/iterations/<id>/resolution.md`
- 在 `docs/ITERATIONS.md` 登记该 iteration（状态=Planned）

约束：
- Phase 1 严禁实现代码（只能写文档与计划）。
- plan 与 resolution 必须可被“无上下文读者”理解（自包含）。

## Phase 2 — Review Gate（审核闸门）

输入：对 plan/resolution 的审核结论（User 或 OpenCode）。  
输出：明确状态之一：
- **Approved**：允许进入 Phase 3
- **Change Requested**：返回 Phase 1 修改
- **On Hold**：暂停，不执行

约束：
- 未得到明确 Approved，不允许进入 Phase 3。

### Auto-Approval Policy（单人公司模式）

当用户没有明确审核时，允许使用 OpenCode 进行“多次独立审核”替代人工审核。

规则：
- OpenCode 必须进行 3 次独立 review，且按固定调用序列执行：
  1) Review #1：`@oracle`
  2) Review #2：`@momus`
  3) Review #3：`@oracle`
- 最近连续 3 次 review 的 Decision 均为 **Approved**，且没有任何未处理的 Change Requested。
- 以上条件满足后，OpenCode 可以将本次 Review Gate 视为 **Approved** 并进入 Phase 3。
- 所有 review 记录必须写入 `docs/iterations/<id>/runlog.md` 的 Environment 区域（事实记录）。

## Phase 3 — Execution（按 Step 执行并自我迭代）

输入：已 Approved 的 `resolution.md`。  
输出：逐 Step 完成实现与验证，并将真实证据写入 `runlog.md`。

执行原则：
- 只在指定分支工作（一般为 `dev_<id>`）。
- 严格按 Step 顺序推进，不得跳步、不得合并多个 Step 为一次提交。
- 每个 Step 必须具备可执行验证（命令/脚本/可判定检查清单）。
- 验证失败必须自我迭代修复，直到验证通过才允许提交。
- 每个 Step 的真实执行证据必须写入 `runlog.md`（命令 + 关键输出片段 + commit hash）。

## Phase 4 — Completion（完成与归档）

完成条件（Definition of Done）：
- `resolution.md` 中所有 Step 均在 `runlog.md` 里有 PASS 记录与对应 commit。
- `docs/ITERATIONS.md` 状态更新为 Completed（并填写最终分支/commit）。
- 关键资产（截图/性能数据）如有必须归档在 `assets/`。

分支约定（单人公司模式）：
- 大多数情况下：Iteration 分支（`dev_<id>`）完成后 merge 到 `dev` 即可。
- `main` 只在需要发布/对外里程碑时从 `dev` 提升；此时再考虑 PR（dev → main）。

## 允许的例外

仅以下情况允许绕过完整流程：
- 线上紧急修复（hotfix）
- 安全漏洞紧急修复

但仍需在事后补齐：
- Iteration 记录（至少 runlog 与链接到相关 commit）
