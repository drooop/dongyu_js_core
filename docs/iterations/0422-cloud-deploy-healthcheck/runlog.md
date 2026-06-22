---
title: "Iteration 0422 Cloud Deploy Healthcheck Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-06-23
source: ai
iteration_id: 0422-cloud-deploy-healthcheck
id: 0422-cloud-deploy-healthcheck
phase: completed
---

# Iteration 0422-cloud-deploy-healthcheck Runlog

## Deployment

- Branch: `dropx/dev_0422-cloud-deploy-healthcheck`
- Merged to:
  - `dev` at `37c3c81`
  - `main` at `5caf5a2`
- Follow-up documentation merged to:
  - `dev` at `98c6253`
  - `main` at `1db4d3a`
- Remote target:
  - SSH: `drop@124.71.43.80`
  - App URL: `https://app.dongyudigital.com`

## Failure Observed

The first cloud deployment of revision `019335a` built images and rolled out successfully, but the final deploy health check failed:

```text
undefined is not an object (evaluating 's.llm_prompt_available.v')
```

Root cause: `scripts/ops/deploy_cloud_full.sh` still asserted labels that no longer exist in the current bootstrap snapshot.

## Fix Verification

- Local script syntax:
  - `bash -n scripts/ops/deploy_cloud_full.sh`: PASS
- Remote pod bootstrap health expression:
  - `runtime_status=ready worker_role=DEM registry_count=10 snapshot_bytes=154995`: PASS
- Full cloud redeploy:
  - `deploy_cloud_full.sh --revision 5caf5a2 --rebuild`: PASS
  - UI Server: `https://app.dongyudigital.com`
- Final cloud redeploy after documentation merge:
  - `deploy_cloud_full.sh --revision 1db4d3a --rebuild`: PASS
  - Remote `.deploy-source-revision`: `1db4d3a`
  - Deployments ready: `ui-server`, `mbr-worker`, `remote-worker`, `workspace-manager` all `1/1`

## Remote Browser Measurements

Measurement surface: Playwright CLI real browser, unauthenticated guest/read-only desktop path.

| Check | Result |
|---|---:|
| Final root HTML curl | `200`, about `0.237s`, `397B` |
| Final bootstrap snapshot curl | `200`, about `1.879s`, `155683B` |
| Sequential `/auth/me` curl | `401`, about `201ms`, `40B` |
| Sequential bootstrap snapshot curl | `200`, about `1149ms`, `155683B` |
| Parallel `/auth/me` curl | `401`, about `38ms`, `40B` |
| Parallel bootstrap snapshot curl | `200`, about `1293ms`, `155683B` |
| Final browser desktop visible | about `2.17s` |
| Browser outer scroll | none, `scrollWidth=1200`, `scrollHeight=818` |
| `页面暂不可用` / `确认登录中` | not present in final browser result |

Final browser resource timing on successful remote desktop load:

| Resource | Duration | Encoded/decoded size |
|---|---:|---:|
| `/assets/index-Dk9_8B-F.js` | about `403ms` | `2060111B` |
| `/assets/index-Cxdet_aj.css` | about `197ms` | `378914B` |
| `/snapshot?profile=bootstrap&initial_projection=1` | about `1383ms` | `155683B` |

## Snapshot Granularity Notes For Next Stage

- The bootstrap snapshot body is about `155KB` for the current guest/read-only desktop projection.
- The JS bundle is currently much larger than the bootstrap snapshot, about `2.06MB` encoded/decoded in the measured browser session. It can dominate first desktop load under slower transfer conditions, while final warm browser timing showed the bootstrap snapshot taking longer than JS transfer.
- The snapshot still contains multiple model records for desktop shell and registry state, even for the first guest/read-only desktop. The next stage should inspect which labels are required for first paint and which can move to visible/lazy model fetches.
- `/auth/me` is fast when measured alone and in parallel curl. If it appears delayed in browser timing, compare against concurrent JS download and snapshot construction before treating auth as the cause.
