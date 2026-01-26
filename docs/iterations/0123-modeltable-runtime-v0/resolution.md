# Iteration 0123-modeltable-runtime-v0 Resolution

## 0. Execution Rules
- Work branch: dev_0123-modeltable-runtime-v0
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1    | ModelTable Runtime Spec v0 | API + determinism 规范 | docs/iterations/0123-modeltable-runtime-v0/spec.md | `rg -n "ModelTable Runtime Spec v0" docs/iterations/0123-modeltable-runtime-v0/spec.md` | 规范包含 API/校验/确定性语义 | 删除新增文档 |
| 2    | EventLog/ChangeLog + Persistence Contract v0 | 审计与持久化契约 | docs/iterations/0123-modeltable-runtime-v0/spec.md | `rg -n "EventLog / ChangeLog" docs/iterations/0123-modeltable-runtime-v0/spec.md` | 日志字段/粒度/对比口径明确 | 回滚至仅含 Step1 版本 |

## 2. Step Details

### Step 1 — ModelTable Runtime Spec v0
**Goal**
- 产出 ModelTable Runtime v0 规范（接口面 + 校验规则 + 确定性更新语义）。

**Scope**
- 明确 Cell identity、核心 API、校验规则。\n+- 写死确定性更新语义（写入顺序、覆盖/合并、t/v 变更、时间/随机处理）。

**Files**
- Create/Update:
- `docs/iterations/0123-modeltable-runtime-v0/spec.md`
- Must NOT touch:
- 任何运行时代码与非本 iteration 文档

**Validation (Executable)**
- Commands:
  - `rg -n "ModelTable Runtime Spec v0" docs/iterations/0123-modeltable-runtime-v0/spec.md`
  - `rg -n "Deterministic Update Semantics" docs/iterations/0123-modeltable-runtime-v0/spec.md`
- Expected signals:
- 能匹配到规范标题与确定性语义章节

**Acceptance Criteria**
- API/校验/确定性语义完整且可审计

**Rollback Strategy**
- 删除 `docs/iterations/0123-modeltable-runtime-v0/spec.md`

---

### Step 2 — EventLog/ChangeLog + Persistence Contract v0
**Goal**
- 产出最小 EventLog/ChangeLog 与持久化契约，并与 Harness 对比口径对齐。

**Scope**
- 定义日志最小字段、粒度与生成规则。\n+- 明确与 Harness 对比口径的映射关系。\n+- 定义持久化接口契约（load/flush/checkpoint）。

**Files**
- Create/Update:
  - `docs/iterations/0123-modeltable-runtime-v0/spec.md`
- Must NOT touch:
  - 任何运行时代码与非本 iteration 文档

**Validation (Executable)**
- Commands:
  - `rg -n "EventLog / ChangeLog" docs/iterations/0123-modeltable-runtime-v0/spec.md`
  - `rg -n "Persistence Contract v0" docs/iterations/0123-modeltable-runtime-v0/spec.md`
- Expected signals:
  - 能匹配到日志与持久化章节

**Acceptance Criteria**
- EventLog/ChangeLog 字段与粒度明确，且对比口径可映射到 Harness
- 持久化接口契约完整可执行（文档级）

**Rollback Strategy**
- 回滚至仅包含 Step1 规范的版本

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
