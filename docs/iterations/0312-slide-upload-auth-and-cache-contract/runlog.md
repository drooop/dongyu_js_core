---
title: "0312 — slide-upload-auth-and-cache-contract Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0312-slide-upload-auth-and-cache-contract
id: 0312-slide-upload-auth-and-cache-contract
phase: phase3
---

# 0312 — slide-upload-auth-and-cache-contract Runlog

## Environment

- Date: `2026-04-10`
- Branch: `dev_0312-slide-upload-auth-and-cache-contract`
- Runtime: planning

## Planning Record

### Record 1

- Inputs reviewed:
  - `0309` review follow-up
  - `docs/WORKFLOW.md`
  - `docs/ITERATIONS.md`
  - `scripts/tests/test_0272_static_upload_identity_contract.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `docs/user-guide/slide_matrix_delivery_v1.md`
- Locked conclusions:
  - 问题不在于再润色 0309，而是缺一个独立合同页和专门测试
  - `0312` 不改逻辑，只冻结当前实现边界

## Review Gate Record

### Review 1 — User

- Iteration ID: `0312-slide-upload-auth-and-cache-contract`
- Review Date: `2026-04-10`
- Review Type: `User`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 同意新增一个小迭代，把上传鉴权与 cache-priming 固化成正式合同和测试

## Execution Start Record

### 2026-04-10

- Execution start:
  - `0312` 进入执行准备
  - 当前范围只做：
    - 正式合同页
    - 自动化测试
    - 最小入口更新
- done-criteria:
  - 有独立合同页
  - 有 2 个自动化测试
  - docs audit PASS
  - 有 merge / push 证据

## Execution Record

### 2026-04-10 — Step 1 TDD Red

**Tests added**
- `scripts/tests/test_0312_slide_upload_auth_contract.mjs`
- `scripts/tests/test_0312_slide_import_cache_contract.mjs`

**Commands**
- `node scripts/tests/test_0312_slide_upload_auth_contract.mjs` → FAIL
- `node scripts/tests/test_0312_slide_import_cache_contract.mjs` → FAIL

**Expected red reasons**
- `slide_upload_auth_and_cache_contract_v1.md` 尚不存在
- 入口文档尚未链接新的正式合同页

### 2026-04-10 — Step 2 Minimal Implementation

**Created**
- `docs/user-guide/slide_upload_auth_and_cache_contract_v1.md`

**Updated**
- `docs/user-guide/README.md`
- `docs/user-guide/slide_ui_mainline_guide.md`
- `docs/user-guide/slide_matrix_delivery_v1.md`

**Delivered**
- 正式冻结：
  - `/api/media/upload` 的鉴权模式
  - `not_authenticated`
  - `matrix_session_missing`
  - `media_not_cached`
  - cache priming 的唯一受支持入口
- `0309` 正式说明改成引用新合同页，不再独自解释全部边界

### 2026-04-10 — Step 3 Deterministic Verification

**Commands**
- `node scripts/tests/test_0312_slide_upload_auth_contract.mjs` → PASS
- `node scripts/tests/test_0312_slide_import_cache_contract.mjs` → PASS
- `node scripts/ops/obsidian_docs_audit.mjs --root docs` → PASS

**Meaning**
- 上传路由的鉴权顺序和 fallback 边界已被自动化固定
- slide 导入对 cache priming 的依赖已被自动化固定
- 正式合同页和入口链接已存在

### 2026-04-10 — Step 4 Branch-local Verification After Commit

**Commit under test**
- `1ed8d17 docs: freeze slide upload auth and cache contract`

**Commands**
- `node scripts/tests/test_0312_slide_upload_auth_contract.mjs` → PASS
- `node scripts/tests/test_0312_slide_import_cache_contract.mjs` → PASS
- `node scripts/tests/test_0272_static_upload_identity_contract.mjs` → PASS
- `node scripts/tests/test_0311_workspace_pin_addressing_server_flow.mjs` → PASS
- `node scripts/ops/obsidian_docs_audit.mjs --root docs` → PASS

**Result**
- 新合同页和 2 个新增测试成立
- 既有上传 fallback 合同未回归
- 既有 workspace pin 导入主线未回归

### 2026-04-10 — Post-review Test Hardening

**Input**
- review 指出两点：
  - 上传鉴权测试错误地切到了过宽的源码范围
  - cache 合同测试错误地依赖了 `cacheUploadedMediaForTest`

**Action**
- `test_0312_slide_upload_auth_contract.mjs`
  - 改为只检查 `handleMediaUploadRequest()` 这一真实上传 handler
- `test_0312_slide_import_cache_contract.mjs`
  - 改为：
    - 真实调用 `/api/media/upload`
    - mock Matrix upload 外部请求
    - 再在同一 `state` 上调用导入
  - 不再使用 `cacheUploadedMediaForTest`
- `packages/ui-model-demo-server/server.mjs`
  - 新增导出 `handleMediaUploadRequest`
  - `startServer()` 复用同一 helper
  - 逻辑不变，只提升可测试性

**Verification**
- `node scripts/tests/test_0312_slide_upload_auth_contract.mjs` → PASS
- `node scripts/tests/test_0312_slide_import_cache_contract.mjs` → PASS
- `node scripts/tests/test_0272_static_upload_identity_contract.mjs` → PASS
- `node scripts/tests/test_0311_workspace_pin_addressing_server_flow.mjs` → PASS
- `node scripts/ops/obsidian_docs_audit.mjs --root docs` → PASS

## Commits

- `1ed8d17 docs: freeze slide upload auth and cache contract`

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
