---
title: "0391 Workspace Manager Interaction Guide Plan"
doc_type: iteration-plan
status: active
updated: 2026-05-23
source: codex
---

# 0391 Workspace Manager Interaction Guide Plan

## Goal

确认 Workspace Manager provider-owned 安装链路中的 topic 拼接是否符合当前规约，并补充一份面向滑动 APP 提供方的操作文档，说明如何准备 bundle、上传获得资源引用，以及如何把可安装滑动 APP 索引发布到 Workspace Manager。

## Scope

- 审查当前实现中的 topic 拼接来源、拼接格式和验证规则。
- 新增 `docs/user-guide/slide-app-runtime/workspace_manager_interaction_guide.md`。
- 更新 user guide 索引。
- 增加一个轻量文档合同测试，避免新文档遗漏关键字段。

## Non-Goals

- 不改 MBR / UI Server / Remote Worker 的运行链路。
- 不新增自动发现协议。
- 不把 `provider_bundle_topic` 提升为目录真源。

## Acceptance

- 文档明确说明：完整 topic 由 Model 0 `mqtt_topic_base` 加 endpoint labels 拼接得出。
- 文档明确说明：目录中的完整 topic 只能是派生展示值，不是安装真源。
- 文档覆盖 ZIP 打包、上传得到 `mxc://...`、provider bundle endpoint、Workspace Manager asset row 字段和最小填表示例。
- 文档合同测试通过。
