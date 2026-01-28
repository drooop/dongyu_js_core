# Iterations Index

本表是唯一权威索引。任何新的 iteration 必须先在此登记，否则不得开始实现。

字段说明：
- **ID**：如 1216、1216-2、1220（保持你现有命名习惯）
- **Branch**：主工作分支（建议 dev_<id>）
- **Status**：Planned / Approved / In Progress / Completed / On Hold
- **Entry**：iteration 目录入口（相对路径）

| ID    | Date       | Theme | Steps | Branch     | Status      | Entry |
|-------|------------|-------|-------|------------|-------------|-------|
| 1216  | 2025-12-16 |       |       | dev_1216   | Planned     | ./iterations/1216/ |
| 1216-ui | 2025-12-16 | UI 规范化细则（ChatGPT 风格）与 IA/导航规则（方案） | 7 | dev_1216-ui | Completed | ./docs/iterations/1216-ui/ |
| 1217-home-ui | 2025-12-17 | Home/Store/System 可读性（浅底浅字）与 Worker Base 全屏规范化（方案） | 5 | dev_1217-home-ui | Approved | ./docs/iterations/1217-home-ui/ |
| 1217-sliding-ui-package | 2025-12-17 | Sliding UI 包规范 + Matrix<->MBR<->MQTT 交互契约 + Asset Tree/安装流程（方案） | 6 | dev_1217-sliding-ui-package | Planned | ./docs/iterations/1217-sliding-ui-package/ |
| 1217-platform-stability | 2025-12-17 | 吸收 win 分支经验：跨平台（Windows/macOS/Linux）一致性与稳定性交付（方案） | 6 | dev_1217-platform-stability | Planned | ./docs/iterations/1217-platform-stability/ |
| 1218-platform-stability | 2025-12-18 | 吸收 Windows build 经验（dev_1217-home-ui + win）：跨平台长期方案与规范沉淀（Phase 1） | 7 | dev_1218-platform-stability | Planned | ./docs/iterations/1218-platform-stability/ |
| win-dev-persistent-path | 2025-12-22 | Windows yhl.db 持久化路径统一 | 4 | win-dev-persistent-path | Completed | ./docs/iterations/win-dev-persistent-path/ |
| ui-redesign-system | 2026-01-15 | UI redesign system 初始化 |  | dev_ui-redesign-system | Planned | ./docs/iterations/ui-redesign-system/ |
| dy-ui-redesign-brief | 2026-01-15 | UI redesign brief for Stitch | 2 | dev_dy-ui-redesign-brief | Planned | ./docs/iterations/dy-ui-redesign-brief/ |
| dy-ui-stitch-import | 2026-01-15 | Stitch tokens + page specs import | 3 | dev_dy-ui-stitch-import | Planned | ./docs/iterations/dy-ui-stitch-import/ |
| dy-ui-redesign-contract | 2026-01-15 | UI redesign contract from Stitch v1 (Phase1 complete; awaiting review) | 2 | dev_dy-ui-redesign-contract | Planned | ./docs/iterations/dy-ui-redesign-contract/ |
| dy-ui-redesign-implementation | 2026-01-15 | UI redesign implementation (Phase3 complete) | 6 | dev | Completed | ./docs/iterations/dy-ui-redesign-implementation/ |
| dy-workerbase-elysia-rewrite | 2026-01-16 | Worker Base runtime + UI rewrite (Elysia/Vue3) | 7 | dy-workerbase-elysia-rewrite | Completed | ./docs/iterations/dy-workerbase-elysia-rewrite/ |
| dy-workerbase-ui-feature-parity | 2026-01-16 | Worker Base UI feature parity (Code/Model tab + submt) | 4 | dy-workerbase-ui-feature-parity | Planned | ./docs/iterations/dy-workerbase-ui-feature-parity/ |
| dy-workerbase-pin-task-mqtt | 2026-01-16 | Worker Base runtime pin/task/mqtt parity | 4 | dy-workerbase-pin-task-mqtt | Completed | ./docs/iterations/dy-workerbase-pin-task-mqtt/ |
| dy-workerbase-mqtt-config-page-ssot | 2026-01-16 | MQTT config page SSOT (page0) | 3 | dy-workerbase-mqtt-config-page-ssot | Completed | ./docs/iterations/dy-workerbase-mqtt-config-page-ssot/ |
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
| 0130-modeltable-editor-v1 | 2026-01-28 | ModelTable editor UI (UI model) v1 (complete-ish editor + UI AST support) | 4 | dev_0130-modeltable-editor-v1 | Planned | ./docs/iterations/0130-modeltable-editor-v1/ |
