---
title: "0242 — local-ui-model-example-and-sync-validation Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0242-local-ui-model-example-and-sync-validation
id: 0242-local-ui-model-example-and-sync-validation
phase: phase1
---

# 0242 — local-ui-model-example-and-sync-validation Plan

## Metadata

- ID: `0242-local-ui-model-example-and-sync-validation`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch: `dropx/dev_0242-local-ui-model-example-and-sync-validation`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0215-ui-model-tier2-examples-v1`
  - `0240-local-browser-evidence-rerun-after-0238-0239`

## WHAT

本 iteration 不新增 runtime 能力，只做三件本地收口：

1. 明确确认当前 UI 抽象层已经不再把整页 UI 塞进单个大 JSON value 作为唯一 authority，而是拆成：
   - `ui_page_catalog_json` 路由目录
   - schema cell labels（如 `1003:(1,0,0)`）
   - `page_asset_v0`
   - `model.submt` 显式挂载
2. 给出一份可直接照抄的本地 Fill-Table 示例说明，解释：
   - 哪些单元格要填
   - 如何把 parent model 挂进 Workspace
   - 如何把 child model 通过 `model.submt` 挂进 parent
   - Workspace 怎样把它显示出来
3. 冻结一条你明确关心的同步合同：
   - remote mode 下，输入写到负数 UI-local state 时，浏览器先立即响应
   - server/modeltable 同步通过 `remote_store` 的 coalesced draft flush 在约 `0.2s` 后发送

## WHY

用户当前要的不是再修一轮 UI，而是：

- 确认“抽象层是否真的拆开了”
- 拿到一个可以直接照着填表的本地案例
- 拿到一个确定的同步验证过程，证明本地流程已就绪

这些内容在仓库里零散存在：

- `0215` 已经提供了 schema / page_asset / parent-mounted child examples
- `0186` 已经提供了 overlay / delayed sync 机制
- `0240` 已经证明本地环境总体 effective

但还没有一份面向使用者的、把这三块串起来的本地证明。

## Scope

### In Scope

- 读取并归纳 `0215` example models 的 authoritative 写法
- 新增一份 user guide 级别的本地示例文档
- 新增一条 focused contract test，冻结 `0.2s` delayed sync 行为
- 复跑：
  - `0215` example contract
  - local/server example validators
  - `0186` overlay contracts
  - 新的 debounce contract

### Out Of Scope

- 新增新的 UI renderer primitive
- 新增新的 Workspace app
- 修改 remote deploy / auth / cloud 流程
- 重新设计 commit_policy 语义

## Success Criteria

- 有一份新的 user guide 文档，能明确回答：
  - 结构拆分是否完成
  - 一个 Workspace UI model 例子要填哪些格
  - 如何做 `model.submt` 挂载
  - 如何验证本地显示和同步
- 新 test 能稳定证明：
  - 对同一个负数 UI-local state 输入快速连续更新
  - UI 立即更新
  - `/ui_event` 不立即发送
  - 约 `200ms` 后只发送一次，且 payload 取最后值
- 现有 `0215` / `0186` validators 保持通过

