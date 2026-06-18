---
title: "Iteration 0416 — Post-Load Projection Latency Plan"
doc_type: iteration-plan
status: planned
updated: 2026-06-18
source: ai
iteration_id: 0416-post-load-projection-latency
id: 0416-post-load-projection-latency
phase: phase1
---

# Iteration 0416 — Post-Load Projection Latency Plan

## Metadata

- ID: `0416-post-load-projection-latency`
- Date: 2026-06-11
- Branch: `dropx/dev_0416-post-load-projection-latency`
- Status: Approved for implementation by user request
- Depends on:
  - `0414-snapshot-delta-sse`
  - `0415-reactive-projection-store`

## Goal

Improve loaded-state interaction latency by preventing large derived projection labels from being recomputed and pushed during ordinary business updates.

## Problem

Current local measurements show `/snapshot` is about 574 KB with 6235 labels. The actual `v` values are about 218 KB, while JSON label wrapper overhead is about 219 KB. The largest derived labels include:

- `home_table_rows_json` at about 40 KB.
- `ws_apps_registry` at about 3.7 KB.
- `editor_model_options_json` at about 1.9 KB.

The user has explicitly prioritized loaded-state responsiveness over first-screen speed. Therefore this iteration must not focus only on shrinking initial full snapshot. It must prevent ordinary post-load events from carrying large global derived fields or falling back to full snapshot.

## Invariants

- ModelTable remains the only business truth.
- UI remains projection only.
- Local/remote UI writes must still enter through the existing Model 0 / pin / program path.
- Local projection APIs must be read-only and derived from principal-filtered ModelTable data.
- Local projection APIs must not become a new truth source and must not automatically write labels.
- Existing UI model semantics must not be changed.
- No compatibility fallback path may be added for deprecated event or pin formats.
- `ws_apps_registry` remains a launcher index, but ordinary business responses must not refresh it unless the event changes app index state.

## Scoped Derived Labels

This iteration treats the following labels as expensive global derived labels:

- `home_table_rows_json`
- `editor_model_options_json`
- `ws_apps_registry`

Rules:

- `home_table_rows_json` and `editor_model_options_json` are Home / ModelTable editor local projections. They may be kept as stable labels for current UI contracts, but ordinary non-Home / non-ModelTable business events must not refresh them.
- `ws_apps_registry` is kept as a minimal launcher index. It may refresh only for app index events such as install, import, delete, mount, unmount, rename, or source catalog refresh.
- Any detailed app metadata must be projected on demand instead of bloating the always-on registry.

## Patch Contract

After initial load, ordinary business events must satisfy:

- SSE event type is `snapshot_patch`, not full `snapshot`.
- Patch payload must not contain `home_table_rows_json`.
- Patch payload must not contain `editor_model_options_json`.
- Patch payload must not contain `ws_apps_registry` unless the triggering event is app-index-related.
- Patch payload target size is `<= 32 KB`.
- If a patch would exceed the limit, the system must record an observable reason and avoid silent full snapshot fallback where a local projection split is possible.

Allowed full snapshot cases:

- Initial page load.
- SSE reconnect without usable base sequence.
- Patch sequence mismatch.
- Principal / permission visibility change.
- Server baseline missing.
- Patch too large and cannot be safely split.
- Explicit manual refresh.

## In Scope

- Add tests that prove ordinary events do not carry large derived labels.
- Add tests that app-index events still update `ws_apps_registry`.
- Add patch size / ops observability for runlog and tests.
- Adjust server derived projection writes so ordinary updates do not refresh expensive fields.
- Keep server and local demo mode behavior aligned where equivalent code paths exist.
- Browser-test loaded interactions after local deploy.

## Out of Scope

- Full scoped first-frame protocol.
- Dictionary encoding for full snapshot.
- Large frontend bundle splitting.
- Redesigning ModelTable editor UI.
- Changing sliding app authoring syntax.

## Success Criteria

- Deterministic tests prove ordinary RemoteWorker response / ordinary bus event does not patch `home_table_rows_json`, `editor_model_options_json`, or non-index `ws_apps_registry`.
- Deterministic tests prove app install/import/delete/index refresh still updates minimal `ws_apps_registry`.
- Deterministic tests prove patch stats expose bytes and op count.
- `0412`, `0414`, and `0415` regression tests remain green.
- Browser verification after local deploy confirms:
  - Desktop opens.
  - To Do Board opens.
  - E2E color generator still changes color.
  - ModelTable/Home projection still displays required lists when opened.
  - Continuous input remains locally responsive.
  - No outer horizontal or vertical page scroll.
- Every implementation stage is reviewed by a sub-agent using `codex-code-review`, and review findings are fixed before moving on.

## Risks

- Existing tests directly read the old derived labels; removing them outright would break contracts.
- `ws_apps_registry` is used by the launcher; over-filtering it would hide installed apps.
- A local projection endpoint can accidentally bypass principal filtering if it reads raw runtime snapshot.
- Server and local demo mode can diverge if only `server.mjs` is changed.

## Decision

Proceed with a conservative loaded-state latency iteration: keep existing visible behavior, but gate expensive derived label refreshes by event scope and add explicit tests for patch contents and size observability.
