---
title: "0395 Local Tests Remote Matrix Default Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-05-26
source: codex
---

# Runlog

## Environment

- Branch: `dropx/dev_0395-local-tests-remote-matrix`
- CWD: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`

Review Gate Record
- Iteration ID: 0395-local-tests-remote-matrix-default
- Review Date: 2026-05-26
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: User requested that future local tests default to the remote Matrix server for transport.

## Step 1 - Contract Tests

PASS.

Command:

```bash
node scripts/tests/test_0395_local_tests_remote_matrix_default.mjs
```

Key output:

```text
PASS test_0395_local_tests_remote_matrix_default
```

Red check:

```text
AssertionError [ERR_ASSERTION]: local.env.example must default local tests to the remote Matrix homeserver
```

## Step 2 - Remote Matrix Defaults

PASS.

Commands:

```bash
node scripts/tests/test_0395_local_tests_remote_matrix_default.mjs
python3 -m py_compile scripts/matrix_connection_check.py
bash -n scripts/ops/_deploy_common.sh && bash -n scripts/ops/deploy_local.sh
node scripts/tests/test_0175_matrix_patch_bootstrap_contract.mjs
bash -lc 'set -a; source deploy/env/local.env; set +a; source scripts/ops/_deploy_common.sh; echo homeserver=$(matrix_homeserver_url); if is_remote_matrix_homeserver; then echo mode=remote; else echo mode=local; fi'
```

Key output:

```text
PASS test_0395_local_tests_remote_matrix_default
PASS test_0175_matrix_patch_bootstrap_contract
homeserver=https://matrix.dongyudigital.com
mode=remote
```

Coverage added after sub-agent review:

```text
- Python env parser expands ${REMOTE_MATRIX_DROP_PASSWORD:?set ...} and ${REMOTE_MATRIX_MBR_PASSWORD:?set ...}.
- Generated Matrix bootstrap with room id suffix :localhost is rejected.
- Generated Matrix bootstrap with room id suffix :synapse.dongyudigital.com is accepted.
```

## Step 3 - Real Remote Matrix Check

PASS.

Command:

```bash
python3 scripts/matrix_connection_check.py --message "remote default matrix final 0395"
```

Key output:

```text
Matrix connection check
homeserver: https://matrix.dongyudigital.com
drop user: @drop:synapse.dongyudigital.com
mbr user: @mbr:synapse.dongyudigital.com
test room: !ABrIRJEgWcYaGORynN:synapse.dongyudigital.com
sent event: $7b5XwhnvK0iQsBBicMAKHeJG8AyV19Bla--HKeDYVIc
mbr receive: PASS sender=@drop:synapse.dongyudigital.com body=remote default matrix final 0395
RESULT: PASS
```

## Conformance Review

- Tier placement: PASS. Change only affects bootstrap config and test tooling.
- Model placement: PASS. UI Server / MBR Matrix config still enters Model 0 through `MODELTABLE_PATCH_JSON`.
- Data ownership: PASS. UI remains projection; Matrix transport config is runtime bootstrap data.
- Data flow: PASS. Local tests now go through remote Matrix, not local Synapse.
- Data chain: PASS. Stale local generated room ids are ignored when their server suffix does not match `synapse.dongyudigital.com`.

## Review

Sub-agent Review 1:

```text
Decision: CHANGE_REQUESTED
Findings:
- high: forced SKIP_MATRIX_BOOTSTRAP=1 could still reuse stale local generated env.
- medium: Python env reader did not expand ${REMOTE_MATRIX_*:?msg} placeholders.
```

Fixes:

```text
- Added validate_generated_matrix_bootstrap and used it for automatic and forced reuse paths.
- Added env placeholder expansion in matrix_connection_check.py.
- Added deterministic coverage for env expansion and stale/valid generated env.
```

Sub-agent Review 2:

```text
Decision: APPROVED
Findings: none
Open questions: none
Verification gaps: none
```
