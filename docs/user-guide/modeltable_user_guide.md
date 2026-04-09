---
title: "ModelTable User Guide (Living Doc)"
doc_type: user-guide
status: active
updated: 2026-04-09
source: ai
---

# ModelTable User Guide (Living Doc)

> Status: Living Doc
> This document MUST be updated whenever any of the following change:
> - mailbox contract (event envelope, error codes, single-slot policy)
> - PIN topic/payload rules
> - MGMT patch rules or routing rules
> - reserved model ids / reserved cells

## 0. Who This Is For
本指南面向需要“直接填写模型表单元格”的开发/集成/测试人员。

数据模型专项指南：
- `docs/user-guide/data_models_filltable_guide.md`
  - 说明 `Data.Array / Data.Queue / Data.Stack` 的新合同下使用方式。

## 1. Mental Model (SSOT-aligned)
- ModelTable 是唯一真值；UI 只是投影。
- 所有副作用必须由 add_label / rm_label 触发。
- 管理总线（MGMT）与控制总线（PIN/MQTT）只处理“纯 ModelTable patch”。

## 2. Reserved Models (System)
- `model_id = 0`：root / intermediate layer / system boundary；当前规范要求 `Model 0 (0,0,0)` 显式持有 `model.table`
- `model_id = -1`：editor_mailbox（UI event mailbox）
- `model_id = -2`：editor_state（UI 控件状态）
- `model_id = -100`：Matrix debug / bus trace observable state + Workspace debug surface；只允许承载调试投影、trace 摘要与安全操作结果，不得作为 business truth
- 其他负数 model_id 为软件工人系统级能力层；其绝对值越大，越偏向内置系统级应用层；用户不得创建/写入
- 用户模型为所有正数 `model_id > 0`
- 系统负数模型的 bootstrap 定义来源：`packages/worker-base/system-models/*.json`

## 2.1 Cell Model Labels (Current Normative View)

- 每个 materialized Cell 必须且只能有一个有效模型标签（主归属 / 主执行形态）。
- 有效模型标签集合：`model.single` / `model.matrix` / `model.table` / `model.submt`
- `model.table`：模型根 `(0,0,0)` 的显式根声明
- `model.matrix`：矩阵自身相对 `(0,0,0)` 的显式根声明
- `model.submt`：子模型挂载/映射位；该 Cell 只允许 `pin.*` / `pin.log.*` 共存
- `model.submt` 只建立父子挂载关系；不代表父模型可以 direct 修改子模型内部 label
- 在 table/matrix 作用域内，未物化且未显式声明的普通 Cell，默认有效模型标签为 `model.single`
- `model.name` 只允许写在模型自己的 `(0,0,0)`
- 除 `model_id = 0` 外，每个模型都必须通过某个父模型 Cell 上的 `model.submt` 显式挂载进入层级

补充理解：

- 一个 Cell 可以被多个上层 model scope 派生发现，但不需要显式声明多份归属。
- 父模型可沿 `model.submt` ancestry 逐层看到 descendants。
- `model.matrix` 可看到其范围内的 `model.single` 与更小矩阵。
- 执行时不按“当前属于哪些 scope”做分支判断，而按 pin 链和目标坐标传播。

## 2.2 UI Cellwise Contract (0210 Freeze)

0210 冻结的目标不是“立刻删掉所有旧 UI AST”，而是把哪些路径是正式合同、哪些只是迁移债务写死，避免后续 implementation 一边做一边猜。

| Classification | Definition | Current Examples |
|---|---|---|
| Allowed | UI authoritative input 只能来自 materialized Cell label、显式页面目录、以及已挂载 child model 的真实 Cell/label | `ui_page_catalog_json`；schema-driven projection；父模型 hosting cell 上的 `model.submt` |
| Forbidden | 把 projection/shared AST 重新当成真值，或绕过 `model.submt` / effective model label 做隐式挂载 | 把整页 `ui_ast_v0` 根格 JSON 当 authoritative bootstrap；把 shared root AST 当业务真值； direct model mutation |
| Legacy-Debt | 当前仓库仍存在、但只允许作为 migration inventory 的旧入口 | `asset_type: "ui_ast_model"` 页面资产；`ws_selected_ast`；`-1:(0,0,0)` 派生 `ui_ast_v0`；store/resolver 直接读 root AST |

使用时只记三条：
- `parent` 挂载：child model 必须通过父模型 hosting cell 上的 `model.submt` 进入层级，UI 读取 child 的真实 Cell/label。
- `matrix` 挂载：matrix 根先声明 `model.matrix`，child 仍通过显式 `model.submt` hosting cell 进入矩阵层级，且坐标映射必须明确。
- 需要正式写入 child 时，父模型只能通过 child 暴露出来的 pin/API 发送 request；最终 label 落盘必须由 child 自己的 owner materialize / helper 执行。
- legacy UI AST 可以暂时被 inventory / resolver / docs 提及，但不能再被当作新页面或新挂载的正式输入面。
- 当前默认 helper scaffold：
  - 新建正数模型后，系统会在 `(0,1,0)` 预置一个 reserved helper cell
  - 该 cell 负责 same-model owner materialization，不是业务展示位

## 2.3 Workspace Parent-Mounted ThreeScene (0216)

0216 把 Three.js 场景能力收敛成一个正式的 parent/child 模式：

- `Model 1007`：Workspace app。持有 `app_name`、page-level summary/status text 和 parent `page_asset_v0`。
- `Model 1008`：mounted child truth。持有 `scene_graph_v0`、`camera_state_v0`、`selected_entity_id`、`scene_status`、`scene_audit_log`。
- `Model 1007 (0,2,0)`：必须显式 `model.submt -> 1008`。
- `Workspace (-25)`：只允许挂 `1007`，不允许把 `1008` 直接暴露成 app。

使用口径：

- `ThreeScene` 只读 snapshot / label refs，把 child truth 投影成浏览器 3D scene。
- 浏览器端 mesh / camera / renderer 只是 host cache，不是 business truth。
- CRUD 真正写表时，必须走 `ui_event -> intent_dispatch_table -> handle_three_scene_* -> Model 1008/1007 labels`。
- local mode 必须明确返回 `unsupported / three_scene_remote_only`，不能偷偷复制第二套本地 CRUD 逻辑。

## 2.4 Workspace Slide App Built-ins (0289 / 0290 / 0302)

当前 Workspace slide 主线额外保留这组正数模型：

- `Model 100`
  - 内置 flow-shell slide app（`E2E 颜色生成器`）
- `Model 1030`
  - `滑动 APP 导入` host
- `Model 1031`
  - zip 导入器 truth
- `Model 1034`
  - `滑动 APP 创建` host
- `Model 1035`
  - 填表创建器 truth

当前 `slide_surface_type` 正式枚举：

- `flow.shell`
  - 表示 app 进入 Workspace 的 flow shell 投影
- `workspace.importer`
  - 表示 zip 导入器自己的工作页面
- `workspace.page`
  - 表示直接在 Workspace 右侧打开的页面型 slide app

补充规则：

- 一个 Workspace app 进入 slide-capable 主线，至少要在 `(0,0,0)` 明确带上：
  - `app_name`
  - `slide_capable = true`
  - `slide_surface_type`
  - `ui_authoring_version`
  - `ui_root_node_id`
- 新增 `slide_surface_type` 枚举值时，必须先更新现行规约，再进入实现。

## 3. User Input (Mailbox)
UI 只能写 event mailbox：`model_id=-1 Cell(0,0,1) k=ui_event t=event`。
Mailbox 的 envelope 必须包含 `op_id`（用于审计/去重）。

补充：

- mailbox 只是前端事件入口，不是长期业务路由本体。
- mailbox 之后的“事件 -> 合法 pin ingress / routing”解释属于 Tier 1 runtime。
- `server` 只负责 envelope 适配、mailbox 写入与 snapshot / transport；不应长期持有独立正式事件语义。
- 对需要落到“当前模型 / 当前单元格”的业务动作，前端事件 envelope 应显式携带：
  - `target.model_id`
  - `target.p`
  - `target.r`
  - `target.c`
- `0310` 冻结后的正式方向是：
  - `target = cell`
  - `pin = port`
- 也就是说，前端最终不再用 `action` 表达“要做什么”，而是直接表达“把值送到这个 cell 的哪个 pin”
- 兼容期可继续保留 `meta.model_id`，但它不再是唯一目标来源。
- 当前 built-in submit 已启用 target-based ingress：
  - runtime 会把 `submit + target` 映射为 `Model 0` 上的一个 ingress key
  - 然后再按 `pin.connect.model` 进入目标模型
- 当前 slide/workspace 系统动作也已启用同一方向的 runtime ingress：
  - `slide_app_import`
  - `slide_app_create`
  - `ws_app_add`
  - `ws_app_delete`
  - `ws_select_app` / `ws_app_select`
- 对以上已迁移动作，若对应 ingress route 不存在，系统会直接报 `route_missing`，不再偷偷回退到旧分发。
- 仍未迁移的其它动作，可能还保留 legacy shortcut；它们会在后续迭代继续收口。

### 3.0.1 Projection Pin Metadata（0310 Freeze）

当一个 AST 节点需要走正式 pin 直寻址协议时，投影应显式给出：

- `cell_ref`
- `writable_pins`

`writable_pins` 的冻结结构：

```json
[
  {
    "name": "submit_request",
    "direction": "in",
    "trigger": "click",
    "value_t": "event",
    "commit_policy": "immediate",
    "primary": true
  }
]
```

补充规则：

- `name` 表示 pin 名
- `direction` 目前正式只允许 `in`
- `trigger` 表示 UI 侧哪个交互会写这个 pin
- `value_t` 表示建议值类型
- `commit_policy` 与延后同步口径保持一致
- `primary=true` 表示这是该节点默认使用的写入口

如果节点没有这组字段，则说明它仍在旧协议或只读投影路径上。

参考合同：`docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`

### 3.1 Prompt FillTable（0155）

固定入口页面：`/#/prompt`。

动作约定：
- `llm_filltable_preview`：只生成预览，不执行写入。
- `llm_filltable_apply`：只执行当前预览中 owner 已确认的 `accepted_changes`。

前端触发这两个动作时必须带 `meta.local_only=true`，用于显式声明“仅本地处理，不进入 Matrix forward”。

默认策略（当前 owner-chain 宿主实现）：
- 仅允许写入正数 `model_id`（`>0`）。
- 禁止写入负数系统模型。
- LLM 只产出 `proposal + candidate_changes`。
- 宿主必须完成 owner-side validation / translation / materialization。
- 必须通过 type/key/size/changes 上限校验。

Preview / Apply 两阶段约束：
- Preview 返回 `preview_id` 与 `preview_digest`。
- Apply 必须携带与当前状态一致的 `preview_id`。
- 重放同一 `preview_id` 必须拒绝（`preview_replay`）。
- 旧的 records-only preview payload 必须显式拒绝（`legacy_preview_contract`）。

重要边界：
- 当前正式口径已经切到 owner chain：`prompt -> preview proposal -> owner-side validation/translation -> owner-side apply -> owner 触发真实写表`。
- 对 LLM 暴露的公共合同是 `candidate_changes / accepted_changes / applied_changes`，而不是 `mt.v0 records`。
- `add_label/remove_label` 仍然存在，但已经退回为 owner 内部 materialization 细节，不再是给 LLM 的目标输出接口。

### 3.2 Owner Chain Contract

owner-chain 的正式链路固定为：
1. caller 提交 prompt，请求 preview
2. LLM 只产出 `proposal + candidate_changes`
3. 宿主执行 owner-side validation / translation
4. preview 只暴露 `accepted_changes / rejected_changes / owner_plan`
5. apply 只消费 `accepted_changes`
6. owner 内部 materialize 后，最终才落到运行时写表原语

当前宿主实现约束：
- `candidate_changes` 是对 LLM 的公共合同
- `accepted_changes / applied_changes` 是对 caller 的公共结果
- `add_label/remove_label` 只允许出现在 owner 内部执行层
- LLM 不拥有直接写模型表的权限
- caller 不应提交 `op:add_label/remove_label` 作为 preview/apply 的外部输入

### 3.3 Local-First Color Generator Example（0181）

这是一条**填表示例口径**：不新增新的 pin type，只沿用现有 pin / connect / submt。

规则：
- 输入框、切页、选中应用、展开/收起这类动作，默认只改本地状态，不应自动离开本地 runtime。
- 只有明确需要远端处理的动作，例如颜色生成器里的 `submit`，才把结果写入现有模型边界输出 pin，并通过父模型 relay 一路接到 Model 0。

颜色生成器建议写法：
- 输入框：
  - 只写 `model_id=-2` 的 `model100_input_draft`
  - 不写任何 `pin.out`
- `Generate Color`：
  - 本地函数先写 `submit_inflight=true`
  - 读取 `model100_input_draft`
  - 组装 payload
  - 最后写到当前子模型 `(0,0,0)` 的现有 `pin.out submit`

relay 规则：
- 深层子模型的 `submit` 只能先到父模型 hosting cell
- 父模型 hosting cell 只能用现有 `pin.connect.label` / `cell_connection` relay
- 必须逐层上送，直到 Model 0 `(0,0,0)` 的 `pin.bus.out submit`

因此：
- 如果 `submit` 没有接到 Model 0，则它仍然只是本地动作
- 只有接到 Model 0 的 `submit` 才会真正外发

使用判断法：
- “这个动作会不会出总线？”
  - 看它是否最终进入 Model 0 `pin.bus.out`
  - 不看新的辅助字段
  - 不依赖新的 pin 类型

### 3.4 commit_policy / overlay 使用法（0186）

当 UI 交互频率很高，但你不希望每一步都先落后端 ModelTable 时，可以在 bind / label 定义侧显式声明 `commit_policy`。

默认推导：
- `immediate`
  - 直接写 committed ModelTable
  - 不启用 overlay
- `on_change`
  - 拖动/调整过程中只改 overlay
  - `change` 时再 commit
- `on_blur`
  - 输入过程中只改 overlay
  - blur 时再 commit
- `on_submit`
  - 输入过程中只改 overlay
  - 显式 submit/action 前先 commit

补充：

- 这套延后同步不仅适用于负数本地状态，也适用于正数模型的 owner/intention 写入。
- 当前 slide 主线里，正数模型输入的推荐默认值是：
  - `Input` → `on_blur`
  - 高频选择类控件 → `on_change`

关键边界：
- overlay 只影响当前前端显示，不自动变成系统事实。
- ModelTable 仍是 committed truth。
- 只有声明了 `commit_policy != immediate` 的正数 label，才启用 overlay。

滑块示例：
- 若需要“拖动几乎零延迟，松手后再落表”：
  - `commit_policy: "on_change"`
- 若需要“0 -> 100 -> 0 的每一步都进入 ModelTable”：
  - `commit_policy: "immediate"`

输入框示例：
- 若需要“打字流畅，但只有提交时才固化”：
  - `commit_policy: "on_submit"`
- 若需要“失焦就固化”：
  - `commit_policy: "on_blur"`

当前 repo 内的真实示例：
- Workspace `Model 100` 输入框：
  - `input_value__bind.write.commit_policy = "on_submit"`
  - 打字时只更新 overlay
  - 点击 `Generate Color` 前先 commit 到 `model100_input_draft`
- Gallery `slider_demo`：
  - `write.commit_policy = "on_change"`
  - 拖动中只更新 overlay
  - `change / pointerup` 时再 commit 到 `slider_demo`

## 4. ModelTablePatch v0 (统一消息体)
所有总线消息必须是“纯 ModelTable patch”，最小结构如下：

```json
{
  "version": "mt.v0",
  "op_id": "op_123",
  "records": [
    {
      "op": "add_label",
      "model_id": 1,
      "p": 2,
      "r": 3,
      "c": 4,
      "k": "pageA.textA1",
      "t": "str",
      "v": "hello"
    }
  ]
}
```

`op_id` 必须存在（包含本地触发）。

## 5. PIN (Control Bus)
> 历史说明：本节仍能看到部分旧 `PIN_IN/PIN_OUT` 术语，是代码/文档迁移债务，不是当前允许的新工作输入面。除非得到用户显式批准，不得新增或维持这类兼容逻辑。当前规范以 `docs/ssot/label_type_registry.md` 和 `docs/ssot/runtime_semantics_modeltable_driven.md` 为准。

### 5.1 用户填写方式
用户模型里：

- PIN_IN：`k=<pin_name>, t=PIN_IN, v=<TargetRef | legacy-string>`
- PIN_OUT：`k=<pin_name>, t=PIN_OUT, v=<legacy-string>`

TargetRef 结构（Cell-owned）：
```json
{ "model_id": 1, "p": 2, "r": 3, "c": 4, "k": "pageA.textA1" }
```

可选触发字段（与 TargetRef 同级）：
```json
{
  "model_id": 1, "p": 2, "r": 3, "c": 4, "k": "pageA.textA1",
  "trigger_funcs": ["on_patch_in"],
  "trigger_model_id": -10
}
```

### 5.2 行为
- PIN_IN：
  - 当 `v` 是 TargetRef（Cell-owned）时，MQTT 入站写入 TargetRef 指向的 Cell/Label。
  - 若同时声明 `trigger_funcs`，runtime 会在该次入站写入后产出 `run_func` intercept（由 engine 执行）。
  - 当 `v` 是 legacy-string（或无效对象）时，回退到 legacy mailbox（`p=0,r=1,c=1`）写入 `t=IN`。
- PIN_OUT：
  - 当前仍走 legacy mailbox：写入 `t=OUT` 到 pin mailbox 后由 runtime publish。
  - payload 为 ModelTablePatch 时按 patch 直发；否则按 legacy envelope 发送。

### 5.3 示例（A/B/C）
- A 页面订阅 pinA：
  - `k=pinA, t=PIN_IN, v={ model_id:1,p:2,r:3,c:4,k:"pageA.textA1" }`
- 远端发送 pinA：payload 到达后写入 `model_id=1,p=2,r=3,c=4,k=pageA.textA1`。

## 6. MGMT (Management Bus, MBR Format v0)

本节以 **MBR 当前可执行格式** 为准：消息体是 JSON 文本，字段固定；topic 为固定分段。

### 6.1 MBR Topic（8 段）
```
UIPUT/<workspace>/<dam>/<pic>/<de>/<sw>/<model>/<cell_k>
```

每段必须符合：`^[A-Za-z0-9_-]+$`

### 6.2 Matrix 侧 payload（UI ↔ MBR）
必填字段：
- `topic`: string（8 段）
- `signature`: string（trace id，全链路透传）
- `k`: string（PIN 名称）
- `t`: string（`str` 或 `json`）
- `v`: string（当 `t=json` 时为 JSON 文本）
- `timestamp`: string（毫秒级 Unix 时间戳）

### 6.3 MQTT 侧 payload（Worker ↔ MBR）
必填字段：
- `userid`: string（Matrix 用户 id）
- `signature`, `k`, `t`, `v`, `timestamp`

### 6.4 系统填写方式（只填 Cell）
系统在系统负数模型里只需要填写 **TargetRef**：

```
{ "model_id": 1, "p": 2, "r": 3, "c": 4, "k": "pageA.textA1" }
```

用于：
- 出站：`k=<channel>, t=MGMT_OUT, v=<MBR_Matrix_Payload>`
- 入站订阅：`k=<channel>, t=MGMT_IN, v=<TargetRef>`

**分格规则（必须）**：
- `MGMT_OUT` 与 `MGMT_IN` 必须写在不同的 cell（不同的 `p/r/c`），避免同一 cell 内同名 `k` 覆盖与方向歧义。
- 若同一 `channel` 需要同时支持收发，建议使用相同 `k` 但不同 cell 坐标。

其中：
- `channel == k`（用于匹配）
- `MBR_Matrix_Payload` 为上述 Matrix payload 结构（topic/signature/k/t/v/timestamp）

### 6.5 匹配规则
MGMT_IN 仅在以下条件全部满足时写入：
1) `session_id` 一致（由系统注入，用户不填写）
2) `channel == Label.k`
3) 若消息带 `target`，坐标必须与该 cell 完全一致

### 6.6 示例（A/B/C）
页面 A/B/C 的 Text 组件：
- `pageA.textA1`
- `pageB.textB1`
- `pageC.textC1`

系统声明：
- `k=pageA.textA1, t=MGMT_IN, v={ model_id:1,p:2,r:3,c:4,k:"pageA.textA1" }`

远端返回（Matrix payload）示例：
```json
{
  "topic": "UIPUT/ws_test/dam/pic/de/sw/model/pageA.textA1",
  "signature": "sig-...",
  "k": "pageA.textA1",
  "t": "str",
  "v": "hello",
  "timestamp": "1733943035123"
}
```

### 6.7 对齐说明
- 若与 `docs/ssot/runtime_semantics_modeltable_driven.md` 冲突，以该文档为准。
- Mailbox 合同冻结：`docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`。

## 7. Env vs ModelTable
当前产品路径的唯一启动入口是 `MODELTABLE_PATCH_JSON`：
- trusted bootstrap patch 可以在 `boot/edit` 期间直写 ModelTable
- trusted bootstrap 之外，不得 direct applyPatch 深层目标模型；运行态正式写入必须通过 owner materialize / helper request pin 完成
- Matrix / MQTT 所需的 `matrix.*` / `mqtt.local.*` 配置统一写到 Model 0 `(0,0,0)`
- `ui-server` 默认停在 `runtime_mode=edit`，显式切到 `running` 后才执行软件工人副作用

敏感字段说明：
- Matrix token / password 当前允许作为 trusted bootstrap patch 的一部分进入 Model 0，仅用于启动期读取
- 这意味着测试环境里的 snapshot / runlog / EventLog 可能看到这些值，验证时必须按环境隔离处理
- 不再允许走独立 `MATRIX_*` env fallback 作为产品路径

## 8. Troubleshooting
- `reserved_cell`: 写入了保留模型或保留坐标
- `op_id_replay`: op_id 重复
- `invalid_target`: target 缺失/类型不对

建议先查 `ui_event_error` 与 EventLog。

## 9. Connectivity Test (CellA/CellB 双向)
本测试只依赖 MBR 格式与 ModelTable，不依赖 UI 特殊逻辑。

### 9.1 CellA（模拟 UI 侧 → MBR）
在系统负数模型中写：
- `k=pageA.submitA1, t=MGMT_OUT`
- `v` 填入 MBR Matrix payload（JSON 文本），例如：
```json
{
  "topic": "UIPUT/ws_test/dam/pic/de/sw/model/pageA.submitA1",
  "signature": "sig-1111",
  "k": "pageA.submitA1",
  "t": "str",
  "v": "hello",
  "timestamp": "1733943035123"
}
```

预期：
- MBR 将该 payload 转发到 MQTT（同名 topic）。

### 9.2 CellB（模拟 Worker → MBR → UI 回包）
先在系统负数模型中声明入站目标：
- `k=pageA.textA1, t=MGMT_IN, v={ model_id:1,p:2,r:3,c:4,k:"pageA.textA1" }`

使用 MQTT 客户端向同名 topic 发送 payload：
```json
{
  "userid": "@your_user:server",
  "signature": "sig-2222",
  "k": "pageA.textA1",
  "t": "str",
  "v": "updated",
  "timestamp": "1733943035123"
}
```

预期：
- MBR 私聊回 Matrix，程序模型写回 `pageA.textA1` 的目标 cell。
