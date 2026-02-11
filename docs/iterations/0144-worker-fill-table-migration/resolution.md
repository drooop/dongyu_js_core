# 0144: Resolution — Worker Fill-Table Migration

## Step 1: Create Remote Worker Role Patches

**Goal**: Define remote worker behavior entirely via JSON patches

**Files to create**:
- `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json`

**Patch content**:
```json
{
  "version": "mt.v0",
  "op_id": "remote_worker_config_v1",
  "records": [
    // MQTT config on Model 0 (0,0,0) — env vars override at bootstrap
    { "op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0,
      "k": "mqtt_payload_mode", "t": "str", "v": "mt_v0" },
    // MQTT_WILDCARD_SUB for Model 100 event topic
    { "op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0,
      "k": "sub_model100_event", "t": "MQTT_WILDCARD_SUB",
      "v": "UIPUT/ws/dam/pic/de/sw/100/event" },
    // MQTT_WILDCARD_SUB for Model 100 patch topic (for future use)
    { "op": "add_label", "model_id": 0, "p": 0, "r": 0, "c": 0,
      "k": "sub_model100_patch", "t": "MQTT_WILDCARD_SUB",
      "v": "UIPUT/ws/dam/pic/de/sw/100/patch" }
  ]
}
```

**Copy**: `test_model_100_full.json` into patches dir as `10_model100.json`
(alphabetical ordering ensures config loaded before model definition)

**Verify**: patches dir contains 2 files, both valid JSON

---

## Step 2: Update remote_worker_model.json (deprecate legacy)

**Goal**: Mark `remote_worker_model.json` as legacy, not used by K8s

**Action**: Rename to `remote_worker_model.legacy.json` with deprecation comment

**Verify**: No script references the old filename

---

## Step 3: Verify MBR Compatibility with New Runtime

**Goal**: Ensure MBR bridge functions still work after 0141-0143 changes

**Tests**:
1. Load system_models.json + mbr_role_v0.json into fresh runtime
2. Verify `mbr_mgmt_to_mqtt` function compiles and runs without error
3. Verify `mbr_mqtt_to_mgmt` function compiles and runs without error
4. Simulate ui_event → mbr_mgmt_to_mqtt → verify MQTT publish call
5. Simulate MQTT patch → mbr_mqtt_to_mgmt → verify MGMT_OUT label written

**File**: `scripts/tests/test_0144_mbr_compat.mjs`

---

## Step 4: Rewrite Remote Worker Bootstrap

**Goal**: Remote worker uses run_worker_v0.mjs with patch dir, OR thin new script

**Approach A** (preferred): Reuse `run_worker_v0.mjs`
- Set `DY_ROLE_PATCH_DIR=deploy/sys-v1ns/remote-worker/patches`
- run_worker_v0.mjs already: loads patches → reads config from labels → starts MQTT
- Problem: run_worker_v0.mjs creates its own MQTT client, not runtime's startMqttLoop

**Approach B**: New thin script `scripts/run_worker_remote_v1.mjs`
```javascript
// 1. Create runtime, load system patches
// 2. Load all patches from role dir (alphabetical)
// 3. Apply env var overrides to MQTT config labels
// 4. rt.startMqttLoop({ transport: 'real', ... })
// 5. Heartbeat logging (optional)
```

**Decision**: Approach B — because run_worker_v0.mjs uses manual MQTT + WorkerEngineV0,
which defeats the purpose of this migration. A new thin script demonstrates the fill-table pattern.

**Key difference from v0**: No WorkerEngineV0. No manual MQTT subscription.
Runtime's startMqttLoop + mqttIncoming + cell_connection + CELL_CONNECT handles everything.

**Verify**:
```bash
# Local test with mock MQTT
bun scripts/run_worker_remote_v1.mjs deploy/sys-v1ns/remote-worker/patches
```

---

## Step 5: Unit Tests for Remote Worker

**Goal**: Verify the full chain works in-process (unit, no Docker)

**File**: `scripts/tests/test_0144_remote_worker.mjs`

**Tests**:
1. `test_mqtt_wildcard_sub_registered`: Load patches → verify MQTT_WILDCARD_SUB labels parsed
2. `test_mqtt_incoming_routes_to_model100`: Simulate mqttIncoming with Model 100 event topic → verify IN label at (0,0,0)
3. `test_cell_connection_routes_event`: Verify cell_connection routes event from (0,0,0) to (1,0,0)
4. `test_full_chain_async`: mqttIncoming → IN → cell_connection → CELL_CONNECT → function → patch output

**Classification**: unit (no Docker needed)

---

## Step 6: Update MBR Patches (MQTT_WILDCARD_SUB)

**Goal**: MBR's MQTT subscriptions declared as labels, not hardcoded in JS

**File**: `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`

**Add MQTT_WILDCARD_SUB labels**:
```json
{ "k": "sub_model2_patch_out", "t": "MQTT_WILDCARD_SUB",
  "v": "UIPUT/ws/dam/pic/de/sw/2/patch_out" },
{ "k": "sub_model100_patch_out", "t": "MQTT_WILDCARD_SUB",
  "v": "UIPUT/ws/dam/pic/de/sw/100/patch_out" }
```

**Note**: MBR manual MQTT handler will still receive messages, but subscriptions
are now declared in the model table rather than constructed in JS.

**Verify**: Load mbr_role_v0.json → check MQTT_WILDCARD_SUB labels present

---

## Step 7: Update Dockerfiles + K8s Manifests

**Dockerfile.remote-worker changes**:
- Base image: keep `oven/bun:latest`
- COPY new script `scripts/run_worker_remote_v1.mjs`
- COPY `deploy/sys-v1ns/remote-worker/patches/`
- CMD: `bun scripts/run_worker_remote_v1.mjs deploy/sys-v1ns/remote-worker/patches`

**Dockerfile.mbr-worker changes**: minimal (keep existing, patches updated in step 6)

**K8s manifests**: update image tag from `v2` to `v3` for remote-worker

**Verify**: `docker build` succeeds for both images

---

## Step 8: Build Images + Deploy to K8s

**Pre-flight** (MANDATORY):
```bash
bash scripts/ops/ensure_runtime_baseline.sh
bash scripts/ops/check_runtime_baseline.sh
```

**Build**:
```bash
docker build -t dy-remote-worker:v3 -f k8s/Dockerfile.remote-worker .
docker build -t dy-mbr-worker:v1 -f k8s/Dockerfile.mbr-worker .
```

**Deploy**:
```bash
kubectl set image deployment/remote-worker remote-worker=dy-remote-worker:v3
kubectl set image deployment/mbr-worker mbr-worker=dy-mbr-worker:v1
kubectl rollout status deployment/remote-worker --timeout=180s
kubectl rollout status deployment/mbr-worker --timeout=180s
```

**Verify**: `kubectl get pods` shows both Running, no CrashLoopBackOff

---

## Step 9: E2E Validation

**Classification**: e2e (Docker + K8s required)

**Test 1**: Remote worker receives MQTT event and processes
```bash
# Publish test event to MQTT
mosquitto_pub -h localhost -p 1883 -u u -P p \
  -t 'UIPUT/ws/dam/pic/de/sw/100/event' \
  -m '{"version":"mt.v0","op_id":"e2e_0144_001","records":[{"op":"add_label","model_id":100,"p":1,"r":0,"c":0,"k":"action","t":"str","v":"submit"}]}'
```
Check remote-worker logs for color generation.

**Test 2**: MBR forwards Matrix event to MQTT
(Requires Matrix bot operational)

**Verify**: Both tests produce deterministic PASS/FAIL evidence in runlog

---

## Rollback Plan

1. `kubectl set image deployment/remote-worker remote-worker=dy-remote-worker:v2`
2. `kubectl set image deployment/mbr-worker mbr-worker=dy-mbr-worker:v0`
3. Git revert commit(s) on dev branch
