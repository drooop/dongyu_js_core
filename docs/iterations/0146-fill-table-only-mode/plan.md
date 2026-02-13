# 0146 — Fill-Table-Only 显式强制模式

## 0. Metadata
- ID: 0146-fill-table-only-mode
- Date: 2026-02-14
- Owner: AI (User Approved)
- Branch: dev_0146-fill-table-only-mode
- Related:
  - `CLAUDE.md` (`fill-table-first`, `CAPABILITY_TIERS`)
  - `docs/WORKFLOW.md`
  - `docs/ITERATIONS.md`
  - `scripts/validate_fill_table_only_mode.mjs`

## 1. Goal
当任务被明确声明为“只能填表实现”时，提供可执行且可审计的强制模式：只允许填表/治理相关文件改动，任何 runtime 旁路实现直接 FAIL，并要求产出 runtime capability gap 报告。

## 2. Background
当前仓库已有 `fill-table-first` 原则，但它是策略约束，缺少“按任务显式开启”的硬门禁。对于“颜色选择器”这类能力，如果在实现阶段允许改 runtime，会掩盖基座能力缺口，无法形成真实的能力边界证据。

## 3. Invariants (Must Not Change)
- Runtime base 语义边界不变（`packages/worker-base/src/runtime.js` / `runtime.mjs` 不在本迭代改动范围内）。
- Fill-Table-Only 不是全局默认模式；仅在显式开启时生效。
- 判定必须可复现（脚本化 PASS/FAIL），不能依赖人工解释。
- 违规时必须输出明确 required action，禁止 silent fail。

## 4. Scope
### 4.1 In Scope
- 定义并落地 Fill-Table-Only 模式 SSOT 文档。
- 提供 `scripts/validate_fill_table_only_mode.mjs` 的可执行门禁契约。
- 新增确定性测试脚本，覆盖 `SKIP / PASS / FAIL`。
- 迭代台账（plan/resolution/runlog + ITERATIONS index）补齐。

### 4.2 Out of Scope
- 修改 runtime 解释器行为。
- 修改业务模型逻辑（如 color generator 具体函数）。
- 引入 CI 平台集成（本迭代仅提供本地可执行门禁）。

## 5. Non-goals
- 不实现“自动生成”runtime capability gap 报告（只强制输出 required action）。
- 不把仓库切换为永久 Fill-Table-Only 模式。

## 6. Success Criteria (Definition of Done)
- `scripts/validate_fill_table_only_mode.mjs` 在未开启时输出 `[SKIP]` 并返回 0。
- 开启后：白名单路径返回 `[PASS]`，非白名单路径返回 `[FAIL]` 且包含 `required_action=write_runtime_capability_gap_report`。
- `docs/ssot/fill_table_only_mode.md` 明确激活条件、允许/禁止范围、违规处置与执行命令。
- `scripts/tests/test_0146_fill_table_only_mode_guard.mjs` 全部 PASS。
- `docs/iterations/0146-fill-table-only-mode/runlog.md` 有真实命令与输出证据。

## 7. Risks & Mitigations
- Risk: 工作区已有脏改动导致 guard 误报。
  - Impact: 无法区分本次任务改动与历史改动。
  - Mitigation: 支持 `--paths` 输入本次变更集做 scoped 校验。
- Risk: 白名单过宽或过窄。
  - Impact: 可能放过旁路改动或误伤合法改动。
  - Mitigation: 白名单规则写入 SSOT，并通过测试覆盖典型路径。

## 8. Open Questions
None.

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `CLAUDE.md`
  - `docs/ssot/execution_governance_ultrawork_doit.md`
- Notes:
  - 本迭代新增执行治理补充，不改 runtime 语义宪法。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `docs/charters/dongyu_app_next_runtime.md`
- Notes:
  - 遵守“模型优先、解释器边界稳定”的约束，且通过显式门禁强化执行纪律。
