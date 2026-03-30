---
title: "Iteration 0195-worker-tier2-audit-and-rollout-plan Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0195-worker-tier2-audit-and-rollout-plan
id: 0195-worker-tier2-audit-and-rollout-plan
phase: phase1
---

# Iteration 0195-worker-tier2-audit-and-rollout-plan Plan

## Goal

- 对以下 3 个系统做新版规约对齐审计，并产出后续 `0196/0197/0198/0199/0200` 的正式 rollout 方案：
  - MBR
  - 测试用远端软件工人角色
  - 测试用 UI-server 软件工人

## Background

- 你已经确认后续主线应拆成：
  - `0195` 审计规划
  - `0196/0197/0198` 分系统规约对齐
  - `0199` 本地集成部署 + 浏览器验收
  - `0200` 远端集成部署 + 浏览器验收
- 当前代码入口显示三者现状并不一致：
  - `scripts/run_worker_mbr_v0.mjs` 已明确标注为 deprecated / archived
  - `scripts/run_worker_remote_v1.mjs` 是 fill-table minimal bootstrap 路线
  - `scripts/run_worker_ui_side_v0.mjs` 仍保留 `WorkerEngineV0` / 手工初始化路径
  - `packages/ui-model-demo-server/server.mjs` 仍是本地 UI host 与 runtime orchestration 主入口
- 在没有完成正式审计之前，直接进入规约对齐实施会把“真实差距”和“猜测差距”混在一起。

## Scope

- In scope:
  - 审计 MBR / remote worker role / test UI-server worker 当前 bootstrap 与模型表现状
  - 审计这 3 个系统当前是否仍有硬编码模型初始化、手工 routing、非 Tier 2 路径
  - 审计本地部署与远端部署前置条件
  - 审计浏览器测例矩阵，并给出 0196-0200 的正式拆分方案
- Out of scope:
  - 不修改 runtime / worker / server 代码
  - 不重填任何模型表
  - 不执行本地或远端部署
  - 不跑浏览器正式验收

## Invariants / Constraints

- 这是纯 planning / audit iteration，不得修改产品行为代码。
- 必须遵守 repo root `CLAUDE` 的 Tier 边界与远端安全约束，尤其是：
  - fill-table-first
  - new capability as Tier 2 unless interpreter bug/semantics
  - REMOTE_OPS_SAFETY 只允许 kubectl / helm / docker / rsync 等白名单操作
- 产出必须能直接指导后续实施，不得停留在泛泛建议。

## Success Criteria

- 形成 3 个系统的差距矩阵：
  - 当前状态
  - 与新版规约的冲突点
  - 需要重填/替换/保留的部分
- 形成 3 个系统当前“硬编码初始化 vs JSON patch 初始化”清单。
- 形成目标模型表与 patch 归属清单：
  - 哪些可复用现有 patch
  - 哪些必须新建
  - 建议落在哪个目录
- 形成本地部署前置条件清单。
- 形成远端部署前置条件清单。
- 形成浏览器测例矩阵：
  - 页面入口
  - 操作步骤
  - 预期结果
  - PASS/FAIL 判据
- 形成后续 rollout 拆分方案：
  - `0196`
  - `0197`
  - `0198`
  - `0199`
  - `0200`
  - 各自范围、风险、回滚点

## Risks & Mitigations

- Risk:
  - 审计范围过大，最后只得到泛化结论，不能指导实施。
  - Mitigation:
    - 将 `Success Criteria` 收紧为具体的矩阵、清单、测例和迭代拆分。
- Risk:
  - 把“本地 host state / deploy glue”与“应重填的 Tier 2 模型表”混淆。
  - Mitigation:
    - 每条 finding 都必须标注：
      - Tier
      - model placement
      - ownership
      - 建议落点
- Risk:
  - 远端部署约束未冻结，导致后续实施时触碰禁区。
  - Mitigation:
    - 在本轮就显式列出远端操作白名单与前置依赖。

## Alternatives

### A. 推荐：先做正式审计规划，再拆实施迭代

- 优点：
  - 后续实施边界清晰
  - 每个系统可独立 review / rollback
  - 本地/远端/browser 验收可单独做成交付阶段
- 缺点：
  - 需要先花一轮只做分析，不产出立即可运行代码

### B. 直接开始重填 MBR/remote/ui-server

- 优点：
  - 看起来更快
- 缺点：
  - 迭代拆分会建立在猜测上
  - 很容易把“规约对齐”和“部署调试”混在一起
  - 不推荐

当前推荐：A。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0195-worker-tier2-audit-and-rollout-plan
- Trigger:
  - 用户确认在 `0194` 之后，先做 Worker/Base 规约对齐审计与 rollout 规划
  - 用户已确认本地/远端/browser 验收必须独立成后续迭代
