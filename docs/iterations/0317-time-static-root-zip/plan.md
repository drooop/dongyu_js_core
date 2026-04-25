---
title: "0317 — time-static-root-zip Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0317-time-static-root-zip
id: 0317-time-static-root-zip
phase: phase1
---

# 0317 — time-static-root-zip Plan

## Goal

- 将 `test_files/time.zip` 重组为根目录带 `index.html` 的静态包，并用现有 Static 主线上传到 `/p/<projectName>/`。

## Scope

- In scope:
  - 生成新的 root zip
  - 用现有 Static 上传链在本地发布
  - 验证 `/p/<projectName>/` 与关键静态资源可访问
- Out of scope:
  - 不做 slide app 挂载
  - 不做 Workspace 右侧新页面运行
  - 不改 Static 主线逻辑

## Invariants / Constraints

- 目标变更只基于用户已裁决的两点：
  - 允许重组 zip 让 `index.html` 到根目录
  - Static 发布只需要通过 `/p/<static_uploaded_x>/` 打开
- 继续复用现有 Static 上传链：
  - `/api/media/upload`
  - `ui_owner_label_update`
  - `static_project_upload`

## Success Criteria

1. 新的 zip 根目录含 `index.html`。
2. 本地 Static 上传成功。
3. `/p/time-static-root/` 可打开，`hello.wasm` 可访问。

## Inputs

- Created at: `2026-04-13`
- Iteration ID: `0317-time-static-root-zip`
