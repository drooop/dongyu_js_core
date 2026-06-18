---
title: "Iteration 0418-visible-snapshot-projection-latency Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-06-18
source: ai
iteration_id: 0418-visible-snapshot-projection-latency
id: 0418-visible-snapshot-projection-latency
phase: phase3
---

# Iteration 0418-visible-snapshot-projection-latency Runlog

## Environment

- Date: 2026-06-18
- Branch: `dropx/dev_0418-visible-snapshot-projection-latency`
- Runtime: Phase 1 planning first; no production code changed before plan review gate.
- Starting state: dirty worktree inherited from recent 0412-0417 latency/isolation work; do not revert unrelated changes.

## Baseline Measurements Before 0418 Implementation

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node - <<'NODE'
  const res = await fetch('http://localhost:30900/auth/me');
  console.log(res.status, await res.text());
  NODE
  ```
- Key output:
  ```text
  401 {"ok":false,"error":"not_authenticated"}
  ```
- Result: PASS, guest/read-only local state confirmed.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node - <<'NODE'
  const res = await fetch('http://localhost:30900/snapshot');
  const json = await res.json();
  const snap = json.snapshot || json;
  const models = Array.isArray(snap.models) ? snap.models : Object.values(snap.models || {});
  let labelCount = 0;
  const top = [];
  for (const model of models) {
    const labels = Array.isArray(model.labels)
      ? model.labels
      : Object.values(model.cells || {}).flatMap((cell) => Object.values(cell.labels || {}));
    labelCount += labels.length;
    for (const label of labels) {
      top.push({ model: model.id, k: label.k, t: label.t, bytes: Buffer.byteLength(JSON.stringify(label)) });
    }
  }
  top.sort((a, b) => b.bytes - a.bytes);
  console.log(JSON.stringify({ bytes: Buffer.byteLength(JSON.stringify(json)), models: models.length, labels: labelCount, top: top.slice(0, 3) }, null, 2));
  NODE
  ```
- Key output:
  ```json
  {
    "bytes": 604870,
    "models": 47,
    "labels": 6528,
    "top": [
      { "model": -2, "k": "home_table_rows_json", "t": "json", "bytes": 44170 },
      { "model": -2, "k": "ws_apps_registry", "t": "json", "bytes": 4235 },
      { "model": -2, "k": "editor_model_options_json", "t": "json", "bytes": 1985 }
    ]
  }
  ```
- Result: PASS baseline recorded; first-screen snapshot remains heavy.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node - <<'NODE'
  const ctrl = new AbortController();
  const t0 = performance.now();
  const res = await fetch('http://localhost:30900/stream', { signal: ctrl.signal });
  const reader = res.body.getReader();
  const { value } = await reader.read();
  ctrl.abort();
  console.log(JSON.stringify({
    status: res.status,
    firstChunkMs: Math.round(performance.now() - t0),
    firstChunkBytes: value ? value.byteLength : 0
  }, null, 2));
  NODE
  ```
- Key output:
  ```json
  {
    "status": 200,
    "firstChunkMs": 429,
    "firstChunkBytes": 29
  }
  ```
- Result: PASS baseline recorded.

## Baseline Preflight Requirements Before Phase 3

- 0416 registry status must be corrected if final runlog evidence proves it is complete.
- 0417 registry status must reflect actual phase before 0418 implementation starts. If 0417 is still in progress, 0418 must record that it builds on the current verified working baseline rather than a completed 0417 release.
- The following tests must pass before Step 2 implementation starts:
  - `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
  - `node scripts/tests/test_0415_reactive_projection_store_contract.mjs`
  - `node scripts/tests/test_0416_post_load_projection_latency_contract.mjs`
  - `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs && node scripts/tests/test_0415_reactive_projection_store_contract.mjs && node scripts/tests/test_0416_post_load_projection_latency_contract.mjs && node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
  ```
- Key output:
  ```text
  PASS test_0414_snapshot_delta_sse_contract: 7 passed
  PASS test_0415_reactive_projection_store_contract: 4 passed
  PASS test_0416_post_load_projection_latency_contract: 7 passed
  PASS 9/9
  ```
- Result: PASS. 0418 will build on the current verified working baseline; 0417 remains `In Progress` in the registry until its own final closure is completed.

## Review Gate Records

Review Gate Record
- Iteration ID: `0418-visible-snapshot-projection-latency`
- Review Date:
- Review Type: AI-assisted sub-agent
- Review Index: 1
- Decision: Change Requested
- Notes: sub-agent required stream initial snapshot to be profile-aware, visible-model negative tests, exact baseline commands, and prior iteration registry status clarification before Phase 3.

Review Gate Record
- Iteration ID: `0418-visible-snapshot-projection-latency`
- Review Date:
- Review Type: AI-assisted sub-agent
- Review Index: 2
- Decision: Change Requested
- Notes: sub-agent required explicit cwd in baseline/preflight command records.

Review Gate Record
- Iteration ID: `0418-visible-snapshot-projection-latency`
- Review Date:
- Review Type: AI-assisted sub-agent
- Review Index: 3
- Decision: Approved
- Notes: sub-agent approved the plan after profile-aware stream, visible negative tests, cwd-bearing baseline commands, and prior iteration status drift were corrected.

Review Gate Record
- Iteration ID: `0418-visible-snapshot-projection-latency`
- Review Date: 2026-06-18
- Review Type: AI-assisted sub-agent
- Review Index: 4
- Decision: Change Requested
- Notes: sub-agent found stale visible-id recovery could clear all existing visible subscriptions, `docs/ITERATIONS.md` still showed 0418 as Planned, and Step 5 browser evidence needed explicit inner-scroll and write-auth boundary notes.

Review Gate Record
- Iteration ID: `0418-visible-snapshot-projection-latency`
- Review Date: 2026-06-18
- Review Type: AI-assisted sub-agent
- Review Index: 5
- Decision: Approved
- Notes: sub-agent approved after stale visible-id recovery fix, registry status update, inner-scroll evidence, guest write-auth boundary evidence, and redeployed browser verification were added.

## Step Records

### Step 1 — Contract Tests and Baseline Metrics

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
  ```
- Key output:
  ```text
  FAIL snapshot_profiles_expose_bootstrap_and_visible_shapes: bootstrap snapshot must not include non-bootstrap model -101
  FAIL visible_profile_rejects_invalid_and_disallowed_targets: invalid_snapshot_profile must fail closed with expected status
  FAIL visible_profile_rejects_existing_capability_disallowed_model: viewer must not load existing management-bus model through visible profile
  FAIL stream_bootstrap_initial_event_avoids_full_snapshot_path: stream bootstrap snapshot must not include non-bootstrap model -101
  FAIL stream_visible_model_id_rejects_invalid_and_disallowed_targets: invalid_snapshot_profile stream visible_model_id must fail closed
  FAIL frontend_uses_bootstrap_and_visible_model_lazy_load_contract: remote_store startup snapshot must request bootstrap profile
  FAIL 6/6
  ```
- Result: PASS as expected RED. The failing tests prove current code still uses full snapshot behavior for bootstrap/stream, lacks fail-closed visible-model profile validation including an authenticated capability-denied existing model, lacks fail-closed stream visible-model validation, and frontend startup still fetches `/snapshot`. The contract also asserts that bootstrap/default snapshot/default stream keep required shell root labels, obey a bootstrap model allowlist, exclude registry-derived positive workspace app bodies, preserve broader secret/function redaction in snapshot and stream initial snapshots, reject invalid snapshot profiles, keep `refreshSnapshot` on bootstrap profile, allow full only through explicit `profile=full`, forbid implicit full-profile frontend `/snapshot` or `/stream` requests, make server stream visible subscriptions include only requested visible app models, subscribe frontend streams with loaded visible model IDs, wire `syncDesktopForeground` to visible-model lazy loading, and gate missing foreground workspace app content behind a loading state once the startup snapshot path is corrected.
- Commit: pending

### Step 2 — Server Snapshot Profiles

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
  ```
- Key output:
  ```text
  PASS snapshot_profiles_expose_bootstrap_and_visible_shapes
  PASS visible_profile_rejects_invalid_and_disallowed_targets
  PASS visible_profile_rejects_existing_capability_disallowed_model
  PASS stream_bootstrap_initial_event_avoids_full_snapshot_path
  PASS stream_visible_model_id_rejects_invalid_and_disallowed_targets
  FAIL frontend_uses_bootstrap_and_visible_model_lazy_load_contract: remote_store startup snapshot must request bootstrap profile
  FAIL 1/6
  ```
- Result: PASS for Step 2 scope. Server snapshot/default/visible profiles, stream initial profile filtering, invalid profile rejection, runtime-derived visible model validation, fixed bootstrap model allowlist, polluted UI-state, polluted `ws_apps_registry`, and polluted `ui_page_catalog_json` rejection, minimal Model 0 bootstrap surface, and stream redaction now satisfy the 0418 server contract. The remaining RED is frontend-only and belongs to Step 3.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs
  ```
- Key output:
  ```text
  PASS test_0414_snapshot_delta_sse_contract: 7 passed
  ```
- Result: PASS. Existing SSE patch contract still works with profile-aware stream baselines.
  Note: the legacy 0414 full-snapshot stream check now requests `profile=full` explicitly; 0418 owns the new default-bootstrap stream behavior.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node scripts/tests/test_0416_post_load_projection_latency_contract.mjs
  ```
- Key output:
  ```text
  PASS test_0416_post_load_projection_latency_contract: 7 passed
  ```
- Result: PASS. 0416 post-load patch contract now uses explicit bootstrap stream semantics: Model 100 business-state patches use `visible_model_id=100`, and app-index patch validation no longer waits for non-bootstrap workspace catalog input-state patches. This matches the 0418 bootstrap-default stream contract while preserving small patch behavior. This avoids restoring implicit full/default app-body streams.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
  ```
- Key output:
  ```text
  PASS 9/9
  ```
- Result: PASS. Principal-isolated runtime state, local Input/Dialog state, pending locks, and auth routing remain compatible with the 0418 bootstrap/visible profile work.
- Commit: pending

### Step 3 — Frontend Lazy Hydration

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
  ```
- Key output:
  ```text
  PASS snapshot_profiles_expose_bootstrap_and_visible_shapes
  PASS visible_profile_rejects_invalid_and_disallowed_targets
  PASS visible_profile_rejects_existing_capability_disallowed_model
  PASS stream_bootstrap_initial_event_avoids_full_snapshot_path
  PASS stream_visible_model_id_rejects_invalid_and_disallowed_targets
  PASS frontend_uses_bootstrap_and_visible_model_lazy_load_contract
  PASS 6/6
  ```
- Result:
  PASS. Frontend startup now uses `/snapshot?profile=bootstrap` and `/stream?profile=bootstrap`; visible workspace apps load through `/snapshot?profile=visible&model_id=...`; the SSE stream reconnects with loaded `visible_model_id` values; the foreground shell shows a loading state while a workspace app model is still being fetched. Visible lazy-load responses are merged with already-loaded models, so a late older visible response cannot delete a newer visible model that has already hydrated. Stale visible lazy-load responses also cannot regress the effective snapshot sequence; a later `snapshot_patch` based on the newer sequence still applies.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs && node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs && node scripts/tests/test_0415_reactive_projection_store_contract.mjs && node scripts/tests/test_0416_post_load_projection_latency_contract.mjs && node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
  ```
- Key output:
  ```text
  PASS 6/6
  PASS test_0414_snapshot_delta_sse_contract: 7 passed
  PASS test_0415_reactive_projection_store_contract: 4 passed
  PASS test_0416_post_load_projection_latency_contract: 7 passed
  PASS 9/9
  ✓ built in 3.23s
  ```
- Result: PASS. 0414-0417 latency/isolation contracts remain compatible with Step 3 frontend lazy hydration, the out-of-order visible response regression test, and monotonic visible snapshot sequence handling.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  npm -C packages/ui-model-demo-frontend run build
  ```
- Key output:
  ```text
  ✓ built in 3.23s
  ```
- Result: PASS. Vite build succeeds; existing large chunk warning remains non-blocking.
- Commit: pending

### Step 4 — Patch/Profile Consistency and Metrics

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
  ```
- Key output:
  ```text
  PASS snapshot_profiles_expose_bootstrap_and_visible_shapes
  PASS visible_profile_rejects_invalid_and_disallowed_targets
  PASS visible_profile_rejects_existing_capability_disallowed_model
  PASS stream_bootstrap_initial_event_avoids_full_snapshot_path
  PASS stream_visible_model_id_rejects_invalid_and_disallowed_targets
  PASS profile_patch_consistency_and_metrics
  PASS frontend_uses_bootstrap_and_visible_model_lazy_load_contract
  PASS 7/7
  ```
- Result:
  PASS. Added a deterministic profile/patch contract: bootstrap-only clients receive no app-body patch for hidden app model changes; visible(A) clients receive patches for A but not hidden B; patch stats match serialized patch size; bootstrap and one-visible-app metrics are smaller than full profile metrics; missing baseline reset remains explicit through `patch_kind: "reset"`.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs && node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs && node scripts/tests/test_0416_post_load_projection_latency_contract.mjs && node scripts/tests/test_0412_local_latency_trace_contract.mjs && node scripts/tests/test_0415_reactive_projection_store_contract.mjs && node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
  ```
- Key output:
  ```text
  PASS 7/7
  PASS test_0414_snapshot_delta_sse_contract: 7 passed
  PASS test_0416_post_load_projection_latency_contract: 7 passed
  PASS test_0412_local_latency_trace_contract: 11 passed
  PASS test_0415_reactive_projection_store_contract: 4 passed
  PASS 9/9
  ```
- Result: PASS. Snapshot patch, post-load patch-size, local latency timing, projection-store, and user-isolated state contracts remain compatible with profile-aware baselines.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  npm -C packages/ui-model-demo-frontend run build
  ```
- Key output:
  ```text
  ✓ built in 3.44s
  ```
- Result: PASS. Vite build succeeds; existing large chunk warning remains non-blocking.
- Commit: pending

### Step 5 — Docs, Local Deploy, Browser Verification, Final Review

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
  node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs
  node scripts/tests/test_0415_reactive_projection_store_contract.mjs
  node scripts/tests/test_0416_post_load_projection_latency_contract.mjs
  node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
  node scripts/tests/test_0412_local_latency_trace_contract.mjs
  node scripts/validate_ui_ast_v0x.mjs --case all
  node scripts/validate_builtins_v0.mjs
  npm -C packages/ui-model-demo-frontend run build
  ```
- Key output:
  ```text
  PASS 7/7
  PASS test_0414_snapshot_delta_sse_contract: 7 passed
  PASS test_0415_reactive_projection_store_contract: 4 passed
  PASS test_0416_post_load_projection_latency_contract: 7 passed
  PASS 9/9
  PASS test_0412_local_latency_trace_contract: 11 passed
  PASS validate_ui_ast_v0x: all cases passed
  PASS validate_builtins_v0
  ✓ built
  ```
- Result:
  PASS. Targeted 0412/0414/0415/0416/0417/0418 latency and projection contracts remain green, UI AST validation remains green, built-in validation remains green, and frontend build succeeds. Vite still reports the existing large chunk warning; it is unchanged and non-blocking for this iteration.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh
  kubectl -n dongyu get deploy ui-server mbr-worker remote-worker workspace-manager -o wide
  kubectl -n dongyu get pods -o wide | rg 'ui-server|mbr-worker|remote-worker|workspace-manager|mosquitto|synapse'
  ```
- Key output:
  ```text
  UI Server: http://localhost:30900
  Matrix Room: !bmXiQtlRBexWzYzdBe:synapse.dongyudigital.com
  Server User: @drop:synapse.dongyudigital.com
  MBR User: @mbr:synapse.dongyudigital.com

  ui-server           1/1     1            1
  mbr-worker          1/1     1            1
  remote-worker       1/1     1            1
  workspace-manager   1/1     1            1

  mbr-worker-78dd8d4d79-pf4sr          1/1     Running
  remote-worker-f5694767-kkfln         1/1     Running
  ui-server-7f6d79cd96-rgl6r           1/1     Running
  workspace-manager-6776f7bbd7-8h5c9   1/1     Running
  ```
- Result: PASS. Local stack was redeployed before browser verification; ui-server, mbr-worker, remote-worker, and workspace-manager pods are running from the new rollout.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node - <<'NODE'
  const base='http://localhost:30900';
  async function measure(path){
    const res=await fetch(base+path);
    const text=await res.text();
    const json=JSON.parse(text);
    const snap=json.snapshot || json;
    const models=snap.models && typeof snap.models==='object' ? Object.keys(snap.models).length : 0;
    let labels=0;
    for (const model of Object.values(snap.models || {})) {
      for (const cell of Object.values(model.cells || {})) labels += Object.keys(cell.labels || {}).length;
    }
    return { path, status: res.status, bytes: Buffer.byteLength(text), models, labels, snapshot_seq: json.snapshot_seq ?? null };
  }
  console.log(JSON.stringify([
    await measure('/snapshot?profile=full'),
    await measure('/snapshot?profile=bootstrap'),
    await measure('/snapshot?profile=visible&model_id=100'),
    await measure('/snapshot?profile=visible&model_id=1087'),
    await measure('/snapshot?profile=visible&model_id=100&model_id=1087'),
  ], null, 2));
  NODE
  ```
- Key output:
  ```json
  [
    { "path": "/snapshot?profile=full", "status": 200, "bytes": 604919, "models": 47, "labels": 6528, "snapshot_seq": 2 },
    { "path": "/snapshot?profile=bootstrap", "status": 200, "bytes": 155595, "models": 7, "labels": 1998, "snapshot_seq": 2 },
    { "path": "/snapshot?profile=visible&model_id=100", "status": 200, "bytes": 172106, "models": 8, "labels": 2167, "snapshot_seq": 2 },
    { "path": "/snapshot?profile=visible&model_id=1087", "status": 200, "bytes": 182119, "models": 8, "labels": 2287, "snapshot_seq": 2 },
    { "path": "/snapshot?profile=visible&model_id=100&model_id=1087", "status": 200, "bytes": 198633, "models": 9, "labels": 2456, "snapshot_seq": 2 }
  ]
  ```
- Result: PASS. Bootstrap snapshot is materially smaller than full snapshot and visible-model fetches add only the requested app model bodies.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node - <<'NODE'
  const base='http://localhost:30900';
  function completeEvents(buf){ const parts=buf.split(/\n\n/); return buf.endsWith('\n\n') ? parts.filter(Boolean) : parts.slice(0,-1).filter(Boolean); }
  async function firstDataEvent(path){
    const ctrl=new AbortController();
    const t0=performance.now();
    const res=await fetch(base+path,{signal:ctrl.signal});
    const reader=res.body.getReader();
    let buf=''; let rawBytes=0; let found=null;
    while(!found){
      const {value,done}=await reader.read();
      if(done) break;
      rawBytes+=value.byteLength;
      buf+=Buffer.from(value).toString('utf8');
      for (const ev of completeEvents(buf)) {
        if (/^data:/m.test(ev)) { found=ev; break; }
      }
    }
    ctrl.abort();
    const dataText=(found||'').split(/\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
    const parsed=JSON.parse(dataText);
    const snap=parsed.snapshot;
    const models=snap.models && typeof snap.models==='object' ? Object.keys(snap.models).length : 0;
    let labels=0;
    for (const model of Object.values(snap.models || {})) {
      for (const cell of Object.values(model.cells || {})) labels += Object.keys(cell.labels || {}).length;
    }
    return { path, status: res.status, firstDataEventMs: Math.round(performance.now()-t0), rawBytes, models, labels, snapshot_seq: parsed.snapshot_seq ?? null };
  }
  console.log(JSON.stringify([
    await firstDataEvent('/stream?profile=bootstrap'),
    await firstDataEvent('/stream?profile=bootstrap&visible_model_id=100'),
    await firstDataEvent('/stream?profile=bootstrap&visible_model_id=100&visible_model_id=1087'),
  ], null, 2));
  NODE
  ```
- Key output:
  ```json
  [
    { "path": "/stream?profile=bootstrap", "status": 200, "firstDataEventMs": 279, "rawBytes": 155632, "models": 7, "labels": 1998, "snapshot_seq": 2 },
    { "path": "/stream?profile=bootstrap&visible_model_id=100", "status": 200, "firstDataEventMs": 278, "rawBytes": 172145, "models": 8, "labels": 2167, "snapshot_seq": 2 },
    { "path": "/stream?profile=bootstrap&visible_model_id=100&visible_model_id=1087", "status": 200, "firstDataEventMs": 223, "rawBytes": 198672, "models": 9, "labels": 2456, "snapshot_seq": 2 }
  ]
  ```
- Result: PASS. SSE initial snapshot is profile-aware and no longer silently restores the old full snapshot path.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  DY_PW_SESSION=dy-0418 scripts/ops/playwright_session_guard.sh cleanup
  DY_PW_SESSION=dy-0418 scripts/ops/playwright_session_guard.sh session open http://localhost:30900/#/ --headed
  # Browser actions:
  # 1. open desktop
  # 2. inject EventSource URL recorder
  # 3. open E2E 颜色生成器
  # 4. type "latency check"
  # 5. click Generate Color as guest
  # 6. return desktop and open slid-in To Do Board
  ```
- Key output:
  ```json
  {
    "color_generator": {
      "eventSourceUrls": ["http://localhost:30900/stream?profile=bootstrap&visible_model_id=100"],
      "perf": [
        "http://localhost:30900/snapshot?profile=bootstrap",
        "http://localhost:30900/stream?profile=bootstrap",
        "http://localhost:30900/snapshot?profile=visible&model_id=100"
      ],
      "has100": true,
      "outerScroll": "none"
    },
    "todo_board": {
      "eventSourceUrls": ["http://localhost:30900/stream?profile=bootstrap&visible_model_id=100&visible_model_id=1087"],
      "perf": ["http://localhost:30900/snapshot?profile=visible&model_id=100&model_id=1087"],
      "has1087": true,
      "outerScroll": "none"
    },
    "guestWriteGate": {
      "request": "POST /bus_event",
      "status": 401,
      "error": "login_required",
      "modal": "需要登录"
    }
  }
  ```
- Result: PASS with auth boundary recorded. Desktop loads as guest/read-only, app list is visible, E2E color generator and slid-in To Do Board load their app bodies lazily through visible profile requests, stream reconnects with `visible_model_id`, input text remains visible locally, and outer document/body dimensions match the viewport. Clicking Generate Color without an `app:write` OIDC session is correctly blocked by `401 login_required` and the login modal. This run therefore verifies the deployed browser read/lazy-hydration path and auth gate; a real color mutation browser test still requires an authenticated principal with `app:write`.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  DY_PW_SESSION=dy-0418 scripts/ops/playwright_session_guard.sh session eval '() => {
    const rows = [...document.querySelectorAll("*")].map((el, idx) => {
      const cs = getComputedStyle(el);
      const canY = el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(cs.overflowY);
      const canX = el.scrollWidth > el.clientWidth + 1 && /(auto|scroll)/.test(cs.overflowX);
      if (!canY && !canX) return null;
      const before = { left: el.scrollLeft, top: el.scrollTop };
      if (canY) el.scrollTop = el.scrollHeight;
      if (canX) el.scrollLeft = el.scrollWidth;
      return { idx, tag: el.tagName.toLowerCase(), canY, canX, movedY: el.scrollTop > before.top, movedX: el.scrollLeft > before.left };
    }).filter(Boolean);
    return {
      count: rows.length,
      rows,
      outer: {
        docW: document.documentElement.scrollWidth,
        docCW: document.documentElement.clientWidth,
        docH: document.documentElement.scrollHeight,
        docCH: document.documentElement.clientHeight,
        bodyW: document.body.scrollWidth,
        bodyCW: document.body.clientWidth,
        bodyH: document.body.scrollHeight,
        bodyCH: document.body.clientHeight,
      },
    };
  }'
  ```
- Key output:
  ```json
  {
    "count": 0,
    "rows": [],
    "outer": {
      "docW": 1280,
      "docCW": 1280,
      "docH": 720,
      "docCH": 720,
      "bodyW": 1280,
      "bodyCW": 1280,
      "bodyH": 720,
      "bodyCH": 720
    }
  }
  ```
- Result: PASS. The checked To Do Board viewport had no scrollable inner containers and no outer overflow, so there was no unreachable inner-scroll content in this browser state.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  DY_PW_SESSION=dy-0418 scripts/ops/playwright_session_guard.sh session eval '() => {
    const button = [...document.querySelectorAll("button")].find((node) => String(node.textContent || "").includes("新增任务"));
    if (!button) throw new Error("add_task_button_not_found");
    button.click();
    return true;
  }'
  ```
- Key output:
  ```text
  POST http://localhost:30900/bus_event => 401 Unauthorized
  Modal: 需要登录 / 登录后可以继续当前操作。
  ```
- Result: PASS with auth boundary recorded. The To Do Board create-task operation is a business write and is correctly blocked for guest/read-only users. Browser create/edit mutation requires a principal with `app:write`; the current local Playwright session has no such OIDC login state.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
  node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs
  node scripts/tests/test_0415_reactive_projection_store_contract.mjs
  node scripts/tests/test_0416_post_load_projection_latency_contract.mjs
  node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
  node scripts/tests/test_0412_local_latency_trace_contract.mjs
  node scripts/validate_ui_ast_v0x.mjs --case all
  node scripts/validate_builtins_v0.mjs
  npm -C packages/ui-model-demo-frontend run build
  ```
- Key output:
  ```text
  PASS 7/7
  PASS test_0414_snapshot_delta_sse_contract: 7 passed
  PASS test_0415_reactive_projection_store_contract: 4 passed
  PASS test_0416_post_load_projection_latency_contract: 7 passed
  PASS 9/9
  PASS test_0412_local_latency_trace_contract: 11 passed
  summary: PASS
  VALIDATION RESULTS
  local_mqtt: PASS
  global_mqtt: PASS
  model_type: PASS
  data_type: PASS
  sys_worker_id: PASS
  pin.connect.label: PASS
  pin.connect.cell: PASS
  removed pin.connect.model: PASS
  run_<func> (registered): PASS
  run_<func> (missing): PASS
  ✓ built in 3.38s
  ```
- Result: PASS. Fixed the sub-agent finding in frontend stale visible-id recovery. If a combined visible request fails because old visible IDs are stale, the client now retries the newly opened target model alone, revalidates already hydrated visible models individually, drops only truly stale models from local projection, and reconnects the stream with every still-valid visible model ID.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh
  DY_PW_SESSION=dy-0418 scripts/ops/playwright_session_guard.sh cleanup
  DY_PW_SESSION=dy-0418 scripts/ops/playwright_session_guard.sh session open http://localhost:30900/#/ --headed
  ```
- Key output:
  ```text
  ui-server-98d7555d5-24rwm           1/1     Running
  mbr-worker-bd7c44b67-bw88q          1/1     Running
  remote-worker-5995965db-d55j6       1/1     Running
  workspace-manager-b7d8d68c8-g5njn   1/1     Running
  UI Server: http://localhost:30900
  Loaded asset: http://localhost:30900/assets/index-2_-ha50W.js
  ```
- Result: PASS. The stale visible-id recovery fix was rebuilt into the Docker image, redeployed locally, and loaded in a clean browser session.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  # Browser actions on the redeployed build:
  # 1. open E2E 颜色生成器 from desktop
  # 2. return desktop
  # 3. open slid-in To Do Board
  # 4. inspect performance entries, EventSource URLs, loaded models, and scroll dimensions
  ```
- Key output:
  ```json
  {
    "color": {
      "eventSourceUrls": ["http://localhost:30900/stream?profile=bootstrap&visible_model_id=100"],
      "perf": [
        "http://localhost:30900/snapshot?profile=bootstrap",
        "http://localhost:30900/stream?profile=bootstrap",
        "http://localhost:30900/snapshot?profile=visible&model_id=100"
      ],
      "has100": true,
      "outer": { "docW": 1280, "docCW": 1280, "docH": 720, "docCH": 720 }
    },
    "todo": {
      "eventSourceUrls": ["http://localhost:30900/stream?profile=bootstrap&visible_model_id=100&visible_model_id=1087"],
      "perf": ["http://localhost:30900/snapshot?profile=visible&model_id=100&model_id=1087"],
      "has100": true,
      "has1087": true,
      "outer": { "docW": 1280, "docCW": 1280, "docH": 720, "docCH": 720 },
      "innerScrolls": 0
    }
  }
  ```
- Result: PASS. On the redeployed build, the browser opens multiple visible apps without dropping existing visible subscriptions: color model 100 remains loaded and subscribed when To Do Board model 1087 opens, and the stream URL carries both `visible_model_id=100` and `visible_model_id=1087`.

- Review Index 6:
  - Reviewer: sub-agent `019ed75b-42d4-7910-ac4a-8788f14af18a`
  - Decision: CHANGE_REQUESTED
  - Findings fixed in this follow-up:
    - client snapshots could still leak nested JSON secrets (`access_token`, `matrix_token`, `passwd`, `refresh_token`, etc.) through ordinary json labels or `v1nConfig`;
    - a late older visible-model response could overwrite model data already refreshed by a newer visible response;
    - stale visible-id recovery handled `model_not_found` but not `model_not_visible`;
    - runlog browser evidence needed to keep read/lazy-hydration PASS separate from guest write auth-boundary evidence.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
  node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs
  node scripts/tests/test_0415_reactive_projection_store_contract.mjs
  node scripts/tests/test_0416_post_load_projection_latency_contract.mjs
  node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
  node scripts/tests/test_0412_local_latency_trace_contract.mjs
  node scripts/tests/test_0329_bus_event_last_op_id_snapshot_contract.mjs
  node scripts/tests/test_0239_home_selector_model0_contract.mjs
  node scripts/validate_ui_ast_v0x.mjs --case all
  node scripts/validate_builtins_v0.mjs
  npm -C packages/ui-model-demo-frontend run build
  npm -C packages/ui-model-demo-frontend run test
  git diff --check
  ```
- Key output:
  ```text
  PASS 7/7
  PASS test_0414_snapshot_delta_sse_contract: 7 passed
  PASS test_0415_reactive_projection_store_contract: 4 passed
  PASS test_0416_post_load_projection_latency_contract: 7 passed
  PASS 9/9
  PASS test_0412_local_latency_trace_contract: 11 passed
  PASS test_0329_bus_event_last_op_id_snapshot_contract
  5 passed, 0 failed out of 5
  summary: PASS
  VALIDATION RESULTS ... removed pin.connect.model: PASS
  ✓ built in 3.02s
  editor_*: PASS
  ```
- Result: PASS. Server snapshots now recursively sanitize client-visible secret keys/values, including nested JSON labels and `v1nConfig`. Frontend visible snapshot merging now preserves already-loaded newer model content when an older visible response arrives late. `model_not_visible` now triggers the same stale visible-id recovery path as `model_not_found`.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
  npm -C packages/ui-model-demo-frontend run build
  SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh
  DY_PW_SESSION=dy-0418 scripts/ops/playwright_session_guard.sh cleanup
  DY_PW_SESSION=dy-0418 scripts/ops/playwright_session_guard.sh session open http://localhost:30900/#/ --headed
  # Open E2E 颜色生成器, return desktop, then open slid-in To Do Board.
  ```
- Key output:
  ```text
  PASS 7/7
  dist/assets/index-Bq6z8qB4.js
  ui-server-6bcddd8c57-prv55          1/1     Running
  mbr-worker-568c4f6c6c-qk9f9         1/1     Running
  remote-worker-8557f78df9-mndf8      1/1     Running
  workspace-manager-dbf75f79f-mc2t5   1/1     Running
  ```
- Browser key output:
  ```json
  {
    "assetUrls": [
      "http://localhost:30900/assets/index-Cxdet_aj.css",
      "http://localhost:30900/assets/index-Bq6z8qB4.js"
    ],
    "subscriptionState": {
      "visibleModelIds": [100, 1087],
      "expectedStreamUrl": "http://localhost:30900/stream?profile=bootstrap&visible_model_id=100&visible_model_id=1087",
      "eventSourceUrl": "http://localhost:30900/stream?profile=bootstrap&visible_model_id=100&visible_model_id=1087",
      "eventSourceReadyState": 1
    },
    "hasColorModel": true,
    "hasTodoModel": true,
    "textChecks": { "todo": true, "columns": true },
    "outerOverflow": { "outerX": false, "outerY": false }
  }
  ```
- Result: PASS. Final browser verification confirms the active EventSource URL, not only historical browser performance records, carries both visible models. The page is full-viewport without outer overflow; the only scrollable checked container is the intended foreground content area.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  # Browser action: click To Do Board 新增任务 as guest/read-only.
  DY_PW_SESSION=dy-0418 scripts/ops/playwright_session_guard.sh session click e298
  ```
- Key output:
  ```text
  POST http://localhost:30900/bus_event => 401 Unauthorized
  Modal/panel: 需要登录 / 登录后可以继续当前操作。
  ```
- Result: PASS with auth boundary recorded. To Do create-task is a business write and remains blocked without an `app:write` OIDC session. The browser run verifies deployed read/lazy-hydration/stream/overflow behavior and guest write denial; real business mutation in browser still requires an authenticated principal with `app:write`, while the submit/local-overlay path is covered by `test_0417_user_isolated_ui_state_projection_contract.mjs`.

- Command:
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  DY_PW_SESSION=dy-0418 scripts/ops/playwright_session_guard.sh cleanup
  DY_PW_SESSION=dy-0418 scripts/ops/playwright_session_guard.sh check-clean
  ```
- Key output:
  ```text
  PASS: no project Playwright session or project Playwright-managed browser process remains for dy-0418
  PASS: no project Playwright session or project Playwright-managed browser process remains for dy-0418
  ```
- Result: PASS. The browser verification did not leave project Playwright/Chrome processes behind.

- Current local latency/size measurement:
  ```json
  {"path":"/snapshot?profile=bootstrap","status":200,"ms":435.9,"bytes":155595,"models":7,"labels":1998}
  {"path":"/snapshot?profile=visible&model_id=100","status":200,"ms":489,"bytes":172106,"models":8,"labels":2167}
  {"path":"/snapshot?profile=visible&model_id=100&model_id=1087","status":200,"ms":309.9,"bytes":198633,"models":9,"labels":2456}
  {"path":"/stream?profile=bootstrap","status":200,"firstDataEventMs":307,"rawBytes":21749}
  {"path":"/stream?profile=bootstrap&visible_model_id=100&visible_model_id=1087","status":200,"firstDataEventMs":373.6,"rawBytes":24645}
  ```
- Result: OBSERVED. The large remaining payload is still dominated by bootstrap/visible ModelTable label volume. 0418 reduces post-load scope and keeps interaction patches small, but further payload reduction should target high-cardinality labels such as workspace app registry/editor options and more granular per-model/per-label subscriptions.
- Commit: pending

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md` reviewed
- [x] `docs/ssot/ui_to_matrix_event_flow.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
