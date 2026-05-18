---
title: "0381 - Cloud Deploy Snapshot Wait Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0381-cloud-deploy-snapshot-wait
id: 0381-cloud-deploy-snapshot-wait
phase: completed
---

# Iteration 0381-cloud-deploy-snapshot-wait Resolution

## Implementation

- Change `deploy_cloud_full.sh` UI Server pod exec helper default retry count from 8 to 30.
- Change `deploy_cloud_app.sh` pod exec helper to use `POD_EXEC_MAX_ATTEMPTS`, defaulting to 30.

## Verification

- `node scripts/tests/test_0200_cloud_loader_chain_contract.mjs`
- `node scripts/tests/test_0349_remote_deploy_sync_contract.mjs`
- `git diff --check`

## Rollback

- Restore the previous retry count if the longer wait hides a real failure. The command still fails after the retry budget, so no runtime rollback is needed.
