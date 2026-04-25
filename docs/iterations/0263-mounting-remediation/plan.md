---
title: "Iteration 0263-mounting-remediation Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0263-mounting-remediation
id: 0263-mounting-remediation
phase: phase1
---

# Iteration 0263-mounting-remediation Plan

## 0. Metadata
- ID: 0263-mounting-remediation
- Date: 2026-03-30
- Owner: Codex + User
- Branch: dev_0263-mounting-remediation
- Related:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `CLAUDE.md`
  - `scripts/ops/model_mounting_analyzer.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`

## 1. Goal
让 `ui-server`、`remote-worker`、`ui-side-worker`、`mbr-worker` 各自都满足显式挂载与 single-parent 规约，并把挂载审计切到按 worker profile 判定。

## 2. Background
`0262` 已证明 repo/runtime 事实下存在两类问题：
- canonical 视图里有 13 个非 0 模型未挂载
- `1` 与 `100` 在当前分析里存在多重挂载

用户已明确要求按 B 方案处理：所有 software worker 都必须分别符合规约，而不是只修 `ui-server` 主 runtime。

## 3. Invariants (Must Not Change)
- 规约仍以 `model.submt` 显式挂载与 single-parent 为准。
- Workspace 页面仍需正常打开 app 内容，不允许为了消除 `-25` 挂载而让 Workspace 退化成占位页。
- 不修改业务语义，只调整 hierarchy 和对应投影判定。

## 4. Scope
### 4.1 In Scope
- 为 `ui-server` 建立统一 `Model 0` hierarchy 挂载源
- 为 `remote-worker` / `ui-side-worker` / `mbr-worker` 各自补齐必要挂载
- 移除 `workspace_catalog_ui.json` 中不应作为正式父链的 `model.submt`
- 更新前端 mounted 判定逻辑
- 更新 analyzer/viz 为 profile audit

### 4.2 Out of Scope
- 新业务功能
- 远端 deploy 验证
- 非挂载相关的 UI 重构

## 5. Non-goals
- 不处理其它 `viz-*` 草稿文件
- 不重写 page asset / business state 合同

## 6. Success Criteria (Definition of Done)
1. `ui-server` / `remote-worker` / `ui-side-worker` / `mbr-worker` profile 审计均无 unmounted / duplicate mounts。
2. `Workspace(-25)` 不再承担 `1` / `100` 等 app 的正式父挂载。
3. Workspace 页面在新 hierarchy 下仍能正常解析选中 app。
4. 分析器与可视化输出基于 profile 给出 0 duplicate / 0 unmounted 结果。

## 7. Risks & Mitigations
- Risk: 移除 `-25` 挂载后 Workspace 变成 `not mounted`。
  - Impact: 页面回归。
  - Mitigation: 同步改 `deriveWorkspaceSelected` 为全局 hierarchy 扫描。
- Risk: 局部 worker profile 只补了 app mount，漏掉 `-10`。
  - Impact: 仍旧不合规。
  - Mitigation: profile test 同时断言每个 runtime 的 `-10` 挂载。

## 8. Open Questions
None.

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `CLAUDE.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
- Notes:
  - 按 worker profile 分别满足 single-parent 与 explicit mount。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `CLAUDE.md`
- Notes:
  - 本次为 hierarchy remediation，不改业务语义。
