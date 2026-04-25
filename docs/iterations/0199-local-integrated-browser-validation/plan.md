---
title: "Iteration 0199-local-integrated-browser-validation Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0199-local-integrated-browser-validation
id: 0199-local-integrated-browser-validation
phase: phase1
---

# Iteration 0199-local-integrated-browser-validation Plan

## Goal

- 在本地完成 3 个软件工人角色的集成部署与浏览器级验收：
  - MBR
  - 测试用远端软件工人角色
  - 测试用 UI-side 软件工人

## Background

- `0195` 已冻结本地验收的 DoD：
  1. 合同测试 PASS
  2. 部署成功
  3. Playwright 测例 PASS
  4. 真实浏览器人工操作 PASS
  5. runlog 附步骤与截图/页面证据
- `0196` 已完成 MBR 的 triggerless Tier 2 rebase。
- `0197` 已完成 remote worker role 的 Tier 2 rebase。
- `0198` 已完成 UI-side worker 的 patch-first 重构，并补齐本地/云端部署入口资产。
- 因此 `0199` 的重点不再是重填模型表，而是把本地全栈链路真正跑通，并用浏览器证据验证其可用性。

## Scope

- In scope:
  - 补齐/接通本地部署链，使 `ui-side-worker` 也被纳入本地部署
  - 本地启动：
    - `ui-server`
    - `mbr-worker`
    - `remote-worker`
    - `ui-side-worker`
    - `mosquitto`
    - `synapse`
  - 执行本地脚本级 smoke / roundtrip 验证
  - 执行 Playwright 浏览器测例
  - 执行人工浏览器复核，并记录截图/页面证据
- Out of scope:
  - 不做云端部署
  - 不修改远端环境
  - 不引入新的业务功能

## Invariants / Constraints

- 必须遵守 repo root `CLAUDE`：
  - 本轮只允许本地验证，不触碰远端危险操作
  - 浏览器实际动作不到位，不能算完成
- 必须使用真实本地运行链路，不允许只跑 mock 页面或纯单测。
- 若本地部署链因前置环境缺失失败，runlog 必须明确写成 blocker，不能模糊写成“未验证”。

## Success Criteria

- 本地部署链成功纳入 `ui-side-worker`，且所有相关 Pod/进程可用。
- 本地脚本级 smoke / roundtrip 验证通过。
- Playwright 走完整条本地测例并 PASS。
- 人工浏览器完成至少 3 组动作并达到预期：
  - remote role / Model100 submit
  - MBR bridge roundtrip
  - UI-side worker flow
- runlog 中包含：
  - 访问地址
  - 操作步骤
  - 结果
  - 截图或页面证据

## Risks & Mitigations

- Risk:
  - 本地部署脚本还没纳入 `ui-side-worker`，导致 0198 的角色无法被真实启动。
  - Mitigation:
    - 本轮将“接入本地部署链”纳入 in-scope，而不是假设它已存在。
- Risk:
  - Playwright PASS 但人工浏览器路径不通。
  - Mitigation:
    - 人工浏览器复核列为硬性 DoD。
- Risk:
  - Matrix/MQTT/patch bootstrap 环境不一致导致链路假失败。
  - Mitigation:
    - 所有失败都必须定位到具体层：部署、连通、业务、页面。

## Alternatives

### A. 推荐：本地部署 + Playwright + 人工浏览器三层验收

- 优点：
  - 与 `0195` 冻结的 DoD 完全一致
  - 能在进入远端前把大部分链路问题暴露出来
- 缺点：
  - 比单纯脚本验证更耗时

### B. 只跑脚本和 Playwright，不做人工浏览器

- 优点：
  - 更快
- 缺点：
  - 不满足已冻结 DoD
  - 不推荐

当前推荐：A。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0199-local-integrated-browser-validation
- Trigger:
  - 用户确认 `0198` 已收口并要求继续推进本地集成浏览器验证
