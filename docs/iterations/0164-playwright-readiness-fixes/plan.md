---
title: "Iteration 0164-playwright-readiness-fixes Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0164-playwright-readiness-fixes
id: 0164-playwright-readiness-fixes
phase: phase1
---

# Iteration 0164-playwright-readiness-fixes Plan

## 0. Metadata

- ID: `0164-playwright-readiness-fixes`
- Date: `2026-03-21`
- Owner: `AI-assisted`
- Branch: `dev_0164-playwright-readiness-fixes`
- Status: `Phase 1 / Planned`
- Related:
  - `docs/ITERATIONS.md`
  - `docs/user-guide/color_generator_e2e_runbook.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/tier_boundary_and_conformance_testing.md`

## 1. Goal

将 Model 100 浏览器验收前的关键链路收敛到当前 `pin.*` / `pin.connect.*` 规约，修复会导致 Playwright 准入结论失真的前置问题，并在不触碰业务功能扩展的前提下给出明确的 readiness verdict。

## 2. Background

- `docs/ITERATIONS.md` 已登记 `0164-playwright-readiness-fixes`，当前状态为 `On Hold`；本次 Phase 1 目标是重建一份可直接用于后续 Review Gate 的自包含计划。
- `docs/user-guide/color_generator_e2e_runbook.md` 明确把 Color Generator 的浏览器验收定义为：
  - 登录 UI
  - 发送 `model_id=100` 的 `ui_event`
  - 轮询 `/snapshot`，确认 `bg_color` 变化
- 上述浏览器验收只有在底层链路已经符合当前 SSOT 时才有意义；否则 Playwright 即使“看起来通过”，也可能只是走通了历史兼容路径或 host glue 旁路，不能证明当前规约链路可用。
- 2026-03-21 的 codebase 分析表明，`0164` 的影响范围集中在以下活跃资产，而不是整个前端或整套浏览器基础设施：
  - `packages/worker-base/system-models/test_model_100_ui.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/run_worker_remote_v0.mjs`
  - `scripts/tests/test_0164_migration_readiness.mjs`
  - `scripts/validate_builtins_v0.mjs`
- 当前仓库没有独立的 `playwright.config.*` 或根级 Playwright package script；仓库内浏览器验收是通过 runbook、现有脚本、截图证据和外部浏览器执行链完成的。因此 `0164` 的职责不是新增 Playwright 平台，而是修复“允许进入后续浏览器验收”的前置条件。
- 与 `0164` 直接相关的事实边界是：
  - `PIN_IN` / `PIN_OUT` / `IN` 在当前 SSOT 中属于 historical aliases，不是新的合法实现面
  - 颜色生成器路径的准入判断必须同时覆盖模型补丁、server dual-bus patch ingress、remote worker mailbox 声明和验证脚本

## 3. Invariants (Must Not Change)

- `Phase 1` 只生成文档，不写实现代码、不改依赖、不跑实现性修复。
- ModelTable 仍是唯一真值源；UI 仍只是投影，不能借“为 Playwright 好跑”引入新的 UI 旁路。
- UI 事件仍必须遵守 mailbox 和既有 relay 规则，不能直接写业务真值或绕过 Model 0 出口。
- 本次迭代只处理“Playwright readiness”前置问题，不新增业务功能，不扩张到远端部署或集群运维。
- 不引入新的 legacy alias，不保留“功能虽然能跑但不合规”的兼容路径。
- 不触碰当前未提交的前端 / renderer 工作线，除非后续 Review Gate 明确批准并证明其与 readiness blocker 直接相关。

## 4. Scope

### 4.1 In Scope

- 审计并清点 Model 100 浏览器验收前置链路中的活跃资产。
- 收敛 active model patches 到当前 `pin.*` family 和当前 routing 语义。
- 收敛 `server.mjs` 的 dual-bus patch ingress 到 runtime 当前模型输入类型判定，而不是硬编码 legacy `IN`。
- 收敛 `scripts/run_worker_remote_v0.mjs` 的 mailbox 端口声明与出入站语义到当前 pin family。
- 用定向测试和静态校验冻结 regression surface，保证后续任何 legacy 回流都能被 deterministic PASS/FAIL 命中。
- 产出明确的 Go/No-Go 准入结论，回答“是否已经具备进入后续 Playwright 浏览器验证的代码前置条件”。

### 4.2 Out of Scope

- 不在本迭代内设计或引入新的 Playwright runner、Playwright config、测试框架封装。
- 不直接执行本地或远端 integrated browser validation；那属于 readiness 之后的验收迭代。
- 不重构 `packages/ui-model-demo-frontend/` 或 `packages/ui-renderer/`。
- 不修改集群、k8s manifest、cloud deploy、remote ops 流程。
- 不新增 SSOT 语义，不新增 `label.t`，不改变 tier 边界。

## 5. Non-goals

- 不把 `0164` 扩写成“重新设计浏览器测试体系”的迭代。
- 不用兼容层或降级路径去保留历史 `PIN_IN` / `PIN_OUT` / `IN` 写法。
- 不以“Playwright 暂时能跑”为理由接受 tier placement、model placement、data flow 或 data chain 违规。
- 不把 archive、historical docs、legacy fixtures 中的旧术语清理扩大为全仓库大扫除。

## 6. Success Criteria (Definition of Done)

- 活跃的 Model 100 readiness 路径不再依赖 legacy `PIN_IN` / `PIN_OUT` / `IN` 声明或判断。
- `server.mjs` 的 dual-bus patch ingress 使用 runtime 当前模型输入类型判定，不再把 legacy `IN` 当作默认输入面。
- `scripts/tests/test_0164_migration_readiness.mjs` 与 `scripts/validate_builtins_v0.mjs` 能稳定提供 deterministic PASS/FAIL，并覆盖本迭代定义的 regression surface。
- 后续执行阶段能够基于命令输出和代码证据，明确回答：
  - 是否满足进入 Playwright 的代码前置条件
  - 若不满足，具体阻塞点落在哪个文件和哪一类链路
- Conformance review 能明确记录：
  - tier placement
  - model placement
  - data ownership
  - data flow
  - data chain

## 7. Risks & Mitigations

- Risk: 搜索结果会命中 historical aliases、注释或 archive，导致执行时误把“历史痕迹”当成“活跃 blocker”。
  - Impact: 范围膨胀，甚至误改无关资产。
  - Mitigation: 只以本计划列出的活跃文件集作为修复与回归边界；其他命中仅作说明，不默认纳入修改。
- Risk: 收敛 server / worker / model patch 的输入面后，可能暴露此前被兼容逻辑掩盖的链路问题。
  - Impact: readiness 测试从“绿”变成“红”。
  - Mitigation: 用定向测试先显式化失败，再做最小修复，并配套保留 remote worker 合同验证。
- Risk: 代码层 readiness 已通过，但浏览器验收仍可能被认证、Matrix、MQTT 或环境配置阻塞。
  - Impact: 误把环境阻塞当成代码阻塞。
  - Mitigation: 本迭代成功标准只裁决“代码前置条件是否满足”；真正的浏览器执行 blocker 作为后续验收阶段单独记录。

## 8. Open Questions

None.

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist

- SSOT references:
  - `CLAUDE.md` `HARD_RULES`
  - `CLAUDE.md` `WORKFLOW`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/tier_boundary_and_conformance_testing.md`
  - `docs/user-guide/color_generator_e2e_runbook.md`
- Notes:
  - `PIN_IN` / `PIN_OUT` / `IN` 只允许作为 historical alias 被识别，不构成当前新工作的合法输入面。
  - readiness verdict 必须基于当前 `pin.*` family 和当前 routing 语义，而不是基于 legacy fallback。
  - 浏览器准入结论不仅要看“页面是否能动”，还要看 tier placement、model placement、data ownership、data flow、data chain 是否合规。

### 9.2 Charter Compliance Checklist

- Charter references:
  - `docs/charters/dongyu_app_next_runtime.md`
  - `docs/architecture_mantanet_and_workers.md`
- Notes:
  - UI 仍是投影层，不得为了浏览器验证便利而获得新的执行权。
  - 所有可观察行为仍必须可还原为 Cell 演化，而不是 host 侧隐式补偿。
  - 本次迭代只做 readiness 前置修复，不把隐藏平台辅助逻辑塞回正数业务模型以规避 Tier 2 工作。

> 本文件只定义 WHAT/WHY；不得记录 Step 编号、执行命令、PASS/FAIL、commit 或运行输出。
