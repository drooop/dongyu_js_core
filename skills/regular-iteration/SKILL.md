---
name: regular-iteration
description: Standard iteration planning cycle for this repository. Use when asked to start a new regular iteration, perform project-level discovery, or generate Phase1 iteration documents. Stops after Phase1 and forbids code changes.
---

# Regular Iteration

## Purpose
- Re-examine the current project state.
- Review existing iteration records under `docs/`.
- Identify structured improvement directions.
- Propose a new iteration and generate Phase1 docs, then stop for review.

## Trigger Phrase
Invoke when the user says:
- “开启常规迭代”
- “开始一轮新的常规迭代”
- “进行一次项目级常规迭代评估”

## Scope
- Current repository only.
- Follow `AGENTS.md`.
- Follow Iteration workflow defined in `docs/WORKFLOW.md` and `docs/ITERATIONS.md`.

## Execution Protocol

### Step 0: Project Boundary Reset
- Treat this repository as fully isolated.
- Do NOT reuse rules or practices from other projects.

### Step 1: Repository Review
- Read `AGENTS.md`.
- Read `docs/WORKFLOW.md`.
- Read `docs/ITERATIONS.md`.
- Review recent iteration folders under `docs/iterations/`.

### Step 2: Improvement Discovery
- Identify improvement directions.

Constraints:
- Exactly 5 directions.
- Each direction must include 5 concrete improvement points.

Mandatory directions to include:
1. Existing project weaknesses.
2. Potential new features.

### Step 3: Iteration Definition
- Propose one new iteration.
- Assign a new iteration ID consistent with existing formats in `docs/ITERATIONS.md`.
- Clearly state the iteration goal and scope.

### Step 4: Phase1 Document Generation (STOP POINT)
- Generate Phase1 artifacts only:
  - `docs/iterations/<id>/plan.md`
  - `docs/iterations/<id>/resolution.md`
  - `docs/iterations/<id>/runlog.md`
- Register the iteration in `docs/ITERATIONS.md` with `Status = Planned`.

Rules:
- All documents MUST be written in Simplified Chinese.
- Preserve English technical terms.
- Follow `docs/_templates/`.

Do NOT enter Phase3.
Do NOT modify code.

## Stop Condition
- Stop immediately after Phase1 documents are generated.
- Wait for explicit human approval to proceed.
