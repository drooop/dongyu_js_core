---
title: "0298 — pin-contract-cleanup Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0298-pin-contract-cleanup
id: 0298-pin-contract-cleanup
phase: phase1
---

# 0298 — pin-contract-cleanup Plan

## Goal

- 在 `0294` 主路径已经迁到新合同后，清理非主路径上的旧 pin family 残留。
- 目标不是再设计一套新合同，而是把仓内还留着的 `pin.table.* / pin.single.* / pin.model.*` 历史痕迹收口掉。

## Background

- `0292` 已冻结新合同：
  - 模型本地 pin 统一收敛到 `pin.in / pin.out`
  - 不引入 `pin.table.*`
  - 不保留 `pin.model.*`
- `0294` 已完成主路径迁移：
  - `model100`
  - `1010`
  - `MBR`
  - `remote-worker`
  - `0270` 主链
- `0294 Review` 已明确留下两类迁移债务：
  - runtime 兼容分支
  - 非主路径 system-model / config / docs 残留

当前已锁定的 cleanup 范围是：
- `packages/worker-base/src/runtime.mjs`
- `packages/worker-base/system-models/intent_handlers_home.json`
- `packages/worker-base/system-models/home_catalog_ui.json`
- `deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json`
- `packages/worker-base/system-models/llm_cognition_config.json`
- `CLAUDE.md` 的 `PIN_SYSTEM`

## Current Residue Snapshot

### 1. runtime compat handler

- `packages/worker-base/src/runtime.mjs`
  - 约 4 处 compat handler：
    - `pin.table.in`
    - `pin.table.out`
    - `pin.single.in`
    - `pin.single.out`

### 2. Home intent handlers

- `packages/worker-base/system-models/intent_handlers_home.json`
  - 9 个 `home_*` input 仍是 `pin.table.in`
  - `handle_home_emit_owner_requests` 仍写 `pin.table.out`

### 3. Home dropdown options

- `packages/worker-base/system-models/home_catalog_ui.json`
  - 仍向调试 CRUD 下拉暴露：
    - `pin.table.in`
    - `pin.table.out`
    - `pin.single.in`
    - `pin.single.out`

### 4. ui-side-worker demo

- `deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json`
  - `owner_request` 仍是 `pin.single.in`
  - `ui_apply_snapshot_delta` 仍写 `pin.table.out` 和旧 `apply_records` 请求体

### 5. prompt / policy text

- `packages/worker-base/system-models/llm_cognition_config.json`
  - prompt 中仍把 `pin.table.* / pin.single.*` 当作可理解的 structural types 说明给 LLM

### 6. hard rule doc

- `CLAUDE.md`
  - `PIN_SYSTEM` 仍写着：
    - `pin.model.in`
    - `pin.model.out`
    - `pin.log.model.in`
    - `pin.log.model.out`
  - 这和 `0292` 新合同不一致

## Scope

- In scope:
  - 删除 runtime 中已无主路径依赖的旧 pin compat handler
  - 把 Home pin-only handler 和 Home 调试下拉完全切到新 pin family
  - 把 `ui-side-worker` demo patch 迁到 `pin.in / pin.out`
  - 清理 `llm_cognition_config` 中关于旧 pin family 的提示文字
  - 更新 `CLAUDE.md` 的 `PIN_SYSTEM` 描述，使其与 `0292/0294` 对齐
- Out of scope:
  - 新 pin 语义设计
  - Matrix / Slide UI / Three.js 业务实现
  - `0294` 已完成主链重写
  - 其它未列出的历史残留大清扫

## Invariants / Constraints

- 本 iteration 是 cleanup，不重开合同。
- 唯一合同前提：
  - `0292`
  - `0294`
- 不允许因为 cleanup 扩到：
  - `MBR` 重构
  - bus 拓扑重排
  - Flow / Data.FlowTicket
- 必须保持：
  - `0294` 主路径继续工作
  - Home CRUD 不回归
  - Static / 0270 / 颜色生成器不回归

## Approach Options

### A. 全仓一次性 sweep

- 优点：
  - 看起来最彻底
- 缺点：
  - 范围太大
  - 很容易把 cleanup 做成第二次基础重构

### B. 只清当前已锁定范围

- 优点：
  - 范围清楚
  - 风险可控
  - 能和 `0294` 债务记录一一对应
- 缺点：
  - 仓库里仍可能还有别的低优先级残留

### C. 只改 docs，不删 runtime compat

- 优点：
  - 最保守
- 缺点：
  - 债务没有真的减少
  - 后面会继续误导实现者

当前推荐：**B**

## Success Criteria

- `0298` 获得 `Approved` 后，执行者不需要再猜：
  - 这轮到底删哪些旧 pin family
  - 哪些文件必须一起改
  - 哪些现有页面必须保住
- resolution 必须明确：
  - runtime compat handler 如何退场
  - Home / ui-side-worker / LLM prompt / CLAUDE 各自怎么改
  - 需要跑哪些 deterministic tests
  - 需要做哪些本地浏览器验证

## Risks & Mitigations

- Risk:
  - 删掉 runtime compat 后，仍有未发现的旧 patch 被打坏
  - Mitigation:
    - 这轮只在已锁定范围内删 compat，并用 targeted tests + local deploy 验证
- Risk:
  - 把 `ui-side-worker` demo 从旧 owner request 迁移时顺手改大
  - Mitigation:
    - 只改 pin type / payload 形状，不改产品功能范围
- Risk:
  - `CLAUDE.md` 与 repo SSOT 再次漂移
  - Mitigation:
    - 这轮把 `PIN_SYSTEM` 直接对齐到 `0292/0294` 已落地口径

## Inputs

- Created at: 2026-04-06
- Iteration ID: 0298-pin-contract-cleanup
- Dependencies:
  - `0292` Approved
  - `0294` Completed
  - `0296` Completed
