---
title: "0292 — foundation-pin-payload-contract-freeze Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-06
source: ai
iteration_id: 0292-foundation-pin-payload-contract-freeze
id: 0292-foundation-pin-payload-contract-freeze
phase: phase1
---

# 0292 — foundation-pin-payload-contract-freeze Plan

## 0. Metadata

- ID: `0292-foundation-pin-payload-contract-freeze`
- Date: `2026-04-06`
- Owner: AI-assisted planning
- Branch: `dev_0292-foundation-pin-payload-contract-freeze`
- Planning mode: `refine`
- Depends on:
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]
  - [[docs/iterations/0283-matrix-userline-phase1/plan]]
  - [[docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan]]
  - `https://bob3y2gxxp.feishu.cn/wiki/SgPHwHGrwi5xT5kEIGQccBkcn7c`

## 1. Goal

- 作为“基础 A”，先冻结后续所有业务线共同依赖的新底层合同，并完成影响盘点。
- 本 iteration 只做 docs-only 交付，不做代码实现。
- 交付物固定为：
  - 把 Feishu 中“临时模型表”定义搬入 repo 的：
    - [[docs/ssot/temporary_modeltable_payload_v1]]
  - 新合同 SSOT 文档，冻结三条：
    - 引脚归属程序模型
    - payload 为临时模型表
    - 不引入 `pin.table.*`
    - [[docs/ssot/program_model_pin_and_payload_contract_vnext]]
  - 全仓影响清单
  - 基础 B 的迁移策略草案
    - [[docs/plans/2026-04-06-pin-payload-impact-inventory-and-migration]]

## 2. Background

- 当前后续主线已经拆完，但都建立在旧合同之上：
  - Matrix 非加密：`0283-0286`
  - Slide UI：`0288-0291`
- 用户已明确：
  - 如果引脚归属和 payload 格式不先冻结，这些业务线后面都会返工
- 用户也补充了更紧凑的 3 步顺序：
  - 基础 A：合同冻结 + 影响盘点
  - 基础 B：runtime 实现 + 迁移
  - 基础 C：数据模型先行实现
- 其中基础 A 需要先把 repo 外部的 Feishu 定义拉回仓内，避免后续“以飞书为准还是以 repo 为准”反复摇摆。

## 3. Problem Statement

- 当前最大的风险不是某个具体产品线，而是基础语义未冻结：
  - 引脚到底归属 Cell 还是程序模型
  - 数据引脚传的到底是 action envelope 还是临时模型表
  - 是否继续引入 `pin.table.*`
- 如果基础 A 不先收口，后续 Matrix、Slide UI、3D 和数据模型都会边做边改底层合同。
- 但基础 A 也必须防止范围膨胀：
  - 不借机重构 `MBR`
  - 不借机重排 bus 拓扑
  - 不借机重写已规划的业务线

## 4. Scope

### 4.1 In Scope

- 拉取并落盘 Feishu “临时模型表”定义到 repo SSOT。
- 冻结 3 条新合同：
  - 引脚归属程序模型
  - payload = 临时模型表
  - 不引入 `pin.table.*`
  - 明确 `pin.model.*` 去留
  - 冻结 D0 / 非 D0 / 矩阵权限边界
- 盘点全仓受影响面，至少覆盖：
  - runtime
  - `ui-server`
  - `remote-worker`
  - `MBR`
  - system-models
  - 验证脚本
  - 已规划 iteration（`0283-0291`）
- 输出基础 B 的迁移策略草案。

### 4.2 Out of Scope

- 不做任何代码变更。
- 不做 `MBR` 重构设计。
- 不做 bus 拓扑重排。
- 不重写 `0283-0291` 的业务计划，只标记前置依赖影响。
- 不直接实现数据模型。

## 5. Invariants / Constraints

### 5.1 冻结范围必须卡死

- 本 iteration 只冻结：
  - 引脚归属
  - payload 格式
  - `pin.table.*` 不引入
- 不把更大的系统重构题目带进来。

### 5.2 repo 版本必须成为权威

- Feishu 文档可以作为来源，但落盘到 repo 之后，repo 版本才是执行权威。
- 后续实现和迁移都必须以 repo SSOT 为准。

### 5.3 影响盘点必须服务于迁移

- 影响盘点不是单独的分析文档堆积。
- 它必须直接服务于基础 B 的迁移路径。

## 6. Success Criteria

- 基础 A 完成后，必须至少具备：
  1. 一个 repo 内的“临时模型表”权威定义
  2. 一个冻结新引脚/数据合同的 SSOT 文档
  3. 一份全仓影响清单
  4. 一份基础 B 的迁移策略草案
- 文档必须能明确回答：
  - 默认程序模型的行为是什么
  - 多引脚和程序模型的关系是什么
  - `pin.model.*` 是否保留
  - D0 与非 D0 的权限边界是什么
  - 临时模型表的 schema 是什么
  - 为什么不引入 `pin.table.*`
  - 哪些仓内位置必须迁移

## 7. Inputs

- Created at: `2026-04-06`
- Iteration ID: `0292-foundation-pin-payload-contract-freeze`
- Primary baselines:
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]
  - [[docs/iterations/0283-matrix-userline-phase1/plan]]
  - [[docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan]]
  - `https://bob3y2gxxp.feishu.cn/wiki/SgPHwHGrwi5xT5kEIGQccBkcn7c`
