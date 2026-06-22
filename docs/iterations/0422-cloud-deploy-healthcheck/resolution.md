---
title: "Iteration 0422 Cloud Deploy Healthcheck Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-06-23
source: ai
iteration_id: 0422-cloud-deploy-healthcheck
id: 0422-cloud-deploy-healthcheck
phase: completed
---

# Iteration 0422-cloud-deploy-healthcheck Resolution

## Result

The cloud deployment script no longer fails on removed prompt-era labels. It now validates the current bootstrap snapshot by checking runtime readiness, worker identity labels, and the workspace app registry.

## Change

- Modified `scripts/ops/deploy_cloud_full.sh`.
- Replaced the old `llm_prompt_available` / `llm_prompt_notice` health assertion with current bootstrap checks.

## Verification

- `bash -n scripts/ops/deploy_cloud_full.sh`: PASS
- Remote pod bootstrap check: PASS
  - `runtime_status=ready`
  - `worker_role=DEM`
  - `registry_count=10`
  - `snapshot_bytes=154995`
- Full cloud deployment of revision `5caf5a2`: PASS
- Real browser remote desktop check: PASS

## Follow-up

The deploy path still revealed operational drift:

- Local DNS could not resolve `dongyudigital.com`; deployment used `drop@124.71.43.80`.
- The normal source-sync helper hit mixed ownership in the remote working tree. A controlled `git archive` overlay was used to sync the exact `main` revision.
- `deploy/env/cloud.env` was missing on the remote server and had to be restored from the current Kubernetes secret/default deployment values.

These are deployment hygiene issues, not runtime correctness failures. They should be cleaned up in a later ops iteration.

