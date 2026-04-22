---
title: "0330 — model100-submit-v1n Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-04-22
source: ai
iteration_id: 0330-model100-submit-v1n
id: 0330-model100-submit-v1n
phase: phase4
---

# 0330 — model100-submit-v1n Runlog

## Environment

- Date: 2026-04-22
- Branch: `dev_0330-model100-submit-v1n`
- Repo: `/Users/drop/codebase/cowork/dongyuapp_elysia_based__0330`
- Local helpers:
  - `node_modules -> /Users/drop/codebase/cowork/dongyuapp_elysia_based/node_modules`
  - `deploy/env/local.env -> /Users/drop/codebase/cowork/dongyuapp_elysia_based/deploy/env/local.env`

## Review Gate Record

Review Gate Record
- Iteration ID: `0330-model100-submit-v1n`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 1
- Decision: Change Requested
- Notes:
  - 初始 phase1 创建

Review Gate Record
- Iteration ID: `0330-model100-submit-v1n`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 2
- Decision: Approved
- Notes:
  - 独立审查确认当前直接根因已锁定到 `prepare_model100_submit_from_pin` 仍调用 legacy `ctx.getLabel/writeLabel`

Review Gate Record
- Iteration ID: `0330-model100-submit-v1n`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 3
- Decision: Approved
- Notes:
  - 阶段实现审查通过；当前变更只覆盖 runtime pin submit 路径，没有发现本阶段不可接受的 correctness / conformance 风险

Review Gate Record
- Iteration ID: `0330-model100-submit-v1n`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 4
- Decision: Change Requested
- Notes:
  - 要求补充“颜色确实变化”的最终证据，并避免把根因扩大描述为“三段函数都 still legacy”

## Facts

### Root cause proof

- 失败用例：
  - `node scripts/tests/test_0330_model100_local_submit_contract.mjs`
  - FAIL: `model100_local_submit_must_not_leave_prepare_error`
  - 实际错误：`{ error: 'ctx.getLabel is not a function', ... }`
- 静态对照：
  - `packages/worker-base/system-models/test_model_100_ui.json`
  - `prepare_model100_submit_from_pin` 在 runtime cell-connect 路径下仍调用 `ctx.getLabel/writeLabel`

### Implementation

- 修改 `packages/worker-base/system-models/test_model_100_ui.json`
  - 将 `prepare_model100_submit_from_pin` 迁移到 `V1N.readLabel / V1N.table.addLabel`
  - 保持 `prepare_model100_submit` 与 `forward_model100_submit_from_model0` 原样，避免把本次修复扩展到 server programEngine 支路
- 同步更新验证：
  - `scripts/tests/test_0306_model100_pin_chain_contract.mjs`
  - `scripts/tests/test_0330_model100_local_submit_contract.mjs`

### Verification

- `node scripts/tests/test_0306_model100_pin_chain_contract.mjs`
  - PASS: `3 passed, 0 failed`
- `node scripts/tests/test_0330_model100_local_submit_contract.mjs`
  - PASS: `PASS test_0330_model100_local_submit_contract`
- `node scripts/tests/test_0303_model0_egress_recovery_server_flow.mjs`
  - PASS: `3 passed, 0 failed`
- `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
  - PASS: `5 passed, 0 failed`
- `node scripts/tests/test_0329_bus_event_last_op_id_snapshot_contract.mjs`
  - PASS: `PASS test_0329_bus_event_last_op_id_snapshot_contract`
- `bash scripts/ops/deploy_local.sh`
  - PASS: full local deploy completed on `orbstack`
- `bash scripts/ops/check_runtime_baseline.sh`
  - PASS: `baseline ready`

### Real browser check

- Playwright opened `http://127.0.0.1:30900/#/workspace`
- Initial snapshot on `E2E 颜色生成器`:
  - color `#9d04d0`
  - status `processed`
  - button `Generate Color` clickable
- Real interaction:
  - filled input with `0330-playwright-fix-check`
  - clicked `Generate Color`
  - waited 6 seconds and snapped again
- Final snapshot:
  - color `#22f334`
  - status `processed`
  - button `Generate Color` clickable

## Outcome

- `prepare_model100_submit_from_pin` no longer leaves `__error_prepare_model100_submit_from_pin`
- 本地部署下的真实浏览器点击已恢复颜色更新
- 0329 的按钮释放修复未回退
