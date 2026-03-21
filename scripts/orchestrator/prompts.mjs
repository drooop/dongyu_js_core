/**
 * prompts.mjs — Prompt templates for each phase (§7 in resolution)
 *
 * Each prompt includes:
 * - Iteration context (plan/resolution/runlog)
 * - Phase-specific instructions
 * - Verdict format requirements
 *
 * Note: CLAUDE.md / AGENTS.md are auto-loaded by Claude Code / Codex respectively.
 * We only inject iteration-specific context and orchestrator protocol instructions.
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function formatReviewPolicyContext(reviewPolicy, riskProfile) {
  if (!reviewPolicy) {
    return ''
  }

  return `
### Current review_policy
\`\`\`json
${JSON.stringify({
  approval_count: reviewPolicy.approval_count,
  major_revision_limit: reviewPolicy.major_revision_limit,
  cli_failure_threshold: reviewPolicy.cli_failure_threshold,
  risk_profile: riskProfile || reviewPolicy.risk_profile || null,
  escalation_policy: reviewPolicy.escalation_policy || {},
}, null, 2)}
\`\`\`
`
}

function formatEscalationBoundaryContext(reviewPolicy) {
  if (!reviewPolicy?.escalation_policy) {
    return ''
  }

  const policy = reviewPolicy.escalation_policy
  return `
### Failure matrix
- parse_failure / max_turns / timeout / process_error: follow \`review_policy.escalation_policy\` exactly; do not invent extra fallback rules
- state_doc_inconsistency: treat as an explicit failure kind, not as a generic warning
- ambiguous_revision: if you truly cannot classify major/minor, say so explicitly

### Oscillation boundary
- Oscillation patterns are defined in \`review_policy.escalation_policy.oscillation.patterns\`
- Oscillation threshold comes from \`review_policy.escalation_policy.oscillation.threshold\`
- Do not let Auto-Approval consecutive counts hide oscillation evidence
`
}

// ── Phase -1: Decompose ─────────────────────────────────

export function buildDecomposePrompt(userPrompt) {
  return `## 任务分解

用户需求：
${userPrompt}

请分析当前 codebase 状态，将需求分解为可独立执行的 iteration 列表。

### 步骤
1. 读取 CLAUDE.md、docs/ITERATIONS.md、当前代码状态
2. 每个 iteration 应该是一个可独立验证的工作单元
3. 识别 iteration 之间的依赖关系（哪个必须先做）
4. 确定合理的执行顺序
5. 估算每个 iteration 的规模（small / medium / large）
6. 为每个 iteration 定义预期的验证方式

### 输出格式（严格要求）

重要：不要创建文件。不要写入磁盘。你的最终回复文本必须直接包含以下 JSON。
这是 CLI 管道调用，只有你回复文本中的内容会被解析。

在你的最终回复中，输出且仅输出以下格式的 JSON（包裹在 \`\`\`json 代码块内）：

\`\`\`json
{
  "analysis": "对需求的整体理解和分解思路",
  "iterations": [
    {
      "title": "简短 kebab-case 标题",
      "requirement": "详细需求描述（自包含）",
      "scope": "small | medium | large",
      "depends_on": [],
      "resolves_goals": [0],
      "validation_approach": "预期的验证方式和命令"
    }
  ],
  "execution_order": [0, 1, 2],
  "risks": ["可能导致 spawn 新 iteration 的风险点"]
}
\`\`\`

你可以先用工具读取文件分析 codebase，但最终回复必须包含上述 JSON 结构。
`
}

// ── Phase 1: Planning (Codex) ───────────────────────────

export function buildPlanningPrompt(iterationId, spec, options = {}) {
  const mode = options.mode === 'refine' ? 'refine' : 'create'
  const modeDescription = mode === 'refine'
    ? '基于既有草稿补完/重写合同'
    : '新建合同'

  return `## Iteration ${iterationId} — 生成计划

请为以下需求创建 iteration 计划。

### 需求
标题：${spec.title}
描述：${spec.requirement}

### Planning 模式
- 当前模式：${mode}
- 模式说明：${modeDescription}

### 任务
1. 分析 codebase 确定影响范围
2. ${mode === 'refine'
    ? `先读取现有 docs/iterations/${iterationId}/plan.md 与 resolution.md，识别 scaffold 和缺口`
    : `从空白 iteration 合同开始撰写 docs/iterations/${iterationId}/plan.md 与 resolution.md`}
3. 生成 docs/iterations/${iterationId}/plan.md（WHAT/WHY，无步骤）
4. 生成 docs/iterations/${iterationId}/resolution.md（HOW，含 Step 编号、文件清单、验证命令、回滚方案）
5. plan.md 和 resolution.md 必须自包含，无上下文读者可理解

### 约束
- 遵循 CLAUDE.md 的 HARD_RULES、CAPABILITY_TIERS、WORKFLOW
- Phase 1 严禁写实现代码
- 只生成 plan.md 和 resolution.md 两个文件
- resolution.md 每个 Step 必须有可执行验证命令

### 完成后
输出以下 JSON 确认：

\`\`\`json
{
  "execution_summary": "计划生成完成",
  "files_changed": ["docs/iterations/${iterationId}/plan.md", "docs/iterations/${iterationId}/resolution.md"],
  "steps_completed": [{"step": 1, "status": "pass", "description": "plan.md generated"}, {"step": 2, "status": "pass", "description": "resolution.md generated"}]
}
\`\`\`
`
}

// ── Phase 2: Review Plan (Claude Code) ──────────────────

export function buildPlanReviewPrompt(iterationId, isFollowUp, options = {}) {
  const context = isFollowUp
    ? `Codex 已根据你之前的意见修改了计划。请重新评审。`
    : `请对 iteration ${iterationId} 的计划进行首次评审。`
  const policyContext = formatReviewPolicyContext(options.review_policy, options.risk_profile)
  const escalationBoundaryContext = formatEscalationBoundaryContext(options.review_policy)

  return `## Iteration ${iterationId} — Plan Review

${context}

${policyContext}

${escalationBoundaryContext}

### 步骤
1. 读取 docs/iterations/${iterationId}/plan.md
2. 读取 docs/iterations/${iterationId}/resolution.md
3. 对照 CLAUDE.md 约束评审：
   - HARD_RULES 合规性
   - CAPABILITY_TIERS: tier 1 vs tier 2 边界正确
   - MODEL_ID_REGISTRY: model 放置正确
   - PIN_SYSTEM: 数据流向正确
   - WORKFLOW: plan/resolution 格式正确
4. 检查 resolution.md 每个 Step 是否有可执行验证命令
5. 评估 scope 是否合理

### 重要约束
- 不要使用 /code-review skill（会导致超时）
- 只审查 plan.md 和 resolution.md 两个文件，不要审查仓库其他代码
- 保持审查聚焦、简洁

### 输出格式（严格要求）

重要：你的最终回复文本必须直接包含以下 JSON。不要只输出文字总结。

Verdict: APPROVED 或 Verdict: NEEDS_CHANGES

\`\`\`json
{
  "verdict": "APPROVED 或 NEEDS_CHANGES",
  "revision_type": "major 或 minor 或 ambiguous",
  "revision_type_rationale": "为什么判定为此类型",
  "blocking_issues": [],
  "suggestions": [],
  "conformance_check": {
    "tier_boundary": "pass 或 fail 或 n/a",
    "model_placement": "pass 或 fail 或 n/a",
    "data_ownership": "pass 或 fail 或 n/a",
    "data_flow": "pass 或 fail 或 n/a",
    "data_chain": "pass 或 fail 或 n/a"
  },
  "spawned_iterations": [],
  "summary": "一句话总结"
}
\`\`\`

revision_type 判定规则：
- **major**：scope 不合理、验证命令缺失或不可执行、关键约束遗漏
- **minor**：格式/措辞问题，plan/resolution 基本正确但有小瑕疵
- **ambiguous**：仅当你无法判断问题是否影响交付完整性时才使用，绝大多数情况应能明确判定 major 或 minor
`
}

// ── Revision prompt (Codex) ─────────────────────────────

export function buildRevisionPrompt(iterationId, reviewOutput) {
  return `## Iteration ${iterationId} — 修改计划

Claude Code 评审意见如下，请据此修改 plan.md 和 resolution.md：

### 评审结果
${JSON.stringify(reviewOutput, null, 2)}

### 任务
1. 修复所有 blocking_issues
2. 考虑 suggestions（可选）
3. 重新写入 docs/iterations/${iterationId}/plan.md 和 resolution.md
4. 保持自包含性

### 约束
- Phase 1 严禁写实现代码
- 只修改 plan.md 和 resolution.md

### 完成后
输出 JSON 确认（同 planning 格式）。
`
}

// ── Phase 3: Execution (Codex) ──────────────────────────

export function buildExecutionPrompt(iterationId) {
  return `## Iteration ${iterationId} — 执行实施

请严格按照 docs/iterations/${iterationId}/resolution.md 逐步执行。

### 规则
1. 读取 resolution.md 获取所有 Step
2. 按 Step 顺序逐一执行，不得跳步
3. 每个 Step 执行后运行其验证命令
4. 验证失败必须修复后重新验证
5. 将真实执行证据追加到 docs/iterations/${iterationId}/runlog.md
6. 在分支 dropx/dev_${iterationId} 上工作
7. 每个 Step 完成后 git commit

### 约束
- 遵循 CLAUDE.md 的 HARD_RULES、CAPABILITY_TIERS
- 副作用只通过 add_label / rm_label
- UI 是投影，不是 truth source
- fill-table-first: 能用模型定义解决的不改 runtime

### 完成后
输出以下 JSON：

\`\`\`json
{
  "execution_summary": "执行完成的概述",
  "steps_completed": [
    {"step": 1, "status": "pass", "description": "...", "evidence": "...", "commit": "..."}
  ],
  "files_changed": ["..."],
  "validation_results": [
    {"command": "...", "result": "pass", "output_snippet": "..."}
  ],
  "spawned_iterations": []
}
\`\`\`
`
}

// ── Phase 3 Review: Exec Review (Claude Code) ───────────

export function buildExecReviewPrompt(iterationId, isFollowUp, options = {}) {
  const context = isFollowUp
    ? `Codex 已根据你之前的意见进行了修复。请重新审查。`
    : `请对 iteration ${iterationId} 的执行结果进行审查。`
  const policyContext = formatReviewPolicyContext(options.review_policy, options.risk_profile)
  const escalationBoundaryContext = formatEscalationBoundaryContext(options.review_policy)

  return `## Iteration ${iterationId} — Execution Review

${context}

${policyContext}

${escalationBoundaryContext}

### 审查范围（严格限定）

只审查本 iteration 的交付物。不要审查仓库中其他未相关的代码。

### Turn 预算
你有约 10 次工具调用机会。请严格控制：
- 读取 resolution.md + runlog.md（2 次）
- 检查 1-3 个关键交付文件（1-3 次）
- 运行最多 1 个验证命令（1 次）
- 最后一轮必须输出 verdict JSON（不使用工具）
不要逐行审查每个文件。聚焦于"resolution 里的 Step 是否完成"。

### 步骤
1. 读取 docs/iterations/${iterationId}/resolution.md 了解预期步骤和验收标准
2. 读取 docs/iterations/${iterationId}/runlog.md 了解已有执行记录
3. 检查关键交付文件是否存在且内容合理（不需要逐行审查）
5. 如果 resolution 中有验证命令，运行它们
6. 评估是否符合 CLAUDE.md 合规要求（tier boundary / model placement / data flow）

### 重要约束
- 不要使用 /code-review skill（会导致超时）
- 不要审查 orchestrator 实现代码本身（除非本 iteration 的 scope 就是修改 orchestrator）
- 只关注本 iteration 的 resolution steps 是否被正确完成
- 保持审查聚焦、简洁

### 输出格式（严格要求）

重要：你的最终回复文本必须直接包含以下 JSON。不要只输出文字总结。

Verdict: APPROVED 或 Verdict: NEEDS_CHANGES

\`\`\`json
{
  "verdict": "APPROVED 或 NEEDS_CHANGES",
  "revision_type": "major 或 minor 或 ambiguous",
  "revision_type_rationale": "为什么判定为此类型",
  "blocking_issues": [],
  "suggestions": [],
  "conformance_check": {
    "tier_boundary": "pass 或 fail 或 n/a",
    "model_placement": "pass 或 fail 或 n/a",
    "data_ownership": "pass 或 fail 或 n/a",
    "data_flow": "pass 或 fail 或 n/a",
    "data_chain": "pass 或 fail 或 n/a"
  },
  "spawned_iterations": [],
  "summary": "一句话总结"
}
\`\`\`

revision_type 判定规则：
- **major**：Step 未完成、交付文件缺失、内容与 resolution 不符、验证命令失败
- **minor**：格式/措辞/排版问题，内容基本正确但有小瑕疵
- **ambiguous**：仅当你无法判断问题是否影响交付完整性时才使用，绝大多数情况应能明确判定 major 或 minor
`
}

// ── Fix prompt (Codex) ──────────────────────────────────

export function buildFixPrompt(iterationId, reviewOutput) {
  return `## Iteration ${iterationId} — 修复执行问题

Claude Code 审查发现以下问题，请修复：

### 审查结果
${JSON.stringify(reviewOutput, null, 2)}

### 任务
1. 修复所有 blocking_issues
2. 重新运行相关验证命令
3. 更新 docs/iterations/${iterationId}/runlog.md 记录修复
4. git commit 修复

### 完成后
输出 JSON（同 execution 格式）。
`
}

// ── Final Verification ──────────────────────────────────

export function buildFinalVerifyPrompt(primaryGoals, completedIterations) {
  const goalsText = primaryGoals
    .map((g, i) => `Goal ${i}: ${g.description}`)
    .join('\n')

  const iterationsText = completedIterations
    .map(i => `- ${i.id}: ${i.spec.title} (${i.status})`)
    .join('\n')

  return `## Final Verification Gate

以下是本次批量执行的原始目标：
${goalsText}

以下是已完成的所有 iteration：
${iterationsText}

### 任务
逐一验证每个原始目标是否在当前代码状态下得到满足。

### 验证方式
1. 读取相关代码文件
2. 运行关联的验证命令
3. 检查 git diff 确认变更
4. 不要假设"iteration 完成 = 目标满足"——检查是否存在回归或遗漏

### 输出格式
\`\`\`json
{
  "all_goals_met": true/false,
  "goal_results": [
    {
      "goal_index": 0,
      "goal_description": "...",
      "status": "met 或 partially_met 或 not_met 或 regressed",
      "evidence": "具体证据（测试结果、代码引用）",
      "validation_commands_run": [
        {"command": "...", "result": "pass 或 fail", "output_snippet": "..."}
      ],
      "remediation": "如果未满足，建议的修复方式"
    }
  ],
  "new_issues": ["验证过程中发现的新问题"]
}
\`\`\`
`
}

// ── Helpers ─────────────────────────────────────────────

export function readIterationDoc(iterationId, filename) {
  const path = join(process.cwd(), 'docs', 'iterations', iterationId, filename)
  if (!existsSync(path)) return null
  return readFileSync(path, 'utf-8')
}
