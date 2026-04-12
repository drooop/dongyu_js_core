---
title: "0317 — time-static-root-zip Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-04-13
source: ai
iteration_id: 0317-time-static-root-zip
id: 0317-time-static-root-zip
phase: phase4
---

# 0317 — time-static-root-zip Resolution

## Execution Strategy

1. 先把 `time.zip` 中 `wasm/` 下的站点资源平铺到根目录，生成新的静态包。
2. 再通过现有 Static 上传链发布到本地 `/p/<projectName>/`。
3. 最后验证首页和 `hello.wasm` 都能访问。

## Step 1

- Scope:
  - 生成 root zip
- Files:
  - `test_files/time_static_root.zip`
- Verification:
  - `unzip -l test_files/time_static_root.zip`
- Acceptance:
  - zip 根目录包含 `index.html`
- Rollback:
  - 删除 `test_files/time_static_root.zip`

## Step 2

- Scope:
  - 用现有 Static 主线做本地发布
- Files:
  - `docs/iterations/0317-time-static-root-zip/runlog.md`
- Verification:
  - `POST /api/runtime/mode`
  - `POST /api/media/upload`
  - `POST /ui_event` 写入 static truth
  - `POST /ui_event` 触发 `static_project_upload`
- Acceptance:
  - `static_status = uploaded: time-static-root`
- Rollback:
  - 通过 Static 删除项目或手工删除对应 static 项目目录

## Step 3

- Scope:
  - 验证公开访问路径
- Files:
  - `docs/iterations/0317-time-static-root-zip/runlog.md`
- Verification:
  - `GET /p/time-static-root/`
  - `GET /p/time-static-root/hello.wasm`
- Acceptance:
  - 首页返回 200
  - wasm 返回 200
- Rollback:
  - 删除 static 项目目录并回退 zip
