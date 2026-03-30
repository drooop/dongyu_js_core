---
id: 0153-cognition-feedback-loop
doc_type: iteration-resolution
status: planned
source: ai
updated: 2026-03-21
title: "0153 — Resolution (HOW) v2"
iteration_id: 0153-cognition-feedback-loop
phase: phase1
---

# 0153 — Resolution (HOW) v2

## 0. Execution Rules
- Work branch: `dev_0153-cognition-feedback-loop`
- Depends on: `0152` 已 Completed，且本迭代 Phase 2 Review Gate 已明确 `Approved` 才能进入执行。
- Steps 必须顺序执行；每个 step 至少 1 个可执行验证命令。
- 真实命令输出、PASS/FAIL、commit hash 只写入 `runlog.md`。
- 禁止修改 `packages/worker-base/src/runtime.js` / `runtime.mjs`。

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Model ID Registry 对齐 | 确认并登记 Model -3(login) + Model -12(cognition) | `CLAUDE.md` | `rg` 检查 registry | 模型号无冲突、语义明确 | revert `CLAUDE.md` |
| 2 | 认知模型 seed | 新建 `Model -12` + `scene_context` 初值 | `system-models/cognition_scene_model.json` | `jq` + `/snapshot` | 启动后存在且结构正确 | 删除 patch 文件 |
| 3 | 生命周期 schema | 增加 `action_lifecycle` 默认 label | `system-models/cognition_lifecycle_model.json` | `/snapshot` 检查 | `Model -1` 可见 lifecycle | 删除 patch 文件 |
| 4 | 认知函数落地 | 新增 `update_scene_context` function label | `system-models/cognition_handlers.json` | `jq` + `rg` | 函数可被 runtime 发现 | 删除 patch 文件 |
| 5 | Trigger 链扩展 | `event_trigger_map.ui_event` 改为认知优先 | `system-models/intent_dispatch_config.json` | `jq` 检查顺序 | `update_scene_context` 在 `forward_ui_events` 前 | revert 该 json |
| 6 | Dispatch 入口生命周期 | dispatch 前写 `executing` + `started_at` | `server.mjs` | `/ui_event` + `/snapshot` | 每次命中 dispatch 先进入 executing | revert `server.mjs` |
| 7 | Dispatch 出口生命周期 | dispatch 后写 `completed/failed` + result | `server.mjs` | 正负用例各 1 条 | 状态跃迁准确且可观测 | revert `server.mjs` |
| 8 | 反馈闭环 | 将上一条 action 结果回灌 scene_context | `cognition_handlers.json` | 连续两次 action 验证 | `last_action_result` 正确更新 | revert handler patch |
| 9 | SSOT 文档同步 | 架构/语义/registry 文档更新 | `docs/architecture...`, `docs/ssot/...`, `CLAUDE.md` | `rg` 命中检查 | 文档与实现一致 | revert docs |
| 10 | 全量回归与收口 | baseline + 功能回归 + 扩展性验证 | runlog + `docs/ITERATIONS.md` | 测试命令矩阵 | 全 PASS 才可标 Completed | 保持 In Progress |

## 2. Step Details

### Step 1 — Model ID Registry 对齐
**Goal**
- 消除 0153 草案与现状冲突：`Model -3` 保持 login 专用，认知模型固定为 `Model -12`。

**Scope**
- 更新 `CLAUDE.md` 的 `MODEL_ID_REGISTRY`：
  - 增加 `Model -3`（login form / auth ui model）说明。
  - 增加 `Model -12`（cognition scene context）说明。

**Files**
- Update:
  - `CLAUDE.md`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`

**Validation (Executable)**
- Commands:
  - `rg -n "Model -3|Model -12|MODEL_ID_REGISTRY" CLAUDE.md`
- Expected signals:
  - `Model -3` 与 `Model -12` 均有明确用途描述，且无冲突语义。

**Acceptance Criteria**
- 模型号分配与当前代码事实一致（`LOGIN_MODEL_ID=-3`）。

**Rollback Strategy**
- `git checkout -- CLAUDE.md`（仅回滚该文件）。

---

### Step 2 — 认知模型 seed（Model -12 + scene_context）
**Goal**
- 在 system-model patch 中声明认知模型与默认 `scene_context`。

**Scope**
- 新建 `packages/worker-base/system-models/cognition_scene_model.json`：
  - `create_model` for `model_id=-12`
  - `add_label scene_context`（`t=json`）

**Default schema**
```json
{
  "current_app": 100,
  "active_flow": null,
  "flow_step": 0,
  "recent_intents": [],
  "last_action_result": null,
  "session_vars": {}
}
```

**Files**
- Create:
  - `packages/worker-base/system-models/cognition_scene_model.json`

**Validation (Executable)**
- Commands:
  - `jq -e '.records | length >= 2' packages/worker-base/system-models/cognition_scene_model.json`
  - `PORT=9010 DY_AUTH=0 bun packages/ui-model-demo-server/server.mjs`
  - `curl -sS http://127.0.0.1:9010/snapshot | jq '.snapshot.models["-12"].cells["0,0,0"].labels.scene_context'`
- Expected signals:
  - `scene_context` label 存在，字段完整。

**Acceptance Criteria**
- 启动后 snapshot 中稳定可见 `Model -12` 与默认 `scene_context`。

**Rollback Strategy**
- 删除新增 patch 文件并恢复到上一个提交。

---

### Step 3 — action_lifecycle schema
**Goal**
- 将 action 生命周期统一到 `Model -1 cell(0,0,1)`。

**Scope**
- 新建 `packages/worker-base/system-models/cognition_lifecycle_model.json`，写入默认 label：
```json
{
  "op_id": "",
  "action": "",
  "status": "idle",
  "started_at": 0,
  "completed_at": null,
  "result": null,
  "confidence": 1.0
}
```

**Files**
- Create:
  - `packages/worker-base/system-models/cognition_lifecycle_model.json`

**Validation (Executable)**
- Commands:
  - `jq -e '.records[] | select(.k=="action_lifecycle" and .model_id==-1 and .t=="json")' packages/worker-base/system-models/cognition_lifecycle_model.json`
  - `curl -sS http://127.0.0.1:9010/snapshot | jq '.snapshot.models["-1"].cells["0,0,1"].labels.action_lifecycle'`
- Expected signals:
  - `action_lifecycle` 默认值存在且 `confidence=1.0`。

**Acceptance Criteria**
- lifecycle label 在未触发 action 前可读，结构稳定。

**Rollback Strategy**
- 删除该 patch 文件并恢复。

---

### Step 4 — update_scene_context 函数落地
**Goal**
- 在 Model -10 注册 `update_scene_context`，负责场景增量更新。

**Scope**
- 新建 `packages/worker-base/system-models/cognition_handlers.json`：
  - `k=update_scene_context`, `t=function`
  - 读取 `ui_event`、`scene_context`、`action_lifecycle`
  - 更新 `current_app/recent_intents/last_action_result`
  - `recent_intents` 上限 20
  - try/catch 写 `mgmt_func_error`，不抛出阻断

**Files**
- Create:
  - `packages/worker-base/system-models/cognition_handlers.json`

**Validation (Executable)**
- Commands:
  - `jq -e '.records[] | select(.k=="update_scene_context" and .t=="function" and .model_id==-10)' packages/worker-base/system-models/cognition_handlers.json`
  - `rg -n "update_scene_context" packages/worker-base/system-models/*.json`
- Expected signals:
  - 函数 label 可被加载，名称与 dispatch/trigger 配置一致。

**Acceptance Criteria**
- 系统模型中存在且仅存在一个目标函数定义。

**Rollback Strategy**
- 删除该 patch 文件并恢复。

---

### Step 5 — event_trigger_map 链扩展
**Goal**
- 使 `ui_event` 先更新认知，再走 forward。

**Scope**
- 修改 `packages/worker-base/system-models/intent_dispatch_config.json`：
  - `event_trigger_map.ui_event = ["update_scene_context", "forward_ui_events"]`

**Files**
- Update:
  - `packages/worker-base/system-models/intent_dispatch_config.json`

**Validation (Executable)**
- Commands:
  - `jq -e '.records[] | select(.k=="event_trigger_map") | .v.ui_event[0]=="update_scene_context" and .v.ui_event[1]=="forward_ui_events"' packages/worker-base/system-models/intent_dispatch_config.json`
- Expected signals:
  - 顺序严格满足“认知优先”。

**Acceptance Criteria**
- 触发链上 `update_scene_context` 先于 `forward_ui_events`。

**Rollback Strategy**
- 回退 `intent_dispatch_config.json` 到上一个版本。

---

### Step 6 — dispatch 入口写 executing
**Goal**
- 在 `submitEnvelope` 命中 dispatch 时先写 lifecycle executing。

**Scope**
- 修改 `packages/ui-model-demo-server/server.mjs`：
  - dispatch 命中后、`programEngine.tick()` 前写 `action_lifecycle`：
    - `status="executing"`
    - `started_at=Date.now()`
    - `completed_at=null`
    - `result=null`

**Files**
- Update:
  - `packages/ui-model-demo-server/server.mjs`

**Validation (Executable)**
- Commands:
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `curl -sS -X POST http://127.0.0.1:9010/ui_event -H 'content-type: application/json' -d '{"payload":{"action":"docs_refresh_tree","meta":{"op_id":"s6-1"}}}'`
  - `curl -sS http://127.0.0.1:9010/snapshot | jq '.snapshot.models["-1"].cells["0,0,1"].labels.action_lifecycle.v'`
- Expected signals:
  - 在执行路径中可观测到 `status=executing`（至少瞬态或最终记录带 started_at）。

**Acceptance Criteria**
- 所有 dispatch 命中路径都会写入 lifecycle executing 起点。

**Rollback Strategy**
- 仅回退 `server.mjs` 中 lifecycle 入口变更。

---

### Step 7 — dispatch 出口写 completed/failed
**Goal**
- 将 dispatch 结果规范化写入 lifecycle 终态。

**Scope**
- 修改 `server.mjs` dispatch 出口：
  - 成功：`status=completed`, `completed_at=Date.now()`, `result={ok:true}`
  - 失败：`status=failed`, `result={code, detail}`
  - 错误来源统一：`ui_event_error` + `mgmt_func_error`

**Files**
- Update:
  - `packages/ui-model-demo-server/server.mjs`

**Validation (Executable)**
- Commands:
  - 正向：`docs_refresh_tree`
  - 负向：先写非法路径后触发 `docs_open_doc`
    - `curl -sS -X POST http://127.0.0.1:9010/api/modeltable/patch -H 'content-type: application/json' -d '{"patch":{"version":"mt.v0","op_id":"s7-set-path","records":[{"op":"add_label","model_id":-2,"p":0,"r":0,"c":0,"k":"docs_selected_path","t":"str","v":"../../../etc/passwd"}]}}'`
    - `curl -sS -X POST http://127.0.0.1:9010/ui_event -H 'content-type: application/json' -d '{"payload":{"action":"docs_open_doc","meta":{"op_id":"s7-err"}}}'`
  - `curl -sS http://127.0.0.1:9010/snapshot | jq '.snapshot.models["-1"].cells["0,0,1"].labels.action_lifecycle.v'`
- Expected signals:
  - 正向终态 `completed`。
  - 负向终态 `failed` 且 `result.code/detail` 非空。

**Acceptance Criteria**
- lifecycle 终态与真实执行结果一致，无“误报 ok”。

**Rollback Strategy**
- 回退 `server.mjs` 生命周期出口逻辑。

---

### Step 8 — 反馈闭环（last_action_result）
**Goal**
- 将上一条 action 结果回灌到 `scene_context.last_action_result`。

**Scope**
- 扩展 `update_scene_context`：
  - 每次处理新 `ui_event` 时读取当前 `action_lifecycle`
  - 将“上一条已完成动作”的结果写入 `last_action_result`
  - 不引入历史队列，仅保留最近一次结果

**Files**
- Update:
  - `packages/worker-base/system-models/cognition_handlers.json`

**Validation (Executable)**
- Commands:
  - 连续触发 A/B 两个 action：
    - `docs_refresh_tree`（A）
    - `docs_search`（B）
  - `curl -sS http://127.0.0.1:9010/snapshot | jq '.snapshot.models["-12"].cells["0,0,0"].labels.scene_context.v.last_action_result'`
- Expected signals:
  - `last_action_result` 对应 A 的结果，并在 B 执行时更新。

**Acceptance Criteria**
- 认知层可读取到上一轮行动反馈。

**Rollback Strategy**
- 回退 `cognition_handlers.json`。

---

### Step 9 — SSOT 文档同步
**Goal**
- 将四环语义与模型分配正式写入 SSOT。

**Scope**
- 更新：
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `CLAUDE.md`（若 Step 1 未全覆盖）

**Files**
- Update:
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `CLAUDE.md`

**Validation (Executable)**
- Commands:
  - `rg -n "scene_context|action_lifecycle|Model -12|四环|feedback" __DY_PROTECTED_WL_0__ __DY_PROTECTED_WL_1__ CLAUDE.md`
- Expected signals:
  - 三份文档均命中关键术语，且语义一致。

**Acceptance Criteria**
- living docs 评估与更新在 runlog 有事实记录。

**Rollback Strategy**
- 回退上述文档文件。

---

### Step 10 — 全量回归与收口
**Goal**
- 在不退化 0152 能力前提下，完成 0153 新能力验证并收口迭代状态。

**Scope**
- 测试分类先声明：
  - unit: 本地脚本
  - e2e: 依赖 baseline
- 执行回归矩阵：docs/static/ws/model100 + cognition/lifecycle。

**Validation (Executable)**
- Commands:
  - `bash scripts/ops/ensure_runtime_baseline.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `node scripts/tests/test_cell_connect_parse.mjs`
  - `node scripts/tests/test_bus_in_out.mjs`
  - `node scripts/validate_builtins_v0.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `rg -n "test_echo_0153" packages/worker-base/system-models/*.json`
- Expected signals:
  - baseline PASS。
  - unit/validator PASS。
  - cognition/lifecycle 场景验证 PASS。

**Acceptance Criteria**
- 所有 Step 在 runlog 有 PASS 证据。
- 仅在全 PASS 时更新 `docs/ITERATIONS.md` 为 `Completed`；否则保持 `In Progress` 并标注阻断。

**Rollback Strategy**
- 任一关键验证失败时：
  - 回滚本 step 改动；
  - 在 runlog 标注失败点与恢复点；
  - 不推进状态收口。
