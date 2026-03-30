---
title: "0153 — Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0153-cognition-feedback-loop
id: 0153-cognition-feedback-loop
phase: phase3
---

# 0153 — Runlog

> Flight recorder. Commands, output, commits, PASS/FAIL.
> Do not edit [[iterations/0153-cognition-feedback-loop/plan]] or [[iterations/0153-cognition-feedback-loop/resolution]] from here; only append facts.

---

## Review Gate Record
- Iteration ID: 0153-cognition-feedback-loop
- Review Date: (pending)
- Review Type: (pending)
- Review Index: 0
- Decision: (pending)
- Notes: awaiting 0152 completion + review gate.

---

(awaiting phase 2 review)

---

## Review Gate Record
- Iteration ID: 0153-cognition-feedback-loop
- Review Date: 2026-02-23
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: User 指令“开始实施 / Implement the plan.”，允许进入 Phase 3。

---

## Phase 3 Start
- Branch: `dev_0153-cognition-feedback-loop`
- Iteration index: `docs/ITERATIONS.md` status updated `Planned -> In Progress`.

### Applied Changes
1. Model ID registry update
   - `CLAUDE.md`:
     - registered `Model -3` for login model
     - registered `Model -12` for cognition scene context
2. New system-model patches
   - `packages/worker-base/system-models/cognition_scene_model.json`
   - `packages/worker-base/system-models/cognition_lifecycle_model.json`
   - `packages/worker-base/system-models/cognition_handlers.json`
3. Trigger chain extension
   - `packages/worker-base/system-models/intent_dispatch_config.json`
   - `event_trigger_map.ui_event = ["update_scene_context","forward_ui_events"]`
4. Dispatch lifecycle writeback
   - `packages/ui-model-demo-server/server.mjs`
   - dispatch path writes `action_lifecycle` executing/completed/failed
5. SSOT docs sync
   - `docs/architecture_mantanet_and_workers.md`
   - `docs/ssot/runtime_semantics_modeltable_driven.md`

### Verification Commands (Executed)
```bash
node --check packages/ui-model-demo-server/server.mjs
jq -e . packages/worker-base/system-models/cognition_scene_model.json
jq -e . packages/worker-base/system-models/cognition_lifecycle_model.json
jq -e . packages/worker-base/system-models/cognition_handlers.json
jq -e '.records[] | select(.k=="event_trigger_map") | .v.ui_event[0]=="update_scene_context" and .v.ui_event[1]=="forward_ui_events"' packages/worker-base/system-models/intent_dispatch_config.json
```

### E2E Evidence (Local server, port 9010)
- Initial snapshot checks
  - `Model -12 scene_context` exists
  - `Model -1 action_lifecycle` exists with `status=idle`
- Positive path
  - `POST /ui_event` action `docs_refresh_tree` (`op_id=it0153-ok-1`)
  - response `result=ok`
  - lifecycle becomes `completed`
- Negative path
  - set invalid `docs_selected_path=../../../etc/passwd`
  - `POST /ui_event` action `docs_open_doc` (`op_id=it0153-fail-1`)
  - response `result=error`, `code=invalid_target`
  - lifecycle becomes `failed` with `result.code/detail`
- Feedback loop
  - next action `docs_search` (`op_id=it0153-ok-2`)
  - `scene_context.last_action_result` reflects previous failed action (`it0153-fail-1`)
- Ring buffer cap
  - 22 continuous `docs_search` events
  - `scene_context.recent_intents.length == 20`

### Result
- Step 1-9 implementation: PASS
- Step 10 partial verification: PASS (local server + API)
- Remaining: baseline suite + full regression matrix execution for final iteration close.

### Baseline + Unit Validation (Executed)
```bash
bash scripts/ops/check_runtime_baseline.sh
node scripts/tests/test_cell_connect_parse.mjs
node scripts/tests/test_bus_in_out.mjs
node scripts/validate_builtins_v0.mjs
node scripts/validate_ui_ast_v0x.mjs --case all
```

Key outputs:
- baseline: PASS (`orbstack` context, mosquitto/synapse/remote-worker/mbr-worker/ui-server all ready)
- `test_cell_connect_parse.mjs`: `10 passed, 0 failed`
- `test_bus_in_out.mjs`: `7 passed, 0 failed`
- `validate_builtins_v0.mjs`: all checks PASS
- `validate_ui_ast_v0x.mjs --case all`: summary PASS

---

### Step 10 — Playwright Visual Evidence (port 9011)

Timestamp:
- `2026-02-24 02:49:31 +0800`

Runtime/infra check:
```bash
lsof -iTCP:9011 -sTCP:LISTEN -n -P | sed -n '1,3p'
bash scripts/ops/check_runtime_baseline.sh
```

Artifacts:
- `docs/iterations/0153-cognition-feedback-loop/assets/0153-pw-generate-loading-9011.png`
- `docs/iterations/0153-cognition-feedback-loop/assets/0153-pw-docs-refresh-9011.png`

API evidence (note: `/snapshot` response root is `snapshot`, so jq path is `.snapshot.models[...]`):
```bash
curl -sS http://127.0.0.1:9011/snapshot | jq '{
  action_lifecycle:.snapshot.models["-1"].cells["0,0,1"].labels.action_lifecycle.v,
  scene_last_intent:(.snapshot.models["-12"].cells["0,0,0"].labels.scene_context.v.recent_intents[-1]),
  scene_last_action_result:(.snapshot.models["-12"].cells["0,0,0"].labels.scene_context.v.last_action_result),
  docs_status:.snapshot.models["-2"].cells["0,0,0"].labels.docs_status.v
}'
```

Observed output:
```json
{
  "action_lifecycle": {
    "op_id": "op_1771872551862_1",
    "action": "docs_refresh_tree",
    "status": "completed",
    "started_at": 1771872551867,
    "completed_at": 1771872551874,
    "result": { "ok": true },
    "confidence": 1
  },
  "scene_last_intent": {
    "op_id": "op_1771872551862_1",
    "action": "docs_refresh_tree",
    "ts": 1771872551866,
    "model_id": null
  },
  "scene_last_action_result": {
    "op_id": "op_1771872443251_2",
    "action": "docs_refresh_tree",
    "status": "completed",
    "completed_at": 1771872443267,
    "result": { "ok": true },
    "confidence": 1
  },
  "docs_status": "docs indexed: 172"
}
```

Model 100 status snapshot:
```bash
curl -sS http://127.0.0.1:9011/snapshot | jq '{
  m100_status:.snapshot.models["100"].cells["0,0,0"].labels.status.v,
  m100_inflight:.snapshot.models["100"].cells["0,0,0"].labels.submit_inflight.v,
  m100_bg_color:.snapshot.models["100"].cells["0,0,0"].labels.bg_color.v,
  m100_system_ready:.snapshot.models["100"].cells["0,0,0"].labels.system_ready.v
}'
```

Observed output:
```json
{
  "m100_status": "loading",
  "m100_inflight": true,
  "m100_bg_color": "#FFFFFF",
  "m100_system_ready": false
}
```

Result:
- Docs path visual/API evidence: PASS (`action_lifecycle=completed`, `scene_context` updated, screenshot captured).
- Workspace `Generate Color` visual state captured (`loading` + disabled), but color round-trip not completed on this run (`system_ready=false`, still inflight).

---

### Step 10 Recheck — Runthrough PASS (2026-02-24, OrbStack context)

Root cause (confirmed):
- Local UI server and k8s MBR/worker were connected to different Matrix rooms.
  - Local server log: `Matrix adapter connected, room: !rvgIBRtgXATQGGRWiS:localhost`
  - MBR log: sending in `!sPvNeZvMXlixVcsJJC:localhost`
- With room mismatch, local server only receives self-echo, no `mbr_ready`/`snapshot_delta` for Model 100 roundtrip.

Fix applied for this validation run:
```bash
ROOM=$(kubectl get configmap -n dongyu mbr-worker-config -o jsonpath='{.data.DY_MATRIX_ROOM_ID}')
TOKEN=$(kubectl get secret -n dongyu mbr-worker-secret -o jsonpath='{.data.MATRIX_MBR_BOT_ACCESS_TOKEN}' | base64 --decode)

PORT=9011 DY_AUTH=0 \
DY_MATRIX_ROOM_ID="$ROOM" \
MATRIX_HOMESERVER_URL='http://synapse.dongyu.svc.cluster.local:8008' \
MATRIX_MBR_BOT_USER='@mbr:localhost' \
MATRIX_MBR_BOT_ACCESS_TOKEN="$TOKEN" \
NO_PROXY='*' no_proxy='*' \
bun packages/ui-model-demo-server/server.mjs
```

Connection evidence:
- Server log contains:
  - `Matrix adapter connected, room: !sPvNeZvMXlixVcsJJC:localhost`
  - `Received mbr_ready signal from MBR`
  - `Set system_ready=true on Model 100`

API runthrough evidence:
```json
{
  "m100_bg_color": "#21ad7d",
  "m100_status": "processed",
  "m100_inflight": false,
  "m100_ready": true,
  "last_op": "op_1771873167744_1",
  "ui_event_error": null
}
```

Playwright evidence:
- Workspace page shows `MBR Ready=true`, `颜色状态=processed`, and new `颜色值` after click.
- Asset: `docs/iterations/0153-cognition-feedback-loop/assets/0153-pw-workspace-runthrough-success-9011.png`

Result:
- Model 100 example roundtrip on local server: PASS.

---

### Ops Hardening — One-Click Baseline + Start + Submit Verify

Added scripts:
- `scripts/ops/start_local_ui_server_k8s_matrix.sh`
- `scripts/ops/verify_model100_submit_roundtrip.sh`
- `scripts/ops/run_model100_submit_roundtrip_local.sh`

Executed command:
```bash
bash scripts/ops/run_model100_submit_roundtrip_local.sh --port 9011 --stop-after
```

Key output:
- baseline: all 5 deployments ready (`orbstack`)
- start: Matrix aligned to k8s room `!sPvNeZvMXlixVcsJJC:localhost`
- verify:
  - submit response `result=ok`
  - poll transition: `loading/inflight=true` -> `processed/inflight=false`
  - final state includes `ready=true`, `ui_event_error=null`
- wrapper result: `[run] PASS`

Runbook update:
- `docs/user-guide/color_generator_e2e_runbook.md` 新增 `2.4 OrbStack 一键复跑（0153 收口）`
- 包含一键命令与拆分命令链。

---

## Phase 4 — Completion (2026-03-01)

- Branch `dev_0153-cognition-feedback-loop` merged to `dev`.
- Commits:
  - `b3d6340 feat: implement cognition context and action lifecycle loop`
  - `f635a9a ops: add one-click model100 roundtrip runbooks and scripts`
- ITERATIONS.md status: `In Progress → Completed`.
- All steps PASS. Iteration closed.
