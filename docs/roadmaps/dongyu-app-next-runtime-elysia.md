# Roadmap: dongyu-app-next-runtime-elysia

## 0. Metadata
- Roadmap ID: dongyu-app-next-runtime-elysia
- Date: 2026-01-27
- Owner: (TBD)
- Goal (system-level): 完成“新版洞宇 APP”的整体重写：以 Bun/Elysia 为软件工人基座，完整复刻并对齐 PICtest 的可观测行为（程序模型内建 k、PIN_IN/OUT 等），并在此基础上逐步构建由 ModelTable 驱动的 UI AST 与滑动 UI 体系，最终替代旧的 Python/NiceGUI 实现。

## 1. Global Constraints (SSOT / Charter / User)
- SSOT: `docs/architecture_mantanet_and_workers.md`
- Charter: `docs/charters/dongyu_app_next_runtime.md`
- 行为真值源：`vendor/PICtest`（所有 built-in k / trigger / pin 必须先做证据提取与对照测试计划）
- ModelTable（p/r/c/k/t/v）是唯一事实与显示数据源
- UI 事件只能表现为“写单元格”，不得直接产生副作用
- 第一阶段仅控制总线（MQTT + PIN_IN/OUT），不引入 Matrix/双总线

## 1.1 Program Model Registration/Loading Evidence
- 证据与理解记录：
  - [PICtest PIN_IN/PIN_OUT 与程序模型触发机制（理解记录）](../concepts/pictest_pin_and_program_model.md)
  - [V1N / PICtest 软件工人基座：概念与实现理解](../v1n_concept_and_implement.md)
- 本路线图涉及的“程序模型注册/加载过程”必须以以上证据文档为准。

## 1.2 Final Test Case (Program Model + PIN)
- 最终测试用例（程序模型加载、PIN_IN 与触发链路）：
  - [test_files/test7/main.py](../../test_files/test7/main.py)
  - [test_files/test7/yhl.db](../../test_files/test7/yhl.db)

## 2. Mandatory Early Iterations (Hard Gate)
- Iteration-1: PICtest Evidence Extraction（行为证据提取）
- Iteration-2: Oracle Test Harness Plan（对照验证方案）
> 在 Iteration-1 与 Iteration-2 完成并 PASS 之前，不允许进入任何运行时代码实现。

## 3. Roadmap Summary (Linear)

| Order | Iteration ID | Domain | Dependency | Goal (1 sentence) | Explicit Non-Goals |
|------:|--------------|--------|------------|-------------------|--------------------|
| 1 | 0122-pictest-evidence | evidence | None | 提取 PICtest 中 built-in k / trigger / PIN 的可观测证据表与引用路径 | 不实现运行时代码；不引入 Matrix/Element Call/E2EE/打包 |
| 2 | 0122-oracle-harness-plan | harness | 0122-pictest-evidence | 制定 JS 对齐 PICtest 的对照测试计划与验收标准 | 不实现运行时代码 |
| 3 | 0123-modeltable-runtime-v0 | worker-base | 0122-oracle-harness-plan | 实现 ModelTable runtime v0（p/r/c/k/t/v + event log） | 不引入 UI/双总线 |
| 4 | 0123-builtins-v0-impl | worker-base | 0123-modeltable-runtime-v0 | 实现 built-in k v0（严格基于证据）并提供脚本验收 | 不发明语义 |
| 5 | 0123-pin-mqtt-loop | worker-base | 0123-builtins-v0-impl | 实现控制总线闭环（PIN_IN/OUT + MQTT mock）并提供脚本验收 | 不引入 Matrix/双总线 |
| 6 | 0127-program-model-loader-v0 | worker-base | 0123-modeltable-runtime-v0 | 从 sqlite yhl.db 回放 mt_data，重建 ModelTable，并提供 test7 入口脚本 | 不执行/解析 Python main.py |
| 7 | 0128-function-exec-v0 (proposed) | worker-base | 0127-program-model-loader-v0 | 实现 Function.handle_call/run + pin_callin/out 的最小闭环（Level A）并脚本验收 | 不做 Flow/Task 全量系统 |
| 8 | 0128-test7-e2e-workerbase (proposed) | worker-base | 0128-function-exec-v0 | 将 test7 变成唯一 E2E gate：load db → pin_in → trigger → pin_out（脚本验收） | 不引入 UI/双总线 |
| 9 | 0128-workerbase-aggregate-validate (proposed) | worker-base | 0128-test7-e2e-workerbase | 提供一键聚合验收脚本（builtins + mqtt loop + loader + test7 e2e） | 不引入重构/新架构 |

## 4. Notes
- 上述 Iteration ID 中标注 (proposed) 的为建议，可在 Phase1 Review Gate 微调，但必须保持顺序与依赖关系。
- “JS 软件工人完成并通过测试”以 Phase 2 Completion Criteria 为准（见 `docs/roadmap/dongyu_app_next_runtime.md`）。
- 任何与 PICtest 行为不一致的设计结论必须先回到 Evidence Extraction 追加证据。
- 最终验收样例以 `test_files/test7` 为准，不得替换为其他样例。
