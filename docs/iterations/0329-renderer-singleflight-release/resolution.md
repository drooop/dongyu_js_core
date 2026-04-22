---
title: "0329 — renderer-singleflight-release Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-22
source: ai
iteration_id: 0329-renderer-singleflight-release
id: 0329-renderer-singleflight-release
phase: phase1
---

# 0329 — renderer-singleflight-release Resolution

## Execution Strategy

1. 先用 failing test 锁住 fresh session `op_id` 重复问题
2. 最小修改 renderer 的 editor op_id 生成
3. 对齐旧 renderer 验证
4. 重部署 / 真实浏览器复验

