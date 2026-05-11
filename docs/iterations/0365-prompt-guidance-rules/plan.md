---
title: "0365 Prompt Guidance Rules Plan"
doc_type: iteration_plan
status: approved
updated: 2026-05-10
source: ai
iteration: 0365-prompt-guidance-rules
---

# Iteration 0365-prompt-guidance-rules Plan

## Goal

- Rework the repository's AI collaboration rule-writing guidance using current OpenAI official prompting guidance as source input.
- Make HTML / visualized artifacts an explicit opt-in or purpose-bound output, not the default delivery format.
- Publish a user-facing guide, including an explicitly requested HTML version, so future work can reuse the same decision rules.

## Scope

- In scope:
- Add a rule-writing method to the authoritative collaboration layer.
- Update repo-local collaboration guidance so future instructions distinguish invariants, decision rules, and preferences.
- Update execution governance with source-backed prompt/rule authoring policy.
- Add a user guide that explains the revised method and artifact boundary.
- Add a self-contained HTML guide because this iteration explicitly asks for `user-guide(html)`.
- Register the iteration and record verification evidence.
- Out of scope:
- Runtime behavior changes, ModelTable semantics changes, deployment changes, prompt execution code, and automated eval infrastructure.
- Making HTML the default response or documentation format.
- Changing existing hard safety rules, remote-ops prohibitions, ModelTable SSOT requirements, or PASS/FAIL verification requirements.

## Invariants / Constraints

- `CLAUDE.md` remains the highest-priority repo instruction source.
- True hard constraints keep absolute wording where they define safety, data ownership, workflow gates, or forbidden operations.
- Judgment calls are written as conditional decision rules with stop conditions and verification expectations.
- HTML artifacts are allowed only when visualized / interactive documentation is useful or when the user explicitly asks for HTML.
- User-facing documentation stays plain and accessible; implementation and verification remain rigorous.
- No runtime code or deployment path changes in this iteration.

## Success Criteria

- OpenAI official sources are cited in the new guidance.
- The repo contains an explicit rule-writing method covering invariants, decision rules, preferences, examples, and verification.
- HTML artifact guidance says Markdown/text is default and HTML is purpose-bound or explicitly requested.
- User guide index links to the new guidance.
- The HTML guide is syntactically present, self-contained, and loads in a browser.
- Verification commands record PASS/FAIL evidence in `runlog.md`.

## Inputs

- Created at: 2026-05-10
- Iteration ID: 0365-prompt-guidance-rules
- User direction: do not treat HTML as the main improvement path; use HTML only for visualized / interactive docs or explicit HTML requests; base the rule-writing update on official OpenAI prompting best practices.
- Official source set:
  - OpenAI API Prompt guidance: `https://developers.openai.com/api/docs/guides/prompt-guidance`
  - OpenAI API Prompt engineering: `https://developers.openai.com/api/docs/guides/prompt-engineering`
  - OpenAI Help Center ChatGPT prompt engineering best practices: `https://help.openai.com/en/articles/10032626-prompt-ingineering-best-practices-for-chatgpt`
  - OpenAI API Reasoning best practices: `https://developers.openai.com/api/docs/guides/reasoning-best-practices`
  - OpenAI API Prompt caching: `https://developers.openai.com/api/docs/guides/prompt-caching`
  - OpenAI API Structured model outputs: `https://developers.openai.com/api/docs/guides/structured-outputs`
  - OpenAI Codex best practices / AGENTS.md guidance: `https://developers.openai.com/codex/learn/best-practices`, `https://developers.openai.com/codex/guides/agents-md`
