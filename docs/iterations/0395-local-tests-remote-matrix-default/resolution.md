---
title: "0395 Local Tests Remote Matrix Default Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-26
source: codex
---

# Resolution

## Step 1 - Contract Tests

Files:

- `scripts/tests/test_0395_local_tests_remote_matrix_default.mjs`

Verification:

- `node scripts/tests/test_0395_local_tests_remote_matrix_default.mjs`

Acceptance:

- The test fails before implementation because the current local defaults still point at local Synapse.

## Step 2 - Remote Matrix Defaults

Files:

- `deploy/env/local.env.example`
- `deploy/env/local.env`
- `scripts/matrix_connection_check.py`
- `scripts/ops/_deploy_common.sh`
- `scripts/ops/deploy_local.sh`
- `docs/user-guide/project_address_record.md`

Verification:

- `node scripts/tests/test_0395_local_tests_remote_matrix_default.mjs`
- `python3 -m py_compile scripts/matrix_connection_check.py`

Acceptance:

- Local examples and current local env default to remote Matrix.
- Local deploy uses the configured remote Matrix URL for generated ModelTable bootstrap labels.
- Generated local Matrix token reuse is rejected when it was produced for a different homeserver.

## Step 3 - Real Remote Matrix Check

Files:

- `scripts/matrix_connection_check.py`
- `docs/iterations/0395-local-tests-remote-matrix-default/runlog.md`

Verification:

- `python3 scripts/matrix_connection_check.py --message "remote default matrix check 0395"`

Acceptance:

- The script logs in as `drop` and `mbr` against `https://matrix.dongyudigital.com`.
- If no room is configured, it creates a temporary remote room and sends one message from `drop` visible to `mbr`.
