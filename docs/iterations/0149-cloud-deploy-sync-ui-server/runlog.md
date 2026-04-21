---
title: "Iteration 0149-cloud-deploy-sync-ui-server Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0149-cloud-deploy-sync-ui-server
id: 0149-cloud-deploy-sync-ui-server
phase: phase3
---

# Iteration 0149-cloud-deploy-sync-ui-server Runlog

## Environment

- Date: 2026-02-14
- Branch: dev_0149-cloud-deploy-sync-ui-server
- Runtime: local 127.0.0.1:30900 + dy-cloud app.dongyudigital.com

Review Gate Record
- Iteration ID: 0149-cloud-deploy-sync-ui-server
- Review Date: 2026-02-14
- Review Type: User
- Review Index: 1/1
- Decision: Approved
- Notes: User明确要求执行并验证远端部署（"Implement the plan."），允许进入 Phase 3 执行。

- Ports:
  - `localhost:9000`: no listener (local)
  - `localhost:30900`: NodePort listener (Docker Desktop)

## Execution Records

### Step 1 — Manifest/Volume Alignment

- Command:
  - `rg -n "SEED_POSITIVE_MODELS_ON_BOOT|DOCS_ROOT|STATIC_PROJECTS_ROOT|hostPath" k8s/local/workers.yaml k8s/cloud/workers.yaml deploy/env/cloud.env.example`
- Key output:
  - local and cloud manifests use hostPath mounts:
    - local: `/Users/drop/dongyu/volume/statics/{static_projects,docs}`
    - cloud: `/home/wwpic/dongyu/volume/statics/{static_projects,docs}`
  - env default changed to `SEED_POSITIVE_MODELS_ON_BOOT=0`
- Result: PASS

- Command:
  - `ssh dy-cloud "kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu get deploy/ui-server -o yaml | grep -n -E 'SEED_POSITIVE_MODELS_ON_BOOT|DOCS_ROOT|STATIC_PROJECTS_ROOT|hostPath'`
- Key output:
  - remote deployment env vars: `SEED_POSITIVE_MODELS_ON_BOOT=0`, `DOCS_ROOT=/app/.dy_docs`, `STATIC_PROJECTS_ROOT=/app/.dy_static_projects`
  - remote hostPath volumes mounted to `/home/wwpic/dongyu/volume/statics/{static_projects,docs}`
- Result: PASS

### Step 2 — Code Sync Baseline

- Command:
  - `sha256sum packages/ui-model-demo-server/server.mjs packages/worker-base/system-models/ui_to_matrix_forwarder.json`
  - `ssh dy-cloud "sha256sum /home/wwpic/dongyuapp/packages/ui-model-demo-server/server.mjs /home/wwpic/dongyuapp/packages/worker-base/system-models/ui_to_matrix_forwarder.json"`
- Key output:
  - `packages/ui-model-demo-server/server.mjs` hash(local) == hash(remote): `59f0f29bf1840c08e80ccdc840736d0449fc4e89aa51a40eb5216db70b9b8c09`
  - `packages/worker-base/system-models/ui_to_matrix_forwarder.json` hash(local) == hash(remote): `b65321ebd012778d737fd723e7b4e32a9edf091d97c1dd3948926092b67c29af`
- Result: PASS

- Command:
  - `ssh dy-cloud "cd /home/wwpic/dongyuapp && docker build --no-cache -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 . && docker save dy-ui-server:v1 -o /tmp/dy-ui-server-v1.tar && ls -lh /tmp/dy-ui-server-v1.tar"`
- Key output:
  - `/tmp/dy-ui-server-v1.tar` exists (latest rebuild) and is non-empty (example: `427M`, timestamp `2026-02-14 20:58`).
- Result: PASS

### Step 3 — Static/Docs Volume Baseline

- Command:
  - `find /Users/drop/dongyu/volume/statics/static_projects -maxdepth 2 -type f | wc -l` (local)
  - `ssh dy-cloud "find /home/wwpic/dongyu/volume/statics/static_projects -maxdepth 2 -type f | wc -l"` (cloud)
  - `find /Users/drop/dongyu/volume/statics/docs -maxdepth 2 -type f | wc -l` (local)
  - `ssh dy-cloud "find /home/wwpic/dongyu/volume/statics/docs -maxdepth 2 -type f | wc -l"` (cloud)
- Key output:
  - local static projects: `5` files (maxdepth=2)
  - cloud static projects: `4` files (maxdepth=2)
  - local docs: `0` files, cloud docs: `0` files (maxdepth=2)
- Result: PASS

### Step 4 — Import Image via K8s Job (dy-cloud)

- Command:
  - `scp docs/iterations/0149-cloud-deploy-sync-ui-server/assets/job_import_ui_server_v1.yaml dy-cloud:/tmp/job_import_ui_server_v1.yaml`
  - `ssh dy-cloud "kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu delete job import-ui-server-v1 --ignore-not-found; kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu apply -f /tmp/job_import_ui_server_v1.yaml; kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu logs job/import-ui-server-v1 --tail=120"`
- Key output:
  - Job completes in ~10-20s and `ctr images import` prints imported digest for `docker.io/library/dy-ui-server:v1`.
- Result: PASS

### Step 5 — Restart + Verify ui-server (dy-cloud)

- Command:
  - `ssh dy-cloud "kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu rollout restart deployment/ui-server; kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu rollout status deployment/ui-server --timeout=300s"`
- Key output:
  - `deployment \"ui-server\" successfully rolled out`
- Result: PASS

- Command:
  - ```bash
    node - <<'NODE'
    const url = 'https://app.dongyudigital.com/snapshot';
    function getLabel(snapshot, modelId, key) {
      const model = snapshot?.models?.[String(modelId)] || snapshot?.models?.[modelId];
      const cell = model?.cells?.['0,0,0'];
      const raw = cell?.labels?.[key];
      return raw ? raw.v : undefined;
    }
    (async () => {
      const res = await fetch(url);
      const j = await res.json();
      const snap = j.snapshot || j;
      const reg = getLabel(snap, -2, 'ws_apps_registry');
      const apps = Array.isArray(reg) ? reg : [];
      console.log(JSON.stringify({
        status: res.status,
        ws_apps_len: apps.length,
        has_bus_trace: apps.some((x) => x && x.model_id === -100),
        first_entry: apps[0] || null,
      }, null, 2));
    })();
    NODE
    ```
- Key output:
  - `ws_apps_registry` length becomes `6` and includes system app `{ model_id: -100, name: "Bus Trace" }`.
- Result: PASS

### Step 6 — Playwright Verification (Color Generator + Workspace)

- Command:
  - `NODE_PATH=$PWD/node_modules node /tmp/test_color_pw.cjs http://127.0.0.1:30900`
- Key output:
  - `ok`: true, `buttonFound`: true
  - `/ui_event` responses: 2 (all 200)
  - `wsAppsLen`: 6
  - `changedBg`: true
- Result: PASS

- Command:
  - `NODE_PATH=$PWD/node_modules node /tmp/test_color_pw.cjs https://app.dongyudigital.com`
- Key output:
  - `ok`: true, `buttonFound`: true
  - `/ui_event` responses: 2 (all 200)
  - `wsAppsLen`: 6
  - `changedBg`: true, `changedStatus`: true (`ready` -> `processed`)
- Result: PASS

### Step 7 — Playwright Verification (Static UI Upload)

- Command:
  - `NODE_PATH=$PWD/node_modules node /tmp/test_static_pw.cjs http://127.0.0.1:30900 /Users/drop/Downloads/forkit/frontend-about2.html`
- Key output:
  - `ok`: true
  - upload endpoint: `POST /api/static/upload?name=pw-static-...&kind=html` returns 200
  - served static page title: `Forkit about - The Path to Structured Thinking`
- Result: PASS

### Step 8 — Matrix/Synapse Sanity Check (dy-cloud)

- Command:
  - `ssh dy-cloud "kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu get pods -o wide"`
  - `ssh dy-cloud "kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu logs deploy/ui-server --tail=80"`
  - `ssh dy-cloud "kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu logs deploy/mbr-worker --tail=80"`
- Key output:
  - `synapse`, `mbr-worker`, `remote-worker`, `ui-server` are Running/Ready.
  - `ui-server` logs show Matrix `/sync` 200 and receives `dy.bus.v0` (e.g. `mbr_ready`).
  - `mbr-worker` logs show it can `send/dy.bus.v0` (200).
- Result: PASS

### Step 9 — Repro + Root Cause (Synapse 429 → snapshot_delta dropped / delayed)

- Command:
  - `NODE_PATH=$PWD/node_modules node /tmp/test_color_latency_pw.cjs https://app.dongyudigital.com 10`
- Key output:
  - Example failure (excerpt):
    - `ok=false`
    - latency summary: `p50Ms ~ 8552`, `p95Ms ~ 10049`
    - at least one trial `changed=false` (no `bg_color` change within 10s polling window)
- Result: FAIL (burst clicks not reliable / perceived "slow")

- Command:
  - `ssh dy-cloud "kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu logs deploy/mbr-worker --since=2h | egrep -n 'M_LIMIT_EXCEEDED|429|Too Many Requests|mgmt publish failed|RATE_LIMIT' | tail -n 80"`
- Key output:
  - Synapse returns `429 Too Many Requests` (`M_LIMIT_EXCEEDED`) on `send/dy.bus.v0`.
  - When 429 happens, `snapshot_delta` does not reach ui-server in time; Model 100 `submit_inflight` can remain `true`.
- Result: PASS (root cause confirmed)

### Step 10 — Fix (MBR retry + Synapse rc_message tune) + Verify

- Change (code):
  - `packages/bus-mgmt/src/matrix_live.js`: serialize Matrix sends + retry/backoff on `M_LIMIT_EXCEEDED`.
  - `k8s/cloud/synapse.yaml`, `k8s/local/synapse.yaml`: set `rc_message` to avoid 429 under short bursts.

- Command (dy-cloud code sync):
  - `scp packages/bus-mgmt/src/matrix_live.js dy-cloud:/tmp/matrix_live.js`
  - `ssh dy-cloud "ts=$(date +%Y%m%d_%H%M%S); set -euo pipefail; cd /home/wwpic/dongyuapp; cp packages/bus-mgmt/src/matrix_live.js packages/bus-mgmt/src/matrix_live.js.bak.$ts; mv /tmp/matrix_live.js packages/bus-mgmt/src/matrix_live.js; shasum -a 256 packages/bus-mgmt/src/matrix_live.js"`
- Result: PASS

- Command (dy-cloud build + save mbr-worker image):
  - `ssh dy-cloud "cd /home/wwpic/dongyuapp && docker build --no-cache -f k8s/Dockerfile.mbr-worker -t dy-mbr-worker:v2 . && docker save dy-mbr-worker:v2 -o /tmp/dy-mbr-worker-v2.tar && ls -lh /tmp/dy-mbr-worker-v2.tar"`
- Result: PASS

- Command (dy-cloud import image via job):
  - `scp docs/iterations/0149-cloud-deploy-sync-ui-server/assets/job_import_mbr_worker_v2.yaml dy-cloud:/tmp/job_import_mbr_worker_v2.yaml`
  - `ssh dy-cloud "kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu delete job import-mbr-worker-v2 --ignore-not-found; kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu apply -f /tmp/job_import_mbr_worker_v2.yaml; kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu wait --for=condition=complete job/import-mbr-worker-v2 --timeout=180s; kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu logs job/import-mbr-worker-v2 --tail=120"`
- Result: PASS

- Command (restart mbr-worker):
  - `ssh dy-cloud "kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu rollout restart deployment/mbr-worker; kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu rollout status deployment/mbr-worker --timeout=180s"`
- Result: PASS

- Command (deploy synapse rate-limit tune):
  - `scp k8s/cloud/synapse.yaml dy-cloud:/tmp/synapse.yaml`
  - `ssh dy-cloud "kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu apply -f /tmp/synapse.yaml; kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu rollout restart deployment/synapse; kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu rollout status deployment/synapse --timeout=240s"`
- Result: PASS

- Command (verify burst clicks):
  - `NODE_PATH=$PWD/node_modules node /tmp/test_color_latency_pw.cjs https://app.dongyudigital.com 10`
- Key output:
  - `ok=true`
  - Example latency: `p50 ~ 1.1s`, `p95 ~ 2.0s` (no inflight stuck observed)
- Result: PASS

### Step 11 — Local Parity (docker-desktop)

- Command (deploy synapse rate-limit tune, local):
  - `kubectl -n dongyu apply -f k8s/local/synapse.yaml`
  - `kubectl -n dongyu rollout restart deployment/synapse`
  - `kubectl -n dongyu rollout status deployment/synapse --timeout=240s`
- Result: PASS

- Command (build + restart mbr-worker, local):
  - `docker build --no-cache -f k8s/Dockerfile.mbr-worker -t dy-mbr-worker:v2 .`
  - `kubectl -n dongyu rollout restart deployment/mbr-worker`
  - `kubectl -n dongyu rollout status deployment/mbr-worker --timeout=180s`
- Result: PASS

- Command (restart ui-server to clear any stale inflight, local):
  - `kubectl -n dongyu rollout restart deployment/ui-server`
  - `kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`
- Result: PASS

- Command (verify burst clicks, local):
  - `NODE_PATH=$PWD/node_modules node /tmp/test_color_latency_pw.cjs http://127.0.0.1:30900 10`
- Key output:
  - `ok=true`
  - Example latency: `p95 ~ 0.36s`
- Result: PASS

## Docs Updated

- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
