# Iteration 0129-modeltable-editor-v0 Resolution

## 0. Execution Rules
- Work branch: dev_0129-modeltable-editor-v0
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).
- Step 1 is Phase 2 Review Gate; Phase 3 execution starts at Step 2 after Approved.

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Phase2 Review Gate (User or Auto-Approval) | Review plan/resolution | docs/iterations/0129-modeltable-editor-v0/*, docs/ITERATIONS.md | (see Step 1) | Gate Approved | Revise plan/resolution |
| 2 | AST v0.x Extension + Schema | Editor node spec + validation | docs/iterations/0129-modeltable-editor-v0/ui-ast-v0_x-extension.md, scripts/validate_ui_ast_v0x.mjs, scripts/fixtures/ui_ast_v0x/** | `node scripts/validate_ui_ast_v0x.mjs --case all` | schema PASS + negative cases rejected | Revert Step 2 |
| 3 | Renderer Mapping + Regression | Element Plus mapping + jsdom cases | packages/ui-renderer/**, scripts/validate_ui_renderer_v0.mjs | `node scripts/validate_ui_renderer_v0.mjs --case editor --env jsdom` | editor cases PASS (jsdom required) | Revert Step 3 |
| 4 | Demo UI + LocalBusAdapter | CRUD + submodel create via event | packages/ui-model-demo-frontend/** | `npm -C packages/ui-model-demo-frontend run test` | event-only + CRUD/submodel PASS | Revert Step 4 |
| 5 | Update Iteration Records + Guard | Iterations/roadmap notes + Stage4 guard | docs/ITERATIONS.md, docs/roadmap/dongyu_app_next_runtime.md, docs/iterations/0129-modeltable-editor-v0/runlog.md, scripts/validate_iteration_guard.mjs | (see Step 5) | Stage4+ guard PASS | Revert docs |

## 2. Step Details

### Step 1 — Phase2 Review Gate (User or Auto-Approval)
**Goal**
- 完成 Phase2 Review Gate（User 或 Auto-Approval policy）并记录。

**Scope**
- Review plan/resolution（不改实现）。

**Files**
- Update:
  - `docs/iterations/0129-modeltable-editor-v0/runlog.md`
  - `docs/ITERATIONS.md`
- Must NOT touch:
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/charters/*`

**Validation (Executable)**
- Commands:
  - `node -e "const fs=require('node:fs');const lines=fs.readFileSync('docs/ITERATIONS.md','utf8').split(/\n/);const row=lines.find(l=>/^\|\s*0129-modeltable-editor-v0\s*\|/.test(l));if(!row)process.exit(1);const cols=row.split('|').slice(1,-1).map(s=>s.trim());if(cols.length<7)process.exit(1);const [id,date,theme,steps,branch,status,entry]=cols;if(!id||!date||!theme||!steps||!branch||!status||!entry)process.exit(1);if(id!=='0129-modeltable-editor-v0')process.exit(1);if(branch!=='dev_0129-modeltable-editor-v0')process.exit(1);if(status!=='Approved')process.exit(1);if(entry!=='./docs/iterations/0129-modeltable-editor-v0/')process.exit(1);"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/iterations/0129-modeltable-editor-v0/runlog.md','utf8');const s=t.split('### Review Gate Records (FACTS)')[1]||'';if(!/Review Gate Record/.test(s))process.exit(1);const parts=s.split(/\n\s*Review Gate Record\n/).slice(1);const rows=[];for(const p of parts){const get=(k)=>{const m=p.match(new RegExp(k+'\\s*:\\s*([^\\n]+)'));return m?m[1].trim():''};const idx=Number(get('Review Index'));const iter=get('Iteration ID');const reviewer=get('Reviewer');const decision=get('Decision');const type=get('Review Type');if(!Number.isFinite(idx)||idx<1)continue;if(!iter||!reviewer||!decision||!type)continue;rows.push({idx,iter,reviewer,decision,type});}rows.sort((a,b)=>a.idx-b.idx);const userApproved=rows.some(r=>r.iter==='0129-modeltable-editor-v0'&&r.type==='User'&&r.decision==='Approved'&&r.reviewer==='User');const autoApproved=(()=>{if(rows.length<3)return false;const last=rows.slice(-3);const want=['@oracle','@momus','@oracle'];for(let i=0;i<3;i++){if(last[i].iter!=='0129-modeltable-editor-v0')return false;if(last[i].decision!=='Approved')return false;if(last[i].reviewer!==want[i])return false;if(last[i].type!=='OpenCode')return false;}return true;})();if(!(userApproved||autoApproved))process.exit(1);"`
- Expected signals:
  - exit code 0

**Acceptance Criteria**
- Review Gate 可审计且满足其一：
  - User Approved：存在 Review Type=User 且 Decision=Approved 的记录；或
  - Auto-Approval：最近 3 条记录为 `@oracle/@momus/@oracle` 且 Decision 全为 Approved。
- Gate 通过后将 `docs/ITERATIONS.md` 状态更新为 Approved。

**Rollback Strategy**
- 返回 Phase1 修改 plan/resolution。

---

### Step 2 — AST v0.x Extension + Schema
**Goal**
- 定义 editor 所需 AST 扩展与“不可执行”约束，并提供脚本化校验。

**Scope**
- 新增 UI AST v0.x 扩展文档（仅 editor 使用）。
- 增加 AST 校验脚本与 fixtures（不引入新依赖）。

**Files**
- Create/Update:
  - `docs/iterations/0129-modeltable-editor-v0/ui-ast-v0_x-extension.md`
  - `scripts/validate_ui_ast_v0x.mjs`
  - `scripts/fixtures/ui_ast_v0x/positive/*.json`
  - `scripts/fixtures/ui_ast_v0x/negative/*.json`
- Must NOT touch:
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/charters/*`

**Validation (Executable)**
- Commands:
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
- Expected signals:
  - `case:<name>: PASS (accepted)` for positive fixtures
  - `case:<name>: PASS (rejected)` for negative fixtures
  - `summary: PASS`
  - exit code 0

**Acceptance Criteria**
- AST 扩展节点列表、字段约束与样例完整；可执行字段被拒绝。

**SSOT/Charter Violation Checks**
- 不触碰 SSOT/Charter 文件。
- 不引入新 built-in 语义。

**Rollback Strategy**
- Revert Step 2 changes.

---

### Step 3 — Renderer Mapping + Regression
**Goal**
- 补齐 editor 节点的 renderer 映射与 jsdom 回归验证。

**Scope**
- renderer.js / renderer.mjs 增加节点映射。
- validate_ui_renderer_v0.mjs 增加 editor cases。
- jsdom 作为 DoD 环境要求，缺失则该步骤 FAIL（只允许本地 smoke）。

**Files**
- Update:
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `scripts/validate_ui_renderer_v0.mjs`
- Must NOT touch:
  - `packages/bus-adapters/**`
  - `packages/worker-base/src/mqtt*` (禁止双总线引入)

**Validation (Executable)**
- Commands:
  - `node -e "try{require('jsdom');console.log('jsdom:yes');}catch(e){console.log('jsdom:no');process.exit(1)}"`
  - `node scripts/validate_ui_renderer_v0.mjs --case editor --env jsdom`
- Expected signals:
  - `jsdom:yes`
  - `editor_table_render: PASS`
  - `editor_tree_render: PASS`
  - `editor_form_render: PASS`
  - `editor_event_mailbox_only: PASS`
  - `editor_snapshot_hash: PASS`
  - `env: jsdom`
  - exit code 0

**Acceptance Criteria**
- editor 节点渲染与事件绑定符合扩展文档。

**SSOT/Charter Violation Checks**
- 禁止导入 MQTT/Matrix/Bus Adapter。
- UI 事件仅写 mailbox。

**Rollback Strategy**
- Revert Step 3 changes.

---

### Step 4 — Demo UI + LocalBusAdapter
**Goal**
- 实现 ModelTable 编辑界面与本地事件闭环（CRUD + submodel create）。

**Scope**
- demo UI AST 与 LocalBusAdapter（事件消费者）。
- 测试：event-only + CRUD/submodel create + no state bypass + forbidden k/t/coords reject。

**Files**
- Update/Create:
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - `packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
- Must NOT touch:
  - `packages/bus-adapters/**`
  - `packages/worker-base/src/mqtt*`

**Validation (Executable)**
- Commands:
  - `npm -C packages/ui-model-demo-frontend run test`
- Expected signals:
  - `editor_event_only: PASS`
  - `editor_cell_crud: PASS`
  - `editor_submodel_create: PASS`
  - `editor_no_state_bypass: PASS`
  - `editor_event_consumed_once: PASS`
  - `editor_forbidden_k_reject: PASS` (covers run_*, CONNECT_*, *_CONNECT, pin_in/out, v1n_id, data_type, mqtt_*, matrix_*)
  - `editor_forbidden_t_reject: PASS` (label_add/label_update value.t not in allowlist)
  - `editor_reserved_model_reject: PASS` (target.model_id in {0,99} => reserved_cell)
  - `editor_event_payload_shape: PASS`
  - `editor_reserved_cell_reject: PASS`
  - `editor_error_priority: PASS` (covers op_id_replay vs unknown_action, unknown_action vs invalid_target, invalid_target vs reserved_cell, reserved_cell vs forbidden_k, forbidden_k vs forbidden_t, reserved_cell vs forbidden_t, invalid_target vs forbidden_t)
  - `editor_invalid_target_missing_op_id: PASS`
  - `editor_invalid_target_non_string_op_id: PASS`
  - `editor_invalid_target_missing_target: PASS` (label_* / cell_clear)
  - `editor_invalid_target_missing_target_coords: PASS`
  - `editor_invalid_target_missing_target_k: PASS` (label_* only)
  - `editor_invalid_target_missing_value: PASS` (label_add/label_update/submodel_create)
  - `editor_invalid_target_non_string_value_t: PASS`
  - `editor_error_priority_invalid_target_vs_forbidden_k: PASS`
  - `editor_error_op_id_empty_on_missing_op_id: PASS`
  - `editor_error_op_id_empty_on_non_string_op_id: PASS`
  - `editor_invalid_target_over_unknown_action: PASS` (missing op_id + unknown_action)
  - `editor_submodel_create_target_ignored: PASS` (target ignored; no reserved/forbidden validation)
  - `editor_submodel_create_invalid_target: PASS` (duplicate id or invalid name/type -> invalid_target)
  - `editor_submodel_create_duplicate_id_invalid_target: PASS` (duplicate id pre-check)
  - `editor_submodel_create_value_t_invalid_target: PASS` (value.t != json -> invalid_target)
  - `editor_value_ignored_does_not_affect_priority: PASS` (payload.value ignored for label_remove/cell_clear)
  - exit code 0

**Acceptance Criteria**
- UI 仅写 event mailbox；LocalBusAdapter 通过 ModelTableRuntime 完成 CRUD 与 submodel create；UI 视图变化来源于 ModelTable snapshot；满足 Contract。

**SSOT/Charter Violation Checks**
- 禁止写入 forbidden k/t/coords（见 Contract）。
- LocalBusAdapter 不触发总线/网络副作用。

**Rollback Strategy**
- Revert Step 4 changes.

---

### Step 5 — Update Iteration Records + Guard
**Goal**
- 记录迭代状态并设置 Stage4+ guard。

**Scope**
- 更新 Iterations 与 Roadmap Notes（仅追加）。
- 执行仓库 guard 脚本：禁止路径/关键字/导入。

**Files**
- Update/Create:
  - `docs/ITERATIONS.md`
  - `docs/roadmap/dongyu_app_next_runtime.md`
  - `docs/iterations/0129-modeltable-editor-v0/runlog.md`
  - `scripts/validate_iteration_guard.mjs`
- Must NOT touch:
  - `docs/architecture_mantanet_and_workers.md`

**Validation (Executable)**
- Commands:
  - `git status --porcelain` (evidence-only)
  - `git diff --name-only --cached` (evidence-only)
  - `git diff --name-only` (evidence-only)
  - `node scripts/validate_iteration_guard.mjs --case stage4`
  - `node scripts/validate_iteration_guard.mjs --case forbidden_imports`
  - `node scripts/validate_iteration_guard.mjs --case step5_changed_files`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/roadmap/dongyu_app_next_runtime.md','utf8');const a=t.indexOf('# Phase 4');if(a<0)process.exit(1);const s=t.slice(a);if(s.includes('0129-modeltable-editor-v0'))process.exit(1);"`
- Expected signals:
  - working tree contains only allowed files for Step5 (scripted)
  - Stage4+ remains PENDING and does not mention this iteration
  - exit code 0

**Acceptance Criteria**
- Iteration records updated; Stage4+ guard passes (gating commands exit 0).

**SSOT/Charter Violation Checks**
- Stage4+ remains PENDING and does not mention this iteration.

**Rollback Strategy**
- Revert Step 5 changes.

---

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。

## 3. Contract Reference
- `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`
