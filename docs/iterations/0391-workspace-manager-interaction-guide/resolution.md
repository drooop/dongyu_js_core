---
title: "0391 Workspace Manager Interaction Guide Resolution"
doc_type: iteration-resolution
status: active
updated: 2026-05-23
source: codex
---

# 0391 Workspace Manager Interaction Guide Resolution

## Implementation

1. Audit topic construction in server implementation and SSOT/user-guide docs.
2. Write a developer-facing guide for interacting with Workspace Manager.
3. Add deterministic documentation checks for required field names and topic formulas.
4. Run relevant existing provider-owned install contract checks.

## Verification

- `node scripts/tests/test_0391_workspace_manager_interaction_guide.mjs`
- `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
- `git diff --check`

## Rollback

Revert the guide, README index entry, 0391 iteration docs, and the 0391 documentation test.
