# Iteration 0128-ui-line-demo-frontend Resolution

## 0. Execution Rules
- Work branch: dev_0128-ui-line-demo-frontend
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Phase1 Gate (Auto-Approval) | Review plan/resolution (iteration already registered) | docs/iterations/0128-ui-line-demo-frontend/*, docs/ITERATIONS.md | (see Step 1) | 3 reviews Approved | Revise plan/resolution |
| 2 | Harden Stage 3.2 validation | Make jsdom strict (v0 cases only) | scripts/validate_ui_renderer_v0.mjs | `node scripts/validate_ui_renderer_v0.mjs --case render_minimal --env jsdom` | v0 cases PASS | Revert changes |
| 3 | Implement Stage 3.3 demo frontend | Add runnable demo + tests | packages/ui-model-demo-frontend/** | `npm -C packages/ui-model-demo-frontend install && npm -C packages/ui-model-demo-frontend run test && npm -C packages/ui-model-demo-frontend run build` | demo test/build PASS | Remove demo package |
| 4 | Update Roadmap/Iterations | Mark Stage 3.3 completed + notes | docs/roadmap/dongyu_app_next_runtime.md, docs/roadmaps/dongyu-app-next-runtime-elysia.md, docs/ITERATIONS.md, docs/iterations/0128-ui-line-demo-frontend/runlog.md | (see Step 4) | Stage 3.3 Completed | Revert doc updates |

## 2. Step Details

### Step 1 — Phase1 Gate (Auto-Approval)
**Goal**
- 在无人监管模式下完成 Phase2 Gate：按 `docs/WORKFLOW.md` 的 Auto-Approval Policy 完成 3 次独立审核并记录。

**Scope**
- Review plan/resolution（不改实现）。

**Files**
- Update:
  - `docs/iterations/0128-ui-line-demo-frontend/runlog.md`
- Must NOT touch:
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/charters/*`

**Validation (Executable)**
- Commands:
  - `node -e "const fs=require('node:fs');const it=fs.readFileSync('docs/ITERATIONS.md','utf8');if(!it.includes('| 0128-ui-line-demo-frontend |'))process.exit(1);if(!it.includes('| dev_0128-ui-line-demo-frontend |'))process.exit(1);if(!it.includes('| Planned | ./docs/iterations/0128-ui-line-demo-frontend/ |'))process.exit(1);"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/iterations/0128-ui-line-demo-frontend/runlog.md','utf8');const s=t.split('### Review Gate Records (FACTS)')[1]||'';const parts=s.split(/\n\s*Review Gate Record\n/).slice(1);const rows=[];for(const p of parts){const get=(k)=>{const m=p.match(new RegExp(k+'\\s*:\\s*([^\\n]+)'));return m?m[1].trim():''};const idx=Number(get('Review Index'));if(!Number.isFinite(idx))continue;rows.push({idx,iter:get('Iteration ID'),reviewer:get('Reviewer'),decision:get('Decision')});}rows.sort((a,b)=>a.idx-b.idx);if(rows.length<3)process.exit(1);const last=rows.slice(-3);const want=['@oracle','@momus','@oracle'];for(let i=0;i<3;i++){if(last[i].iter!=='0128-ui-line-demo-frontend')process.exit(1);if(last[i].decision!=='Approved')process.exit(1);if(last[i].reviewer!==want[i])process.exit(1);}"`
- Expected signals:
  - exit code 0
  - Phase1 major revision <= 3 (governed by docs/ssot/execution_governance_ultrawork_doit.md)

**Acceptance Criteria**
- Phase2 Gate 可审计且满足 Auto-Approval 条件。

**Rollback Strategy**
- 返回 Phase1 修改 plan/resolution。

---

### Step 2 — Harden Stage 3.2 validation
**Goal**
- 加固 Stage 3.2：当 `--env jsdom` 时禁止 fallback 到 stub；保持 v0 用例（render_minimal/event_write）继续 PASS。

**Scope**
- 更新验证脚本（不引入双总线、不引入执行语义）。

**Files**
- Update:
  - `scripts/validate_ui_renderer_v0.mjs`
- Must NOT touch:
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/charters/*`

**Validation (Executable)**
- Commands:
  - `node -e "import('jsdom').then(()=>process.exit(0)).catch(()=>process.exit(1))"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('scripts/validate_ui_renderer_v0.mjs','utf8');if(t.includes('jsdom_stub'))process.exit(1);"`
  - `node scripts/validate_ui_renderer_v0.mjs --case render_minimal --env jsdom`
  - `node scripts/validate_ui_renderer_v0.mjs --case event_write --env jsdom`
- Expected signals:
  - exit code 0
  - output contains `env: jsdom` (script-enforced; no stub)
  - all cases PASS

**Acceptance Criteria**
- 验证脚本在 jsdom 缺失时 FAIL（不可 stub PASS）。
- v0 用例（render_minimal/event_write）在 jsdom 环境下 PASS。

**Rollback Strategy**
- 还原本 Step 文件改动。

---

### Step 3 — Implement Stage 3.3 demo frontend
**Goal**
- 新增可运行 demo 前端，UI AST 从 ModelTable 的 `Cell(0,0,0).ui_ast_v0` 读取。
- UI 交互只写 `t="event"` 的 event label（写入 event mailbox）。
- 新增 UI AST v0.1 节点（Card/CodeBlock）并完成 renderer 映射与回归用例。

**Scope**
- 新增 demo 前端包与包内测试/构建脚本；扩展 renderer 与验证用例。

**Files**
- Create:
  - `packages/ui-model-demo-frontend/**`
  - `docs/iterations/0128-ui-line-demo-frontend/ui-ast-v0_1-extension.md`
- Update:
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/index.mjs`
  - `scripts/validate_ui_renderer_v0.mjs`
- Key files (minimum):
  - `packages/ui-model-demo-frontend/package.json`
  - `packages/ui-model-demo-frontend/vite.config.js`
  - `packages/ui-model-demo-frontend/index.html`
  - `packages/ui-model-demo-frontend/src/main.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js` (ModelTable snapshot store + host adapter)
  - `packages/ui-model-demo-frontend/src/demo_app.js` (loads ui_ast_v0 from Cell(0,0,0))
  - `packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
- Must NOT touch:
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/charters/*`

**Validation (Executable)**
- Commands:
  - `node scripts/validate_ui_renderer_v0.mjs --case all --env jsdom`
  - `npm -C packages/ui-model-demo-frontend install`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `test -f docs/iterations/0128-ui-line-demo-frontend/ui-ast-v0_1-extension.md`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/iterations/0128-ui-line-demo-frontend/ui-ast-v0_1-extension.md','utf8');if(!t.includes('Card')||!t.includes('CodeBlock'))process.exit(1);"`
- Expected signals:
  - exit code 0
  - test 输出包含：
    - `demo_ast_label_shape: PASS`（证明 `Cell(0,0,0).ui_ast_v0` 的 `t="json"` 且 `v` 为 JSON 对象）
    - `demo_ast_entry: PASS`（证明 AST 来自 `Cell(0,0,0).ui_ast_v0`，且替换该 label 会改变渲染结果）
    - `demo_event_mailbox: PASS`（证明交互写入精确目标：`p=0,r=0,c=1,k="ui_event",t="event"`）
    - `demo_render_smoke: PASS`（最小渲染树包含 Text/Input/Button，且 bind.read 生效）
    - `demo_event_envelope: PASS`（证明 `envelope.type === EventTarget.event_type` 且含 `event_id/source.node_id/source.node_type`）
    - `demo_no_non_event_write: PASS`（证明 UI 不写入任何非 `t="event"` label）
    - `demo_ast_diff: PASS`（替换 `ui_ast_v0` 后 renderTree 节点文本变化）
  - test runner 固化为：`node scripts/validate_demo.mjs`（由 `npm run test` 调用）
  - build 成功产物生成

**Acceptance Criteria**
- demo 能构建；测试以强断言证明：
  - UI AST 读取入口是 `Cell(0,0,0).ui_ast_v0`
  - UI 交互只写 event mailbox：`Cell(0,0,1).ui_event`
- UI AST v0.1 扩展（Card/CodeBlock）对应渲染与验证用例 PASS。

**Rollback Strategy**
- 删除 demo 包目录并回滚 commit。

---

### Step 4 — Update Roadmap/Iterations
**Goal**
- 记录事实并推进 Stage 3.3 状态；Stage 3.1/3.2 仅追加 Notes。

**Executor**
- This step is executed by: `$doit-auto` (status machine)

**Scope**
- 更新 `docs/ITERATIONS.md` 与 roadmap 文档。

**Files**
- Update:
  - `docs/ITERATIONS.md`
  - `docs/roadmap/dongyu_app_next_runtime.md`
  - `docs/roadmaps/dongyu-app-next-runtime-elysia.md`
  - `docs/iterations/0128-ui-line-demo-frontend/runlog.md`
- Must NOT touch:
  - `docs/architecture_mantanet_and_workers.md`

**Validation (Executable)**
- Commands:
  - `git diff --name-only`
  - `node -e "const {execSync}=require('node:child_process');const allowed=new Set(['docs/ITERATIONS.md','docs/roadmap/dongyu_app_next_runtime.md','docs/roadmaps/dongyu-app-next-runtime-elysia.md','docs/iterations/0128-ui-line-demo-frontend/runlog.md']);const out=execSync('git diff --name-only').toString().trim();if(!out){process.exit(1);}const files=out.split(/\n/).filter(Boolean);for(const f of files){if(!allowed.has(f))process.exit(1);}"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/roadmap/dongyu_app_next_runtime.md','utf8');const a=t.indexOf('## Stage 3.3');if(a<0)process.exit(1);const b=t.indexOf('# Phase 4',a);const s=t.slice(a,b>0?b:t.length);if(!s.includes('Status: COMPLETED'))process.exit(1);if(!s.includes('Iteration ID: 0128-ui-line-demo-frontend'))process.exit(1);"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/roadmaps/dongyu-app-next-runtime-elysia.md','utf8');if(!t.includes('0128-ui-line-demo-frontend'))process.exit(1);"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/roadmap/dongyu_app_next_runtime.md','utf8');const s1=t.split('## Stage 3.1')[1]||'';const s2=t.split('## Stage 3.2')[1]||'';if(!s1.includes('Status: COMPLETED'))process.exit(1);if(!s2.includes('Status: COMPLETED'))process.exit(1);if(!s1.includes('0128-ui-line-demo-frontend'))process.exit(1);if(!s2.includes('0128-ui-line-demo-frontend'))process.exit(1);"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/roadmap/dongyu_app_next_runtime.md','utf8');const a=t.indexOf('# Phase 4');if(a<0)process.exit(1);const s=t.slice(a);if(!s.includes('Status: PENDING'))process.exit(1);if(s.includes('0128-ui-line-demo-frontend'))process.exit(1);"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/roadmap/dongyu_app_next_runtime.md','utf8');const s1=t.split('## Stage 3.1')[1]||'';const s2=t.split('## Stage 3.2')[1]||'';if(!s1.includes('Iteration ID: 0123-ui-ast-spec'))process.exit(1);if(!s2.includes('Iteration ID: 0123-ui-renderer-impl'))process.exit(1);if(!s1.includes('Notes')||!s1.includes('0128-ui-line-demo-frontend'))process.exit(1);if(!s2.includes('Notes')||!s2.includes('0128-ui-line-demo-frontend'))process.exit(1);"`
- Expected signals:
  - Stage 3.3 标记为 Completed 且 Iteration ID 指向本迭代
  - Stage 3.1/3.2 仅追加 Notes

**Acceptance Criteria**
- Roadmap/Iterations 更新满足治理规则且可审计。

**Rollback Strategy**
- 回滚文档变更。

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
