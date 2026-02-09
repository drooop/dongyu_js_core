# Iteration 0138-cell-owned-pin Resolution

## 0. Execution Rules
- Work branch: dropx/dev_0138-cell-owned-pin
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Define Cell-owned PIN contract | 明确 v schema 与兼容策略 | docs/iterations/0138-cell-owned-pin/*, docs/user-guide/modeltable_user_guide.md | `rg -n "Cell-owned|PIN_IN|binding" docs/iterations/0138-cell-owned-pin docs/user-guide/modeltable_user_guide.md` | 文档可自洽，包含新旧兼容规则 | Revert Step 1 docs |
| 2 | Implement runtime binding route | mqttIncoming/addLabel 支持按 binding 路由 | packages/worker-base/src/runtime.js, packages/worker-base/src/runtime.mjs | `node --check packages/worker-base/src/runtime.js && node --check packages/worker-base/src/runtime.mjs` | 新语义可用且旧语义未破坏 | Revert runtime changes |
| 3 | Reduce server hard-coded PIN trigger | 将可通用触发从 server 下沉 runtime | packages/ui-model-demo-server/server.mjs | `node --check packages/ui-model-demo-server/server.mjs` | server 不再依赖固定 PIN 触发分支（至少核心路径） | Revert server changes |
| 4 | Add/extend validation scripts | 新旧语义双轨验证并记录结果 | scripts/validate_pin_mqtt_loop.mjs, docs/iterations/0138-cell-owned-pin/runlog.md | `node scripts/validate_pin_mqtt_loop.mjs` | 新旧 case 全部 PASS | Revert script changes |

## 2. Step Details

### Step 1 — Define Cell-owned PIN contract
**Goal**
- 给 `PIN_IN/PIN_OUT.v` 引入可机器判定的 binding schema，并写清 fallback 规则。

**Scope**
- 写清 owner/target/trigger 的最小字段集。
- 标注旧格式（string/null）继续走 legacy mailbox。

**Files**
- Create/Update:
  - docs/iterations/0138-cell-owned-pin/plan.md
  - docs/iterations/0138-cell-owned-pin/resolution.md
  - docs/user-guide/modeltable_user_guide.md
- Must NOT touch:
  - MQTT topic schema docs（本步不改协议）

**Validation (Executable)**
- Commands:
  - `rg -n "binding|legacy|fallback|Cell-owned" docs/iterations/0138-cell-owned-pin docs/user-guide/modeltable_user_guide.md`
- Expected signals:
  - 文档同时出现新语义字段与旧语义 fallback 描述。

**Acceptance Criteria**
- 评审者可按文档构造新/旧两种 PIN 声明样例。

**Rollback Strategy**
- 回退本步文档改动。

---

### Step 2 — Implement runtime binding route
**Goal**
- 在 runtime 内实现基于 binding 的入站写入和触发记录。

**Scope**
- 解析 `PIN_IN.v` binding（对象）并建立 pin -> target/trigger 映射。
- `mqttIncoming` 按映射写入目标 Cell。
- 未匹配映射时回退到 legacy mailbox。

**Files**
- Create/Update:
  - packages/worker-base/src/runtime.js
  - packages/worker-base/src/runtime.mjs
- Must NOT touch:
  - UI renderer 行为

**Validation (Executable)**
- Commands:
  - `node --check packages/worker-base/src/runtime.js`
  - `node --check packages/worker-base/src/runtime.mjs`
- Expected signals:
  - 语法检查通过，无未定义引用。

**Acceptance Criteria**
- 新语义声明可驱动入站写入到非默认 mailbox Cell。
- 旧语义声明行为保持不变。

**Rollback Strategy**
- 回退 runtime 改动。

---

### Step 3 — Reduce server hard-coded PIN trigger
**Goal**
- 减少 `server.mjs` 对具体 PIN/cell 的硬编码触发逻辑。

**Scope**
- 把通用触发条件移到 runtime side；server 保留编排调度。

**Files**
- Create/Update:
  - packages/ui-model-demo-server/server.mjs
- Must NOT touch:
  - front-end build output

**Validation (Executable)**
- Commands:
  - `node --check packages/ui-model-demo-server/server.mjs`
- Expected signals:
  - server 语法通过，关键路径仍可 tick 运行。

**Acceptance Criteria**
- 至少一条原先依赖硬编码 PIN_IN cell 的路径可由 runtime 驱动。

**Rollback Strategy**
- 回退 server 改动。

---

### Step 4 — Add/extend validation scripts
**Goal**
- 提供可重复执行的新旧语义验证闭环。

**Scope**
- 在现有 `validate_pin_mqtt_loop` 增加 Cell-owned case 与兼容 case。
- 写入 runlog 事实记录。

**Files**
- Create/Update:
  - scripts/validate_pin_mqtt_loop.mjs
  - docs/iterations/0138-cell-owned-pin/runlog.md
- Must NOT touch:
  - unrelated iteration docs

**Validation (Executable)**
- Commands:
  - `node scripts/validate_pin_mqtt_loop.mjs`
- Expected signals:
  - 输出含新 case PASS 与兼容 case PASS。

**Acceptance Criteria**
- runlog 中记录命令、关键输出、PASS/FAIL 判定。

**Rollback Strategy**
- 回退脚本与 runlog 记录。

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
