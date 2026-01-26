# Iteration 0122-oracle-harness-plan Resolution

## 0. Execution Rules
- Work branch: dev_0122-oracle-harness-plan
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1    | Built-in k Discovery & Concrete Key Inventory | 定义发现协议并形成实际 key 清单 | docs/iterations/0122-oracle-harness-plan/harness_plan.md | `rg -n "Concrete Key Inventory" docs/iterations/0122-oracle-harness-plan/harness_plan.md` | Inventory 完整且可追溯 | 删除新增文档 |
| 2    | Coverage Matrix & Harness Assertion Model | 按 key 组织覆盖矩阵与断言规则 | docs/iterations/0122-oracle-harness-plan/harness_plan.md | `rg -n "Coverage Matrix" docs/iterations/0122-oracle-harness-plan/harness_plan.md` | 每个 key 有触发/副作用/证据等级/拦截点 | 回滚到仅含 Inventory 版本 |

## 2. Step Details

### Step 1 — Built-in k Discovery & Concrete Key Inventory
**Goal**
- 定义 built-in k 的发现协议并形成 Concrete Key Inventory（实际 key 清单）。

**Scope**
- 从 Discovery Protocol 四类信号源提取 key。\n+- 仅列出 PICtest 运行时识别的 key（排除纯业务数据键）。\n+- 为每个 key 绑定源文件与符号，并标注 Evidence Level。

**Files**
- Create/Update:
- `docs/iterations/0122-oracle-harness-plan/harness_plan.md`
- Must NOT touch:
- 任何运行时代码与非本 iteration 文档

**Validation (Executable)**
- Commands:
  - `rg -n "Concrete Key Inventory" docs/iterations/0122-oracle-harness-plan/harness_plan.md`
  - `test -s docs/iterations/0122-oracle-harness-plan/harness_plan.md`
- Expected signals:
- 能匹配到 Inventory 章节且文件非空

**Acceptance Criteria**
- Concrete Key Inventory 完整、可追溯（绑定源文件与符号，含 Evidence Level）

**Rollback Strategy**
- 删除 `docs/iterations/0122-oracle-harness-plan/harness_plan.md`

---

### Step 2 — Coverage Matrix & Harness Assertion Model
**Goal**
- 形成按具体 key 组织的 Coverage Matrix 与 Harness Assertion Rules。

**Scope**
- 为每个 key 给出触发输入构造、期望副作用、Evidence Level、Harness 拦截点。\n+- 明确断言规则与 PASS/FAIL 判断口径（仅文档，不实现）。

**Files**
- Create/Update:
  - `docs/iterations/0122-oracle-harness-plan/harness_plan.md`
- Must NOT touch:
  - 任何运行时代码与非本 iteration 文档

**Validation (Executable)**
- Commands:
  - `rg -n "Coverage Matrix" docs/iterations/0122-oracle-harness-plan/harness_plan.md`
  - `rg -n "Harness Assertion Rules" docs/iterations/0122-oracle-harness-plan/harness_plan.md`
- Expected signals:
  - 能匹配到 Coverage Matrix 与断言规则章节

**Acceptance Criteria**
- Coverage Matrix 以具体 key 列表为索引且字段完整
- Harness Assertion Rules 覆盖 ModelTable diff / MQTT / 错误写入等断言面

**Rollback Strategy**
- 回滚至仅包含 Step1 Inventory 的版本

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
