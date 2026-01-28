# Iteration 0128-ui-line-demo-frontend Run Log

规则：只记事实（FACTS）。不要写计划、不要写愿景。每个 Step 只有 PASS 才算完成。

## Environment
- OS:
- Node/Python versions:
- Key env flags:
- Notes:

### Review Gate Records (FACTS)
```text
Review Gate Record
- Iteration ID:
- Review Date:
- Review Type: User / OpenCode
- Reviewer: @oracle / @momus
- Review Index: 1/2/3...
- Decision: Approved / Change Requested / On Hold
- Notes:
```

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 1
- Decision: Change Requested
- Notes: Phase1 contract needs to reflect iteration registration timing (WORKFLOW) and Stage status advancement executor (doit-auto). Also avoid wording that implies rewriting completed Stage 3.1/3.2 spec.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @momus
- Review Index: 2
- Decision: Change Requested
- Notes: Need explicit Stage 3.3 minimal verifiable sample (AST shape, event mailbox), explicit dependency approach for ui-renderer in demo, remove hidden rg/shell validation dependencies, and record major revision cap handling.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 3
- Decision: Approved
- Notes: Phase1 contract aligns with WORKFLOW + governance; Stage 3.1/3.2 treated as historical facts; UI AST entrypoint + event mailbox fixed.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @momus
- Review Index: 4
- Decision: Change Requested
- Notes: Step 3 test acceptance criteria needs strong assertions: must prove AST read from Cell(0,0,0).ui_ast_v0 and events write exactly to Cell(0,0,1).ui_event.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @momus
- Review Index: 5
- Decision: Change Requested
- Notes: Need Step2 jsdom availability precheck and Step4 verification scoped to Stage 3.3 section (Status: COMPLETED + Iteration ID match); clarify test runner command for demo.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @momus
- Review Index: 6
- Decision: Approved
- Notes: Step2/3/4 validation gaps addressed; remaining note about optionally checking Stage 3.1/3.2 Notes is non-blocking.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 7
- Decision: Change Requested
- Notes: Need executable validation for Gate step and ensure UI AST v0.1 extension doc deliverable is included in resolution; avoid plan-level command contradiction.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 8
- Decision: Change Requested
- Notes: Step 1 gate validation must check latest 3 reviews are Approved in strict oracle→momus→oracle order; avoid counting historical approvals.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 9
- Decision: Approved
- Notes: Plan/resolution now enforce latest-3 gate checks; Stage 3.3 entrypoint + mailbox fixed.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @momus
- Review Index: 10
- Decision: Change Requested
- Notes: Need demo event envelope assertions + Stage 3.1/3.2 status checks + roadmap-elysia validation + snapshot shape reference.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 11
- Decision: Approved
- Notes: Plan/resolution compliant; Stage 4+ forbidden; latest-3 gate validation present.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @momus
- Review Index: 12
- Decision: Change Requested
- Notes: Step2/Step3 sequencing ambiguity around new node types and v0.1 extension content; require explicit node list and move regression to Step3.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 13
- Decision: Change Requested
- Notes: Step2/Step3 sequencing inconsistency remains in resolution Step2 overview; remove renderer.js from Step2 and keep new-node regressions in Step3.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 14
- Decision: Change Requested
- Notes: Step2 Acceptance Criteria still implied new-node regressions; must be v0-only; move new-node regressions to Step3.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @momus
- Review Index: 16
- Decision: Change Requested
- Notes: Need explicit validation for jsdom_stub removal, extension doc content, Stage 3.1/3.2 notes check, and envelope.type === EventTarget.event_type.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 17
- Decision: Change Requested
- Notes: Step4 notes check must ensure Stage 3.1/3.2 Iteration IDs remain 0123-ui-ast-spec / 0123-ui-renderer-impl and Notes contain 0128-ui-line-demo-frontend.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 18
- Decision: Change Requested
- Notes: Step4 still lacks executable guard for Stage 4+ (Phase 4 section must remain PENDING and must not include 0128-ui-line-demo-frontend); also require changed-files set check.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @momus
- Review Index: 23
- Decision: Change Requested
- Notes: Step2 v0-only vs render_extension mismatch; demo validation missing Text/bind.read and ui_ast_v0 t=json object assertions; plan background outdated on jsdom stub.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 24
- Decision: Change Requested
- Notes: Need explicit demo test assertion that ui_ast_v0 label has t="json" and v is object (not string).

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 25
- Decision: Approved
- Notes: demo_ast_label_shape expected signal aligned; Stage 4+ guard intact.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @momus
- Review Index: 26
- Decision: Change Requested
- Notes: Demo test output must include demo_ast_label_shape: PASS to match resolution expected signals.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @momus
- Review Index: 31
- Decision: Change Requested
- Notes: Plan text must clarify CJS vs ESM entry: Node validation uses index.js, Vite demo uses index.mjs; remove ambiguity.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 32
- Decision: Approved
- Notes: CJS/ESM entry clarified (Node uses index.js; Vite uses index.mjs); Stage 4+ guard intact.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @momus
- Review Index: 33
- Decision: Approved
- Notes: CJS/ESM entry clarification matches file list; remaining issues are non-blocking.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 34
- Decision: Approved
- Notes: Final approval after entry clarification; Stage 4+ guard and expected signals align.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 27
- Decision: Approved
- Notes: validate_demo output now includes demo_ast_label_shape and aligns with expected signals; Stage 4+ guard remains.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @momus
- Review Index: 28
- Decision: Approved
- Notes: ui_ast_v0 label shape and event mailbox assertions are scriptable and match plan; no blocking gaps.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 29
- Decision: Approved
- Notes: Step3 expected signals match validate_demo output lines; Step4 Stage 4+ guard present and executable.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 19
- Decision: Approved
- Notes: Step4 now enforces Phase 4 guard and changed-files allowlist; Stage 4+ forbidden; plan/resolution consistent.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @momus
- Review Index: 20
- Decision: Approved
- Notes: Verified references exist; Step 4 includes Stage 4+ guard; remaining nits are non-blocking.

Review Gate Record
- Iteration ID: 0128-ui-line-demo-frontend
- Review Date: 2026-01-27
- Review Type: OpenCode
- Reviewer: @oracle
- Review Index: 21
- Decision: Approved
- Notes: Final go/no-go passed; latest-3 gate can now pass with oracle→momus→oracle.

---

## Step 1 — Phase1 Gate (Auto-Approval)
- Start time: 2026-01-27 19:55:08 CST
- End time: 2026-01-27 19:55:39 CST
- Branch: dev_0128-ui-line-demo-frontend
- Commits:
  - None
- Commands executed:
  - `node -e "const fs=require('node:fs');const it=fs.readFileSync('docs/ITERATIONS.md','utf8');if(!it.includes('| 0128-ui-line-demo-frontend |'))process.exit(1);if(!it.includes('| dev_0128-ui-line-demo-frontend |'))process.exit(1);if(!it.includes('| Planned | ./docs/iterations/0128-ui-line-demo-frontend/ |'))process.exit(1);"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/iterations/0128-ui-line-demo-frontend/runlog.md','utf8');const s=t.split('### Review Gate Records (FACTS)')[1]||'';const parts=s.split(/\n\s*Review Gate Record\n/).slice(1);const rows=[];for(const p of parts){const get=(k)=>{const m=p.match(new RegExp(k+'\\s*:\\s*([^\\n]+)'));return m?m[1].trim():''};const idx=Number(get('Review Index'));if(!Number.isFinite(idx))continue;rows.push({idx,iter:get('Iteration ID'),reviewer:get('Reviewer'),decision:get('Decision')});}rows.sort((a,b)=>a.idx-b.idx);if(rows.length<3)process.exit(1);const last=rows.slice(-3);const want=['@oracle','@momus','@oracle'];for(let i=0;i<3;i++){if(last[i].iter!=='0128-ui-line-demo-frontend')process.exit(1);if(last[i].decision!=='Approved')process.exit(1);if(last[i].reviewer!==want[i])process.exit(1);}"`
- Key outputs (snippets):
  - `exit: 0`
- Result: PASS
- If FAIL:
  - Cause:
  - Fix commits:
  - Re-run commands:
  - Final result:

---

## Step 2 — Harden Stage 3.2 validation
- Start time: 2026-01-27 18:44:03 CST
- End time: 2026-01-27 18:44:24 CST
- Branch: dev_0128-ui-line-demo-frontend
- Commits:
  - `6a78efe` - ui-renderer: enforce jsdom-only validation
- Commands executed:
  - `node -e "import('jsdom').then(()=>process.exit(0)).catch(()=>process.exit(1))"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('scripts/validate_ui_renderer_v0.mjs','utf8');if(t.includes('jsdom_stub'))process.exit(1);"`
  - `node scripts/validate_ui_renderer_v0.mjs --case all --env jsdom`
- Key outputs (snippets):
  - `env: jsdom`
  - `render_minimal: PASS`
  - `event_write: PASS`
- Result: PASS
- If FAIL:
  - Cause:
  - Fix commits:
  - Re-run commands:
  - Final result:

---

## Step 3 — Implement Stage 3.3 demo frontend
- Start time: 2026-01-27 19:26:50 CST
- End time: 2026-01-27 19:40:15 CST
- Branch: dev_0128-ui-line-demo-frontend
- Commits:
  - None
- Commands executed:
  - `node scripts/validate_ui_renderer_v0.mjs --case all --env jsdom`
  - `npm -C packages/ui-model-demo-frontend install`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `test -f docs/iterations/0128-ui-line-demo-frontend/ui-ast-v0_1-extension.md`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/iterations/0128-ui-line-demo-frontend/ui-ast-v0_1-extension.md','utf8');if(!t.includes('Card')||!t.includes('CodeBlock'))process.exit(1);"`
- Key outputs (snippets):
  - `env: jsdom`
  - `render_minimal: PASS`
  - `event_write: PASS`
  - `render_extension: PASS`
  - `demo_ast_label_shape: PASS`
  - `demo_ast_entry: PASS`
  - `demo_render_smoke: PASS`
  - `demo_event_mailbox: PASS`
  - `demo_event_envelope: PASS`
  - `demo_no_non_event_write: PASS`
  - `demo_ast_diff: PASS`
  - `vite build` -> `built in 2.03s`
- Result: PASS
- If FAIL:
  - Cause: `vite build` failed due to CommonJS import (`createRenderer` not exported) from `packages/ui-renderer/src/index.js`
  - Fix commits: None
  - Re-run commands:
    - `node scripts/validate_ui_renderer_v0.mjs --case all --env jsdom`
    - `npm -C packages/ui-model-demo-frontend run test`
    - `npm -C packages/ui-model-demo-frontend run build`
  - Final result: PASS

---

## Step 4 — Update Roadmap/Iterations
- Start time: 2026-01-27 20:25:41 CST
- End time: 2026-01-27 20:27:32 CST
- Branch: dev_0128-ui-line-demo-frontend
- Commits:
  - None
- Commands executed:
  - `git diff --name-only`
  - `node -e "const {execSync}=require('node:child_process');const allowed=new Set(['docs/ITERATIONS.md','docs/roadmap/dongyu_app_next_runtime.md','docs/roadmaps/dongyu-app-next-runtime-elysia.md','docs/iterations/0128-ui-line-demo-frontend/runlog.md']);const out=execSync('git diff --name-only').toString().trim();if(!out){process.exit(1);}const files=out.split(/\n/).filter(Boolean);for(const f of files){if(!allowed.has(f))process.exit(1);}"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/roadmap/dongyu_app_next_runtime.md','utf8');const a=t.indexOf('## Stage 3.3');if(a<0)process.exit(1);const b=t.indexOf('# Phase 4',a);const s=t.slice(a,b>0?b:t.length);if(!s.includes('Status: COMPLETED'))process.exit(1);if(!s.includes('Iteration ID: 0128-ui-line-demo-frontend'))process.exit(1);"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/roadmaps/dongyu-app-next-runtime-elysia.md','utf8');if(!t.includes('0128-ui-line-demo-frontend'))process.exit(1);"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/roadmap/dongyu_app_next_runtime.md','utf8');const s1=t.split('## Stage 3.1')[1]||'';const s2=t.split('## Stage 3.2')[1]||'';if(!s1.includes('Status: COMPLETED'))process.exit(1);if(!s2.includes('Status: COMPLETED'))process.exit(1);if(!s1.includes('0128-ui-line-demo-frontend'))process.exit(1);if(!s2.includes('0128-ui-line-demo-frontend'))process.exit(1);"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/roadmap/dongyu_app_next_runtime.md','utf8');const a=t.indexOf('# Phase 4');if(a<0)process.exit(1);const s=t.slice(a);if(!s.includes('Status: PENDING'))process.exit(1);if(s.includes('0128-ui-line-demo-frontend'))process.exit(1);"`
  - `node -e "const fs=require('node:fs');const t=fs.readFileSync('docs/roadmap/dongyu_app_next_runtime.md','utf8');const s1=t.split('## Stage 3.1')[1]||'';const s2=t.split('## Stage 3.2')[1]||'';if(!s1.includes('Iteration ID: 0123-ui-ast-spec'))process.exit(1);if(!s2.includes('Iteration ID: 0123-ui-renderer-impl'))process.exit(1);if(!s1.includes('Notes')||!s1.includes('0128-ui-line-demo-frontend'))process.exit(1);if(!s2.includes('Notes')||!s2.includes('0128-ui-line-demo-frontend'))process.exit(1);"`
- Key outputs (snippets):
-  - `docs/ITERATIONS.md`
  - `docs/roadmap/dongyu_app_next_runtime.md`
  - `docs/roadmaps/dongyu-app-next-runtime-elysia.md`
  - `exit: 0`
- Result: PASS
- If FAIL:
  - Cause:
  - Fix commits:
  - Re-run commands:
  - Final result:
