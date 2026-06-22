---
title: "Iteration 0422 Cloud Deploy Healthcheck Plan"
doc_type: iteration-plan
status: completed
updated: 2026-06-23
source: ai
iteration_id: 0422-cloud-deploy-healthcheck
id: 0422-cloud-deploy-healthcheck
phase: completed
---

# Iteration 0422-cloud-deploy-healthcheck Plan

## Goal

Make cloud deployment verification match the current bootstrap snapshot contract, then redeploy the current `main` revision and capture remote latency evidence for the next snapshot-size/granularity iteration.

## Scope

- Replace the stale cloud deploy assertion for `llm_prompt_available` / `llm_prompt_notice`.
- Verify the current runtime health through stable bootstrap facts:
  - HTTP `/snapshot?profile=bootstrap` succeeds.
  - `timing.runtime_status` is `ready`.
  - Model 0 contains `sys_worker_id` and `sys_worker_role`.
  - Shell state contains `ws_apps_registry`.
- Redeploy cloud revision `5caf5a2`.
- Browser-test `https://app.dongyudigital.com/#/`.
- Record snapshot-size and resource-size observations for the next stage.

## Out Of Scope

- Redesign snapshot granularity.
- Change the SSO contract.
- Change UI model behavior.

## Verification

- `bash -n scripts/ops/deploy_cloud_full.sh`
- Remote pod execution of the same bootstrap snapshot health expression.
- `bash scripts/ops/deploy_cloud_full.sh --revision 5caf5a2 --rebuild` on the cloud server.
- Real browser check with Playwright CLI.

