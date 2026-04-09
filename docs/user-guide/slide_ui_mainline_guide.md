---
title: "Slide UI Mainline Guide"
doc_type: user-guide
status: active
updated: 2026-04-10
source: ai
---

# Slide UI Mainline Guide

## 这页负责什么

这页是 `0291` 的主文档入口。

它不重复解释每个阶段的所有细节，而是把当前 Slide UI 主线已经成立的能力、入口和细分说明页收在一起，方便使用者和验证者快速找到正确位置。

## 当前主线已经成立的三件事

1. `0289`
   - Workspace 里多个 slide-capable app 现在共用一套主线合同。
2. `0302`
   - 可以把 zip 包导入成新的 slide app。
3. `0290`
   - 可以在 Workspace 里直接填表创建新的 slide app。

这意味着，当前 Slide UI 不再只是围着单一内置 app 运转，而是已经有：

- 内置 flow-shell app
- zip 导入入口
- 填表创建入口
- 导入/创建出来的新 app

## 你应该从哪里进入

### Gallery

路径：

- `/#/gallery`

作用：

- 看 `0291` 的正式展示面
- 快速确认 Slide UI 主线的当前组成
- 找到本地与远端取证入口

### Workspace

路径：

- `/#/workspace`

作用：

- 真正使用当前 Slide UI 主线
- 打开 `滑动 APP 导入`
- 打开 `滑动 APP 创建`
- 查看和删除导入/创建出来的 app

## 当前关键入口

- `E2E 颜色生成器`
  - 内置 flow-shell slide app
- `滑动 APP 导入`
  - zip 导入入口
- `滑动 APP 创建`
  - 填表创建入口

## 细分说明页

如果你需要某一条路径的细节，继续看这些页：

- `slide_workspace_generalization.md`
  - 解释 Workspace 统一主线合同
- `slide_app_zip_import_v1.md`
  - 解释 zip 导入格式、安装和卸载
- `slide_matrix_delivery_v1.md`
  - 解释同事如何用当前正式协议交付 slide app
- `slide_app_filltable_create_v1.md`
  - 解释填表创建路径
- `slide_ui_evidence_runbook.md`
  - 解释本地和远端如何做正式取证

## 这页不负责什么

这页不是：

- Gallery 设计说明书
- zip 包格式规范全文
- creator 字段字典全文
- 远端 deploy 手册全文

这些内容已经分散在各自的细分页中，本页只负责把当前主线收成一个可导航入口。
