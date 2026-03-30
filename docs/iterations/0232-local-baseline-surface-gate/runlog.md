---
title: "0232 — local-baseline-surface-gate Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-03-25
source: ai
iteration_id: 0232-local-baseline-surface-gate
id: 0232-local-baseline-surface-gate
phase: phase4
---

# 0232 — local-baseline-surface-gate Runlog

## Environment

- Date: 2026-03-25
- Branch: `dropx/dev_0232-local-baseline-surface-gate`
- Runtime: local cluster baseline gate hardening

## Execution Records

- Final verdict: `Local baseline surface gate hardened`
- Environment verdict after canonical repair: `blocked by matrix_debug_page_asset=missing`
- Summary:
  - 新增 local surface gate contract test，并完成 red -> green：
    - `node scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`
  - 保持旧 baseline matrix contract 兼容：
    - `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
  - `check_runtime_baseline.sh` 现在会同时检查：
    - deployment / secret readiness
    - live `/snapshot`
    - Home / Matrix / Gallery / `ws_apps_registry` surface 对齐
  - `ensure_runtime_baseline.sh` 不再在 repair 后直接输出 `READY`
    - 它现在会在 `deploy_local.sh` 之后重跑新的 canonical gate
    - 若 surface 仍未对齐则返回非零退出码

### Execution Evidence

- Contract / syntax verification:
  - `node scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`
  - `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
  - `bash -n scripts/ops/check_runtime_baseline.sh`
  - `bash -n scripts/ops/ensure_runtime_baseline.sh`
- Pre-repair gate result:
  - old environment now correctly fails with:
    - `home_page_asset=missing`
    - `matrix_debug_page_asset=missing`
    - `gallery_page_asset=missing`
    - `gallery_showcase_tab=missing`
    - `ws_apps_registry_missing=1003`
    - `ws_apps_registry_missing=1004`
    - `ws_apps_registry_missing=1005`
    - `ws_apps_registry_missing=1007`
- Canonical repair path:
  - `bash scripts/ops/ensure_runtime_baseline.sh`
  - real `deploy_local.sh` executed
  - images rebuilt and deployments restarted
- Post-repair gate result:
  - deployment / secret readiness PASS
  - `home_asset = root_home`
  - `gallery_asset_present = true`
  - `gallery_tab = matrix`
  - `ws_registry_model_ids` now include `1003/1004/1005/1007`
  - remaining blocker:
    - `matrix_debug_page_asset=missing`

### Adjudication

- `0232` 的目标不是修复所有 local environment drift，而是让 canonical local gate 不再把 stale surface 误判为 ready。
- 该目标已经达到：
  - pre-repair stale 环境被 deterministic FAIL
  - repair 后 gate 继续盯住 live `/snapshot`
  - 因 `matrix_debug_page_asset=missing`，新 gate 拒绝假绿
- 因此本 iteration 的合法终态是：
  - `Local baseline surface gate hardened`
  - 当前环境仍 blocked：`matrix_debug_page_asset=missing`

## Reference Inputs

- `0222-local-cluster-rollout-baseline`: deployment/secret readiness gate
- `0223-local-cluster-browser-evidence`: browser proved `Local environment not effective`
- `0229-local-ops-bridge-smoke`: local ops bridge proven

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] `docs/iterations/0222-local-cluster-rollout-baseline/runlog.md` reviewed
- [x] `docs/iterations/0223-local-cluster-browser-evidence/runlog.md` reviewed
- [x] `docs/iterations/0229-local-ops-bridge-smoke/runlog.md` reviewed

```
Review Gate Record
- Iteration ID: 0232-local-baseline-surface-gate
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: # Review Plan: Iteration 0232
```

```
Review Gate Record
- Iteration ID: 0232-local-baseline-surface-gate
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 2
- Decision: APPROVED
- Revision Type: N/A
- Notes: # Review: Iteration 0232 — local-baseline-surface-gate
```

```
Review Gate Record
- Iteration ID: 0232-local-baseline-surface-gate
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 4
- Decision: On Hold
- Revision Type: N/A
- Notes: parse_failure: Could not parse verdict from review output

Review history:
  - Round 1 (REVIEW_PLAN): APPROVED [n/a]
  - Round 2 (REVIEW_PLAN): APPROVED [n/a]
```

```
Review Gate Record
- Iteration ID: 0232-local-baseline-surface-gate
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 3
- Decision: APPROVED
- Revision Type: N/A
- Notes: Manual planning acceptance after parse false negative: rewritten 0232 plan.md and resolution.md are self-contained, scoped to local baseline surface gate only, and align with 0222/0223/0229 evidence.
```

```
Review Gate Record
- Iteration ID: 0232-local-baseline-surface-gate
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: Manual execution acceptance: 0232 hardened the canonical local baseline gate. New gate fails on known stale surfaces, ensure_runtime_baseline now re-runs the gate after repair, and post-repair local environment remains correctly blocked by matrix_debug_page_asset=missing instead of false green.
```
