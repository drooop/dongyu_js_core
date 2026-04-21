---
title: "Hard-Cut UI Authoring And Write Program"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Hard-Cut UI Authoring And Write Program

## Goal

对当前 UI 体系做一次真正的一刀切重建：

- `cellwise authoring` 成为唯一 authoring source
- rich page 不再以手写 `page_asset_v0` 作为 authoring source
- 业务写入统一切到 `pin/owner-materialization`
- direct business-state `bind.write` 废弃

## Non-Negotiable Rules

1. 不做兼容演进
2. 不保留“旧 authoring 继续新增”的空间
3. 旧路线只允许在 cutover 完成前维持现状，不再扩展
4. 新功能必须按新 contract 落地

## Program Breakdown

### 0253

冻结新 contract：

- component labels
- parent/slot/order/layout labels
- bind.read / bind.write 新语义
- 旧 `page_asset_v0` / direct business write 的废弃边界

### 0254

实现 cellwise authoring runtime/compiler：

- cellwise labels -> unique render target
- 不再让手写 page AST 成为 source of truth

### 0255

通用 write path cutover：

- business write -> `intent -> pin -> owner-materialization`
- UI-local state 保持 local/same-model 规则

### 0256

按新体系重建第一个真实页面并验证：

- authoring source
- render
- write path
- page evidence

### 0257

删除旧路线：

- legacy authoring loader/path
- direct business write path
- 旧文档入口

## Success Condition

最终系统只剩一套主路径：

- authoring: cellwise
- render: new compiled/runtime target
- business write: pin/owner-materialization

不再存在“继续用旧大 JSON authoring”或“继续 direct business bind.write”的官方路径。
