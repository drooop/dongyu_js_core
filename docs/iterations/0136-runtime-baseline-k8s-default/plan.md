---
title: "Iteration 0136-runtime-baseline-k8s-default Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0136-runtime-baseline-k8s-default
id: 0136-runtime-baseline-k8s-default
phase: phase1
---

# Iteration 0136-runtime-baseline-k8s-default Plan

## Goal

将运行与测试基线固定为“Docker + K8s 常驻”，归档旧版本地 MBR 入口，并把默认行动方式落盘为仓库规约。

## Scope

In scope:
- 拉起并验证 Docker `element-docker-demo` / `mosquitto` 与 K8s `mbr-worker` / `remote-worker`。
- 将本地 `run_worker_mbr_v0.mjs` 归档并默认禁用。
- 新增/更新基线脚本与部署文档，明确默认路径。
- 处理本次误触发的 `metrics-server` 资源，恢复到“非依赖”状态。

Out of scope:
- 修改 Matrix/MQTT 协议语义。
- 修改业务模型逻辑（Model 100 行为不变）。

## Invariants / Constraints

- 遵循 `AGENTS.md`、`docs/WORKFLOW.md`、`docs/ITERATIONS.md`。
- 默认外部事实源仅 Git/GitHub + 当前可执行命令输出。
- 验证必须给出 PASS/FAIL，不使用主观描述。

## Success Criteria

- `mbr-worker` 与 `remote-worker` 在 K8s 均为 `readyReplicas=1`。
- `remote-worker-svc` 有 endpoint。
- Docker 中 `element-docker-demo-synapse-1` 与 `mosquitto` 为 Running。
- 本地旧 MBR 默认拒绝执行，且有可审计归档路径。
- 文档明确“默认 Docker/K8s 路径 + 本地 UI 侧 worker”执行方式。

## Inputs

- Created at: 2026-02-09
- Iteration ID: 0136-runtime-baseline-k8s-default
