---
title: "Iteration 0165-cloud-deploy-aaf4083 Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0165-cloud-deploy-aaf4083
id: 0165-cloud-deploy-aaf4083
phase: phase3
---

# Iteration 0165-cloud-deploy-aaf4083 Runlog

## Environment

- Date: 2026-03-06
- Branch: `dev_0164-playwright-readiness-fixes`
- Runtime: local repo + clean deploy worktree

Review Gate Record
- Iteration ID: 0165-cloud-deploy-aaf4083
- Review Date: 2026-03-06
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: 用户明确要求尝试部署到远端。

## Execution Records

### Step 0 — 迭代登记

- Command:
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0165-cloud-deploy-aaf4083 --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Result: PASS
- Commit: N/A

### Step 1 — 干净 deploy worktree

- Command:
  - `git worktree add -b dev_0165-cloud-deploy-aaf4083 /tmp/dongyuapp-deploy-aaf4083-1772768766 aaf4083`
  - `cd /tmp/dongyuapp-deploy-aaf4083-1772768766 && git rev-parse --short HEAD && git status --short`
- Key output:
  - `HEAD = aaf4083`
  - `git status --short` 为空
- Result: PASS
- Commit: N/A

### Step 2 — 远端 deploy 前检

- Command:
  - `ssh dy-cloud 'echo WWPIC_OK'`
  - `ssh dy-cloud-drop 'echo DROP_OK'`
  - `ssh dy-cloud 'test -d /home/wwpic/dongyuapp && echo REPO_OK'`
  - `ssh dy-cloud 'sudo -n true && echo SUDO_OK'`
  - `ssh dy-cloud-drop 'sudo -n true && echo DROP_SUDO_OK'`
- Key output:
  - `wwpic` / `drop` SSH 均可登录
  - 远端仓库 `/home/wwpic/dongyuapp` 存在，`deploy_cloud.sh` / `k8s/Dockerfile.ui-server` / `k8s/cloud/workers.yaml` 在位
  - `sudo -n true` on `wwpic`: `sudo: a password is required`
  - `sudo -n true` on `drop`: `sudo: a password is required`
- Result: FAIL
- Blocking reason:
  - 远端 deploy 脚本 `scripts/ops/deploy_cloud.sh` 需要 `sudo`/root 执行；当前 SSH 身份都无法无交互提权
- Commit: N/A


### Step 2.5 — 本地 build 卡住，切换为远端 clean-source build

- Command:
  - `bash scripts/ops/deploy_cloud_ui_server_from_local.sh --ssh-user drop --ssh-host 124.71.43.80`
- Key output:
  - 本地 `docker build --platform linux/amd64` 在拉取 `oven/bun:latest` 基础层时持续超慢，约 200s 后仍未完成，仅到 `28.31MB / 49.29MB` 与 `7.34MB / 40.35MB`
  - 手动中断本地 build，避免继续占用时间窗口
- Result: PASS（定位完成）
- Decision:
  - 改为将 `aaf4083` 干净源码整体同步到远端 `/home/wwpic/dongyuapp`（保留远端 `deploy/env/*.env` 与 `.env`），然后直接在远端执行 canonical `deploy_cloud.sh` 做构建与发布
- Safety note:
  - 仍然只使用 `aaf4083` clean snapshot 作为部署源；未使用本地脏工作树
- Commit: N/A


### Step 3 — 远端 clean-source sync + canonical deploy

- Command:
  - `rsync -az --exclude '.git' --exclude 'docs' --exclude '.env' --exclude 'deploy/env/cloud.env' --exclude 'deploy/env/local.env' /tmp/dongyuapp-deploy-aaf4083-1772768766/ dy-cloud:/home/wwpic/dongyuapp/`
  - `ssh dy-cloud 'cp /home/wwpic/dongyuapp/k8s/cloud/workers.yaml /home/wwpic/dongyuapp/workers.yaml'`
  - `ssh dy-cloud-drop 'sudo -n /usr/bin/docker build --no-cache -f /home/wwpic/dongyuapp/k8s/Dockerfile.ui-server -t dy-ui-server:aaf4083 /home/wwpic/dongyuapp'`
  - `ssh dy-cloud-drop 'sudo -n /usr/bin/docker tag dy-ui-server:aaf4083 dy-ui-server:v1'`
  - `ssh dy-cloud-drop 'sudo -n /usr/bin/docker save -o /tmp/dy-ui-server-aaf4083-v1.tar dy-ui-server:v1'`
  - `ssh dy-cloud-drop 'sudo -n /usr/bin/bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud.sh --image-tar /tmp/dy-ui-server-aaf4083-v1.tar'`
- Key output:
  - 首次远端 deploy 失败点 1：frontend production build 被 `runtime.mjs` 顶层 `createRequire` 打断（转入 0166 修复）
  - 首次远端 deploy 失败点 2：`workers.yaml` shadow drift，被 pre-flight 阻断；同步 shadow 后恢复
  - 首次 image import 后失败点 3：导入 tar 时镜像 tag 为 `dy-ui-server:aaf4083`，deployment 仍使用 `dy-ui-server:v1`，source gate 识别为 stale image
  - 修复方式：将新镜像补 tag 为 `dy-ui-server:v1`，重新 save/import/deploy
  - 最终结果：`=== Cloud deploy complete ===`
  - `UI Server: https://app.dongyudigital.com`
  - `Matrix Room: !EtkFSbTMNZhSEUmlyi:dongyu.local`
  - `ui-server` runtime source gate 三个 hash 全部命中：`server.mjs` / `demo_modeltable.js` / `local_bus_adapter.js`
- Result: PASS
- Commit: N/A

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed（本轮无需改动）
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed（本轮无需改动）
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed（本轮无需改动）
