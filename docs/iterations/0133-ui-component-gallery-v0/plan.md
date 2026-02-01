# Iteration 0133-ui-component-gallery-v0 Plan

## 0. Metadata
- ID: 0133-ui-component-gallery-v0
- Date: 2026-01-31
- Owner: Sisyphus (OpenCode)
- Branch: dev_gallery_ui_component_gallery_v0

## 1. Goal
实现一个 `Gallery`，用于展示当前 UI 模型（`ui_ast_v0`）支持的组件，并扩展 renderer/AST 覆盖一批 Element Plus 高频组件子集，重点覆盖：
- props 透传/受控两种模式
- events（尤其 `v-model` / `update:modelValue`）到 ModelTable mailbox 的统一写入
- 父子组件/slot 的 AST 表达
- “基础 UI -> 功能 UI -> 界面 UI”的组合方式
- submodel（子模型）下放子模型：小组件组合成大组件的可复用机制（v0.x 扩展）

同时：在首页增加 Gallery 入口，点击后进入 Gallery 页面（虚拟路由，类似 vue-router；不引入 vue-router 依赖）。

## 2. Invariants (Must Not Change)
- ModelTable 是唯一真值来源；UI/renderer 只读 snapshot。
- UI 事件只能写 event mailbox：`model_id=-1 cell(0,0,1) k=ui_event t=event`；不得 UI 直连 MQTT/Matrix/HTTP 副作用。
- renderer 的事件 envelope 必须保持与现有 editor mailbox contract 一致（`action/target/value/meta.op_id`）。
- 不修改 SSOT：`docs/architecture_mantanet_and_workers.md`。
- 不新增依赖（除非后续明确需要且评审通过）。

## 3. Scope

### 3.1 In Scope
- Hash 虚拟路由（`#/`、`#/gallery`、`#/gallery/<id>`）。
- Gallery 页面：组件目录 + 组件详情（Preview/Props/Events）三段式。
- Element Plus 组件子集（Scope 2）：
  - Wave A：Checkbox/Radio/Slider（新增 node.type + props/events）
  - Wave B：DatePicker/TimePicker/Tabs/Dialog/Pagination（新增 node.type + props/events）
  - Wave C：Include/Submodel（组合/复用机制）
- 验证脚本：
  - `validate_gallery_ast.mjs`：Gallery AST 可渲染且包含所有 node.type
  - `validate_gallery_events.mjs`：关键交互会产生 mailbox event，且不会 mailbox stuck

### 3.2 Out of Scope
- Element Plus 全量 parity。
- remote SSE server 侧为 Gallery 专门产出 AST（Gallery 可用本地 ModelTable 运行时承载）。
- Matrix/MBR/MQTT 的真实总线链路接入（Gallery 只展示 UI 层 contract 与 ModelTable 写入）。

## 4. Component/Event Contract (Gallery 内部约定)

### 4.1 受控值（v-model）统一
- 受控组件必须：
  - 从 `bind.read`（LabelRef / editor target_ref）读出 `modelValue`
  - 用 `onUpdate:modelValue` 写回 `label_update`

### 4.2 额外事件统一写入（可观测）
- 对 `change/input/click/clear/blur/focus` 等事件，统一写入一个 Gallery 专用事件日志 label（建议 `model_id=<gallery_state>, cell(0,0,0), k=gallery_event_log`，t=json）。
- payload 统一字段：`{ op_id, event, value, extra, ts }`。

## 5. Composition: Parent/Child, Feature UI, Submodel

### 5.1 Parent/Child（slot）
- 使用 UI AST 的 `children` 表达父子组件与 slot 结构；不引入 Vue SFC 概念。
- TableColumn scoped slot 现有 `$ref` 机制作为组合能力基线。

### 5.2 分层 UI（基础 -> 功能 -> 界面）
- 基础 UI：单一组件节点（Input/Button/...）。
- 功能 UI：组件树片段（例如 SearchBar = Input + Button + Tag）。
- 界面 UI：页面 Root（由多个功能 UI 组成）。

### 5.3 Submodel 下放 Submodel（Wave C）
- 新增 `Include` 节点（v0.x extension）：读取某个 label 存的 AST fragment 并递归渲染。
- 配合已有 `submodel_create` action（mailbox）实现“动态实例化 + 复用”。

## 6. Success Criteria (DoD)
- 从首页进入 Gallery，无整页刷新；前进/后退正常。
- Gallery 至少覆盖 Wave A/B 的组件 demo：
  - props 生效（可见差异）
  - events 可观测（写入事件日志 + mailbox last op id 可追踪）
  - mailbox 不会卡死（ui_event 会被消费并清空）
- Include/Submodel demo：
  - 静态复用：同一 fragment 被复用两次渲染
  - 动态实例：点击按钮创建 submodel 并显示新实例
- 验证脚本可执行且 PASS：
  - `node packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_gallery_events.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`

## 7. Work Plan (Waves)

### Wave A (foundation)
1) Hash router + Home entry
2) Gallery store（ModelTable-driven）+ Gallery page skeleton
3) renderer 增加 Checkbox/Radio/Slider + Gallery demos
4) validate scripts + test/build

### Wave B (feature UI)
1) renderer 增加 DatePicker/TimePicker/Tabs/Dialog/Pagination
2) Gallery demos：props/events 覆盖
3) 扩展 validate scripts + test/build

### Wave C (composition)
1) Include node + fragment store format
2) submodel_create 端到端 demo（本地）
3) validate + test/build
