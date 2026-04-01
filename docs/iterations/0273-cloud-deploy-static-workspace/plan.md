---
title: "Iteration 0273-cloud-deploy-static-workspace Plan"
doc_type: iteration-plan
status: active
updated: 2026-04-01
source: ai
iteration_id: 0273-cloud-deploy-static-workspace
id: 0273-cloud-deploy-static-workspace
phase: phase1
---

# Iteration 0273-cloud-deploy-static-workspace Plan

## Goal

把 `0272` 的 Static Workspace 重建同步到远端 cloud 环境，并用公网入口完成真实上传与访问验证。

## Scope

- 同步目标 revision 到远端仓库
- 同步 authoritative assets
- 发布 `ui-server` 当前状态
- 验证公网 Workspace 中的 `Static`
- 验证上传单个 HTML 和 ZIP 后可通过 `/p/<projectName>/...` 访问

## Acceptance

- 远端源码和 `ui-server` 代码与当前 revision 对齐
- 公网 `Workspace` 中出现 `Static`
- 公网上传 HTML 成功
- 公网上传 ZIP 成功
- 两种方式都能通过 `/p/<projectName>/...` 访问

