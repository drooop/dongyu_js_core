---
id: 0373
title: fast-static-doc-deploy
doc_type: iteration_plan
status: Completed
updated: 2026-05-12
source: ai
branch: dropx/0373-fast-static-doc-deploy
created_at: 2026-05-12
iteration_id: 0373-fast-static-doc-deploy
phase: phase1
---

# Iteration 0373 Fast Static Doc Deploy Plan

## Goal

- Commit and publish the latest Minimal Submit docs to `dev` and `main`, then deploy the interactive HTML to remote UI Server statics through a faster docs/static-only path.

## Scope

- In scope:
- Add a cloud public docs fast deploy script.
- Document the optimized process.
- Add deterministic tests for the fast path.
- Merge/push `dev` and `main`.
- Run the remote docs/static deploy and verify public access.
- Out of scope:
- Runtime code changes, system model refills, Docker image rebuilds, K8s rollout changes, MBR/remote-worker behavior changes.

## Invariants / Constraints

- The fast path is only valid for docs/static-only changes.
- It must not run Docker build, image import, or K8s rollout restart.
- It must keep remote source revision traceability through `sync_cloud_source.sh`.
- It must place `minimal_submit_app_provider_interactive.html` under the UI Server persisted Static project.
- It must not use any forbidden remote operations from `CLAUDE.md`.

## Success Criteria

- New fast deploy script and docs are committed.
- `dev` and `main` are pushed to remote.
- Remote static URL serves the updated interactive HTML:
  - `https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/`
  - `https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/minimal_submit_app_provider_interactive.html`
- Playwright confirms the remote page contains the "提交按钮" panel.
- Deterministic tests pass.
- Iteration evidence is recorded in `runlog.md`.

## Inputs

- Created at: 2026-05-12
- Iteration ID: 0373-fast-static-doc-deploy
