---
title: "Iterations Index"
doc_type: governance
status: active
updated: 2026-04-10
source: ai
---

# Iterations Index

本表是唯一权威索引。任何新的 iteration 必须先在此登记，否则不得开始实现。

字段说明：
- **ID**：如 1216、1216-2、1220（保持你现有命名习惯）
- **Branch**：主工作分支（建议 dev_<id>）
- **Status**：Planned / Approved / In Progress / Completed / On Hold / Cancelled
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
| 0137-planA-layered-pressure-test | 2026-02-09 | Plan A layered test and pressure profiling for patch-only import workflow | 5 | dev_0137-planA-layered-pressure-test | Completed | ./docs/iterations/0137-planA-layered-pressure-test/ |
| 0138-cell-owned-pin | 2026-02-09 | Cell-owned PIN semantics with compatibility fallback | 4 | dropx/dev_0138-cell-owned-pin | Completed | ./docs/iterations/0138-cell-owned-pin/ |
| 0139-records-only-patch | 2026-02-09 | Records-only mt.v0 patch delivery (mqttIncoming three-path) | 4 | dev_0139-records-only-patch | Completed | ./docs/iterations/0139-records-only-patch/ |
| 0140-model100-records-e2e | 2026-02-09 | Model 100 records-only E2E (MBR + program model migration) | 4 | dev_0140-model100-records-e2e | Completed | ./docs/iterations/0140-model100-records-e2e/ |
| 0141-cell-connect-engine | 2026-02-11 | CELL_CONNECT parser + cell_connection router + AsyncFunction engine | 5 | dev_0141-cell-connect-engine | Completed | ./docs/iterations/0141-cell-connect-engine/ |
| 0142-bus-model-boundary | 2026-02-11 | BUS_IN/OUT system boundary + MODEL_IN/OUT + subModel lifecycle | 4 | dev_0142-bus-model-boundary | Completed | ./docs/iterations/0142-bus-model-boundary/ |
| 0143-pin-isolation-migration | 2026-02-11 | Legacy PIN cleanup + system-models migration + E2E validation | 6 | dev_0143-pin-isolation-migration | Completed | ./docs/iterations/0143-pin-isolation-migration/ |
| 0144-worker-fill-table-migration | 2026-02-11 | Worker fill-table migration (remote-worker + MBR patches + K8s deploy) | 9 | dev | Completed | ./docs/iterations/0144-worker-fill-table-migration/ |
| 0145-login-modeltable-k8s-local | 2026-02-13 | Login ModelTable化 + 本地全量 K8s 化 | 6 | dev | Cancelled | ./docs/iterations/0145-login-modeltable-k8s-local/ |
| 0146-fill-table-only-mode | 2026-02-14 | Fill-Table-Only 显式强制模式（禁止 runtime 旁路实现） | 3 | dev_0146-fill-table-only-mode | Completed | ./docs/iterations/0146-fill-table-only-mode/ |
| 0147-fill-table-only-auto-gate | 2026-02-14 | Fill-Table-Only 自动门禁（pre-commit + 模式开关） | 4 | dev_0147-fill-table-only-auto-gate | Completed | ./docs/iterations/0147-fill-table-only-auto-gate/ |
| 0148-ft-skill-branch-gate | 2026-02-14 | ft skill + 分支级自动 Fill-Table-Only 门禁 | 4 | dev_0148-ft-skill-branch-gate | Completed | ./docs/iterations/0148-ft-skill-branch-gate/ |
| 0149-cloud-deploy-sync-ui-server | 2026-02-14 | Cloud 部署同步（ui-server 修复发布 + e2e 验证） | 5 | dev_0149-cloud-deploy-sync-ui-server | Completed | ./docs/iterations/0149-cloud-deploy-sync-ui-server/ |
| 0150-matrix-adapter-into-worker-base | 2026-02-14 | Matrix adapter 基座化（删除 bus-mgmt，全量统一） | 6 | dev_0150-matrix-adapter-into-worker-base | Completed | ./docs/iterations/0150-matrix-adapter-into-worker-base/ |
| 0151-server-model100-decouple | 2026-02-21 | Server 去 Model 100 特判 + MOCK_SLIDING_APPS 外移 | 6 | dev_0151-server-model100-decouple | Completed | ./docs/iterations/0151-server-model100-decouple/ |
| 0152-server-intent-dispatch | 2026-02-21 | Server 通用 Intent Dispatch + Forward 触发映射模型化 | 10 | dev_0152-server-intent-dispatch | Completed | ./docs/iterations/0152-server-intent-dispatch/ |
| 0153-cognition-feedback-loop | 2026-02-23 | 认知环节显式化 + 动作状态反馈回路（四环智控模型落地） | 10 | dev_0153-cognition-feedback-loop | Completed | ./docs/iterations/0153-cognition-feedback-loop/ |
| 0154-llm-cognition-ollama | 2026-02-23 | LLM 认知层接入（Ollama Qwen 32B 本地部署） | 8 | dev_0154-llm-cognition-ollama | Completed | ./docs/iterations/0154-llm-cognition-ollama/ |
| 0155-prompt-filltable-ui | 2026-02-24 | Prompt 填表固定界面（多格多 Label，默认正数模型可改） | 8 | dev_0155-prompt-filltable-ui | Completed | ./docs/iterations/0155-prompt-filltable-ui/ |
| 0156-ui-renderer-component-registry | 2026-03-03 | UI Renderer 组件约定表先行（Registry-First + upload_media） | 7 | dev_0156-ui-renderer-component-registry | Completed | ./docs/iterations/0156-ui-renderer-component-registry/ |
| 0157a-spec-migration-gate | 2026-03-06 | 新旧规约迁移 Gate（登记+SSOT 切换） | 6 | dev_0157a-spec-migration-gate | Completed | ./docs/iterations/0157a-spec-migration-gate/ |
| 0157b-runtime-merge | 2026-03-06 | runtime.js/runtime.mjs 合并（保留 CJS shim） | 5 | dev_0157b-runtime-merge | Completed | ./docs/iterations/0157b-runtime-merge/ |
| 0158-runtime-new-label-types | 2026-03-06 | runtime 新 label.t 支持 + 兼容层 | 4 | dev_0158-runtime-new-label-types | Completed | ./docs/iterations/0158-runtime-new-label-types/ |
| 0159-filltable-new-types | 2026-03-06 | filltable_policy 与 FT skill 适配新类型 | 2 | dev_0159-filltable-new-types | Completed | ./docs/iterations/0159-filltable-new-types/ |
| 0160-ft-system-models-migration | 2026-03-06 | system-models + deploy patches JSON 全量迁移 | 1 | dev_0160-ft-system-models-migration | Completed | ./docs/iterations/0160-ft-system-models-migration/ |
| 0161-server-workers-adapt | 2026-03-06 | server + workers + deploy 配置适配 | 3 | dev_0161-server-workers-adapt | Completed | ./docs/iterations/0161-server-workers-adapt/ |
| 0162-ft-test-migration | 2026-03-06 | tests/validate 迁移与全量回归 | 2 | dev_0162-ft-test-migration | Completed | ./docs/iterations/0162-ft-test-migration/ |
| 0163-cleanup-deprecated-labels | 2026-03-06 | 清理旧类型兼容分支与零残留门控 | 7 | dev_0163-cleanup-deprecated-labels | Completed | ./docs/iterations/0163-cleanup-deprecated-labels/ |
| 0164-playwright-readiness-fixes | 2026-03-06 | Playwright 前置修复（迁移残留清扫 + 浏览器验证准入） | 3 | dev_0164-playwright-readiness-fixes | Completed | ./docs/iterations/0164-playwright-readiness-fixes/ |
| 0165-cloud-deploy-aaf4083 | 2026-03-06 | 以 aaf4083 干净快照尝试远端部署 | 3 | dev_0165-cloud-deploy-aaf4083 | Completed | ./docs/iterations/0165-cloud-deploy-aaf4083/ |
| 0166-ui-server-cloud-build-fix | 2026-03-06 | 修复 ui-server cloud deploy 的 frontend production build blocker | 3 | dev_0166-ui-server-cloud-build-fix | Completed | ./docs/iterations/0166-ui-server-cloud-build-fix/ |
| 0167-ui-server-matrix-token-auth | 2026-03-06 | ui-server 改用 drop access token，修复 Matrix login 429 导致的 matrix_unavailable | 3 | dev_0164-playwright-readiness-fixes | Completed | ./docs/iterations/0167-ui-server-matrix-token-auth/ |
| 0168-cloud-token-auth-reverify | 2026-03-06 | 复验 2e00cbe 的 cloud deploy 路径与 ui-server token 注入 | 3 | dev_0164-playwright-readiness-fixes | Completed | ./docs/iterations/0168-cloud-token-auth-reverify/ |
| 0169-cloud-source-gate-running-pod | 2026-03-06 | 修复 cloud deploy source gate 在 rollout 窗口内命中已终止 ui-server pod 的竞态 | 3 | dev_0164-playwright-readiness-fixes | Completed | ./docs/iterations/0169-cloud-source-gate-running-pod/ |
| 0170-local-mt-table-orbstack | 2026-03-06 | 本地 Orbstack + Ollama `mt-table` 联调、preview/apply 验证与共享知识落盘 | 4 | dev_0170-local-mt-table-orbstack | Completed | ./docs/iterations/0170-local-mt-table-orbstack/ |
| 0171-prompt-filltable-owner-chain | 2026-03-06 | Prompt FillTable 改为 owner-chain（candidate_changes + owner materialization） | 4 | dev_0171-prompt-filltable-owner-chain | Completed | ./docs/iterations/0171-prompt-filltable-owner-chain/ |
| 0172-response-effort-guidance | 2026-03-07 | 将每次回复附带 medium/high/xhigh 建议提升为执行规约 | 2 | dev_0172-response-effort-guidance | Completed | ./docs/iterations/0172-response-effort-guidance/ |
| 0173-handoff-mode-protocol | 2026-03-07 | Codex 会话升级/降级迁移协议 + `/handoff-mode` toggle + compact handoff 模板化 | 4 | dev_0173-handoff-mode-protocol | Completed | ./docs/iterations/0173-handoff-mode-protocol/ |
| 0175-local-color-generator-smoke | 2026-03-07 | 用颜色生成器例子验证项目本地运行链路 | 3 | dev_0175-local-color-generator-smoke | Completed | ./docs/iterations/0175-local-color-generator-smoke/ |
| 0174-project-address-record | 2026-03-07 | 本地 / 远端项目地址记录 user-guide | 3 | dev_0174-project-address-record | Completed | ./docs/iterations/0174-project-address-record/ |
| 0176-worker-spec-audit | 2026-03-07 | 三类软件工人规约审计 + Tier2 边界核对 + 手工填表验证用例设计 | 5 | dev_0176-worker-spec-audit | Completed | ./docs/iterations/0176-worker-spec-audit/ |
| 0177-worker-boundary-remediation | 2026-03-08 | 启动期直写与运行期标准链路分离 + 三类软件工人旁路封堵 | 5 | dev_0177-worker-boundary-remediation | Completed | ./docs/iterations/0177-worker-boundary-remediation/ |
| 0178-tier-boundary-conformance | 2026-03-08 | Tier 边界与负数/正数模型放置约束 + 引导式披露测试规范 | 3 | dev_0178-tier-boundary-conformance | Completed | ./docs/iterations/0178-tier-boundary-conformance/ |
| 0179-mbr-conformance-closure | 2026-03-08 | MBR 现规约合规收口：退役旧验证口径 + 补 runtime_mode gate + 清理 dead config | 4 | dev_0179-mbr-conformance-closure | Completed | ./docs/iterations/0179-mbr-conformance-closure/ |
| 0181-color-generator-local-egress-example | 2026-03-08 | 颜色生成器本地优先 + 仅 submit 经现有 pin 链上送至 Model 0 的规约样例 | 3 | dev_0181-color-generator-local-egress-example | Completed | ./docs/iterations/0181-color-generator-local-egress-example/ |
| 0182-color-generator-local-submit-chain | 2026-03-08 | 颜色生成器从 direct forward 迁到本地优先 + 仅 submit 经现有链路外发 | 5 | dev_0182-color-generator-local-submit-chain | Completed | ./docs/iterations/0182-color-generator-local-submit-chain/ |
| 0183-cloud-deploy-remote-build-split | 2026-03-11 | Cloud deploy 改为远端 remote build，并拆分 full / app 两类发布路径 | 4 | dev_0183-cloud-deploy-remote-build-split | Completed | ./docs/iterations/0183-cloud-deploy-remote-build-split/ |
| 0184-mbr-software-worker-remediation | 2026-03-11 | MBR 按软件工人规约收口：合法数据链路、同房间接收、桥接可观测性与远端闭环修复 | 5 | dev_0184-mbr-software-worker-remediation | Completed | ./docs/iterations/0184-mbr-software-worker-remediation/ |
| 0185-ui-local-first-negative-state | 2026-03-11 | UI 负数本地态本地优先收口：仅接入双总线的动作外发，输入/滑块类交互即时更新 | 4 | dev_0185-ui-local-first-negative-state | Completed | ./docs/iterations/0185-ui-local-first-negative-state/ |
| 0186-ui-overlay-commit-policy | 2026-03-11 | UI committed/overlay 双层语义 + commit_policy/commit_target 规约冻结（依赖先移除 legacy 外发通路） | 4 | dev_0186-ui-overlay-commit-policy | Completed | ./docs/iterations/0186-ui-overlay-commit-policy/ |
| 0187-remove-legacy-ui-egress-paths | 2026-03-11 | 移除 legacy mailbox->Matrix 外发通路，使 UI 外发 authority 只剩 Model 0 pin.bus.out | 4 | dev_0187-remove-legacy-ui-egress-paths | Completed | ./docs/iterations/0187-remove-legacy-ui-egress-paths/ |
| 0188-qwen35-local-filltable | 2026-03-12 | 本地 Qwen3.5 9B 驱动新版 owner-chain Prompt FillTable，并补齐 deterministic tests 与本地验证 | 4 | dev_0188-qwen35-local-filltable | Completed | ./docs/iterations/0188-qwen35-local-filltable/ |
| 0189-feishu-spec-gap-analysis | 2026-03-17 | Feishu 规约导入、临时落盘与项目规约差异分析 | 3 | dropx/dev_0189-feishu-spec-gap-analysis | Completed | ./docs/iterations/0189-feishu-spec-gap-analysis/ |
| 0190-data-array-tier2-template | 2026-03-17 | 按改进版规约落地首个 Tier2 数据模型：Data.Array 模板、合同测试与文档口径 | 3 | dropx/dev_0190-data-array-tier2-template | Completed | ./docs/iterations/0190-data-array-tier2-template/ |
| 0191a-ui-protocol-freeze | 2026-03-19 | UI 分层迁移 Phase 0：冻结最小 Tier 1 协议、route catalog 与 legacy AST fallback 切换规则 | 4 | dropx/dev_0191-ui-tier-boundary-audit | Completed | ./docs/iterations/0191a-ui-protocol-freeze/ |
| 0191b-gallery-modelization | 2026-03-19 | 将 Gallery 从硬编码页面迁为模型资产，并作为 Workspace 能力示例入口接入 | 4 | dropx/dev_0191b-gallery-modelization | Completed | ./docs/iterations/0191b-gallery-modelization/ |
| 0191b-gallery-compliance-fix | 2026-03-19 | Gallery model id registry 合规补丁与常量一致性收口 | 3 | dropx/dev_0191b-gallery-compliance-fix | Completed | ./docs/iterations/0191b-gallery-compliance-fix/ |
| 0191c-nav-login-prompt-dehardcode | 2026-03-19 | 导航去硬编码，并迁移 Login / Prompt 页面到模型资产来源 | 3 | dropx/dev_0191c-nav-login-prompt-dehardcode | Completed | ./docs/iterations/0191c-nav-login-prompt-dehardcode/ |
| 0191c-login-loading-bool-fix | 2026-03-19 | 修复 login_catalog_ui 中 login_loading 的类型错误并补最小合同验证 | 3 | dropx/dev_0191c-login-loading-bool-fix | Completed | ./docs/iterations/0191c-login-loading-bool-fix/ |
| 0191d-static-docs-home-legacy-removal | 2026-03-19 | 迁移 Static / Docs / Home 到模型资产来源，并删除 legacy AST 生成链 | 4 | dropx/dev_0191d-static-docs-home-legacy-removal | Completed | ./docs/iterations/0191d-static-docs-home-legacy-removal/ |
| 0191d-form-label-fix | 2026-03-19 | 补齐当前单 cell UI 资产模型的显式 model form label | 4 | dropx/dev_0191d-form-label-fix | Completed | ./docs/iterations/0191d-form-label-fix/ |
| 0192-conformance-failfast-rules | 2026-03-19 | 在最高优先级规约中补强 non-conformance fail fast 与 fallback 禁令 | 3 | dropx/dev_0192-conformance-failfast-rules | Completed | ./docs/iterations/0192-conformance-failfast-rules/ |
| 0193-editor-submodel-test-alignment | 2026-03-19 | 清理 editor legacy direct-mutation harness，使测试与测试资产对齐当前拒绝合同 | 3 | dropx/dev_0193-editor-submodel-test-alignment | Completed | ./docs/iterations/0193-editor-submodel-test-alignment/ |
| 0194-ui-snapshot-helper-dedup | 2026-03-19 | UI snapshot helper 去重，并删除 deriveHomeTableRows 的未消费字段 | 3 | dropx/dev_0194-ui-snapshot-helper-dedup | Completed | ./docs/iterations/0194-ui-snapshot-helper-dedup/ |
| 0195-worker-tier2-audit-and-rollout-plan | 2026-03-19 | 审计 MBR / remote worker / test UI-server worker 的新版规约差距，并产出 0196-0200 rollout 方案 | 3 | dropx/dev_0195-worker-tier2-audit-and-rollout-plan | Completed | ./docs/iterations/0195-worker-tier2-audit-and-rollout-plan/ |
| 0196-mbr-tier2-rebase | 2026-03-19 | 基于真实部署入口重填 MBR 角色，使其收敛到新版 Tier 2 路线 | 3 | dropx/dev_0196-mbr-tier2-rebase | Completed | ./docs/iterations/0196-mbr-tier2-rebase/ |
| 0196-mbr-doc-conformance-fix | 2026-03-19 | 修复 0196 审查中的注释与 conformance 例外说明，使文档与 triggerless 路线一致 | 2 | dropx/dev_0196-mbr-doc-conformance-fix | Completed | ./docs/iterations/0196-mbr-doc-conformance-fix/ |
| 0197-remote-worker-role-tier2-rebase | 2026-03-19 | 重填 remote worker role patch，使其按新版规约收敛到 Tier 2 路线 | 3 | dropx/dev_0197-remote-worker-role-tier2-rebase | Completed | ./docs/iterations/0197-remote-worker-role-tier2-rebase/ |
| 0197-remote-worker-doc-fix | 2026-03-19 | 修复 0197 审查中的 runlog 重复与 patch 描述旧术语问题 | 2 | dropx/dev_0197-remote-worker-doc-fix | Completed | ./docs/iterations/0197-remote-worker-doc-fix/ |
| 0198-ui-side-worker-tier2-rebase | 2026-03-19 | 将测试用 UI-side worker 重构为 patch-first 独立角色，并补齐部署入口资产 | 3 | dropx/dev_0198-ui-side-worker-tier2-rebase | Completed | ./docs/iterations/0198-ui-side-worker-tier2-rebase/ |
| 0199-local-integrated-browser-validation | 2026-03-19 | 本地部署 4 角色链路并完成脚本/Playwright/人工浏览器三层验收 | 3 | dropx/dev_0199-local-integrated-browser-validation | Completed | ./docs/iterations/0199-local-integrated-browser-validation/ |
| 0199-ui-entry-card-cleanup | 2026-03-20 | 修复 Workspace Card 标题解析并收口 Header 入口到 Workspace | 3 | dropx/dev_0199-ui-entry-card-cleanup | Completed | ./docs/iterations/0199-ui-entry-card-cleanup/ |
| 0200-remote-integrated-browser-validation | 2026-03-20 | 云端 4 角色链路集成部署与脚本/Playwright/人工浏览器三层验收 | 4 | dropx/dev_0200-remote-integrated-browser-validation | Completed | ./docs/iterations/0200-remote-integrated-browser-validation/ |
| 0201-route-sse-page-sync-fix | 2026-03-20 | 修复 remote mode 下 SSE 多页面/多标签导致的页面切换与 workspace 选中态同步异常 | 3 | dropx/dev_0201-route-sse-page-sync-fix | Completed | ./docs/iterations/0201-route-sse-page-sync-fix/ |
| 0200a-persisted-asset-loader-freeze | 2026-03-20 | 冻结持久化目录 loader 规约，并为后续本地 patch 外挂化定义 manifest / phase / writeback 边界 | 4 | dropx/dev_0200a-persisted-asset-loader-freeze | Completed | ./docs/iterations/0200a-persisted-asset-loader-freeze/ |
| 0200b-local-patch-externalization | 2026-03-20 | 在本地以 hostPath 挂载 authoritative assets，证明改 patch + rollout restart 即可生效 | 4 | dropx/dev_0200b-local-patch-externalization | Completed | ./docs/iterations/0200b-local-patch-externalization/ |
| 0200c-local-loader-validation | 2026-03-20 | 对 0200b 的 clean deploy / patch-only / restore / smoke 做本地验证，并裁决 0200 是否恢复 | 4 | dropx/dev_0200c-local-loader-validation | Completed | ./docs/iterations/0200c-local-loader-validation/ |
| 0196-mbr-doc-conformance-fix | 2026-03-19 | 修复 0196 审查中的注释与 conformance 例外说明，使文档与 triggerless 路线一致 | 2 | dropx/dev_0196-mbr-doc-conformance-fix | Completed | ./docs/iterations/0196-mbr-doc-conformance-fix/ |
| 0202-doit-auto-orchestrator | 2026-03-21 | doit-auto orchestrator v1：自然语言需求自动分解 + Codex/Claude Code 串行编排 + 动态 spawn + 追踪矩阵 | 11 | dropx/dev_0202-doit-auto-orchestrator | Completed | ./docs/iterations/0202-doit-auto-orchestrator/ |
| 0203-three-state-routing-review-policy | 2026-03-21 | orchestrator v1.1 Phase 1：三态路由 + review_policy 配置模型 | 4 | dropx/dev_0203-three-state-routing-review-policy | Completed | ./docs/iterations/0203-three-state-routing-review-policy/ |
| 0204-escalation-rules-engine | 2026-03-21 | orchestrator v1.1 Phase 2：escalation 规则引擎 + oscillation 检测 | 4 | dropx/dev_0204-escalation-rules-engine | Completed | ./docs/iterations/0204-escalation-rules-engine/ |
| 0205-orchestrator-observability-cleanup | 2026-03-21 | orchestrator v1.1 Phase 3：完成态收口 + observability 清理 | 4 | dropx/dev_0205-orchestrator-observability-cleanup | Completed | ./docs/iterations/0205-orchestrator-observability-cleanup/ |
| 0210-ui-cellwise-contract-freeze | 2026-03-22 | 冻结 UI cellwise / label / materialized model contract，明确 parent 与 matrix 两类合法挂载，禁止大 JSON 初始化 | 4 | dropx/dev_0210-ui-cellwise-contract-freeze | Completed | ./docs/iterations/0210-ui-cellwise-contract-freeze/ |
| 0211-ui-bootstrap-and-submodel-migration | 2026-03-22 | 将现有不合规的 UI bootstrap 与 submodel 挂载迁移到 0210 冻结合同 | 4 | dropx/dev_0211-ui-bootstrap-and-submodel-migration | Completed | ./docs/iterations/0211-ui-bootstrap-and-submodel-migration/ |
| 0212-home-crud-proper-tier2 | 2026-03-22 | 以 0210/0211 新模式补齐 Home 场景的增删改查 Tier 2，不再依赖旧 ui_ast_v0 路径 | 4 | dropx/dev_0212-home-crud-proper-tier2 | Completed | ./docs/iterations/0212-home-crud-proper-tier2/ |
| 0213-matrix-debug-ui-surface | 2026-03-22 | 为 Matrix 通讯主体补齐 Tier 1 调试/操作 UI surface，形成可复用 debug 面 | 4 | dropx/dev_0213-matrix-debug-ui-surface | Completed | ./docs/iterations/0213-matrix-debug-ui-surface/ |
| 0214-sliding-flow-ui | 2026-03-22 | 在 0213 debug surface 之上实现 sliding flow UI 与过程态交互 | 4 | dropx/dev_0214-sliding-flow-ui | Completed | ./docs/iterations/0214-sliding-flow-ui/ |
| 0215-ui-model-tier2-examples-v1 | 2026-03-22 | 提供符合新合同的 parent model / data path / UI component Tier 2 examples v1 | 4 | dropx/dev_0215-ui-model-tier2-examples-v1 | Completed | ./docs/iterations/0215-ui-model-tier2-examples-v1/ |
| 0216-threejs-runtime-and-scene-crud | 2026-03-22 | 建立 Three.js host/renderer Tier 1 与 scene/model CRUD Tier 2 的最小闭环 | 4 | dropx/dev_0216-threejs-runtime-and-scene-crud | Completed | ./docs/iterations/0216-threejs-runtime-and-scene-crud/ |
| 0217-gallery-extension-matrix-three | 2026-03-22 | 在 Gallery 侧扩展 Matrix + Three.js 示例与数据链路，形成展示闭环 | 4 | dropx/dev_0217-gallery-extension-matrix-three | Completed | ./docs/iterations/0217-gallery-extension-matrix-three/ |
| 0218-orchestrator-browser-task-contract-freeze | 2026-03-23 | 冻结 orchestrator 的 browser_task 协议、artifact 目录、状态语义与双写审计合同 | 4 | dropx/dev_0218-orchestrator-browser-task-contract-freeze | Completed | ./docs/iterations/0218-orchestrator-browser-task-contract-freeze/ |
| 0219-orchestrator-browser-agent-bridge | 2026-03-23 | 实现 Browser Agent Bridge：request/result 文件协议、幂等恢复、Browser Agent 消费面 | 3 | dropx/dev_0219-orchestrator-browser-agent-bridge | Completed | ./docs/iterations/0219-orchestrator-browser-agent-bridge/ |
| 0220-orchestrator-browser-phase-and-regression | 2026-03-23 | 将 browser task 接入 orchestrator 主循环、resume、事件与回归测试 | 3 | dropx/dev_0220-orchestrator-browser-phase-and-regression | Completed | ./docs/iterations/0220-orchestrator-browser-phase-and-regression/ |
| 0221-playwright-mcp-local-smoke | 2026-03-23 | 用真实 Playwright MCP 跑通最小本地 browser_task 闭环，证明 bridge 可用 | 3 | dropx/dev_0221-playwright-mcp-local-smoke | Completed | ./docs/iterations/0221-playwright-mcp-local-smoke/ |
| 0222-local-cluster-rollout-baseline | 2026-03-23 | 将 0210-0217 当前代码基线实际 rollout 到本地集群，并验证服务版本/入口/ready 状态与仓库一致 | 3 | dropx/dev_0222-local-cluster-rollout-baseline | Completed | ./docs/iterations/0222-local-cluster-rollout-baseline/ |
| 0223-local-cluster-browser-evidence | 2026-03-23 | 用 Browser Task + Playwright MCP 为本地集群环境生成 0210-0217 的可审计证据 | 3 | dropx/dev_0223-local-cluster-browser-evidence | Completed | ./docs/iterations/0223-local-cluster-browser-evidence/ |
| 0224-remote-rollout-baseline | 2026-03-23 | 在远端白名单操作边界内完成 0210-0217 当前基线的远端 rollout / readiness / source gate 验证 | 3 | dropx/dev_0224-remote-rollout-baseline | On Hold | ./docs/iterations/0224-remote-rollout-baseline/ |
| 0225-remote-browser-evidence | 2026-03-23 | 用 Browser Task + Playwright MCP 为远端环境生成最终取证，给出 environment-effective 裁决 | 3 | dropx/dev_0225-remote-browser-evidence | On Hold | ./docs/iterations/0225-remote-browser-evidence/ |
| 0226-orchestrator-ops-task-contract-freeze | 2026-03-24 | 冻结 orchestrator 的 ops_task 协议、任意 shell 外层执行边界、artifact 与双写审计合同 | 4 | dropx/dev_0226-orchestrator-ops-task-contract-freeze | Completed | ./docs/iterations/0226-orchestrator-ops-task-contract-freeze/ |
| 0227-orchestrator-ops-executor-bridge | 2026-03-24 | 实现 Ops Executor Bridge：request/result 文件协议、claim/release、stdout/stderr/exit_code 与 artifact 归档 | 4 | dropx/dev_0227-orchestrator-ops-executor-bridge | Completed | ./docs/iterations/0227-orchestrator-ops-executor-bridge/ |
| 0228-orchestrator-ops-phase-and-regression | 2026-03-24 | 将 ops_task 接入 orchestrator 主循环、resume、On Hold、状态投影与回归测试 | 4 | dropx/dev_0228-orchestrator-ops-phase-and-regression | Completed | ./docs/iterations/0228-orchestrator-ops-phase-and-regression/ |
| 0229-local-ops-bridge-smoke | 2026-03-24 | 用外层 executor 真实执行本地 kubectl/deploy_local/readiness 路径，证明 local ops bridge 可用 | 3 | dropx/dev_0229-local-ops-bridge-smoke | Completed | ./docs/iterations/0229-local-ops-bridge-smoke/ |
| 0230-remote-ops-bridge-smoke | 2026-03-24 | 用外层 executor 真实执行远端 rollout/readiness 白名单路径，证明 remote ops bridge 可用 | 3 | dropx/dev_0230-remote-ops-bridge-smoke | On Hold | ./docs/iterations/0230-remote-ops-bridge-smoke/ |
| 0231-final-verification-manual-accept-consistency | 2026-03-25 | 修复 Final Verification prose parse false negative 被人工接受后，authoritative terminal state 与投影不一致的问题 | 4 | dropx/dev_0231-final-verification-manual-accept-consistency | Completed | ./docs/iterations/0231-final-verification-manual-accept-consistency/ |
| 0232-local-baseline-surface-gate | 2026-03-25 | 将本地 baseline gate 从 deployment/secret readiness 收紧到 live snapshot / page_asset / workspace registry / surface 对齐，避免“ready 但 UI 仍旧”误判 | 4 | dropx/dev_0232-local-baseline-surface-gate | Completed | ./docs/iterations/0232-local-baseline-surface-gate/ |
| 0233-local-matrix-debug-surface-materialization-fix | 2026-03-25 | 修复 canonical local repair 后 `Model -100 / 0,1,0 / page_asset_v0 = matrix_debug_root` 仍未 materialize 的链路缺口 | 4 | dropx/dev_0233-local-matrix-debug-surface-materialization-fix | Completed | ./docs/iterations/0233-local-matrix-debug-surface-materialization-fix/ |
| 0234-local-browser-evidence-effective-rerun | 2026-03-25 | 在 0233 修复后重新执行本地 Playwright MCP 取证，裁决 local environment 是否已 effective | 3 | dropx/dev_0234-local-browser-evidence-effective-rerun | Completed | ./docs/iterations/0234-local-browser-evidence-effective-rerun/ |
| 0235-local-home-surface-materialization-fix | 2026-03-26 | 修复 local environment 中 Home 路由仍渲染 legacy `home-datatable` 而非预期 `root_home` surface 的 materialization/route chain 缺口 | 4 | dropx/dev_0235-local-home-surface-materialization-fix | Completed | ./docs/iterations/0235-local-home-surface-materialization-fix/ |
| 0236-local-home-browser-evidence-rerun | 2026-03-26 | 在 0235 修复后重跑本地 Playwright MCP 取证，重新裁决 local environment 是否已 effective | 3 | dropx/dev_0236-local-home-browser-evidence-rerun | Completed | ./docs/iterations/0236-local-home-browser-evidence-rerun/ |
| 0237-local-browser-surface-regressions-fix | 2026-03-26 | 修复本地 browser 侧剩余 surface regressions：Matrix Debug 打开后显示 no UI schema/AST，以及首页 Model 筛选下拉未正确呈现 model0 选项/选中态 | 4 | dropx/dev_0237-local-browser-surface-regressions-fix | Cancelled (split into 0238/0239, verified by 0240) | ./docs/iterations/0237-local-browser-surface-regressions-fix/ |
| 0238-local-matrix-debug-materialization-regression-fix | 2026-03-26 | 修复 Matrix Debug formal surface 在 live local materialization 链中再次丢失，导致浏览器显示 no UI schema/AST 的回归 | 4 | dropx/dev_0238-local-matrix-debug-materialization-regression-fix | Completed | ./docs/iterations/0238-local-matrix-debug-materialization-regression-fix/ |
| 0239-local-home-selector-model0-fix | 2026-03-26 | 修复首页 Model 筛选下拉未包含/未选中 model0，且 current value 漂移到负数或错误正数模型的问题 | 4 | dropx/dev_0239-local-home-selector-model0-fix | Completed | ./docs/iterations/0239-local-home-selector-model0-fix/ |
| 0240-local-browser-evidence-rerun-after-0238-0239 | 2026-03-26 | 在 0238 与 0239 修复后重跑本地 Playwright MCP 取证，重新裁决 local environment 是否 finally effective | 3 | dropx/dev_0240-local-browser-evidence-rerun-after-0238-0239 | Completed | ./docs/iterations/0240-local-browser-evidence-rerun-after-0238-0239/ |
| 0241-local-integration-recovery-for-0240 | 2026-03-26 | 将已完成但未并回主线的 0235/0238 修复恢复到 dev，并在整合后的基线上承接 0239，为 0240 提供完整本地基线 | 4 | dropx/dev_0241-local-integration-recovery-for-0240 | Completed | ./docs/iterations/0241-local-integration-recovery-for-0240/ |
| 0242-local-ui-model-example-and-sync-validation | 2026-03-26 | 确认 UI 抽象层已从大 JSON 拆分为 cellwise/page-asset/submodel 合同，补一份本地 Fill-Table 示例文档，并冻结 input 0.2s 延迟同步验证 | 4 | dropx/dev_0242-local-ui-model-example-and-sync-validation | Completed | ./docs/iterations/0242-local-ui-model-example-and-sync-validation/ |
| 0243-home-mailbox-crud-for-filltable | 2026-03-26 | 以 0212 已冻结的 Home CRUD action 名为准，在 Home 页 materialize mailbox-based CRUD，使本地 Home 可直接对正数模型执行增删改查 | 5 | dropx/dev_0243-home-mailbox-crud-for-filltable | Completed | ./docs/iterations/0243-home-mailbox-crud-for-filltable/ |
| 0244-pin-only-core-with-scoped-privilege-contract-freeze | 2026-03-26 | 将“PIN-only 为核心、same-model scoped privilege 为例外”的权限与链路模型冻结成正式 contract，明确 table/matrix/root/privileged cell/submt 边界 | 4 | dropx/dev_0244-pin-only-core-with-scoped-privilege-contract-freeze | Completed | ./docs/iterations/0244-pin-only-core-with-scoped-privilege-contract-freeze/ |
| 0245-scoped-privilege-runtime-and-regression | 2026-03-26 | 只实现 runtime 层 scoped privilege 能力：privileged capability 识别、same-model scope check、submt hard-boundary 与 regression tests | 4 | dropx/dev_0245-scoped-privilege-runtime-and-regression | Completed | ./docs/iterations/0245-scoped-privilege-runtime-and-regression/ |
| 0246-home-crud-pin-migration-pilot | 2026-03-26 | 基于 0245 已验证的 runtime scoped privilege 能力，将 Home CRUD 从 mailbox 链迁到 PIN，作为第一个业务迁移样板 | 4 | dropx/dev_0246-home-crud-pin-migration-pilot | Cancelled (superseded by 0249) | ./docs/iterations/0246-home-crud-pin-migration-pilot/ |
| 0247-cross-model-pin-owner-materialization-contract-freeze | 2026-03-26 | 冻结“cross-model pin-mediated owner materialization”合同，定义 handler 不能跨模型直写时，如何通过 pin 输出写入请求并由目标模型自行 materialize | 4 | dropx/dev_0247-cross-model-pin-owner-materialization-contract-freeze | Completed | ./docs/iterations/0247-cross-model-pin-owner-materialization-contract-freeze/ |
| 0248-cross-model-pin-owner-materialization-runtime-and-regression | 2026-03-26 | 基于 0247 合同实现 cross-model pin owner materialization 的 runtime 支撑与 regression，打通 source emit -> target owner materialize 的最小能力 | 4 | dropx/dev_0248-cross-model-pin-owner-materialization-runtime-and-regression | Completed | ./docs/iterations/0248-cross-model-pin-owner-materialization-runtime-and-regression/ |
| 0249-home-crud-pin-migration-retry-on-owner-materialization | 2026-03-26 | 在 0248 runtime 能力就绪后，回到 Home CRUD 的 pin 迁移，替换 0246 的 mailbox/dispatch 写入路径并完成本地页面验证 | 4 | dropx/dev_0249-home-crud-pin-migration-retry-on-owner-materialization | Completed | ./docs/iterations/0249-home-crud-pin-migration-retry-on-owner-materialization/ |
| 0250-ui-model-filltable-workspace-example | 2026-03-26 | 重写 UI model filltable Workspace 示例，明确外部 FillTable 合同、内部 bootstrap patch 与 ownership/dataflow 边界 | 3 | dev_0250-ui-model-filltable-workspace-example | Completed | ./docs/iterations/0250-ui-model-filltable-workspace-example/ |
| 0251-ui-modeltable-overview-format | 2026-03-27 | 将 1003/1004 示例压成“完整模型表总览 -> Cell -> [k,t,v]”格式，便于直接照抄填表 | 2 | dev_0251-ui-modeltable-overview-format | Completed | ./docs/iterations/0251-ui-modeltable-overview-format/ |
| 0252-home-legacy-handler-cleanup | 2026-03-27 | 删除 intent_handlers_home 中已被 0249 降级为非权威路径的 legacy handle_home_* direct-write 实现并补回归验证 | 2 | dev_0252-home-legacy-handler-cleanup | Completed | ./docs/iterations/0252-home-legacy-handler-cleanup/ |
| 0253-hard-cut-ui-authoring-and-write-contract-freeze | 2026-03-27 | 一刀切冻结新的 UI authoring 与 write contract：cellwise authoring 成为唯一 source，业务写入统一 pin/owner-materialization，旧 page_asset_v0/manual bind.write 路线废弃 | 5 | dev_0253-hard-cut-ui-authoring-and-write-contract-freeze | Completed | ./docs/iterations/0253-hard-cut-ui-authoring-and-write-contract-freeze/ |
| 0254-hard-cut-cellwise-authoring-runtime | 2026-03-27 | 实现新的 cellwise UI authoring runtime/compiler，使组件声明、父子挂载、排版 label 能编译成唯一 runtime render target | 5 | dev_0254-hard-cut-cellwise-authoring-runtime | Completed | ./docs/iterations/0254-hard-cut-cellwise-authoring-runtime/ |
| 0255-hard-cut-bind-write-pin-only-cutover | 2026-03-27 | 将通用 UI 业务写入一刀切到 pin/owner-materialization，废弃 direct business-state bind.write 路径 | 5 | dev_0255-hard-cut-bind-write-pin-only-cutover | Completed | ./docs/iterations/0255-hard-cut-bind-write-pin-only-cutover/ |
| 0256-hard-cut-first-page-rebuild | 2026-03-27 | 选一个真实页面按新 cellwise authoring + pin-only write 体系完全重建并做本地页面级验证 | 4 | dev_0256-hard-cut-first-page-rebuild | Completed | ./docs/iterations/0256-hard-cut-first-page-rebuild/ |
| 0257-hard-cut-legacy-path-deletion | 2026-03-27 | 删除旧手写 page_asset_v0 authoring 与 direct business bind.write 路径，完成 hard-cut 收尾 | 5 | dev_0257-hard-cut-legacy-path-deletion | Completed | ./docs/iterations/0257-hard-cut-legacy-path-deletion/ |
| 0260-model100-submit-roundtrip-hardening | 2026-03-29 | 让颜色生成器（Model 100）重新符合 hard-cut 主线：submit 去程/回程恢复、stale inflight 清理、浏览器按钮可用、truth 与 scene/lifecycle 一致 | 5 | dev_0260-model100-submit-roundtrip-hardening | Completed | ./docs/iterations/0260-model100-submit-roundtrip-hardening/ |
| 0261-docs-source-flip | 2026-03-30 | 反转 docs 数据源：仓库内 docs 为权威源，vault 路径改为指向仓库 docs 的 symlink | 4 | dev_0261-docs-source-flip | Completed | ./docs/iterations/0261-docs-source-flip/ |
| 0262-model-mounting-audit | 2026-03-30 | 以真实 repo/runtime 事实重建模型挂载可视化，并输出挂载合规审计 | 4 | dev_0262-model-mounting-audit | Completed | ./docs/iterations/0262-model-mounting-audit/ |
| 0263-mounting-remediation | 2026-03-30 | 统一各 software worker 的模型层级：消除未挂载与多重挂载，按 profile 收口 hierarchy | 5 | dev_0263-mounting-remediation | Completed | ./docs/iterations/0263-mounting-remediation/ |
| 0264-debug-crud-unhide-all | 2026-03-30 | 调试 ModelTable 增删改查界面取消结构标签隐藏，并支持直接操作任意模型/任意 label.t | 4 | dev_0264-debug-crud-unhide-all | Completed | ./docs/iterations/0264-debug-crud-unhide-all/ |
| 0265-local-deploy-and-debug-policy | 2026-03-30 | 重新部署本地环境验证 debug CRUD 放开已生效，并把“开发后先部署再测试”提升为执行规约 | 3 | dev_0265-local-deploy-and-debug-policy | Completed | ./docs/iterations/0265-local-deploy-and-debug-policy/ |
| 0266-scoped-patch-authority | 2026-03-30 | 冻结并实施“全局 patch 仅限 bootstrap、运行态修改必须经当前模型 helper 执行 scoped patch”的权限模型，并升级所有受影响 JSON patches 后再部署验收 | 6 | dev_0266-scoped-patch-authority | Completed | ./docs/iterations/0266-scoped-patch-authority/ |
| 0267-home-save-draft-sync | 2026-03-31 | 修复首页 ModelTable 编辑弹窗在 JSON 文本编辑后的保存竞态，并显式显示保存失败错误 | 3 | dev_0267-home-save-draft-sync | In Progress | ./docs/iterations/0267-home-save-draft-sync/ |
| 0268-home-all-models-filter | 2026-03-31 | 首页模型选择器支持“不筛选/All models”，并在该模式下展示所有模型行且对不明确目标的创建动作保持显式阻断 | 3 | dev_0268-home-all-models-filter | Completed | ./docs/iterations/0268-home-all-models-filter/ |
| 0269-model100-live-submit-regression | 2026-03-31 | 修复 live 环境下颜色生成器点击后不出站的问题，恢复 `prepare_model100_submit` 注册与整条双总线样板链路 | 3 | dev_0269-model100-live-submit-regression | Completed | ./docs/iterations/0269-model100-live-submit-regression/ |
| 0270-workspace-ui-filltable-example | 2026-03-31 | 新增一个预置 Workspace UI 模型示例：由 Input/Button/Label 组成，可通过改表切换远端双总线模式与本地程序模型模式，并形成删除后重建教程 | 7 | dev_0270-workspace-ui-filltable-example | Completed | ./docs/iterations/0270-workspace-ui-filltable-example/ |
| 0271-cloud-deploy-current-state | 2026-04-01 | 将当前 dev 状态同步部署到远端 cloud rke2 环境，并验证远端入口、Workspace 示例与远端双总线链路 | 4 | dev_0271-cloud-deploy-current-state | Completed | ./docs/iterations/0271-cloud-deploy-current-state/ |
| 0272-static-workspace-rebuild | 2026-04-01 | 用新版 Workspace app + truth model 体系重建 Static 页面，保留 `/p/<projectName>/...` 访问规则，并完成真实上传验证 | 6 | dev_0272-static-workspace-rebuild | Completed | ./docs/iterations/0272-static-workspace-rebuild/ |
| 0273-cloud-deploy-static-workspace | 2026-04-01 | 将 0272 Static Workspace 重建同步到远端 cloud 环境，并完成公网上传与 `/p/<projectName>/...` 访问验证 | 4 | dev_0273-cloud-deploy-static-workspace | Completed | ./docs/iterations/0273-cloud-deploy-static-workspace/ |
| 0274-visualized-guide-publish | 2026-04-01 | 将 `workspace_ui_filltable_example` 的可视化 Markdown/HTML 版本正式纳入用户文档目录，并补索引与迭代记录 | 3 | dev_0274-visualized-guide-publish | Completed | ./docs/iterations/0274-visualized-guide-publish/ |
| 0275-doc-page-filltable-extension | 2026-04-01 | 文档型页面填表能力 MVP 基础扩展：新增 8 个文档语义组件 + 8 个 UI authoring 字段约定 + Static 上传/删除修复 | 7 | dev_0275-doc-page-filltable-extension | Completed | ./docs/iterations/0275-doc-page-filltable-extension/ |
| 0276-doc-workspace-example-and-static-fileinput | 2026-04-02 | 修复 Static 文件选择器交互，并新增一个正式 Workspace 文档页面示例，证明可完全通过填表组成接近 visualized HTML 的界面 | 6 | dev_0276-doc-workspace-example-and-static-fileinput | Completed | ./docs/iterations/0276-doc-workspace-example-and-static-fileinput/ |
| 0277-non-three-fine-grain-audit | 2026-04-03 | 排除 Three.js 后，对 workspace_positive_models.json 做细粒度审查并产出收口优先级清单 | 3 | dev_0277-non-three-fine-grain-audit | Completed | ./docs/iterations/0277-non-three-fine-grain-audit/ |
| 0278-non-three-fine-grain-remediation | 2026-04-03 | 先对 0270 / 0276 / Static 的页面 authoring 粗块做细粒度收口，不碰 Three.js 与大流程函数 | 5 | dev_0278-non-three-fine-grain-remediation | Completed | ./docs/iterations/0278-non-three-fine-grain-remediation/ |
| 0279-visualized-doc-and-0276-align | 2026-04-03 | 先更新 visualized 文档到细粒度文档页面版本，再让 0276 的正式 Workspace 页面与之对齐 | 4 | dev_0279-visualized-doc-and-0276-align | Completed | ./docs/iterations/0279-visualized-doc-and-0276-align/ |
| 0280-cloud-deploy-current-dev | 2026-04-03 | 将当前 dev 状态部署到远端 cloud，并完成颜色生成器、0276、Static 的公网验证 | 4 | dev_0280-cloud-deploy-current-dev | Completed | ./docs/iterations/0280-cloud-deploy-current-dev/ |
| 0281-slide-matrix-three-baseline | 2026-04-03 | 盘清 Slide UI、Matrix 系统层与用户产品层、Three.js 场景 CRUD 的当前起点，作为后续重头规划的统一基线 | 2 | dev_0281-slide-matrix-three-baseline | Completed | ./docs/iterations/0281-slide-matrix-three-baseline/ |
| 0282-baseline-doc-clarify | 2026-04-03 | 修正 0281 基线文档中的本地绝对路径，并补充后续 UI 模型能力合法扩展与沉淀约束 | 1 | dev_0282-baseline-doc-clarify | Completed | ./docs/iterations/0282-baseline-doc-clarify/ |
| 0283-matrix-userline-phase1 | 2026-04-03 | Matrix 非加密第一阶段：落地 `1016-1019` 正数模型块、最小登录/session 真值，以及经 MBR 双总线的一发一收最小闭环 | 3 | dev_0283-matrix-userline-phase1 | Completed | ./docs/iterations/0283-matrix-userline-phase1/ |
| 0284-matrix-userline-phase2 | 2026-04-03 | Matrix 非加密第二阶段：规划私聊/群聊基础界面、房间列表、消息时间线、输入框与基础成员管理 | 2 | dev_0284-matrix-userline-phase2 | Completed | ./docs/iterations/0284-matrix-userline-phase2/ |
| 0285-matrix-userline-phase3 | 2026-04-03 | Matrix 非加密第三阶段：规划完整用户管理，包括注册、资料编辑与在线状态展示 | 2 | dev_0285-matrix-userline-phase3 | Approved | ./docs/iterations/0285-matrix-userline-phase3/ |
| 0286-matrix-userline-phase4 | 2026-04-03 | Matrix 非加密第四阶段：规划视频通话（含多人）的信令、媒体链路与最小产品范围 | 2 | dev_0286-matrix-userline-phase4 | Approved | ./docs/iterations/0286-matrix-userline-phase4/ |
| 0287-slide-ui-mainline-split | 2026-04-05 | 基于 0214 与当前基线，正式拆分 Slide UI 主线后续阶段与依赖顺序 | 2 | dev_0287-slide-ui-mainline-split | Planned | ./docs/iterations/0287-slide-ui-mainline-split/ |
| 0288-slide-ui-phaseA-topology-freeze | 2026-04-05 | Slide UI Phase A：冻结 ui-server / remote-worker / MBR 的双工人拓扑、权属边界与 Model 100 合同锚点 | 2 | dev_0288-slide-ui-phaseA-topology-freeze | Approved | ./docs/iterations/0288-slide-ui-phaseA-topology-freeze/ |
| 0289-slide-ui-phaseB-workspace-generalization | 2026-04-06 | Slide UI Phase B：将当前围绕 Model 100 的单点 Slide UI 壳推广为 Workspace 中多个 slide-capable app 的通用主线 | 2 | dev_0289-slide-ui-phaseB-workspace-generalization | Completed | ./docs/iterations/0289-slide-ui-phaseB-workspace-generalization/ |
| 0290-slide-ui-phaseC-filltable-create-mount | 2026-04-06 | Slide UI Phase C：规划用户通过填表创建 slide app、声明 metadata，并挂载到 Workspace 主线 | 2 | dev_0290-slide-ui-phaseC-filltable-create-mount | Completed | ./docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/ |
| 0291-slide-ui-phaseD-gallery-doc-evidence | 2026-04-06 | Slide UI Phase D：规划 Gallery 展示、使用文档与浏览器/远端取证的正式收口资产 | 2 | dev_0291-slide-ui-phaseD-gallery-doc-evidence | Completed | ./docs/iterations/0291-slide-ui-phaseD-gallery-doc-evidence/ |
| 0292-foundation-pin-payload-contract-freeze | 2026-04-06 | 基础 A：冻结新引脚/数据合同并完成全仓影响盘点，作为后续 Matrix、Slide UI、3D 与数据模型工作的共同前置 | 2 | dev_0292-foundation-pin-payload-contract-freeze | Completed | ./docs/iterations/0292-foundation-pin-payload-contract-freeze/ |
| 0294-foundation-b-runtime-migration | 2026-04-06 | 基础 B：实现新引脚/数据合同并完成 runtime、system-models 与验证脚本的正式迁移 | 3 | dev_0294-foundation-b-runtime-migration | Completed | ./docs/iterations/0294-foundation-b-runtime-migration/ |
| 0296-foundation-c-data-models | 2026-04-06 | 基础 C：以新 pin/payload 合同为前提，迁移 Data.Array 并补齐 Data.Queue / Data.Stack 第一批正式数据模型族 | 3 | dev_0296-foundation-c-data-models | Completed | ./docs/iterations/0296-foundation-c-data-models/ |
| 0298-pin-contract-cleanup | 2026-04-06 | cleanup：清理非主路径上的 pin.table./pin.single./pin.model.* 历史残留，并同步更新规范文档 | 3 | dev_0298-pin-contract-cleanup | Completed | ./docs/iterations/0298-pin-contract-cleanup/ |
| 0302-slide-app-zip-import-v1 | 2026-04-08 | Slide app zip 导入 v1：用临时模型表压缩包完成导入、挂载、打开与卸载最小闭环 | 5 | dev_0302-slide-app-zip-import-v1 | Completed | ./docs/iterations/0302-slide-app-zip-import-v1/ |
| 0303-cloud-worker-sync-and-color-proxy-import | 2026-04-09 | 同步 cloud 的 mbr-worker / remote-worker 以恢复公网颜色生成器，并产出一个可导入的颜色生成器代理 slide app zip 示例 | 3 | dev_0303-cloud-worker-sync-and-color-proxy-import | Completed | ./docs/iterations/0303-cloud-worker-sync-and-color-proxy-import/ |
| 0304-slide-runtime-scope-semantics-freeze | 2026-04-09 | 冻结 Slide Runtime 新语义：分离 pin.table/pin.single 遗留清理与多重模型归属语义，并明确后续 IT 拆分 | 4 | dev_0304-slide-runtime-scope-semantics-freeze | Completed | ./docs/iterations/0304-slide-runtime-scope-semantics-freeze/ |
| 0305-slide-event-target-and-deferred-input-sync | 2026-04-09 | 前端事件目标合同升级为“当前模型 + 当前单元格”，并恢复正数模型 Input 的延后同步 | 4 | dev_0305-slide-event-target-and-deferred-input-sync | Completed | ./docs/iterations/0305-slide-event-target-and-deferred-input-sync/ |
| 0306-slide-pin-chain-routing-buildout | 2026-04-09 | 建成 slide 主线的合法 pin-chain 路由：`Model 100 submit` 与 `slide_app_import/create + ws_app_*` 经 Model 0 进入并到达目标程序模型 IN | 4 | dev_0306-slide-pin-chain-routing-buildout | Completed | ./docs/iterations/0306-slide-pin-chain-routing-buildout/ |
| 0307-slide-executable-app-import-v1 | 2026-04-09 | 执行型 slide app 导入 v1：支持 runtime `func.js` 与基于 pin 直寻址的特定事件两类前端业务，并冻结安全策略 | 4 | dev_0307-slide-executable-app-import-v1 | Completed | ./docs/iterations/0307-slide-executable-app-import-v1/ |
| 0308-slide-legacy-shortcut-retirement | 2026-04-09 | 在新合法链路稳定后，退役 ui-server 中现有的快捷事件路由并统一收口 | 3 | dev_0308-slide-legacy-shortcut-retirement | Completed | ./docs/iterations/0308-slide-legacy-shortcut-retirement/ |
| 0309-slide-matrix-delivery-and-coworker-guide | 2026-04-09 | 输出滑动 APP 的 Matrix 投递协议、接口预告与同事说明文档 | 3 | dev_0309-slide-matrix-delivery-and-coworker-guide | Completed | ./docs/iterations/0309-slide-matrix-delivery-and-coworker-guide/ |
| 0310-slide-frontend-pin-addressing-freeze | 2026-04-09 | 冻结前端 pin 直寻址协议：前端事件不再以 action 为正式语义，并明确投影如何下发可写 pin 信息 | 4 | dev_0310-slide-frontend-pin-addressing-freeze | Completed | ./docs/iterations/0310-slide-frontend-pin-addressing-freeze/ |
| 0311-slide-page-asset-pinification-buildout | 2026-04-09 | 将内置页面与系统动作按钮改成 cell pin 投影，前端直接写目标 pin，不再依赖 action->ingress 翻译层 | 5 | dev_0311-slide-page-asset-pinification-buildout | Completed | ./docs/iterations/0311-slide-page-asset-pinification-buildout/ |
| 0312-slide-upload-auth-and-cache-contract | 2026-04-10 | 冻结 slide 导入上传鉴权与 media cache-priming 合同，补正式说明与自动化测试 | 3 | dev_0312-slide-upload-auth-and-cache-contract | Completed | ./docs/iterations/0312-slide-upload-auth-and-cache-contract/ |
| 0313-slide-delivery-and-runtime-overview | 2026-04-10 | 收口一页同事总说明，并排解释 slide app 的安装交付链与导入后运行链 | 2 | dev_0313-slide-delivery-and-runtime-overview | Completed | ./docs/iterations/0313-slide-delivery-and-runtime-overview/ |
| 0314-agents-collaboration-guidance-sync | 2026-04-13 | 将 AGENTS.md 中的 repo-local collaboration 补充正式提交并同步到 dev | 1 | dev_0314-agents-collaboration-guidance-sync | Completed | ./docs/iterations/0314-agents-collaboration-guidance-sync/ |
| 0315-workspace-sidebar-name-width | 2026-04-13 | 调整 Workspace 左侧 app 列表的列宽分配，在不加宽侧栏前提下给 app 名称更多显示空间 | 2 | dev_0315-workspace-sidebar-name-width | Completed | ./docs/iterations/0315-workspace-sidebar-name-width/ |
| 0316-slide-python-install-client-example | 2026-04-13 | 提供一个 Python 安装客户端示例，让同事拿着 slide app zip 能按当前正式主线向项目部署 slide app | 3 | dev_0316-slide-python-install-client-example | Completed | ./docs/iterations/0316-slide-python-install-client-example/ |
| 0317-time-static-root-zip | 2026-04-13 | 将 `time.zip` 重组为根目录带 `index.html` 的静态包，并用现有 Static 主线上传到 `/p/<projectName>/` | 2 | dev_0317-time-static-root-zip | Completed | ./docs/iterations/0317-time-static-root-zip/ |
| 0318-static-wasm-mime-fix | 2026-04-13 | 修复 Static 发布路径对 `.wasm` 的 MIME 类型，确保浏览器能真正执行 wasm 页面 | 2 | dev_0318-static-wasm-mime-fix | Completed | ./docs/iterations/0318-static-wasm-mime-fix/ |
| 0320-imported-slide-app-host-ingress-semantics-freeze | 2026-04-14 | docs-only 冻结 imported slide app 的宿主接入语义，裁决正式业务 ingress、宿主 adapter 和边界 pin 要求 | 3 | dev_0320-imported-slide-app-host-ingress-semantics-freeze | Completed | ./docs/iterations/0320-imported-slide-app-host-ingress-semantics-freeze/ |
| 0321-imported-slide-app-host-ingress-implementation | 2026-04-14 | 按 0320 的 v1 规约落第一批宿主 ingress 实现：导入期声明 boundary pin，安装时自动补 Model 0 host adapter | 4 | dev_0321-imported-slide-app-host-ingress-implementation | Completed | ./docs/iterations/0321-imported-slide-app-host-ingress-implementation/ |
| 0322-imported-slide-app-host-egress-test-app | 2026-04-16 | 补 imported slide app 的宿主 egress adapter，并产出一个可导入的测试 zip，验证宿主入口、内部整理与 `pin.bus.out / MQTT / Matrix` 外发链 | 3 | dev_0322-imported-slide-app-host-egress-test-app | Completed | ./docs/iterations/0322-imported-slide-app-host-egress-test-app/ |
| 0323-modeltable-rw-permission-spec | 2026-04-17 | 规约变更：model.table (0,0,0) 默认三程序基础设施、V1N API 读写权限收紧、跨模型通信强制走 pin（docs-only） | 2 | dev_0323-modeltable-rw-permission-spec | Completed | ./docs/iterations/0323-modeltable-rw-permission-spec/ |
| 0324-runtime-root-default-program-models | 2026-04-21 | runtime 在每个 model.table (0,0,0) seed 三程序（mt_write / mt_bus_receive / mt_bus_send）；Tier 2 source 为 default_table_programs.json；彻底删除 (0,1,0) helper scaffold（覆盖 0323 spec "model.single 保留" 条款） | 5 | dev_0324-runtime-root-default-program-models | Completed | ./docs/iterations/0324-runtime-root-default-program-models/ |
| 0325-ctx-api-tightening-static-selfcell | 2026-04-21 | ctx API 替换为 V1N 命名空间（addLabel / removeLabel / readLabel 单签名）；静态本 cell 守卫；跨模型读禁止；覆盖 0323 兼容期条款同 PR 迁移所有调用方无兼容层 | 5 | dev_0325-ctx-api-tightening-static-selfcell | Planned | ./docs/iterations/0325-ctx-api-tightening-static-selfcell/ |
| 0325b-legacy-system-models-ctx-migration | 2026-04-21 | 0325 延伸：迁移 system-models JSON 里 30+ 处 legacy ctx.* 到 V1N / mt_write 请求路径；合并 server.mjs ensureGenericOwnerMaterializer (M1)；与 0325 作为一组整体 merge 到 dev，保持"无兼容层" | 7 | dev_0325b-legacy-system-models-ctx-migration | Planned | ./docs/iterations/0325b-legacy-system-models-ctx-migration/ |

| 1219-orchestrator-monitor-resume-smoke-doc | 2026-03-20 | orchestrator-monitor-resume-smoke-doc |  | dropx/dev_1219-orchestrator-monitor-resume-smoke-doc | Cancelled | ./docs/iterations/1219-orchestrator-monitor-resume-smoke-doc/ |
| 1220-orchestrator-monitor-resume-smoke-doc | 2026-03-20 | orchestrator-monitor-resume-smoke-doc |  | dropx/dev_1220-orchestrator-monitor-resume-smoke-doc | Cancelled | ./docs/iterations/1220-orchestrator-monitor-resume-smoke-doc/ |
| 1221-orchestrator-smoke-doc-content-fill | 2026-03-21 | orchestrator-smoke-doc-content-fill |  | dropx/dev_1221-orchestrator-smoke-doc-content-fill | Completed | ./docs/iterations/1221-orchestrator-smoke-doc-content-fill/ |
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
