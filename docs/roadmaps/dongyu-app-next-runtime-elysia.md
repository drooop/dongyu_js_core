# Roadmap: dongyu-app-next-runtime-elysia

## 0. Metadata
- Roadmap ID: dongyu-app-next-runtime-elysia
- Date: 2026-01-22
- Owner: (TBD)
- Goal (system-level): 完成“新版洞宇 APP”的整体重写：以 Bun/Elysia 为软件工人基座，完整复刻并对齐 PICtest 的可观测行为（程序模型内建 k、PIN_IN/OUT 等），并在此基础上逐步构建由 ModelTable 驱动的 UI AST 与滑动 UI 体系，最终替代旧的 Python/NiceGUI 实现。

## 1. Global Constraints (SSOT / Charter / User)
- SSOT: `docs/architecture_mantanet_and_workers.md`
- Charter: `docs/charters/dongyu_app_next_runtime.md`
- 行为真值源：`vendor/PICtest`（所有 built-in k / trigger / pin 必须先做证据提取与对照测试计划）
- ModelTable（p/r/c/k/t/v）是唯一事实与显示数据源
- UI 事件只能表现为“写单元格”，不得直接产生副作用
- 第一阶段仅控制总线（MQTT + PIN_IN/OUT），不引入 Matrix/双总线

## 2. Mandatory Early Iterations (Hard Gate)
- Iteration-1: PICtest Evidence Extraction（行为证据提取）
- Iteration-2: Oracle Test Harness Plan（对照验证方案）
> 在 Iteration-1 与 Iteration-2 完成并 PASS 之前，不允许进入任何运行时代码实现。

## 3. Roadmap Summary (Linear)

| Order | Iteration ID | Domain | Dependency | Goal (1 sentence) | Explicit Non-Goals |
|------:|--------------|--------|------------|-------------------|--------------------|
| 1 | 0122-pictest-evidence | modeltable / built-in capability | None | 提取 PICtest 中与 built-in k / trigger / PIN 行为相关的可观测证据表与引用路径（文档与证据整理） | 不实现任何运行时代码；不做 UI AST/Renderer；不引入 Matrix/Element Call/E2EE/打包 |
| 2 | 0122-oracle-harness-plan | modeltable / built-in capability | 0122-pictest-evidence | 制定 JS 与 PICtest 行为对齐的对照测试计划、脚本入口与验收标准 | 不实现运行时代码；不引入 Matrix/Element Call/E2EE/打包 |
| 3 | 0122-oracle-harness-impl | packaging / platform | 0122-oracle-harness-plan | 生成最小可执行对照测试骨架与脚本框架（仅测试基础设施） | 不实现 built-in 行为；不实现 UI AST/Renderer；不引入 Matrix/Element Call/E2EE/打包 |
| 4 | 0122-workerbase-modeltable-core | worker-base | 0122-oracle-harness-impl | 建立 ModelTable runtime 最小核心（数据结构/加载/变更通道）以支持后续行为对齐 | 不实现 UI AST/Renderer；不引入 Matrix/Element Call/E2EE/打包 |
| 5 | 0122-workerbase-builtins-value | modeltable / built-in capability | 0122-workerbase-modeltable-core | 对齐 PICtest: built-in `k:"value"` 的可观测行为并纳入对照测试 | 不实现 UI AST/Renderer；不引入 Matrix/Element Call/E2EE/打包 |
| 6 | 0122-workerbase-pin-mqtt | bus (MQTT) | 0122-workerbase-builtins-value | 对齐 PIN_IN/OUT + MQTT 行为闭环（仅控制总线） | 不引入 Matrix/双总线；不做 Element Call/E2EE/打包 |
| 7 | 0122-trigger-model-basic | modeltable / built-in capability | 0122-workerbase-pin-mqtt | 对齐基础 trigger 机制（以 PICtest 证据表为准）并纳入对照测试 | 不实现 UI AST/Renderer；不引入 Matrix/Element Call/E2EE/打包 |
| 8 | 0122-ui-ast-spec | sliding-ui / UI AST | 0122-trigger-model-basic | 定义 UI AST 规范与 ModelTable 映射规则（文档 + schema） | 不实现具体 renderer；不引入 Matrix/Element Call/E2EE/打包 |
| 9 | 0122-ui-renderer-vue3 | sliding-ui / UI AST | 0122-ui-ast-spec | 实现 Vue3 + Element Plus renderer（事件写 Cell） | 不引入 Matrix/Element Call/E2EE/打包 |
| 10 | 0122-app-shell-integration | app-shell | 0122-ui-renderer-vue3 | 将 Sliding UI 渲染与 Worker Base 连接到 App Shell 的最小集成 | 不做桌面/移动端打包；不引入 Matrix/Element Call/E2EE |

## 4. Notes
- 上述 Iteration ID 为建议，可在 Phase1 Review Gate 微调，但必须保持顺序与依赖关系。
- 任何与 PICtest 行为不一致的设计结论必须先回到 Evidence Extraction 追加证据。
