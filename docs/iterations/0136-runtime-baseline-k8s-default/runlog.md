---
title: "Iteration 0136-runtime-baseline-k8s-default Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0136-runtime-baseline-k8s-default
id: 0136-runtime-baseline-k8s-default
phase: phase3
---

# Iteration 0136-runtime-baseline-k8s-default Runlog

## Environment

- Date: 2026-02-09
- Branch: dev
- Runtime: node v24.13.0, npm 11.6.2, bun 1.3.8

Review Gate Record
- Iteration ID: 0136-runtime-baseline-k8s-default
- Review Date: 2026-02-09
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: User requested to start K8s baseline, archive local MBR, and treat this mode as default.

## Execution Records

### Step 1

- Command:
  - `docker compose -f ../element-docker-demo/compose.yml up -d`
  - `docker update --restart unless-stopped mosquitto`
  - `kubectl apply -f k8s/*.yaml`
  - `kubectl scale deploy/mbr-worker deploy/remote-worker -n default --replicas=1`
  - `kubectl rollout status deploy/mbr-worker -n default --timeout=180s`
  - `kubectl rollout status deploy/remote-worker -n default --timeout=180s`
  - `kubectl get endpoints remote-worker-svc -n default -o wide`
  - `kubectl delete -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml`
- Key output:
  - `deployment "mbr-worker" successfully rolled out`
  - `deployment "remote-worker" successfully rolled out`
  - `remote-worker-svc   10.1.0.21:8080`
  - `deployment.apps "metrics-server" deleted`
  - Docker runtime includes:
    - `k8s_mbr_mbr-worker-... Up`
    - `k8s_worker_remote-worker-... Up`
    - `mosquitto Up`
    - `element-docker-demo-synapse-1 Up (healthy)`
  - `mosquitto` restart policy: `unless-stopped`
  - Evidence file:
    - `docs/iterations/0136-runtime-baseline-k8s-default/assets/baseline_status.txt`
- Result: PASS
- Commit: N/A

### Step 2

- Command:
  - `mv scripts/run_worker_mbr_v0.mjs archive/scripts/legacy/run_worker_mbr_v0.legacy.mjs`
  - write shim: `scripts/run_worker_mbr_v0.mjs` (default disabled)
  - add ops scripts:
    - `scripts/ops/ensure_runtime_baseline.sh`
    - `scripts/ops/check_runtime_baseline.sh`
  - verify:
    - `bash scripts/ops/ensure_runtime_baseline.sh`
    - `bash scripts/ops/check_runtime_baseline.sh`
- Key output:
  - legacy archived at `archive/scripts/legacy/run_worker_mbr_v0.legacy.mjs`
  - `node scripts/run_worker_mbr_v0.mjs` 默认退出码 `2`（deprecated 阻断）
  - `scripts/ops/check_runtime_baseline.sh`:
    - PASS deploy/mbr-worker readyReplicas=1
    - PASS deploy/remote-worker readyReplicas=1
    - PASS remote-worker-svc has endpoint
    - PASS mosquitto running
    - PASS element synapse running
    - PASS matrix versions endpoint reachable
    - `baseline ready`
  - Evidence files:
    - `docs/iterations/0136-runtime-baseline-k8s-default/assets/legacy_mbr_blocked_stderr.txt`
    - `docs/iterations/0136-runtime-baseline-k8s-default/assets/legacy_mbr_blocked_exitcode.txt`
    - `docs/iterations/0136-runtime-baseline-k8s-default/assets/check_runtime_baseline.txt`
- Result: PASS
- Commit: N/A

### Step 3

- Command:
  - update docs:
    - `AGENTS.md`
    - `docs/deployment/remote_worker_k8s_runbook.md`
    - `docs/deployment/runtime_baseline_default.md`
    - `docs/README.md`
    - `docs/user-guide/color_generator_e2e_runbook.md`
    - `docs/ITERATIONS.md`
  - verify:
    - `rg -n "默认运行基线|ensure_runtime_baseline|check_runtime_baseline|runtime_baseline_default|ALLOW_LEGACY_MBR" __DY_PROTECTED_WL_0__ docs scripts -S`
- Key output:
  - 仓库规约新增“默认运行基线（Docker/K8s）”章节。
  - 远端 worker runbook 改为默认 K8s MBR，不再要求本地 JS MBR。
  - 新增独立文档 `docs/deployment/runtime_baseline_default.md`。
  - color generator runbook 中 MBR 步骤改为 K8s 部署路径。
  - 新增规则：`mbr` 位置“能用则用 ModelTable Cell Label”；不能用时先告知原因并等待 User 讨论确认。
- Result: PASS
- Commit: N/A

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
