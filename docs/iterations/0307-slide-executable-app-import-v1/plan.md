---
title: "0307 — slide-executable-app-import-v1 Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-09
source: ai
iteration_id: 0307-slide-executable-app-import-v1
id: 0307-slide-executable-app-import-v1
phase: phase1
---

# 0307 — slide-executable-app-import-v1 Plan

## Goal

- 让导入的 slide app 不再只是“可渲染”，而是“可带程序模型并执行”。
- 落地 requirement 4 的两类前端业务：
  - `func.js` 代码片段
  - 发送特定事件，由后端写入后继续走数据链路

## Scope

- In scope:
  - 导入协议支持执行型 app
  - `func.js` 前端业务
  - 特定事件型前端业务
- Out of scope:
  - 不在本 IT 拆旧快捷路由
  - 不在本 IT 输出最终同事说明文档

## Safety Strategy

- `func.python` 继续禁用
- `func.js` 只允许出现在导入 app 自身的正数模型内，不允许触达负数系统模型
- 导入包继续禁止：
  - `pin.bus.in`
  - `pin.bus.out`
  - 直接跨系统边界的隐式能力
- `func.js` 运行边界必须锁在受控 ctx API 内：
  - 允许：读写当前合法模型链上的 label、走 pin 链、写日志
  - 不允许：直接文件系统、系统命令、任意网络、任意宿主能力
- 若现有执行上下文过宽，必须先收紧再开放导入执行

## Invariants / Constraints

- requirement 4 的安全策略必须先冻结，再实现
- 执行型导入不能破坏 `0302` 的可删除、可 remap、可持久化

## Success Criteria

1. 导入包可携带执行型程序模型
2. 两类前端业务都能端到端成立
3. 安全策略有明确白名单和边界

## Inputs

- Created at: 2026-04-09
- Iteration ID: `0307-slide-executable-app-import-v1`

