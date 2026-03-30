---
title: "Iteration 0170-local-mt-table-orbstack Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0170-local-mt-table-orbstack
id: 0170-local-mt-table-orbstack
phase: phase3
---

# Iteration 0170-local-mt-table-orbstack Runlog

## Environment

- Date: 2026-03-06
- Branch: `dev_0170-local-mt-table-orbstack`
- Runtime: local repo + Orbstack kubernetes + local Ollama (`mt-table`)

Review Gate Record
- Iteration ID: 0170-local-mt-table-orbstack
- Review Date: 2026-03-06
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: 用户要求在本机 Orbstack 完整部署并跑通 `mt-table` 相关本地 LLM 功能，成功后同步共享知识库。

## Execution Records

### Step 1

- Command:
  - 基线核验：`ollama list`
  - 基线核验：`kubectl config current-context`
  - `node scripts/tests/test_0170_bun_and_filltable_prompt_contract.mjs`
  - `node scripts/tests/test_0171_ollama_stream_contract.mjs`
  - `node scripts/tests/test_0172_local_mt_table_defaults.mjs`
  - `kubectl -n dongyu exec deploy/ui-server -- sh -lc 'echo MODEL=$DY_LLM_MODEL MAXTOK=$DY_LLM_MAX_TOKENS TIMEOUT=$DY_LLM_TIMEOUT_MS'`
- Key output:
  - 本机 Ollama 可用，已存在 `mt-table:latest`。
  - 当前 k8s context 为 `orbstack`。
  - streaming contract / 本地默认值测试通过。
  - `ui-server` 当前环境读到 `MODEL=mt-table MAXTOK=512 TIMEOUT=120000`。
- Result: PASS
- Commit: uncommitted baseline adopted into iteration

### Step 2

- Command:
  - `node scripts/tests/test_0170_local_bun_real_mqtt.mjs`
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
- Key output:
  - `test_0170_local_bun_real_mqtt: PASS`，确认 Bun/ESM 下 `startMqttLoop({transport:'real'})` 不再报 `mqtt_package_unavailable`。
  - `deploy_local.sh` 成功完成；本地 Matrix room 生成并完成五个 deployment rollout。
  - `check_runtime_baseline.sh` 输出：
    - `PASS deploy/mosquitto readyReplicas=1`
    - `PASS deploy/synapse readyReplicas=1`
    - `PASS deploy/remote-worker readyReplicas=1`
    - `PASS deploy/mbr-worker readyReplicas=1`
    - `PASS deploy/ui-server readyReplicas=1`
  - 本地 UI 入口：`http://localhost:30900`
- Result: PASS
- Commit: pending

### Step 3

- Command:
  - `bash scripts/ops/verify_0155_prompt_filltable.sh --base-url http://127.0.0.1:30900`（首轮）
  - 直接调用本机 Ollama `mt-table` 执行完整 filltable prompt（等价 prompt 渲染）
  - `bash scripts/ops/verify_0155_prompt_filltable.sh --base-url http://127.0.0.1:30900`（warm 后复跑）
  - 本地浏览器/Playwright CLI 打开 `http://127.0.0.1:30900/#/prompt`，执行 `Preview -> Apply`
- Key output:
  - 首轮 `verify_0155` 返回：
    - `preview_response={"result":"error","code":"llm_unavailable","detail":"llm_timeout",...}`
  - 直接调用本机 Ollama `mt-table` 的完整 filltable prompt，实测单次耗时约 `1:33.89`。
  - warm 后第二次 `verify_0155` 完整通过：
    - `preview_response={"result":"ok",...}`
    - `apply_response={"result":"ok",...}`
    - `replay_response={"code":"preview_replay",...}`
    - `negative_response={"code":"apply_failed",...}`
    - `too_many_records_response={"code":"too_many_records",...}`
    - `[verify-0155] PASS`
  - 本地浏览器实测已出现：
    - `preview ready (confirm then apply): accepted=2 rejected=0`
    - `apply done: applied=2 rejected=0`
  - 证据文件：
    - `.playwright-cli/page-2026-03-06T07-53-57-149Z.yml`
    - `.playwright-cli/page-2026-03-06T07-54-17-158Z.yml`
- Result: PASS（存在首轮 warm-up 超时现象，runbook 已记录）
- Commit: pending

### Step 4

- Command:
  - 更新 `docs/user-guide/llm_cognition_ollama_runbook.md`
  - 更新 `docs/user-guide/modeltable_user_guide.md`
  - 更新 `docs/user-guide/README.md`
  - 更新 `scripts/ops/README.md`
  - 新增 `docs-shared/software-worker/mt-table-local-generation-via-owner-chain.md`
  - 更新 `docs-shared/_MOC.md`
- Key output:
  - 已把本地 Orbstack + `mt-table` 的部署、验证命令、warm-up 现象和 `DY_LLM_MAX_TOKENS=512` / `DY_LLM_TIMEOUT_MS=120000` 的经验值落盘。
  - 已明确写出：当前 `server.mjs` 的 `llmFilltablePreview/Apply` 仍是 `accepted_records` / `applied_records` compatibility bridge，不是新版规约下的最终对外合同。
  - 已明确写出：新版规约的目标路径必须遵循 owner / preview-apply / hostApi / owner-side apply，而不是让 LLM 直接产出 `op:add_label/remove_label` 作为规范接口。
- Result: PASS
- Commit: pending

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed（no update required for 0170）
- [x] `docs/user-guide/modeltable_user_guide.md` updated（补充 0170 owner-chain 边界说明）
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed（no update required for 0170）
- [x] `docs/user-guide/llm_cognition_ollama_runbook.md` updated（补充 Orbstack + `mt-table` runbook）
- [x] `docs/user-guide/README.md` updated（索引文案对齐）
- [x] `scripts/ops/README.md` updated（追加 0170 本地 `mt-table` 命令入口）
- [x] `docs-shared/software-worker/mt-table-local-generation-via-owner-chain.md` updated（共享知识库入口）
