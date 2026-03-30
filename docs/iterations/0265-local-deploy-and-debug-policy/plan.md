---
title: "Iteration 0265-local-deploy-and-debug-policy Plan"
doc_type: iteration-plan
status: active
updated: 2026-03-30
source: ai
iteration_id: 0265-local-deploy-and-debug-policy
id: 0265-local-deploy-and-debug-policy
phase: phase1
---

# Iteration 0265-local-deploy-and-debug-policy Plan

## 0. Metadata
- ID: 0265-local-deploy-and-debug-policy
- Date: 2026-03-30
- Owner: Codex + User
- Branch: dev_0265-local-deploy-and-debug-policy

## 1. Goal
重新部署本地环境，确认 debug CRUD 放开已在真实 `30900` 环境生效，并把“开发后必须部署再测试”的要求写入仓库执行规约。

## 2. Background
用户反馈页面仍看不到 `submt`。经核查，本地 `30900` 环境仍是旧部署，说明此前代码已 merge/push，但未重新部署到本地 runtime。

## 3. Invariants (Must Not Change)
- 不修改业务语义，只做本地部署验证和规约补充。
- 规约提升优先写入 `CLAUDE.md`。

## 4. Scope
### 4.1 In Scope
- 本地重新部署
- debug CRUD 生效验证
- 在 `CLAUDE.md` 补充“开发后部署再测试”要求

### 4.2 Out of Scope
- 远端环境
- 新功能

## 5. Success Criteria (Definition of Done)
1. 本地 `30900` 上可见 `Model 0` 的 `model.submt` 行。
2. `CLAUDE.md` 明确要求：涉及本地运行面/UI/debug 面的改动，必须部署后再测试再宣称完成。
3. runlog 记录部署与验证事实。
