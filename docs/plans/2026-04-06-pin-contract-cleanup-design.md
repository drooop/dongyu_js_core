---
title: "Pin Contract Cleanup Design"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Pin Contract Cleanup Design

## Goal

在不重开合同设计的前提下，清理仓内已知的旧 pin family 残留。

## Current State

- 主路径已在 `0294` 完成迁移。
- 仍有少量非主路径残留：
  - runtime compat handler
  - Home handlers / dropdown
  - ui-side-worker demo
  - LLM prompt text
  - `CLAUDE.md` `PIN_SYSTEM`

## Options

### A. 全仓 sweep

- 不推荐，范围太大。

### B. 只清已锁定范围

- 推荐。
- 风险最小，也最符合当前 cleanup 目的。

### C. 只改文档，不删 compat

- 不推荐。
- 债务还会继续存在。

## Recommendation

推荐 **B**：
- runtime / patch / docs 三层一起收口
- 只动已经锁定的文件
- 用 `0294` 主路径回归做安全网
