---
title: "Iteration 0136-runtime-baseline-k8s-default Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0136-runtime-baseline-k8s-default
id: 0136-runtime-baseline-k8s-default
phase: phase1
---

# Iteration 0136-runtime-baseline-k8s-default Resolution

## Execution Strategy

先修复运行态（Docker/K8s）并形成可重复脚本，再执行旧入口归档，最后同步规约与部署文档，保证后续默认路径一致。

## Step 1

- Scope:
  - 启动并验证 Docker/K8s 运行基线。
  - 清理误安装的 metrics-server 资源。
- Files:
  - `docs/iterations/0136-runtime-baseline-k8s-default/runlog.md`
  - `docs/iterations/0136-runtime-baseline-k8s-default/assets/*`
- Verification:
  - `docker compose -f ../element-docker-demo/compose.yml up -d`
  - `kubectl scale deploy/mbr-worker deploy/remote-worker -n default --replicas=1`
  - `kubectl rollout status ...`
  - `kubectl get endpoints remote-worker-svc -n default`
  - `kubectl delete -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml`
- Acceptance:
  - K8s 两个 deployment ready，service endpoint 非空，metrics-server 不存在。
- Rollback:
  - 缩容相关 deployment 到 `0`，并记录回退命令。

## Step 2

- Scope:
  - 归档旧 MBR 本地入口并新增默认基线脚本。
- Files:
  - `archive/scripts/legacy/run_worker_mbr_v0.legacy.mjs`
  - `scripts/run_worker_mbr_v0.mjs`
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/check_runtime_baseline.sh`
- Verification:
  - `node scripts/run_worker_mbr_v0.mjs` 默认返回 deprecated 错误码。
  - `bash scripts/ops/ensure_runtime_baseline.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
- Acceptance:
  - 旧入口默认不可误用；新脚本可一键恢复并校验基线。
- Rollback:
  - 将 archive 文件移回原路径，删除 `scripts/ops/*`。

## Step 3

- Scope:
  - 固化默认行动方式到仓库规约与部署文档。
- Files:
  - `AGENTS.md`
  - `docs/deployment/remote_worker_k8s_runbook.md`
  - `docs/deployment/runtime_baseline_default.md`
  - `docs/README.md`
  - `docs/user-guide/color_generator_e2e_runbook.md`
  - `docs/ITERATIONS.md`
  - `docs/iterations/0136-runtime-baseline-k8s-default/runlog.md`
- Verification:
  - `rg -n "默认运行基线|run_worker_mbr_v0|ensure_runtime_baseline|runtime_baseline_default" __DY_PROTECTED_WL_0__ docs -S`
- Acceptance:
  - 文档链路统一到 Docker/K8s 默认模式，并保留 legacy 应急说明。
- Rollback:
  - 回退上述文档文件。

## Notes

- Generated at: 2026-02-09
