---
title: "0304 — slide-runtime-scope-semantics-freeze Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0304-slide-runtime-scope-semantics-freeze
id: 0304-slide-runtime-scope-semantics-freeze
phase: phase1
---

# 0304 — slide-runtime-scope-semantics-freeze Plan

## 0. Metadata

- ID: `0304-slide-runtime-scope-semantics-freeze`
- Date: `2026-04-09`
- Owner: AI-assisted planning
- Branch: `dev_0304-slide-runtime-scope-semantics-freeze`
- Planning mode: `refine`
- Depends on:
  - [[docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan]]
  - [[docs/iterations/0302-slide-app-zip-import-v1/plan]]
  - [[docs/iterations/0303-cloud-worker-sync-and-color-proxy-import/runlog]]
  - [[docs/plans/2026-04-09-slide-runtime-followup-it-breakdown]]

## 1. Goal

- 冻结 Slide Runtime 下一阶段必须依赖的两条上位口径：
  1. `pin.table.* / pin.single.*` 的遗留口径如何从 SSOT 中清掉
  2. “单元格可被多层 model scope 发现，但执行只认引脚链”的新运行时语义如何写成正式规范
- 同时明确后续 IT 分工，避免把事件合同、新路由、旧路由拆除、执行型导入、Matrix 投递说明混在同一个 IT 里。

## 2. Background

- `0302/0303` 已把最小导入闭环和公网颜色生成器恢复跑通。
- 但当前仓库仍存在两个关键事实：
  - SSOT 仍保留 `pin.table.* / pin.single.*` 的旧条目
  - SSOT 仍假设每个 materialized Cell 只有唯一有效模型归属
- 用户已明确新的正式运行时语义：
  - 一个单元格可以被多层 model scope 发现
  - 这种发现来自：
    - 父模型逐层看到子模型
    - 矩阵模型看到其范围内的 `model.single` 与更小矩阵
  - 执行时单元格本身不关心自己属于哪些模型
  - 真正执行依赖的是预先生成好的引脚链

## 3. Problem Statement

- 如果不先冻结新语义，后续实现会持续发生口径冲突：
  1. 前端事件到底发给 `model_id`，还是发给“当前模型 / 当前单元格”
  2. 导入的 slide app 是否只是可渲染，还是可带程序模型执行
  3. 旧快捷路由是否还能保留，还是必须统一走 `Model 0` 起点和引脚链
  4. 同事侧的 Matrix 投递说明会基于哪套正式语义
- 所以 `0304` 不实现新功能，只先把“怎么解释”写清楚。

## 4. Scope

### 4.1 In Scope

- 更新 SSOT，冻结 Slide Runtime 新语义边界。
- 单独声明并验收：
  - `pin.table.* / pin.single.*` 文档残留清理
  - 多重模型归属新语义
- 明确后续 IT 分工与落位：
  - `0305`：事件目标合同 + 正数模型输入延后同步
  - `0306`：只建新合法 pin-chain 路由
  - `0307`：执行型导入 + 两类前端业务 + 安全策略
  - `0308`：旧快捷路由退役
  - `0309`：Matrix 投递说明与同事文档
- 约定 `0304` 完成后先出一份同事接口预告，不等 `0309`

### 4.2 Out of Scope

- 不在 `0304` 改 runtime、server、frontend 行为
- 不在 `0304` 放开 `func.js`
- 不在 `0304` 改前端事件 envelope
- 不在 `0304` 迁移旧快捷路由

## 5. Invariants / Constraints

### 5.1 `pin.table.* / pin.single.*` 清理是独立验收点

- `0304` 必须明确：
  - 这些口径在代码侧已不是当前主路径
  - SSOT 中必须清理到与现状一致
- 这件事单独作为验收点，不能和新语义混成“顺手修文档”

### 5.2 多重模型归属新语义是独立验收点

- `0304` 必须明确写清：
  - Cell 仍可有唯一主归属 / effective model label
  - 但它可以被多个上层 scope 发现
  - 执行时不按归属分支，而按引脚链传播
- 这件事单独作为验收点，不能被“文档清理”覆盖

### 5.3 `0306` 必须拆成建新和拆旧两步

- `0306` 只做合法路由建新
- 旧快捷路由移除单独放到 `0308`
- 不允许同一个 IT 同时承担：
  - 新路由可用
  - 旧路由拆除

### 5.4 `0307` 必须先冻结安全策略

- 在开始 `0307` 实现前，必须先有可审计的安全口径：
  - `func.js` 白名单
  - 沙箱边界
  - 禁止能力
- 不允许把这些留到实现中临场决定

## 6. Open Questions / Sequencing Decisions

### 6.1 `0305` 是否拆分

- 当前暂保留 `0305` 为一个 IT，但必须在 plan 中承认它同时承载两件事：
  - 事件目标合同升级
  - 正数模型 `Input` 延后同步
- 当前默认处理：
  - `0305` 内部采用两个独立验收点
  - 若评审时发现两者节奏明显不同，允许拆成：
    - `0305a` Input 延后同步
    - `0305b` 事件目标合同

### 6.2 `0306` 的验收对象

- `0306` 的验收默认使用内置模型验证，不依赖导入 app。
- 当前默认锚点：
  - `Model 100`
- 也就是说：
  - `0306` 先证明内置链路可通过 `Model 0 -> pin.connect.model -> target program model IN`
  - `0308` 再把同样的链路扩到导入 app

### 6.3 `0307` 的时序位置

- `0307` 是独立能力线，不应阻塞主线：
  - `0304 -> 0305 -> 0306 -> 0308 -> 0309`
- 当前默认：
  - `0307` 可在 `0306` 之后并行规划
  - 实施顺序优先不打断主线
- 也就是说：
  - 主线先跑通合法链路与执行型导入
  - `0307` 可并行或后置，但不应插在主线中间成为阻塞点

### 6.4 `0309` 的紧跟度

- `0309` 不是可无限后推的 cleanup。
- 当前默认：
  - `0309` 必须紧跟在 `0308` 后进入执行窗口
  - 不允许在新旧路由长期并存的状态下无限拖延
- 若 `0307` 需要实施，优先级不应高于 `0309` 对主线路由清理的收口

## 7. Success Criteria

`0304` 完成态必须同时满足以下 5 项：

1. SSOT 中 `pin.table.* / pin.single.*` 的遗留口径已被单独评估并收紧到与当前主路径一致。
2. SSOT 中已正式写出“多重模型归属 / 层级发现 / 执行只认引脚链”的新语义。
3. 后续 IT 分工已明确，尤其要明确：
   - 需求 3 落在 `0305`
   - 需求 4 落在 `0307`
   - `0306` 与 `0308` 分别负责建新路由和拆旧路由
4. 已约定 `0304` 结束后给同事一份接口预告。
5. 已显式记录这 4 个 sequencing / open question：
   - `0305` 是否拆分
   - `0306` 用内置模型验收
   - `0307` 不阻塞主线
   - `0309` 紧跟 `0308`

## 8. Inputs

- Created at: `2026-04-09`
- Iteration ID: `0304-slide-runtime-scope-semantics-freeze`
- Primary baselines:
  - [[docs/ssot/runtime_semantics_modeltable_driven]]
  - [[docs/ssot/label_type_registry]]
  - [[docs/iterations/0302-slide-app-zip-import-v1/plan]]
  - [[docs/iterations/0303-cloud-worker-sync-and-color-proxy-import/runlog]]
  - [[docs/plans/2026-04-09-slide-runtime-followup-it-breakdown]]
