---
title: "0325c — option-b-generator-rewrite Runlog"
doc_type: iteration-runlog
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0325c-option-b-generator-rewrite
id: 0325c-option-b-generator-rewrite
phase: phase1
---

# 0325c — option-b-generator-rewrite Runlog

## Environment

- Date: 2026-04-21
- Branch: `dev_0325c-option-b-generator-rewrite`
- Base: 分支起点 = `dev_0325b-legacy-system-models-ctx-migration` HEAD `d26b82b`（含 templates V1N 迁移 + Option B 清单）
- Runtime: phase1 planning; phase3 执行待 phase2 Approved

## Planning Record

### Record 1 — Initial (2026-04-21)

- Trigger: 0325b 在 phase3 执行中 sub-agent 第二次 review 发现架构误判（programEngine ctx 分离 leaky / Bucket C 重分类 / 算术），需要独立 iteration 做 Option B 实施
- Inputs reviewed:
  - 0325b runlog Step 5（二次 REJECT 后的 Option B 清单）
  - 0325 runtime V1N 基础（commit 7b4e269）
  - 0324 mt_write + default_table_programs.json
  - memory `project_0323_implementation_roadmap.md`
- Locked conclusions:
  - 纯 Tier 2 迁移，不改 runtime.mjs
  - 3 类目标：owner_materializer 生成器 / legacy forward funcs / Bucket C handler
  - 每类配合 shared bucket_c_cell_routes + V1N.table 规则
  - 0325 + 0325b + 0325c 三分支 triple-merge 到 dev

## Review Gate Record

### Review 1 — pending

- Iteration ID: `0325c-option-b-generator-rewrite`
- Review Date: pending
- Review Type: User + Sub-agent
- Review Index: 1
- Decision: pending
- Notes: 本迭代作为 0325 / 0325b 的完成补齐；phase1 docs 经 sub-agent review 给出意见，phase2 Approve 与否由 user 最终裁决

## Execution Records

### Step 1 — 契约测试

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 2 — 重写 ensureGenericOwnerMaterializer + ensureHomeOwnerMaterializer

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 3 — 迁移 workspace_positive_models.json legacy forward funcs

- Decision pre-step（触发路径裁决 + scope 扩展）:
  - `forward_workspace_filltable_submit_from_model0`: runtime entry = `ws_filltable_submit_wiring` pin.connect.label (workspace_positive_models.json 原 3576-3591); programEngine entry = `server.mjs:3840` 通用 egressFunc（Model 1010 dualBusConfig.model0_egress_func）→ **dual-route** → 降级 programEngine-only
  - `forward_matrix_phase1_send_from_model0`: runtime = `matrix_phase1_submit_wiring` (workspace_positive_models.json 原 12857-12872); programEngine = server.mjs:3840（Model 1020 dualBusConfig）→ **dual-route** → 降级 programEngine-only
  - `forward_model100_submit_from_model0`: runtime grep `(func, forward_model100_submit_from_model0:in)` 0 命中; programEngine = server.mjs:3840 + 3863 → **programEngine-only** → 不动
  - **Scope 扩展说明（per sub-agent MEDIUM 建议）**：Bucket B Model 100 `owner_materialize` (test_model_100_ui.json，runtime pin.connect.label `owner_route` 触发) 一并迁移到 V1N.table.addLabel/removeLabel；越界合理，因该函数若保留 ctx.* 在 post-0325 runtime ctx 会抛错，属已存在的 latent bug，顺手修复
  - **SC #7 豁免清单补录（per sub-agent MEDIUM 建议）**：plan.md SC #7 原豁免仅列 `server.mjs:3042-3080` + `server.mjs:1589-1609`；Step 3 迁移后补录如下 programEngine-only 代码进入豁免范围（runtime 入口已断，仅 programEngine ctx 执行）：
    - `packages/worker-base/system-models/workspace_positive_models.json` 里 k=`forward_workspace_filltable_submit_from_model0` 的 func.js body
    - `packages/worker-base/system-models/workspace_positive_models.json` 里 k=`forward_matrix_phase1_send_from_model0` 的 func.js body
    - `packages/worker-base/system-models/test_model_100_ui.json` 里 k=`forward_model100_submit_from_model0` 的 func.js body
- Command:
  - `node scripts/tests/test_0325c_generator_rewrite.mjs`
  - `node scripts/tests/test_0324_root_scaffold.mjs`
  - `node scripts/tests/test_0325_{v1n_api_shape,cross_model_read_denied,selfcell_write_guard}.mjs`
- Key output:
  - `test_0325c_generator_rewrite.mjs`: 5/7 PASS（tests 4/5 Bucket C 留 Step 4）
  - 0324/0325 regression 全 PASS
- Result: PASS（Step 3 目标达成；Step 4 待实施）
- Commit: `12c0df9`

### Step 3.5 — Model -10 intent handlers mass migration（phase3 scope 扩展）

Scope 发现源：sub-agent review Step 4 时追踪 0321/0322 server_flow FAIL 根因 → `intent_handlers_slide_import.json:41` `handle_slide_app_import` 仍用 `ctx.getLabel` 抛错 → imported model 未创建 → registry 空。phase1 plan.md 只识别 3 类 migration target（generator / forward / Bucket C handler），遗漏第 4 类"Model -10 intent handlers"。user 2026-04-21 决定采 A 扩展 scope（non-compat 整体达成），要求更可靠执行流程。

#### 执行流程（5 阶段 gate）

- Stage 0 Full Inventory（research, 不改代码）
- Stage 1 Cross-Model I/O Pattern Design Rubric（research）
- Stage 2 Reference Impl `intent_handlers_slide_import.json` + TDD + 0321 绿（code）
- Stage 3 Batch Migration（code，每 batch 独立 commit + sub-agent review + grep count 监控）
- Stage 4 Final Aggregate Gate（grep 清零 + 全量回归 + final review）

Safeguards：每 batch 前 checkpoint sha；每 batch FAIL 立即 `git reset` 回 checkpoint + 停；scope drift detection = 每次动代码前重 grep 对 inventory 校验。

#### Stage 0 — Full Inventory（2026-04-21）

Command: `Grep ctx\.writeLabel|ctx\.getLabel|ctx\.rmLabel packages/worker-base/system-models/` (exclude `.legacy`)

File-level count（active，不含 .legacy 归档）:

| 文件 | 命中 | 主要 Model | 迁移属性预判 |
| --- | --- | --- | --- |
| intent_handlers_slide_import.json | 1 | Model -10 handler → Model 1036+ | cross-model write via mt_write_req + pin.connect.model |
| intent_handlers_slide_create.json | 1 | Model -10 handler → Model 1036+ | 同上 |
| intent_handlers_ws.json | 3 | Model -10 → Model -2 / Model 0 | cross-model write + mailbox state |
| intent_handlers_home.json | 2 | Model -10 → Model -2 / 正模型 | 同上 |
| intent_handlers_docs.json | 3 | Model -10 → Model -2 | state projection write |
| intent_handlers_static.json | 3 | Model -10 → Model -2 / 正模型 | 同上 |
| intent_handlers_three_scene.json | 4 | Model -10 → scene models | cross-model write |
| intent_handlers_prompt_filltable.json | 2 | Model -10 → Prompt 相关 | 同上 |
| intent_handlers_matrix_debug.json | 3 | Model -10 → Model -100 Matrix debug | 同上 |
| intent_handlers_ui_examples.json | 1 | Model -10 → ui examples | 同上 |
| cognition_handlers.json | 1 | Model -10 → Model -12 | 同上 |
| workspace_catalog_ui.json | 4 | Model -10 → Model -25 Workspace state | 同上 |
| system_models.json | 3 | 待 Stage 0 细查 | - |
| test_model_100_ui.json | 3 | owner_materialize Step 3 已迁 ✓；2 × `prepare_model100_*` (Model -10 → Model 100) + 1 × `forward_model100_submit_from_model0` (programEngine-only，已豁免) | 需迁 2（prepare_*） |
| test_model_100_full.json | 1 | 待细查 | - |
| workspace_positive_models.json | 12 | 含 Model 1001/1009/1010/1016/1020 的 handlers + 2-3 prepare/forward | 混合：部分 programEngine-only 豁免，部分需迁 |
| **Total active** | **47** | - | - |

Excluded (`.legacy` 归档，永不迁)：remote_worker_model.legacy.json (1) + system_models.json.legacy (7) + test_model_100_full.json.legacy (1) = 9。

Step 3 已处理（不含在 47 里）：test_model_100_ui.json Model 100 owner_materialize Bucket B 迁移（1 处）+ workspace_positive_models.json 2 handle_slide_*_click Bucket C 迁移（2 处）+ 3 forward funcs programEngine-only 豁免（3 处）。

净需在 Step 3.5 内处理：**~45 处**（47 − 2 已豁免 forward_model100 类 = 45，若细查发现更多 programEngine-only 豁免再折减）。

Gate Stage 0: 表完成 ✓；总数 47 对账 ✓；legacy 排除清单清晰 ✓。pending Stage 0 sub-agent review 确认 inventory 可操作。

Commits: (Stage 0 无 code 变更)

#### Stage 1 — Cross-Model I/O Pattern Design Rubric（2026-04-21 draft）

执行前约束校验:
- `runtime.mjs:1809` `hasHostPrivileges = model.id < 0` → Model -10 handler 可用 `ctx.hostApi`
- `runtime.mjs:1813` `ctx.hostApi = hasHostPrivileges && runtime.hostApi ? runtime.hostApi : null`
- `runtime.hostApi` 由 server.mjs 启动时注入 → 可扩展新 methods 不触 Tier 1 runtime
- `runtime._seedDefaultRootScaffold` 仅 seed `model.id >= 0`（default_table_programs.json） → **负数模型没有 mt_write** → 跨模型写到负数 Model 不能走 "mt_write_req via pin.connect.model"（因目标 mt_write_in 不存在），必须走 hostApi

Rubric（9 条 canonical pattern）:

| Rubric | 场景 | API | 权限 | 备注 |
| --- | --- | --- | --- | --- |
| P1 | 本 cell 写 | `V1N.addLabel(k, t, v)` / `V1N.removeLabel(k)` | sandbox | 任何 handler 都可用 |
| P2 | 本模型跨 cell 写（root 特权） | `V1N.table.addLabel(p, r, c, k, t, v)` / `V1N.table.removeLabel(p, r, c, k)` | root only | 仅 (0,0,0) 可用 |
| P3 | 本模型任意 cell 读 | `V1N.readLabel(p, r, c, k)` → `{t,v} \| null` | sandbox+ (0323 扩展) | 单模型内 |
| P4 | 跨模型写（Bucket D） | `ctx.hostApi.writeCrossModel(modelId, p, r, c, k, t, v)` | host privileged (model.id<0) | server.mjs 新增 method |
| P5 | 跨模型读（Bucket F） | `ctx.hostApi.readCrossModel(modelId, p, r, c, k)` → `{t,v} \| null` | host privileged | server.mjs 新增 |
| P6 | 跨模型删 | `ctx.hostApi.rmCrossModel(modelId, p, r, c, k)` | host privileged | server.mjs 新增 |
| P7 | 系统桥（既有） | `ctx.hostApi.publishMqtt/sendMatrix/docsRefreshTree/Search/OpenDoc` | host privileged | 保留 pre-existing |
| P8 | UI mailbox 写（Model -1 c=1） | P4 特化：`ctx.hostApi.writeCrossModel(-1, 0, 0, 1, 'ui_event', 'event', payload)` | host privileged | 最常见特化；不单独 alias |
| P9 | State projection 写（Model -2 (0,0,0)） | P4 特化：`ctx.hostApi.writeCrossModel(-2, 0, 0, 0, k, t, v)` | host privileged | 沿用 `overwriteStateLabel` 内部路径 |

基础设施前置改动（属 Stage 2 Ref Impl 的准备步骤）:
- `packages/ui-model-demo-server/server.mjs` 扩展 `runtime.hostApi` 对象 3 methods：`writeCrossModel`/`readCrossModel`/`rmCrossModel`。每个方法内部 `runtime.getModel(modelId)` + `runtime.addLabel/getLabelValue/rmLabel` 包装。这是 server.mjs 层 hostApi shape 扩展，不触 runtime.mjs。

替换规则（per 迁移 handler code）:
- `ctx.writeLabel({model_id: SELF_MODEL, p, r, c, k}, t, v)` where SELF_MODEL === 当前 handler Model → P1/P2（(p,r,c)=handler cell → P1, 否则 → P2 且 handler 必须在 (0,0,0)）
- `ctx.writeLabel({model_id: OTHER, ...}, t, v)` → P4
- `ctx.getLabel({model_id: SELF, ...})` → P3
- `ctx.getLabel({model_id: OTHER, ...})` → P5
- `ctx.rmLabel({model_id: SELF, ...})` → P1/P2
- `ctx.rmLabel({model_id: OTHER, ...})` → P6

合规性论证:
- "side effects via add_label/rm_label only" 仍成立 —— hostApi.*CrossModel 内部最终调 `runtime.addLabel/rmLabel`，外部 API 形态只是 handler 便捷层
- "UI event mailbox 只能写 Model -1 (0,0,1)" 仍成立 —— P8 即是该路径
- 不新增兼容层 —— 老 ctx.writeLabel/getLabel/rmLabel 在 runtime ctx 完全移除；hostApi 是正当系统桥
- Tier 边界：Tier 1 runtime.mjs 不动；server.mjs 扩展 hostApi 属 Tier 2 基建

Gate Stage 1 (v1): **CHANGE_REQUESTED** 2026-04-21 per sub-agent aa643040b7d53b7c3。见下方 Revision 1。

Commits v1: `f865bc7` (Stage 1 仅文档)

#### Revision 1 (2026-04-21, per sub-agent review aa643040b7d53b7c3)

原 Stage 0 inventory + Stage 1 rubric 吸收 13 条建议 (C1/C2/H1/H2/H3/H4/M1/M2/M3/M4/L1/L2/L3) 修订如下：

##### R1 — P10 Dynamic modelId I/O（C1）

场景：handler 的目标 modelId 来自 runtime 解析（`sourceRef.model_id / payload.target.model_id / stateModelId` 等），非 literal。

API:
- `ctx.hostApi.writeCrossModel(resolvedId, p, r, c, k, t, v)`
- `ctx.hostApi.readCrossModel(resolvedId, p, r, c, k)`
- `ctx.hostApi.rmCrossModel(resolvedId, p, r, c, k)`

调用前**强制检查**：
```js
if (!Number.isInteger(resolvedId)) throw new Error('invalid_dynamic_target');
if (resolvedId === ctx.self.model_id) {
  // 退回 P1/P2：self cell 则 V1N.addLabel, 非 self cell 且 handler 在 (0,0,0) 则 V1N.table.addLabel
}
```

已确认典型消费者：system_models.json:182 `intent_dispatch`、intent_handlers_slide_import.json:41、多个 handlers。

##### R2 — P4/P5/P6 return shape 锁定（H1）

- writeCrossModel / rmCrossModel → `{ok: boolean, code?: string, detail?: string}`
- readCrossModel → `{ok: boolean, code?: string, detail?: string, data?: {t: string, v: any} | null}`
- 与 pre-existing `slideImportAppFromMxc / slideCreateAppFromState` shape 对齐

##### R3 — P4/P6 目标白名单（H3）

writeCrossModel / rmCrossModel 只接受：
- `modelId === -1 && (p, r, c) === (0, 0, 1)`（UI mailbox 特化）
- `modelId === -2 && (p, r, c) === (0, 0, 0)`（State projection root 特化）
- `modelId > 0` 任意 cell（正模型；hostApi 直写为绕过，内部 log 但放行）
- 其他负模型：只允许 `(p, r, c) === (0, 0, 0)` root 写
- 不符合 → `{ok:false, code:'invalid_target_white_list', detail:'modelId=... p=... r=... c=... forbidden'}`

##### R4 — Tier 边界决策（H2）

- 本迭代：3 新 methods 保持 Tier 2 (server.mjs 注入；与现 hostApi 共存)
- 论证：runtime.mjs:1813 `ctx.hostApi = runtime.hostApi` 的 injection 点不约束 method 集合，属 Tier 1/2 边界
- **未来 Tier 1 提升 trigger**：跨 worker (test harness/MBR worker) 也需要这 3 方法时 → 重开 iteration 把默认 impl 写进 runtime.mjs，server.mjs 可覆盖
- 本决策**显式记录**，不可无论证改动

##### R5 — 负模型不 seed default table programs（H4）

- `runtime._seedDefaultRootScaffold` 限 `model.id >= 0` 保持不变
- 论证：负模型是 system capability layer（CLAUDE.md MODEL_ID_REGISTRY），form 灵活不强制 model.table；3 默认程序是 user-visible 契约 (0323)
- 跨负模型 I/O 由 hostApi 承担（P4-P6）
- 不触 Tier 1

##### R6 — 豁免口径统一（M1）

确认 programEngine-only 豁免 = **3 条 forward** (不是 "2 + 不确定"):
- `workspace_positive_models.json:3584` `forward_workspace_filltable_submit_from_model0`
- `workspace_positive_models.json:12848` `forward_matrix_phase1_send_from_model0`
- `test_model_100_ui.json:288` `forward_model100_submit_from_model0`

净迁 = **47 (active)** − 3 (Step 3/4 已处理: owner_materialize+2 handle_slide_*_click) − 3 (豁免) = **41 处**

##### R7 — Pattern annotation 惯例（M4）

每个迁移后的 func.js code 顶端注释 `/* rubric: Pa+Pb+... */` 列出所用 patterns；sub-agent code-review 必须核对注释 vs 实际 API 使用，不一致即 CHANGE_REQUESTED。例：

```js
/* rubric: P1+P4+P8 */
const event = label && label.v || {};
V1N.addLabel('local_status', 'str', 'processing');
ctx.hostApi.writeCrossModel(-1, 0, 0, 1, 'ui_event', 'event', payload);
```

##### R8 — Batch 粒度（L3）

单 batch = 1 文件 **或** ≤ 5 调用点（取较小）。每 batch 独立 commit + checkpoint sha 记录于 runlog + sub-agent review。

##### R9 — 替换规则（表格，L1）

| 原 ctx 调用 | 判定 | Rubric |
| --- | --- | --- |
| `writeLabel({model_id: SELF, p=self_p, r=self_r, c=self_c, k}, t, v)` | literal SELF, same cell | P1 `V1N.addLabel(k, t, v)` |
| `writeLabel({model_id: SELF, (p,r,c)≠self, k}, t, v)` | literal SELF, other cell | P2 (root only) `V1N.table.addLabel(p,r,c,k,t,v)`；handler 非 root → Bucket C (P4a via mt_write_req) |
| `writeLabel({model_id: OTHER, ...}, t, v)` | literal OTHER | P4 `ctx.hostApi.writeCrossModel(OTHER, p, r, c, k, t, v)` |
| `writeLabel({model_id: <expr>, ...}, t, v)` | dynamic | P10-write (先做 integer check + self check) |
| `getLabel({model_id: SELF, ...})` | literal SELF | P3 `V1N.readLabel(p,r,c,k)?.v` (null guard) |
| `getLabel({model_id: OTHER, ...})` | literal OTHER | P5 `ctx.hostApi.readCrossModel(...)` |
| `getLabel({model_id: <expr>, ...})` | dynamic | P10-read |
| `rmLabel({model_id: SELF, ...})` | literal SELF | P1/P2 removeLabel |
| `rmLabel({model_id: OTHER, ...})` | literal OTHER | P6 `ctx.hostApi.rmCrossModel(...)` |
| `rmLabel({model_id: <expr>, ...})` | dynamic | P10-remove |

##### R10 — pre-existing runtime.hostApi methods 枚举（L2）

server.mjs `runtime.hostApi = {...}` 起始 L4841。已知 methods (partial, Stage 2 动手前再完整 grep)：
- `slideImportAppFromMxc(mediaUri)`
- `slideCreateAppFromState(stateModelId)`
- `matrixUserLogin(hs, username, password)`（`workspace_positive_models.json:12486` 使用）
- 其他待 Stage 2 枚举

##### R11 — 3 高风险文件 per-line 细明（C2）

**system_models.json** (3 处):

| Line | Handler | Self Model/Cell | 调用 | target modelId | Rubric |
| --- | --- | --- | --- | --- | --- |
| 169 | mgmt_receive | M-10 (0,0,0) | writeLabel(target, ...) | 动态 (`ctx.getMgmtInTarget(inbox.k)`) | P10-write |
| 182 | intent_dispatch | M-10 (0,0,0) | 多 writeLabel/getLabel/rmLabel；sourceRef 动态 + M-10 SELF 静态混合 | 动态 + SELF | P1 + P10 |
| 195 | pin_demo_set_mqtt_config | M-10 (0,0,0) | writeLabel({model_id:0, (0,0,0)}, ...) × 3 | literal OTHER=0 (Model 0 bus config) | **特殊评估**: Model 0 不在 P4 白名单默认集，bus config 属 system bridge 类似性质 → 建议 P4 扩展白名单加 `modelId === 0 && (0,0,0)`，或走 pre-existing hostApi method（待 Stage 2 裁决） |

**test_model_100_full.json** (1 处):

| Line | Handler | Self Model/Cell | 调用 | Rubric |
| --- | --- | --- | --- | --- |
| 104 | on_model100_submit_in | M100 (0,0,0) | writeLabel × 2 to own (0,0,0) | P1 self-cell |

**workspace_positive_models.json** 净 8 处 (原 12 - 2 豁免 Step 3 - 2 已处理 Step 4):

| Line | Handler | Self Model/Cell | Rubric |
| --- | --- | --- | --- |
| 705 | handle_submit_click | M100 (1,0,0) → M100 (0,0,0) | Bucket C (P4a via mt_write_req + bucket_c_cell_routes) |
| 2543 | emit_submit | M1009 (0,0,0) self | P1 |
| 3481 | dispatch_remote | M1010 (1,0,0) → M1010 (0,0,0) | Bucket C |
| 3494 | dispatch_local | M1010 (1,0,0) → M1010 multi cells | Bucket C |
| 3507 | prepare_workspace_filltable_submit | M-10 (0,0,0) → M1010 | P4 + P5 |
| 10793 | emit_submit | M1016 (0,0,0) self | P1 |
| 12486 | dispatch_matrix_phase1_login | M1017 (1,0,0) → M1017 root multi | Bucket C |
| 12745/12758/12771 | matrix_userline handlers | TBD (Stage 3 展开) | TBD (likely Bucket C or P1) |

##### R12 — Stage 2 Ref Impl 可行性确认（M2）

intent_handlers_slide_import.json:41 `handle_slide_app_import` 映射到 P1 + P8 (mailbox) + P9 (state) + P10 (dynamic stateModelId) 组合；当前含：
- 6 处 writeLabel(-1, 0, 0, 1, ...) → P8
- 5 处 writeLabel(stateModelId, ...) → P10-write
- 1 处 writeLabel(-2, 0, 0, 0, ...) → P9
- 1 处 getLabel(stateModelId, ...) → P10-read
- hostApi.slideImportAppFromMxc 保留 (P7)

Stage 2 TDD 契约 `scripts/tests/test_0325c_cross_model_hostapi.mjs` (M3):
- writeCrossModel (a) 正模型 OK; (b) M-1 (0,0,1) ui_event OK; (c) M-2 (0,0,0) state OK; (d) 无效 modelId → `{ok:false, code:'invalid_target'}`; (e) 不存在 model → 同 d; (f) 超白名单 → `{ok:false, code:'invalid_target_white_list'}`
- readCrossModel (a) 存在 → `{ok:true, data:{t,v}}`; (b) 不存在 → `{ok:true, data:null}`; (c) 无效 modelId → `{ok:false}`
- rmCrossModel 对称
- P10 动态：resolvedId === self → fallback OR throw by flag
- 功能保真：0321 server_flow PASS (目标 `imported_app_must_appear_in_registry` 恢复)
- 回归：0324 / 0325 / 0325c / 0143_e2e / slide_e2e 三套保 PASS

##### R13 — Gate 修订后

- Gate Stage 0 (Rev 1): 表完成 + 总数 47 对账 + 3 高风险文件 per-line + 豁免口径统一 ✓
- Gate Stage 1 (Rev 1): 10 patterns + return shape + 白名单 + Tier 决策 + 负模型决策 + pre-existing 枚举 + 替换规则表 + pattern annotation + batch 粒度 ✓
- pending sub-agent Rev 1 review

Commits (Rev 1 pending): 本提交后的 docs commit

#### Stage 2 — Reference Impl intent_handlers_slide_import

pending (Rev 1 review 通过后启动)

#### Stage 3 — Batch Migration

pending

#### Stage 4 — Final Aggregate Gate

pending

---

### Step 4 — Bucket C handler 实装（mt_write_req + shared bucket_c_cell_routes）

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 5 — 全量回归 + grep 清零

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 6 — docs + runlog

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 7 — Merge 三分支到 dev

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

## Docs Updated

- [ ] `docs/ssot/host_ctx_api.md` §7 — 0325c owner_materializer + legacy forward 全 V1N 化
- [ ] `docs/ITERATIONS.md` — 0325c Completed
