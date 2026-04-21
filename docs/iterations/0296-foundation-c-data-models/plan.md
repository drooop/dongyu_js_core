---
title: "0296 — foundation-c-data-models Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0296-foundation-c-data-models
id: 0296-foundation-c-data-models
phase: phase1
---

# 0296 — foundation-c-data-models Plan

## Goal

- 在 `0292` / `0294` 已冻结并落地的新引脚/数据合同之上，正式启动“数据模型先行”这条线。
- 先把第一批可复用的 Tier2 数据模型做成正式资产，作为后续 Matrix、Slide UI、Three.js 之外的基础能力层。

## Background

- `0292` 已冻结：
  - 引脚归属程序模型端点
  - payload = 临时模型表
  - 不引入 `pin.table.*`
- `0294` 已完成：
  - runtime 主语义切换
  - `model100 / 1010 / MBR / remote-worker` 主链迁到 `pin_payload`
- 历史上已有：
  - `0190` 完成了旧合同下的 `Data.Array` 首版模板
  - 但它仍建立在旧 payload/旧 helper 假设之上，不能直接视为新合同下的最终完成态
  - 它当前还有两个必须被显式迁移的问题：
    - 模板文件本身仍是 repo authoritative patch 形式（`version: "mt.v0"` + `records`）
    - `func.js` 内部把 `model_id: 2001` 写死在代码里，不能直接复用到别的实例
- 用户已明确：
  - 数据模型先实现
  - Flow 模型后置
  - Three.js 暂不纳入本 iteration

说明：
- 本 iteration 必须明确区分两层格式：
  - repo 内 authoritative template 文件格式
  - pin 上传输的运行时 payload 格式
- 前者短期内允许继续是 patch 文件；后者必须是临时模型表数组。

## Scope

- In scope:
  - 迁移并收口现有 `Data.Array` canonical template 到新合同
  - 在同一合同下补第一批数据模型族：
    - `Data.Array`
    - `Data.Queue`
    - `Data.Stack`
  - 明确这三者的：
    - 模型骨架
    - pin naming
    - payload contract
    - mutation / query 行为
    - deterministic contract tests
  - 形成最小用户文档与模板说明
  - 评估是否需要最小 Gallery 展示入口
- Out of scope:
  - Flow 模型
  - Matrix / Slide UI / Three.js 业务功能扩展
  - 清理 `pin.table.*` 历史残留的专门清理迭代
  - `MBR` / bus 拓扑重排
  - 加密相关能力
  - `Data.LinkedList` / `Data.CircularBuffer` / `FlowTicket`

## Invariants / Constraints

- 继续遵守 `0292` / `0294`：
  - 模型本地 pin 统一用 `pin.in / pin.out`
  - 数据输入输出一律使用临时模型表数组
  - 动作语义由 pin 名称承担，不放在 payload 数据里
- 数据模型属于 Tier2：
  - 默认落在正数模型空间
  - 不新增 Tier1 builtins
  - 不把数组/队列/栈操作下沉到解释器核心
- 本 iteration 主要是模板、函数、测试、文档工作：
  - 只有在发现 `0294` 新合同无法支撑数据模型最小能力时，才允许最小语义 bugfix
- 不允许因为做数据模型，顺手改写 `0283-0291` 业务线

## Approach Options

### A. 只迁 `Data.Array`

- 优点：
  - 范围最小
  - 风险最低
- 缺点：
  - 只能证明单个模板，不足以形成“数据模型族”
  - 后面 `Queue / Stack` 还要再开一轮重复迭代

### B. 迁 `Data.Array`，并补 `Data.Queue / Data.Stack`

- 优点：
  - 可以一次形成“数组 / 队列 / 栈”这一批基础族
  - 能更早验证新合同是否真的适合数据模型系列化扩展
  - 后面 Flow 模型可以直接站在这一批模板之上
- 缺点：
  - 范围明显大于只做 `Array`
  - 需要更严格控制不扩到 `LinkedList / CircularBuffer`

### C. 先做通用 shared helper，再挂多个数据模型

- 优点：
  - 理论上复用最高
- 缺点：
  - 会重新引入系统 helper / 隐式依赖问题
  - 与“正数模型中的自包含 Tier2 模板”方向相冲突

当前推荐：**B**

理由：
- `0190` 已经证明单做 `Array` 是可行的；
- 现在更有价值的是用新合同把第一批“数据模型族”站稳，而不是只迁一个模板。

## Success Criteria

- `0296` 获得 `Approved` 后，执行者不需要再猜这些问题：
  - `Data.Array / Queue / Stack` 的根 cell 和数据 cell 怎么放
  - 输入输出 pin 分别叫什么
  - 临时模型表 payload 最小 shape 是什么
  - mutation 后是否需要 ack pin
  - query 输出如何结构化返回
- 文档明确写清：
  - 为什么 `Data.Array` 需要迁旧模板
  - 为什么 `Queue / Stack` 现在值得一并做
  - 为什么 `Flow` 后置
  - authoritative template 文件格式与运行时 payload 格式如何区分
  - 旧 `2001` 硬编码要如何迁移
- resolution 给出可执行的 Step 级路径、验证和回滚口径。

## Risks & Mitigations

- Risk:
  - 范围从“数据模型先行”膨胀成“顺手做流程模型”
  - Mitigation:
    - 明确 `Flow` 全部后置，当前只做 `Array / Queue / Stack`
- Risk:
  - 为了复用引入新的系统 helper，破坏 Tier2 自包含方向
  - Mitigation:
    - 默认采用正数模型中的自包含模板，不新增负数系统 helper
- Risk:
  - `0190` 的旧模板假设和 `0294` 新合同发生冲突
  - Mitigation:
    - 先做 `Data.Array` 迁移审计，再展开 `Queue / Stack`

## Inputs

- Created at: 2026-04-06
- Iteration ID: 0296-foundation-c-data-models
- Dependencies:
  - `0292` Approved
  - `0294` Completed
