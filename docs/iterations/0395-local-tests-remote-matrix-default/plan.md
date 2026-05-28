---
title: "0395 Local Tests Remote Matrix Default Plan"
doc_type: iteration-plan
status: completed
updated: 2026-05-26
source: codex
---

# 0395 Local Tests Remote Matrix Default

## Goal

Local testing must use the remote Matrix server by default:

- Homeserver: `https://matrix.dongyudigital.com`
- Server name: `synapse.dongyudigital.com`
- Default users: `drop` and `mbr`

This applies to the local Matrix connection check and to local stack bootstrap values written into UI Server / MBR Model 0.

## Scope

- Update local env defaults and documentation comments so local testing points at the remote Matrix server.
- Update local deploy bootstrap so the Matrix labels written into Model 0 use the configured remote homeserver when present.
- Prevent old generated local Synapse tokens from being silently reused against the remote homeserver.
- Allow the Matrix connection check to create a temporary remote room when no test room is configured.

## Non-Goals

- Do not replace MQTT / control-bus local testing.
- Do not remove historical local Synapse manifests in this iteration.
- Do not change remote cloud deployment defaults.
- Do not add any fallback from remote Matrix back to local Synapse.

## Invariants

- ModelTable remains the truth source for UI Server / MBR runtime configuration.
- UI Server and MBR Matrix labels must be produced through bootstrap patch labels, not direct UI-side env reads.
- Secret values must not be printed in verification output.
- If remote Matrix login or room creation fails, the test must fail visibly.

## Success Criteria

- Deterministic tests prove local defaults no longer point at `localhost` / `ChangeMeLocal2026`.
- Deterministic tests prove deploy bootstrap can emit remote Matrix labels into `MODELTABLE_PATCH_JSON`.
- Real remote Matrix verification proves `drop -> mbr` message delivery through `https://matrix.dongyudigital.com`.
