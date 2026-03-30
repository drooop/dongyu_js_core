---
title: "0154 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0154-llm-cognition-ollama
id: 0154-llm-cognition-ollama
phase: phase1
---

# 0154 — Resolution (HOW)

## 0. Execution Rules

- Work branch: `dev_0154-llm-cognition-ollama`
- Depends on: `0153-cognition-feedback-loop`
- Runtime constraint: do not modify `packages/worker-base/src/runtime.js|runtime.mjs`
- Verification style: deterministic PASS/FAIL

## 1. Steps Overview

| Step | Title | Scope | Key Files | Validation | Acceptance | Rollback |
|---|---|---|---|---|---|---|
| 1 | LLM config modelization | Add dispatch/scene config labels | `server_config.json`, `llm_cognition_config.json` | `jq -e` | labels loadable and typed | revert patch files |
| 2 | LLM inference capability | Add Ollama infer helper in server | `server.mjs` | `node --check` | `/api/generate` call path available | revert `server.mjs` |
| 3 | Dispatch fallback | unresolved action -> LLM match -> dispatch | `server.mjs` | one-click verify case1/2 | `routed_by=llm` path works | revert `server.mjs` |
| 4 | Low-confidence guard | confidence below threshold -> reject | `server.mjs` | one-click verify case3 | `code=low_confidence` + candidates | revert `server.mjs` |
| 5 | Degrade mode | LLM route disabled/unavailable fallback | `server.mjs` | one-click verify case4 | unknown action path preserved | revert `server.mjs` |
| 6 | Scene context enrich | LLM-assisted scene patch merge | `server.mjs` | snapshot check | scene merge is whitelist-only | revert `server.mjs` |
| 7 | Ops one-click commands | start/verify/run scripts + mock | `scripts/ops/*.sh`, `mock_ollama_server.mjs` | `bash -n`, `node --check`, one-click run | single command PASS | remove new scripts |
| 8 | Knowledge base sync | keep one-click docs in repo knowledge base | `scripts/ops/README.md`, `README.md`, `docs/user-guide/*` | `rg` checks | docs and commands consistent | revert docs changes |

## 2. Implementation Details

### 2.1 Dispatch path

1. Read `intent_dispatch_table` (Model -10).
2. If hit -> dispatch directly (`routed_by=rule`).
3. If miss and `llm_dispatch_config.enabled=true` and provider is `ollama`:
   - Build prompt from `llm_intent_prompt_template`.
   - POST to `base_url + /api/generate`.
   - Parse JSON output (`matched_action`, `confidence`, `candidates`).
   - If `confidence >= confidence_threshold` and action registered -> dispatch mapped action.
   - Else -> write `ui_event_error(code=low_confidence)` and return candidates.
4. If LLM route not taken -> keep legacy fallback behavior (`unknown_action` path unchanged).

### 2.2 Lifecycle contract

`action_lifecycle` fields:
- existing: `op_id`, `action`, `status`, `started_at`, `completed_at`, `result`, `confidence`
- added: `llm_used`, `llm_model`, `llm_reasoning`

Rules:
- rule path: `llm_used=false`, `confidence=1`
- llm path: `llm_used=true`, `confidence=llm confidence`

### 2.3 Scene enrich

- Trigger only when dispatch used LLM (`llm_used=true`).
- Prompt source: `llm_scene_prompt_template`.
- Merge only whitelist fields:
  - `current_app`
  - `active_flow`
  - `flow_step`
  - `session_vars_patch` (shallow merge into `session_vars`)

## 3. Verification Commands

```bash
node --check packages/ui-model-demo-server/server.mjs
jq -e . packages/worker-base/system-models/server_config.json
jq -e . packages/worker-base/system-models/llm_cognition_config.json

bash -n scripts/ops/start_local_ui_server_with_ollama.sh \
  scripts/ops/verify_llm_dispatch_roundtrip.sh \
  scripts/ops/run_0154_llm_dispatch_local.sh
node --check scripts/ops/mock_ollama_server.mjs

bash scripts/ops/run_0154_llm_dispatch_local.sh
```

PASS criteria (last command):
1. case1 `routed_by=rule`
2. case2 `routed_by=llm`
3. case3 `code=low_confidence`
4. case4 `code=unknown_action`

## 4. Rollback

1. Revert server changes in `packages/ui-model-demo-server/server.mjs`.
2. Remove `packages/worker-base/system-models/llm_cognition_config.json`.
3. Revert `packages/worker-base/system-models/server_config.json` new LLM labels.
4. Remove new ops scripts and doc entries.
5. Re-run baseline deterministic checks from previous iteration.
