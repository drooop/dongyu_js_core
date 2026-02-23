# Iterations Index

本表是唯一权威索引。任何新的 iteration 必须先在此登记，否则不得开始实现。

字段说明：
- **ID**：如 1216、1216-2、1220（保持你现有命名习惯）
- **Branch**：主工作分支（建议 dev_<id>）
- **Status**：Planned / Approved / In Progress / Completed / On Hold
- **Entry**：iteration 目录入口（相对路径）

| ID    | Date       | Theme | Steps | Branch     | Status      | Entry |
|-------|------------|-------|-------|------------|-------------|-------|
| 0122-pictest-evidence | 2026-01-22 | PICtest Evidence Extraction | 2 | dev_0122-pictest-evidence | Completed | ./docs/iterations/0122-pictest-evidence/ |
| 0122-oracle-harness-plan | 2026-01-22 | Oracle Test Harness Plan | 2 | dev_0122-oracle-harness-plan | Completed | ./docs/iterations/0122-oracle-harness-plan/ |
| 0123-modeltable-runtime-v0 | 2026-01-23 | ModelTable Runtime v0 | 2 | dev_0123-modeltable-runtime-v0 | Completed | ./docs/iterations/0123-modeltable-runtime-v0/ |
| 0123-builtins-v0 | 2026-01-23 | Built-in k Behavior v0 | 2 | dev_0123-builtins-v0 | Completed | ./docs/iterations/0123-builtins-v0/ |
| 0123-builtins-v0-impl | 2026-01-23 | Built-in k Behavior v0 (Implementation) | 2 | dev_0123-builtins-v0-impl | Completed | ./docs/iterations/0123-builtins-v0-impl/ |
| 0123-pin-mqtt-loop | 2026-01-23 | PIN_IN/OUT + MQTT Loop | 2 | dev_0123-pin-mqtt-loop | Completed | ./docs/iterations/0123-pin-mqtt-loop/ |
| 0123-ui-ast-spec | 2026-01-23 | UI AST Spec (Contract) |  | dev_0123-ui-ast-spec | Completed | ./docs/iterations/0123-ui-ast-spec/ |
| 0123-ui-renderer-impl | 2026-01-23 | UI Renderer v0 (Implementation) | 2 | dev_0123-ui-renderer-impl | Completed | ./docs/iterations/0123-ui-renderer-impl/ |
| 0127-doit-auto-docs-refresh | 2026-01-27 | Doit-auto docs refresh (program model load + test case) | 3 | dev_0127-doit-auto-docs-refresh | Completed | ./docs/iterations/0127-doit-auto-docs-refresh/ |
| 0127-program-model-loader-v0 | 2026-01-27 | Program model loader v0 (test7 yhl.db) | 3 | dev_0127-program-model-loader-v0 | Completed | ./docs/iterations/0127-program-model-loader-v0/ |
| 0128-ui-line-demo-frontend | 2026-01-27 | UI model demo frontend (Stage 3.3) | 4 | dev_0128-ui-line-demo-frontend | Completed | ./docs/iterations/0128-ui-line-demo-frontend/ |
| 0129-modeltable-editor-v0 | 2026-01-27 | ModelTable editor UI (UI model) v0 | 5 | dev_0129-modeltable-editor-v0 | Completed | ./docs/iterations/0129-modeltable-editor-v0/ |
| 0130-modeltable-editor-v1 | 2026-01-28 | ModelTable editor UI (UI model) v1 (complete-ish editor + UI AST support) | 4 | dev_0130-modeltable-editor-v1 | Completed | ./docs/iterations/0130-modeltable-editor-v1/ |
| 0131-server-connected-editor-sse | 2026-01-28 | Server-connected ModelTable editor demo (SSE + HTTP; backend self-sliding; renderer-only frontend) | 4 | dev_0131-server-connected-editor-sse | Completed | ./docs/iterations/0131-server-connected-editor-sse/ |
| 0132-dual-bus-contract-harness-v0 | 2026-01-28 | Dual Bus (Stage 4) contract + harness v0 (no real Matrix creds) | 6 | dev_0132-dual-bus-contract-harness-v0 | Completed | ./docs/iterations/0132-dual-bus-contract-harness-v0/ |
| 0133-ui-component-gallery-v0 | 2026-01-31 | UI component Gallery (Element Plus subset) + virtual routing + props/events coverage + submodel composition | 7 | dev_gallery_ui_component_gallery_v0 | Completed | ./docs/iterations/0133-ui-component-gallery-v0/ |
| 0134-color-generator-e2e-repro | 2026-02-09 | Color Generator E2E repro + runbook solidification | 4 | dev_0134-color-generator-e2e-repro | Completed | ./docs/iterations/0134-color-generator-e2e-repro/ |
| 0135-color-generator-patch-only-repro | 2026-02-09 | Color Generator E2E repro in patch-only mode (empty yhl.db assumption) | 4 | dev_0135-color-generator-patch-only-repro | Completed | ./docs/iterations/0135-color-generator-patch-only-repro/ |
| 0136-runtime-baseline-k8s-default | 2026-02-09 | Runtime baseline fixed to Docker+K8s; local MBR archived | 4 | dev_0136-runtime-baseline-k8s-default | Completed | ./docs/iterations/0136-runtime-baseline-k8s-default/ |
| 0137-planA-layered-pressure-test | 2026-02-09 | Plan A layered test and pressure profiling for patch-only import workflow | 5 | dev_0137-planA-layered-pressure-test | In Progress | ./docs/iterations/0137-planA-layered-pressure-test/ |
| 0138-cell-owned-pin | 2026-02-09 | Cell-owned PIN semantics with compatibility fallback | 4 | dropx/dev_0138-cell-owned-pin | In Progress | ./docs/iterations/0138-cell-owned-pin/ |
| 0139-records-only-patch | 2026-02-09 | Records-only mt.v0 patch delivery (mqttIncoming three-path) | 4 | dev_0139-records-only-patch | Completed | ./docs/iterations/0139-records-only-patch/ |
| 0140-model100-records-e2e | 2026-02-09 | Model 100 records-only E2E (MBR + program model migration) | 4 | dev_0140-model100-records-e2e | Completed | ./docs/iterations/0140-model100-records-e2e/ |
| 0141-cell-connect-engine | 2026-02-11 | CELL_CONNECT parser + cell_connection router + AsyncFunction engine | 5 | dev_0141-cell-connect-engine | Completed | ./docs/iterations/0141-cell-connect-engine/ |
| 0142-bus-model-boundary | 2026-02-11 | BUS_IN/OUT system boundary + MODEL_IN/OUT + subModel lifecycle | 4 | dev_0142-bus-model-boundary | Completed | ./docs/iterations/0142-bus-model-boundary/ |
| 0143-pin-isolation-migration | 2026-02-11 | Legacy PIN cleanup + system-models migration + E2E validation | 6 | dev_0143-pin-isolation-migration | Completed | ./docs/iterations/0143-pin-isolation-migration/ |
| 0144-worker-fill-table-migration | 2026-02-11 | Worker fill-table migration (remote-worker + MBR patches + K8s deploy) | 9 | dev | Completed | ./docs/iterations/0144-worker-fill-table-migration/ |
| 0145-login-modeltable-k8s-local | 2026-02-13 | Login ModelTable化 + 本地全量 K8s 化 | 6 | dev | In Progress | ./docs/iterations/0145-login-modeltable-k8s-local/ |
| 0146-fill-table-only-mode | 2026-02-14 | Fill-Table-Only 显式强制模式（禁止 runtime 旁路实现） | 3 | dev_0146-fill-table-only-mode | Completed | ./docs/iterations/0146-fill-table-only-mode/ |
| 0147-fill-table-only-auto-gate | 2026-02-14 | Fill-Table-Only 自动门禁（pre-commit + 模式开关） | 4 | dev_0147-fill-table-only-auto-gate | Completed | ./docs/iterations/0147-fill-table-only-auto-gate/ |
| 0148-ft-skill-branch-gate | 2026-02-14 | ft skill + 分支级自动 Fill-Table-Only 门禁 | 4 | dev_0148-ft-skill-branch-gate | Completed | ./docs/iterations/0148-ft-skill-branch-gate/ |
| 0149-cloud-deploy-sync-ui-server | 2026-02-14 | Cloud 部署同步（ui-server 修复发布 + e2e 验证） | 5 | dev_0149-cloud-deploy-sync-ui-server | In Progress | ./docs/iterations/0149-cloud-deploy-sync-ui-server/ |
| 0150-matrix-adapter-into-worker-base | 2026-02-14 | Matrix adapter 基座化（删除 bus-mgmt，全量统一） | 6 | dev_0150-matrix-adapter-into-worker-base | In Progress | ./docs/iterations/0150-matrix-adapter-into-worker-base/ |
| 0151-server-model100-decouple | 2026-02-21 | Server 去 Model 100 特判 + MOCK_SLIDING_APPS 外移 | 6 | dev_0151-server-model100-decouple | Completed | ./docs/iterations/0151-server-model100-decouple/ |
| 0152-server-intent-dispatch | 2026-02-21 | Server 通用 Intent Dispatch + Forward 触发映射模型化 | 10 | dev_0152-server-intent-dispatch | Completed | ./docs/iterations/0152-server-intent-dispatch/ |
| 0153-cognition-feedback-loop | 2026-02-23 | 认知环节显式化 + 动作状态反馈回路（四环智控模型落地） | 10 | dev_0153-cognition-feedback-loop | Planned | ./docs/iterations/0153-cognition-feedback-loop/ |
| 0154-llm-cognition-ollama | 2026-02-23 | LLM 认知层接入（Ollama Qwen 32B 本地部署） | 8 | dev_0154-llm-cognition-ollama | Planned | ./docs/iterations/0154-llm-cognition-ollama/ |

---

## Historical (Pre-rewrite)

以下迭代属于 JS 重写之前的阶段，当前仓库中无对应迭代目录，仅作历史记录保留。

| ID    | Date       | Theme | Status |
|-------|------------|-------|--------|
| 1216  | 2025-12-16 | (unnamed) | Planned |
| 1216-ui | 2025-12-16 | UI 规范化细则（ChatGPT 风格）与 IA/导航规则 | Completed |
| 1217-home-ui | 2025-12-17 | Home/Store/System 可读性与 Worker Base 全屏规范化 | Approved |
| 1217-sliding-ui-package | 2025-12-17 | Sliding UI 包规范 + Matrix/MBR/MQTT 交互契约 | Planned |
| 1217-platform-stability | 2025-12-17 | 跨平台一致性与稳定性交付 | Planned |
| 1218-platform-stability | 2025-12-18 | Windows build 经验沉淀（Phase 1） | Planned |
| win-dev-persistent-path | 2025-12-22 | Windows yhl.db 持久化路径统一 | Completed |
| ui-redesign-system | 2026-01-15 | UI redesign system 初始化 | Planned |
| dy-ui-redesign-brief | 2026-01-15 | UI redesign brief for Stitch | Planned |
| dy-ui-stitch-import | 2026-01-15 | Stitch tokens + page specs import | Planned |
| dy-ui-redesign-contract | 2026-01-15 | UI redesign contract from Stitch v1 | Planned |
| dy-ui-redesign-implementation | 2026-01-15 | UI redesign implementation | Completed |
| dy-workerbase-elysia-rewrite | 2026-01-16 | Worker Base runtime + UI rewrite (Elysia/Vue3) | Completed |
| dy-workerbase-ui-feature-parity | 2026-01-16 | Worker Base UI feature parity | Planned |
| dy-workerbase-pin-task-mqtt | 2026-01-16 | Worker Base runtime pin/task/mqtt parity | Completed |
| dy-workerbase-mqtt-config-page-ssot | 2026-01-16 | MQTT config page SSOT (page0) | Completed |
