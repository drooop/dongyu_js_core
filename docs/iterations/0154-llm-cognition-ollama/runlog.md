---
title: "0154 — Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0154-llm-cognition-ollama
id: 0154-llm-cognition-ollama
phase: phase3
---

# 0154 — Runlog

> Flight recorder. Commands, output, commits, PASS/FAIL.
> Do not edit [[iterations/0154-llm-cognition-ollama/plan]] or [[iterations/0154-llm-cognition-ollama/resolution]] from here; only append facts.

---

## Review Gate Record
- Iteration ID: 0154-llm-cognition-ollama
- Review Date: 2026-02-24
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: User instruction "Implement the plan." authorizes Phase 3 execution.

---

## Phase 3 Start

- Branch: `dev_0154-llm-cognition-ollama`
- Base: `dev_0153-cognition-feedback-loop`

## Execution Evidence

### Step A — LLM dispatch + lifecycle code path

Changed:
- `packages/ui-model-demo-server/server.mjs`
  - Added LLM config/prompt parsing helpers.
  - Added `ProgramModelEngine.llmInfer()` (Ollama `/api/generate`).
  - Added dispatch fallback: unresolved action -> LLM match -> routed action.
  - Added low-confidence guard (`code=low_confidence`, return candidates).
  - Added lifecycle fields: `llm_used`, `llm_model`, `llm_reasoning`.
  - Added optional response fields for `/ui_event`: `routed_by`, `confidence`, `candidates`.

Validation:

```bash
node --check packages/ui-model-demo-server/server.mjs
```

Result: PASS

### Step B — ModelTable config patches

Changed:
- `packages/worker-base/system-models/server_config.json`
  - Added `llm_dispatch_config` and `llm_scene_config` on Model 0.
- `packages/worker-base/system-models/llm_cognition_config.json` (new)
  - Added prompt templates and output schema labels on Model -10.

Validation:

```bash
jq -e . packages/worker-base/system-models/server_config.json
jq -e . packages/worker-base/system-models/llm_cognition_config.json
```

Result: PASS

### Step C — One-click scripts (0154)

Added:
- `scripts/ops/mock_ollama_server.mjs`
- `scripts/ops/start_local_ui_server_with_ollama.sh`
- `scripts/ops/verify_llm_dispatch_roundtrip.sh`
- `scripts/ops/run_0154_llm_dispatch_local.sh`

Validation:

```bash
bash -n scripts/ops/start_local_ui_server_with_ollama.sh \
  scripts/ops/verify_llm_dispatch_roundtrip.sh \
  scripts/ops/run_0154_llm_dispatch_local.sh
node --check scripts/ops/mock_ollama_server.mjs
```

Result: PASS

### Step D — End-to-end roundtrip (deterministic mock mode)

Command:

```bash
bash scripts/ops/run_0154_llm_dispatch_local.sh
```

Key output:
- case1 `result=ok`, `routed_by=rule`, `confidence=1`
- case2 `result=ok`, `routed_by=llm`, `confidence=0.93`
- case3 `result=error`, `code=low_confidence`, candidates returned
- case4 `result=error`, `code=unknown_action` (LLM dispatch disabled fallback)
- final line: `[run-0154] PASS`

Result: PASS

## Docs Updated

Updated:
- `scripts/ops/README.md` (added 0154 one-click command section)
- `README.md` (added 0154 one-click command entry)
- `docs/user-guide/llm_cognition_ollama_runbook.md` (new runbook in Obsidian vault)
- `docs/user-guide/README.md` (index link)

## Current Status

- 0154 implemented and verified in deterministic mock mode.
- Real Ollama mode command available:
  - `bash scripts/ops/run_0154_llm_dispatch_local.sh --real-ollama`

---

## Phase 4 — Completion (2026-03-01)

- Branch `dev_0154-llm-cognition-ollama` merged to `dev`.
- Commits:
  - `9ae6d0e feat: implement 0154 llm intent fallback with one-click ops`
- Verification mode: deterministic mock（`mock_ollama_server.mjs`），所有 case PASS。
- Real Ollama 路径可用（`--real-ollama`），本次迭代以 mock 模式交付，功能接口完整。
- ITERATIONS.md status: `In Progress → Completed`.
- Iteration closed.
