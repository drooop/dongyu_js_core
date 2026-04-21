---
title: "Iteration 0177-worker-boundary-remediation Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0177-worker-boundary-remediation
id: 0177-worker-boundary-remediation
phase: phase3
---

# Iteration 0177-worker-boundary-remediation Runlog

## Environment

- Date: 2026-03-08
- Branch: `dev_0177-worker-boundary-remediation`
- Runtime: local repo + OrbStack baseline + Feishu spec sync

Review Gate Record
- Iteration ID: 0177-worker-boundary-remediation
- Review Date: 2026-03-08
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: 用户明确批准“trusted bootstrap 直写 + 全局运行模式 + 单向激活 + 禁止兼容/补全”方案，并要求开始实施。

## Execution Records

### Step 1 — 建立 iteration 与 Feishu 规约映射

- Command:
- `git checkout -b dev_0177-worker-boundary-remediation`
- `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0177-worker-boundary-remediation --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- `python3 - <<'PY' ... FeishuClient.get_raw_content(...) ... PY`
- `apply_patch` 更新 `docs/ITERATIONS.md` 与 `docs/iterations/0177-worker-boundary-remediation/*`
- Key output:
- `0177` 已登记到索引并切到专用分支。
- 已确认 Feishu 最新口径：
  - `mqtt.*` 仅在 `model_id=0` `(0,0,0)` 生效
  - `matrix.*` 仅在 `model_id=0` `(0,0,0)` 生效
  - `submt` 占位单元格除引脚标签外不得保留其他标签
- Result: PASS
- Commit: N/A

### Step 2 — 合同测试先红

- Command:
- `node scripts/tests/test_0177_runtime_mode_contract.mjs`
- `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
- `node scripts/tests/test_0177_submt_mapping_contract.mjs`
- `node scripts/tests/test_0177_mbr_bridge_contract.mjs`
- Key output:
- 初始 FAIL 点与目标合同一致：
  - runtime 尚未完整暴露 / 应用 `runtime_mode`
  - `submodel_create` / `/api/modeltable/patch` 仍是旁路
- `submt` hosting Cell 仍允许非 `pin.*` 混写
- MBR 拒绝 generic CRUD 时还没把错误写回表
- Result: PASS
- Commit: N/A

### Step 3 — 实现运行模式与旁路封堵

- Command:
- `apply_patch` 更新 runtime / matrix_live / worker_engine / run_worker / local_bus_adapter / server / mbr_role_v0 / verify scripts`
- `node scripts/tests/test_0177_runtime_mode_contract.mjs`
- `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
- `node scripts/tests/test_0177_submt_mapping_contract.mjs`
- `node scripts/tests/test_0177_mbr_bridge_contract.mjs`
- `node scripts/tests/test_0167_ui_server_matrix_token_auth.mjs`
- `node scripts/tests/test_0175_matrix_patch_bootstrap_contract.mjs`
- `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
- `node scripts/tests/test_0144_remote_worker.mjs`
- `bash -n scripts/ops/verify_model100_submit_roundtrip.sh`
- `bash -n scripts/ops/verify_0155_prompt_filltable.sh`
- `bash -n scripts/ops/verify_llm_dispatch_roundtrip.sh`
- Key output:
- 已实现：
  - `runtime_mode=boot/edit/running`
  - trusted bootstrap-only `create_model`
  - `submt` hosting Cell 非引脚标签 purge/reject
  - `ui-server` 默认 `edit` + `/api/runtime/mode`
  - `LocalBusAdapter` 直写禁用
  - MBR generic CRUD 拒绝并写 `mbr_mgmt_error`
  - 旧 `/api/modeltable/patch` 旁路禁用后，相关验收脚本改为走 `ui_event` 本地状态写入或显式 `running` 激活
- 0177 合同测试全部 PASS
- 0167 / 0175 回归合同全部 PASS
- `test_0144_remote_worker` 回归 PASS
- Result: PASS
- Commit: `d776105`, `ba8978b`, `502565b`

### Step 4 — OrbStack 基线与反例复验

- Command:
- `bash scripts/ops/deploy_local.sh`
- `bash scripts/ops/check_runtime_baseline.sh`
- `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`
- `docker build --no-cache -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`
- `docker build --no-cache -f k8s/Dockerfile.remote-worker -t dy-remote-worker:v3 .`
- `docker build --no-cache -f k8s/Dockerfile.mbr-worker -t dy-mbr-worker:v2 .`
- `kubectl -n dongyu rollout restart deployment/ui-server deployment/mbr-worker deployment/remote-worker`
- Key output:
- `deploy_local.sh` 在获取 `@mbr` token 时命中 Synapse 429，未走到镜像重建阶段
- 初次 clean verify 暴露两条环境事实：
  - 旧镜像仍在运行，`remote-worker` 继续按旧逻辑加载 `10_model100.json`
  - `ui-server` hostPath 中遗留 `runtime/default/yhl.db`，导致 clean verify 遇到 stale loading
- 处理：
  - 复用现有 room/token，手动重建 `dy-ui-server:v1` / `dy-remote-worker:v3` / `dy-mbr-worker:v2`
  - 备份并移走 `/Users/drop/dongyu/volume/persist/ui-server/runtime/default/yhl.db`
  - rollout restart `ui-server` / `mbr-worker` / `remote-worker`
- OrbStack baseline PASS
- Model 100 submit roundtrip PASS
- `runtime_mode_response={"ok":true,"mode":"running"}`
- `ui_event_last_op_id="verify_model100_1772905192"`
- `status` 从 `loading` 回到 `processed`
- `submit_inflight` 从 `true` 回到 `false`
- Result: PASS
- Commit: `502565b`

### Step 5 — 文档收口

- Command:
- `apply_patch` 更新 SSOT / user-guide / iteration docs / logs`
- `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Key output:
- 已同步：
  - `runtime_mode` 生命周期
  - trusted bootstrap 口径
- `submt` hosting Cell 约束
  - Matrix/MQTT Model 0 `(0,0,0)` 生效范围
- `obsidian_docs_audit` PASS（frontmatter / links / required fields 全部通过）
- Result: PASS
- Commit: N/A

### Step 6 — 浏览器泄露复现与 AST 收口

- Command:
- `node scripts/tests/test_0177_client_snapshot_secret_filter_contract.mjs`
- `apply_patch` 更新 `packages/ui-model-demo-server/server.mjs` 与 `scripts/tests/test_0177_client_snapshot_secret_filter_contract.mjs`
- `node --check packages/ui-model-demo-server/server.mjs`
- `node scripts/tests/test_0177_client_snapshot_secret_filter_contract.mjs`
- `bun packages/ui-model-demo-server/server.mjs` with temp env on `http://127.0.0.1:39123`
- `playwright` 打开 `http://127.0.0.1:39123` 并检查 DOM / `window.__DY_STORE` / `fetch('/snapshot')`
- Key output:
- 浏览器首页 DataTable 初始可见 `matrix_passwd` / `matrix_token` 及其值
- `/snapshot` 根模型标签已经过滤，但 `snapshot.models["-1"].cells["0,0,0"].labels.ui_ast_v0` 仍内嵌未过滤的 DataTable rows
- 根因：`updateDerived()` 用 `buildEditorAstV1(runtime.snapshot())` 生成 client-facing AST，绕过了 `buildClientSnapshot()` 过滤
- 修复：改为 `buildEditorAstV1(buildClientSnapshot(runtime))`
- 合同测试扩展后先 FAIL，再 PASS
- 浏览器复测：
  - `document.body.innerText` 不再包含 `matrix_token` / `matrix_passwd`
  - `window.__DY_STORE.snapshot` 不再包含敏感 key/value
  - `/snapshot` 序列化结果不再包含敏感 key/value
- Result: PASS
- Commit: N/A

### Step 7 — 导航切页恢复为标准 label_update 链路

- Command:
- `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
- `apply_patch` 更新 `packages/ui-model-demo-server/server.mjs` / `packages/ui-model-demo-frontend/src/demo_app.js` / `scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
- `node scripts/tests/test_0177_client_snapshot_secret_filter_contract.mjs`
- `npm -C packages/ui-model-demo-frontend run build`
- `bun packages/ui-model-demo-server/server.mjs` with temp env on `http://127.0.0.1:39124`
- `playwright` 点击 `Workspace` / `Docs` / `Prompt`，并在 Workspace 内点击 `Bus Trace`
- Key output:
- 浏览器稳定复现：`#/workspace` 已变化，但 `ui_page` 仍停在 `home`，页面内容不切换
- 根因：0177 server 侧只允许 `meta.local_only=true` 的 ui-local mutation；前端普通导航与 Workspace 选择走的是标准 `label_update`，因此被误判为 `direct_model_mutation_disabled`
- 修复：
  - server 改为只按 target model 是否属于 ui-local state 判断是否允许标准 direct label mutation，不再要求额外 `meta.local_only`
  - `selectWorkspaceModel()` 修正为发送 typed value `{ t: 'int', v: modelId }`
- 合同测试结果：
  - editor-state `label_update(ui_page)` PASS
  - business model `label_update(model_id=1)` 仍返回 `direct_model_mutation_disabled`
- 浏览器复测结果：
  - `#/workspace` 时 `ui_page=workspace`，无 `ui_event_error`
  - `#/docs` 时 `ui_page=docs`，Docs 页面内容正常出现
  - `#/prompt` 时 `ui_page=prompt`，Prompt 页面内容正常出现
  - Workspace 内点击 `Bus Trace` 后 `ws_app_selected=-100`，右侧内容切到 Bus Trace
- Result: PASS
- Commit: N/A

### Step 8 — Gallery Wave C 去除失效的 submodel_create 假功能

- Command:
- `node scripts/tests/test_0177_gallery_wave_c_contract.mjs`
- `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
- `apply_patch` 更新 `packages/ui-model-demo-frontend/src/gallery_model.js` / `packages/ui-model-demo-frontend/src/gallery_store.js` / `packages/ui-model-demo-server/server.mjs`
- `npm -C packages/ui-model-demo-frontend run build`
- `bun packages/ui-model-demo-server/server.mjs` with temp env on `http://127.0.0.1:39127`
- `playwright` 打开 `#/gallery` 并点击 `Materialize deferred fragment`
- Key output:
- 浏览器复现：Gallery Wave C 的 `Create submodel instance (2001)` 会稳定返回 `direct_model_mutation_disabled`
- 根因：
  - UI 仍暴露被 0177 禁掉的 `submodel_create`
  - 即使改成写 `-102`，server 默认 `LocalBusAdapter` 仍只认 `editor_state=-2`，导致 `gallery_state=-102` 被二次拦截
- 修复：
  - Wave C 改成 `label_update -> gallery_state(-102)` 物化 deferred fragment
  - `ui-server` 对允许的 ui-local model（如 `-102`）改走对应 model_id 的临时 local adapter
  - 不恢复 `submodel_create`，不增加专用导航/建模旁路
- 验证：
  - `test_0177_gallery_wave_c_contract` PASS
  - `test_0177_direct_model_mutation_disabled_contract` PASS（新增覆盖 `-102` label_update）
  - 浏览器中点击 `Materialize deferred fragment` 后：
    - `ui_event_error=null`
    - `snapshot.models["-102"].cells["0,9,2"].labels.wave_c_fragment_dynamic` 已落表
    - 页面出现 `Deferred Fragment (state-backed)`
  - 在 fragment 输入框中输入 `gallery fragment ok` 后：
    - `snapshot.models["-102"].cells["0,9,3"].labels.wave_c_dynamic_text = "gallery fragment ok"`
    - 页面同步显示更新后的文本
- Result: PASS
- Commit: N/A

### Step 9 — Model 100 颜色生成器迁回业务事件入口并使用负数 draft state

- Command:
- `node scripts/tests/test_0177_model100_submit_ui_contract.mjs`
- `node scripts/tests/test_0177_model100_input_draft_contract.mjs`
- `apply_patch` 更新 `packages/worker-base/system-models/workspace_positive_models.json` / `packages/ui-model-demo-frontend/src/model100_ast.js` / `scripts/tests/test_0177_model100_submit_ui_contract.mjs`
- `npm -C packages/ui-model-demo-frontend run build`
- `docker build -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`
- 备份本地持久化 DB：`/Users/drop/dongyu/volume/persist/ui-server/runtime/default/yhl.db.bak.20260308T030846`
- `kubectl -n dongyu rollout restart deployment/ui-server`
- `kubectl -n dongyu delete pod -l app=ui-server --force --grace-period=0`
- `curl -fsS -X POST http://127.0.0.1:30900/api/runtime/mode -H 'content-type: application/json' -d '{"mode":"running"}'`
- `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`
- `playwright` 打开 `http://127.0.0.1:30900/?v=1773000005#/workspace`，输入 `hello from browser` 后点击 `Generate Color`
- Key output:
- 初始浏览器故障 1：`Generate Color` 按钮仍走旧合同 `label_add -> model100.ui_event`，点击后 `ui_event_error={ code: "direct_model_mutation_disabled", detail: "label_add" }`
- 根因 1：
  - `workspace_positive_models.json` 与 `model100_ast.js` 仍保留旧 submit 绑定
  - `ui-server` hostPath SQLite 恢复了旧正数模型，导致新镜像也继续提供旧 `submit__bind`
- 修复 1：
  - submit 绑定改成 `action=submit + meta.model_id=100 + value_ref.t=event`
  - 重建镜像后备份并移走 ui-server 持久化 DB，再让 pod 从 trusted bootstrap 重新 seed 正数 demo 模型
- 初始浏览器故障 2：输入框打字触发 `ui_event_error={ code: "direct_model_mutation_disabled", detail: "label_update" }`
- 根因 2：
  - 这不是 0177 错挡“正常业务 label_update”，而是颜色生成器示例仍停留在旧合同，试图从浏览器直写正数模型 `model100.input_value`
  - 按当前规约，正数业务模型的数据更新也必须通过声明好的业务事件/引脚进入模型
- 修复 2：
  - 输入框 `bind.read/write` 改到负数 `editor_state(-2).model100_input_draft`
  - submit 事件 payload 的 `input_value` 改为从该负数 draft state 取值，再通过业务事件进入 model 100
- 合同测试：
  - `test_0177_model100_submit_ui_contract` PASS
  - `test_0177_model100_input_draft_contract` PASS
- 本地 OrbStack 验证：
  - `verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900` PASS
  - 浏览器中输入 `hello from browser` 后：
    - `snapshot.models["-2"].cells["0,0,0"].labels.model100_input_draft = "hello from browser"`
    - `ui_event_error = null`
  - 点击 `Generate Color` 后：
    - 颜色从 `#e693b4` 变为 `#a910bf`
    - `status = "processed"`
    - `system_ready = true`
    - `ui_event_error = null`
  - `ui-server` 日志确认：
    - 先收到 `label_update -> -2.model100_input_draft`
    - 再收到 `forward_model100_events Event: {"action":"submit","input_value":"hello from browser",...}`
    - 随后收到 `snapshot_delta` 并应用 `bg_color/status` 回写
- Result: PASS
- Commit: N/A

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
