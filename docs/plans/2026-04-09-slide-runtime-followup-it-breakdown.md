---
title: "Slide Runtime Follow-up IT Breakdown"
doc_type: plan
status: active
updated: 2026-04-09
source: ai
---

# Slide Runtime Follow-up IT Breakdown

## Goal

在不打乱现有 `0302/0303` 最小闭环的前提下，把后续 Slide Runtime 主线拆成可审计、可逐步落地的 IT 序列。

## Current State

- 已完成：
  - zip 导入 / model_id 分配 / 挂载 / 打开 / 删除
  - 颜色生成器公网恢复
  - 负数模型本地草稿的延后同步基础
  - 代理 slide app 导入示例
- 关键缺口：
  - SSOT 仍假设“每个 materialized Cell 只有一个有效模型归属”
  - 前端 `submit` 仍主要依赖 `meta.model_id` 目标，而不是“当前模型 / 当前单元格”
  - `ui-server` 当前仍保留 mailbox / `dual_bus_model` 快捷触发路径
  - “mailbox -> pin ingress / routing” 目前主要还在 server 层显式分发，尚未正式收回 Tier 1 runtime
  - 导入协议当前默认禁止 `func.js`
  - 同事侧尚无正式的 Matrix 投递说明

## Requirement Landing

1. 滑动 app 的 Matrix 消息怎么发
   - 正式落位：`0309-slide-matrix-delivery-and-coworker-guide`
   - `0304` 完成后先给出一份接口预告（preview），不等 `0309`

2. 前端事件如何触发“当前单元格的程序模型 IN”
   - 事件目标合同：`0305-slide-event-target-and-deferred-input-sync`
   - 合法 pin-chain 执行：`0306-slide-pin-chain-routing-buildout`

3. 恢复类似 `Input` 的延后触发
   - 落位：`0305-slide-event-target-and-deferred-input-sync`

4. 两种前端业务
   - 允许 `js` 代码片段
   - 允许发送特定事件，由后端写入后继续走数据链路
   - 落位：`0307-slide-executable-app-import-v1`

## Iteration Split

### 0304 — runtime-scope-semantics-freeze

- 性质：docs-only / Phase 1 语义冻结
- 解决：
  - `pin.table.* / pin.single.*` 文档残留清理
  - 多重模型归属语义冻结
  - 后续 IT 分工声明

### 0305 — event-target-and-deferred-input-sync

- 性质：实现
- 解决：
  - 前端事件目标从“只发 model_id”升级为“发当前模型 + 当前单元格坐标”
  - 正数模型输入控件恢复延后同步，不再每次键入都双总线
- 备注：
  - 当前先合并为一个 IT
  - 若评审时发现节奏明显不同，允许拆成 `0305a/0305b`

### 0306 — pin-chain-routing-buildout

- 性质：实现
- 解决：
  - 新建合法链路
  - 把 mailbox 之后的 ingress 解释正式收回 Tier 1 runtime
  - 前端事件进入 `Model 0`
  - 经引脚 / 父子模型传递
  - 到达目标单元格程序模型 `IN`
  - 当前先迁：
    - `Model 100 submit`
    - `slide_app_import`
    - `slide_app_create`
    - `ws_app_add`
    - `ws_app_delete`
    - `ws_select_app` / `ws_app_select`
- 注意：
  - 对已迁移动作，缺 route 直接报错，不再走旧 direct fallback
  - 仍未迁移的非 slide 动作暂时保留 legacy shortcut，留到后续收口

### 0307 — executable-app-import-v1

- 性质：实现
- 解决：
  - 执行型 slide app 导入
  - 两类前端业务：
    - `func.js`
    - 特定事件触发后端写入，再走数据链
  - 必须先冻结安全策略：
    - `func.js` 白名单
    - 沙箱边界
    - 禁止能力清单
  - 这是独立能力线，不应阻塞 `0306 -> 0308 -> 0309` 主线

### 0308 — legacy-shortcut-retirement

- 性质：实现 / cleanup
- 解决：
  - 在 `0306/0307` 证明新链路稳定后，逐步移除 `ui-server` 里的旧快捷事件路由
  - 统一收口到合法 pin-chain

### 0309 — matrix-delivery-and-coworker-guide

- 性质：协议说明 + 用户文档
- 解决：
  - 同事侧如何发送滑动 app 的 Matrix 消息
  - 包格式 / metadata / 程序模型 / 事件链说明
  - 最短验证步骤
- 备注：
  - `0309` 需要紧跟 `0308`
  - 不应让新旧路由长期并存而无限后延

## 0304 Preview Deliverable

`0304` 完成后即输出一份 preview note，先给同事说明：

- Matrix 消息的大致 envelope
- zip / payload 合同
- 事件目标合同的预告版
- 当前哪些能力已经稳定，哪些还在后续 IT 中

它是预告，不替代 `0309` 的正式说明。
