---
title: "Pin/Payload Contract Impact Inventory And Migration Draft"
doc_type: plan
status: active
updated: 2026-04-06
source: ai
---

# Pin/Payload Contract Impact Inventory And Migration Draft

## Goal

盘清新合同会影响哪些仓内位置，并给出基础 B 的迁移路径草案。

适用前提：
- [[docs/ssot/temporary_modeltable_payload_v1]]
- [[docs/ssot/program_model_pin_and_payload_contract_vnext]]

## 1. Impact Inventory

### 1.1 Tier 1 Runtime / Core

直接受影响：

- `packages/worker-base/src/runtime.js`
- `packages/worker-base/src/runtime.mjs`
- `scripts/worker_engine_v0.mjs`

原因：
- 当前 runtime 仍内建 `pin.table.*` / `pin.single.*` 语义
- 当前 pin routing / boundary routing 仍假定 table/single 边界类型存在
- 当前函数与 pin 的归属不是“程序模型端点”语义

### 1.2 System Docs / Current SSOT

直接受影响：

- `docs/ssot/label_type_registry.md`
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/ssot/ui_model_pin_routing_architecture.md`
- `docs/ssot/ui_to_matrix_event_flow.md`
- `docs/ssot/host_ctx_api.md`

原因：
- 这些文档当前都还描述了：
  - `pin.table.*`
  - `pin.single.*`
  - `pin.log.table.*`
  - payload 中的旧动作/patch 路径

### 1.3 System Models / Patches

直接受影响：

- `deploy/sys-v1ns/remote-worker/patches/10_model100.json`
- `deploy/sys-v1ns/remote-worker/patches/11_model1010.json`
- `deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json`
- `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
- `packages/worker-base/system-models/test_model_100_full.json`
- `packages/worker-base/system-models/workspace_positive_models.json`
- `packages/worker-base/system-models/templates/data_array_v0.json`

原因：
- 当前这些 patch 里还存在：
  - `pin.table.in/out`
  - `pin.single.in/out`
  - `mt.v0` patch payload
  - 带 `action` 的业务 payload

### 1.4 UI / Host / Debug Surfaces

直接受影响：

- `packages/ui-model-demo-server/server.mjs`
- `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`

原因：
- 当前很多 host/adapter 路径仍然按旧 envelope、旧 pin family、旧 helper 写法理解输入输出。

### 1.5 Verification Surface

直接受影响：

- `scripts/tests/test_0216_threejs_scene_contract.mjs`
- `scripts/validate_program_model_loader_v0.mjs`
- 与 `mt.v0` / `pin.table.*` / `action` payload 强绑定的 contract tests

说明：
- 需要系统性重跑并更新 expectation
- 不能只改实现不改验证

### 1.6 Existing Planned Iterations

受影响的已规划业务线：

- `0283-0286` Matrix 非加密四阶段
- `0288-0291` Slide UI 四阶段

影响方式：

- `0283`
  - 聊天 message envelope 需要在新 payload 合同下复审
- `0284`
  - timeline / message input 的 pin 触发与数据口径需要复审
- `0285`
  - 用户管理层受影响较小，但仍要确认表单触发与数据传递语义
- `0286`
  - 视频信令 payload 需要在新数据合同下复审
- `0288`
  - transport/materialization 边界表述需要按新合同复审
- `0289`
  - slide-capable app 的 metadata / mount 不一定大改，但 pin 口径描述需要复审
- `0290`
  - 用户创建模板必须以新 pin/payload 语义为准
- `0291`
  - Gallery / 文档 / 证据口径必须跟随新合同更新

## 2. Migration Draft For Foundation B

### 2.1 Step A — Runtime Contract Cutover

- 在 runtime 中引入新的程序模型 pin 归属语义
- 明确 implicit program model 的最小行为
- 明确 `pin.in/out` 替代 `pin.table.*` / `pin.single.*` 的运行时解释

### 2.2 Step B — System Patch Migration

- 迁移核心 system-model patches：
  - `Model 100`
  - `Model 1010`
  - `MBR`
  - `ui-side-worker`
  - 数据模型模板
- 去掉旧 `pin.table.*`
- 去掉 payload 内动作字段

### 2.3 Step C — Validation Contract Migration

- 逐批更新 contract tests / validators
- 保证每一类旧语义都有对应的新 expectation
- 避免“实现已经切了，测试还在验证旧合同”

### 2.4 Step D — Planned Iteration Re-review

- 对 `0283-0291` 做一次集中复审
- 不要求重写整套计划
- 但必须明确哪些表述已受新合同影响

## 3. Explicit Non-Goals

本草案当前不做：

- `MBR` 总体架构重做
- Matrix 业务线重排
- Slide UI 主线重排
- Three.js 产品线改造
- 数据模型具体实现

这些都属于基础 B/C 之后的工作。
