---
title: "0347 — Temporary ModelTable Message Contract Plan"
doc_type: iteration-plan
status: approved
updated: 2026-04-27
source: ai
iteration_id: 0347-temporary-modeltable-message-contract
id: 0347-temporary-modeltable-message-contract
phase: planning
---

# Iteration 0347-temporary-modeltable-message-contract Plan

## Goal

- 核查仓库中与 `Data.*` 数据模型相关的当前定义，明确它们与 pin/event 传输格式的关系。
- 冻结“Temporary ModelTable Message”合同：format is ModelTable-like, persistence is explicit materialization。
- 把该合同写入 SSOT 与开发者可读文档，避免后续把“传输格式像模型表”误解成“传输过程自动落表”。

## Scope

- In scope:
- `Data.Array / Data.Queue / Data.Stack` 当前规范、模板、fixture 与旧 `CircularBuffer` 代码的关系说明。
- `pin.in / pin.out / pin.bus.*` 非空 value 的临时 ModelTable-like message 规则。
- 临时 message 与正式 materialized ModelTable 的边界：接收、路由、缓存、trace 都不自动成为业务 truth。
- 显式 materialization 的触发边界：必须由接收程序模型、owner materializer、D0 helper 或明确导入/安装流程执行。
- Out of scope:
- 不改 runtime 解释器、不改 UI、不改 worker 部署。
- 不新增 Data.* 类型，也不迁移旧 `CircularBuffer` 实现。
- 不定义临时 message 的远端 transport envelope 编码细节。

## Invariants / Constraints

- `CLAUDE.md`：UI 只是 ModelTable projection；正式业务事件必须经 Model 0 `pin.bus.in`；所有副作用只能通过 `add_label / rm_label` 的 owner/materialization 路径。
- `docs/ssot/temporary_modeltable_payload_v1.md`：正式业务 pin 非空 value 必须是 `{id,p,r,c,k,t,v}` record array。
- `docs/ssot/program_model_pin_and_payload_contract_vnext.md`：payload 只表达数据，动作由 pin 名称和接收程序模型决定。
- `docs/ssot/label_type_registry.md`：`pin.in / pin.out / pin.bus.*` 的 value 只能是 `null` 或临时 ModelTable payload array。
- 0296 已把 `Data.Array / Queue / Stack` 定为 Tier2 数据模型族；模板文件 `mt.v0` wrapper 是仓库资产格式，不是运行时 pin payload。

## Success Criteria

- 已记录 Data.* 现状判断：当前正式数据模型定义与本合同相关，且已采用临时 ModelTable record array 作为 pin payload；旧 `data_models.js` 是历史 live dependency，不是当前合同来源。
- SSOT 明确包含英文硬规则：`format is ModelTable-like; persistence is explicit materialization`。
- SSOT 明确 `id` 是 message-local 临时 id，不是正式 `model_id`；收到 message 不会自动创建/修改正式模型表。
- 用户指南说明 Data.* 的输入输出 message 只是传输格式；只有接收程序按 pin 语义写入自身数据行时，才发生正式 materialization。
- 自动化文档检查通过，且 sub-agent code review 对合同一致性给出 Approved。

## Inputs

- Created at: 2026-04-27
- Iteration ID: 0347-temporary-modeltable-message-contract
