# 0147 — Fill-Table-Only 自动门禁（pre-commit + 模式开关）

## 0. Metadata
- ID: 0147-fill-table-only-auto-gate
- Date: 2026-02-14
- Owner: AI (User Request)
- Branch: dev_0147-fill-table-only-auto-gate
- Related:
  - `docs/ssot/fill_table_only_mode.md`
  - `scripts/validate_fill_table_only_mode.mjs`
  - `CLAUDE.md` (`fill-table-first`)

## 1. Goal
让 Fill-Table-Only 在本地提交流程自动生效：开启模式后，`git commit` 会自动执行强制门禁，无需每次手动带 guard 命令。

## 2. Background
0146 已提供手动 guard，但用户仍需显式运行命令，执行成本高且容易漏。当前仓库没有有效 `pre-commit` hook 管道，也没有“会话级开关”用于让 skill/脚本自动切换模式。

## 3. Invariants (Must Not Change)
- 不修改 runtime 解释器代码。
- 默认行为保持非阻断：未开启 Fill-Table-Only 时，提交流程不受影响。
- 只校验 staged 变更，避免被工作区历史脏改动误伤。
- 失败信息必须保留 `required_action=write_runtime_capability_gap_report`。

## 4. Scope
### 4.1 In Scope
- 增加仓库内 `.githooks/pre-commit` 强制门禁。
- 增加本地 hook 安装脚本（设置 `core.hooksPath=.githooks`）。
- 增加 Fill-Table-Only 模式开关脚本（on/off/status/check），供 skill 或人工触发。
- 更新 SSOT 与测试。

### 4.2 Out of Scope
- 改造远端 CI 平台。
- 自动生成 capability gap 报告内容。
- 变更业务功能。

## 5. Non-goals
- 不尝试全自动识别“当前任务是否应开启 Fill-Table-Only”。
- 不修改历史迭代行为。

## 6. Success Criteria (Definition of Done)
- `scripts/fill_table_only_mode_ctl.mjs on` 后，`pre-commit` 自动运行 guard。
- `off` 后，`pre-commit` 不阻断普通提交。
- `pre-commit` 只检查 staged 文件。
- 新增自动化测试全 PASS。
- 文档明确如何给 skill 接入：进入任务时 `on`，结束时 `off`。

## 7. Risks & Mitigations
- Risk: hook 未安装导致“以为生效实际未生效”。
  - Mitigation: 提供 `install_git_hooks.sh` + status 提示。
- Risk: staged 列表为空时误判。
  - Mitigation: pre-commit 空提交场景直接 PASS。
- Risk: white list 对治理文件限制过严。
  - Mitigation: 补充 `.githooks/**` 与模式开关脚本路径到允许列表。

## 8. Open Questions
None.

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `docs/ssot/fill_table_only_mode.md`
  - `docs/ssot/execution_governance_ultrawork_doit.md`
- Notes:
  - 本迭代为执行治理增强，不变更 runtime semantics。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `docs/charters/dongyu_app_next_runtime.md`
- Notes:
  - 强化 fill-table-first 的执行纪律，避免 runtime 旁路。
