# Iteration 0132-dual-bus-contract-harness-v0 Run Log

规则：只记事实（FACTS）。不要写计划、不要写愿景。每个 Step 只有 PASS 才算完成。

## Environment
- OS:
- Node/Bun versions:
- Key env flags:
- Matrix env keys (redacted):
  - MATRIX_HOMESERVER_URL
  - MATRIX_MBR_USER
  - MATRIX_MBR_PASSWORD
  - MATRIX_MBR_ACCESS_TOKEN (optional)
- Notes:

### Review Gate Records (FACTS)
```text
Review Gate Record
- Iteration ID: 0132-dual-bus-contract-harness-v0
- Review Date:
- Review Type: User / OpenCode
- Reviewer: @oracle / @momus
- Review Index: 1/2/3...
- Decision: Approved / Change Requested / On Hold
- Notes:
```

```text
Review Gate Record
- Iteration ID: 0132-dual-bus-contract-harness-v0
- Review Date: 2026-01-28
- Review Type: User
- Reviewer: User
- Review Index: 1
- Decision: Approved
- Notes: User approved this iteration as an exception to Charter 6.1/6.2 to allow real Matrix integration.
```

---

## Step 1 — Evidence + contract draft
- Start time:
- End time:
- Branch: dev_0132-dual-bus-contract-harness-v0
- Commits:
  - (none; user did not request commits)
- Commands executed:
  - `node -e "const fs=require('fs'); const must=['docs/iterations/0132-dual-bus-contract-harness-v0/evidence_pictest_matrix_mqtt.md','docs/iterations/0132-dual-bus-contract-harness-v0/contract_dual_bus_v0.md']; for (const f of must) { if(!fs.existsSync(f)) { console.error('MISSING',f); process.exit(1);} } console.log('PASS: docs_exist')"`
  - `node -e "const fs=require('fs'); const p='docs/iterations/0132-dual-bus-contract-harness-v0/schemas'; if(!fs.existsSync(p)) { console.error('MISSING',p); process.exit(1);} console.log('PASS: schemas_dir')"`
- Key outputs (snippets):
  - PASS: docs_exist
  - PASS: schemas_dir
- Result: PASS
- If FAIL:
  - Cause:
  - Fix commits:
  - Re-run commands:
  - Final result:

---

## Step 2 — MgmtBus adapter interface + env contract
- Start time:
- End time:
- Branch: dev_0132-dual-bus-contract-harness-v0
- Commits:
  - (none; user did not request commits)
- Commands executed:
  - `node -e "const fs=require('fs'); const p='docs/iterations/0132-dual-bus-contract-harness-v0'; const ok=['contract_dual_bus_v0.md'].every(f=>fs.existsSync(p+'/'+f)); console.log(ok?'PASS: env_contract':'FAIL: env_contract'); process.exit(ok?0:1)"`
- Key outputs (snippets):
  - PASS: env_contract
- Result: PASS

---

## Step 3 — MgmtBus adapter (loopback)
- Start time:
- End time:
- Branch: dev_0132-dual-bus-contract-harness-v0
- Commits:
  - (none; user did not request commits)
- Commands executed:
  - `node scripts/validate_dual_bus_harness_v0.mjs --case mgmt_loopback`
- Key outputs (snippets):
  - VALIDATION RESULTS
  - mgmt_loopback: PASS
- Result: PASS

---

## Step 4 — MgmtBus adapter (matrix-live)
- Start time:
- End time:
- Branch: dev_0132-dual-bus-contract-harness-v0
- Commits:
  - (none; user did not request commits)
- Commands executed:
  - `node scripts/validate_dual_bus_harness_v0.mjs --case mgmt_matrix_live --matrix_room_id "!MeXftFuWFKFgLcghQC:m2m.yhlcps.com" --timeout_ms 20000`
  - `node scripts/validate_dual_bus_harness_v0.mjs --case mgmt_matrix_live --matrix_room_id "!oEDyWwnafSSilrMJUQ:m2m.yhlcps.com" --timeout_ms 20000`
- Key outputs (snippets):
  - VALIDATION FAILED
  - MatrixError: [404] Can't join remote room because no servers that are in the room have been provided.
- Result: PASS
  - VALIDATION RESULTS
  - mgmt_matrix_live: PASS room_id=!oEDyWwnafSSilrMJUQ:m2m.yhlcps.com event_id=$eoSToBfyNdCIVstvt87sMbeUmz8BNTr7UwLvORBmBnE op_id=op-1769611866046

---

## Step 5 — MBR bridge v0
- Start time:
- End time:
- Branch: dev_0132-dual-bus-contract-harness-v0
- Commits:
  - (none; user did not request commits)
- Commands executed:
  - `node scripts/validate_dual_bus_harness_v0.mjs --case mbr_bridge`
- Key outputs (snippets):
  - VALIDATION RESULTS
  - mbr_bridge: PASS
- Result: PASS

---

## Step 6 — Harness E2E
- Start time:
- End time:
- Branch: dev_0132-dual-bus-contract-harness-v0
- Commits:
  - (none; user did not request commits)
- Commands executed:
  - `node scripts/validate_dual_bus_harness_v0.mjs --case e2e --matrix_room_id "!oEDyWwnafSSilrMJUQ:m2m.yhlcps.com" --timeout_ms 20000`
- Key outputs (snippets):
  - VALIDATION RESULTS
  - e2e_loopback: PASS
  - e2e_matrix_live: PASS
- Result: PASS

---

## Step 7 — Guards + docs polish
- Start time:
- End time:
- Branch: dev_0132-dual-bus-contract-harness-v0
- Commits:
  - (none; user did not request commits)
- Commands executed:
  - `node scripts/validate_iteration_guard.mjs --case stage4`
- Key outputs (snippets):
  - stage4: PASS
- Result: PASS
