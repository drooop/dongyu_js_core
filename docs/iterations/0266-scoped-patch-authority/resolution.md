---
title: "Iteration 0266-scoped-patch-authority Resolution"
doc_type: iteration-resolution
status: active
updated: 2026-03-30
source: ai
iteration_id: 0266-scoped-patch-authority
id: 0266-scoped-patch-authority
phase: phase1
---

# Iteration 0266-scoped-patch-authority Resolution

## 0. Execution Rules
- Work branch: `dev_0266-scoped-patch-authority`
- Steps must be executed in order.
- No step skipping; no bundling multiple migration areas into one unverifiable change.
- Each step must have executable validation.
- Any real execution evidence must go to `runlog.md` (NOT here).
- Before any live acceptance, redeploy the local stack and re-run verification on the deployed environment.

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Freeze SSOT contract | 固化 scoped patch authority + helper cell 规约 | `docs/ssot/**`, `docs/user-guide/**` | docs contract test | SSOT 与用户设计一致 | 回退 docs commits |
| 2 | Gate runtime authority | 收紧 runtime/ctx patch 权限 | `packages/worker-base/src/runtime.*` | runtime contract tests | 运行态无全局 patch 越权 | 回退 runtime commits |
| 3 | Add helper scaffold | 预置 helper cell 与 helper API contract | `packages/worker-base/system-models/**` | helper contract tests | helper 约定成立 | 回退 scaffold commits |
| 4 | Migrate dual-bus return path | 去掉 server/model100 direct patch bypass | `server.mjs`, `test_model_100_ui.json` | focused dual-bus tests | 回程只走 formal relay + helper | 回退 focused migration |
| 5 | Upgrade repo patches | 审查并升级所有受影响 authoritative JSON patches | `packages/worker-base/system-models/**`, `deploy/sys-v1ns/**` | audit test | 不剩 bypass patch | 回退 JSON migration commits |
| 6 | Redeploy and verify live | 全量回归 + redeploy + live evidence | scripts/tests + local deploy | test suite + deploy + Playwright | 真实运行面 PASS | 回退到上一步并恢复旧部署 |

## 2. Step Details

### Step 1 — Freeze SSOT contract
**Goal**
- 把“全局 patch 只属 bootstrap、运行态只允许 scoped patch、用户程序只能走 helper pin”正式写进 SSOT。

**Scope**
- 更新 runtime semantics / host ctx API / label registry / user guide。
- 新增 docs contract test。

**Files**
- Create/Update:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/host_ctx_api.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `scripts/tests/test_0266_scoped_patch_docs_contract.mjs`
- Must NOT touch:
  - runtime code
  - deploy manifests

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0266_scoped_patch_docs_contract.mjs`
- Expected signals:
  - 关键术语与禁止项可被脚本检测到

**Acceptance Criteria**
- SSOT 无 direct runtime-wide patch 暗门描述
- helper cell / scoped patch / user-program restrictions 都有明确条目

**Rollback Strategy**
- revert 本 step 文档提交

---

### Step 2 — Gate runtime authority
**Goal**
- 让 runtime 在实现层 enforce scoped patch boundary。

**Scope**
- 新增 scoped patch API
- 禁止运行态 handler 继续直接拿 runtime-wide patch
- 维持 bootstrap loader 能力

**Files**
- Create/Update:
  - `packages/worker-base/src/runtime.mjs`
  - `packages/worker-base/src/runtime.js`
  - `scripts/tests/test_0266_scoped_patch_runtime_contract.mjs`
- Must NOT touch:
  - business model patches

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0266_scoped_patch_runtime_contract.mjs`
  - `node scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs`
- Expected signals:
  - same-model patch allowed
  - cross-model patch rejected
  - create_model rejected outside bootstrap

**Acceptance Criteria**
- 运行态无全局 patch 越权入口
- CJS/ESM 行为一致

**Rollback Strategy**
- revert runtime gate commit

---

### Step 3 — Add helper scaffold
**Goal**
- 为每个模型定义保留 helper executor cell 与标准 request/result pin。

**Scope**
- 约定保留 cell
- 更新 authoritative templates/system-model scaffolds
- 补 helper contract tests

**Files**
- Create/Update:
  - `packages/worker-base/system-models/**`
  - `packages/ui-model-demo-server/filltable_policy.mjs`
  - `scripts/tests/test_0266_helper_cell_contract.mjs`
- Must NOT touch:
  - dual-bus runtime path yet

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0266_helper_cell_contract.mjs`
- Expected signals:
  - helper scaffolding present
  - policy 不暴露非法 patch 能力

**Acceptance Criteria**
- reserved helper contract 在模板/权威定义里可见

**Rollback Strategy**
- revert scaffold commit

---

### Step 4 — Migrate dual-bus return path
**Goal**
- 去掉 `ui-server` 与 `Model 100` 的 direct patch bypass。

**Scope**
- `handleDyBusEvent()` 改成 formal relay only
- `Model 100` 改成 helper-mediated scoped materialization
- 补 focused conformance tests

**Files**
- Create/Update:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/test_model_100_ui.json`
  - `scripts/tests/test_0266_dual_bus_return_conformance.mjs`
  - `scripts/validate_model100_records_e2e_v0.mjs`
- Must NOT touch:
  - unrelated UI models before audit

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0266_dual_bus_return_conformance.mjs`
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `node scripts/validate_model100_records_e2e_v0.mjs`
- Expected signals:
  - no direct applyPatch path remains
  - model100 roundtrip still works through formal path

**Acceptance Criteria**
- 回程 materialization 只走 helper/scoped path

**Rollback Strategy**
- revert focused migration commit

---

### Step 5 — Upgrade repo patches
**Goal**
- 审查并升级所有 authoritative JSON patches，避免只修局部样例。

**Scope**
- repo-wide authoritative JSON audit
- system-model/deploy patch migration
- 新增 audit script/test

**Files**
- Create/Update:
  - `packages/worker-base/system-models/**/*.json`
  - `deploy/sys-v1ns/**/*.json`
  - `scripts/tests/test_0266_json_patch_upgrade_audit.mjs`
- Must NOT touch:
  - non-authoritative草稿文件

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0266_json_patch_upgrade_audit.mjs`
- Expected signals:
  - 不再报告 direct patch bypass 或缺失 helper migration 的 authoritative patch

**Acceptance Criteria**
- authoritative JSON patches 升级完成

**Rollback Strategy**
- revert JSON migration commits

---

### Step 6 — Redeploy and verify live
**Goal**
- 在真实本地部署环境中验证迁移已生效。

**Scope**
- deterministic regressions
- local redeploy
- live snapshot + browser verification
- runlog 记录证据

**Files**
- Create/Update:
  - `docs/iterations/0266-scoped-patch-authority/runlog.md`
- Must NOT touch:
  - new features beyond conformance fix

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0266_scoped_patch_docs_contract.mjs`
  - `node scripts/tests/test_0266_scoped_patch_runtime_contract.mjs`
  - `node scripts/tests/test_0266_helper_cell_contract.mjs`
  - `node scripts/tests/test_0266_dual_bus_return_conformance.mjs`
  - `node scripts/tests/test_0266_json_patch_upgrade_audit.mjs`
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `node scripts/tests/test_0144_remote_worker.mjs`
  - `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `node scripts/tests/test_0216_threejs_scene_contract.mjs`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
- Expected signals:
  - tests PASS
  - baseline ready
  - live pages/snapshot match new authority model

**Acceptance Criteria**
- 本地 live 环境验证通过
- runlog 具备完整部署与验证事实

**Rollback Strategy**
- revert last migration commits and redeploy previous local baseline
