# 工作周报（0122-0133）

周期：以 `docs/ITERATIONS.md` 中 0122..0133 的日期范围为准（2026-01-22 ~ 2026-01-31）。

本周叙述采用“逐步实现过程”写法：先固化真值源与契约，再落地最小可验证闭环，最后才做扩展。

## 1. 总体思路（本周主线）

1) 先证据、后语义：以 PICtest 的可观测行为为第一真值源，先产出证据表与对照测试框架，避免运行时语义“拍脑袋”。
2) 先契约、后实现：把 ModelTable / UI AST / mailbox / 总线等关键边界写成可裁决的合同，再写实现和脚本验收。
3) 先可验证闭环、后扩展：每一步都落到可脚本化 PASS/FAIL，而不是只靠页面手点。

## 2. 逐步实现历程（按迭代推进）

### 0122：证据与 Harness 计划
- 目标：提取 PICtest built-in k / trigger / PIN 的可观测证据，并形成对照测试计划（inventory/matrix/assertion rules）。
- 产出（证据/计划）：
  - `docs/iterations/0122-pictest-evidence/evidence.md`
  - `docs/iterations/0122-oracle-harness-plan/harness_plan.md`

### 0123：最小运行时语义闭环（Runtime + Builtins + PIN MQTT + UI AST/Renderer）

1) ModelTable runtime v0：先把数据结构、确定性更新、EventLog/Persistence 契约写清。
  - `docs/iterations/0123-modeltable-runtime-v0/plan.md`
  - `docs/iterations/0123-modeltable-runtime-v0/runlog.md`

2) Builtins v0：严格以 Concrete Key Inventory 的“实际 key 列表”逐条组织（不按抽象模块），产出 ledger + validation protocol。
  - `docs/iterations/0123-builtins-v0/plan.md`
  - `docs/iterations/0123-builtins-v0/runlog.md`

3) Builtins v0 实现：只实现 MVP keys，并按脚本逐条 PASS。
  - `docs/iterations/0123-builtins-v0-impl/runlog.md`

4) 控制总线闭环：PIN_IN/OUT + MQTT loop（配置真值在 ModelTable page0；失败语义写回 ModelTable）。
  - `docs/iterations/0123-pin-mqtt-loop/plan.md`
  - `docs/iterations/0123-pin-mqtt-loop/runlog.md`

5) UI AST spec + renderer：UI 是投影；事件只能写 event label（mailbox）；renderer 只通过 host adapter 读 snapshot/写 event。
  - `docs/iterations/0123-ui-ast-spec/spec.md`
  - `docs/iterations/0123-ui-renderer-impl/runlog.md`

### 0127：先重建状态，再谈执行
- 目标：从 sqlite yhl.db 回放 mt_data，确定性重建 ModelTable（固定 replay_order 与解析规则），为后续触发/执行提供可复现起点。
- `docs/iterations/0127-program-model-loader-v0/runlog.md`

### 0128：UI demo frontend（把“滑动 UI 闭环”跑通）
- 目标：做 UI model demo frontend，使 UI AST + renderer 的渲染/事件路径可被脚本验证（避免仅 GUI 手测）。
- `docs/iterations/0128-ui-line-demo-frontend/runlog.md`

### 0129-0130：ModelTable editor（mailbox contract + typed values）
- 0129：冻结 mailbox contract（single-slot、op_id、error priority、reserved/forbidden），保证可审计可回归。
  - `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`
- 0130：在不破坏 0129 contract 的前提下，新增 typed value normalization（附加契约）。
  - `docs/iterations/0130-modeltable-editor-v1/contract_typed_values.md`

### 0131-0133：进入下一阶段准备（本周不展开细节）
- 0131/0132/0133 的详细内容与证据见 `sources/iterations/` 对应目录；周报对外版本此处不展开。

## 3. 当前架构落点（此刻系统形态）

### 3.1 基座（Worker Base / Software Worker）
- 真值：ModelTableRuntime（ModelTable / Cell / Label）
- 触发入口：运行时副作用只允许由 `add_label` / `rm_label` 触发（初始化回放与运行期一致）

### 3.2 前端（Sliding UI / Renderer）
- UI = 投影：从 `ui_ast_v0` 渲染（Vue3 + Element Plus）
- UI 事件 = 写格子：UI 事件归一化为 event envelope，写入 event mailbox（single-slot），由 consumer 消费后更新 ModelTable

### 3.3 UI AST / UI 模型
- UI AST：JSON 组件树规范（禁止可执行内容），bind 只允许 LabelRef/EventTarget
- UI 模型：由 ModelTable labels 表达，renderer 解释渲染

### 3.4 程序模型 / 流程模型
- 程序模型：具备 sqlite 回放重建（loader v0）基础，作为后续执行/触发的前置条件
- 流程模型：暂缺（本周未形成可验收闭环）

### 3.5 总线（控制总线 / 管理总线 / 双总线）
- 控制总线：MQTT + PIN_IN/OUT 闭环已具备脚本验收路径（以 ModelTable-driven 语义触发）
- 双总线（Mgmt/MBR/Control）：以 v0 contract/harness 的方式推进，强调 UI 只写 mailbox、op_id 去重、系统负数模型承载 MGMT 声明（详见 0132 contract 文档）
