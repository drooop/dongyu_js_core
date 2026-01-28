# Iteration 0130-modeltable-editor-v1 Resolution

## 0. Execution Rules
- Work branch: dev_0130-modeltable-editor-v1
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

Preflight (must be PASS before Step 1; no commits):

- Iteration registration exists in `docs/ITERATIONS.md`.
- Intended branch exists / is checked out: `dev_0130-modeltable-editor-v1`.

Executable check (example):

- `node -e "const fs=require('fs'); const ok=/\\| 0130-modeltable-editor-v1 \\|/.test(fs.readFileSync('docs/ITERATIONS.md','utf8')); console.log(ok?'PASS: iterations_index':'FAIL: iterations_index'); process.exit(ok?0:1)"`

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | UI AST v0.x extensions for editor v1 | Add required node specs + fixtures + validator coverage | `scripts/validate_ui_ast_v0x.mjs`, `scripts/fixtures/ui_ast_v0x/**`, `docs/iterations/0130-modeltable-editor-v1/*` | `node scripts/validate_ui_ast_v0x.mjs --case all` | New nodes validated; negative cases cover forbidden fields; deterministic output | Revert Step 1 commit |
| 2 | ui-renderer support for new nodes | Map new node types to Element Plus/Vue render | `packages/ui-renderer/src/renderer.*`, `scripts/validate_ui_renderer_v0.mjs` | `node scripts/validate_ui_renderer_v0.mjs --case editor --env jsdom` | jsdom renderer PASS; no new runtime/bus imports | Revert Step 2 commit |
| 3 | Demo editor v1 UI model + typed normalization | Build editor v1 UI + v1 consumer behavior while preserving v0 tests | `packages/ui-model-demo-frontend/src/**`, `packages/ui-model-demo-frontend/scripts/**`, `docs/iterations/0130-modeltable-editor-v1/contract_typed_values.md` | `npm -C packages/ui-model-demo-frontend run test` | Core flows script-verified: create/select model, CRUD, errors visible, no state bypass; v0 tests remain PASS | Revert Step 3 commit |
| 4 | Build + guards | Ensure build + forbidden import/stage scope guards PASS | `packages/ui-model-demo-frontend/**`, `scripts/validate_iteration_guard.mjs` | `npm -C packages/ui-model-demo-frontend run build` + `node scripts/validate_iteration_guard.mjs --case forbidden_imports` + `node scripts/validate_iteration_guard.mjs --case stage4` | All commands PASS | Revert Step 4 commit |

## 2. Step Details

### Step 1 — UI AST v0.x extensions for editor v1

**Goal**
- 让 editor v1 所需的 UI 组件可以被 UI AST 表达，并且可被脚本校验。

**Scope**
- 扩展 UI AST v0.x 的 schema/validator 与 fixtures（正例/反例）。
- 明确每个新增 node 的 props/bind 允许字段；禁止可执行字段。

Minimum required new node types for this iteration:
- `TableColumn`
- `Select`
- `NumberInput`
- `Switch`

**Files**
- Create/Update:
  - `scripts/validate_ui_ast_v0x.mjs`
  - `scripts/fixtures/ui_ast_v0x/positive/*`
  - `scripts/fixtures/ui_ast_v0x/negative/*`
  - `docs/iterations/0130-modeltable-editor-v1/runlog.md`
  - `docs/iterations/0130-modeltable-editor-v1/contract_typed_values.md`
- Must NOT touch:
  - `docs/architecture_mantanet_and_workers.md`

**Validation (Executable)**
- Commands:
  - `node scripts/validate_ui_ast_v0x.mjs --case all`

**Acceptance Criteria**
- 新增节点在 fixtures 中覆盖，并且 negative fixtures 能证明“不可执行”。

**Rollback Strategy**
- Revert Step 1 commit.

---

### Step 2 — ui-renderer support for new nodes

**Goal**
- renderer 支持新增节点，并保持 editor mailbox 约束不变。

**Scope**
- 在 `packages/ui-renderer/src/renderer.*` 增加 node → Element Plus 映射。
- 更新 renderer 验证脚本（仅当需要扩用例）。

**Files**
- Create/Update:
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `scripts/validate_ui_renderer_v0.mjs`
- Must NOT touch:
  - `packages/worker-base/**`（除非 renderer 测试需要纯类型/纯数据引用；默认禁止）

**Validation (Executable)**
- Commands:
  - `node scripts/validate_ui_renderer_v0.mjs --case editor --env jsdom`

**Acceptance Criteria**
- editor renderer jsdom 用例全部 PASS。

**Rollback Strategy**
- Revert Step 2 commit.

---

### Step 3 — Demo editor v1 UI model

**Goal**
- demo 前端实现“可操作的编辑器 v1”，并且行为完全由脚本验收。
- 支持 typed value 编辑的最小归一化，并保持 editor v0 contract 不被回写修改。

**Scope**
- UI AST：加入 model selector / cell+label editor / error panels。
- 交互：保持 UI 只写 mailbox event；消费后 snapshot 驱动 UI 更新。
- UX guard：目标 model 不存在时，控件必须禁用或提示（可脚本验收）。
- Typed normalization：按 `docs/iterations/0130-modeltable-editor-v1/contract_typed_values.md` 实现 v1 行为；如会影响 v0 用例，必须版本化 adapter 并保持 v0 用例 PASS。

**Files**
- Create/Update:
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - `packages/ui-model-demo-frontend/scripts/validate_editor.mjs` (extend cases)
- Must NOT touch:
  - `packages/bus-adapters/**`
  - Any MQTT/Matrix code paths

**Validation (Executable)**
- Commands:
  - `npm -C packages/ui-model-demo-frontend run test`

**Acceptance Criteria**
- 必须新增并通过（固定 PASS 文本）的最小用例集合（按 `validate_editor.mjs` 风格输出）：
  - `editor_v1_controls_disabled_before_model: PASS`
  - `editor_v1_model_selector_excludes_reserved: PASS`
  - `editor_v1_typed_int_ok: PASS`
  - `editor_v1_typed_int_invalid_int: PASS`
  - `editor_v1_typed_bool_ok: PASS`
  - `editor_v1_typed_bool_invalid_bool: PASS`
  - `editor_v1_typed_json_ok: PASS`
  - `editor_v1_typed_json_invalid_json: PASS`
  - `editor_v1_typed_value_error_priority_preserved: PASS`
  - `editor_v1_v0_suite_still_passes: PASS` (or equivalent coverage proof)

**Rollback Strategy**
- Revert Step 3 commit.

---

### Step 4 — Build + smoke validation

**Goal**
- 确保产物可构建，避免只在 dev server 下可用。

**Scope**
- `vite build` 通过；chunk size warning 可接受但不得变成 error。

**Files**
- Update: (as needed)
  - `packages/ui-model-demo-frontend/**`

**Validation (Executable)**
- Commands:
  - `npm -C packages/ui-model-demo-frontend run build`
  - `node scripts/validate_iteration_guard.mjs --case forbidden_imports`
  - `node scripts/validate_iteration_guard.mjs --case stage4`
  - `node -e "const {execSync}=require('child_process'); const bases=['dev','main','master','origin/dev','origin/main','origin/master']; let base=null; for (const b of bases){ try { base=execSync('git merge-base HEAD '+b,{stdio:['ignore','pipe','ignore']}).toString().trim(); if(base) break; } catch(_) {} } if(!base){ console.error('FAIL: merge_base_not_found'); process.exit(1); } const out=execSync('git diff --name-only '+base+'..HEAD -- docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md',{stdio:['ignore','pipe','ignore']}).toString().trim(); if(out){ console.error('FAIL: mailbox_contract_changed'); console.error(out); process.exit(1); } console.log('PASS: mailbox_contract_unchanged');"`

**Acceptance Criteria**
- build PASS。

**Rollback Strategy**
- Revert Step 4 commit.

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
