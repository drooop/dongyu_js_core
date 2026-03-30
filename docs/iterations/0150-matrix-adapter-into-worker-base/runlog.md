---
title: "Iteration 0150-matrix-adapter-into-worker-base Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0150-matrix-adapter-into-worker-base
id: 0150-matrix-adapter-into-worker-base
phase: phase3
---

# Iteration 0150-matrix-adapter-into-worker-base Runlog

## Environment

- Date: 2026-02-14
- Branch: dev_0150-matrix-adapter-into-worker-base

Review Gate Record
- Iteration ID: 0150-matrix-adapter-into-worker-base
- Review Date: 2026-02-14
- Review Type: User
- Review Index: 1/1
- Decision: Approved
- Notes: User 指令 “Implement the plan.”，允许进入 Phase 3 执行。

## Execution Records

> 仅记录真实命令与关键输出（PASS/FAIL）。

### Step 1 — Introduce worker-base adapters (Validation)

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
node -e "require('./packages/worker-base/src/matrix_live.js'); console.log('PASS matrix_live require')"
node -e "require('./packages/worker-base/src/loopback.js'); console.log('PASS loopback require')"
node -e "require('./packages/worker-base/src/index.js'); console.log('PASS worker-base index require')"
```

Output (key)
- `PASS matrix_live require`
- `PASS loopback require`
- `PASS worker-base index require`

### Step 2 — Update all call sites (Validation)

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
rg -n "packages/bus-mgmt" -S scripts packages k8s || true
```

Output (key)
- no matches (PASS)

### Step 3 — Delete bus-mgmt (Evidence + Validation)

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
find packages/bus-mgmt -maxdepth 2 -type f -print
```

Output (key)
- `packages/bus-mgmt/src/adapter.js`
- `packages/bus-mgmt/src/loopback.js`
- `packages/bus-mgmt/src/matrix_live.js`

File deletions
- Deleted via apply_patch:
  - `packages/bus-mgmt/src/adapter.js`
  - `packages/bus-mgmt/src/loopback.js`
  - `packages/bus-mgmt/src/matrix_live.js`

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
rmdir packages/bus-mgmt/src
rmdir packages/bus-mgmt
test ! -d packages/bus-mgmt && echo PASS
```

Output (key)
- `PASS`

### Step 4 — Update docs (Validation)

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
rg -n "bus-mgmt" docs/handover/dam-worker-guide.md || true
```

Output (key)
- no matches (PASS)

### Step 5 — Local verification (Build/Deploy + Playwright)

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
docker build --no-cache -f k8s/Dockerfile.mbr-worker -t dy-mbr-worker:v2 .
docker build --no-cache -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .
bash scripts/ops/ensure_runtime_baseline.sh
bash scripts/ops/check_runtime_baseline.sh
kubectl -n dongyu rollout restart deployment/mbr-worker deployment/ui-server
kubectl -n dongyu rollout status deployment/mbr-worker --timeout=180s
kubectl -n dongyu rollout status deployment/ui-server --timeout=180s
NODE_PATH=$PWD/node_modules node /tmp/test_color_latency_pw.cjs http://127.0.0.1:30900 10
```

Output (key)
- Baseline:
  - `[baseline] all deployments ready — nothing to do`
  - `[check] baseline ready`
- Rollout:
  - `deployment.apps/mbr-worker restarted`
  - `deployment "mbr-worker" successfully rolled out`
  - `deployment.apps/ui-server restarted`
  - `deployment "ui-server" successfully rolled out`
- Playwright burst:
  - `"ok": true` (10/10 trials)
