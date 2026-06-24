---
title: "Iteration 0427 Cloud Source Owner Doc Fix Plan"
doc_type: iteration-plan
status: completed
updated: 2026-06-24
source: ai
iteration_id: 0427-cloud-source-owner-doc-fix
id: 0427-cloud-source-owner-doc-fix
phase: completed
---

# Iteration 0427-cloud-source-owner-doc-fix Plan

## Goal

Correct the cloud source sync documentation after 0426 remote deploy evidence
showed `/home/wwpic/dongyuapp` is currently owned by `drop:drop`, not
`wwpic`. Operators should use `--remote-repo-owner drop` for the current cloud
host unless they first verify that the directory owner has changed.

## Scope

- In scope:
- Update current deployment runbooks and address records that instruct
  `--remote-repo-owner wwpic` for `/home/wwpic/dongyuapp`.
- Record the verification command used to establish the current owner.
- Keep this iteration docs-only.
- Out of scope:
- Runtime code, deploy script defaults, Kubernetes manifests, remote filesystem
  ownership, or remote deployment.
- Historical plan files that preserve old decisions or snapshots.

## Invariants / Constraints

- Do not change runtime behavior.
- Do not mutate remote server state.
- Do not make owner assumptions without documenting how to verify them.

## Success Criteria

- Current deployment docs use `--remote-repo-owner drop` for the canonical
  cloud source sync path.
- Docs explain why: current remote repo path is `/home/wwpic/dongyuapp`, but
  its filesystem owner is `drop:drop`.
- Docs include a validation command for checking the owner if the environment
  changes.
- `rg` shows no current runbook command still instructs `--remote-repo-owner
  wwpic` for the active cloud path.
- `git diff --check` and Obsidian docs audit pass.

## Inputs

- Created at: 2026-06-24
- Iteration ID: 0427-cloud-source-owner-doc-fix
