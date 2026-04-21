---
title: "Iteration 0163-cleanup-deprecated-labels Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0163-cleanup-deprecated-labels
id: 0163-cleanup-deprecated-labels
phase: phase3
---

# Iteration 0163-cleanup-deprecated-labels Runlog

## Environment

- Date: 2026-03-06
- Branch: `dev_0163-cleanup-deprecated-labels`
- Runtime: Node.js
- fill-table-only: OFF required for 0163（执行前确认）

## Execution Records

### Step 0 — Scaffold + Plan/Resolution filed

- Command:
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0163-cleanup-deprecated-labels --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output:
  - `plan.md / resolution.md / runlog.md` created
- Result: PASS
- Commit: N/A

### Step 1 — Runtime 兼容层清理

- Scope:
  - 移除 alias map
  - 移除函数字符串 value 兼容
  - 移除旧 `pin.connect.label` 对象值格式兼容
- Files:
  - `packages/worker-base/src/runtime.mjs`
  - `scripts/worker_engine_v0.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/run_worker_remote_v0.mjs`
  - `scripts/run_worker_ui_side_v0.mjs`
  - `scripts/validate_mbr_patch_v0.mjs`
- Result: PASS

### Step 2 — 测试与 fixture 口径同步

- Files:
  - `scripts/tests/test_0141_integration.mjs`
  - `scripts/tests/test_0142_integration.mjs`
  - `scripts/tests/test_0143_e2e.mjs`
  - `scripts/tests/test_0144_remote_worker.mjs`
  - `scripts/tests/test_async_function_engine.mjs`
  - `scripts/tests/test_bus_in_out.mjs`
  - `scripts/tests/test_cell_connect_parse.mjs`
  - `scripts/tests/test_cell_connection_route.mjs`
  - `scripts/tests/test_model_in_out.mjs`
  - `scripts/tests/test_submodel_connect.mjs`
  - `scripts/tests/test_0158_func_value_compat.mjs`
  - `scripts/tests/test_0161_worker_engine_funcjs.mjs`
  - `scripts/tests/fixtures/test_model0_framework.json`
  - `scripts/tests/fixtures/test_cell_connect_model.json`
  - `scripts/validate_model100_records_e2e_v0.mjs`
- Key updates:
  - `pin.connect.label` 统一数组路由格式 `[{from,to}]`
  - `func.js` 统一结构化 value：`{ code, modelName }`
  - 路由写入类型统一到 `pin.in`

### Step 3 — 显式测试清单

- Command:
  - 017 个 tests 显式清单（含 `test_0158_*`、`test_0161_*`）
- Result:
  - 全部 PASS
- Artifact:
  - `/tmp/iter0163_final_20260306_023053.log`

### Step 4 — validate 清单

- Command:
  - 8 个 validate 显式清单
- Result:
  - PASS（8/8）:
    - `validate_builtins_v0`
    - `validate_mbr_patch_v0`
    - `validate_model100_records_e2e_v0`
    - `validate_program_model_loader_v0`
    - `validate_intent_dispatch_pin_v0`
    - `validate_dual_bus_harness_v0`（带 `--matrix_room_id`）
    - `validate_mailbox_to_matrix_v0`（带 `--matrix_room_id`）
    - `validate_modeltable_persistence_v0`
  - Matrix 参数来源：
    - `kubectl -n dongyu exec deploy/ui-server -- env | rg '^MATRIX_|DY_MATRIX_ROOM_ID'`
    - `MATRIX_HOMESERVER_URL`（本机可达）=`http://192.168.194.216:8008`
    - `DY_MATRIX_ROOM_ID`=`!sPvNeZvMXlixVcsJJC:localhost`
  - 认证与限流处理：
    - `drop` 账号密码登录命中过 `429 M_LIMIT_EXCEEDED`（`retry_after_ms`）
    - 按重试窗口后获取 `drop` token，并使用 `MATRIX_MBR_ACCESS_TOKEN` 执行 Matrix validate，避免重复 password login 触发限流
- Artifact:
  - `/tmp/iter0163_final_20260306_023053.log`

### Step 5 — 旧类型零残留门控

- Note:
  - 本机 `grep` 不支持 GNU `--glob`，改用 `rg --glob` 等价执行。
  - 同时排除 `dist` 产物与 `.legacy` 文件（非活跃源码）。
- Command result:
  - 结构性旧类型字符串：0 命中
  - JSON `\"t\":\"function\"`：0 命中
  - JS/MJS `.t === 'function'` / `.t === \"function\"`：0 命中
- Artifacts:
  - `/tmp/0163_grep1.log`
  - `/tmp/0163_grep2.log`
  - `/tmp/0163_grep3.log`

### Step 6 — `pin.table/pin.single` 语义切换 + 认证隔离

- Requirement delta:
  - `model_id=0`：仅 `pin.bus.in|pin.bus.out`（连接外部总线）
  - 其他模型 `(0,0,0)`：`pin.table.in|pin.table.out`
  - `model.single`：`pin.single.in|pin.single.out`
  - `ui-server`：移除 `MATRIX_MBR_BOT_ACCESS_TOKEN` 注入
- Files:
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/server_config.json`
  - `scripts/tests/test_model_in_out.mjs`
  - `scripts/tests/test_submodel_connect.mjs`
  - `scripts/tests/test_0142_integration.mjs`
  - `scripts/tests/test_0158_new_label_types.mjs`
  - `scripts/validate_dual_bus_harness_v0.mjs`
  - `k8s/local/workers.yaml`
  - `k8s/cloud/workers.yaml`
  - `scripts/ops/start_local_ui_server_k8s_matrix.sh`
- Runtime verification:
  - tests 显式清单（17 个）PASS
  - 关键新增断言 PASS：
    - `model.single` 拒绝 `pin.table.in`
    - `model.single` 接受 `pin.single.in`
    - `model_id=0` 拒绝 `pin.table.in`
- Matrix validation with explicit args:
  - `validate_dual_bus_harness_v0.mjs --case all --matrix_room_id <ROOM>`: PASS
  - `validate_mailbox_to_matrix_v0.mjs --matrix_room_id <ROOM>`: PASS
- Additional fixes:
  - `scripts/validate_program_model_loader_v0.mjs`：`connect_allowlist` 从旧 `t:'connect'` 断言改为 `pin.connect.label/cell/model` 路由表断言
  - 全量 validate 复跑后，sqlite/matrix 前置均已满足并通过
- Deploy/runtime verification:
  - `kubectl -n dongyu set env deploy/ui-server MATRIX_MBR_BOT_ACCESS_TOKEN-`
  - `kubectl -n dongyu rollout status deploy/ui-server --timeout=180s`
  - `kubectl -n dongyu get deploy ui-server -o json | jq -r '.spec.template.spec.containers[0].env[]?.name' | rg 'MATRIX_MBR'`
  - 输出仅包含：`MATRIX_MBR_USER`, `MATRIX_MBR_BOT_USER`, `MATRIX_MBR_PASSWORD`

### Step 7 — 最终门控复跑（grep + validate 全清单）

- grep gate:
  - `/tmp/0163_gate1.log`: 0
  - `/tmp/0163_gate2.log`: 0
  - `/tmp/0163_gate3.log`: 0
  - `/tmp/0163_gate4.log`: 0
- validate gate（8/8）:
  - 统一环境：`MATRIX_HOMESERVER_URL=http://192.168.194.216:8008`
  - 认证：`MATRIX_MBR_USER=@drop:localhost` + `MATRIX_MBR_ACCESS_TOKEN=<drop_token>`
  - Matrix 用例参数：`--matrix_room_id !sPvNeZvMXlixVcsJJC:localhost`
  - 结果：全部 PASS

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed（当前迭代无新增改动需求）
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed（当前迭代无新增改动需求）
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed（当前迭代无新增改动需求）

## Completion

- Iteration status: Completed
- DoD:
  - resolution steps executed and recorded
  - grep gate 4/4 = 0 hit
  - validate gate 8/8 = PASS
  - iteration index updated to Completed
