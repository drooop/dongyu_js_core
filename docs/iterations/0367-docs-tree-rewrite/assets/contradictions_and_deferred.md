---
title: "Iteration 0367 Contradictions And Deferred Items"
doc_type: audit_asset
status: completed
updated: 2026-05-10
owner: codex
source: ai
---

# Contradictions And Deferred Items

## Fixed In This Iteration

| Item | Resolution |
|---|---|
| `docs/README.md` did not list every docs bucket clearly. | Rewritten as a directory map with authority tiers and archive boundaries. |
| `docs/user-guide/README.md` mixed current guides, HTML, prompts, runbooks, and historical material in a flat list. | Rewritten as a classified index. |
| `docs/ai-work-conventions.md`, old root notes, handover, tmp, prompt, test, roadmap files looked active through frontmatter. | Status boundaries changed to deprecated / historical / archive / evidence / target as appropriate. |
| `docs/ssot/execution_governance_ultrawork_doit.md` used older role framing and decorative absolute-section formatting. | Rewritten around rule class, role boundaries, review gates, status updates, and artifact boundaries. |
| `docs/ssot/orchestrator_hard_rules.md` pinned review/execution to older specific tool names. | Reworded the top-level role mapping to current configured agents/sub-agents while preserving orchestrator state rules. |
| `docs/architecture_mantanet_and_workers.md` contained the unclear phrase `目标作者ing口径`. | Replaced with `目标编写口径`. |

## Deferred

No unresolved contradiction is currently deferred from active docs.

Historical docs still contain old names, older routes, and old prompt instructions by design. They are preserved as evidence/archive and must not be cited as current policy unless a later iteration promotes them.
