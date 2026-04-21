---
title: "0318 — static-wasm-mime-fix Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0318-static-wasm-mime-fix
id: 0318-static-wasm-mime-fix
phase: phase1
---

# 0318 — static-wasm-mime-fix Resolution

## Execution Strategy

1. 先补失败测试，锁定 `.wasm` MIME。
2. 再做最小修复。
3. 最后重新部署本地并验证 `/p/time-static-root/hello.wasm`。

## Step 1

- Scope:
  - 锁定 `.wasm` MIME 合同
- Files:
  - `scripts/tests/test_0318_static_wasm_mime_contract.mjs`
- Verification:
  - 初始测试必须失败
- Acceptance:
  - 测试能锁定 `application/wasm`
- Rollback:
  - 删除测试

## Step 2

- Scope:
  - 修复 MIME 映射
- Files:
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - 新测试 PASS
- Acceptance:
  - `.wasm` 走正确 MIME
- Rollback:
  - 回退 `server.mjs`

## Step 3

- Scope:
  - 本地重新部署与实测
- Files:
  - `docs/iterations/0318-static-wasm-mime-fix/runlog.md`
- Verification:
  - `node scripts/tests/test_0318_static_wasm_mime_contract.mjs`
  - `curl -sD - -o /dev/null http://127.0.0.1:30900/p/time-static-root/hello.wasm`
- Acceptance:
  - 头部为 `application/wasm`
- Rollback:
  - 回退部署
