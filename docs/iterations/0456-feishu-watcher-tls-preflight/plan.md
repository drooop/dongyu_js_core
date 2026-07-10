---
title: "Iteration 0456 Feishu Watcher TLS Preflight Plan"
doc_type: iteration-plan
status: approved
updated: 2026-07-10
source: ai
iteration_id: 0456-feishu-watcher-tls-preflight
id: 0456-feishu-watcher-tls-preflight
phase: phase1
---

# Iteration 0456-feishu-watcher-tls-preflight Plan

## Goal

Close F-09 by preventing the Feishu source watcher from silently running with TLS certificate verification disabled, while preserving an explicit and auditable local-debug path. Persist the user's F-01/F-04/F-05/F-08 decisions without implementing those product changes in this iteration.

## Scope

In scope:

- Add a preflight to `scripts/ops/feishu_source_watch.mjs` before manifest/state/network processing.
- When `NODE_TLS_REJECT_UNAUTHORIZED=0`, fail with a non-zero exit and write a safe `BLOCKED` report unless a dedicated local-debug flag is present.
- Apply this exact insecure-TLS decision matrix:
  - no override flag: block in every mode;
  - override + fixture: allow, and perform no network request regardless of `FEISHU_API_BASE`;
  - override + no fixture + URL-parsed exact loopback hostname (`localhost`, `127.0.0.1`, or `::1`): allow;
  - override + no fixture + external/default/unparseable API base: block.
- Reject deceptive hosts such as `localhost.evil.example` and `127.0.0.1.evil.example`; substring or suffix matching is forbidden.
- Make an accepted insecure local-debug run visible in the generated report.
- Add focused RED/GREEN tests for default blocking, override scope, and unchanged normal behavior.
- After verification, apply this exact decision-state migration:
  - F-09 moves from active backlog to completed history; `feishu_source_watch.focused_docs` becomes `aligned`, removes F-09 from `open_findings`, and adds 0456 as an owner iteration.
  - F-01/F-05/F-08 use `decision_recorded_implementation_pending`; they must not be labeled implemented or aligned.
  - F-04 uses `decision_recorded_source_correction_pending`; repo behavior stays aligned without an alias, while Feishu source correction remains separately unauthorized.
  - F-06/F-07 remain unchanged as `requires_user_confirmation`.
  - `docs/ssot/contract_coverage_summary.md` is regenerated only from the updated manifest.
- Record these user decisions as decided but not implemented:
  - F-01: upgrade the whole Feishu Message API input envelope to `pin_payload.v2`.
  - F-04: `model.submtconnect` is a Feishu document typo; do not add a repo alias.
  - F-05: `ui.refresh_data` writes through authorized ModelTable operations; frontend remains projection-only.
  - F-08: `add_task_return` must be a real PIN message.
- Keep F-06 and F-07 in `requires_user_confirmation`.

Out of scope:

- Implementing F-01, F-05, or F-08 runtime behavior.
- Adding a compatibility alias for F-04.
- Deciding F-06 or F-07.
- Editing any Feishu document or making a real Feishu API request.
- Merge, push, deployment, or recurring monitor configuration.

## Invariants / Constraints

- Preflight failure happens before any snapshot, baseline, other state payload, or fetch; only the blocked report parent may be created.
- The blocked report contains no token, secret, or source content.
- The override flag is explicit: `--allow-insecure-tls-local-debug`.
- Fixture and loopback are the only accepted override contexts.
- Existing watcher fixture/event/filter/raw-fallback behavior remains unchanged when TLS verification is enabled.
- Decision recording changes backlog/contract status only; it does not claim the corresponding runtime behavior exists.
- Feishu remains read-only and is not contacted during this iteration.
- TLS preflight runs after required CLI argument validation but before reading manifest/event files, creating snapshot/baseline state, or fetching any URL.
- A blocked report may create its own parent directory, including when the report path is nested under `state-dir`; the guarantee is no snapshot, baseline, or other state payload is written.
- Normal watcher tests explicitly remove `NODE_TLS_REJECT_UNAUTHORIZED` from spawned environments so results do not depend on the host shell.
- `1f4ae36` is the unmerged 0455 closeout baseline. 0456 is intentionally stacked on 0454/0455 and must integrate after those commits; it is not planned as an independent cherry-pick.

## Success Criteria

- Insecure TLS without the override exits non-zero, writes `Status: BLOCKED`, and creates no state/snapshot data.
- Insecure TLS plus the override is still blocked for an external Feishu API base.
- Insecure TLS plus the override succeeds in fixture or loopback mode and reports `TLS Verification: DISABLED_FOR_LOCAL_DEBUG`.
- A missing or malformed manifest/event sentinel still yields the TLS blocker first, proving preflight order.
- Deceptive loopback-like hostnames remain blocked.
- `scripts/tests/test_0441_feishu_source_watch_contract.mjs` passes all existing and new cases.
- The backlog and contract manifest show F-09 completed, F-01/F-04/F-05/F-08 decided but pending follow-up, and only F-06/F-07 awaiting confirmation.
- `docs/ssot/feishu_alignment_decisions_v0.md` records the four adopted directions, explicitly marks F-01/F-05/F-08 unimplemented, forbids an F-04 alias, and preserves current executable SSOT until later Approved iterations.
- Contract summary/index regeneration and focused contract tests pass without drift.
- Syntax, docs gate, `git diff --check`, and changed-file whitespace checks pass.
- Three consecutive independent closeout reviews return `Approved`.

## Inputs

- Created at: 2026-07-10
- Iteration ID: 0456-feishu-watcher-tls-preflight
- Baseline: `1f4ae36`
- Stacked dependency: 0455 is not yet merged to `dev`; integrate 0454/0455 before 0456.

## Alternatives Considered

- Recommended: fail-closed with a fixture/loopback-only explicit override. This prevents an automated watcher from silently trusting invalid certificates while preserving deterministic local testing.
- Warning-only: rejected because recurring monitoring could continue producing untrusted evidence.
- Custom certificate/dispatcher management: deferred because F-09 only requires detection and blocking; certificate provisioning is a separate operational concern.
