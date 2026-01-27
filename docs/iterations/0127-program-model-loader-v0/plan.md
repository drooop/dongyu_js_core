# Iteration 0127-program-model-loader-v0 Plan

## 0. Metadata
- ID: 0127-program-model-loader-v0
- Date: 2026-01-27
- Owner: Sisyphus (OpenCode)
- Branch: dev_0127-program-model-loader-v0
- Related: docs/roadmap/dongyu_app_next_runtime.md, docs/roadmaps/dongyu-app-next-runtime-elysia.md, docs/concepts/pictest_pin_and_program_model.md, docs/v1n_concept_and_implement.md, docs/ssot/runtime_semantics_modeltable_driven.md, docs/ssot/modeltable_runtime_v0.md, docs/iterations/0122-pictest-evidence/evidence.md, docs/iterations/0123-builtins-v0/ledger.md, test_files/test7/main.py, test_files/test7/yhl.db

## 1. Goal
实现 JS worker-base 的“程序模型加载/注册”v0：能够基于 test_files/test7/yhl.db 重建 ModelTableRuntime，并按 PICtest 证据对齐触发与连接的最小语义。

## 2. Background
现有 JS runtime 已覆盖 built-in k 与 PIN/MQTT 的最小闭环，但缺少“程序模型加载/注册”的入口与流程。根据统一后的 concepts 与证据，需要补齐 loader 流程，以 test7 作为最终测试用例，避免后续实现偏离 PICtest 行为。

## 3. Invariants (Must Not Change)
- 不修改 SSOT：`docs/architecture_mantanet_and_workers.md`。
- 不违反 Charter：`docs/charters/dongyu_app_next_runtime.md`。
- ModelTable 字段固定 `p/r/c/k/t/v`，不得扩展或绕开。
- 运行时副作用只能由 `add_label` / `rm_label` 触发，初始化与运行期解释规则一致。
- 仅控制总线（MQTT + PIN_IN/OUT），不引入 Matrix/双总线/Element Call/E2EE。
- UI 不具备执行权；不新增 UI 侧直接发总线的路径。
- test_files/test7 作为只读测试输入，不修改其内容。

## 4. Scope
### 4.1 In Scope
- 新增 Program Model Loader v0：从 `test_files/test7/yhl.db` 读取 `mt_data` 并重建 `ModelTableRuntime`（Model/Cell/Label）。
- Loader 回放必须通过 `add_label` / `rm_label` 驱动结构性声明副作用，不新增旁路注册/触发路径。
- Loader 回放顺序固定：以 `(mt_id, p, r, c, k, t)` 作为稳定排序键；若存在 rowid/索引列则追加为末级稳定键。
- label.v 解析规则固定：若 v 为 JSON 字符串则解析为 JSON；否则保持原始字符串值（不记 error）。
- `FunctionLabel` 识别规则固定：仅当 label.t 明确匹配 `function` 时注册函数名；若 DB 中不存在 FunctionLabel，则不自动注册。
- `run_<func>` 触发遵守证据前置条件（如执行循环未启动则不触发），但不通过 loader 旁路抑制。
- 验证脚本包含合成负例（非法 label / 未注册函数），不依赖 DB 自带非法数据。
- 提供最小 JS 函数注册样例（仅用于 test7 的 run_<func> 验证，不解析/执行 Python）。
- 维持现有 PIN/CONNECT/built-in 语义：通过 `add_label` 回放触发副作用（只在证据覆盖范围内）。
- 新增验证脚本（scripts）：以 `test_files/test7/yhl.db` 为输入，验证加载/触发/连接的最小可观测行为。

### 4.2 Out of Scope
- 执行或解析 Python `main.py`（不加载 Python 代码）。
- 完整函数执行引擎、Flow/Task 调度、UI 渲染集成。
- Matrix/MBR/Element Call/E2EE/打包相关实现。
- 对 SQLite DB 进行写回或迁移。

## 5. Non-goals
- 不追求与 PICtest 完整 UI/Studio 对齐。
- 不引入新的外部服务或网络 MQTT 依赖（保持 mock/本地）。
- 不扩展 built-in k 清单（仅使用现有证据与已实现路径）。

## 6. Success Criteria (Definition of Done)
- `scripts/validate_program_model_loader_v0.mjs` 可读取 `test_files/test7/yhl.db` 并重建 ModelTableRuntime，输出快照中包含主模型且 label 数量 > 0。
- 加载过程遵守 `modeltable_runtime_v0` 校验与确定性要求：非法 label 产生 error 事件，事件序列可审计且顺序确定。
- `run_<func>` 行为遵守证据前置条件；已注册函数触发 intercept，未注册函数产生 error 事件，且无 silent fail。
- CONNECT allow-list（CELL/MODEL/V1N）仅产生证据内副作用；DE/DAM/PIC/WORKSPACE 不产生额外副作用。
- 验证脚本包含合成负例并具备明确 PASS/FAIL 判定字段。
- 未修改 SSOT/Charter/test_files 内容；验证脚本返回码为 0。

## 7. Risks & Mitigations
- Risk: SQLite 读取能力与运行时环境差异（Bun/Node）。
  - Impact: Loader 无法在目标环境执行。
  - Mitigation: 明确使用 Bun 内建 sqlite（bun:sqlite），并在验证脚本中显式检查并报错。
- Risk: 验证工具缺失（bun/git/rg/test）。
  - Impact: 验收命令不可执行。
  - Mitigation: 在 Phase3 前确认工具可用；脚本启动时输出依赖缺失错误。
- Risk: `FunctionLabel` 在 DB 中的 `label.t`/结构未明确。
  - Impact: 无法正确注册函数或误触发。
  - Mitigation: 以 PICtest 证据与 test7 DB 实际字段为准，必要时补充证据表。
- Risk: 回放顺序与事件序列不确定。
  - Impact: 与 `modeltable_runtime_v0` 的确定性要求不一致。
  - Mitigation: 明确以 `(mt_id, p, r, c, k, t, rowid)` 为唯一回放顺序，验证 event_id 单调与快照一致性。

## 8. Open Questions
- `FunctionLabel` 在 test7 DB 中的实际分布（若缺失，是否需要补充额外证据或样例 DB）？

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/modeltable_runtime_v0.md`
- Notes:
  - 仅实现结构性声明的解释与加载回放，不引入 UI/双总线。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `docs/charters/dongyu_app_next_runtime.md`（3.2/3.3/3.4/6.1/7.1/7.2/9）
- Notes:
  - 仅控制总线范围；built-in 语义以 PICtest 证据为准；不引入 Matrix/Element Call。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
