---
title: "0290 — slide-ui-phaseC-filltable-create-mount Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-06
source: ai
iteration_id: 0290-slide-ui-phaseC-filltable-create-mount
id: 0290-slide-ui-phaseC-filltable-create-mount
phase: phase1
---

# 0290 — slide-ui-phaseC-filltable-create-mount Resolution

## Execution Strategy

- 本 iteration 仍是 docs-only 计划冻结，不做代码实现。
- 目标是把 `Slide UI Phase C` 的“用户创建与挂载”拆到可执行粒度。
- 实施顺序固定为：
  1. 冻结用户创建 slide app 的最小路径
  2. 冻结 host / truth / registry / mount 分层
  3. 冻结 metadata 最小集
  4. 冻结最小可复制模板
  5. 冻结创建后挂载验证矩阵

## Step 1

- Scope:
  - 写清用户创建 slide app 的最小路径
- Files:
  - `docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/plan.md`
  - `docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/resolution.md`
- Verification:
  - 文档中必须明确：
    - 新建哪些模型
    - 先填什么
    - 后填什么
- Acceptance:
  - 创建路径清晰
- Rollback:
  - 回退本 iteration 文档

## Step 2

- Scope:
  - 冻结 host / truth / registry / mount 的分层规则
- Files:
  - `docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/plan.md`
  - `docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/resolution.md`
- Verification:
  - 文档中必须明确：
    - host 做什么
    - truth 做什么
    - registry entry 做什么
    - mount 声明做什么
- Acceptance:
  - 分层规则清晰
- Rollback:
  - 回退本 iteration 文档

## Step 3

- Scope:
  - 冻结 metadata 最小集
- Files:
  - `docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/plan.md`
  - `docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/resolution.md`
- Verification:
  - 文档中必须明确：
    - 必填 metadata
    - 选填 metadata
- Acceptance:
  - metadata 最小集清晰
- Rollback:
  - 回退本 iteration 文档

## Step 4

- Scope:
  - 冻结一套最小可复制模板
- Files:
  - `docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/plan.md`
  - `docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/resolution.md`
- Verification:
  - 文档中必须明确：
    - 最小字段清单或模板
    - 后续执行阶段可直接照着落表
- Acceptance:
  - 模板清晰
- Rollback:
  - 回退本 iteration 文档

## Step 5

- Scope:
  - 冻结创建后挂载到 Workspace 的最小验证矩阵
- Files:
  - `docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/plan.md`
  - `docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/runlog.md`
- Verification:
  - 文档中必须显式写出：
    - 创建成功
    - 挂载成功
    - 刷新后仍可发现
    - 可打开
- Acceptance:
  - 创建与挂载验证矩阵清晰
- Rollback:
  - 回退本 iteration 文档
