---
title: "Iteration 0190-data-array-tier2-template Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0190-data-array-tier2-template
id: 0190-data-array-tier2-template
phase: phase1
---

# Iteration 0190-data-array-tier2-template Resolution

## Execution Strategy

- 先做结构对齐与红灯合同，不直接碰 runtime 核心。
- 以正数模型中的自包含模板为首选方案，把 `Data.Array` 明确做成 Tier2 模型能力。
- 同步明确旧 `data_models.js` 的定位：仅作历史参考，不作为正式实现入口。

## Step 1

- Scope:
  - 审计现有 `Data.Array` 相关规约与遗留实现
  - 产出 canonical 模板结构说明
  - 明确 `delete_data_in` 语义
  - 明确命名 pin 与 function pin 的接线关系
- Files:
  - `docs/iterations/0190-data-array-tier2-template/plan.md`
  - `docs/iterations/0190-data-array-tier2-template/resolution.md`
  - `CLAUDE.md`
  - `packages/worker-base/src/data_models.js`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/feishu_alignment_decisions_v0.md`
  - `docs/ssot/tier_boundary_and_conformance_testing.md`
- Verification:
  - `rg -n "Data\\.Array|add_data_in|delete_data_in|get_data_in|get_all_data_in|get_size_in|get_data_out|get_all_data_out|get_size_out" CLAUDE.md docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/label_type_registry.md docs/ssot/feishu_alignment_decisions_v0.md`
  - `rg -n "data_models\\.js|DATA_TYPE_REGISTRY|initDataModel" packages/worker-base/src packages/ui-model-demo-server`
- Acceptance:
  - 已明确新路线与旧 `data_models.js` 的关系
  - 已明确 `Data.Array` 模板的根 cell / 元信息 / 数据 cell / pin 接口
  - 已明确 `delete_data_in` 的输入语义和删除后的数组整理规则
  - 已明确命名 pin 如何通过 `pin.connect.label` 接到 `func:in / func:out`
  - 已明确 8 个统一接口名在模板中的边界 pin 位置及输入/输出方向
- Rollback:
  - 回退本轮文档改动

### Step 1 Design Output

本轮 `Data.Array` 的 canonical 模板骨架按以下方式冻结：

说明：

- 下文使用 `[k: ..., t: ..., v: ...]` 作为速记法，只用于表达单个 label 的结构。
- 实际 fixture / patch 文件必须使用完整 JSON patch 记录格式，例如：
  - `{"op":"add_label","model_id":2001,"p":0,"r":0,"c":0,"k":"model_type","t":"model.table","v":"Data.Array"}`

#### A. 模型根

- `model_type`:
  - `[k: "model_type", t: "model.table", v: "Data.Array"]`
- 元信息（根 cell `(0,0,0)`）：
  - `[k: "size_now", t: "int", v: 0]`
  - `[k: "next_index", t: "int", v: 1]`

说明：
- `size_now` 表示当前有效元素数量
- `next_index` 表示下一次 append 默认落在哪一行

#### B. 数据布局

- 数据元素默认放在 `(0, r, 0)`，其中 `r >= 1`
- 第 1 个元素在 `(0,1,0)`
- 第 2 个元素在 `(0,2,0)`
- 依此类推

#### C. 对外 pin

根 cell `(0,0,0)` 声明以下统一 pin：

- 输入：
  - `add_data_in`
  - `delete_data_in`
  - `get_data_in`
  - `get_all_data_in`
  - `get_size_in`
- 输出：
  - `get_data_out`
  - `get_all_data_out`
  - `get_size_out`

#### D. 函数标签

根 cell `(0,0,0)` 声明函数：

- `array_add`
- `array_delete`
- `array_get`
- `array_get_all`
- `array_get_size`

#### E. pin 到 function 的接线

命名 pin 与函数 pin 的推荐接线如下：

- `add_data_in -> array_add:in`
- `delete_data_in -> array_delete:in`
- `get_data_in -> array_get:in`
- `get_all_data_in -> array_get_all:in`
- `get_size_in -> array_get_size:in`
- `array_get:out -> get_data_out`
- `array_get_all:out -> get_all_data_out`
- `array_get_size:out -> get_size_out`

即：
- 输入 pin 负责接请求
- function pin 负责执行业务逻辑
- 输出 pin 负责把结果送回模型外部

接口层次约定：

- `add_data_in / delete_data_in / get_data_in / get_all_data_in / get_size_in`
  - 属于 boundary input pins
- `array_add:in / array_delete:in / array_get:in / array_get_all:in / array_get_size:in`
  - 属于 private function pins
- `get_data_out / get_all_data_out / get_size_out`
  - 属于 boundary output pins
- `pin.connect.label`
  - 只负责在同一个 cell 内把 boundary pins 与 private function pins 连起来
  - 不做 payload 转换

本轮明确采用同 Cell 方案：

- 对外 pin 与 `array_*` 函数统一放在 `(0,0,0)`
- 接线统一使用 `pin.connect.label`
- 不采用 `(1,0,0)` 处理 cell + `pin.connect.cell` 的方案

理由：

- 当前目标是先冻结最小、最清晰、最直接的 `Data.Array` 模板
- 在首个正式 Tier2 数据模型模板中，优先减少接线层级，比保留“格子是否拥挤”的扩展空间更重要

#### F. `delete_data_in` 语义

本轮冻结为：

- 输入 payload 必须按 index 删除
- index 采用从 `1` 开始的数组行号语义
- 删除后数组执行 compact：
  - 删除位置之后的元素整体前移
  - 不保留空洞
- 删除成功后：
  - `size_now - 1`
  - `next_index` 回到 `size_now + 1`

理由：
- 对 `Data.Array` 来说，按 index 删除 + 自动压紧，最符合数组直觉
- 若后续需要“按 value 删除”或“允许空洞”，应另开新迭代或新子类型，而不是混进 `Data.Array`

#### G. 写操作的响应策略

- 本轮不新增 `add_data_out` / `delete_data_out` 这类专用响应 pin
- `add_data_in` / `delete_data_in` 的成功结果以 committed state 变化为准
- 失败结果通过结构化错误记录或 `pin.log.*` 暴露
- 若后续确需 mutation ack，应通过单独迭代新增统一约定，而不是在本轮临时扩展

理由：
- 当前统一接口规范中，显式输出 pin 只覆盖 `get/get_all/get_size`
- 先把 `Data.Array` 做成稳定模板，比先扩 pin 面更重要

#### H. Payload Contracts

本轮冻结以下 payload contract：

##### 1. `add_data_in`

- 输入 payload：
  - `{"value": <json-serializable>}`
- 说明：
  - 调用方只传业务值，不直接传 `{k,t,v}` label 结构
  - 模板内部统一把该值 materialize 为：
    - `k = "value"`
    - `t = "json"`
    - `v = payload.value`

##### 2. `delete_data_in`

- 输入 payload：
  - `{"index": <int>=1..n}`
- 说明：
  - `index` 使用从 `1` 开始的数组位置语义

##### 3. `get_data_in`

- 输入 payload：
  - `{"index": <int>=1..n}`

##### 4. `get_all_data_in`

- 输入 payload：
  - `null`
- 说明：
  - 本轮不支持 filter / range

##### 5. `get_size_in`

- 输入 payload：
  - `null`

##### 6. `get_data_out`

- 输出 payload：
  - `{"index": <int>, "found": <bool>, "value": <json-serializable|null>}`

##### 7. `get_all_data_out`

- 输出 payload：
  - `{"items": [<json-serializable>, ...], "size": <int>}`

##### 8. `get_size_out`

- 输出 payload：
  - `{"size": <int>}`

##### 9. 路由规则

- boundary input pin 收到的 payload 原样传入对应 `func:in`
- function 输出结果原样传到对应 boundary output pin
- wrapper route 不做 payload 改写

理由：

- 对调用者最友好的接口是“传业务值或简洁参数”，而不是要求调用者理解内部 label 结构
- 这套 payload contract 后续可直接复用于 `Data.Queue` / `Data.Stack`

#### I. `model.submt` 约束

- `Data.Array` 实例作为正数模型时，最终仍必须由父模型通过 `model.submt` 挂入层级
- 模板本身不预设 parent model
- 创建者负责在实际使用场景中决定它挂到哪个父模型

#### J. 遗留实现处理

- `packages/worker-base/src/data_models.js` 是现存 legacy live dependency
- 当前实际活跃使用仅见：
  - `traceModel -> CircularBuffer`
- 本轮不修改 `traceModel -> CircularBuffer` 依赖
- 后续若要清理该依赖，单开迭代处理

## Step 2

- Scope:
  - 设计 0190 的执行面：模板文件、测试文件、示例/用户指南更新点
- Files:
  - `packages/worker-base/system-models/templates/data_array_v0.json`
  - `scripts/tests/test_0190_data_array_contract.mjs`
  - `scripts/tests/test_0190_data_array_template_patch.mjs`
  - `scripts/fixtures/0190_data_array_cases.json`
  - 必要时 `docs/user-guide/modeltable_user_guide.md`
  - 必要时 `docs/iterations/0190-data-array-tier2-template/*`
- Verification:
  - 文档中列出将新增的 tests / fixtures / docs 路径
  - 每个验证命令具有明确 PASS/FAIL 判定或明确的 exit code 约束
  - conformance review 检查项被明确写入
- Acceptance:
  - 下一轮正式 `Approved` gate 下，可直接进入执行，不需要再重设计文件布局
  - 合同测试覆盖 8 个统一接口名的输入/输出方向
  - 行为测试至少覆盖 `add/delete/get/get_all/get_size`
- Rollback:
  - 回退本轮文档改动
  - 删除 canonical template：
    - `packages/worker-base/system-models/templates/data_array_v0.json`
  - 删除测试资产：
    - `scripts/tests/test_0190_data_array_contract.mjs`
    - `scripts/tests/test_0190_data_array_template_patch.mjs`
    - `scripts/fixtures/0190_data_array_cases.json`
  - 若本轮执行阶段已在本地 seeded template patch，则删除对应临时模型实例或恢复执行前快照

### Step 2 Execution Contract

下一轮执行预计新增：

- canonical template:
  - `packages/worker-base/system-models/templates/data_array_v0.json`
- tests:
  - `scripts/tests/test_0190_data_array_contract.mjs`
  - `scripts/tests/test_0190_data_array_template_patch.mjs`
  - 必要时 `scripts/tests/test_0190_data_array_template_e2e.mjs`
- test fixtures:
  - `scripts/fixtures/0190_data_array_cases.json`
- docs:
  - 必要时 `docs/user-guide/modeltable_user_guide.md`
  - 必要时 `docs/iterations/0190-data-array-tier2-template/*`

分工约定：

- canonical template：
  - 作为正式 `Data.Array` 模板定义
  - 面向后续实例化和复用
- test fixtures：
  - 只承载测试输入、预期输出和边界场景
  - 不承担正式模板角色

测试与模板关系：

- `test_0190_data_array_template_patch.mjs`
  - 直接校验 canonical template 的结构
- `test_0190_data_array_contract.mjs`
  - 基于 canonical template + test fixture 执行行为合同

推荐验证口径：

- 结构合同：
  - `Data.Array` 根 cell / pin / func / connect labels 是否齐全
- 行为合同：
  - `add_data_in`
  - `delete_data_in`
  - `get_data_in`
  - `get_all_data_in`
  - `get_size_in`
  - `get_data_out`
  - `get_all_data_out`
  - `get_size_out`
  - 输入 payload / 输出 payload 格式与约定是否一致
- conformance 合同：
  - Tier 1 / Tier 2 边界
  - 正数/负数模型放置
  - 数据所有权
  - 数据流向
  - 数据链路合法性

## Step 3

- Scope:
  - 设计实施后的收口规则与回滚路径
- Files:
  - `docs/iterations/0190-data-array-tier2-template/runlog.md`
  - 必要时 `docs/ITERATIONS.md`
- Verification:
  - 文档中包含执行完成后需补录的 runlog 事实
  - 文档中包含一键或逐步回滚思路
  - `docs/ssot/tier_boundary_and_conformance_testing.md` 被纳入 runlog 审计清单
- Acceptance:
  - 0190 在 Phase1 层面已具备完整执行合同
- Rollback:
  - 回退本轮文档改动

### Step 3 Completion Notes

下一轮 Phase3 执行时，runlog 必须显式记录：

- Tier 1 / Tier 2 边界检查结果
- 正数模型放置是否符合预期
- `Data.Array` 数据真值归属
- 输入输出 pin 的流向
- 是否存在跳层或绕路
- docs / tests / fixtures 的回滚是否可执行

## Notes

- Generated at: 2026-03-17
- `packages/ui-model-demo-server/server.mjs` 当前仍通过 `initDataModel(runtime, traceModel)` 初始化 trace model 的 `CircularBuffer`；本轮仅记录该遗留依赖，不纳入 0190 scope。
