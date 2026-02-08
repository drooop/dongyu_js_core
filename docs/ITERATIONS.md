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
