---
title: "0312 — slide-upload-auth-and-cache-contract Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-10
source: ai
iteration_id: 0312-slide-upload-auth-and-cache-contract
id: 0312-slide-upload-auth-and-cache-contract
phase: phase1
---

# 0312 — slide-upload-auth-and-cache-contract Resolution

## Execution Strategy

1. 先补失败测试，锁定上传鉴权顺序和 cache-priming 依赖。
2. 再落正式合同页，并把 0309 正式说明改成引用这页而不是自己重复口径。
3. 最后跑验证、更新 runlog，并按分支流程合回 `dev`。

## Step 1

- Scope:
  - 先把当前实现要求固定成会失败的自动化测试
- Files:
  - `scripts/tests/test_0312_slide_upload_auth_contract.mjs`
  - `scripts/tests/test_0312_slide_import_cache_contract.mjs`
- Verification:
  - 先运行新增测试并确认在未实现前 FAIL
- Acceptance:
  - 测试能明确锁住：
    - `/api/media/upload` 在鉴权开启时先报 `not_authenticated`
    - server 侧 Matrix 凭据只在未开启鉴权时参与兜底
    - `slideImportAppFromMxc()` 对未缓存 `mxc://...` 返回 `media_not_cached`
- Rollback:
  - 删除新增测试文件

## Step 2

- Scope:
  - 新增正式合同页，并最小更新入口文档
- Files:
  - `docs/user-guide/slide_upload_auth_and_cache_contract_v1.md`
  - `docs/user-guide/README.md`
  - `docs/user-guide/slide_ui_mainline_guide.md`
  - `docs/user-guide/slide_matrix_delivery_v1.md`
- Verification:
  - 文档静态检查 PASS
  - 文档中关键错误码和入口可在代码与测试中对上
- Acceptance:
  - 新合同页能单独回答：
    - 上传前提
    - 失败码
    - cache priming 入口
    - 什么做法明确不支持
  - `0309` 主说明改为引用合同页，不再独自承载全部边界细节
- Rollback:
  - 删除新合同页
  - 回退入口文档修改

## Step 3

- Scope:
  - 验证、记录、合回主线
- Files:
  - `docs/iterations/0312-slide-upload-auth-and-cache-contract/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - 新增测试 PASS
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs` PASS
- Acceptance:
  - runlog 有 review / commit / PASS / merge / push 证据
  - `ITERATIONS.md` 状态可切到 `Completed`
- Rollback:
  - 回退 `0312` 文档和测试改动
