# Iteration 0129-modeltable-editor-v0 Plan

## 0. Metadata
- ID: 0129-modeltable-editor-v0
- Date: 2026-01-27
- Owner: OpenCode (autonomous)
- Branch: dev_0129-modeltable-editor-v0
- Related:
  - docs/WORKFLOW.md
  - docs/ITERATIONS.md
  - docs/architecture_mantanet_and_workers.md
  - docs/ssot/runtime_semantics_modeltable_driven.md
  - docs/charters/dongyu_app_next_runtime.md
  - docs/roadmap/dongyu_app_next_runtime.md
  - docs/iterations/0123-ui-ast-spec/spec.md
  - docs/iterations/0123-ui-renderer-impl/plan.md
  - docs/iterations/0128-ui-line-demo-frontend/plan.md
  - packages/ui-renderer/src/renderer.js
  - packages/worker-base/src/runtime.js

## 1. Goal
在不引入双总线/远端执行的前提下，交付一版“UI 模型驱动”的 ModelTable 编辑界面（Cell CRUD + 子模型创建），严格保持 Sliding UI 机制：UI 只写 event，LocalBusAdapter 消费 event 并更新 ModelTableRuntime，所有真值仍来自 ModelTable。

## 2. Background
- Stage 3.1/3.2 已提供 UI AST v0 与 renderer v0。
- Stage 3.3 已有 demo 前端，但缺少面向 ModelTable 编辑的 UI 与事件闭环。
- 双总线尚未实现，当前需要“本地自滑”且不破坏未来双总线机制一致性。
- 本迭代将把 demo mailbox 从 `model_id=0` 迁移到 `model_id=99`（更新 demo 与验证脚本）。

## 2.1 Phase Boundaries (Workflow)
- Phase 1 仅产出文档与计划：
  - docs/iterations/0129-modeltable-editor-v0/plan.md
  - docs/iterations/0129-modeltable-editor-v0/resolution.md
  - docs/iterations/0129-modeltable-editor-v0/runlog.md (空模板)
  - docs/ITERATIONS.md 登记为 Planned
- Phase1 结束时 `docs/ITERATIONS.md` 状态必须保持 Planned；Phase2 Gate 通过后才改为 Approved。
- Phase 2 Review Gate 通过后才能进入 Phase 3。
- Phase 3 仅在 Phase 2 Review Gate 通过后开始执行。

## 3. Invariants (Must Not Change)
- 不修改 SSOT：docs/architecture_mantanet_and_workers.md。
- 不修改运行时语义宪法：docs/ssot/runtime_semantics_modeltable_driven.md。
- 不修改 Project Charter：docs/charters/dongyu_app_next_runtime.md。
- ModelTable 是唯一真值源；UI 不得持有“真值态”绕开 ModelTable。
- UI 只读 ModelTable；UI 写入仅允许 `k="ui_event"` 且 `t="event"`（mailbox）。
- `ui_event_error` 与 `ui_event_last_op_id` 仅允许 LocalBusAdapter 写入。
- UI AST 不包含可执行内容（函数/表达式/script）。
- 禁止 Stage 4+（Matrix/MBR/双总线/Element Call/E2EE/打包）。
- 禁止引入新 built-in 语义或修改现有 built-in 行为。
- LocalBusAdapter 不得触发任何网络/总线行为（MQTT/Matrix 等）。
- Event mailbox 位置与命名锚定 Stage 3.3 demo 的 key/shape，但为避免运行时保留坐标冲突，将 mailbox 放在 editor 专用 model_id：
  - UI mailbox 专用 model_id=99（editor-only），p=0,r=0,c=1，k="ui_event"。
  - 必须在 demo init 阶段创建 model_id=99（createModel）。
  - submodel_create 禁止使用 id=0/99。
  - 禁止使用 runtime 保留 model_id=0 的保留坐标。
- 禁止编辑或写入可能触发 bus 副作用的 label.k/label.t/保留坐标（见 Contract）。

## 3.1 Data Contract (Cell/Label & Runtime API)
- ModelTable 快照与运行时结构以 `packages/worker-base/src/runtime.js` 为准：
  - Cell 由 (p,r,c) 定位，labels 存放在 cell.labels 中。
  - Label 结构为 `{ k, t, v }`，由 `addLabel(model,p,r,c,label)` 写入。
- ModelTableRuntime API (runtime.js):
  - `createModel({ id, name, type }) -> Model`
  - `createModel` is idempotent (existing id returns existing model)
  - `getModel(id) -> Model`
  - `addLabel(model, p, r, c, { k, t, v }) -> { applied: boolean }`
  - `rmLabel(model, p, r, c, key) -> { applied: boolean }`
- 事件邮箱在快照中示例（JSON 表示，非 Map）：
  - `cells["0,0,1"].labels.ui_event = { k: "ui_event", t: "event", v: { ...envelope } }` (model_id=99)
  - `cells["0,0,1"].labels.ui_event_error = { k: "ui_event_error", t: "json", v: { op_id, code, detail } }` (model_id=99)
  - `cells["0,0,1"].labels.ui_event_last_op_id = { k: "ui_event_last_op_id", t: "str", v: "op_x" }` (model_id=99)
- 运行时保留 Cell（来自 runtime.js）：
  - `_configCell()` -> `model_id=0,p=0,r=0,c=0`
  - `_pinRegistryCell()` -> `model_id=0,p=0,r=0,c=1`
  - `_pinMailboxCell()` -> `model_id=0,p=0,r=1,c=1`
- 本迭代仅允许在 model_id=99 的 `Cell(0,0,1)` 写入 `k="ui_event"` / `k="ui_event_error"` / `k="ui_event_last_op_id"` 且 `t` 为 `event/json/str`。
- `labels` 只是对 `(p,r,c,k,t,v)` 的聚合视图，不新增语义字段。

## 3.2 Event Payload Construction Rules
- 事件 payload 必须由 AST 中的静态字段生成，禁止函数/表达式。
- editor 节点必须提供以下字段（由 renderer 读取并构造 payload）：
  - required: `node.bind.write.action` (string)
  - required: `node.bind.write.target_ref` (LabelRef-like: `{ model_id, p, r, c, k? }`) except `submodel_create`
  - required for `submodel_create`: `node.bind.write.value_ref` with `t="json"`
  - optional: `node.bind.write.value_ref` (`{ t, v }` 或指向 read 结果的 ref)
- `submodel_create` 不要求 `target_ref`；其他 action 必须提供 `target_ref`。
- renderer 生成 payload：
  - `payload.action = node.bind.write.action`
  - `payload.target = node.bind.write.target_ref` (except `submodel_create` where target may be omitted)
  - `payload.value = node.bind.write.value_ref || { t: 'str', v: <input_value> }` (omit for `label_remove` / `cell_clear`)
  - if `label_remove` / `cell_clear` include `payload.value`, LocalBusAdapter ignores it and MUST NOT validate it
  - `payload.meta.op_id = 'op_' + event_id`（由 renderer 生成，确保唯一）
  - event label write location is always mailbox `model_id=99 Cell(0,0,1) k="ui_event" t="event"` regardless of `payload.target`
- 事件 envelope 的唯一规范形状：
  - `{ event_id, type, payload, source, ts }`
  - `op_id` 固定在 `payload.meta.op_id`
- `type = payload.action`
- `source = "ui_renderer"`
- 测试确定性：`event_id` 为从 1 开始的整数计数器；`op_id` 必须等于 `op_${event_id}`；`ts` 在断言/哈希中固定或剔除。
- 若以上字段缺失或不可序列化，renderer 必须拒绝并报错；LocalBusAdapter 仍必须对 mailbox 输入执行 Contract 校验。
- invalid_target 条件以 Contract 为准；缺 value 仅对要求 value 的 action 计入 invalid_target。
- LocalBusAdapter 校验顺序：先校验 `payload.meta.op_id`（缺失/非 string 直接 invalid_target），再进入 priority 规则。
- `unknown_action` 仅在 op_id schema 校验通过后评估。
- priority 内部顺序：`op_id_replay` 先于 `unknown_action`。
- value.t 生成规则（editor UI 最小映射）：
  - TextInput -> `str`
  - NumberInput -> `int`
  - Switch/Toggle -> `bool`
  - JSONEditor/ModelSpec -> `json`
  - 无法解析时：不写入 mailbox（renderer 报错）
- forbidden_t 仅适用于 `label_add` / `label_update`，`submodel_create` 的 `value.t != json` 归类为 invalid_target。

## 3.2.1 Action → Runtime API Mapping (Editor)
- For actions that use `payload.target`: `payload.target.model_id` in `{0,99}` maps to `reserved_cell`.
- `label_add`:
  - require: `target.model_id/p/r/c/k`, `value.{t,v}`
  - `value.t` must be in allowlist (`str|int|bool|json`)
  - runtime: `addLabel(model, p, r, c, { k, t, v })`
- `label_update`:
  - same as `label_add`（覆盖写入）
- `label_remove`:
  - require: `target.model_id/p/r/c/k`
  - runtime: `rmLabel(model, p, r, c, k)`
  - ignore `payload.value` if present
- `cell_clear`:
  - require: `target.model_id/p/r/c`
  - runtime: iterate labels in that cell and `rmLabel` each editable label only
  - ignore `payload.value` if present
  - reserved/forbidden labels are skipped without error
- `submodel_create`:
  - require: `value.t = "json"`, `value.v = { id, name, type }` (id must not be 0/99)
  - runtime: `createModel({ id, name, type })`
  - `payload.target` ignored if present
  - LocalBusAdapter must pre-check duplicate id (runtime.getModel) and name/type non-empty strings; failures map to invalid_target

## 3.3 Demo Wiring (Renderer / Store / LocalBusAdapter)
- `runtime = new ModelTableRuntime()` 在 demo 初始化时创建（单例）。
- demo init 必须 `runtime.createModel({ id: 99, name: 'editor_mailbox', type: 'ui' })`。
- `store.snapshot` 始终来自 `runtime.snapshot()` 的序列化结果。
- `host.getSnapshot()` 返回 `store.snapshot`（即 runtime 的快照）。
- `host.dispatchAddLabel(label)` 仅用于写入 event mailbox：调用 `runtime.addLabel(model99, 0,0,1, label)` 并刷新 `store.snapshot`。
- UI 侧仅能写 `ui_event`；`ui_event_error` 与 `ui_event_last_op_id` 只能由 LocalBusAdapter 写入。
- `host.dispatchRmLabel(labelRef)` 仅清空 event mailbox：调用 `runtime.rmLabel(model99, 0,0,1, 'ui_event')` 并刷新 `store.snapshot`。
- LocalBusAdapter 从 `runtime` 读取 mailbox（或通过 host 写入触发），执行后刷新 `store.snapshot`。
- host.dispatchAddLabel/dispatchRmLabel 必须强制校验只允许写/清 mailbox 的 `ui_event`，否则返回错误并拒绝写入。
- host.dispatchAddLabel 必须拒绝覆盖已存在的 `ui_event`（single outstanding event）。
- LocalBusAdapter 采用单实例；测试必须通过同步 `consumeOnce()`/`tick()` 驱动（不依赖 setInterval）。
- UI 组件/renderer 只能调用 host API，不得直接 import/调用 runtime.*。

## 3.4 Binding Compatibility (AST v0 vs Editor v0.x)
- LabelRef 扩展：editor-only 扩展 `model_id`；legacy v0 读绑定缺省值为 0。
- Editor bind 必须显式提供 `target_ref.model_id`（缺失则 reject）。
- bind.write 兼容策略：
  - 若存在 `bind.write.action`，使用 editor payload 规则；
  - 否则按 v0 `EventTarget` 结构（target/event_type/policy）处理。
- legacy v0 EventTarget envelope 保持不变；editor v0.x 使用本迭代 mailbox envelope（如需统一迁移，必须同步更新 v0 相关校验脚本）。

## 4. Scope
### 4.1 In Scope
- UI AST v0.x 扩展（editor-only）：Table/Column、Tree、Form/FormItem、Dialog/Drawer、Toolbar/ActionGroup、Pagination、Select/NumberInput/Switch 等必要节点。
- UI AST v0.x 扩展文档与“不可执行”约束（schema/脚本化校验）。
- renderer 映射补齐（Element Plus/HTML）。
- LocalBusAdapter（本地事件消费者）：消费 event mailbox 并调用 ModelTableRuntime API 更新 ModelTable。
- demo 前端：ModelTable 编辑 UI AST（Cell CRUD + 子模型创建）。
- 验证脚本：AST 校验、renderer 回归、demo 事件闭环与 event-only 断言。
- 迭代登记与记录：docs/ITERATIONS.md 记录 Planned；runlog 记录 Review Gate（Phase2）。

### 4.2 Out of Scope
- 双总线/远端执行/分布式。
- 运行时 built-in 语义扩展。
- 持久化写回数据库。
- 生产级 IA/视觉重构。
- 新增外部依赖（若 jsdom 不存在则只允许本地 smoke，不计入 DoD）。

## 5. Non-goals
- 不做完整 ModelTable 可视化分析器。
- 不提供远端协作或权限系统。
- 不实现 PICtest 级别的 submt 语义对齐（仅 UI/editor 范畴）。

## 6. Success Criteria (Definition of Done)
- AST 扩展文档与校验脚本通过（fixtures 正/负例覆盖、输出稳定）。
- renderer editor 回归通过（jsdom 环境，输出 editor_* 断言 PASS）。
- demo 编辑器验证通过（event-only + CRUD/submodel + forbidden guard + 幂等规则）。
- LocalBusAdapter 仅消费 event mailbox；UI 侧写入只发生在 mailbox（脚本化审计通过）。
- Stage4+ guard 通过（禁止路径/关键字/导入未触碰）。
- jsdom 验收规则：DoD 必须满足 `jsdom:yes` 并通过 jsdom 环境；`jsdom:no` 仅允许本地 smoke，不计入 DoD。
- 错误码产出必须遵循 Contract 的 priority 映射（由验证脚本覆盖）。

## 6.1 Contract Reference
- Contract: `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`

## 7. Risks & Mitigations
- Risk: AST 扩展引入可执行字段或隐式逻辑。
  - Impact: 破坏 UI AST 纯数据契约。
  - Mitigation: schema + 负例验证脚本，遇到 script/expr/handler/function 字段直接 FAIL。
- Risk: LocalBusAdapter 越权触发总线或网络。
  - Impact: 越界到 Stage4+。
  - Mitigation: 禁止导入/使用 MQTT/Matrix 模块，脚本检查 forbidden imports。
- Risk: 编辑器写入触发隐式 bus 副作用（例如 pin_in/pin_out）。
  - Impact: 间接越界 Stage4+。
  - Mitigation: 禁用 k/t/coords 清单 + 运行时拒绝 + 测试断言。
- Risk: “ModelTable 唯一真值”被 UI 本地状态替代。
  - Impact: UI 与 ModelTable 不一致。
  - Mitigation: 写入审计 + 快照一致性断言。

## 8. Open Questions
None. (jsdom 已在根目录 devDependencies)

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - docs/architecture_mantanet_and_workers.md (ModelTable 真值、Sliding UI、UI 事件归一为写格子)
  - docs/ssot/runtime_semantics_modeltable_driven.md (副作用由 add_label/rm_label 驱动)
- Notes:
  - UI 仅 event 写入；LocalBusAdapter 作为本地事件消费者，不触发总线。
  - 所有副作用通过 ModelTableRuntime API 体现。

### 9.2 Charter Compliance Checklist
- Charter references:
  - docs/charters/dongyu_app_next_runtime.md (UI 只读 ModelTable；事件写格子；无双总线)
- Notes:
  - demo 仅本地自滑；无 Matrix/Element Call/E2EE。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
