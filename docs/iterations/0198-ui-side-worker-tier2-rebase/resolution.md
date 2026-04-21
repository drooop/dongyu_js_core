---
title: "Iteration 0198-ui-side-worker-tier2-rebase Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0198-ui-side-worker-tier2-rebase
id: 0198-ui-side-worker-tier2-rebase
phase: phase1
---

# Iteration 0198-ui-side-worker-tier2-rebase Resolution

## Execution Strategy

- 先锁定 UI-side worker 当前脚本里哪些属于业务初始化，哪些属于最小 host glue。
- 再建立 patch 目录并迁出业务初始化。
- 最后建立部署入口资产并用合同测试回归。

## Step 1

- Scope:
  - 审计 UI-side worker 当前真实入口与行为面：
    - `scripts/run_worker_ui_side_v0.mjs`
    - 相关测试 / 依赖
  - 明确：
    - 哪些手工初始化必须迁入 patch
    - 哪些 HTTP/debug surface 可暂留
- Files:
  - `scripts/run_worker_ui_side_v0.mjs`
  - 相关测试
  - 可能新增的 `deploy/sys-v1ns/ui-side-worker/patches/*`
- Verification:
  - `rg -n "createModel|addFunction|setLabel|snapshot_delta|slide_demo_text|WorkerEngineV0" scripts/run_worker_ui_side_v0.mjs scripts/tests`
- Acceptance:
  - 业务初始化 vs host glue 清单明确
- Rollback:
  - 本步仅记录事实，无代码回滚需求

## Step 2

- Scope:
  - 建立 UI-side worker patch 目录
  - 迁出手工模型/函数/标签初始化
  - 重构脚本为最小 host glue
  - 建立部署入口资产
- Files:
  - `scripts/run_worker_ui_side_v0.mjs`
  - `deploy/sys-v1ns/ui-side-worker/patches/*`
  - 相关 Dockerfile / manifest / deploy asset（若缺失则新增）
  - 相关测试
- Verification:
  - UI-side worker 合同测试
  - `rg -n "createModel|addFunction|setLabel" scripts/run_worker_ui_side_v0.mjs`
  - `rg -n "ui-side-worker|run_worker_ui_side_v0" k8s scripts/ops`
- Acceptance:
  - 脚本中不再保留业务初始化
  - patch 目录与部署入口资产存在
  - 测试通过
- Rollback:
  - 回退脚本、patch 与部署入口资产

## Step 3

- Scope:
  - 收口 runlog / `docs/ITERATIONS`
- Files:
  - `docs/iterations/0198-ui-side-worker-tier2-rebase/runlog`
  - `docs/ITERATIONS`
- Verification:
  - runlog 记录 commit / merge / test evidence / 角色边界说明
  - `docs/ITERATIONS` 状态与 runlog 一致
- Acceptance:
  - 台账完整
- Rollback:
  - 回退 docs vault 中本轮新增记录
