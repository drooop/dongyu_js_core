# Iteration 0130-modeltable-editor-v1 Plan

## 0. Metadata
- ID: 0130-modeltable-editor-v1
- Date: 2026-01-28
- Owner: Sisyphus (OpenCode)
- Branch: dev_0130-modeltable-editor-v1
- Related:
  - `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`
  - `docs/iterations/0129-modeltable-editor-v0/ui-ast-v0_x-extension.md`
  - `packages/ui-model-demo-frontend/` (demo host + LocalBusAdapter)
  - `packages/ui-renderer/` (renderer)

## 1. Goal
交付一版可操作、可脚本验收的“UI 模型驱动 ModelTable 编辑界面 v1”：

- 支持选择/创建目标 model
- 支持对目标 model 做 Cell/Label CRUD（受限于 allowlist 与保留区）
- 支持 `t` 选择（`str`/`int`/`bool`/`json`）与对应输入
- 可视化 mailbox 状态（`ui_event_last_op_id` / `ui_event_error`）与事件日志

## 2. Background

- 0129 已交付 editor v0：基于 event mailbox 的最小闭环（UI 写 event，LocalBusAdapter 消费并更新 ModelTableRuntime）。
- 现状问题：demo UI 的编辑目标写死/前置条件不显式，且缺少更丰富的 UI AST 节点/renderer 映射，导致“看得见但难用”。
- 本迭代目标是把这套机制推进到“相对完整的编辑器体验”，并保持所有不变量与脚本化验收路径。

## 3. Invariants (Must Not Change)

- ModelTable 是 UI/状态的唯一真值源；UI 不得持有真值态绕开 ModelTable。
- UI 事件必须归一为“写格子”（写 event mailbox）；UI 不得直接发 MQTT/Matrix 等总线消息。
- 事件消费必须遵守 mailbox contract（shape / error priority / single-slot / op_id replay）。
- Mailbox contract 冻结：本迭代不得修改 `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md` 中已定义的 mailbox 位置、event envelope 形状/确定性规则、single-slot 写入策略、error code + error priority、`ui_event_error` stale 规则。
- 不引入 Stage 4+：Matrix/MBR/双总线/Element Call/E2EE/打包。
- 不引入新的运行时 built-in 语义；不修改 `p/r/c/k/t/v` 结构。

## 4. Scope

### 4.1 In Scope

- UI AST v0.x 扩展（editor v1 需要的组件节点与 props/bind 约束）
  - 本迭代最小新增 node types（必须落到 validator + fixtures + renderer）：
    - `TableColumn`（配合 `Table` 做只读列表展示）
    - `Select`（选择 model_id 与 value.t）
    - `NumberInput`（输入整数，或承载 int 的原始输入）
    - `Switch`（输入布尔值）
  - 既有 editor nodes（已有 contract/validator 基线）：`Table`, `Form`, `FormItem`, `Tree`
  - 可选但不强制（仅在确有必要时引入并补齐 fixtures）：`Dialog`/`Drawer`
- UI renderer 映射补齐（Vue3 + Element Plus），确保 jsdom 可验收。
- demo 前端 editor v1 UI AST：
  - model selector（选择现有 model_id）
  - create model（submodel_create）
  - cell/label inspector（读取 snapshot 并展示）
  - label add/update/remove + cell_clear
  - 邮箱状态与错误展示（`ui_event_error` / `ui_event_last_op_id`）
- 交互可用性规则（必须可脚本验收，不依赖手点）：
  - 在目标 model 不存在时，编辑控件必须显式不可用（disabled）或提示“需先创建”。
  - 输入组件保持受控（snapshot 驱动），且写入后由消费者更新 snapshot。
- 验证脚本扩展：覆盖新 UI AST 节点与 editor v1 交互场景。
- Typed value 归一化：为支持 `t=int/bool/json` 的可用编辑体验，本迭代允许在事件消费者侧做最小的 value normalization（见本迭代附加契约）。

### 4.2 Out of Scope

- 双总线/远端执行/分布式（Matrix/MBR/MQTT routing）。
- 运行时 built-in k 语义扩展、程序模型 trigger/执行。
- 持久化写回 sqlite（仅内存 runtime）。
- 权限系统、多人协作编辑、冲突合并。

## 5. Non-goals

- 不追求生产级 IA/视觉设计；不做完整“ModelTable 分析器”。
- 不追求性能极限优化（只做必要的可用性与可验收的优化）。

## 6. Success Criteria (Definition of Done)

- UI AST validator suite: PASS (covers all required nodes + negative fixtures)
- ui-renderer editor validator suite (jsdom): PASS
- ui-model-demo-frontend test suite: PASS
- ui-model-demo-frontend production build: PASS
- iteration guard suites (forbidden imports + stage scope): PASS
- 新增/更新的验证用例能够证明：
  - UI 交互只写 mailbox event（无 state bypass）
  - 目标 model 不存在时，不会出现“看似输入但被覆盖”的误导交互（disabled/提示可验证）

## 7. Risks & Mitigations

- Risk: UI AST 扩展引入可执行字段或隐式逻辑。
  - Impact: 破坏 UI AST 纯数据契约。
  - Mitigation: schema + negative fixtures，遇到 handler/script/function 字段直接 FAIL。
- Risk: 编辑器功能膨胀导致验证口径变得主观。
  - Impact: 迭代不可裁决、不可回归。
  - Mitigation: 每个交互点必须对应脚本断言（snapshot diff + mailbox/error）。
- Risk: 编辑器误触发 Stage 2.x/总线语义（例如写入 run_*/PIN_*）。
  - Impact: 越界到运行时语义或总线。
  - Mitigation: 继续沿用 0129 的 forbidden_k/forbidden_t/reserved_cell guard + 测试覆盖。

## 8. Open Questions

- `int`/`bool`/`json` 类型输入的归一化与错误可见性：
  - 默认建议：UI 写 mailbox 时允许携带 raw string；由事件消费者（LocalBusAdapter v1）基于 `value.t` 做最小 parse/normalize，成功则写入 runtime，失败则通过 `ui_event_error` 可见化（脚本可验收）。
  - 该行为不回写/改写 0129 v0 contract；以 0130 附加契约为准，且必须保持 v0 用例可继续通过（必要时版本化 adapter）。

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `docs/architecture_mantanet_and_workers.md` (UI 是投影；UI 事件归一为写格子；总线抽象与阶段边界)
- Notes:
  - 本迭代仅扩展 UI AST/renderer 与 demo 编辑器；不引入任何总线副作用。
  - Derived semantics reference (non-SSOT): `docs/ssot/runtime_semantics_modeltable_driven.md`（用于约束“不得绕过 ModelTable 触发副作用”的实现细节口径）。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `docs/charters/dongyu_app_next_runtime.md` (4 UI 约束；6.1/6.2 bus scope & phasing)
- Notes:
  - 不引入 Matrix/MBR/双总线；UI 仍只写 event mailbox。
  - PICtest extraction: N/A（原因：不改 built-in k / triggers / PIN 语义；沿用 0129 mailbox contract）。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
