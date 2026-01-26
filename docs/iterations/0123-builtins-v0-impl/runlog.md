# Iteration 0123-builtins-v0-impl Run Log

规则：只记事实（FACTS）。不要写计划、不要写愿景。每个 Step 只有 PASS 才算完成。

## Environment
- OS: macOS (darwin)
- Node/Python versions: node v23.11.0, Python 3.12.7
- Key env flags: None
- Notes: Created minimal worker-base skeleton; docs-only + JS runtime.

---

## Phase0 Discovery Notes (Read-Only)
- SSOT 相关条款：
  - `docs/architecture_mantanet_and_workers.md`：0.2（模型驱动/执行在工人/总线解耦）、3（ModelTable/Cell）、4（Sliding UI 仅为投影）、5（控制总线）、8.2（脚本化验收）。
- Charter 相关条款：
  - `docs/charters/dongyu_app_next_runtime.md`：3.2/3.3/3.4（Cell 固定、built-in k 以 PICtest 行为为准、PIN_IN/OUT）、6.1（仅控制总线）、7.1/7.2（PICtest 为行为 Oracle）、9（禁止事项）。
- PICtest 行为证据来源：
  - `docs/iterations/0122-pictest-evidence/evidence.md`
  - `docs/iterations/0122-oracle-harness-plan/harness_plan.md`
  - `docs/ssot/modeltable_runtime_v0.md`
  - `docs/iterations/0123-builtins-v0/ledger.md`
  - `docs/iterations/0123-builtins-v0/validation_protocol.md`
- Out of Scope (per iteration): UI AST/Renderer、Matrix、Element Call/E2EE、打包。

---

## Step 1 — Implement MVP built-in keys
- Start time: 2026-01-23 10:19:00 +0800
- End time: 2026-01-23 10:19:00 +0800
- Branch: dev_0123-builtins-v0-impl
- Commits:
  - None
- Commands executed:
  - `mkdir -p packages/worker-base/src scripts`
  - `cat <<'EOF' > packages/worker-base/src/runtime.js ... EOF`
  - `cat <<'EOF' > packages/worker-base/src/index.js ... EOF`
  - `cat <<'EOF' > scripts/validate_builtins_v0.mjs ... EOF`
- Key outputs (snippets):
  - Created: `packages/worker-base/src/runtime.js`
  - Created: `packages/worker-base/src/index.js`
  - Created: `scripts/validate_builtins_v0.mjs`
- Result: PASS

**Public API (key)**
- `packages/worker-base/src/runtime.js`: `ModelTableRuntime`
  - `createModel({id,name,type})`
  - `getModel(id)`
  - `getCell(model,p,r,c)`
  - `addLabel(model,p,r,c,label)`
  - `rmLabel(model,p,r,c,key)`
  - `snapshot()`

---

## Step 2 — Validation PASS (per key)
- Start time: 2026-01-23 10:19:00 +0800
- End time: 2026-01-23 10:19:00 +0800
- Branch: dev_0123-builtins-v0-impl
- Commits:
  - None
- Commands executed:
  - `node scripts/validate_builtins_v0.mjs`
- Key outputs (snippets):
  - `VALIDATION RESULTS`
  - `local_mqtt: PASS`
  - `global_mqtt: PASS`
  - `model_type: PASS`
  - `data_type: PASS`
  - `v1n_id: PASS`
  - `CELL_CONNECT: PASS`
  - `MODEL_CONNECT: PASS`
  - `V1N_CONNECT: PASS`
  - `run_<func> (registered): PASS`
  - `run_<func> (missing): PASS`
- Result: PASS

**Validation output artifact**
- `docs/iterations/0123-builtins-v0-impl/validation_output.txt`
