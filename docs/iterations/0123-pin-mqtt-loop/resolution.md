# Iteration 0123-pin-mqtt-loop Resolution

## 0. Execution Rules
- Work branch: dev_0123-pin-mqtt-loop
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1    | Implement PIN_IN/OUT + MQTT loop | 控制总线闭环 | packages/worker-base/src/runtime.js, scripts/validate_pin_mqtt_loop.mjs | `node scripts/validate_pin_mqtt_loop.mjs --case args_override` | PASS per case | Revert Step 1 changes |
| 2    | Validation PASS (per case) | 逐条对照验证 | runlog.md | `node scripts/validate_pin_mqtt_loop.mjs --case all` | runlog 逐条 PASS | Re-run validations |

## 2. Step Details

### Step 1 — Implement PIN_IN/OUT + MQTT loop
**Goal**
- 按 PICtest 证据与 Validation Protocol 实现控制总线闭环。

**Scope**
- 仅 PIN_IN/OUT + 本地 Docker MQTT。
- 不引入 Matrix/双总线、UI、E2EE、打包。
- PIN_IN/PIN_OUT 作为结构性声明：仅通过 add_label/rm_label 触发副作用（遵守 `docs/ssot/runtime_semantics_modeltable_driven.md`）。

**Files**
- Create/Update:
  - `packages/worker-base/src/runtime.js`
  - `scripts/validate_pin_mqtt_loop.mjs`
  - `docs/iterations/0123-pin-mqtt-loop/validation_protocol.md`
- Must NOT touch:
  - UI/Matrix/E2EE/打包相关代码

**Validation (Executable)**
- Commands:
  - `node scripts/validate_pin_mqtt_loop.mjs --case args_override`
  - `node scripts/validate_pin_mqtt_loop.mjs --case read_page0`
  - `node scripts/validate_pin_mqtt_loop.mjs --case missing_config`
- Expected signals:
  - MQTT ↔ PIN_IN/OUT 行为闭环可观测（EventLog + mqtt_trace + intercept）

**Acceptance Criteria**
- EventLog/snapshot/intercepts 与 Evidence 对齐

**Rollback Strategy**
- 回滚本 Step 修改

---

### Step 2 — Validation PASS (per key)
**Goal**
- 逐条执行 Validation Protocol 并记录 PASS。

**Scope**
- 使用 EventLog + snapshot + intercepts 判定 PASS/FAIL。

**Files**
- Create/Update:
  - `docs/iterations/0123-pin-mqtt-loop/runlog.md`
- Must NOT touch:
  - UI/Matrix/E2EE/打包相关代码

**Validation (Executable)**
- Commands:
  - `node scripts/validate_pin_mqtt_loop.mjs --case all`
- Expected signals:
  - runlog 中逐条 PASS（含命令与输出摘要）

**Acceptance Criteria**
- runlog 逐条 PASS 完整、可审计

**Rollback Strategy**
- 重跑验证并更新 runlog

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
