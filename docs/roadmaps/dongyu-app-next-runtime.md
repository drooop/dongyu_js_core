# Roadmap: dongyu-app-next-runtime

> 本文档是“新版洞宇 APP 重写”的**唯一执行路线图**。  
> 上位约束：`docs/architecture_mantanet_and_workers.md`、`docs/charters/dongyu_app_next_runtime.md`。

## 1. 目标与边界

### 1.1 系统目标
- 用 Bun/Elysia 重建 Software Worker Base。
- 以 ModelTable（`p/r/c/k/t/v`）作为唯一真值。
- 行为语义以 PICtest 可观测行为为对照基准。
- 逐步完成 UI AST、Sliding UI、控制总线闭环。

### 1.2 不可突破边界
- 不得发明 PICtest 之外的运行时语义。
- UI 只能写 Cell（event mailbox），不得直接触发总线副作用。
- 第一阶段只做控制总线（MQTT + PIN_IN/OUT）；双总线按后续阶段引入。

### 1.3 证据与最终测试样例
- 程序模型证据：
  - `docs/concepts/pictest_pin_and_program_model.md`
  - `docs/v1n_concept_and_implement.md`
- 最终样例：
  - `test_files/test7/main.py`
  - `test_files/test7/yhl.db`

## 2. 当前状态（截至 2026-02）

- 已完成主线：证据提取、运行时 v0、built-ins v0、PIN/MQTT loop、UI AST 规范、renderer、program model loader、editor v0/v1、component gallery v0。
- 待推进主线：函数执行语义闭环（Function.handle_call/run）、test7 级 E2E 聚合验收、Stage 4 双总线从合同到产品化接入。

## 3. 阶段总览

| Phase | 主题 | 状态 | 关键产出 |
|------|------|------|---------|
| Phase 0 | 治理与约束 | Completed | SSOT/Charter/Workflow 固化 |
| Phase 1 | PICtest 证据与 Harness 规划 | Completed | 0122-pictest-evidence / 0122-oracle-harness-plan |
| Phase 2 | JS Worker Base 最小闭环（无 UI 权限） | In Progress | runtime/built-ins/pin/loader 已完成，function exec 与 test7 E2E 待收口 |
| Phase 3 | UI AST + Sliding UI（写格子模型） | In Progress | AST 规范、renderer、editor、gallery 已完成，server-truth 与远端链路持续收敛 |
| Phase 4 | 双总线（MgmtBus ↔ MBR ↔ ControlBus） | Planned | 0132 合同与 harness 已有，产品化接入待执行 |

## 4. 已完成里程碑（线性）

| Order | Iteration | 结果 |
|------:|-----------|------|
| 1 | 0122-pictest-evidence | PICtest 行为证据表 |
| 2 | 0122-oracle-harness-plan | 对照测试计划 |
| 3 | 0123-modeltable-runtime-v0 | ModelTable runtime v0 |
| 4 | 0123-builtins-v0-impl | built-ins 语义与脚本验收 |
| 5 | 0123-pin-mqtt-loop | PIN_IN/OUT + MQTT loop |
| 6 | 0123-ui-ast-spec | UI AST v0 合同 |
| 7 | 0123-ui-renderer-impl | renderer 映射与脚本验收 |
| 8 | 0127-program-model-loader-v0 | sqlite 回放重建 runtime |
| 9 | 0128-ui-line-demo-frontend | UI model demo 前端链路 |
| 10 | 0129-modeltable-editor-v0 | mailbox 合同冻结 |
| 11 | 0130-modeltable-editor-v1 | typed value 规范化 |
| 12 | 0133-ui-component-gallery-v0 | 组件覆盖与 UI AST 扩展 |

## 5. 下一步执行队列（建议）

| Priority | Proposed Iteration | 目标 |
|---------:|--------------------|------|
| P0 | function-exec-v0 | 补齐 `Function.handle_call` / `Function.run` 的 PICtest 对齐行为 |
| P0 | test7-e2e-workerbase | 固化 `test_files/test7` 一键 E2E gate |
| P1 | workerbase-aggregate-validate | 聚合脚本：built-ins + pin loop + loader + test7 |
| P1 | dual-bus-productization-v0 | 将 0132 合同/harness 接入真实运行链路（仍遵守 UI 只写格子） |

## 6. 阶段验收标准

### 6.1 Worker Base v0 完成标准
- `node scripts/validate_builtins_v0.mjs` PASS
- `node scripts/validate_pin_mqtt_loop.mjs --case all` PASS
- `bun scripts/validate_program_model_loader_v0.mjs --case all --db test_files/test7/yhl.db` PASS
- `test7` E2E 聚合脚本 PASS（新增后纳入）

### 6.2 双总线推进标准
- 先合同、后实现：以 `docs/iterations/0132-dual-bus-contract-harness-v0/contract_dual_bus_v0.md` 为准。
- 必须具备可脚本验收与 `op_id` 可审计链路。

## 7. 维护规则

- 本文档用于“当前状态 + 下一步”管理，不替代 SSOT/Charter。
- 每次迭代状态变化后，必须同步更新本文件与 `docs/ITERATIONS.md`。
- 历史执行细节与证据只写入对应 iteration 的 `runlog.md`。
