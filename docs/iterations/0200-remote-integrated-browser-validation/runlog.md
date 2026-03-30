---
title: "Iteration 0200-remote-integrated-browser-validation Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0200-remote-integrated-browser-validation
id: 0200-remote-integrated-browser-validation
phase: phase3
---

# Iteration 0200-remote-integrated-browser-validation Runlog

## Environment

- Date: 2026-03-20
- Branch: `dropx/dev_0200-remote-integrated-browser-validation`
- Runtime: local repo + docs vault

Review Gate Record
- Iteration ID: 0200-remote-integrated-browser-validation
- Review Date: 2026-03-20
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户已明确确认：`0200 通过 Gate，可以开始实施`
  - 本轮最初目标为远端 4 角色链路部署与浏览器级验收

Review Gate Record
- Iteration ID: 0200-remote-integrated-browser-validation
- Review Date: 2026-03-20
- Review Type: User
- Review Index: 2
- Decision: On Hold
- Notes:
  - 用户明确要求：先在本地完成“所有模型从持久化目录进入系统”的架构前置，再执行远端部署
  - `0200` 因此暂停，不进入 Phase 3
  - 后续由 `0200a-persisted-asset-loader-freeze` 先冻结 loader 规约与本地落地边界

Review Gate Record
- Iteration ID: 0200-remote-integrated-browser-validation
- Review Date: 2026-03-20
- Review Type: Derived from 0200c evidence
- Review Index: 3
- Decision: Approved
- Notes:
  - `0200c-local-loader-validation` 已完成
  - clean deploy / patch-only / restore / smoke 全部通过
  - 本地 prerequisites 已清除，可恢复远端执行

## Execution Records

### Step 1

- Command:
  - `git checkout -b dropx/dev_0200-remote-integrated-browser-validation`
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0200-remote-integrated-browser-validation --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - `rg -n "ui-side-worker|dy-ui-side-worker|rollout restart|docker save" scripts/ops/deploy_cloud_full.sh scripts/ops/deploy_cloud_app.sh k8s/cloud -g '*.sh' -g '*.yaml'`
  - `rg -n "REMOTE_OPS_SAFETY|kubectl apply/delete/get/describe/logs/exec/port-forward ONLY|docker build / docker save / docker load" CLAUDE.md`
  - 本地刷新最新 `dev`：
    - `git switch dev`
    - `bash scripts/ops/check_runtime_baseline.sh`
    - `bash scripts/ops/deploy_local.sh`
    - 浏览器打开 `http://127.0.0.1:30900/#/workspace?ts=...`
    - 读取 `http://127.0.0.1:30900/snapshot`
  - 远端 deploy user 验证：
    - `ssh -o BatchMode=yes drop@124.71.43.80 'whoami; sudo -n true'`
    - `ssh -o BatchMode=yes drop@124.71.43.80 "sudo -n bash -lc 'export KUBECONFIG=/etc/rancher/rke2/rke2.yaml; kubectl get nodes -o name | head -n 5; docker info >/dev/null 2>&1; ctr version >/dev/null 2>&1'"`
    - `ssh -o BatchMode=yes drop@124.71.43.80 'stat -c "%U %G %a %n" /home/wwpic/dongyuapp'`
- Key output:
  - 已确认 `0200` 相关分支与脚手架已创建
  - 已确认 `deploy_cloud_full.sh` 当前尚未纳入 `ui-side-worker`
  - 已确认 `k8s/cloud/ui-side-worker.yaml` 已存在，因此缺口在 deploy 链，不在 manifest
  - 已确认本地集群已刷新到最新 `dev`
  - 已确认本地 `ui_page_catalog_json` 已是最新值：
    - `gallery/docs/static` = `nav_visible: false`
  - 本轮执行重点因此锁定为：
    - 先补远端 deploy 链
    - 再做远端验证
  - 已确认远端 canonical deploy SSH user 应为 `drop`：
    - `drop` 具备 `sudo -n`
    - `kubectl/docker/ctr` 需通过 `sudo -n` 使用
    - canonical repo 仍在 `/home/wwpic/dongyuapp`
    - repo owner 为 `wwpic`
    - `drop` 对该 repo 无直接写权限，因此 `sync_cloud_source.sh` 必须通过 `sudo -u wwpic` 代持写入
- Result: PASS
- Commit: N/A

### Step 2

- Command:
  - canonical SSH / sync / deploy path:
    - `ssh -o BatchMode=yes drop@app.dongyudigital.com 'echo SSH_OK && whoami && hostname'`
    - `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host app.dongyudigital.com --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision "<branch-head>"`
    - 远端缺失 `deploy/env/cloud.env` 时，仅在缺失场景下：
      - `cp /home/wwpic/dongyuapp/deploy/env/cloud.env.example /home/wwpic/dongyuapp/deploy/env/cloud.env`
    - `ssh drop@app.dongyudigital.com 'sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh'`
- Key output:
  - canonical deploy SSH user 确认是 `drop@app.dongyudigital.com`
  - `drop + sudo -n` 可用：
    - `kubectl`
    - `docker`
    - `ctr`
  - remote repo 仍是 `/home/wwpic/dongyuapp`，owner 为 `wwpic`
  - `sync_cloud_source.sh` 已通过 `sudo -u wwpic` 成功落盘 `.deploy-source-revision`
  - `deploy_cloud_full.sh` 成功完成：
    - persisted assets sync
    - 4 角色 image build/import
    - `ui-server / mbr-worker / remote-worker / ui-side-worker` rollout
    - `ui-server` source hash gate PASS
    - snapshot runtime gate PASS
  - cloud authoritative asset root：
    - `/home/wwpic/dongyu/volume/persist/assets`
    - `manifest.v0.json` 版本为 `dy.asset_manifest.v0`
    - scope 包含：
      - `ui-server`
      - `mbr-worker`
      - `remote-worker`
      - `ui-side-worker`
- Result: PASS
- Commit:
  - `07aae6b` `fix(ops): use drop for cloud deploy ssh [0200]`
  - `d661ce0` `build(cloud): externalize assets for remote deploy [0200]`
  - `5d98c2d` `fix(ops): accept archive revision in cloud deploy [0200]`
  - `ea7304c` `fix(ops): drop legacy prompt gate in cloud deploy [0200]`
  - `fbee90b` `fix(cloud): separate mbr and ui docs [0200]`

### Step 3

- Command:
  - 脚本级 smoke:
    - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url https://app.dongyudigital.com`
    - `ssh drop@app.dongyudigital.com 'sudo -n bash -lc "export KUBECONFIG=/etc/rancher/rke2/rke2.yaml; bash /home/wwpic/dongyuapp/scripts/ops/verify_ui_side_worker_snapshot_delta.sh"'`
  - 浏览器动作:
    - `https://app.dongyudigital.com/#/workspace`
      - 从资产树点击 `Gallery -> Open`
    - 远端 patch-only 验证 `nav_catalog_ui.json`
      - `Prompt -> Prompt REMOTE HOT`
      - `kubectl rollout restart deployment/ui-server`
      - 浏览器清空本地缓存层后看到 `Prompt REMOTE HOT`
      - restore 后再次看到 `Prompt`
    - `ui-side-worker` 桥接浏览器验证
      - 通过远端 `kubectl port-forward` + 本地 SSH tunnel 暴露：
        - `http://127.0.0.1:19102/value`
        - `http://127.0.0.1:19103/value`
      - patch-only 修改 `roles/ui-side-worker/patches/10_ui_side_worker_demo.json`
        - `slide_demo_text -> SEED:world`
      - `kubectl rollout restart deployment/ui-side-worker`
      - 浏览器看到 `{"slide_demo_text":"SEED:world"}`
      - restore 后浏览器看到 `{"slide_demo_text":""}`
- Key output:
  - `Model100 roundtrip`：PASS
    - submit 返回 `result=ok`
    - `bg_color` 发生变化
    - final `status=processed`
    - `system_ready=true`
  - `Workspace 资产入口`：PASS
    - `Gallery` 可从资产树 `Open`
    - 浏览器右侧成功显示 `Gallery`
  - `ui-side-worker snapshot_delta` 脚本：PASS
    - `/value` 观察到 `ACK:hello`
  - 远端部署层外挂化：PASS
    - 改远端 authoritative asset
    - 不重建镜像
    - 仅 rollout restart
    - `/snapshot` 与真实浏览器都能观察到变化
- Result: PASS
- Commit: N/A

### Step 4

- Scope:
  - 汇总远端证据
  - 标记迭代完成
- Result:
  - `0200` 达到 DoD
  - 远端 4 角色链路、脚本 smoke、浏览器动作、patch-only 外挂化证据均已完成
- Commit: N/A

## Docs Updated

- [x] `docs/ITERATIONS.md` reviewed
- [x] `/Users/drop/Documents/drip/Projects/dongyuapp/plans/2026-03-19-worker-tier2-audit-and-rollout-plan.md` reviewed
- [x] `docs/iterations/0199-local-integrated-browser-validation/*` reviewed
- [x] `docs/iterations/0200-remote-integrated-browser-validation/*` updated
- [x] remote browser evidence copied to repo:
  - [0200-remote-patch-only-hot.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/0200-remote-patch-only-hot.png)
  - [0200-remote-patch-only-restored.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/0200-remote-patch-only-restored.png)
  - [0200-remote-workspace-gallery-open.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/0200-remote-workspace-gallery-open.png)
  - [0200-remote-ui-side-hot.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/0200-remote-ui-side-hot.png)
  - [0200-remote-ui-side-restored.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/0200-remote-ui-side-restored.png)
