---
title: "0321 — imported-slide-app-host-ingress-implementation Plan"
doc_type: iteration-plan
status: approved
updated: 2026-04-14
source: ai
iteration_id: 0321-imported-slide-app-host-ingress-implementation
id: 0321-imported-slide-app-host-ingress-implementation
phase: phase2
---

# 0321 — imported-slide-app-host-ingress-implementation Plan

## Goal

- 按 `0320` 的 v1 规约，落第一批 imported app 宿主 ingress 实现：让 imported app 在导入期声明 host-facing boundary pin，宿主安装时自动补一条可验证的 `Model 0 -> imported app boundary pin` 接入链。

## Scope

- In scope:
  - 设计并实现 imported app 的 boundary pin 声明 schema（v1）
  - 导入校验：只接受 `root-relative cell locator`
  - 安装时自动生成 `Model 0` host ingress route
  - 第一批 semantic 以 `submit` 为 MVP
  - contract + server-flow tests
  - 最小文档更新
- Out of scope:
  - 不把所有现有 direct-pin path 一次删掉
  - 不把本地 UI 草稿改经 `Model 0`
  - 不扩展多种 locator form
  - 不一次实现所有 semantic

## Invariants / Constraints

- 必须遵守 `0320`：
  - v1 只允许 `root-relative cell locator`
  - imported app 必须显式声明 host-facing primary boundary pin
- 当前 live direct-pin 事实在过渡期仍保留；`0321` 是新增宿主 ingress 能力，不是立即全面切换。
- 本轮 MVP 只要求：
  - imported app 能声明一个 `submit` 边界入口
  - 安装后宿主自动补一条 `Model 0` ingress route

## Success Criteria

1. imported app 可以在 payload 中声明 v1 boundary pin 元信息。
2. 导入时宿主会校验并生成 host adapter。
3. 自动生成的 route 能把 `Model 0` ingress relay 到 imported app 的边界 pin。
4. 有自动化测试证明：
   - 非法 locator / 重复 primary / 缺 pin 声明会失败
   - 合法 imported app 导入后有 host ingress route
   - 通过宿主 ingress 能把事件送进 imported app

## Inputs

- Created at: `2026-04-14`
- Iteration ID: `0321-imported-slide-app-host-ingress-implementation`
- Depends on:
  - `0320-imported-slide-app-host-ingress-semantics-freeze`
