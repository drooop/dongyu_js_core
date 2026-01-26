# Iteration 0122-pictest-evidence Resolution

## 0. Execution Rules
- Work branch: dev_0122-pictest-evidence
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1    | PICtest built-in k / PIN / trigger 枚举与分类 | 仅收集与分类，不归纳 | docs/iterations/0122-pictest-evidence/evidence.md | `rg -n \"Enumeration\" docs/iterations/0122-pictest-evidence/evidence.md` | 枚举与分类完整且可追溯 | 删除新增文档 |
| 2    | 标准化行为证据表 | 形成证据表并绑定源文件/符号 | docs/iterations/0122-pictest-evidence/evidence.md | `rg -n \"Behavior Evidence Table\" docs/iterations/0122-pictest-evidence/evidence.md` | 每条证据含输入/条件/副作用/错误/幂等+证据等级 | 回滚到 Step1 文档版本 |

## 2. Step Details

### Step 1 — PICtest built-in k / PIN / trigger 枚举与分类
**Goal**
- 对 PICtest 中 built-in k / PIN / trigger 相关能力进行**枚举与分类**（仅收集与分类，不归纳）。

**Scope**
- 仅从 PICtest 源码中列出：\n  - 具备显式副作用的 Label 类型与其触发入口\n  - 与 PIN/连接/触发相关的枚举与结构\n  - Cell.add_label 中的特殊 label key 处理\n+- 不进行行为归纳与解释，不形成规则结论。

**Files**
- Create/Update:
- `docs/iterations/0122-pictest-evidence/evidence.md`（建立枚举与分类清单）
- Must NOT touch:
- 任何运行时代码与非本 iteration 文档

**Validation (Executable)**
- Commands:
  - `rg -n "Enumeration" docs/iterations/0122-pictest-evidence/evidence.md`
  - `test -s docs/iterations/0122-pictest-evidence/evidence.md`
- Expected signals:
- 能匹配到枚举章节，且文件非空

**Acceptance Criteria**
- built-in k / PIN / trigger 枚举与分类完成，均有源文件/符号指向

**Rollback Strategy**
- 删除 `docs/iterations/0122-pictest-evidence/evidence.md`

---

### Step 2 — 标准化行为证据表
**Goal**
- 基于 Step 1 枚举清单，形成标准化行为证据表，并逐条绑定源文件与符号。

**Scope**
- 每条证据必须覆盖：输入 / 条件 / 副作用 / 错误 / 幂等。
- 每条证据必须标注“证据等级”（Level A/B/C），区分直接可观测与推断行为。

**Files**
- Create/Update:
  - `docs/iterations/0122-pictest-evidence/evidence.md`
- Must NOT touch:
  - 任何运行时代码与非本 iteration 文档

**Validation (Executable)**
- Commands:
  - `rg -n "Behavior Evidence Table" docs/iterations/0122-pictest-evidence/evidence.md`
  - `rg -n "Evidence Level" docs/iterations/0122-pictest-evidence/evidence.md`
- Expected signals:
  - 能匹配到证据表与证据等级定义

**Acceptance Criteria**
- 证据表条目完整且逐条绑定 PICtest 源文件与符号
- 每条证据包含证据等级与最小可审计描述

**Rollback Strategy**
- 回退至仅包含 Step1 枚举与分类的版本

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
