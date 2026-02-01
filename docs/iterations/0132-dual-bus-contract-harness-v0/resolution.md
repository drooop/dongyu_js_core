# Iteration 0132-dual-bus-contract-harness-v0 Resolution

## 0. Execution Rules
- Work branch: dev_0132-dual-bus-contract-harness-v0
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

Preflight (must be PASS before Step 1; no commits):
- Iteration registration exists in `docs/ITERATIONS.md`.
- Intended branch exists / is checked out: `dev_0132-dual-bus-contract-harness-v0`.
- Review Gate has explicit user approval for real Matrix integration (recorded in runlog).

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Evidence + contract draft | Extract PICtest Matrix/MQTT channel facts; draft Stage4 v0 contract + schemas | `docs/iterations/0132-dual-bus-contract-harness-v0/**` | `node -e "..."` (file + json parse checks) | Contract is versioned, maps to Stage2/3 assets, unknowns explicitly marked | Revert Step 1 commit |
| 2 | MgmtBus adapter interface + env contract | Define adapter interface + `.env` key contract + redaction rules | `docs/iterations/0132-dual-bus-contract-harness-v0/**` | `node -e "..."` (key list + schema parse checks) | Env contract lists required keys; no secrets in docs/logs | Revert Step 2 commit |
| 3 | MgmtBus adapter (loopback) | Loopback ManagementBusAdapter for harness | `packages/bus-mgmt/**` (new) | `node scripts/validate_dual_bus_harness_v0.mjs --case mgmt_loopback` | Loopback bus supports publish/subscribe + replay-safe ids | Revert Step 3 commit |
| 4 | MgmtBus adapter (matrix-live) | Real Matrix adapter (non-E2EE) reading `.env` | `packages/bus-mgmt/**` (new) | `node scripts/validate_dual_bus_harness_v0.mjs --case mgmt_matrix_live` | Join/send/recv minimal flow; no secret echo | Revert Step 4 commit |
| 5 | MBR bridge v0 | Bridge MgmtBus ↔ MQTT using PIN semantics (no generic MT mutation) | `packages/mbr/**` (new) | `node scripts/validate_dual_bus_harness_v0.mjs --case mbr_bridge` | UI-event → PIN_IN; PIN_OUT → mgmt update; no shortcut paths | Revert Step 5 commit |
| 6 | Harness E2E | Wire worker-base + mqtt loop + mbr + mgmt (loopback + matrix-live) into a single executable harness | `scripts/validate_dual_bus_harness_v0.mjs`, `packages/worker-base/**` | `node scripts/validate_dual_bus_harness_v0.mjs --case e2e` | One command PASS; traces prove causality chain | Revert Step 6 commit |
| 7 | Guards + docs polish | Add stage guards + redact rules + matrix-live requirements | `scripts/**`, `docs/iterations/0132-*/**` | `node scripts/validate_iteration_guard.mjs --case stage4` (update/add) | Guard prevents UI direct bus; docs clearly state non-goals | Revert Step 7 commit |

## 2. Step Details

### Step 1 — Evidence + contract draft

**Goal**
- 把 Stage 4 “Dual Bus”中与 Matrix/MQTT/MBR 相关的假设，降到“可引用证据/可判定 contract”。

**Scope**
- 在 `docs/iterations/0132-dual-bus-contract-harness-v0/` 内新增：
  - `evidence_pictest_matrix_mqtt.md`：列出 PICtest 中 Matrix/MQTT 通道相关的路径、硬编码点、可观测行为与不确定项。
  - `contract_dual_bus_v0.md`：v0 contract（含消息类型、字段、幂等键、错误语义）。
  - `schemas/`：JSON schema（或 zod）文件（仅定义，不实现 adapter）。
- Contract 必须显式复用/映射：
  - Stage 3 mailbox（op_id、single-slot、error priority）
  - Stage 2 PIN+MQTT loop（topic/payload v0 口径与 Validation Protocol）
  - ModelTable-driven 触发规则（add_label/rm_label 作为唯一副作用入口）

**Must NOT touch**
- `docs/architecture_mantanet_and_workers.md`
- `docs/charters/dongyu_app_next_runtime.md`

**Validation (Executable)**
- Commands:
  - `node -e "const fs=require('fs'); const must=['docs/iterations/0132-dual-bus-contract-harness-v0/evidence_pictest_matrix_mqtt.md','docs/iterations/0132-dual-bus-contract-harness-v0/contract_dual_bus_v0.md']; for (const f of must) { if(!fs.existsSync(f)) { console.error('MISSING',f); process.exit(1);} } console.log('PASS: docs_exist')"`
  - `node -e "const fs=require('fs'); const p='docs/iterations/0132-dual-bus-contract-harness-v0/schemas'; if(!fs.existsSync(p)) { console.error('MISSING',p); process.exit(1);} console.log('PASS: schemas_dir')"`

**Acceptance Criteria**
- Contract 文档可被“无上下文读者”理解，并包含：Non-goals、消息版本、幂等键、失败写回/可观测性口径。
- Evidence 文档对 PICtest 的引用可定位到具体路径/符号，并把“是否对外契约”标注为待确认。
 - 明确 Matrix 侧字段只作为 ManagementBusAdapter 扩展字段，不改写 SSOT 抽象层。

**Rollback Strategy**
- Revert Step 1 commit.

---

### Step 2 — MgmtBus adapter interface + env contract

**Goal**
- 定义 ManagementBusAdapter 接口与 `.env` 配置契约（不写入 secrets），并约束 redaction 规则。

**Scope**
- 在 `docs/iterations/0132-dual-bus-contract-harness-v0/` 内新增 env contract 文档/节：
  - 列出必需键名（不含值）：
    - `MATRIX_HOMESERVER_URL`
    - `MATRIX_MBR_USER`
    - `MATRIX_MBR_PASSWORD`
    - `MATRIX_MBR_ACCESS_TOKEN`（可选）
  - 认证优先级与失败语义（只写规则，不写实现）
  - 日志 redaction 规则（token/密码不得出现在 ModelTable/EventLog/runlog）

**Validation (Executable)**
- `node -e "const fs=require('fs'); const p='docs/iterations/0132-dual-bus-contract-harness-v0'; const ok=['contract_dual_bus_v0.md'].every(f=>fs.existsSync(p+'/'+f)); console.log(ok?'PASS: env_contract':'FAIL: env_contract'); process.exit(ok?0:1)"`

**Rollback Strategy**
- Revert Step 2 commit.

---

### Step 3 — MgmtBus adapter (loopback)

**Goal**
- 实现 loopback 管理总线 adapter，用于无凭证环境的回归验证。

**Scope**
- 新增 `packages/bus-mgmt/`：
  - `src/adapter.js`：interface + types
  - `src/loopback.js`：in-memory pub/sub + minimal replay-safe delivery

**Validation (Executable)**
- `node scripts/validate_dual_bus_harness_v0.mjs --case mgmt_loopback`

**Rollback Strategy**
- Revert Step 3 commit.

---

### Step 4 — MgmtBus adapter (matrix-live)

**Goal**
- 接入真实 Matrix（non-E2EE），使用 `.env` 配置完成最小 join/send/recv。

**Scope**
- 新增 `packages/bus-mgmt/`：
  - `src/matrix_live.js`：Matrix live adapter（读 `.env`，不回显 secrets）
  - 认证方式与失败语义须遵循 Step 2 的 env contract

**Validation (Executable)**
- `node scripts/validate_dual_bus_harness_v0.mjs --case mgmt_matrix_live`

**Acceptance Criteria**
- join/send/recv 可观测（room_id/event_id/op_id）；日志中不得出现 token/密码。

**Rollback Strategy**
- Revert Step 4 commit.

---

### Step 5 — MBR bridge v0

**Goal**
- 实现 MBR v0：将 management bus 的 UI-event 映射为 control bus（MQTT）上的 PIN_IN，并将 PIN_OUT 回传为 management bus 的 update。

**Scope**
- 新增 `packages/mbr/`：
  - `src/mbr_v0.js`：bridge + dedupe (op_id)
  - 不引入 UI 直连；只通过 ModelTable 结构性声明触发
- Control bus 侧严格复用 PIN+MQTT 语义（不引入“通用 ModelTable mutation over MQTT”）。

**Validation (Executable)**
- `node scripts/validate_dual_bus_harness_v0.mjs --case mbr_bridge`

**Rollback Strategy**
- Revert Step 5 commit.

---

### Step 6 — Harness E2E

**Goal**
- 形成一条可脚本验收的 Stage 4 v0 最小链路：UI event → mgmt → MBR → MQTT → worker-base → MQTT → MBR → mgmt → UI projection。

**Scope**
- 新增 `scripts/validate_dual_bus_harness_v0.mjs`：
  - 启动/连接本地 docker MQTT（或使用已有 mock 能力，按现有 pin-mqtt-loop 口径）。
  - 启动 worker-base runtime（复用 `packages/worker-base/src/runtime.mjs` 能力）。
  - 驱动一个 editor mailbox event（复用 0129/0130 contract envelope），并观察 pin_out 与 snapshot/update。
  - 同时覆盖 loopback 与 matrix-live 两种 mgmt adapter。

**Validation (Executable)**
- `node scripts/validate_dual_bus_harness_v0.mjs --case e2e`

**Acceptance Criteria**
- 输出包含可判定的 PASS/FAIL 以及关键 trace 片段（event_id/op_id/topic/payload/room_id）。

**Rollback Strategy**
- Revert Step 6 commit.

---

### Step 7 — Guards + docs polish

**Goal**
- 用可执行 guard 防止 shortcut path（尤其是 UI 直连总线）；补齐真实 Matrix adapter 的合规说明与 redact 规则。

**Scope**
- 视现有 guard 结构，新增或扩展：
  - `node scripts/validate_iteration_guard.mjs --case stage4`
- 在 `contract_dual_bus_v0.md` 中补齐“真实 Matrix adapter”作为本迭代必经通路的说明与配置输入条件。

**Validation (Executable)**
- `node scripts/validate_iteration_guard.mjs --case stage4`

**Rollback Strategy**
- Revert Step 7 commit.

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
