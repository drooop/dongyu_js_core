# Iteration 0128-ui-line-demo-frontend Plan

## 0. Metadata
- ID: 0128-ui-line-demo-frontend
- Date: 2026-01-27
- Owner: OpenCode (autonomous)
- Branch: dev_0128-ui-line-demo-frontend
- Related:
  - docs/ssot/execution_governance_ultrawork_doit.md
  - docs/architecture_mantanet_and_workers.md
  - docs/ssot/runtime_semantics_modeltable_driven.md
  - docs/charters/dongyu_app_next_runtime.md
  - docs/roadmap/dongyu_app_next_runtime.md
  - docs/iterations/0123-ui-ast-spec/spec.md
  - docs/iterations/0123-ui-renderer-impl/plan.md
  - scripts/validate_ui_renderer_v0.mjs
  - packages/ui-renderer/src/renderer.js

## 1. Goal
在不引入双总线（Stage 4+）的前提下，交付一个可运行的“UI 模型驱动”的洞宇 APP demo 前端（Stage 3.3），并加固 Stage 3.1/3.2 的规范与验证，使其足以支持后续 UI 模型扩展。

## 2. Background
Stage 3.1/3.2 已完成最小 UI AST + renderer，但当前仓库缺少可运行前端工程，且验证脚本曾允许 jsdom 缺失时 fallback 到 stub，存在“假阳性”风险。本迭代将把该风险收敛为“jsdom 缺失即 FAIL”。用户要求在 Stage 3.1/3.2 的基础上，新增 Stage 3.3：用 UI 模型的展示能力构建洞宇 APP demo 前端，并在缺组件时扩 UI AST 与 Element Plus renderer 映射，认为 UI 模型部分（不含双总线通讯）OK。

## 3. Invariants (Must Not Change)
- 不修改 SSOT：docs/architecture_mantanet_and_workers.md。
- 不修改运行时语义宪法：docs/ssot/runtime_semantics_modeltable_driven.md。
- 不修改 Project Charter：docs/charters/dongyu_app_next_runtime.md。
- 禁止 Stage 4+（Matrix/MBR/双总线/Element Call/E2EE/打包）。
- UI 不具备执行权：UI 只读 ModelTable；UI 事件只写 Cell（以 add_label/rm_label 写入 `t="event"` 的 event label）。
- ModelTable 是唯一真值源：UI demo 的显示必须由 ModelTable 驱动（包括 UI AST 本身）。
- UI AST 不包含可执行内容（函数/表达式/script）。
- 已 Completed 的 Stage（3.1/3.2）状态不可回退；只能追加 Notes/Follow-ups 指向本迭代新证据。

## 4. Scope
### 4.1 In Scope
- Stage 3.1/3.2 复验（审计）：
  - 复核 UI AST v0 spec 与 renderer v0 contract 的合规性（只新增证据与修补，不回写/改写已完成 iteration 的规范性条款）。
  - 加固 `scripts/validate_ui_renderer_v0.mjs`：当 `--env jsdom` 且 jsdom 缺失时直接 FAIL，禁止 fallback 到 stub 继续 PASS。
  - 为 Stage 3.3 用到的新增 AST node/type 增加回归用例（脚本化 PASS/FAIL）。
- Stage 3.3 实现：
  - 新增可运行 demo 前端工程（local-only），使用 Vue3 + Element Plus，渲染 UI AST。
  - UI 模型入口约定（用户确认）：
    - UI AST 存放在主模型 `model_id=0` 的 `Cell(0,0,0)`：label `k="ui_ast_v0"`, `t="json"`, `v=<AST JSON>`。
  - UI AST v0.1 扩展（demo-only）
    - 本迭代新增一份扩展规范文档（不回写 0123 的 v0 spec），新增 node/type 限定为：
      - `Card`（容器，props.title 可选，children 可嵌套）
      - `CodeBlock`（只读展示，props.text 或 bind.read）
    - v0 最小节点集（Root/Container/Text/Input/Button）必须继续可用且用例持续 PASS。
  - Stage 3.3 最小可验证样例（必须作为合同的一部分）：
    - AST 存储形状：`t="json"` 且 `v` 为 **JSON 对象**（AST object），不是字符串。
    - event mailbox 固定坐标：`Cell(0,0,1)`，所有 demo UI 事件写入 label `k="ui_event"`, `t="event"`。
    - demo AST 至少包含：1 个 Text(bind.read)、1 个 Input(bind.read+bind.write)、1 个 Button(bind.write)。
    - demo AST 的 `bind.write` 必须包含 `event_type`（与 UI AST v0 事件规范一致）。
    - demo 依赖/接入方式：
      - Node 验证脚本使用 `packages/ui-renderer/src/index.js`（CJS）。
      - Vite demo 使用 `packages/ui-renderer/src/index.mjs`（ESM）。
      - 不要求将 ui-renderer 改造成可发布 package。
    - ModelTable 变化触发重渲染：demo 使用 Vue reactive store；host.dispatchAddLabel/rmLabel 更新 store 后，渲染组件重新计算 VNode。
    - demo ModelTable snapshot 结构以 `scripts/validate_ui_renderer_v0.mjs` 的 `buildSnapshot()` 形状为基准（models -> cells -> labels）。
  - 新增 UI AST v0.1 扩展（仅用于 demo）：在本迭代文档中定义新增 node/type/props/bind 规则，并在 `packages/ui-renderer/src/renderer.js` 映射到 Element Plus/HTML。
  - Demo 中所有交互必须只写 `t="event"` 的 event label（写入 event mailbox cell），不得直接写业务态 label。

### 4.2 Out of Scope
- Stage 2.5/2.6（函数执行引擎 / test7 E2E）不在本迭代范围。
- Stage 4+（双总线与分布式）。
- 任何 UI 直接发总线消息或直接执行程序模型。

## 5. Non-goals
- 不追求完整洞宇 APP 信息架构；只做 demo 前端的“UI 模型驱动”能力验证。
- 不做生产级样式/动效与设计系统。
- 不引入新的运行时 built-in 语义。

## 6. Success Criteria (Definition of Done)
- UI renderer 验证脚本在 jsdom 模式下全量 PASS，且脚本自身确保不会以 stub 方式通过（输出 env=jsdom）。
- demo 前端工程可构建（build script 退出码为 0）。
- demo 前端验证脚本（包内）PASS：证明 UI AST 从 ModelTable 的 `Cell(0,0,0).ui_ast_v0` 读取，且 UI 交互只写入 event mailbox `Cell(0,0,1).ui_event`。
- Roadmap 更新（仅推进 Stage 3.3）：
  - `docs/roadmap/dongyu_app_next_runtime.md` 中 Stage 3.3 标记 Completed 并指向本迭代。
  - Stage 3.1/3.2 仅追加 Notes 指向本迭代新证据，不改既有 Completed。

## 7. Risks & Mitigations
- Risk: 现有验证脚本在 jsdom 缺失时 fallback 导致假阳性。
  - Impact: Stage 3.2/3.3 回归不可置信。
  - Mitigation: 强制 `--env jsdom` 缺失即 FAIL；将 env 输出纳入 DoD。
- Risk: UI AST 扩展导致 renderer 复杂度上升且缺乏回归。
  - Impact: demo 可跑但后续扩展易回归。
  - Mitigation: 每新增 node/type 都必须新增 validate case。
- Risk: demo 误触 worker-base built-in k 语义。
  - Impact: 产生非预期副作用。
  - Mitigation: demo 专用 label.k 命名空间（例如 `ui_*` / `demo_*`），避免 `run_*` / `*_CONNECT` 等。

## 8. Open Questions
None.

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - docs/architecture_mantanet_and_workers.md
  - docs/ssot/runtime_semantics_modeltable_driven.md
- Notes:
  - UI 仅作为投影与事件入口；ModelTable 为真值源；不引入双总线。

### 9.2 Charter Compliance Checklist
- Charter references:
  - docs/charters/dongyu_app_next_runtime.md
- Notes:
  - UI 不执行逻辑、事件写 Cell；不引入 Matrix/Element Call/E2EE。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
