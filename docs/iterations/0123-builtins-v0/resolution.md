# Iteration 0123-builtins-v0 Resolution

## 0. Execution Rules
- Work branch: dev_0123-builtins-v0
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1    | Concrete Key Implementation Ledger | 逐 key 实施清单 | docs/iterations/0123-builtins-v0/ledger.md | `rg -n "Concrete Key Implementation Ledger" docs/iterations/0123-builtins-v0/ledger.md` | Ledger 覆盖全部 key | 删除新增文档 |
| 2    | v0 Validation Protocol | EventLog/snapshot/intercepts 判据 | docs/iterations/0123-builtins-v0/validation_protocol.md | `rg -n "Validation Protocol v0" docs/iterations/0123-builtins-v0/validation_protocol.md` | PASS/FAIL 口径明确 | 删除新增文档 |

## 2. Step Details

### Step 1 — Concrete Key Implementation Ledger
**Goal**
- 产出 Concrete Key Implementation Ledger（逐 key 实施清单）。

**Scope**
- 覆盖 Concrete Key Inventory 的所有实际 key（含 run_<func> pattern）。\n+- 每条包含证据来源、触发输入、EventLog 序列、拦截点、PASS/FAIL、限制。

**Files**
- Create/Update:
- `docs/iterations/0123-builtins-v0/ledger.md`
- Must NOT touch:
- 任何运行时代码与非本 iteration 文档

**Validation (Executable)**
- Commands:
  - `rg -n "Concrete Key Implementation Ledger" docs/iterations/0123-builtins-v0/ledger.md`
  - `rg -n "MVP Keys" docs/iterations/0123-builtins-v0/ledger.md`
- Expected signals:
- 能匹配到 Ledger 标题与 MVP/Deferred 分区

**Acceptance Criteria**
- Ledger 覆盖所有实际 key，且逐条引用 Coverage Matrix 与 Harness Assertion Rules

**Rollback Strategy**
- 删除 `docs/iterations/0123-builtins-v0/ledger.md`

---

### Step 2 — v0 Validation Protocol
**Goal**
- 产出 v0 Validation Protocol（EventLog/snapshot/intercepts 的 PASS/FAIL 口径）。

**Scope**
- 定义如何用 EventLog、snapshot、intercepts 判定 PASS/FAIL。\n+- 明确与 Coverage Matrix / Harness Assertion Rules 的映射。

**Files**
- Create/Update:
  - `docs/iterations/0123-builtins-v0/validation_protocol.md`
- Must NOT touch:
  - 任何运行时代码与非本 iteration 文档

**Validation (Executable)**
- Commands:
  - `rg -n "Validation Protocol v0" docs/iterations/0123-builtins-v0/validation_protocol.md`
  - `rg -n "PASS/FAIL" docs/iterations/0123-builtins-v0/validation_protocol.md`
- Expected signals:
  - 能匹配到协议标题与 PASS/FAIL 口径

**Acceptance Criteria**
- 口径清晰、可执行（文档级），与 Harness 断言规则一致

**Rollback Strategy**
- 删除 `docs/iterations/0123-builtins-v0/validation_protocol.md`

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
