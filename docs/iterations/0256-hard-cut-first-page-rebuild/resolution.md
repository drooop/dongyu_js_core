---
title: "0256 — hard-cut-first-page-rebuild Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-03-27
source: ai
iteration_id: 0256-hard-cut-first-page-rebuild
id: 0256-hard-cut-first-page-rebuild
phase: phase1
---

# 0256 — hard-cut-first-page-rebuild Resolution

## Strategy

0256 只做 first writable page proof，不在本 iteration 同时删旧路径。

## Steps

| Step | Name | Goal |
|---|---|---|
| 1 | Choose writable pilot page | 选一个正数 schema/business page，而不是只读展示页 |
| 2 | Rebuild on new contracts | 用 cellwise authoring + pin-only write 重做 |
| 3 | Capture live browser evidence | 证明真实浏览器写入能改 live truth |

## Required Pilot Shape

推荐优先级：

1. `Model 1001` 这类正数 schema form page
2. 若 1001 不适合，再选等价正数可写页

## Completed Pilot

- writable pilot page:
  - `Model 1001` (`请假申请`)
- read-only pilot already preserved from 0254:
  - `Model 1003` (`0215 Schema Leaf`)
