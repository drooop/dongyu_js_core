---
title: "0331 — pin-modeltable-payload-contract Plan"
doc_type: iteration-plan
status: approved
updated: 2026-04-24
source: ai
iteration_id: 0331-pin-modeltable-payload-contract
id: 0331-pin-modeltable-payload-contract
phase: phase2
---

# 0331 — pin-modeltable-payload-contract Plan

## 0. Metadata
- ID: `0331-pin-modeltable-payload-contract`
- Date: `2026-04-24`
- Owner: Codex
- Branch: `dev_0331-0333-pin-payload-ui`
- Related:
  - `docs/ssot/temporary_modeltable_payload_v1.md`
  - `docs/ssot/program_model_pin_and_payload_contract_vnext.md`
  - `docs/ssot/host_ctx_api.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/user-guide/modeltable_user_guide.md`

## 1. Goal
冻结“pin 上传递的数据必须是临时 ModelTable payload”的正式合同，并把 `writeLabel` 从对象 envelope 写请求收敛为单 cell、单 label、ModelTable payload 形式。

## 2. Background
当前主线已经把跨模型 UI 事件收口到 `Model 0 pin.bus.in`，并把跨 cell 写入收口到 `(0,0,0) mt_write`。但现有 `mt_write_req`、`mt_bus_receive` 和部分 UI ingress 仍在 pin value 里携带 `{ op, records, target, value }` 这类对象 envelope。用户已明确要求：引脚上只能传递模型表形式的数据，过程字段也必须以 label 形式存在于临时模型表里；`writeLabel` 语义只写一个目标 cell 的一个 label。

## 3. Invariants (Must Not Change)
- ModelTable 仍是唯一真值；UI、server、worker 只能投影或转运。
- 所有副作用仍必须经 `add_label` / `rm_label` 触发。
- 用户程序不得直接跨模型读写。
- 非 root 用户程序不得直接跨 cell 写；跨 cell 写必须经显式 pin 链路到当前模型 `(0,0,0)`。
- `model.table (0,0,0)` 默认三程序仍是模型内特权入口，不能被用户模型覆盖。
- 新合同不得恢复 legacy `ctx.writeLabel/getLabel/rmLabel`。

## 4. Scope
### 4.1 In Scope
- 定义 canonical pin payload：临时 ModelTable 记录数组。
- 定义 `writeLabel` payload：单临时模型、单 cell、内置 metadata label + 一个用户 label。
- 定义内置 metadata key 命名、解析规则和冲突处理。
- 定义显式 write pin / root `mt_write_req` 路由要求。
- 更新 SSOT、label registry、user guide 和 0332 实施验收口径。

### 4.2 Out of Scope
- 本 iteration 不修改 runtime 实现。
- 本 iteration 不迁移 `Model 100` UI 到 cellwise；该工作归入 0333。
- 本 iteration 不把所有历史 hostApi 负数系统模型能力一次性移除。

## 5. Non-goals
- 不重新设计 `model.submt` 或父子模型所有权。
- 不引入新的 `pin.table.*` / `pin.single.*` / `pin.model.*` family。
- 不允许用“兼容对象 envelope”作为新合同的一部分。

## 6. Success Criteria (Definition of Done)
- SSOT 明确：非 null pin payload 必须是临时 ModelTable payload 数组。
- `writeLabel` 合同明确：只支持一个目标 cell 的一个 label；多个用户 label 必须 reject。
- 内置 metadata label 命名、必填字段、保留前缀和错误码可被测试裁决。
- 0332 的实现步骤与验证命令可以直接按本合同执行。

## 7. Risks & Mitigations
- Risk: 一刀切会影响当前仍传 object 的路径。
  - Impact: 颜色生成器、slide import/create 或 worker 链路可能回归。
  - Mitigation: 0332 先加合同测试，再迁移 `default_table_programs`、`Model 100`、slide 主线和 worker patch。
- Risk: metadata key 与用户 key 冲突。
  - Impact: 用户 label 被误判或系统字段被覆盖。
  - Mitigation: 统一使用 `__mt_*` 保留前缀；用户 payload 中该前缀视为系统字段，不计入用户 label。
- Risk: 显式 write pin 增加填表负担。
  - Impact: 用户需要多填连接。
  - Mitigation: 用户 API 只暴露 `writeLabel(p,r,c,{k,t,v})`；显式 pin 由模板/示例生成，但表内可见、可审计。

## 8. Open Questions
None. 用户已在 2026-04-24 明确授权 Codex 自行完成三阶段任务，并由 sub-agent review 代替后续人工 gate。

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/host_ctx_api.md`
  - `docs/ssot/temporary_modeltable_payload_v1.md`
  - `docs/ssot/program_model_pin_and_payload_contract_vnext.md`
- Notes:
  - 本 iteration 是 docs-only 合同冻结，不能修改 runtime code。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `CLAUDE.md`
  - `docs/WORKFLOW.md`
- Notes:
  - 用户本轮授权视为 0331/0332/0333 总体方向 Approved；每个小阶段仍必须由 sub-agent 进行 `codex-code-review`。
