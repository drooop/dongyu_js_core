---
title: "0323 — ModelTable 读写权限与默认基础设施规约变更"
doc_type: iteration-plan
status: planned
created: 2026-04-17
updated: 2026-04-21
source: ai
iteration_id: 0323-modeltable-rw-permission-spec
id: 0323-modeltable-rw-permission-spec
phase: phase1
---

# 0323 — ModelTable 读写权限与默认基础设施规约变更

## WHAT

对 ModelTable 的运行时权限模型与 model.table 默认基础设施进行规约级变更：

1. **model.table (0,0,0) 默认三程序基础设施**：每个 model.table 的 (0,0,0) Cell 必须包含三个 `func.js` 标签作为默认基础设施程序（模型表写入、管理总线接收、管理总线发送），完全替代现有 (0,1,0) helper executor 模式。

2. **V1N API 读写权限收紧**：用户自定义程序模型的 API 面从无限制的 `ctx.writeLabel/getLabel/rmLabel` 收紧为：
   - 写入：`V1N.addLabel(k, t, v)` 仅限当前 Cell
   - 删除：`V1N.removeLabel(k)` 仅限当前 Cell
   - 读取：`V1N.readLabel(p, r, c, k)` 仅限当前模型内

3. **跨模型通信强制走 pin**：禁止任何绕过 pin 的直接跨模型读写。合法路径仅两种：
   - 子模型挂载路径（model.submt hosting cell → 引脚接出/接入）
   - Model 0 中转路径（上行到 Model 0 → pin.connect.model → 下发）

## WHY

当前 `ctx.writeLabel` 可写任意模型任意 Cell，与"模型即进程、引脚即 IPC"的架构愿景不一致。权限收紧使每个 model.table 成为独立沙箱，从根本上消除跨模型越权写入的可能性。

统一的 (0,0,0) 三程序基础设施替代分散的 helper executor，使模型的控制面入口一致、可预测。

## SCOPE

本迭代为 **docs-only**（Phase 1）。仅修改规约文档，不涉及代码、依赖或测试。

## 受影响文档

| 文档 | 变更类型 | 说明 |
|---|---|---|
| `CLAUDE.md` | 修改 | 更新 FUNCTION_LABELS 节增加默认三程序描述；更新 MODEL_FORMS 节增加 (0,0,0) 基础设施要求 |
| `docs/architecture_mantanet_and_workers.md` | 修改 | §3.4 Model Forms 增加 model.table 默认基础设施；§6 PIN 系统增加权限模型说明 |
| `docs/ssot/runtime_semantics_modeltable_driven.md` | 修改 | §5.3 模型形态约束增加 (0,0,0) 默认程序；新增 §5.x 运行时权限模型 |
| `docs/ssot/host_ctx_api.md` | 修改 | 全面改写：ctx 替换为 V1N 命名空间，写权限收紧到自身 Cell |
| `docs/ssot/label_type_registry.md` | 不变 | func.js 标签定义无需改动 |

## 后续迭代（本迭代不执行）

- **0323+1**：运行时代码实现 V1N API 面 + 权限检查；**同时冻结 mt_write / mt_bus_receive / mt_bus_send 的输入 payload 格式**（host_ctx_api.md §2 目前标注为"建议，待冻结"——在此迭代正式落定）
- **0323+2**：迁移所有现有系统函数（Model -10、Model -12 等）从 ctx.writeLabel 到 pin 链路；同步评估 Model -10 / -12 是否植入三程序（见 runtime_semantics §5.2g 0323 增补条款）
- **0323+3**：移除 (0,1,0) helper executor scaffold（仅 model.table 场景），保留 model.single 场景的 helper scaffold
- **0323+4**：更新所有 system-models JSON patches 适配新权限模型
- **0323+5（兼容期终止）**：确认所有 ctx.writeLabel / ctx.getLabel / ctx.rmLabel 调用点已完成迁移后，从运行时代码中移除 ctx API；在本迭代正式宣告 host_ctx_api.md §7 兼容期结束

## 前置依赖

无。本迭代为纯文档变更。

## 风险

| 风险 | 缓解 |
|---|---|
| 后续实现迭代影响面大（所有 ctx.writeLabel 调用需改） | 本迭代仅冻结规约，实现分阶段推进 |
| 新规约可能与 0322 及其前序 slide 迭代的假设冲突 | 文档中标注 deprecation 路径和兼容期 |
