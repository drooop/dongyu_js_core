---
title: "0286 — matrix-userline-phase4 Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0286-matrix-userline-phase4
id: 0286-matrix-userline-phase4
phase: phase1
---

# 0286 — matrix-userline-phase4 Resolution

## Execution Strategy

- 本 iteration 仍是 docs-only 计划冻结，不做代码实现。
- 目标是在 `0285` 之后，把第四阶段“非加密视频通话”正式范围拆到可执行粒度。
- 实施顺序固定为：
  1. 冻结信令 / 媒体分层
  2. 冻结第四阶段产品层模型补充块
  3. 冻结一对一与多人视频的最小范围
  4. 冻结最小呼叫控制能力
  5. 明确与加密后续线的切分

## Step 1

- Scope:
  - 明确信令平面与媒体平面的分层
  - 写清楚哪些走 `MBR`，哪些不走
- Files:
  - `docs/iterations/0286-matrix-userline-phase4/plan.md`
  - `docs/iterations/0286-matrix-userline-phase4/resolution.md`
- Verification:
  - 文档中必须明确：
    - 信令经 `MBR`
    - 媒体经 `WebRTC`
    - 不把媒体流塞进总线
- Acceptance:
  - 信令/媒体分层无歧义
- Rollback:
  - 回退本 iteration 文档

## Step 2

- Scope:
  - 基于前 3 阶段，定义第四阶段新增模型块
  - 说明 `1025/1026/1027` 的职责
- Files:
  - `docs/iterations/0286-matrix-userline-phase4/plan.md`
  - `docs/iterations/0286-matrix-userline-phase4/resolution.md`
- Verification:
  - 文档中必须明确：
    - `1025` 做什么
    - `1026` 做什么
    - `1027` 做什么
- Acceptance:
  - 第四阶段新增模型职责无歧义
- Rollback:
  - 回退本 iteration 文档

## Step 3

- Scope:
  - 冻结一对一视频与多人视频的最小范围
  - 不把范围扩成大型会议系统
- Files:
  - `docs/iterations/0286-matrix-userline-phase4/plan.md`
  - `docs/iterations/0286-matrix-userline-phase4/resolution.md`
- Verification:
  - 文档中必须明确：
    - 一对一最低线
    - 多人最低线
    - 多人不承诺大规模扩展
- Acceptance:
  - “多人”边界清晰
- Rollback:
  - 回退本 iteration 文档

## Step 4

- Scope:
  - 冻结最小呼叫控制能力
  - 排除屏幕共享、录制等范围外能力
- Files:
  - `docs/iterations/0286-matrix-userline-phase4/plan.md`
  - `docs/iterations/0286-matrix-userline-phase4/resolution.md`
- Verification:
  - 文档中必须明确：
    - 发起 / 接听 / 拒绝 / 挂断
    - 静音 / 关摄像头
    - 不含屏幕共享 / 录制
- Acceptance:
  - 呼叫控制范围清晰
- Rollback:
  - 回退本 iteration 文档

## Step 5

- Scope:
  - 再次显式写入加密后置
  - 明确后续加密线与当前非加密视频的切分
- Files:
  - `docs/iterations/0286-matrix-userline-phase4/plan.md`
  - `docs/iterations/0286-matrix-userline-phase4/runlog.md`
- Verification:
  - 文档中必须显式写出：
    - 不做加密视频
    - 后续才处理聊天 E2E / 加密视频
- Acceptance:
  - 第四阶段与后续加密线边界清晰
- Rollback:
  - 回退本 iteration 文档
