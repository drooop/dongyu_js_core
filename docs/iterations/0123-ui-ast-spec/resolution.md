# Iteration 0123-ui-ast-spec Resolution

## 0. Execution Rules
- Work branch: dev_0123-ui-ast-spec
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1    | UI AST Spec | 节点与字段规范 | docs/iterations/0123-ui-ast-spec/spec.md | `rg -n "UI AST Spec" docs/iterations/0123-ui-ast-spec/spec.md` | AST 规范完整 | 删除新增文档 |
| 2    | Event & Render Contract | 事件归一化与渲染契约 | docs/iterations/0123-ui-ast-spec/spec.md | `rg -n "Render Contract" docs/iterations/0123-ui-ast-spec/spec.md` | 契约完整且无语义冲突 | 回滚到 Step1 版本 |

## 2. Step Details

### Step 1 — UI AST Spec
**Goal**
- 产出 UI AST 最小节点集（Normative）与字段职责规范。

**Scope**
- 仅定义 AST 结构与字段职责（展示 vs ModelTable 绑定），不实现渲染。

**Files**
- Create/Update:
  - `docs/iterations/0123-ui-ast-spec/spec.md`
- Must NOT touch:
  - 运行时实现代码

**Validation (Executable)**
- Commands:
  - `rg -n "UI AST Spec" docs/iterations/0123-ui-ast-spec/spec.md`
- Expected signals:
  - 能匹配到 AST 规范标题

**Acceptance Criteria**
- AST 最小节点集完整、字段职责清晰且可审计

**Rollback Strategy**
- 删除 `docs/iterations/0123-ui-ast-spec/spec.md`

---

### Step 2 — Event & Render Contract
**Goal**
- 产出事件归一化、AST→ModelTable 单向绑定硬规则与渲染契约。

**Scope**
- UI 事件必须写 Cell（add_label/rm_label），AST 不得包含可执行体。

**Files**
- Create/Update:
  - `docs/iterations/0123-ui-ast-spec/spec.md`
- Must NOT touch:
  - 运行时实现代码

**Validation (Executable)**
- Commands:
  - `rg -n "Render Contract" docs/iterations/0123-ui-ast-spec/spec.md`
- Expected signals:
  - 能匹配到渲染契约标题

**Acceptance Criteria**
- 契约明确且包含 Negative Spec，不新增 built-in 语义

**Rollback Strategy**
- 回滚到仅包含 Step1 的版本

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
