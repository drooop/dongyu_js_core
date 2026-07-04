---
title: "Iteration 0433 Dev Fake Login Plan"
doc_type: iteration-plan
status: completed
updated: 2026-07-03
source: ai
iteration_id: 0433-dev-fake-login
id: 0433-dev-fake-login
phase: completed
---

# Iteration 0433-dev-fake-login Plan

## Goal

Add a temporary, explicit fake-login path for local testing while the remote
OIDC issuer at `124.71.43.80` is unavailable. The fake-login path must let
testers enter the app as distinct users without disabling authentication
globally.

## Scope

- In scope:
- Server-side dev-only fake login route guarded by an environment flag.
- Frontend login page affordance that appears only when the server says fake
  login is enabled.
- Two or more predefined fake users with distinct principal ids, roles, and
  session cookies.
- Local deployment configuration that can enable the temporary path for testing
  without changing formal cloud defaults.
- Automated and real-browser verification for default-off behavior, fake login,
  and two-user session isolation.
- Runlog evidence explaining how to disable the temporary path.

- Out of scope:
- Changing formal OIDC semantics or SSO callback behavior.
- Matrix login, Matrix credentials, or Matrix-backed messaging tests.
- Replacing role-based authorization or changing slide app visibility policy.
- Adding compatibility behavior for unauthenticated `DY_AUTH=0` flows.
- Remote deployment.

## Invariants / Constraints

- `CLAUDE.md` is highest priority.
- Fake login is default-off and requires an explicit local environment flag.
- When disabled, fake-login routes must not create sessions and the UI must not
  show fake-login actions.
- Fake login must create normal authenticated sessions so existing per-principal
  isolation remains the enforcement mechanism.
- Fake users must have stable, distinct principal ids so browser A and browser B
  do not share identity or user-scoped data.
- Formal OIDC paths must remain unchanged and continue to use the existing
  session/cookie contract.
- The feature must be easy to remove: code paths are isolated behind one
  clearly named temporary flag.

## Success Criteria

- Default environment:
  - `/auth/dev/fake-login` does not create a session.
  - Login UI does not show fake-login buttons.
- Local test environment with fake login enabled:
  - Login UI shows a clearly marked temporary fake-login section.
  - Selecting fake user A creates an authenticated session for user A.
  - Selecting fake user B in a separate browser context creates an authenticated
    session for user B.
  - `/auth/me` reports distinct user ids and names for A and B.
- Existing OIDC tests still pass.
- Local UI Server is redeployed with fake login enabled and real browser
  verification reaches the desktop without contacting the broken remote OIDC
  issuer.
- Runlog records the enable/disable flag and all verification evidence.

## Inputs

- Created at: 2026-07-03
- Iteration ID: 0433-dev-fake-login
- Trigger: remote SSO issuer is unreachable for protocol-level testing, but
  non-Matrix UI and per-user isolation still need local verification.
