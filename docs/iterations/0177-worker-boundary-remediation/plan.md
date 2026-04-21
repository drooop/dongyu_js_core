---
title: "0177 — Plan (WHAT/WHY)"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0177-worker-boundary-remediation
id: 0177-worker-boundary-remediation
phase: phase1
---

# 0177 — Plan (WHAT/WHY)

## Goal

- 把“trusted bootstrap 初始化直写”和“运行期标准数据链路”彻底分开，封堵当前 `ui-server`、`mbr worker`、Sliding UI worker 仍保留的建模旁路。
- 使运行期只允许标准链路与 owner/materialization 这类 sanctioned path 生效；初始化时允许的直写必须被收敛为受信任来源，且在 `running` 前不得触发软件工人执行。

## Scope

- In scope:
  - 定义并实现全局 `boot -> edit -> running` 生命周期模式。
  - 保留 trusted bootstrap 直写：系统模型加载、SQLite 恢复、`MODELTABLE_PATCH_JSON`。
  - 封堵 `/api/modeltable/patch`、`LocalBusAdapter`、`submt` hosting Cell 非法混写、`mbr_mgmt_to_mqtt` 通用 CRUD 翻译等高优先级旁路。
  - 将 Matrix / MQTT 读取与文档口径对齐到 Model 0 `(0,0,0)`。
  - 更新 SSOT、user-guide、iteration runlog 和验证日志。
- Out of scope:
  - 不实现 `running -> edit` 回退。
  - 不补做新的通用建模 UI 产品方案；本轮默认 owner/materialization 仍是唯一 sanctioned authoring path。
  - 不保留兼容分支、隐式补全、legacy fallback。

## Invariants / Constraints

- `CLAUDE.md` 约束优先：
  - iteration 必须先登记，再实施。
  - 所有副作用仍必须落在 ModelTable 语义内，不能新增 UI 直连旁路。
  - Model 0 是系统根；外部 MQTT 入口只能经由 Model 0 的 `pin.bus.in / pin.bus.out`。
- 用户已明确：
  - 初始化阶段允许 direct write，但仅限 trusted bootstrap。
  - 初始化过程中不应让软件工人提前跑起来。
  - 不允许任何兼容或补丁式回填。
- Feishu 最新规约补充：
  - `mqtt.local.*` / `mqtt.global.*` 与 `matrix.*` 仅在 `model_id=0` 的 `(0,0,0)` 生效。
  - `submt` 表示子模型映射位置；有 `submt` 的单元格不得再承载除引脚标签外的其他标签。

## Success Criteria

- `ui-server` 默认停在 `edit`，未显式激活前不执行运行期函数、不发 Matrix、不发 MQTT。
- headless worker 在 bootstrap 完成前不执行运行期桥接；bootstrap 完成后自动进入 `running`。
- `/api/modeltable/patch` 不再是通用 patch 入口；直接访问得到明确拒绝。
- `LocalBusAdapter` 不再允许 `submodel_create`、generic label CRUD、`cell_clear` 直写 runtime。
- `runtime.applyPatch(... allowCreateModel=true)` 不再作为 generic runtime path 隐式补建模型；仅 trusted bootstrap loader 可用。
- `submt` 作为子模型映射位继续允许出现在任意 hosting Cell，但 hosting Cell 只能承载 `submt + pin.*`。
- `mbr_mgmt_to_mqtt` 不再翻译 `create_model`、label CRUD、`cell_clear`、指向 `model_id=0` 或负数模型的 target。
- 更新后的验证应覆盖：
  - 0176 的非法反例切换为 reject；
  - 0175 的本地颜色生成器 OrbStack roundtrip 继续 PASS；
  - 文档口径与 Feishu `MQTT标签` / `Matrix标签` 一致。

## Inputs

- Created at: 2026-03-08
- Iteration ID: 0177-worker-boundary-remediation
- Upstream:
  - `0176-worker-spec-audit`
  - Feishu wiki `LGsZwaXMRiHqOXkB2qocbyfwnKh` 中 `mqtt：MQTT标签` / `matrix：Matrix标签`
