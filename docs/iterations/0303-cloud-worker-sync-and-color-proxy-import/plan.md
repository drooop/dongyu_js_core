---
title: "0303 — cloud-worker-sync-and-color-proxy-import Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0303-cloud-worker-sync-and-color-proxy-import
id: 0303-cloud-worker-sync-and-color-proxy-import
phase: phase1
---

# 0303 — cloud-worker-sync-and-color-proxy-import Plan

## 0. Metadata

- ID: `0303-cloud-worker-sync-and-color-proxy-import`
- Date: `2026-04-09`
- Owner: AI-assisted planning
- Branch: `dev_0303-cloud-worker-sync-and-color-proxy-import`
- Planning mode: `refine`
- Depends on:
  - [[docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/plan]]
  - [[docs/iterations/0302-slide-app-zip-import-v1/plan]]
  - [[docs/user-guide/slide_app_zip_import_v1]]
  - [[docs/user-guide/color_generator_e2e_runbook]]

## 1. Goal

- 修复 cloud 上“`ui-server` 已更新但 `mbr-worker / remote-worker` 未同步”的状态，让公网颜色生成器重新可用。
- 在当前 `0302` 导入合同下，产出一个可手动测试的复杂导入示例：
  - 一个 zip
  - 导入后会在 Workspace 中挂出一个新的 slide app
  - 打开后与当前颜色生成器功能一致

## 2. Background

- `0291` 期间已经确认：
  - cloud 上 `ui-server` 已更新
  - `mbr-worker` 与 `remote-worker` 的代码版本仍落后
- 用户已经明确反馈：
  - 公网颜色生成器例子当前跑不通
  - 需要一个后续可手动测试的“复杂导入例子”
- `0302` 当前合同允许 zip 中的 `ui_bind_json` 保留对外部已有 `model_id` 的引用。
- 这意味着可以用“代理现有 `Model 100`”的方式构造导入 app，而不必再发明一套新的业务逻辑。

## 3. Problem Statement

- 如果不先同步 cloud worker：
  1. 公网颜色生成器仍会断在双总线链路上
  2. 后续导入示例即使 UI 可打开，也无法证明“与真实颜色生成器一致”
- 如果不给出一个正式 zip 例子：
  1. `0302` 仍然只有结构级闭环，缺少一个足够复杂的真实示例
  2. 用户后续手测没有可直接上传的标准包
- 因此，这一轮必须同时回答：
  - cloud worker 如何对齐到当前 revision
  - 颜色生成器代理 zip 如何在不扩合同的前提下成立

## 4. Scope

### 4.1 In Scope

- 同步 cloud `mbr-worker` / `remote-worker` 到当前 revision，并恢复公网颜色生成器。
- 产出一个放在 `test_files/` 的导入包：
  - 建议包含源 `app_payload.json`
  - 对应 zip 文件
- 验证导入后：
  - Workspace 新增一个 app
  - 打开后颜色展示、输入和 `Generate Color` 行为与当前颜色生成器一致
- 新增最小测试覆盖：
  - cloud worker 版本同步不在仓库测试里直接证明，但运行时事实写入 runlog
  - 导入包结构与导入后代理 `Model 100` 的绑定写法必须有自动测试

### 4.2 Out of Scope

- 不扩 `0302` 导入合同。
- 不改颜色生成器业务逻辑。
- 不让导入包直接复制一套新的 remote worker 行为。
- 不进入 Gallery / 文档线的新收口。

## 5. Invariants / Constraints

### 5.1 导入包仍然必须服从 0302

- zip 中仍然只放一个 JSON payload 文件。
- metadata 仍然写在 root `(0,0,0)` labels 上。
- 不引入 manifest / assets / func.js / pin.bus.*。

### 5.2 代理方式优先于复制方式

- 推荐做法不是复制 `Model 100` 的全部真值和 worker 路径。
- 推荐做法是：
  - 导入 app 挂出一个新的 slide app host
  - 它的 `ui_bind_json` 继续读/写现有 `Model 100` 与 `Model -2` 上的既有 label
  - 从而实现“新 app 外观存在，但底层仍然是当前颜色生成器”

### 5.3 cloud 修复必须以运行事实为准

- 必须记录 cloud 上：
  - `ui-server`
  - `mbr-worker`
  - `remote-worker`
  的 pod / hash / rollout 事实。
- 不能只以“deploy 命令执行了”作为完成判定。

## 6. Success Criteria

- cloud 上颜色生成器重新可用。
- `test_files/` 中存在一个可上传的颜色生成器代理 zip。
- 本地或公网导入该 zip 后，会在 Workspace 中出现一个新 app。
- 打开该新 app 后，颜色展示、输入与 `Generate Color` 行为和现有颜色生成器一致。
- 导入完成后，该 app 仍可删除，不留下垃圾状态。

## 7. Inputs

- Created at: `2026-04-09`
- Iteration ID: `0303-cloud-worker-sync-and-color-proxy-import`
- Primary baselines:
  - [[docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/plan]]
  - [[docs/iterations/0302-slide-app-zip-import-v1/plan]]
  - [[docs/user-guide/slide_app_zip_import_v1]]
  - [[docs/user-guide/color_generator_e2e_runbook]]
