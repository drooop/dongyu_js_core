---
title: "Prompt FillTable Owner Chain and Deploy Guide"
doc_type: user-guide
status: active
updated: 2026-04-21
source: ai
---

# Prompt FillTable Owner Chain and Deploy Guide

本页只做两件事：
- 给出 Prompt FillTable 的正式 owner-chain 口径
- 给出本地 / cloud deploy 的正确导航入口

命令与 PASS 判定不在本文复制，统一以 [[scripts/ops/README|ops 一键命令总表]] 为准。

## 1. 正式口径

Prompt FillTable 的公共合同已经不是 `records`，而是：
- `candidate_changes`
- `accepted_changes`
- `applied_changes`

标准链路：
1. caller 提交 prompt，请求 preview
2. LLM 输出 `proposal + candidate_changes`
3. 宿主完成 owner-side validation / translation
4. preview 返回 `accepted_changes / rejected_changes / owner_plan`
5. apply 只消费 preview 中 owner 已确认的 `accepted_changes`
6. owner 内部 materialize 后，最终才执行真实写表

应当阅读的 canonical 说明：
- [[docs/user-guide/modeltable_user_guide|ModelTable User Guide]]

## 2. 常见误区

- 不要把 `op:add_label/remove_label` 当作给 LLM 的外部合同。
- 不要绕过 owner-side validation / translation / materialization。
- 不要把共享知识库的通用 runbook 当作项目 deploy 文档。
- 不要在这里复制 `ops/README` 的命令和 PASS 判定。

## 3. 本地验证入口

本地 OrbStack + Ollama + `mt-table` 的项目 runbook：
- [[docs/user-guide/llm_cognition_ollama_runbook|LLM Cognition Ollama Runbook]]

共享知识库中的通用环境方法：
- [[docs-shared/engineering/local-orbstack-ollama-runbook|Local OrbStack and Ollama Runbook]]

本项目命令与 PASS 判定：
- [[scripts/ops/README|ops 一键命令总表]]

## 4. Cloud Deploy 入口

Cloud deploy 的命令入口、preflight、source gate、PASS 判定：
- [[scripts/ops/README|ops 一键命令总表]]

在 cloud 环境里，本页只负责提醒：
- 先看 preflight / source integrity gate
- 再看 rollout 与功能验证
- 不在这里复制 shell 命令

## 5. 阅读顺序

建议阅读顺序：
1. [[docs/user-guide/modeltable_user_guide|ModelTable User Guide]]
2. [[docs/user-guide/llm_cognition_ollama_runbook|LLM Cognition Ollama Runbook]]
3. [[scripts/ops/README|ops 一键命令总表]]
