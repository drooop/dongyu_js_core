---
title: "Iteration 0417-user-isolated-ui-state-projection Plan"
doc_type: iteration-plan
status: planned
updated: 2026-06-18
source: ai
iteration_id: 0417-user-isolated-ui-state-projection
id: 0417-user-isolated-ui-state-projection
phase: phase1
---

# Iteration 0417-user-isolated-ui-state-projection Plan

## Goal

Make the post-login UI runtime safe for multiple users and responsive for high-frequency interactions:

- multiple browser users on the same UI Server must not share installed app instances, drafts, tasks, dialog state, selected views, or other user-owned runtime data;
- UI components such as Input, Dialog, Tabs, filters, dropdowns, hover/focus, drag previews, recording state, and loading state must have an explicit local/session/user/model state contract instead of being implicitly persisted as business truth;
- normal interaction updates must move through small projection deltas after bootstrap, and high-frequency local UI state must not force full or near-full snapshot exchange;
- submit actions must read the currently visible local values and then send the formal ModelTable-like payload through the existing Model 0 / pin / bus path;
- waiting states must be visible, scoped, and blocking for the relevant interaction area until success, failure, or timeout.

## Scope

In scope:

- Define and implement a user-runtime boundary for UI Server:
  - shared system/global runtime for built-in app definitions, workspace catalog, public docs, transport config, and provider indexes;
  - per-principal workspace runtime for installed slide app instances, user drafts, selected app/view state, task data, app-local materialized responses, and app-owned business labels.
- Preserve the existing ModelTable rule that UI is projection only and business side effects enter through Model 0 system bus ingress/egress.
- Extend the UI model contract for local interaction state:
  - Input default policy is local-only until submit;
  - Dialog visibility, current tab, local page switch, drawer/dropdown state, selection state, drag preview, upload/recording state, and pending/loading state are local/session state unless explicitly declared otherwise;
  - state declarations must be granular and component-addressable.
- Extend renderer/remote store behavior so submit can read current local overlays before any delayed persistence completes.
- Add scoped pending/loading declarations for submit-like actions:
  - prevent duplicate submit and block the declared scope;
  - show loading state;
  - clear on success, visible error, or timeout.
- Add deterministic tests for:
  - user isolation;
  - no per-keystroke model write by default;
  - immediate submit uses visible local value;
  - dialog/tab/local page switches do not require business persistence;
  - pending/loading lock behavior;
  - small post-load projection deltas for local UI state.
- Update developer-facing UI model documentation for the new state and pending rules.
- Refill or adjust existing non-built-in slide app payloads only where required by the new contract, with special checks for To Do Board and existing imported examples.

Out of scope:

- Replacing SSE transport with WebSocket or another transport.
- Reworking Matrix / MQTT / MBR routing semantics beyond adding the user-runtime reply target metadata needed for correct materialization.
- Changing the canonical `pin.bus.cb.*` / `pin.bus.mb.*` bus contract.
- Implementing offline conflict resolution across devices.
- Full server-side CRDT or collaborative editing.
- Remote deployment. This iteration targets local deterministic checks and local browser verification unless a later user request explicitly adds remote deployment.

## Invariants / Constraints

- `CLAUDE.md` remains authoritative: no implementation before plan/review gate, no side effects outside ModelTable add/remove interpretation, no UI direct business write, no direct bus bypass.
- UI business events must enter via the worker root Model 0 `(0,0,0)` system bus boundary.
- ModelTable remains the only formal business truth. Local UI state may exist only when explicitly categorized as local/session/view state and must not be described as business truth.
- Transport payloads remain Temporary ModelTable record arrays. Persistence is explicit materialization, not implied by message transmission.
- Per-user isolation must not be implemented by sprinkling optional `owner_user_id` labels onto a shared truth table as the primary boundary. The boundary must be runtime-level or storage-level so accidental cross-user reads/writes fail closed.
- Shared global data and per-user data must have a documented ownership rule:
  - global: built-in app definitions, provider catalog, public docs, transport/bootstrap config;
  - user: installed app instances, local app data, drafts, selected view, materialized replies, To Do tasks, user settings.
- Auth-disabled local development may use a deterministic `local-dev` principal, but the code path must still go through the same principal/runtime selection logic.
- Guest/no-login access must remain read-only and must not create a mutable shared user workspace.
- Any behavior claim must be backed by deterministic script output or browser verification.
- Each implementation stage must be reviewed by a sub-agent using the code review skill and must be corrected before the next stage starts.

## Design Decisions

### State Classes

The UI model must distinguish four state classes:

| State class | Examples | Default persistence | Owner |
|---|---|---|---|
| Local interaction state | Input draft, Dialog open, dropdown open, hover/focus, drag preview, voice recording panel | never persisted | browser session |
| View state | selected tab, local page switch, selected row, active filter, drawer open | session/local unless declared user-persisted | browser session or user runtime |
| Business state | submitted task, generated color, sent message, materialized response label | explicit ModelTable write only | user workspace runtime |
| System/runtime state | pending submit, upload progress, auth state, SSE recovery | runtime-local unless explicitly projected | server/runtime |

### Input Default

Input components define input capability by default. They do not automatically bind each keystroke to ModelTable.

Allowed policies:

- `persist_policy: "submit"`: default. Keep local value only; submit reads the current visible value.
- `persist_policy: "debounce"`: synchronize after `debounce_ms`; submit must flush or directly read the local overlay before dispatch.
- `persist_policy: "realtime"`: persist every meaningful change. This is opt-in and should be reserved for data that really needs live materialization.

### UI State Declaration

New model labels may describe local state slots, for example:

```json
{
  "state_id": "create_task_dialog",
  "state_kind": "visibility",
  "scope": "local",
  "persist_policy": "never",
  "default": false,
  "reset_on": ["submit_success", "route_leave"]
}
```

The exact label names and renderer mapping are finalized in implementation, but the semantics above are fixed by this iteration.

### Pending / Loading

Submit-like actions may declare:

- `pending_state_id`: stable local pending slot;
- `pending_text`: visible waiting copy;
- `lock_scope`: `button`, `form`, `dialog`, `app`, or `global`;
- `disable_while_pending`: default true for submit actions;
- `pending_until`: `submit_success`, `submit_error`, or `timeout`;
- `timeout_ms` and `on_timeout`.

Pending state must block only the declared scope, not the whole page unless `lock_scope: "app"` or `"global"` is used.

### User Runtime Boundary

The server must select a mutable runtime by principal before serving snapshots or handling write/event endpoints.

- Authenticated principal key: stable OIDC subject first, then user id/email/username fallback.
- Auth-disabled local mode: `local-dev`.
- Guest: no mutable user runtime; read-only projection only.
- Runtime data path must be deterministic and safe for filesystem use.
- Responses from remote workers must materialize into the `reply_target_*` user runtime, not a shared global runtime.

## Success Criteria

- `docs/ITERATIONS.md` registers 0417 and this iteration has plan/resolution/runlog records.
- A deterministic test proves two principals can use the same UI Server without sharing:
  - installed app list,
  - app-local task/data labels,
  - input drafts/dialog state/selected view,
  - materialized response labels.
- A deterministic test proves the default Input typing path does not send per-keystroke ModelTable writes.
- A deterministic test proves immediate submit reads the latest visible local input value even when debounce/local sync has not completed.
- A deterministic test proves Dialog visibility and local page/tab switch can be local-only and do not create business labels.
- A deterministic test proves pending/loading state:
  - appears immediately after submit,
  - blocks duplicate submit in the declared scope,
  - clears on success/error/timeout.
- A deterministic test proves post-load local UI interactions produce small projection events and do not trigger a full or near-full snapshot unless recovery is required.
- Existing deterministic checks still pass for:
  - snapshot patch behavior,
  - reactive projection store,
  - To Do Board contract,
  - route/state stability,
  - bus event and current-model reference behavior.
- Local deployment is restarted or redeployed before browser verification.
- Real browser verification covers:
  - Home app list and focused slide app display;
  - To Do Board create/edit/status change with smooth input;
  - Dialog open/close and pending/loading blocking;
  - E2E color generator still updates;
  - no outer page scroll and no unexpected inner overflow in the verified flows.
- Documentation explains:
  - input persistence policies;
  - local/session/user/model state scopes;
  - Dialog/tab/local page switch declaration;
  - submit reads current local state;
  - pending/loading lock behavior;
  - multi-user isolation expectations.

## Review and Execution Policy

- Phase 1 writes only docs and plan artifacts.
- After Phase 1, a sub-agent must review the plan/resolution with the `codex-code-review` skill.
- Phase 3 may start only after the plan review is `APPROVED`.
- Each implementation stage must end with:
  - deterministic verification;
  - runlog evidence;
  - sub-agent code review;
  - correction until review is approved.
- The final state must receive one full sub-agent review before reporting completion.

## Inputs

- Created at: 2026-06-11
- Iteration ID: 0417-user-isolated-ui-state-projection
- Branch: `dropx/dev_0417-user-isolated-ui-state-projection`
