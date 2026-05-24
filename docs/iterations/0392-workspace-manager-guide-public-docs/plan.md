---
title: "0392 Workspace Manager Guide Public Docs Plan"
doc_type: iteration-plan
status: active
updated: 2026-05-24
source: codex
---

# 0392 Workspace Manager Guide Public Docs Plan

## Goal

把 0391 新增的 Workspace Manager 交互指南纳入远端公开 docs 同步路径，避免代码已部署但远端 Docs 看不到该文档。

## Scope

- 更新 `scripts/ops/sync_ui_public_docs.sh`。
- 扩展 0391 文档合同测试，检查同步脚本包含新指南。

## Acceptance

- 远端部署执行后，`workspace_manager_interaction_guide.md` 出现在 UI Server docs 目录。
- 文档合同测试通过。
