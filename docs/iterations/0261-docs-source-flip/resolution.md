---
title: "Iteration 0261-docs-source-flip Resolution"
doc_type: iteration-resolution
status: active
updated: 2026-03-30
source: ai
iteration_id: 0261-docs-source-flip
id: 0261-docs-source-flip
phase: phase1
---

# Iteration 0261-docs-source-flip Resolution

## 0. Execution Rules
- Work branch: `dev_0261-docs-source-flip`
- Steps execute in order.
- 任何真实命令输出、备份路径、校验结果只写入 `runlog.md`。
- 迁移过程中不修改 `docs-shared/`。

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Register + backup | 固化 iteration 事实并备份当前 vault docs | `docs/ITERATIONS.md`, `docs/iterations/0261-docs-source-flip/*` | `ls -ld <backup>` | 备份存在且 iteration 已登记 | 保留原 vault，不进入 Step 2 |
| 2 | Flip ownership | `docs` symlink -> repo real dir；vault path -> symlink | `docs/`, `~/Documents/drip/Projects/dongyuapp` | `ls -ld docs` / `ls -ld ~/Documents/drip/Projects/dongyuapp` / `git ls-files` | repo docs 为真实目录，vault path 为 symlink | 用备份恢复 vault 实体目录并回退 repo `docs` |
| 3 | Update documentation | 更新仓库内结构说明与限制说明 | `README.md`, `CLAUDE.md`, relevant docs note | `rg -n "symlink|repo source of truth|vault"` | 说明文本与新结构一致 | 回退说明文档改动 |
| 4 | Validate toolchain + git | 跑 audit / gate / 最小 stage 验收 | `scripts/ops/*`, `docs/**` | `node scripts/ops/obsidian_docs_audit.mjs --root docs`; `node scripts/ops/validate_obsidian_docs_gate.mjs`; `git add docs/ITERATIONS.md --intent-to-add` or equivalent real add/reset | docs 可被 Git 与门禁稳定消费 | 恢复原结构或修正兼容问题后重验 |

## 2. Step Details

### Step 1 — Register + backup
**Goal**
- 在真正迁移前固定 iteration 上下文，并为当前 vault 内容生成可回滚备份。

**Scope**
- 记录 user-approved gate。
- 生成时间戳备份路径 `~/Documents/drip/Projects/dongyuapp.backup-YYYYMMDD-HHMMSS`。

**Files**
- Create/Update:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0261-docs-source-flip/plan.md`
  - `docs/iterations/0261-docs-source-flip/resolution.md`
  - `docs/iterations/0261-docs-source-flip/runlog.md`
- Must NOT touch:
  - repo `docs` symlink 本体（本步只记录与备份）

**Validation (Executable)**
- `ls -ld ~/Documents/drip/Projects/dongyuapp.backup-*`

**Acceptance Criteria**
- 新 iteration 已登记且备份路径存在。

**Rollback Strategy**
- 不进入 Step 2。

---

### Step 2 — Flip ownership
**Goal**
- 让 repo `docs/` 成为真实目录和 Git source of truth，同时保持 vault 入口稳定。

**Scope**
- 删除 repo 中被 Git 跟踪的 `docs` symlink。
- 在 repo 内重建真实 `docs/` 目录并复制当前 vault 内容。
- 将 vault 路径 `~/Documents/drip/Projects/dongyuapp` 改成指向 repo `docs/` 的 symlink。

**Files**
- Create/Update:
  - `docs/**`
  - `~/Documents/drip/Projects/dongyuapp` (filesystem symlink)
- Must NOT touch:
  - `docs-shared/`

**Validation (Executable)**
- `ls -ld docs`
- `ls -ld ~/Documents/drip/Projects/dongyuapp`
- `git ls-files -s docs`
- `git ls-files | rg '^docs/'`

**Acceptance Criteria**
- repo `docs` 为真实目录；vault `dongyuapp` 为 symlink；Git 已能看到大量 `docs/**` 文件。

**Rollback Strategy**
- 删除新建 vault symlink，恢复备份目录名为 `dongyuapp`，并回退 repo `docs` 变更。

---

### Step 3 — Update documentation
**Goal**
- 让所有权说明和仓库结构说明与新布局一致。

**Scope**
- 更新 README / CLAUDE / retrospection note 中关于 docs 的 ownership 叙述。

**Files**
- Create/Update:
  - `README.md`
  - `CLAUDE.md`
  - any existing note explicitly describing current docs symlink boundary
- Must NOT touch:
  - 无关产品/运行时文档正文

**Validation (Executable)**
- `rg -n "Obsidian vault symlink|repo source of truth|docs symlink|vault 路径" README.md CLAUDE.md scripts`

**Acceptance Criteria**
- 不再把 `docs/` 表述成 repo 外真实文件面。

**Rollback Strategy**
- 回退说明文档改动。

---

### Step 4 — Validate toolchain + git
**Goal**
- 证明迁移后 docs 已回到正常的 repo / hook / gate 工作面。

**Scope**
- 运行 obsidian 审计与 gate。
- 做一次最小 `git add docs/ITERATIONS.md` 验证，确认不再命中 symbolic-link 边界错误。

**Files**
- Create/Update:
  - none required for implementation; only factual runlog updates
- Must NOT touch:
  - `docs-shared/`

**Validation (Executable)**
- `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- `node scripts/ops/validate_obsidian_docs_gate.mjs`
- `git add docs/ITERATIONS.md`
- `git reset HEAD docs/ITERATIONS.md` (if needed after verification)

**Acceptance Criteria**
- 审计与 gate 均通过，最小 docs stage 成功。

**Rollback Strategy**
- 若 gate 失败且无法快速修正，则恢复 Step 2 前结构。
