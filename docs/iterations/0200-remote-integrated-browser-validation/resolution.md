---
title: "Iteration 0200-remote-integrated-browser-validation Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0200-remote-integrated-browser-validation
id: 0200-remote-integrated-browser-validation
phase: phase1
---

# Iteration 0200-remote-integrated-browser-validation Resolution

## Execution Strategy

- 先确认并补齐 cloud deploy 链中 `ui-side-worker` 的缺口。
- 再按 canonical 远端路径做 source sync、build/import、rollout。
- 之后执行脚本级 smoke、Playwright、人工浏览器复核，形成完整远端证据链。
- 最后收口 runlog / `docs/ITERATIONS`，确保 `0200` 的完成标准可审计。

## Step 1

- Scope:
  - 审计远端 deploy 链现状
  - 补齐 `ui-side-worker` 的 cloud deploy 接线
  - 确认远端 preflight 与白名单操作满足 `REMOTE_OPS_SAFETY`
- Files:
  - `scripts/ops/sync_cloud_source.sh`
  - `scripts/ops/deploy_cloud_full.sh`
  - `scripts/ops/deploy_cloud_app.sh`
  - `scripts/ops/remote_preflight_guard.sh`
  - `k8s/cloud/workers.yaml`
  - `k8s/cloud/ui-side-worker.yaml`
- Verification:
  - `rg -n "ui-side-worker|dy-ui-side-worker|rollout restart|docker save" scripts/ops/deploy_cloud_full.sh scripts/ops/deploy_cloud_app.sh k8s/cloud -g '*.sh' -g '*.yaml'`
  - `rg -n "REMOTE_OPS_SAFETY|kubectl apply/delete/get/describe/logs/exec/port-forward ONLY|docker build / docker save / docker load" CLAUDE.md`
  - `bash scripts/ops/sync_cloud_source.sh --help`
  - `bash scripts/ops/deploy_cloud_full.sh --help`
- Acceptance:
  - `ui-side-worker` 的 cloud deploy 入口明确，且与 `0199` 本地链路对齐
  - 本轮不会使用白名单外运维操作
- Rollback:
  - 回退本轮 deploy 脚本 / manifest 链接线改动

## Step 2

- Scope:
  - 使用 canonical 远端路径执行部署
  - 验证 rollout 与服务可达性
- Files:
  - 远端工作副本
  - `deploy/env/cloud.env`
  - `deploy/env/cloud.generated.env`
  - 必要时 cloud deploy 脚本与 manifest
- Verification:
  - `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision "$(git rev-parse HEAD)"`
  - `ssh drop@124.71.43.80 'sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh --rebuild'`
  - `ssh drop@124.71.43.80 'sudo -n bash -lc "export KUBECONFIG=/etc/rancher/rke2/rke2.yaml; kubectl -n dongyu get pods -o wide"'`
  - `ssh drop@124.71.43.80 'sudo -n bash -lc "export KUBECONFIG=/etc/rancher/rke2/rke2.yaml; kubectl -n dongyu get svc && kubectl -n dongyu get ingress"'`
- Acceptance:
  - `ui-server / mbr-worker / remote-worker / ui-side-worker` 均在远端 rollout 成功
  - 远端入口地址与必要 token/room 信息可用于后续验证
- Rollback:
  - 回滚到上一版镜像/tag
  - 若只改了 deploy 链接线，则回退对应脚本与 manifest

## Step 3

- Scope:
  - 执行远端脚本级 smoke / roundtrip
  - 执行 Playwright 验证
  - 执行人工浏览器复核
- Files:
  - 现有 smoke / roundtrip 脚本
  - 必要时新增远端专用验证脚本
  - `output/playwright/`
  - runlog 证据
- Verification:
  - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url <remote-base-url>`
  - 若 `ui-side-worker` 无公网地址：
    - `kubectl -n dongyu port-forward svc/ui-side-worker <local-port>:9101`
    - 浏览器访问本地桥接地址进行验证
  - Playwright：
    - 远端 `ui-server` 页面操作
    - 远端或桥接后的 `ui-side-worker` 页面/接口可视验证
  - 人工浏览器动作：
    - Model100 submit roundtrip
    - Workspace 打开资产/角色页面
    - UI-side worker flow
- Acceptance:
  - 脚本 smoke PASS
  - Playwright PASS
  - 人工浏览器 PASS
  - 截图 / 页面证据齐全
- Rollback:
  - 回退本轮新增的验证脚本或桥接辅助脚本

## Step 4

- Scope:
  - 收口 runlog / `docs/ITERATIONS`
  - 记录远端证据与未决风险
- Files:
  - `docs/iterations/0200-remote-integrated-browser-validation/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - runlog 记录：
    - 远端地址
    - source sync revision
    - deploy 命令
    - rollout 结果
    - Playwright 结果
    - 人工浏览器步骤与截图
  - `docs/ITERATIONS` 状态与 runlog 一致
- Acceptance:
  - `0200` 的证据链完整
  - 若失败，也明确落点与 blocker，而非模糊状态
- Rollback:
  - 回退 docs vault 中本轮记录
