---
title: "0317 — time-static-root-zip Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0317-time-static-root-zip
id: 0317-time-static-root-zip
phase: phase3
---

# 0317 — time-static-root-zip Runlog

## Environment

- Date: `2026-04-13`
- Branch: `dev_0317-time-static-root-zip`
- Runtime: artifact repack + local static upload verification

## Review Gate Record

### Review 1 — User

- Iteration ID: `0317-time-static-root-zip`
- Review Date: `2026-04-13`
- Review Type: `User`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 允许重组 zip，让 `index.html` 到根目录
  - Static 发布只要求挂到 `/p/<projectName>/`

## Execution Record

### 2026-04-13 — Step 1 Root Zip Repack

**Command**
- 解出 `test_files/time.zip`
- 将 `wasm/` 下内容平铺到根目录
- 重新打包为 `test_files/time_static_root.zip`
- `unzip -l test_files/time_static_root.zip` → PASS

**Result**
- 新 zip 根目录已包含：
  - `index.html`
  - `hello.wasm`
  - `wasm_exec.js`
  - 相关 css / gif / png

### 2026-04-13 — Step 2 Local Static Upload

**Commands**
- `POST /api/runtime/mode` → PASS
- `POST /api/media/upload` 上传 `time_static_root.zip` → PASS
- `POST /ui_event` 写：
  - `static_project_name = time-static-root`
  - `static_upload_kind = zip`
  - `static_media_uri = mxc://...`
- `POST /ui_event` action=`static_project_upload` → PASS

**Observed**
- `static_status = uploaded: time-static-root`
- `project_entry.url = /p/time-static-root/`

### 2026-04-13 — Step 3 Public Path Verification

**Commands**
- `GET /p/time-static-root/` → 200
- `GET /p/time-static-root/hello.wasm` → 200

**Meaning**
- 不需要做 slide app 挂载
- 当前 Static 主线已经足够承载这个包

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed

## Living Docs Review

- `docs/ssot/runtime_semantics_modeltable_driven.md`
  - reviewed, no change needed
- `docs/user-guide/modeltable_user_guide.md`
  - reviewed, no change needed
- `docs/ssot/execution_governance_ultrawork_doit.md`
  - reviewed, no change needed
