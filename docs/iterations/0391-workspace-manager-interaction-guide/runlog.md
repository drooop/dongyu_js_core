---
title: "0391 Workspace Manager Interaction Guide Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-05-23
source: codex
---

# 0391 Workspace Manager Interaction Guide Runlog

## 2026-05-23

- Branch: `dropx/dev_0391-workspace-manager-interaction-guide`
- Scope: topic construction audit + Workspace Manager interaction guide.
- Topic audit result: PASS. Current implementation builds the full endpoint topic from Model 0 `mqtt_topic_base` plus endpoint labels (`provider_*` for bundle install, `remote_bus_endpoint_v1` + public pin for runtime egress). Full topic is a derived payload/status value, not the catalog truth.
- Change: added `docs/user-guide/slide-app-runtime/workspace_manager_interaction_guide.md`.
- Change: added optional `bundle_resource_uri` projection metadata for Workspace Manager asset rows.
- Verification:
  - `node scripts/tests/test_0391_workspace_manager_interaction_guide.mjs` -> PASS, 4/4.
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs` -> PASS, 5/5.
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs` -> PASS, 4/4.
  - `git diff --check` -> PASS.
