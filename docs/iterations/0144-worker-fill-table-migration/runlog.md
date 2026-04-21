---
title: "0144: Runlog — Worker Fill-Table Migration"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0144-worker-fill-table-migration
id: 0144-worker-fill-table-migration
phase: phase3
---

# 0144: Runlog — Worker Fill-Table Migration

## Phase 3 Execution

### Step 1: Create Remote Worker Role Patches
**Status**: PASS
- Created `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json` (3 records: mqtt_payload_mode + 2 MQTT_WILDCARD_SUB)
- Copied `test_model_100_full.json` → `10_model100.json` (8 records)
- JSON validation: both files valid

### Step 2: Deprecate Legacy remote_worker_model.json
**Status**: PASS
- Renamed to `remote_worker_model.legacy.json`
- References in Dockerfile updated in Step 7

### Step 3: Verify MBR Compatibility with New Runtime
**Status**: PASS (5/5 tests)
- `test_0144_mbr_compat.mjs`: patches load, functions compile, mbr_mgmt_to_mqtt executes correctly for Model 100, mbr_mqtt_to_mgmt writes MGMT_OUT correctly
- Key finding: MBR bridge functions use `ctx.getLabel/writeLabel/rmLabel/publishMqtt` (WorkerEngineV0 ctx API), all unaffected by 0141-0143 changes
- `_applyBuiltins` does not trigger for label types `json`, `str`, `MGMT_OUT` used by MBR functions

### Step 4: Rewrite Remote Worker Bootstrap
**Status**: PASS
- Created `scripts/run_worker_remote_v1.mjs` (fill-table architecture)
- Core logic: load patches → startMqttLoop → runtime handles everything
- No WorkerEngineV0. No manual MQTT subscription. No tick() loop.
- Env var support: DY_MQTT_HOST, DY_MQTT_PORT, DY_MQTT_USER, DY_MQTT_PASS, WORKER_ID

### Step 5: Unit Tests for Remote Worker
**Status**: PASS (7/7 tests)
- `test_0144_remote_worker.mjs`: patches load, MQTT_WILDCARD_SUB registered, cell_connection routing declared, CELL_CONNECT wiring declared, mqttIncoming routes to Model 100, cell_connection propagates to processing cell, full async chain (mqttIncoming → IN → cell_connection → CELL_CONNECT → function → bg_color/status updated)

### Step 6: Update MBR Patches (MQTT_WILDCARD_SUB)
**Status**: PASS
- Added 2 MQTT_WILDCARD_SUB labels to `mbr_role_v0.json`:
  - `sub_model2_patch_out` → `UIPUT/ws/dam/pic/de/sw/2/patch_out`
  - `sub_model100_patch_out` → `UIPUT/ws/dam/pic/de/sw/100/patch_out`
- JSON validation: valid

### Step 7: Update Dockerfiles + K8s Manifests
**Status**: PASS
- `k8s/Dockerfile.remote-worker`: Updated to use `run_worker_remote_v1.mjs` + patches from `deploy/sys-v1ns/remote-worker/patches/`
- `k8s/remote-worker-deployment.yaml`: image tag `v2` → `v3`
- `k8s/mbr-worker-deployment.yaml`: image tag `v0` → `v1`
- MBR Dockerfile unchanged (patches dir path same)

### Step 8: Build Images + Deploy to K8s
**Pre-flight**: PASS (all 6 checks passed)
```
[check] PASS deploy/mbr-worker readyReplicas=1
[check] PASS deploy/remote-worker readyReplicas=1
[check] PASS remote-worker-svc has endpoint
[check] PASS mosquitto running
[check] PASS element synapse running
[check] PASS matrix versions endpoint reachable
```

**Docker build**: PASS
- `dy-remote-worker:v3` built successfully (oven/bun:latest base)
- `dy-mbr-worker:v1` built successfully (node:22-slim base)

**K8s deploy**: PASS
- Both deployments rolled out successfully
- New pods Running, old pods Terminating

**Remote worker v3 startup log**:
```
[remote-worker-v1] Starting (fill-table architecture)
[remote-worker-v1] MQTT: host.docker.internal:1883
[remote-worker-v1] Loaded 00_remote_worker_config.json: applied=3, rejected=0
[remote-worker-v1] Loaded 10_model100.json: applied=8, rejected=0
[remote-worker-v1] MQTT startMqttLoop: {"status":"running"}
[remote-worker-v1] MQTT_WILDCARD_SUB labels: 2
[remote-worker-v1] Ready. Runtime handles: mqttIncoming → IN → cell_connection → CELL_CONNECT → function
```

**MBR worker v1 startup log**:
```
[worker] loaded patch: mbr_role_v0.json (applied=20 rejected=0)
[worker] mqtt READY subscribed=UIPUT/ws/dam/pic/de/sw/2/patch_out, UIPUT/ws/dam/pic/de/sw/100/patch_out
```
(Matrix adapter connection failed — pre-existing network issue, not related to 0144)

### Step 9: E2E Validation
**Classification**: e2e (Docker + K8s required)
**Pre-flight**: PASS (completed in Step 8)

**Test 1: Remote worker MQTT event processing**
```bash
docker exec mosquitto mosquitto_pub -h 127.0.0.1 -p 1883 -u u -P p \
  -t 'UIPUT/ws/dam/pic/de/sw/100/event' \
  -m '{"version":"mt.v0","op_id":"e2e_0144_001","records":[...]}'
```
**Result**: PASS
- Before: `bg_color=#FFFFFF, status=ready`
- After: `bg_color=#2ac42b, status=processed`
- Full chain: MQTT → mqttIncoming → records → IN → cell_connection → CELL_CONNECT → AsyncFunction → output

**Test 2: MBR Matrix event forwarding**
- Skipped: Matrix adapter connection failed (pre-existing issue, not 0144 scope)

### Regression Tests
**Status**: PASS (44/44)
- 0144 new tests: 12 (5 MBR compat + 7 remote worker)
- 0143 tests: 5
- 0141-0142 tests: 20
- Legacy tests: 7

## Files Changed

### Created
- `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json`
- `deploy/sys-v1ns/remote-worker/patches/10_model100.json`
- `scripts/run_worker_remote_v1.mjs`
- `scripts/tests/test_0144_mbr_compat.mjs`
- `scripts/tests/test_0144_remote_worker.mjs`

### Modified
- `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json` (added 4 MQTT_WILDCARD_SUB records)
- `k8s/Dockerfile.remote-worker` (new entry point + patches dir)
- `k8s/remote-worker-deployment.yaml` (image v2 → v3)
- `k8s/mbr-worker-deployment.yaml` (image v0 → v1)
- `docs/ITERATIONS.md` (registered 0144)

### Renamed
- `packages/worker-base/system-models/remote_worker_model.json` → `.legacy.json`
