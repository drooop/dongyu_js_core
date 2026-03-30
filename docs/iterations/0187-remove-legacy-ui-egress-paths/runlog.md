---
title: "0187 — Remove Legacy UI Egress Paths Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0187-remove-legacy-ui-egress-paths
id: 0187-remove-legacy-ui-egress-paths
phase: phase3
---

# 0187 — Remove Legacy UI Egress Paths Runlog

## Environment

- Date: 2026-03-11
- Branch: `dev_0187-remove-legacy-ui-egress-paths`
- Runtime: local repo + local OrbStack baseline

Review Gate Record
- Iteration ID: 0187-remove-legacy-ui-egress-paths
- Review Date: 2026-03-11
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户批准先移除 legacy UI 外发通路，再回到 `0186` 做 overlay/commit-policy。

## Execution Records

### Step 1

- Command:
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0187-remove-legacy-ui-egress-paths --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - `git switch -c dev_0187-remove-legacy-ui-egress-paths`
  - `apply_patch` add `scripts/tests/test_0187_legacy_ui_egress_removal_contract.mjs`
  - `node scripts/tests/test_0187_legacy_ui_egress_removal_contract.mjs`
- Key output:
  - 红灯 FAIL：
    - `legacy ui_to_matrix_forwarder.json must not keep forward_ui_events as a direct Matrix send function`
  - 同步确认当前 legacy path 还有两处：
    - `packages/worker-base/system-models/ui_to_matrix_forwarder.json`
    - `packages/ui-model-demo-server/server.mjs` 中 `fallback to forward_ui_events`
- Result: PASS
- Commit: N/A

### Step 2

- Command:
  - `apply_patch` update:
    - `packages/worker-base/system-models/ui_to_matrix_forwarder.json`
    - `packages/worker-base/system-models/intent_dispatch_config.json`
    - `packages/ui-model-demo-server/server.mjs`
    - `docs/ssot/runtime_semantics_modeltable_driven.md`
    - `docs/ssot/ui_to_matrix_event_flow.md`
  - `node scripts/tests/test_0187_legacy_ui_egress_removal_contract.mjs`
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `node scripts/tests/test_0177_model100_submit_ui_contract.mjs`
  - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Key output:
  - `PASS test_0187_legacy_ui_egress_removal_contract`
  - `PASS test_0182_model100_submit_chain_contract`
  - `PASS test_0177_model100_submit_ui_contract`
  - local verify PASS:
    - `final_state={"bg":"#33d861","status":"processed","inflight":false,"ready":true,"err":null,...}`
  - docs audit PASS
- Result: PASS
- Commit: N/A

### Step 3 — live runtime 验证与 clean-boot 竞态排查

- Command:
  - `docker build -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`
  - `kubectl -n dongyu rollout restart deployment/ui-server`
  - `kubectl -n dongyu exec deploy/ui-server -- sh -lc "grep -n 'fallback to forward_ui_events' /app/packages/ui-model-demo-server/server.mjs || true; ..."`
  - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`
  - `curl -fsS http://127.0.0.1:30900/snapshot | jq ...`
  - `kubectl -n dongyu scale deployment/ui-server --replicas=0`
  - `mv /Users/drop/dongyu/volume/persist/ui-server/runtime/default/yhl.db /Users/drop/dongyu/volume/persist/ui-server/runtime/default/yhl.db.bak.0187.<ts>`
  - `kubectl -n dongyu scale deployment/ui-server --replicas=1`
  - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`
- Key output:
  - 新 pod 容器内不再命中：
    - `fallback to forward_ui_events`
    - `forward_ui_events` seed / trigger 引用
  - 第一次 live 验证 FAIL，断点事实：
    - `Model 100 submit` 卡在本模型 root
    - `/snapshot` 中 `m100_submit != null`，但 `m0_submit == null`
    - `ui-server` 启动日志显示：
      - `[createServerState] skip positive seed patches (existing_positive_models=4)`
  - 根因：
    - rollout 窗口内旧 `ui-server` pod 仍在 Terminating
    - 我删除 SQLite 的时机过早，旧 pod 又把旧正数模型状态写回 hostPath
    - 导致 clean boot 没成立，新的 `test_model_100_ui` relay 结构未 seed
  - 串行 clean-boot 后验证：
    - `Model 0` snapshot 出现 `10,0,0` hosting cell
    - `submt=100` + `model100_submit_bridge` 恢复
    - `verify_model100_submit_roundtrip.sh` PASS：
      - `final_state={"bg":"#227d07","status":"processed","inflight":false,"ready":true,"err":null,...}`
- Result: PASS
- Commit: N/A

## Docs Updated

- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed

## Planning Facts

- User decision on 2026-03-11:
  - do not start overlay/commit implementation yet
  - first create a dedicated iteration to remove legacy egress paths

## Execution Facts

- legacy path removed in this round:
  - `ui_to_matrix_forwarder.json` no longer seeds `forward_ui_events`
  - `intent_dispatch_config.json` no longer routes `ui_event` to `forward_ui_events`
  - `server.mjs` no longer falls back to `forward_ui_events`
- legal path preserved:
  - `Model 100 submit -> pin.table.out -> Model 0 model100_submit_out -> ctx.sendMatrix(...)`
- live runtime fact:
  - clean boot is required when validating this change against persisted local ui-server state
  - otherwise old positive-model SQLite state can mask relay topology and create a false negative
