---
title: "0222 — local-cluster-rollout-baseline Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-03-24
source: ai
iteration_id: 0222-local-cluster-rollout-baseline
id: 0222-local-cluster-rollout-baseline
phase: phase3
---

# 0222 — local-cluster-rollout-baseline Runlog

## Environment

- Date: 2026-03-24
- Branch: `dropx/dev_0222-local-cluster-rollout-baseline`
- Runtime: local cluster baseline

## Execution Records

### Step 1 — Freeze Repo-side Baseline And Rollout Checklist

- Started: `2026-03-24 00:38:08 +0800`
- Command:
  - static contract guard:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0216_threejs_scene_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0217_gallery_extension_contract.mjs`
  - repo-side server-backed validator guard:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_sliding_flow_server_sse.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_three_scene_server_sse.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_server_sse.mjs`
  - rollout surface inventory:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "workspace_catalog_ui|workspace_positive_models|gallery_catalog_ui|/Users/drop/dongyu/volume/persist/assets|nodePort: 30900" scripts/ops/sync_local_persisted_assets.sh k8s/local/workers.yaml k8s/local/ui-side-worker.yaml k8s/local/ui-server-nodeport.yaml`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "matrix_debug_surface\\.json|formal UI surface is model-defined via matrix_debug_surface\\.json" packages/ui-model-demo-server/server.mjs packages/worker-base/system-models/matrix_debug_surface.json`
- Key output:
  - `0210-0217` static contract guard 合计 `40 passed, 0 failed`。
  - repo-side validator 全部显式输出 PASS：
    - `validate_matrix_debug_server_sse: PASS`
    - `validate_sliding_flow_server_sse: PASS`
    - `validate_ui_model_examples_server_sse: PASS`
    - `validate_three_scene_server_sse: PASS`
    - `validate_gallery_matrix_three_server_sse: PASS`
  - rollout surface inventory 命中以下 authoritative 面：
    - `scripts/ops/sync_local_persisted_assets.sh` 仍引用 `gallery_catalog_ui.json`、`workspace_catalog_ui.json`、`workspace_positive_models.json` 与 `/Users/drop/dongyu/volume/persist/assets`
    - `k8s/local/workers.yaml` 与 `k8s/local/ui-side-worker.yaml` 仍挂载 `/Users/drop/dongyu/volume/persist/assets`
    - `k8s/local/ui-server-nodeport.yaml:13` 仍暴露 `nodePort: 30900`
    - `packages/ui-model-demo-server/server.mjs` 仍把 formal UI surface 口径绑定到 `matrix_debug_surface.json`
  - repo 事实补充：
    - 当前仓库中的 `docs/` 是指向 `/Users/drop/Documents/drip/Projects/dongyuapp` 的权威 symlink；`runlog.md` 写入发生在该权威 docs 目录，当前 repo 用 Step marker commit 记录执行节拍
  - Step 1 结论：
    - 当前 repo 自身 `0210-0217` baseline 未见回归
    - `0222` authoritative rollout 面已冻结为 canonical local ops scripts、hostPath persisted assets、`k8s/local/*` manifests、live `30900` endpoint
    - `matrix_debug_surface.json` 等 formal surface 的实际 materialization 仍需在 Step 3 用 live `/snapshot` 证明，不能仅凭 repo 文件存在放行
- Conformance review:
  - tier placement：Step 1 仅做 repo-side 验证，不引入 Tier 1/Tier 2 边界变更
  - model placement：未新增/迁移 model，现阶段只确认 authoritative surface 仍由 model-defined assets 驱动
  - data ownership / data flow / data chain：未引入新写入路径；live materialization 与 cluster-visible flow 必须延后到 Step 3 以 `30900` 实证裁决
- Result: PASS
- Commit: `9c445fe` (`chore: record 0222 step1 baseline verification`)

### Step 2 — Re-apply Current Repo Baseline To Local Cluster

- Started: `2026-03-24 00:39:45 +0800`
- Command:
  - preflight:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && kubectl config current-context`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && test -f deploy/env/local.env`
  - canonical rollout:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/ensure_runtime_baseline.sh`
- Key output:
  - `kubectl config current-context` 输出 `orbstack`
  - `test -f deploy/env/local.env` PASS
  - `bash scripts/ops/ensure_runtime_baseline.sh` 失败并返回：
    - `[baseline] no reachable kubernetes context found from candidates: docker-desktop orbstack`
  - 进一步定位：
    - 直接执行 `kubectl --context orbstack get ns` 时，sandbox 返回 `Unable to connect to the server: dial tcp 127.0.0.1:26443: connect: operation not permitted`
    - 结论不是 repo-side baseline 回归；而是当前 Codex shell sandbox 无法连接本机 OrbStack Kubernetes API socket，因此无法在本会话内完成 Step 2 的 canonical rollout/readiness 验证
  - `2026-03-24 00:50` 修复复跑：
    - `bash scripts/ops/check_runtime_baseline.sh` 再次返回：
      - 六个 deployment 均为 `readyReplicas=` 空值
      - `mbr-worker-secret.MODELTABLE_PATCH_JSON missing`
      - `ui-server-secret.MODELTABLE_PATCH_JSON missing`
      - 最终输出 `baseline NOT ready`
    - 该脚本内部的 `kubectl get ... 2>/dev/null || true` 吞掉了底层 socket 访问错误，因此结果只能证明当前 shell 没拿到 canonical 管理面 readiness 事实，不能单独作为“集群真 down”的最终裁决
- Conformance review:
  - tier placement / model placement：本步尚未进入任何 rollout 变更；未发生 model/runtime 侧写入
  - data ownership / data flow / data chain：按原 resolution，canonical readiness 缺失时不得直接放行；本次修复已在 resolution 补充 sandbox-bounded stale-only 规则，因此仅允许继续执行 Step 3 做 live stale adjudication，且不得输出 ready verdict
- Result: FAIL
- Commit: N/A（Step 2 未完成，未执行 Step marker commit）

### Step 3 — Prove Live Cluster Surface Matches 0210-0217 Baseline

- Started: `2026-03-24 00:50:29 +0800`
- Command:
  - rerun related verification commands:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && UI_SERVER_URL=http://127.0.0.1:30900 node scripts/tests/test_0145_workspace_single_submit.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`
  - live snapshot assertions:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-22"].cells["0,1,0"].labels.page_asset_v0.v.id == "root_home"'`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0.v.id == "matrix_debug_root"'`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-103"].cells["0,1,0"].labels.page_asset_v0 != null and .snapshot.models["-102"].cells["0,11,0"].labels.gallery_showcase_tab.v == "matrix"'`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '(.snapshot.models["-2"].cells["0,0,0"].labels.ws_apps_registry.v // []) as $apps | ([100,-100,-103,1003,1004,1005,1007] | all(. as $id | ($apps | map(.model_id) | index($id)))) and (($apps | map(.model_id) | index(1006)) | not) and (($apps | map(.model_id) | index(1008)) | not)'`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-12"].cells["0,0,0"].labels.scene_context != null and .snapshot.models["-1"].cells["0,0,1"].labels.action_lifecycle != null'`
  - live actual-state extraction:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -c '{home_model_name: .snapshot.models["-22"].name, home_cell_keys: (.snapshot.models["-22"].cells | keys), home_root_label_keys: (.snapshot.models["-22"].cells["0,0,0"].labels | keys)}'`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -c '{matrix_model_name: .snapshot.models["-100"].name, matrix_label_keys: (.snapshot.models["-100"].cells["0,0,0"].labels | keys), matrix_ui_root: .snapshot.models["-100"].cells["0,0,0"].labels.ui_ast_v0.v.id}'`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -c '{gallery_catalog_root: .snapshot.models["-103"].cells["0,0,0"].labels.ui_ast_v0.v.id, gallery_state_cells: (.snapshot.models["-102"].cells | keys)}'`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -c '{ws_registry_model_ids: ((.snapshot.models["-2"].cells["0,0,0"].labels.ws_apps_registry.v // []) | map(.model_id)), scene_context_present: (.snapshot.models["-12"].cells["0,0,0"].labels.scene_context != null), action_lifecycle_present: (.snapshot.models["-1"].cells["0,0,1"].labels.action_lifecycle != null)}'`
  - manual single-request roundtrip:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -c '{bg: .snapshot.models["100"].cells["0,0,0"].labels.bg_color.v, status: .snapshot.models["100"].cells["0,0,0"].labels.status.v, inflight: .snapshot.models["100"].cells["0,0,0"].labels.submit_inflight.v, ready: .snapshot.models["100"].cells["0,0,0"].labels.system_ready.v, err: .snapshot.models["-1"].cells["0,0,1"].labels.ui_event_error.v, last: .snapshot.models["-1"].cells["0,0,1"].labels.ui_event_last_op_id.v}'`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS -X POST http://127.0.0.1:30900/api/runtime/mode -H 'content-type: application/json' -d '{"mode":"running"}'`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS -X POST http://127.0.0.1:30900/ui_event -H 'content-type: application/json' -d '{"payload":{"action":"submit","source":"ui_renderer","meta":{"op_id":"fix0222_manual_submit","model_id":100},"value":{"t":"event","v":{"action":"submit","input_value":"","meta":{"op_id":"fix0222_manual_submit","model_id":100}}}}}'`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -c '{bg: .snapshot.models["100"].cells["0,0,0"].labels.bg_color.v, status: .snapshot.models["100"].cells["0,0,0"].labels.status.v, inflight: .snapshot.models["100"].cells["0,0,0"].labels.submit_inflight.v, ready: .snapshot.models["100"].cells["0,0,0"].labels.system_ready.v, err: .snapshot.models["-1"].cells["0,0,1"].labels.ui_event_error.v, last: .snapshot.models["-1"].cells["0,0,1"].labels.ui_event_last_op_id.v}'`
- Key output:
  - rerun related verification commands:
    - `UI_SERVER_URL=http://127.0.0.1:30900 node scripts/tests/test_0145_workspace_single_submit.mjs` 返回：
      - `[FAIL] unexpected_error connect EPERM 127.0.0.1:30900 - Local (0.0.0.0:0)`
    - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900` 返回：
      - `[verify] base_url=http://127.0.0.1:30900`
      - `curl: (7) Failed to connect to 127.0.0.1 port 30900 after 0 ms: Could not connect to server`
    - 结论：当前 shell 内的 Node.js client / multi-request shell 脚本依然会命中 localhost socket 限制，因此不能直接作为 live verdict 的唯一依据
  - live snapshot assertions:
    - Home page asset assertion: `false`
    - Matrix debug surface assertion: `false`
    - Gallery asset assertion: `false`
    - Workspace registry assertion: `false`
    - `scene_context` / `action_lifecycle` assertion: `true`
  - live actual-state extraction:
    - Home 实际值：
      - `{"home_model_name":"home_catalog","home_cell_keys":["0,0,0"],"home_root_label_keys":["model_type","ui_ast_v0"]}`
      - 说明 live `-22` 仍是旧 `ui_ast_v0` root，且不存在 `0,1,0.page_asset_v0`
    - Matrix debug 实际值：
      - `{"matrix_model_name":"bus_trace","matrix_label_keys":["app_name","data_type","end_pos","size_max","size_now","source_worker","start_pos","trace_avg_latency","trace_count","trace_enabled","trace_error_rate","trace_last_update","trace_log_text","trace_status","trace_throughput","trace_uptime","ui_ast_v0"],"matrix_ui_root":"trace_root"}`
      - 说明 live `-100` 仍是旧 `Bus Trace` surface，而不是 `matrix_debug_root`
    - Gallery 实际值：
      - `{"gallery_catalog_root":"root","gallery_state_cells":["0,0,0","0,1,0","0,10,0","0,10,1","0,2,0","0,3,0","0,3,1","0,4,0","0,5,0","0,6,0","0,7,0","0,8,0","0,8,1","0,9,0","0,9,1","0,9,3"]}`
      - 说明 live `-103/-102` 仍是旧 Gallery catalog/state 结构，不存在 `0,1,0.page_asset_v0` 或 `0,11,0.gallery_showcase_tab`
    - Workspace registry / flow 前提：
      - `{"ws_registry_model_ids":[-103,-100,1,2,100,1001,1002],"scene_context_present":true,"action_lifecycle_present":true}`
      - 说明 `scene_context` / `action_lifecycle` 已存在，但 registry 仍缺少 `1003/1004/1005/1007`，且仍暴露旧 `1/2/1001/1002`
  - manual single-request roundtrip:
    - 初始状态：
      - `{"bg":"#fce5af","status":"processed","inflight":false,"ready":true,"err":null,"last":"route_1774258445259_13cabb83ae814"}`
    - `POST /api/runtime/mode`：
      - `{"ok":true,"mode":"running"}`
    - `POST /ui_event`：
      - `{"ok":true,"consumed":true,"result":"ok","ui_event_last_op_id":"fix0222_manual_submit","ui_event_error":null}`
    - 提交后状态：
      - `{"bg":"#59667c","status":"processed","inflight":false,"ready":true,"err":null,"last":"fix0222_manual_submit"}`
    - 说明 live environment 仍可完成 `Model 100` submit roundtrip，但该 roundtrip 发生在旧 UI/catalog baseline 上，不足以证明 0210-0217 rollout 已到位
  - Final verdict:
    - `Local cluster stale`
- Conformance review:
  - tier placement：本步没有修改 runtime / worker / model placement；裁决完全基于 live `30900` surface 的事实
  - model placement：live `-22`、`-100`、`-103` 仍 materialize 为旧 `ui_ast_v0`/旧 catalog 结构，未达到 0210-0217 约定的 page-asset / registry placement
  - data ownership：repo authoritative assets 已在 Step 1 冻结，但 live cluster 仍暴露旧 truth，说明当前 cluster-visible ownership 没有对齐到 repo baseline
  - data flow：`scene_context` / `action_lifecycle` 与 `Model 100` submit chain 仍工作，表明系统不是整体宕机，而是“可运行但仍是旧环境”
  - data chain：submit chain alive 但 Home / Matrix debug / Gallery / Workspace registry 仍来自旧 rollout，因此当前 live chain 与仓库期望链路不一致
- Result: FAIL (`Local cluster stale`)
- Commit: `374ee88` (`chore: record 0222 stale local cluster verdict`; current repo uses empty step-marker commit because authoritative `docs/` content lives behind the symlink target)

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] local deploy runbooks reviewed
- [x] `docs/iterations/0222-local-cluster-rollout-baseline/resolution.md` updated with sandbox-bounded stale-only adjudication rule
- [x] `docs/ITERATIONS.md` status updated to `Completed`

```
Review Gate Record
- Iteration ID: 0222-local-cluster-rollout-baseline
- Review Date: 2026-03-23
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: 评审结论已就绪：**APPROVED**，无 blocking issue，两条非阻塞 suggestion。等待确认退出计划模式。
```

```
Review Gate Record
- Iteration ID: 0222-local-cluster-rollout-baseline
- Review Date: 2026-03-23
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 2
- Decision: APPROVED
- Revision Type: N/A
- Notes: Review 已完成，上方即为完整评审输出。APPROVED，无阻塞项。
```

```
Review Gate Record
- Iteration ID: 0222-local-cluster-rollout-baseline
- Review Date: 2026-03-23
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 3
- Decision: APPROVED
- Revision Type: N/A
- Notes: effort_suggestion: medium — 评审范围已收敛，两个文件 + ITERATIONS.md 对照即可完成判定。
```

```
Review Gate Record
- Iteration ID: 0222-local-cluster-rollout-baseline
- Review Date: 2026-03-23
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 1
- Decision: NEEDS_CHANGES
- Revision Type: major
- Notes: 审查已完成。上方 JSON verdict 即为最终输出：**NEEDS_CHANGES (major)** — Step 2/3 未完成，核心交付物缺失。
```

```
Review Gate Record
- Iteration ID: 0222-local-cluster-rollout-baseline
- Review Date: 2026-03-23
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 2
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查已完成。上方 JSON verdict 即为最终输出：**APPROVED** — 三个 Step 均有完整执行记录和 evidence，`Local cluster stale` 是 resolution 定义的合法终态，交付完整。唯一 minor suggestion 是 resolution.md frontmatter 同步。
```

```
Review Gate Record
- Iteration ID: 0222-local-cluster-rollout-baseline
- Review Date: 2026-03-23
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 3
- Decision: APPROVED
- Revision Type: minor
- Notes: 0222 交付完整：repo baseline 验证 PASS，live cluster 裁定为 stale，resolution 定义的两种合法终态之一已达成。resolution.md frontmatter 未同步为唯一 minor 瑕疵。
```

```
Review Gate Record
- Iteration ID: 0222-local-cluster-rollout-baseline
- Review Date: 2026-03-23
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 4
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查已完成，verdict JSON 在上方。等待确认。
```
