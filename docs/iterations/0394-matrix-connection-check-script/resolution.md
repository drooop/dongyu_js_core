---
title: "0394 Matrix Connection Check Script Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-26
source: codex
---

# 0394 Matrix Connection Check Script Resolution

## Steps

1. Implement `scripts/matrix_connection_check.py`.
2. Run it against the current local deployment.
3. Record verification in `runlog.md`.

## Verification

- `python3 scripts/matrix_connection_check.py`
- `python3 -m py_compile scripts/matrix_connection_check.py`

## Result

- Added `scripts/matrix_connection_check.py`.
- The script lists `drop` joined channels, sends a text message from `drop` to `mbr`, and confirms the message is readable by `mbr`.
- The script reads local deployment env files by default and does not print credentials.
