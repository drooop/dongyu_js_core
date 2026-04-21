---
title: "0318 — static-wasm-mime-fix Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0318-static-wasm-mime-fix
id: 0318-static-wasm-mime-fix
phase: phase1
---

# 0318 — static-wasm-mime-fix Plan

## Goal

- 修复 Static 发布路径对 `.wasm` 的响应头，让浏览器把 `hello.wasm` 识别为 `application/wasm`。

## Scope

- In scope:
  - `contentTypeFor()` 的 `.wasm` MIME 映射
  - 1 条 contract test
  - 本地重新部署与访问验证
- Out of scope:
  - 不改 `time_static_root.zip`
  - 不改 Static 上传链
  - 不改 WASM 页面本身

## Invariants / Constraints

- 只修 MIME 类型，不改其他静态文件路由行为。
- 仍然通过现有 `/p/<projectName>/...` 路径验证。

## Success Criteria

1. `.wasm` 返回 `Content-Type: application/wasm`
2. `node` contract test PASS
3. 本地 `/p/time-static-root/hello.wasm` 头部可验证为 `application/wasm`

## Inputs

- Created at: `2026-04-13`
- Iteration ID: `0318-static-wasm-mime-fix`
