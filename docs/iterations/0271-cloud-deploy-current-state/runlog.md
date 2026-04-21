---
title: "Iteration 0271-cloud-deploy-current-state Run Log"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0271-cloud-deploy-current-state
id: 0271-cloud-deploy-current-state
phase: phase3
---

# Iteration 0271-cloud-deploy-current-state Run Log

## Environment

- OS: macOS
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Branch: `dev_0271-cloud-deploy-current-state`

### Review Gate Records (FACTS)
```text
Review Gate Record
- Iteration ID: 0271-cloud-deploy-current-state
- Review Date: 2026-04-01
- Review Type: User
- Reviewer: user
- Review Index: 1
- Decision: Approved
- Notes: user requested a new iteration and approved deploying current state to the remote cloud environment.
```

## Step 1 — Freeze target revision and connectivity

- Local target revision:
  - `git rev-parse --short HEAD`
  - output: `b92bc46`
- SSH facts:
  - `ssh -o BatchMode=yes drop@dongyudigital.com 'echo SSH_OK'`
  - result: connection closed by remote host
  - `ssh -o BatchMode=yes drop@124.71.43.80 'echo SSH_OK && test -d /home/wwpic/dongyuapp && echo REMOTE_REPO_OK && sudo -n true && echo SUDO_OK'`
  - result: `SSH_OK`, `REMOTE_REPO_OK`, `SUDO_OK`

Decision:
- canonical reachable host for this run = `124.71.43.80`
- remote repo = `/home/wwpic/dongyuapp`

## Step 2 — Sync source to cloud

- Command:
  - `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision b92bc46`
- Facts:
  - remote repo was not directly usable for checkout of local short rev
  - script auto-fell back to archive sync
  - final returned revision marker:
    - `b92bc46`

PASS:
- remote source synced to target revision marker `b92bc46`

## Step 3 — Run cloud deploy

### Attempt A — canonical full deploy with `--rebuild`

- Command:
  - `ssh drop@124.71.43.80 'sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh --rebuild'`
- Facts:
  - preflight/source gate/secret sync/assets sync all passed
  - blocking point was remote `docker build` at `Dockerfile.ui-server` apt step
  - process stayed in `apt-get update` for minutes with repeated retry output
- Result:
  - deployment not completed

### Attempt B — canonical full deploy without `--rebuild`

- Command:
  - `ssh drop@124.71.43.80 'sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh'`
- Facts:
  - same blocking point at remote `ui-server` build apt step
- Result:
  - deployment not completed

### Attempt C — wrong-arch local image import (rejected)

- Actions:
  - exported local `dy-ui-server:v1` from Apple Silicon host
  - imported it to remote containerd
  - restarted `ui-server`
- Facts:
  - remote `ui-server` pods entered `CrashLoopBackOff`
  - logs:
    - `exec /usr/local/bin/docker-entrypoint.sh: exec format error`
- Root cause:
  - imported local arm64 image onto amd64 remote host

### Recovery + final successful path

- Built local amd64 image:
  - `docker buildx build --platform linux/amd64 -f k8s/Dockerfile.ui-server -t dy-ui-server:v1-amd64 --load .`
- Exported compressed tar:
  - `/tmp/dy-ui-server-b92bc46-amd64.tar.gz` (`168M`)
- Uploaded to remote:
  - `scp /tmp/dy-ui-server-b92bc46-amd64.tar.gz drop@124.71.43.80:/tmp/dy-ui-server-b92bc46-amd64.tar.gz`
- Imported correct amd64 image and switched deployment image:
  - `ssh drop@124.71.43.80 "sudo -n bash -lc 'gunzip -c /tmp/dy-ui-server-b92bc46-amd64.tar.gz | /usr/local/bin/ctr --address /run/k3s/containerd/containerd.sock -n k8s.io images import -'"` (import fact)
  - `ssh drop@124.71.43.80 "sudo -n kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n dongyu set image deployment/ui-server server=dy-ui-server:v1-amd64 && sudo -n kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n dongyu rollout status deployment/ui-server --timeout=300s"`
- Result:
  - `deployment.apps/ui-server image updated`
  - `deployment "ui-server" successfully rolled out`
  - running pod:
    - `ui-server-6f5669fdf-mrf87`

## Step 4 — Verify remote runtime

### Public entry

- `curl -sk -o /tmp/remote_home.html -w '%{http_code}' https://app.dongyudigital.com/`
- result: `200`

### Runtime source hash

- Local current hash:
  - `shasum -a 256 packages/ui-model-demo-server/server.mjs`
  - `54f6051e9ccf102207f2cae1e5fa8b52049afa3f22c3b4dc749bfbb57e55e164`
- Remote pod hash:
  - `ssh drop@124.71.43.80 'sudo -n kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n dongyu exec ui-server-6f5669fdf-mrf87 -- sha256sum /app/packages/ui-model-demo-server/server.mjs'`
  - `54f6051e9ccf102207f2cae1e5fa8b52049afa3f22c3b4dc749bfbb57e55e164`

PASS:
- remote `ui-server` code matches current local authoritative file

### Workspace registry / example visibility

- `curl -sk https://app.dongyudigital.com/snapshot | jq '.snapshot.models["-2"].cells["0,0,0"].labels.ws_apps_registry.v | map(.model_id)'`
- result:
  - `[-103,-100,1,2,100,1001,1002,1003,1004,1005,1007,1009]`

PASS:
- `1009` exists on remote
- `1010` is not exposed as a separate Workspace app

### 0270 remote mode state

- `curl -sk https://app.dongyudigital.com/snapshot | jq '.snapshot.models["1010"].cells["0,0,0"].labels | {generated_color_text: .generated_color_text.v, result_status: .result_status.v, submit_route_mode: .submit_route_mode.v, layout_direction: .layout_direction.v, button_color: .button_color.v}'`
- result:
  - `generated_color_text = "Waiting for result"`
  - `result_status = "idle"`
  - `submit_route_mode = "remote"`
  - `layout_direction = "row"`
  - `button_color = "#2563EB"`

### Public browser evidence

- Opened:
  - `https://app.dongyudigital.com/#/workspace`
- Observed:
  - Workspace page loads
  - sidebar contains `0270 Fill-Table Workspace UI`
  - opening `0270` shows `Input + Confirm + Label`
  - clicking `Confirm` changes `Waiting for result` → `#000000`

### Remote dual-bus evidence

- MBR logs:
  - `recv mgmt ui_event op_id=ws_filltable_1774979700641`
  - `mqtt publish topic=UIPUT/ws/dam/pic/de/sw/1010/event`
  - `recv mqtt topic=UIPUT/ws/dam/pic/de/sw/1010/patch_out`
- remote-worker logs:
  - inbound `1010/event`
  - publish `1010/patch_out`
  - returned patch carries `generated_color_text="#000000"` and `result_status="remote_processed"`

PASS:
- remote 0270 example works on public URL
- remote dual-bus path is effective

## Final Result

- Remote source synced to `b92bc46`
- Remote `ui-server` recovered from wrong-arch crash and now runs current code hash
- Public URL `https://app.dongyudigital.com/#/workspace` is available
- Remote Workspace includes `0270`
- Remote `0270` confirm flow works and has MBR/remote-worker evidence
