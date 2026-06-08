---
title: "Iteration 0411 OIDC RP Logout Resolution"
doc_type: iteration_resolution
status: completed
updated: 2026-06-09
source: ai
---

# Iteration 0411 Resolution

## Outcome
Implemented server-side OIDC RP-initiated logout for Zitadel sessions. The browser now exits through Dongyu App `/auth/logout`, which clears the local session and redirects to Zitadel `end_session_endpoint` when available and safe.

## Key Decisions
- Use browser `GET /auth/logout` for full logout, because the browser must carry the Zitadel cookies through the IdP logout flow.
- Keep `POST /auth/logout` as local-session-only cleanup for compatibility.
- Do not expose the upstream logout URL or `id_token_hint` to frontend JavaScript.
- Reject unsafe `end_session_endpoint` values by requiring http/https, HTTPS unless loopback, and the same origin as the configured issuer.

## Validation
- `node scripts/tests/test_0403_oidc_session_gateway.mjs`: PASS
- `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`: PASS
- `node scripts/tests/test_0403_principal_authorization.mjs`: PASS
- `node scripts/tests/test_0403_matrix_sso_bridge.mjs`: PASS
- `npm -C packages/ui-model-demo-frontend run build`: PASS
- Sub-agent review: ACCEPTED

## Rollback
Revert the 0411 commit. The previous behavior will return to local session cleanup only, which is safe but leaves Zitadel SSO session reuse unresolved.

