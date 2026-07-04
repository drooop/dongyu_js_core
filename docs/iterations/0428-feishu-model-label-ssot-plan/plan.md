---
title: "Iteration 0428 Feishu Model Label SSOT Plan"
doc_type: iteration-plan
status: completed
updated: 2026-07-01
source: ai
iteration_id: 0428-feishu-model-label-ssot-plan
id: 0428-feishu-model-label-ssot-plan
phase: completed
---

# Iteration 0428-feishu-model-label-ssot-plan Plan

## Goal

Freeze the SSOT alignment plan for the updated Feishu `model: 模型标签`
document, especially model/table naming, child model table boundaries, and
Temporary ModelTable parameter passing without nested JSON patch payloads.

## Scope

- In scope:
- Read and record the relevant Feishu source facts from:
  - `https://bob3y2gxxp.feishu.cn/wiki/LGsZwaXMRiHqOXkB2qocbyfwnKh`
  - `https://bob3y2gxxp.feishu.cn/wiki/JYNWwQOOjiWcOLktv07cBvIVnOh`
  - `https://bob3y2gxxp.feishu.cn/wiki/WBZjwY3DSil6pAkQ8DZcpsrWnUf`
- Freeze repo-local naming decisions for:
  - `model.table`
  - `model.subtable`
  - `model.submt`
  - rejected `model.v1n`
  - rejected `model.subtableconnection`
  - rejected `model.submtconnection`
- Record that `pin.connect.model` remains abandoned and must not be restored.
- Freeze the target rule that formal bus/pin parameters are Temporary
  ModelTable messages and must not contain nested ModelTable JSON patches.
- Produce a follow-up implementation plan with staged SSOT, runtime, fill-table,
  and browser E2E work.
- Out of scope:
- No runtime code edits.
- No fill-table patch edits.
- No local or remote deployment.
- No browser E2E execution.
- No compatibility alias design.

## Invariants / Constraints

- `CLAUDE.md` remains the highest repo-local execution constraint.
- UI is projection only; ModelTable remains the truth source.
- All side effects must still go through `add_label` / `rm_label`.
- `pin.connect.model` is removed and must not be accepted as current input.
- Formal business pin/bus values must be ModelTable-like record arrays.
- Persistence is explicit materialization; transport alone does not create
  formal labels.
- Durable App instance traffic must use table-qualified references:
  `ModelRef = { table_id, model_id }`.
- No compatibility code or compatibility aliases are allowed by default.

## Success Criteria

- `docs/ssot/feishu_model_label_alignment_v1.md` exists and clearly states the
  0428 target naming and payload decisions.
- `docs/ITERATIONS.md` registers `0428-feishu-model-label-ssot-plan`.
- `resolution.md` lists implementation phases but keeps this iteration
  docs-only.
- `runlog.md` records the actual Feishu read command, branch, files changed,
  and verification commands.
- A sub-agent review checks the docs-only plan for contradictions with current
  SSOT and confirms whether changes are needed before implementation.

## Inputs

- Created at: 2026-06-24
- Iteration ID: 0428-feishu-model-label-ssot-plan
- Source Feishu doc:
  `https://bob3y2gxxp.feishu.cn/wiki/LGsZwaXMRiHqOXkB2qocbyfwnKh`
- Additional Feishu source docs:
  - `https://bob3y2gxxp.feishu.cn/wiki/JYNWwQOOjiWcOLktv07cBvIVnOh`
  - `https://bob3y2gxxp.feishu.cn/wiki/WBZjwY3DSil6pAkQ8DZcpsrWnUf`
- Local Feishu extract used for planning:
  `/tmp/feishu_LGsZ_model_doc.md`
- Additional local Feishu extracts used for planning:
  - `/tmp/feishu_JYNW_doc.md`
  - `/tmp/feishu_WBZj_doc.md`
