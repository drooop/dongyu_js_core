---
title: "Iteration 0262-model-mounting-audit Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0262-model-mounting-audit
id: 0262-model-mounting-audit
phase: phase1
---

# Iteration 0262-model-mounting-audit Resolution

## 0. Execution Rules
- Work branch: `dev_0262-model-mounting-audit`
- 先 RED test，再写分析器和可视化。
- 审计结论必须来自生成数据，不得手工回填到 HTML。

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Add analyzer RED test | 固定当前 repo 事实 contract | `scripts/tests/test_0262_model_mounting_analyzer.mjs` | `node scripts/tests/test_0262_model_mounting_analyzer.mjs` | 先出现缺失/RED | 删除测试 |
| 2 | Implement analyzer | 扫描 patch/source 输出结构化 mount facts | `scripts/ops/model_mounting_analyzer.mjs` | same test + CLI output | 分析结果结构稳定 | 回退分析器 |
| 3 | Rebuild HTML data source | `viz-model-mounting.html` 改读生成数据 | `viz-model-mounting.html`, generated companion data | regenerate + inspect summary | 不再依赖手写事实表 | 回退 HTML/companion |
| 4 | Run audit and summarize | 基于新数据源输出当前违规候选清单 | generated audit output + runlog | analyzer CLI | 审计结论可复现 | 仅回退本轮分析文件 |

## 2. Step Details

### Step 1 — Add analyzer RED test
**Goal**
- 在实现前锁住关键事实 contract。

**Files**
- Create/Update:
  - `scripts/tests/test_0262_model_mounting_analyzer.mjs`

**Validation (Executable)**
- `node scripts/tests/test_0262_model_mounting_analyzer.mjs`

**Acceptance Criteria**
- 能表达关键 contract：`-101` 不误报、`100`/`1` duplicate mount 可识别、核心未挂载候选可识别。

**Rollback Strategy**
- 删除测试文件。

### Step 2 — Implement analyzer
**Goal**
- 提供 repo 级模型/挂载事实分析器。

**Files**
- Create/Update:
  - `scripts/ops/model_mounting_analyzer.mjs`

**Validation (Executable)**
- `node scripts/tests/test_0262_model_mounting_analyzer.mjs`
- `node scripts/ops/model_mounting_analyzer.mjs --json`

**Acceptance Criteria**
- 输出至少包含 declared models、mounts、unmounted、duplicate mounts、source/context。

**Rollback Strategy**
- 回退分析器与测试。

### Step 3 — Rebuild HTML data source
**Goal**
- 把现有 HTML 从手写事实切到生成事实。

**Files**
- Create/Update:
  - `viz-model-mounting.html`
  - generated companion data file

**Validation (Executable)**
- `node scripts/ops/model_mounting_analyzer.mjs --write-viz`
- inspect generated summary and HTML source

**Acceptance Criteria**
- HTML 不再手写 `models` / `mounts` 权威数据。

**Rollback Strategy**
- 回退 HTML 与 companion data。

### Step 4 — Run audit and summarize
**Goal**
- 在新数据源上给出可复现合规审计。

**Files**
- Create/Update:
  - generated audit output if needed
  - `docs/iterations/0262-model-mounting-audit/runlog.md`

**Validation (Executable)**
- `node scripts/ops/model_mounting_analyzer.mjs --json`

**Acceptance Criteria**
- 输出包含当前 unmounted / duplicate mount 审计结果与 source/context 解释。

**Rollback Strategy**
- 仅回退本轮生成产物。
