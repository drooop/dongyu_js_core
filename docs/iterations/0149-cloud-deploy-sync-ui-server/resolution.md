---
title: "0149 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0149-cloud-deploy-sync-ui-server
id: 0149-cloud-deploy-sync-ui-server
phase: phase1
---

# 0149 — Resolution (HOW)

## 0. Execution Rules
- Record all remote commands + key outputs in `runlog.md`.
- Avoid prohibited remote ops (no systemctl on rke2/k3s, no network/firewall/CNI changes).
- Use minimal file sync (do not overwrite remote env files).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Sync code to dy-cloud | 仅同步 server.mjs | `packages/ui-model-demo-server/server.mjs` | `ssh dy-cloud 'cmp ... || echo DIFF'` | 远端文件与本地一致 | restore .bak |
| 2 | Build + save image on dy-cloud | 重建 dy-ui-server:v1 并保存 tar | `k8s/Dockerfile.ui-server` | `ssh dy-cloud 'cd ... && docker build ...'` | build 成功且 tar 存在 | rebuild old version |
| 3 | Import image via k8s job | 使用 hostPID+nsenter job 导入 /tmp tar | (job yaml via stdin) | `kubectl -n dongyu wait --for=condition=complete job/...` | job Completed | delete job |
| 4 | Restart + verify ui-server | rollout restart + pods ready | deploy/ui-server | `kubectl rollout status` | ReadyReplicas=1 | rollout restart again / revert image |
| 5 | Playwright e2e on remote | 验证单击只变一次 + sidebar 正常 | (playwright artifacts) | `$PWCLI open ...; snapshot; click ...` | PASS | N/A |

## 2. Step Details

### Step 1 — Sync code to dy-cloud
- Create backup on dy-cloud: `server.mjs.bak.<ts>`
- Copy local `packages/ui-model-demo-server/server.mjs` to `/home/wwpic/dongyuapp/...`.

### Step 2 — Build + save image on dy-cloud
- `docker build --no-cache -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`
- `docker save dy-ui-server:v1 -o /tmp/dy-ui-server-v1.tar`

### Step 3 — Import image via k8s job
- Apply a Job that runs:
  - `nsenter -t 1 -m -u -i -n -- ctr -n k8s.io images import /tmp/dy-ui-server-v1.tar`
  - with `hostPID: true` + `privileged: true` + hostPath mount of `/tmp/dy-ui-server-v1.tar`.

### Step 4 — Restart + verify
- `kubectl -n dongyu rollout restart deployment/ui-server`
- `kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`

### Step 5 — Playwright e2e
- Run Playwright CLI against `https://app.dongyudigital.com`.
- Verify:
  - Button click triggers exactly one stable color change.
  - Sidebar has entries.
