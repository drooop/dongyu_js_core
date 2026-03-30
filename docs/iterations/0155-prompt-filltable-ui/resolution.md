---
title: "0155 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0155-prompt-filltable-ui
id: 0155-prompt-filltable-ui
phase: phase1
---

# 0155 — Resolution (HOW)

## 0. Execution Strategy

采用“前端固定页面 + 服务端受限执行器 + LLM 结构化输出”的三段式：
1. 前端负责输入、预览、确认。
2. 服务端负责 LLM 调用、records 校验与执行。
3. 执行层只接受 `add_label/rm_label`，默认仅正数模型可写。

## 1. Step Overview

| Step | Title | Scope | Files | Verification | Acceptance | Rollback |
|---|---|---|---|---|---|---|
| 1 | Prompt 页面入口 | 增加固定路由与导航按钮 | `router.js`, `demo_app.js`, `demo_modeltable.js` | 页面可进入 | 可见 Prompt 面板 | revert UI files |
| 2 | Prompt 状态模型 | 新增 prompt/preview/apply 状态标签 | `server.mjs`（state init）, `system-models/*.json` | `/snapshot` 可见状态 | 状态字段完整 | revert labels |
| 3 | Preview function-label 化 | `preview` 生成候选 records（不执行） | `server.mjs`, `intent_dispatch_config.json`, `intent_handlers_prompt_filltable.json` | API 返回 accepted/rejected + `preview_id` | 仅预览不写目标模型 | revert dispatch/handler |
| 4 | Apply function-label 化 | 执行 accepted records | `server.mjs`, `intent_dispatch_config.json`, `intent_handlers_prompt_filltable.json` | `preview_id` 匹配时更新 labels | 多记录执行生效；过期 preview 拒绝 | revert dispatch/handler |
| 5 | 策略与边界 | 默认正数模型可写，负数拒绝 + 本地事件不外发 | `server.mjs`, `server_config.json`, `ui_to_matrix_forwarder.json` | 负数/保护键/超限被拒绝，且不转发 Matrix | 拒绝理由明确、无外泄 | revert config/forwarder |
| 6 | LLM 输出模板 | 新增 filltable prompt/schema labels | `llm_cognition_config.json` | label load PASS | 输出口径稳定 | revert patch |
| 7 | 一键验证脚本 | run/start/verify 脚本 | `scripts/ops/*0155*` | 单命令 PASS | 覆盖 preview/apply/拒绝 | remove scripts |
| 8 | 文档收口 | runlog + user-guide + ops README | `docs/iterations/0155...`, `docs/user-guide/*`, `scripts/ops/README.md` | 文档引用一致 | 可复制执行 | revert docs |

## 2. Step Details

### Step 1 — Prompt 页面入口

- Scope:
  - 新增 `ROUTE_PROMPT`（例如 `/prompt`）。
  - Header 增加 `Prompt` 导航。
  - `ui_page=prompt` 时渲染固定面板。
- Files:
  - `packages/ui-model-demo-frontend/src/router.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Verification:
  - 打开 `/#/prompt` 页面可见。
- Acceptance:
  - Prompt 页面稳定可达，刷新不丢路由。
- Rollback:
  - 回退以上 3 个文件。

### Step 2 — Prompt 状态模型

- Scope:
  - 新增状态键：
    - `llm_prompt_text`
    - `llm_prompt_preview_json`
    - `llm_prompt_apply_result_json`
    - `llm_prompt_status`
  - 默认清理逻辑并入 startup sanitize。
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - （可选）`packages/worker-base/system-models/server_config.json`
- Verification:
  - `/snapshot` 可查到状态键。
- Acceptance:
  - 状态初始化与重置口径一致。
- Rollback:
  - 删除新增状态键逻辑。

### Step 3 — Preview（不落库）

- Scope:
  - 在 `intent_dispatch_table` 映射 action：`llm_filltable_preview -> handle_llm_filltable_preview`。
  - 新增 `handle_llm_filltable_preview` function label（Model `-10`），由 dispatch 通道触发。
  - 调用 LLM 返回 records。
  - 执行 policy 校验，返回：
    - `accepted_records`
    - `rejected_records`（含 reason）
    - `confidence/reasoning`
  - 生成并写入 `preview_id` + `preview_digest` 到 `llm_prompt_preview_json`，不对目标模型 apply。
  - 禁止新增 `server.mjs` action-specific if/else 分支。
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/intent_dispatch_config.json`
  - `packages/worker-base/system-models/intent_handlers_prompt_filltable.json`
- Verification:
  - preview 后目标模型 labels 不变。
  - preview 响应和状态中可见 `preview_id`。
- Acceptance:
  - 能看到结构化预览与拒绝原因。
- Rollback:
  - 移除 preview action dispatch + handler。

### Step 4 — Apply（执行 accepted）

- Scope:
  - 在 `intent_dispatch_table` 映射 action：`llm_filltable_apply -> handle_llm_filltable_apply`。
  - 新增 `handle_llm_filltable_apply` function label（Model `-10`），由 dispatch 通道触发。
  - 读取最新 preview，校验请求中的 `preview_id` 一致后执行 accepted records。
  - 对已执行 `preview_id` 重放请求返回 `stale_preview` 或幂等结果（二选一并固定）。
  - 汇总写回 `llm_prompt_apply_result_json`。
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/intent_dispatch_config.json`
  - `packages/worker-base/system-models/intent_handlers_prompt_filltable.json`
- Verification:
  - `preview_id` 正确时执行后目标模型标签变更可见。
  - `preview_id` 失配/重放时拒绝且不写目标模型。
- Acceptance:
  - 支持多 records 一次执行，且 preview/apply 一致性可验证。
- Rollback:
  - 移除 apply action dispatch + handler。

### Step 5 — 策略与边界

- Scope:
  - 新增配置 `llm_filltable_policy`（Model 0）：
    - `allow_positive_model_ids: true`
    - `allow_negative_model_ids: false`
    - `max_records_per_apply`
    - `allowed_label_types`
    - `protected_label_keys`
    - `max_value_bytes`
    - `max_total_bytes`
  - 默认拒绝负数模型写入、保护键写入、超限 payload。
  - filltable 相关 action 统一注入 `meta.local_only=true`。
  - `forward_ui_events` 增加 `local_only` skip，保证本地填表动作不转发 Matrix。
- Files:
  - `packages/worker-base/system-models/server_config.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/ui_to_matrix_forwarder.json`
- Verification:
  - 尝试写 `model_id=-1` 被拒绝。
  - 尝试写保护键（如 `dual_bus_model`）被拒绝。
  - 超过 records/value/total 限制被拒绝。
  - filltable action 无 Matrix 转发日志。
- Acceptance:
  - 默认“正数模型可写”成立，负数/保护键/超限拒绝可解释，且不外发。
- Rollback:
  - 恢复配置与校验逻辑。

### Step 6 — Prompt/Schema labels

- Scope:
  - 新增：
    - `llm_filltable_prompt_template`
    - `llm_filltable_output_schema`
- Files:
  - `packages/worker-base/system-models/llm_cognition_config.json`
- Verification:
  - 启动后 label 可读。
- Acceptance:
  - 模板可被 preview 流程调用。
- Rollback:
  - 删除新增 labels。

### Step 7 — 一键验证命令

- Scope:
  - 新增 0155 一键脚本：
    - start server
    - send preview/apply
    - assert pass/fail
    - 覆盖并发/重放/超限/拒绝场景
- Files:
  - `scripts/ops/run_0155_prompt_filltable_local.sh`
  - `scripts/ops/verify_0155_prompt_filltable.sh`
- Verification:
  - 单命令输出 PASS。
- Acceptance:
  - 包含正向与负向（负数拒绝、保护键拒绝、重放拒绝）场景。
- Rollback:
  - 删除新增脚本。

### Step 8 — 文档收口

- Scope:
  - 更新 runlog、ops README、user-guide runbook。
  - 记录 docs review 结论。
- Files:
  - `docs/iterations/0155-prompt-filltable-ui/runlog.md`
  - `scripts/ops/README.md`
  - `docs/user-guide/*`
- Verification:
  - `rg` 能命中新命令与路径。
- Acceptance:
  - 文档与命令一致可复跑。
- Rollback:
  - 回退文档变更。

## 3. Verification Matrix (Planned)

1. Preview 多条记录（跨 cell）返回 accepted/rejected 分组。
2. Apply 后目标模型多 label 同时更新。
3. `model_id<=0` 默认拒绝。
4. 保护键写入拒绝（含明确 reason）。
5. 超过 `max_records_per_apply` / size 限制被拒绝。
6. `preview_id` 失配与重放均拒绝（不修改目标模型）。
7. filltable action 不触发 Matrix forward。
8. LLM 不可用返回错误且系统不崩溃。
9. 一键脚本给出 PASS/FAIL。
