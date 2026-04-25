---
title: "Iteration 0273-cloud-deploy-static-workspace Run Log"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0273-cloud-deploy-static-workspace
id: 0273-cloud-deploy-static-workspace
phase: phase3
---

# Iteration 0273-cloud-deploy-static-workspace Run Log

## Environment

- OS: macOS
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Branch: `dev_0273-cloud-deploy-static-workspace`

### Review Gate Records (FACTS)
```text
Review Gate Record
- Iteration ID: 0273-cloud-deploy-static-workspace
- Review Date: 2026-04-01
- Review Type: User
- Reviewer: user
- Review Index: 1
- Decision: Approved
- Notes: user approved continuing with remote deployment for the new Static Workspace rebuild and asked to finish end-to-end.
```

## Step 1 — Freeze connectivity and revision

- Local revision:
  - `git rev-parse --short HEAD`
  - result: `0483be5`
- Remote reachability:
  - `ssh -o BatchMode=yes drop@124.71.43.80 'echo SSH_OK && test -d /home/wwpic/dongyuapp && echo REMOTE_REPO_OK && sudo -n true && echo SUDO_OK'`
  - result: `SSH_OK`, `REMOTE_REPO_OK`, `SUDO_OK`

## Step 2 — Sync source and assets

- Source sync:
  - `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision 0483be5`
  - remote git checkout failed on short rev
  - script auto-fell back to archive sync
  - final returned revision marker:
    - `0483be5`

- Assets sync:
  - `ssh drop@124.71.43.80 "sudo -n bash -lc 'cd /home/wwpic/dongyuapp && LOCAL_PERSISTED_ASSET_ROOT=/home/wwpic/dongyu/volume/persist/assets bash scripts/ops/sync_local_persisted_assets.sh'"`
  - result:
    - `[sync-local-assets] persisted assets synced to: /home/wwpic/dongyu/volume/persist/assets`

PASS:
- remote source and persisted assets aligned to current repo state

## Step 3 — Publish ui-server current state

### Current-state amd64 image build

- Command:
  - `docker buildx build --platform linux/amd64 -f k8s/Dockerfile.ui-server -t dy-ui-server:v1-amd64-0273 --load .`
- Result:
  - built successfully

### Pack and upload image

- Commands:
  - `docker save -o /tmp/dy-ui-server-0483be5-amd64.tar dy-ui-server:v1-amd64-0273`
  - `gzip -1 -c /tmp/dy-ui-server-0483be5-amd64.tar > /tmp/dy-ui-server-0483be5-amd64.tar.gz`
  - `scp /tmp/dy-ui-server-0483be5-amd64.tar.gz drop@124.71.43.80:/tmp/dy-ui-server-0483be5-amd64.tar.gz`
- Artifact:
  - `/tmp/dy-ui-server-0483be5-amd64.tar.gz` (~168M)

### Import and switch deployment image

- Command:
  - `ssh drop@124.71.43.80 "sudo -n bash -lc 'gunzip -c /tmp/dy-ui-server-0483be5-amd64.tar.gz | /usr/local/bin/ctr --address /run/k3s/containerd/containerd.sock -n k8s.io images import - && kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n dongyu set image deployment/ui-server server=dy-ui-server:v1-amd64-0273 && kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n dongyu rollout status deployment/ui-server --timeout=300s && kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n dongyu get pods -l app=ui-server -o wide'"`
- Key output:
  - `deployment.apps/ui-server image updated`
  - `deployment "ui-server" successfully rolled out`
  - running pod:
    - `ui-server-847b89466b-lmvjp`

### Runtime code hash

- Local:
  - `shasum -a 256 packages/ui-model-demo-server/server.mjs`
  - `7e8686a5416f465283e3545e751b2a37eda0b3855f5fbe553438ea33a6fb9626`
- Remote:
  - `ssh drop@124.71.43.80 'sudo -n kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n dongyu exec ui-server-847b89466b-lmvjp -- sha256sum /app/packages/ui-model-demo-server/server.mjs'`
  - `7e8686a5416f465283e3545e751b2a37eda0b3855f5fbe553438ea33a6fb9626`

PASS:
- remote `ui-server` code matches current local code

## Step 4 — Public verification

### Public entry

- `curl -sk -o /tmp/remote_home.html -w '%{http_code}' https://app.dongyudigital.com/`
- result: `200`

### Remote snapshot

- Workspace registry:
  - `curl -sk https://app.dongyudigital.com/snapshot | jq '.snapshot.models["-2"].cells["0,0,0"].labels.ws_apps_registry.v | map({model_id, name})'`
  - includes:
    - `1011 Static`
- Static truth:
  - `curl -sk https://app.dongyudigital.com/snapshot | jq '.snapshot.models["1012"].cells["0,0,0"].labels | {static_project_name: .static_project_name.v, static_upload_kind: .static_upload_kind.v, static_status: .static_status.v, mounted_path_prefix: .mounted_path_prefix.v}'`
  - result:
    - `static_upload_kind = "zip"`
    - `mounted_path_prefix = "/p/"`

### Public HTML upload

- Opened:
  - `https://app.dongyudigital.com/#/workspace`
- Opened Workspace item:
  - `Static`
- Set project name:
  - `viz-filltable-html-remote`
- Set upload kind:
  - `HTML`
- Uploaded:
  - `docs/user-guide/workspace_ui_filltable_example_visualized.html`
- Observed truth:
  - `static_media_uri = "mxc://dongyu.local/ASdZTefedBzpwRnjJqcpJmyl"`
- Clicked `Upload`
- Page status:
  - `uploaded: viz-filltable-html-remote`
- List entry:
  - `/p/viz-filltable-html-remote/`
- Verified URL:
  - `curl -sk -o /tmp/remote_static_html.out -w '%{http_code}' https://app.dongyudigital.com/p/viz-filltable-html-remote/`
  - result: `200`

### Public ZIP upload

- Set project name:
  - `viz-filltable-zip-remote`
- Set upload kind:
  - `ZIP`
- Uploaded:
  - `/tmp/viz-filltable-zip.zip`
- Observed truth:
  - `static_media_uri = "mxc://dongyu.local/BBcHQKQbEcMvLDaSVorSsogO"`
- Clicked `Upload`
- Page status:
  - `uploaded: viz-filltable-zip-remote`
- List entry:
  - `/p/viz-filltable-zip-remote/`
- Verified URL:
  - `curl -sk -o /tmp/remote_static_zip.out -w '%{http_code}' https://app.dongyudigital.com/p/viz-filltable-zip-remote/`
  - result: `200`

## Final Result

- `0272` Static Workspace rebuild is now deployed on the public cloud environment
- Public Workspace contains `Static`
- Public uploads work for:
  - single HTML
  - ZIP containing `index.html`
- Public serving under `/p/<projectName>/...` works in both cases
