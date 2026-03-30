---
title: "0212 — home-crud-proper-tier2 Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-22
source: ai
iteration_id: 0212-home-crud-proper-tier2
id: 0212-home-crud-proper-tier2
phase: phase1
---

# 0212 — home-crud-proper-tier2 Plan

## 0. Metadata

- ID: `0212-home-crud-proper-tier2`
- Date: `2026-03-22`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0212-home-crud-proper-tier2`
- Planning mode: `refine`
- Depends on:
  - `0210-ui-cellwise-contract-freeze`
  - `0211-ui-bootstrap-and-submodel-migration`
- Downstream:
  - `0213-matrix-debug-ui-surface`
  - `0215-ui-model-tier2-examples-v1`

## 1. Goal

- 把当前只证明“新 page asset 能显示”的 Home 页，升级为一套真正可执行、可审计、可复用的 CRUD Tier 2 参考面：
  - create
  - read / select
  - update
  - delete
- 该闭环必须完全建立在 `0210/0211` 冻结的新合同之上：
  - `page_asset_v0`
  - materialized cell / label
  - mailbox-only UI writes
  - explicit system-model routing
- 由于 0212 明确把 Home/Editor UI state 放在 `Model -2`，本迭代还必须先把 `Model -2` 正式登记到 `CLAUDE.md` 的 `MODEL_ID_REGISTRY`，否则后续 placement 本身不合规。
- 不能为了恢复 Home 交互而重新引入：
  - root `ui_ast_v0`
  - shared AST truth-source
  - direct business-model mutation from UI

## 2. Background

- `0210-ui-cellwise-contract-freeze` 已冻结 UI contract：
  - UI authoritative input 必须来自真实 cell/label/mounted model
  - 禁止把整页 `ui_ast_v0` 当 truth source
  - hidden helper / routing / guard 默认放在负数系统模型
- `0211-ui-bootstrap-and-submodel-migration` 已把 Home 页迁到 `packages/worker-base/system-models/home_catalog_ui.json` 中的 `page_asset_v0`，并移除了根格 `ui_ast_v0` 依赖。
- `CLAUDE.md` 当前的 `MODEL_ID_REGISTRY` 已登记 `-1/-3/-10/-12/-21..-26/-101..-103`，但没有 `Model -2`。
- 0212 当前草案却把 `Model -2` 当作既有的 Home/Editor UI state 模型使用；若不把“先登记 `Model -2`”写入正式合同与实施顺序，执行阶段会直接违反最高优先级文档里“未登记 model_id 不得使用”的硬约束。
- 当前代码事实显示，Home 仍停留在“查询/浏览”而不是“完整 CRUD”：
  - `home_catalog_ui.json` 目前只有筛选表单、缺失模型提示和表格列，没有 action column、create form、edit dialog、detail drawer、delete confirmation。
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js` 只派生：
    - `home_table_rows_json`
    - `home_missing_model_text`
    没有 Home CRUD 所需的 action/status schema。
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js` 与 `packages/ui-model-demo-server/server.mjs` 已经预置了：
    - `draft_*`
    - `dt_edit_*`
    - `dt_detail_*`
    但这些状态没有在 Home page asset 中 materialize 成完整可操作 surface。
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js` 与 `packages/ui-model-demo-server/server.mjs` 仍保留旧时代 `datatable_*` 分支：
    - `datatable_refresh`
    - `datatable_select_row`
    - `datatable_edit_row`
    - `datatable_view_detail`
    - `datatable_remove_label`
    但这组动作是半成品：
    - 没有 create/save contract
    - delete 与 `direct_model_mutation_disabled` 约束冲突
    - local / remote 路径不对齐
- `docs/iterations/0131-server-connected-editor-sse/handoff.md` 记录过旧 datatable era 的 row actions、detail drawer、remove 行为；0212 的职责不是回到旧 AST，而是把那套交互语义重填到当前 `0210/0211` 新合同里。
- 另外，remote/server path 与 local/demo path 当前能力不对齐：
  - remote server 已具备 `intent_dispatch_table` + `func.js` 的 Tier 2 dispatch 机制，现有 docs/static/workspace/prompt 已走 `Model -10` handler patch。
  - local demo 还没有与 remote 等价的 program-engine / dispatch 执行面，不能默认假设本地已经支持同样的 Tier 2 CRUD。
- `packages/ui-renderer/src/renderer.mjs` 已支持：
  - `Dialog`
  - `Drawer`
  - `TableColumn` scoped row slot
  - `$ref: row.*`
  因此 0212 预期应停留在 Tier 2 asset / handler / host-orchestration 范围；如果执行中发现必须新增 renderer/runtime 语义，必须停下并另开 iteration。

## 3. Problem Statement

- Home 当前只完成了新 page asset contract 的“投影迁移”，没有完成“业务可操作闭环”。
- 用户现在可以看到 selected model 的 label inventory，却不能通过一条自包含、合规、可验证的路径完成：
  - 新建 label
  - 选中并回填草稿
  - 编辑并保存
  - 查看详情
  - 删除 label
- 现有 host-side `datatable_*` 代码既不构成稳定产品合同，也不满足 `proper tier2` 的要求：
  - 业务逻辑没有收敛到 model-defined handler
  - generic direct mutation 仍然被正式合同拒绝
  - local/remote 行为不一致
  - 缺少针对 ownership / flow / chain 的 Home CRUD conformance tests
- 如果不先完成 0212，后续 `0213` 与 `0215` 会建立在一个“页面外壳已合规，但核心交互仍半成品”的基础上，继续放大技术债。

## 4. Scope

### 4.1 In Scope

- 定义 Home CRUD 的正式 action contract，并把它写成无上下文读者可理解的合同：
  - `home_refresh`
  - `home_select_row`
  - `home_open_create`
  - `home_open_edit`
  - `home_save_label`
  - `home_delete_label`
  - `home_view_detail`
  - `home_close_detail`
  - `home_close_edit`
- 把 Home 页缺失的 CRUD surface materialize 到 `home_catalog_ui.json`：
  - action column
  - create / edit dialog
  - detail drawer or dialog
  - status / error feedback
- 为 Home 添加或补齐 Tier 2 routing / handler 入口，使 CRUD 主路径不再依赖 host 中的临时 `datatable_*` 分支作为唯一真实现。
- 把 `Model -2` 的用途正式登记到 `CLAUDE.md` 的 `MODEL_ID_REGISTRY`：
  - 用途：editor/home UI state projection model
  - 要求：该登记必须先于任何依赖 `Model -2` placement 的实现落地
- 为 Home CRUD 增加 deterministic functional + conformance validation：
  - 页面资产合同
  - direct mutation gate 不回退
  - Home action dispatch contract
  - local / remote 口径说明

### 4.2 Out of Scope

- 不新增 `runtime.js` / `runtime.mjs` 的解释器语义。
- 不新增 renderer 组件类型、row context 语义或新的 `$ref` 规则。
- 不把本轮扩成“所有页面的通用 CRUD framework”。
- 不处理 Matrix debug surface、sliding flow、Gallery 扩展、Three.js runtime。
- 不放松 `direct_model_mutation_disabled` 正式合同，不允许用 generic `label_add/update/remove/cell_clear` 直接写业务真值。

## 5. Conformance Targets

### 5.1 Tier Boundary

- 0212 属于 Tier 2：
  - page assets
  - system-model handlers
  - routing / dispatch config
  - host-side minimal orchestration only when needed for parity or loading
- 禁止把 Home CRUD 需求上推成 Tier 1 变更；如执行中发现必须改：
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
  则当前 iteration 必须停下并升级为新的设计/规划问题。

### 5.2 Model Placement

- 用户业务真值：
  - 仍归 selected positive model 所有
- Home/Editor UI state：
  - 归 `Model -2`（editor/home state）
  - 但 0212 的执行前置条件是先把该 id 登记进 `CLAUDE.md` 的 `MODEL_ID_REGISTRY`
- Home page asset：
  - 归 `Model -22`
- hidden dispatch / guard / handler：
  - 默认归 `Model -10`
- 本 iteration 的具体 blocker 已知且固定：
  - `Model -2` 当前未登记
  - 因此任何依赖 `Model -2` 的 UI state placement、测试、seed、handler contract 都必须建立在“先登记 `Model -2`”之后

### 5.3 Data Ownership / Flow / Chain

- Ownership：
  - selected positive model 拥有业务 label 真值
  - `Model -2` 只拥有 filters、draft、dialog open、status、detail text 等 UI state
  - `Model -10` 只拥有 hidden handler / dispatch / lifecycle state
- Allowed flow：
  1. UI component 只写 mailbox `Model -1 (0,0,1): ui_event`
  2. dispatch 根据 Home action contract 进入 `Model -10` handler
  3. handler 校验 target/value 后写 selected positive model 或回写结构化错误
  4. derived state 重新生成 `home_table_rows_json` / status labels
  5. page asset 再读取这些状态进行渲染
- Forbidden：
  - UI 直接写 positive business model
  - 重新依赖 root `ui_ast_v0`
  - 通过 shared AST 或 undocumented fallback 让 CRUD “看起来可用”
  - 复制第二份 local-only business logic 来规避 remote Tier 2 路径

## 6. Impact Surface

### 6.1 Governance / Registry

- `CLAUDE.md`
  - `MODEL_ID_REGISTRY` 需正式登记 `Model -2 = editor/home UI state projection model`

### 6.2 System-model Assets And Dispatch

- `packages/worker-base/system-models/home_catalog_ui.json`
- `packages/worker-base/system-models/intent_dispatch_config.json`
- `packages/worker-base/system-models/intent_handlers_home.json`（new）

### 6.3 Frontend Projection / Local Host

- `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- `packages/ui-model-demo-frontend/src/remote_store.js`
- `packages/ui-model-demo-frontend/src/local_bus_adapter.js`

### 6.4 Server-backed Orchestration

- `packages/ui-model-demo-server/server.mjs`
  - 主要作为 remote authoritative path 的现有 dispatch 容器
  - 仅当 Home dispatch loading / contract alignment 必须调整时才允许修改

### 6.5 Validation Surface

- `scripts/tests/test_0191d_home_asset_resolution.mjs`
- `scripts/tests/test_0194_ui_snapshot_utils_dedup.mjs`
- `scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
- `scripts/tests/test_0212_home_crud_contract.mjs`（new）
- `packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs`（new）
- `packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`（new）

## 7. Success Criteria

- `CLAUDE.md` 的 `MODEL_ID_REGISTRY` 中存在 `Model -2` 的正式登记，且语义与 0212 所用的 Home/Editor UI state placement 一致。
- Home page asset 在新合同下具备完整 CRUD surface，而不是只剩只读表格。
- Home CRUD 主路径通过 Tier 2 model-defined contract 完成，不依赖重新放开 generic direct mutation。
- `direct_model_mutation_disabled` 仍继续保护 generic `label_*` / `cell_clear` / 旧 `datatable_remove_label` 直写业务模型的路径。
- selected positive model 继续是业务真值唯一 owner；`-2` / `-10` 只承担 UI state 与 hidden helper。
- validation 至少覆盖两类结论：
  - functional：Home CRUD contract 可跑通
  - conformance：没有越 Tier、没有错 placement、没有 ownership/flow/chain 旁路
- downstream `0213` / `0215` 可以把 Home 当成当前仓库第一组“新 UI contract + proper tier2 CRUD”样板。

## 8. Risks & Mitigations

- Risk:
  - `Model -2` 的使用继续只写在迭代文档或代码里，但没有真正登记到 `MODEL_ID_REGISTRY`。
  - Impact:
    - 0212 即便功能看似完成，仍然因 model placement 不合规而不可交付。
  - Mitigation:
    - 把 `CLAUDE.md` 中的 `Model -2` 登记提升为 execution prerequisite，并在验收中单列检查。

- Risk:
  - remote server 具备 Tier 2 dispatch，而 local demo 没有等价执行面，导致 local/remote 口径分裂。
  - Impact:
    - 执行后出现“remote 可用、local 另写一套逻辑”。
  - Mitigation:
    - 明确 remote path 为 authoritative execution path；local path只允许两种状态：
      - 复用同一 dispatch contract
      - 明确 projection-only / explicit unsupported
    - 禁止新增第二份 local-only CRUD business logic。

- Risk:
  - 为了尽快恢复 Home 操作，直接在 `server.mjs` / `local_bus_adapter.js` 继续堆 page-specific hardcode。
  - Impact:
    - `proper tier2` 名义成立，实则仍是 host-side feature patch。
  - Mitigation:
    - 把 Home action contract 固定到 `intent_dispatch_config.json` + `intent_handlers_home.json`，host 侧只允许做 loading / parity / error-surface 补齐。

- Risk:
  - delete / save 路径与 `direct_model_mutation_disabled` 合同冲突。
  - Impact:
    - 要么回退正式拒绝合同，要么 CRUD 无法落地。
  - Mitigation:
    - 明确 generic direct mutation 继续被拒绝；Home 只允许经 dedicated Tier 2 action contract 触发业务写入。

- Risk:
  - 0212 scope 膨胀成通用 CRUD framework 或共享 engine 抽取。
  - Impact:
    - 本 iteration 无法在可控范围内收口。
  - Mitigation:
    - 只服务 Home 场景；若 local full parity 需要复用 program-engine，则作为 review gate 明确裁决，而不是隐式并入。

## 9. Alternatives

### A. 推荐：Home-specific Tier 2 handlers + explicit page asset surface

- 形式：
  - 先登记 `CLAUDE.md` `MODEL_ID_REGISTRY` 中的 `Model -2`
  - `home_catalog_ui.json` materialize CRUD controls
  - `intent_dispatch_config.json` 注册 Home actions
  - `intent_handlers_home.json` 在 `Model -10` 执行真正业务写入/删除/状态回写
- 优点：
  - 与 `CLAUDE.md` 的 `CAPABILITY_TIERS`、`fill-table-first`、negative-model placement 一致
  - downstream 可把 Home 当作可复用样板
  - 不需要新增 runtime / renderer semantics
- 缺点：
  - 需要显式处理 local/remote 差异
  - 需要补新的验证脚本

### B. 延续旧 `datatable_*` host 分支并补全 create/save/delete

- 优点：
  - 看起来实现更快
- 缺点：
  - 业务逻辑仍落在 host code
  - 与 `proper tier2` 目标冲突
  - 会把 0212 做成又一轮临时补丁
- 结论：
  - 不推荐

### C. 只做 remote CRUD，local 完全不管

- 优点：
  - 可以规避 local program-engine 缺口
- 缺点：
  - local contract 变得模糊
  - 容易留下“页面显示出按钮但本地行为不清晰”的坏状态
- 结论：
  - 仅可作为显式假设下的受限交付，不可作为默认推荐

当前推荐：A。

## 10. Execution Assumptions

- Assumption A1:
  - `0212` 在执行时可以先修改 `CLAUDE.md`，把 `Model -2` 注册为 editor/home UI state projection model。
- Assumption A2:
  - `0212` 的 authoritative CRUD 成功口径以 server-backed / remote path 为准。
- Assumption A3:
  - local demo 不得新增第二份 Home CRUD business logic；若不能共享同一 dispatch contract，则必须给出明确、可测试的 projection-only / unsupported contract。
- Assumption A4:
  - 现有 renderer 对 `Dialog` / `Drawer` / `TableColumn` scoped row refs 的支持已经足够；若执行中发现不够，应停止并升级为新 iteration。

验证这些假设的方法：

- Review Gate 必须显式检查：
  - 是否接受先登记 `Model -2` 作为 0212 的实施前置条件
  - 是否接受 remote authoritative 的执行口径
  - 是否接受 local projection-only 或要求 full parity
  - 是否接受“Home-specific Tier 2 handler”而不是“通用 CRUD framework”

## 11. Inputs

- Created at: 2026-03-22
- Iteration ID: `0212-home-crud-proper-tier2`
- Trigger:
  - 用户要求在现有 `0212` 草稿基础上补完/重写 Phase 1 合同
  - 用户要求先分析 codebase、读取现有 `plan.md` 与 `resolution.md`，再输出自包含的 WHAT/WHY 与 HOW 文档
  - 评审结论为 `NEEDS_CHANGES (minor)`，唯一 blocker 是 `Model -2` 必须在 `MODEL_ID_REGISTRY` 注册
