---
title: "0394 Matrix Connection Check Script Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-05-26
source: codex
---

# 0394 Matrix Connection Check Script Runlog

## 2026-05-26

- Branch: `dropx/dev_0394-matrix-connection-check`
- Requirement: add a Python script to test current Matrix connection, including channel listing, send, and receive from `drop` to `mbr`.

### Verification

- Command: `python3 -m py_compile scripts/matrix_connection_check.py`
  - Result: PASS
- Command: `python3 scripts/matrix_connection_check.py --list-limit 8 --message "matrix connectivity check <timestamp>"`
  - Result: PASS
  - Homeserver: local Synapse service at `http://192.168.194.216:8008`
  - Users: `@drop:localhost` -> `@mbr:localhost`
  - Test room: current generated local Matrix DM room
  - drop joined channels: `77`
  - Send: returned a Matrix event id
  - Receive: `mbr` read the same message from sender `@drop:localhost`
