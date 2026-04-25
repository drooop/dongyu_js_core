---
title: "Iteration 0280-cloud-deploy-current-dev Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0280-cloud-deploy-current-dev
id: 0280-cloud-deploy-current-dev
phase: phase3
---

# Iteration 0280-cloud-deploy-current-dev Runlog

## Environment

- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Branch: `dev_0280-cloud-deploy-current-dev`
- Base: `dev`

## Review Gate Record

### Review 1 — User Direct Approval

- Iteration ID: 0280-cloud-deploy-current-dev
- Review Date: 2026-04-03
- Review Type: User
- Review Index: 1
- Decision: **Approved**
- Notes:
  - 用户要求把当前状态部署到远端，并完成颜色生成器、0276 和 Static 验证

## Execution Record

### Step 1 — Freeze Revision / Remote Access PASS

- Local revision:
  - `471f7be`
- Command:
  - `git rev-parse --short HEAD`
  - `ssh -o BatchMode=yes drop@124.71.43.80 'echo SSH_OK && test -d /home/wwpic/dongyuapp && echo REMOTE_REPO_OK && sudo -n true && echo SUDO_OK'`
- Result:
  - `SSH_OK`
  - `REMOTE_REPO_OK`
  - `SUDO_OK`

### Step 2 — Source / Persisted Assets Sync PASS

- Commands:
  - `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision 471f7be`
  - `ssh drop@124.71.43.80 "sudo -n bash -lc 'cd /home/wwpic/dongyuapp && LOCAL_PERSISTED_ASSET_ROOT=/home/wwpic/dongyu/volume/persist/assets bash scripts/ops/sync_local_persisted_assets.sh'"`
- Result:
  - remote git checkout short SHA failed, script fell back to `git archive` sync
  - persisted assets synced to `/home/wwpic/dongyu/volume/persist/assets`

### Step 3 — Canonical Cloud Deploy PASS (with source-gate false negative)

- Command:
  - `ssh drop@124.71.43.80 'sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh --rebuild'`
- Runtime result:
  - `ui-server`
  - `mbr-worker`
  - `remote-worker`
  - `ui-side-worker`
  all reached `READY 1/1`
- Note:
  - deploy script final exit was `1` because its last `ui-server` source gate misreported mismatch
  - independent hash verification proved running pod source already matched local current revision

### Step 3a — Running Remote Source Matches Local PASS

- Commands:
  - `ssh drop@124.71.43.80 "sudo -n -u wwpic bash -lc 'cd /home/wwpic/dongyuapp && sha256sum packages/ui-model-demo-server/server.mjs packages/ui-model-demo-frontend/src/demo_modeltable.js packages/ui-model-demo-frontend/src/local_bus_adapter.js packages/ui-renderer/src/renderer.mjs packages/ui-renderer/src/renderer.js && cat .deploy-source-revision'"`
  - `ssh drop@124.71.43.80 "sudo -n kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n dongyu exec deploy/ui-server -- sha256sum /app/packages/ui-model-demo-server/server.mjs /app/packages/ui-model-demo-frontend/src/demo_modeltable.js /app/packages/ui-model-demo-frontend/src/local_bus_adapter.js /app/packages/ui-renderer/src/renderer.mjs /app/packages/ui-renderer/src/renderer.js"`
- Result:
  - remote repo `.deploy-source-revision = 471f7be`
  - running `ui-server` hashes matched local / remote repo for:
    - `server.mjs`
    - `demo_modeltable.js`
    - `local_bus_adapter.js`
    - `renderer.mjs`
    - `renderer.js`

### Step 4 — Public Entry PASS

- Command:
  - `curl -sk -o /tmp/remote_home_0280.html -w '%{http_code}' https://app.dongyudigital.com/`
- Result:
  - `200`

### Step 4a — Public Workspace Surface PASS

- Public snapshot evidence:
  - `curl -sk https://app.dongyudigital.com/snapshot | jq ...`
- Verified:
  - `ws_apps_registry` contains:
    - `100 E2E 颜色生成器`
    - `1011 Static`
    - `1013 0276 Doc Page Workspace Example`
- Browser evidence:
  - opened `https://app.dongyudigital.com/#/workspace`
  - Workspace asset tree and right-side selected app rendered normally

### Step 4b — Public Color Generator PASS

- Browser steps:
  1. Open Workspace
  2. Keep selected app `E2E 颜色生成器`
  3. Fill input with `remote-0280-20260403-022847`
  4. Click `Generate Color`
- Browser result:
  - color changed from `#0a1949` to `#2d3262`
- Snapshot result:
  - `Model 100 / bg_color = #2d3262`
  - `Model 100 / status = processed`
- Remote chain evidence:
  - `mbr-worker` published `.../100/event` and received `.../100/patch_out`
  - `remote-worker` trace contained inbound `100/event` and publish `100/patch_out`

### Step 4c — Public 0276 PASS

- Browser steps:
  1. Open Workspace
  2. Click `Open` on `0276 Doc Page Workspace Example`
- Browser result:
  - page rendered with visible sections:
    - `Fill-Table Document Surface`
    - `通过填表组成接近 visualized HTML 的文档界面`
    - `结构与编译链`
    - `布局证明`
    - `最短重建步骤`

### Step 4d — Public Static PASS

- Browser steps:
  1. Open Workspace
  2. Click `Open` on `Static`
  3. Click `选择文件`
  4. Upload `/Users/drop/codebase/cowork/dongyuapp_elysia_based/docs/user-guide/workspace_ui_filltable_example_visualized.html`
  5. Click `Upload`
  6. Verify `/p/viz-0280-20260403-022847/`
  7. Click `Delete`
  8. Verify `/p/viz-0280-20260403-022847/` returns `404`
- Browser result:
  - file chooser opened successfully
  - upload status became `uploaded: viz-0280-20260403-022847`
  - mounted list showed `/p/viz-0280-20260403-022847/`
  - delete status became `deleted: viz-0280-20260403-022847`
- HTTP result:
  - before delete: `curl -sk -o /dev/null -w '%{http_code}' https://app.dongyudigital.com/p/viz-0280-20260403-022847/` -> `200`
  - after delete: `curl -sk -o /dev/null -w '%{http_code}' https://app.dongyudigital.com/p/viz-0280-20260403-022847/` -> `404`

## Conclusion

- Current `dev` state was deployed to cloud successfully.
- Public validation completed for:
  - color generator
  - `0276`
  - `Static`
- Iteration status can be closed as `Completed`.
