---
title: "0394 Matrix Connection Check Script Plan"
doc_type: iteration-plan
status: completed
updated: 2026-05-26
source: codex
---

# 0394 Matrix Connection Check Script Plan

## Goal

Add a small Python diagnostic script that checks the current local Matrix connection with the deployed `drop` and `mbr` accounts.

## Scope

- Read local deployment credentials from `deploy/env/local.env` and `deploy/env/local.generated.env`.
- Discover the local Synapse homeserver URL from env or Kubernetes service data.
- List joined channels/rooms for `drop`.
- Send a text message from `drop` to the current `drop`/`mbr` DM room.
- Read the same message as `mbr`.
- Avoid printing access tokens or passwords.

## Acceptance

- Running the script against the current local deployment prints a PASS summary.
- The output includes channel count/list sample, send event id, and received message confirmation.
- The script works without extra Python packages.
