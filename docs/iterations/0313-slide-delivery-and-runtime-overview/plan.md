---
title: "0313 — slide-delivery-and-runtime-overview Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0313-slide-delivery-and-runtime-overview
id: 0313-slide-delivery-and-runtime-overview
phase: phase1
---

# 0313 — slide-delivery-and-runtime-overview Plan

## Goal

- 产出一页新的同事总说明，并排解释“slide app 怎么交付进来”和“导入后它怎么响应点击并继续跑下去”。

## Scope

- In scope:
  - 新页目标文件路径冻结为：
    - `docs/user-guide/slide_delivery_and_runtime_overview_v1.md`
  - 固定这页的 4 节结构：
    - 安装交付
    - app 结构
    - 运行时触发
    - Matrix 关系
  - 固定它与现有文档的分工边界
- Out of scope:
  - 不修改 runtime 逻辑
  - 不修改上传鉴权或 cache 逻辑
  - 不在这页里重复展开上传鉴权与 cache 细节
  - 不发明新的 Matrix room message 协议

## Invariants / Constraints

- 这页是总览页，不是新的协议源头。
- 上传鉴权和 cache 细节只链接：
  - `docs/user-guide/slide_upload_auth_and_cache_contract_v1.md`
- 安装交付继续以当前正式主线为准：
  - zip -> `/api/media/upload` -> `mxc://...` -> importer click
- 运行时业务消息只解释当前已存在路径：
  - 当前模型 + 当前单元格 + 当前 pin
  - app 自己定义的后续 pin 链
  - 已存在的 `pin_payload v1`
- 本页必须把“安装时上传/导入链”和“运行中业务发包链”明确分开，不能混写成同一件事。

## Success Criteria

1. 新页职责和目录已经在迭代文档里冻结。
2. 同事读 plan 就能知道这页要回答什么、故意不回答什么。
3. 不会再和 `0309/0312` 的现有专页发生职责打架。

## Inputs

- Created at: 2026-04-10
- Iteration ID: `0313-slide-delivery-and-runtime-overview`
- Source request:
  - 用户要求把“交付”和“运行”两段链路并排讲清楚
  - 用户明确要求不要在这页里重讲上传鉴权细节，也不要发明新的 Matrix room message 协议
