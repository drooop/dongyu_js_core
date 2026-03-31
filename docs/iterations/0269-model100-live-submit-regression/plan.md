---
title: "Iteration 0269-model100-live-submit-regression Plan"
doc_type: iteration-plan
status: active
updated: 2026-03-31
source: ai
iteration_id: 0269-model100-live-submit-regression
id: 0269-model100-live-submit-regression
phase: phase1
---

# Iteration 0269-model100-live-submit-regression Plan

## 0. Metadata
- ID: 0269-model100-live-submit-regression
- Date: 2026-03-31
- Owner: Codex + User
- Branch: dev_0269-model100-live-submit-regression

## 1. Goal
修复 live 环境下颜色生成器点击 `Generate Color` 后没有新颜色返回的问题，恢复当前双总线样板作为后续新案例的可信 baseline。

## 2. Background
live 复现显示点击后页面无变化。分层证据表明事件已到达 `Model 100 (0,0,2).ui_event`，但 `ui-server` 日志明确报 `prepare_model100_submit function NOT found`，所以去程在本地就断了，remote-worker 和 MBR 都没有收到新的业务事件。

## 3. Invariants (Must Not Change)
- 不回退 0266 的 scoped patch / owner materialization 约束。
- 不通过硬编码捷径绕过现有双总线与合法数据链路。
- 修复目标是恢复现有颜色生成器样板，不顺带实现新的用户案例。

## 4. Scope
### 4.1 In Scope
- 查清 `prepare_model100_submit` 在 live 环境为何未注册
- 修复 `ui-server` 本地去程函数注册/加载链
- 本地 redeploy 并重验颜色生成器 live 行为

### 4.2 Out of Scope
- 新的 Workspace UI 例子
- 新文档编写

## 5. Success Criteria (Definition of Done)
1. 点击 `Generate Color` 后，`ui-server` 不再报 `prepare_model100_submit function NOT found`。
2. live 页面点击后颜色发生变化。
3. `remote-worker` / `MBR` 日志中可见这次点击的链路经过。
