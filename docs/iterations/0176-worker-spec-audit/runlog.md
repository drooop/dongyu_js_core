---
title: "Iteration 0176-worker-spec-audit Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0176-worker-spec-audit
id: 0176-worker-spec-audit
phase: phase3
---

# Iteration 0176-worker-spec-audit Runlog

## Environment

- Date: 2026-03-07
- Branch: `dev_0176-worker-spec-audit`
- Runtime: local repo + OrbStack baseline

Review Gate Record
- Iteration ID: 0176-worker-spec-audit
- Review Date: 2026-03-07
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: 用户明确要求彻查 `ui-server` / `mbr` / Sliding UI 侧软件工人，并沉淀手工填表验证案例、logs 和改进建议。

## Execution Records

### Step 1 — 建立审计与 logs 骨架

- Command:
- `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0176-worker-spec-audit --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- `apply_patch` 更新 `docs/ITERATIONS.md` 与 `docs/iterations/0176-worker-spec-audit/*`
- Key output:
- `0176-worker-spec-audit` 已登记到唯一权威索引。
- 已确立本轮输出结构：iteration docs + `docs/logs/0176-worker-spec-audit/*`
- Result: PASS
- Commit: N/A

### Step 2 — `ui-server` / `mbr` 路径审计

- Command:
- `sed -n ... packages/ui-model-demo-server/server.mjs`
- `sed -n ... packages/worker-base/src/bootstrap_config.mjs`
- `sed -n ... scripts/run_worker_v0.mjs`
- `sed -n ... deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
- `apply_patch` 写入：
  - `docs/logs/0176-worker-spec-audit/ui_server_audit.md`
  - `docs/logs/0176-worker-spec-audit/mbr_audit.md`
- Key output:
- 已确认：
  - `ui-server` 产品 bootstrap 路径是 `MODELTABLE_PATCH_JSON -> Model 0`
  - `/api/modeltable/patch` 默认 `allowCreateModel=true`，可绕过 owner/submodel 规则
  - `mbr worker` 主路径已切到 `MODELTABLE_PATCH_JSON -> Model 0`
  - `mbr_mgmt_to_mqtt` 仍可把通用 action 翻译成 `create_model/add_label/...`
  - `mbr_role_v0.json` 仍残留旧 `mbr_matrix_room_id / mbr_mqtt_*` 配置标签
- Result: PASS
- Commit:

### Step 3 — Sliding UI -> ui-server 路径审计

- Command:
- `sed -n ... packages/ui-renderer/src/renderer.mjs`
- `sed -n ... packages/ui-model-demo-frontend/src/remote_store.js`
- `sed -n ... packages/ui-model-demo-frontend/src/local_bus_adapter.js`
- `apply_patch` 写入 `docs/logs/0176-worker-spec-audit/sliding_ui_to_server_audit.md`
- Key output:
- 已确认：
  - 标准链路是 `renderer -> mailbox -> /ui_event -> server mailbox`
  - `LocalBusAdapter.submodel_create` 直接 `runtime.createModel()`
  - generic `label_add/update/remove/cell_clear` 不走 owner/submodel gate
  - datatable 路径允许直接接触负数系统模型
  - owner-chain 目前只覆盖 FillTable preview/apply
- Result: PASS
- Commit:

### Step 4 — 手工填表案例设计与代表性复验

- Command:
- `apply_patch` 更新 `docs/logs/0176-worker-spec-audit/manual_case_catalog.md`
- `node --input-type=module <<'NODE' ... runtime.applyPatch(add_label model_id=1) ... NODE`
- `node --input-type=module <<'NODE' ... createLocalBusAdapter + submodel_create ... NODE`
- `node --input-type=module <<'NODE' ... addLabel(submt @ (1,0,0)) ... NODE`
- `apply_patch` 写入：
  - `docs/logs/0176-worker-spec-audit/case_runs/2026-03-07-case-02-auto-create-on-add-label.md`
  - `docs/logs/0176-worker-spec-audit/case_runs/2026-03-07-case-03-ui-submodel-create-bypass.md`
  - `docs/logs/0176-worker-spec-audit/case_runs/2026-03-07-case-09-submt-wrong-position.md`
- Key output:
- 已产出 10 个手工 case，覆盖 bootstrap / owner / submodel / pin routing / 非法绕过
- 真实复验 3 个高价值反例：
  - `Case 02`：`allowCreateModel=true` 时，`add_label` 会隐式补建 `model_1`
  - `Case 03`：UI `submodel_create` 无 `submt` 仍可直接建 `M1`
  - `Case 09`：`submt` 写在 `(1,0,0)` 仍会登记 `parentChildMap` 并 auto-create 子模型
- Result: PASS
- Commit:

### Step 5 — 发现汇总与改进建议

- Command:
- `apply_patch` 更新 `docs/logs/0176-worker-spec-audit/findings_and_recommendations.md`
- Key output:
- 已汇总当前最高优先级问题：
  - 通用建模旁路
  - owner-chain 覆盖不足
  - UI/server orchestration 放宽系统模型与正数模型写权限
  - MBR 桥接权限过宽
  - “空态 runtime”与 seeded runtime 混淆
- 已给出 6 条规约/实现建议，并预留后续 remediation iteration 候选
- Result: PASS
- Commit:

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
