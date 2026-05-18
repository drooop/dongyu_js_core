---
title: "0381 - Cloud Deploy Snapshot Wait Plan"
doc_type: iteration-plan
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0381-cloud-deploy-snapshot-wait
id: 0381-cloud-deploy-snapshot-wait
phase: completed
---

# Iteration 0381-cloud-deploy-snapshot-wait Plan

## Goal

Prevent cloud deploy from reporting failure when the new UI Server pod is running but `/snapshot` is not reachable during the first few seconds after rollout.

## Scope

- Increase the pod exec retry window used by cloud deploy verification.
- Keep the verification strict: failure still fails deploy after the longer wait.
- Do not change runtime behavior.

## Success Criteria

- Cloud deploy source/hash verification still runs.
- Snapshot verification has enough startup wait for the deployed UI Server.
- Targeted cloud deploy contract tests pass.
