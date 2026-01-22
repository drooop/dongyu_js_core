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
