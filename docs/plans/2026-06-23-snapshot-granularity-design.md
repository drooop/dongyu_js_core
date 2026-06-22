---
title: "Snapshot Granularity And Responsive Projection Design"
doc_type: plan
status: draft
updated: 2026-06-23
source: ai
id: 2026-06-23-snapshot-granularity-design
---

# Snapshot Granularity And Responsive Projection Design

## Goal

Reduce first-screen wait and later UI update cost by making the startup snapshot truly minimal, loading app/model bodies only when needed, and applying later changes at label/model granularity.

This design does not change ModelTable truth ownership. It only changes what the UI Server sends to a browser, when it sends it, and how the browser applies it.

## Current Facts

- Remote browser measurement on 2026-06-23:
  - JS bundle: about `2.06MB`.
  - CSS bundle: about `379KB`.
  - `/snapshot?profile=bootstrap&initial_projection=1`: about `155KB`, about `1.0s` to `1.4s`.
- The project already has useful primitives:
  - `/snapshot?profile=bootstrap|visible|full`.
  - `/snapshot?profile=visible&model_id=...` for lazy model body loading.
  - `/stream?profile=bootstrap&visible_model_id=...` for profile-scoped SSE.
  - `snapshot_patch` with `snapshot_seq` / `base_snapshot_seq`.
  - A frontend `projectionStore` with label-level atoms.
- The current `bootstrap` is smaller than `full`, but still carries more than the first paint strictly needs. The next improvement should not invent a new truth layer. It should tighten the existing client-visible profile boundary.

## Assumptions

- The first screen only needs shell state, login/read-only status, desktop route, display preference, and a compact app index.
- Opening an app is allowed to show a short loading state while that app model body is fetched.
- App list cards do not need full app model bodies; they only need compact metadata such as title, summary, source/provider, built-in/slid-in classification, install/open status, and route target.
- `full` remains available only for explicit human-triggered diagnostics. Automatic startup, app opening, SSE recovery, patch mismatch recovery, and oversize fallback must not request `full`.

## Approach Options

### Option A: Keep Current Data Shape And Add Metrics Only

This is lowest risk, but it will not materially improve first-screen latency. It can tell us why bootstrap is large, but it leaves the browser waiting for the same payload.

### Option B: Tighten Existing Profiles And Use Label/Model Projection

This keeps the existing endpoint family and hardens their semantics:

- `bootstrap` becomes a true first-paint profile.
- `visible` loads only requested app/model bodies.
- `snapshot_patch` remains profile-scoped.
- The frontend renders shell and app list from compact index data, then loads app bodies on demand.

This is the recommended approach because it matches the current code direction and avoids a new data protocol.

### Option C: Add A Query/Subscription Protocol

For example, the browser could request arbitrary label selectors and subscribe to those selectors. This is flexible, but it duplicates the current profile/visible model system, increases authorization risk, and is too early for this project stage.

## Recommended Design

Use Option B.

The work is a contract tightening, not a new feature surface:

1. Define a strict `bootstrap` payload budget and allowlist.
2. Move non-first-paint data out of `bootstrap`.
3. Keep compact app metadata in `bootstrap`.
4. Fetch app/model bodies only through `visible`.
5. Keep SSE updates scoped to the profile and visible model set.
6. Apply frontend updates through label/model projection caches instead of re-rendering from a large reactive snapshot object.

## Snapshot Profile Contract

### `bootstrap`

Purpose: paint the tablet desktop shell and app launcher as quickly as possible.

Allowed content:

- Model 0 root labels required to show runtime identity and readiness.
- Shell/editor state root labels required for:
  - current route,
  - desktop view mode,
  - selected/foreground app id,
  - compact app index,
  - user/read-only display state.
- Compact desktop app index.
- Minimal catalog metadata needed to render built-in and slid-in app cards.

Disallowed content:

- Positive app model bodies.
- Full model editor option lists.
- Full table row data for model table editor.
- Debug timelines, traces, terminal history, Matrix room lists, or app-internal state.
- Large nested markdown/html/doc bodies.
- Secrets or transport credentials.

Target budget:

- Local deterministic budget: `bootstrap` serialized body should be at most `90KB` and at most `55%` of `full`.
- Remote target: reduce the current about `155KB` bootstrap toward `80KB` or less.
- If the first implementation cannot hit `80KB`, it must produce a byte-by-model and byte-by-label report showing the remaining top contributors.

### `visible`

Purpose: load the body of one or more currently opened app/model instances.

Allowed content:

- The `bootstrap` minimal shell.
- Only the requested positive model bodies that are visible to the current principal.
- Data needed by the active app window and its current local route.

Disallowed content:

- Other positive app model bodies.
- Models visible to another user/principal.
- Management/debug models unless the current user has the required capability.

Target behavior:

- Opening an app calls `ensureVisibleModelLoaded(model_id)`.
- The app window shows a loading block until that model body arrives.
- If the model is not visible or no longer installed, the UI shows a clear error instead of silently falling back to `full`.

### `full`

Purpose: explicit diagnostics only.

Rules:

- Startup must not request `full`.
- Normal app opening must not request `full`.
- Patch mismatch, SSE reconnect, oversize patch, missing model, and permission-change recovery must not request `full`.
- `full` requests should be observable in tests and browser traces because they indicate manual diagnostics or an implementation bug.

## Compact App Index

The current app registry should be split conceptually into:

- `app_index`: first-paint list data.
- `app_detail`: optional metadata used by details drawers/dialogs.
- `app_model_body`: the actual model body, loaded by `visible`.

`bootstrap` should carry only `app_index`.

Recommended app index fields:

- `model_id`
- `title`
- `summary`
- `kind`: `built_in` or `slid_in`
- `provider_name`
- `provider_de_id`
- `source_worker_id`
- `source_model_id`
- `installed_state`
- `open_route`
- `sort_order`
- `updated_at` if already available without extra query cost

Workspace Manager install/remove requirements:

- Installing a slide app must update the compact app index through ModelTable state, then the browser receives a `bootstrap`-profile patch for the app index.
- Removing a slide app must remove or mark the entry in the compact app index, then the browser receives a `bootstrap`-profile patch.
- The newly installed app's model body must still be loaded through `visible` on first open. Installation success must not smuggle the full app model body into `bootstrap`.
- Guest/read-only users may see installable or installed app metadata only if it is permitted by current capability rules; actions such as install/remove must remain disabled or rejected unless the principal has the required capability.

Fields that should move out of first paint:

- full install bundle details,
- route history,
- full docs/html bodies,
- model table row dumps,
- Matrix room/member lists,
- per-app internal status that is not shown on the desktop card.

## Server Design

### Profile Compiler

Refactor `buildClientSnapshotProfile` into an explicit profile compiler:

- Input:
  - full client-safe snapshot after principal/capability filtering,
  - profile name,
  - visible model ids,
  - optional projection level.
- Output:
  - client-visible snapshot,
  - profile metadata,
  - profile size stats.

The compiler must apply filters in this order:

1. Principal/capability filtering.
2. Profile model allowlist.
3. Profile label allowlist.
4. Value sanitization.
5. Size statistics.

This order matters because size and patch statistics must describe what the browser is actually allowed to see.

### Size Statistics

Add diagnostic stats to snapshot responses, at least in development/test mode and optionally in production behind a safe flag:

- total serialized bytes,
- bytes by model id,
- bytes by cell,
- top label contributors,
- profile name,
- visible model ids,
- dropped model count,
- dropped label count.

This gives the next optimization step concrete targets instead of guessing.

### Patch Scope

Each SSE client baseline is keyed by:

- principal key,
- profile name,
- visible model id set,
- profile compiler version.

Patch generation must diff only the already-filtered profile snapshot. A client subscribed to `bootstrap` cannot receive patches for an unopened app model. A client subscribed to app A cannot receive app B body changes.

Patch budget:

- `bootstrap` patch target: under `8KB`.
- single visible app patch target: under `32KB`.
- oversize fallback: profile-scoped snapshot reset, not implicit `full`.

## Frontend Design

### Startup

Startup should do:

1. Fetch `/snapshot?profile=bootstrap&initial_projection=1`.
2. Render shell and app launcher from compact app index.
3. Open `/stream?profile=bootstrap`.
4. Do not fetch app bodies until the user opens an app or the route requires one.

The UI should never block desktop first paint on app model bodies.

### Opening An App

When a user opens an app:

1. Add the app model id to the visible set.
2. Fetch `/snapshot?profile=visible&model_id=<id>`.
3. Merge that model into the existing client cache.
4. Reconnect SSE to `/stream?profile=bootstrap&visible_model_id=<id>`.
5. Render the app body.

If multiple apps are open, the visible model id set may include multiple ids.

### Closing Or Backgrounding An App

Initial implementation should keep loaded app models warm for the current browser session. This avoids route thrash and repeated network fetches.

Later optimization can add a release policy:

- keep the last N app models,
- or release a model after a TTL,
- or release only when memory pressure is observed.

This should not be part of the first implementation unless measurements show memory growth is already a problem.

### Responsive Projection Cache

The frontend should increasingly render from projection atoms instead of directly reading the large reactive `snapshot` object.

Required behavior:

- Components that read a single label should subscribe to that label atom.
- App cards should subscribe only to compact app index atoms, not full app bodies.
- App window content can subscribe to labels inside that app model.
- Applying a patch for one label should not force unrelated app cards or hidden app windows to re-render.
- Overlay values still win over committed projection values during local editing.

This keeps the UI responsive after initial load and makes patch size improvements visible to the user.

## Loading And Blocking UX

The user-facing rule should be:

- Shell startup: show desktop skeleton only until bootstrap arrives.
- App opening: block only that app window/card with a loading state.
- Formal submit: block the affected action/window until the matching visible committed state confirms completion.
- Non-formal transient UI state should stay browser-local unless the UI model explicitly asks for synchronization. Examples include input typing drafts, temporary dialog visibility, local tab switches, and drawer open/close states that are not part of shell route or formal business state.
- ModelTable-driven shell state remains committed state. Examples include desktop route, foreground app, installed app index, and actions that change persistent app/workspace state.

This preserves correctness without making every local interaction wait for ModelTable persistence.

## Failure And Recovery

- Invalid profile or model id: fail closed with a typed error.
- Missing app model: show “app no longer available” and refresh compact app index.
- Patch base mismatch: fetch the exact same profile key again, not `full`.
  - For bootstrap-only clients, this means `profile=bootstrap`.
  - For clients with open apps, this means `profile=bootstrap` plus the same sorted `visible_model_id` set that defined the failed SSE baseline.
  - Recovery must preserve the visible model set unless a specific visible model is rejected as stale or unauthorized; in that case, remove only that rejected model id, refresh compact app index, and keep the remaining visible model ids.
- Permission change: send explicit profile reset.
- SSE reconnect: reconnect with the current profile and visible model set.
- Oversize patch: send profile-scoped snapshot reset with `fallback_reason`.

## Verification Plan

### Deterministic Tests

Add or extend tests to prove:

- Startup requests `bootstrap`, never bare `/snapshot` or `full`.
- `bootstrap` excludes all positive app model bodies.
- `bootstrap` excludes known heavy labels such as model editor row dumps and full docs/html bodies.
- `bootstrap` size is below the agreed budget.
- App opening fetches `visible&model_id=<id>`.
- Visible fetch does not delete already loaded visible models.
- SSE patch for app A does not include app B.
- Patch base mismatch recovers with the same profile key, including the same sorted visible model id set.
- Small post-load label updates remain `snapshot_patch`, not full snapshot.
- Projection atom updates do not update unrelated labels.
- Overlay values still protect active input/dialog state from server echo.
- Workspace Manager install updates the compact app index through a `bootstrap` patch and does not include the newly installed app body in `bootstrap`.
- Workspace Manager remove updates the compact app index through a `bootstrap` patch and removes/rejects the removed app on next visible fetch.
- First open of an installed app fetches the app body through `visible`.
- Guest/read-only/authenticated principals have an explicit permission matrix for `bootstrap`, `app_index`, `visible`, `full`, install, remove, and open actions.

### Browser Measurements

For local and remote, record:

- time to desktop shell visible,
- time to app card list visible,
- first bootstrap snapshot duration and bytes,
- first app open visible snapshot duration and bytes,
- SSE first event type and bytes,
- representative post-load patch bytes,
- whether any `full` snapshot was requested,
- whether outer page scroll appears.

### Acceptance Targets

Pass criteria for the first implementation:

- Startup makes no bare `/snapshot` request and no `profile=full` request in deterministic tests and real browser traces.
- Remote `bootstrap` snapshot is at most `90KB`, or at most `60%` of the pre-change remote baseline if the absolute target is not reached in the first pass.
- If remote `bootstrap` remains above `90KB`, the implementation is only acceptable when the runlog includes top model/label contributors and a follow-up task for each contributor above `10KB`.
- Remote desktop shell and app list are visible before any positive app model body request completes.
- Opening an app produces a separate `visible` request for that app model id.
- Normal post-load label changes use `snapshot_patch` or local overlay. Any automatic `full` request is a failure.
- Patch mismatch recovery preserves the active visible model id set.
- Workspace Manager install/remove updates the compact app index without putting app bodies into `bootstrap`.
- The permission matrix passes for guest/read-only/authenticated sessions.

## Implementation Phases

### Phase 1: Instrumentation And Baseline

Purpose: make size contributors visible before cutting data.

Tasks:

- Add snapshot profile size stats helper.
- Add deterministic snapshot size report test or script.
- Record current top model/label contributors for `bootstrap`, `visible`, and `full`.
- Sub-agent review: verify metrics measure client-visible filtered payload, not raw truth.

### Phase 2: Strict Bootstrap Contract

Purpose: reduce first-paint payload.

Tasks:

- Define explicit bootstrap label allowlist.
- Replace heavy first-paint registry data with compact app index.
- Remove model editor lists, full table rows, docs/html bodies, and app-internal state from `bootstrap`.
- Update tests to enforce the budget and allowlist.
- Sub-agent review: verify no first-paint UI requirement was accidentally removed and no secret/hidden model leaks are possible.

### Phase 3: App/Model Lazy Loading Boundary

Purpose: guarantee app bodies load only when opened.

Tasks:

- Ensure every app open path calls `ensureVisibleModelLoaded(model_id)`.
- Add app-window loading and error states.
- Keep visible model ids in the stream URL.
- Keep loaded models warm for the browser session.
- Sub-agent review: verify route/app opening never falls back to `full`, and stale visible ids fail closed with clear recovery.

### Phase 4: Projection-Driven Rendering

Purpose: reduce post-load re-render cost.

Tasks:

- Move shell/app-card reads to projection atoms or compact index selectors.
- Keep raw `snapshot.models` as cache/recovery data, not as the default render dependency.
- Add render/update tests or projection-store tests proving unrelated labels do not update.
- Sub-agent review: verify overlay precedence and formal submit correctness are preserved.

### Phase 5: Profile-Scoped Patch Hardening

Purpose: keep incremental updates small and safe.

Tasks:

- Add profile-specific patch budgets.
- Ensure oversize fallback is profile-scoped reset, not `full`.
- Add tests for bootstrap-only, visible app A, visible app A+B, and permission-change reset.
- Sub-agent review: verify patch sequencing, principal isolation, and recovery semantics.

### Phase 6: Local And Remote Measurement

Purpose: prove user-visible improvement.

Tasks:

- Run deterministic test set.
- Deploy locally and test with real browser.
- Deploy remotely and test with real browser.
- Record before/after timing and payload sizes in the iteration runlog.
- Sub-agent review: verify measurements match the implemented revision and do not mix source/docs-only sync with runtime deployment evidence.

## Risks

- Too-aggressive bootstrap trimming can remove data needed by the desktop shell. Mitigation: first-paint tests must render the desktop from the trimmed bootstrap.
- Lazy loading can make app opening feel slower if no loading state exists. Mitigation: block only the app window and show a clear loading state.
- Reconnecting SSE on every visible model change can cause churn. Mitigation: debounce reconnect and keep visible ids stable for the session.
- Projection atoms can diverge from raw snapshot cache if patch application is inconsistent. Mitigation: tests must compare patch-applied state to a full same-profile snapshot.
- Byte budgets can become brittle. Mitigation: use both absolute and relative budgets, and always print top contributors when a budget fails.

## Non-Goals

- Replacing SSE.
- Replacing ModelTable truth.
- Adding a query language.
- Optimizing JS bundle splitting in this same iteration.
- Changing SSO/OIDC behavior.
- Changing Matrix/MQTT bus routing.

## Definition Of Done

The design is ready for implementation when:

- A reviewer agrees the profile boundaries are clear.
- The implementation phases are small enough for sub-agent review after each phase.
- The plan has explicit verification for payload size, latency, profile isolation, patch recovery, and overlay correctness.
- The plan does not introduce compatibility paths that hide old behavior.
