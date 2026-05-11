---
title: "执行治理规范：AI 协作、review gate 与 artifact 边界"
doc_type: ssot
status: active
updated: 2026-05-10
source: ai
---

# 执行治理规范：AI 协作、review gate 与 artifact 边界

## Positioning

本文件定义本仓库中 AI 协作、sub-agent review、规约撰写和 artifact 使用的当前治理规则。

Authority:
- Below `CLAUDE.md`, `docs/architecture_mantanet_and_workers.md`, runtime semantics, label registry, and project charter.
- Above user-guide, prompt archive, old plans, handover, and iteration notes when the topic is AI execution governance.

Scope:
- AI 如何写规约、拆工作、请求 review、记录证据、选择 Markdown / HTML / artifact。
- It does not define runtime semantics, label semantics, PIN semantics, data-model semantics, or deployment topology.

Conflict behavior:
- If this file conflicts with `CLAUDE.md` or product SSOT, the higher source wins.
- If this file conflicts with `docs/WORKFLOW.md` on iteration phase names or completion rules, stop and realign both files through an iteration.
- If a historical prompt or handover gives different AI process instructions, treat it as archive.

## 1. Rule-Writing Method

Before writing a rule, classify it.

| Class | Use for | Writing style | Verification |
|---|---|---|---|
| Hard constraint | safety boundaries, data truth, workflow gates, forbidden operations, required evidence, schema fields | 可以使用“必须 / 禁止 / 不得 / MUST / NEVER” | define stop condition, failure behavior, or PASS/FAIL check |
| Decision rule | whether to search, ask, use a tool, spawn sub-agent, use HTML, expand verification | condition -> action -> stop condition -> evidence | show the condition and what changes the path |
| Preference | tone, report shape, default format, collaboration rhythm | default tendency + override condition | user instruction or local convention can override |

Writing rules:
- Put objective and success criteria before process details.
- Keep stable rules in `CLAUDE.md`, `AGENTS.md`, SSOT, or workflow docs; keep one-off facts in the user request or current iteration.
- When exact output shape matters, prefer a schema, field table, or concrete example over repeated emphasis.
- When quality matters, define a reproducible check or review criterion.
- Avoid process scripts like “first A, then B, then C” unless order is required for safety, auditability, or correctness.

## 2. Prompt And Artifact Sources

This method is based on the official OpenAI guidance recorded in iteration 0365:

- outcome-first prompts work better than process-heavy instruction stacks;
- clear context, examples, and reusable instructions improve stability;
- reasoning models prefer simple direct instructions and clear delimiters;
- structured outputs are better handled with schema than with repeated wording;
- Codex-style repository guidance should stay practical, short, and updated from repeated friction.

This file records the adopted rule-writing method. It is not a mirror of external docs.

## 3. HTML / Visualized Artifact Boundary

Default delivery format is Markdown or plain text.

Use HTML or another explicit artifact only when one of these conditions is true:

- the user explicitly asks for HTML;
- the document needs visualized explanation;
- the document needs interaction, filtering, comparison, export, or local exploration;
- an interactive/visual companion materially reduces misunderstanding.

HTML artifact status:

- HTML is a reading or interaction surface, not SSOT.
- Markdown or SSOT remains the long-lived rule source unless a higher-priority file explicitly promotes the HTML.
- If an HTML companion is updated, verify it in a browser before reporting completion.

## 4. Review Roles

The project historically used names like `ultrawork`, `doit`, and `doit-auto`. Current Codex work maps those into practical roles:

| Role | Current meaning | Allowed output | Not allowed |
|---|---|---|---|
| Reviewer / sub-agent | independent review of plan, docs, code, evidence, or risk | findings, decision, required changes, residual risk | silently changing the main branch, bypassing the owner |
| Executor | the main agent implementing an approved plan | edits, commands, verification, runlog | executing before gate approval when the workflow requires approval |
| Orchestrator | script or agent that advances a registered iteration | status updates, runlog records, ordered steps | marking Completed without PASS evidence |

Decision rule for sub-agent review:
- Use sub-agent review when the user asks for it, when a workflow gate requires independent review, or when the change is broad enough that a second pass is likely to catch real risk.
- Keep the review bounded. Ask for a decision, findings, required changes, and residual risk.
- If the decision is `CHANGE_REQUESTED`, fix the plan or implementation and re-review before crossing the gate.

## 5. Phase And Gate Rules

The authoritative phase model lives in `docs/WORKFLOW.md`. This file restates only the AI execution boundary:

- Planning gate: do not implement before the current iteration plan/resolution has the required approval.
- Execution gate: execute the approved resolution step by step and write real evidence to runlog.
- Completion gate: do not mark Completed until verification is PASS and runlog is auditable.

Major revision rule:

- A major revision changes scope, contract, validation, or risk boundary.
- A minor wording change does not count as a major revision.
- After repeated major revision failure, stop and ask for user or project-owner裁决 instead of guessing.

## 6. Roadmap And Status Updates

Roadmap and iteration status are state records, not brainstorming notes.

Rules:
- Completed work is not silently rewritten. Later work should supersede it explicitly.
- Planned or in-progress items can change when new evidence appears, but the reason should be recorded.
- A status change must point to evidence: plan, review decision, runlog, validation output, or commit.

## 7. Conflict Reporting

When a conflict blocks safe execution, report these fields:

- conflict type: semantic / workflow / permission / verification;
- conflicting paths;
- conflicting clauses or summaries;
- why execution cannot safely continue;
- who can decide: user / current iteration owner / higher SSOT update.

Stop conditions:

- a lower doc asks for an action prohibited by `CLAUDE.md`;
- a user-guide claims a legacy path is current but SSOT says it is removed;
- implementation would require runtime or deployment changes outside the approved scope;
- verification cannot produce PASS/FAIL evidence for a required claim.

## 8. Immediate Effect

New AI collaboration rules should follow this file plus `CLAUDE.md` and `docs/WORKFLOW.md`.

Historical prompts, old handovers, and deprecated convention files remain useful as context, but they do not override this governance chain.
