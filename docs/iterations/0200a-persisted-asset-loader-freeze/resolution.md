---
title: "Iteration 0200a-persisted-asset-loader-freeze Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0200a-persisted-asset-loader-freeze
id: 0200a-persisted-asset-loader-freeze
phase: phase1
---

# Iteration 0200a-persisted-asset-loader-freeze Resolution

## Execution Strategy

- 先把当前资产加载链的事实审清，避免把“理想架构”当作“现状”。
- 再冻结统一 loader 规约：
  - 目录
  - manifest
  - phase
  - writeback policy
  - component registry 归属
- 最后只产出实施切分和恢复条件，不在本轮动代码。

## Step 1

- Scope:
  - 审计当前 5 条资产加载路径
  - 记录哪部分是 build-time，哪部分是 runtime load
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/main.js`
  - `scripts/run_worker_v0.mjs`
  - `scripts/run_worker_remote_v1.mjs`
  - `scripts/run_worker_ui_side_v0.mjs`
  - `k8s/Dockerfile.ui-server`
  - `k8s/Dockerfile.mbr-worker`
  - `k8s/Dockerfile.remote-worker`
  - `k8s/Dockerfile.ui-side-worker`
- Verification:
  - `rg -n "with \\{ type: 'json' \\}|loadSystemPatch|MODELTABLE_PATCH_JSON|loadIntoRuntime|applyUiPatch|COPY .*deploy/sys-v1ns|COPY .*worker-base/system-models" packages scripts k8s -g '*.js' -g '*.mjs' -g 'Dockerfile*'`
  - 产出“当前加载路径矩阵”
- Acceptance:
  - 当前加载路径事实被明确区分为：
    - build-time baked
    - startup runtime load
    - browser local persistence overlay
- Rollback:
  - 本步只记录事实，无代码回滚需求

## Step 2

- Scope:
  - 冻结统一 persisted asset loader 规约
  - 明确 manifest 结构与 phase 顺序
  - 明确 writeback / volatile 边界
- Files:
  - `docs/iterations/0200a-persisted-asset-loader-freeze/plan.md`
  - `docs/iterations/0200a-persisted-asset-loader-freeze/resolution.md`
  - 必要时新增一份总设计文档到 docs vault plans
- Verification:
  - 方案中必须明确回答：
    1. authoritative asset 根目录结构
    2. manifest schema
    3. phase 顺序
    4. fallback 排序规则
    5. runtime volatile state 分类
    6. component registry 的动态加载定位
- Acceptance:
  - 设计文本足够让下一轮实现直接开工
  - 不再需要重做“大方向讨论”
- Rollback:
  - 回退本轮 docs 规划文本

## Step 3

- Scope:
  - 将后续实施拆分为具体迭代
  - 给 `0200` 定义恢复条件
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0200-remote-integrated-browser-validation/runlog.md`
  - `docs/iterations/0200a-persisted-asset-loader-freeze/runlog.md`
- Verification:
  - 至少明确拆出：
    - 本地 worker/ui-server patch 外挂化实施
    - 本地验证
    - `0200` 恢复条件
  - `0200` 的 `On Hold` 理由和恢复条件写入 runlog
- Acceptance:
  - `0200` 暂停有明确理由
  - 下一轮实现迭代边界清楚
- Rollback:
  - 回退 docs vault 中本轮新增记录
