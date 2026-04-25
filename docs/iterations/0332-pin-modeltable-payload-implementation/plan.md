---
title: "0332 — pin-modeltable-payload-implementation Plan"
doc_type: iteration-plan
status: approved
updated: 2026-04-24
source: ai
iteration_id: 0332-pin-modeltable-payload-implementation
id: 0332-pin-modeltable-payload-implementation
phase: phase2
---

# 0332 — pin-modeltable-payload-implementation Plan

## 0. Metadata
- ID: `0332-pin-modeltable-payload-implementation`
- Date: `2026-04-24`
- Owner: Codex
- Branch: `dev_0331-0333-pin-payload-ui`
- Depends on:
  - `0331-pin-modeltable-payload-contract`

## 1. Goal
实现 0331 合同：运行时、默认三程序、系统模型和本地部署链路都使用临时 ModelTable payload 传递 pin 数据，并保留颜色生成器可用。

## 2. Background
现有运行时已经支持 `pin_payload_v1` 外层 packet，但 packet 内部仍允许业务 pin value 是对象。`mt_write_req` 当前也是 `{ op, records }` 对象。本 iteration 要把这些内部业务 payload 收敛为临时 ModelTable 记录数组，尤其要让跨 cell 写入遵守“单 cell、单 label”的 `writeLabel` 规则。

## 3. Invariants (Must Not Change)
- 不恢复 `ctx.writeLabel/getLabel/rmLabel`。
- 不允许 UI 或 server 直接改业务 truth。
- 不允许跨模型直写绕过 `Model 0 pin.bus.in` / `pin.connect.model`。
- `pin.bus.*` 仍只允许在 `Model 0 (0,0,0)`。
- 本地验证必须先重启/部署受影响 stack，再做浏览器实测。

## 4. Scope
### 4.1 In Scope
- 新增临时 ModelTable payload 构造与解析 helper。
- `mt_write` 支持 0331 payload，拒绝多个用户 label。
- 用户程序 V1N 增加受限 `writeLabel(p,r,c,label)` helper，并通过显式 write pin 发出 payload。
- 迁移当前 Model 100/slide 主线中仍使用 `{ op, records }` 的 `mt_write_req` 调用。
- 更新测试、system-models、部署 patch 需要的 JSON。
- 本地 redeploy 后用浏览器测试 `http://127.0.0.1:30900/#/workspace` 的颜色生成器。

### 4.2 Out of Scope
- 不迁移所有历史负数系统模型 hostApi 能力。
- 不重写 Matrix/MBR 外层 transport；外层 `pin_payload_v1` packet 可保留，但其 `payload` 必须是临时 ModelTable 数组。
- 不做 UI cellwise 迁移；该工作归入 0333。

## 5. Non-goals
- 不用 fallback 接受旧 `{ op, records }` 作为新通过路径。
- 不新增 `pin.table.*` / `pin.single.*`。
- 不做远端 cloud 部署，除非本地验证显示必须。

## 6. Success Criteria (Definition of Done)
- 新合同测试证明：合法 `writeLabel` payload 能写入目标 cell；多个用户 label 会 reject。
- 旧 `{ op, records }` 写请求在 0332 目标路径中不再作为通过条件。
- `Model 100` 颜色生成器点击后颜色变化，按钮 loading 能释放。
- 本地部署检查通过，浏览器实测在 `http://127.0.0.1:30900/#/workspace` 完成。
- 每个小阶段都有 sub-agent `codex-code-review` 记录，且最终无 Change Requested。

## 7. Risks & Mitigations
- Risk: 当前 system-models 中仍有对象 payload。
  - Impact: 迁移漏项导致链路静默失败。
  - Mitigation: 增加 grep/contract tests，优先覆盖 `mt_write_req`、`Model 100`、slide import/create。
- Risk: V1N.writeLabel 与显式 pin 路由语义不清。
  - Impact: 用户以为 API 已写入，但实际未路由。
  - Mitigation: 缺少 write pin route 时写入可见 `__error_write_label`，测试覆盖。
- Risk: 本地部署成本高。
  - Impact: 验证耗时。
  - Mitigation: 先跑 deterministic tests，再只重启受影响本地 stack。

## 8. Open Questions
None. 0331 将冻结需要的合同细节。

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `docs/ssot/temporary_modeltable_payload_v1.md`
  - `docs/ssot/program_model_pin_and_payload_contract_vnext.md`
  - `docs/ssot/host_ctx_api.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
- Notes:
  - 本 iteration 必须同步更新 living docs review 记录。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `CLAUDE.md`
  - `docs/WORKFLOW.md`
- Notes:
  - 每个 implementation stage 后必须 sub-agent review。
