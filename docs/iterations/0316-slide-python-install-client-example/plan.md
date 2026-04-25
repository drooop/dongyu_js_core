---
title: "0316 — slide-python-install-client-example Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0316-slide-python-install-client-example
id: 0316-slide-python-install-client-example
phase: phase1
---

# 0316 — slide-python-install-client-example Plan

## Goal

- 提供一个 Python 安装客户端示例，让同事拿着 slide app zip 后，能按当前正式主线把 slide app 部署到本项目。

## Scope

- In scope:
  - 一个 Python 示例脚本
  - 一页对应用户说明
  - 一个 contract test 固定脚本必须走的正式链路
- Out of scope:
  - 不发明新的 Matrix room message 协议
  - 不绕过 `/api/media/upload`
  - 不绕过 importer 真值与 importer `click` pin

## Invariants / Constraints

- 示例必须走当前正式安装链：
  - `/auth/login`（需要时）
  - `/api/media/upload`
  - `ui_owner_label_update` 写 `1031.slide_import_media_uri`
  - importer `click` pin（`1030, 2,4,0`）
- 不能写成“直接把 zip 上传到别处 Matrix 再拿 mxc 用”的示例。
- 如果环境开启鉴权，示例必须支持用 Matrix 用户名密码先登录 ui-server。
- 若环境未开启鉴权，示例可直接利用当前 ui-server 的已有 Matrix 上传身份。

## Success Criteria

1. 有一个同事可直接运行的 Python 脚本。
2. 脚本说明页能清楚说出参数、前提和返回结果。
3. 有测试固定脚本必须使用当前正式安装链。

## Inputs

- Created at: 2026-04-13
- Iteration ID: `0316-slide-python-install-client-example`
- User request:
  - “现在需要一个matrix 的python client 例子，让同事能在拥有滑动app的zip后向本项目上部署一个滑动app”
