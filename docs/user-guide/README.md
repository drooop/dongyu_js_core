---
title: "User Guide Index"
doc_type: user-guide
status: active
updated: 2026-04-29
source: ai
---

# User Guide Index

本目录仅保留面向使用者和集成者的“现行有效文档”。

## 核心入口

- `modeltable_user_guide.md`
  - ModelTable、Mailbox、PIN/MGMT 的统一口径。
- `project_address_record.md`
  - 当前本地仓库路径、docs 落盘目录、本地访问入口、远端 deploy 主机/仓库路径/公开 URL 记录。
- `ui_event_matrix_mqtt_configuration.md`
  - UI 事件到 Matrix/MQTT 的配置步骤。
- `dual_worker_slide_e2e_v0.md`
  - 双工人链路的可执行 E2E 验收方法。
- `color_generator_e2e_runbook.md`
  - Model 100 颜色生成器双总线复现实操（含 patch-only 模式、Playwright 终验与排障）。
- `llm_cognition_ollama_runbook.md`
  - 0154 LLM 路由 + 0170 本地 Orbstack `mt-table` prompt filltable runbook。
- `prompt_filltable_owner_chain_and_deploy.md`
  - Prompt FillTable 的 owner-chain 正式口径与本地 / cloud deploy 导航入口。

## UI 文档

- `ui_binding_conversational.md`
  - UI “看似双向绑定”的运行机制解释。
- `ui_model_filltable_workspace_example.md`
  - 当前界面真实可做的正例：在 Home 里逐条填写 label，修改已挂载正数 UI model 的显示结果。
- `workspace_ui_filltable_example.md`
  - 0270 正式案例：通过填表创建并挂载 `Input + Button + Label` Workspace 条目，并在远端双总线 / 本地程序模型两种链路之间切换。
- `workspace_ui_filltable_example_visualized.md`
  - 当前可视化版本：已对齐到 `0276 Doc Page Workspace Example`，用图解方式展示文档页的模型关系、节点组成、布局 label 和重建顺序。
- `static_workspace_rebuild.md`
  - 0272 正式案例：通过 Workspace 中的 Static 页面上传单个 HTML 或 ZIP，并固定挂载到 `/p/<projectName>/...`。
- `doc_page_filltable_guide.md`
  - 0275 MVP：如何通过 `Model 1015` 的细粒度填表，做出最小可工作的文档型页面。
- `doc_workspace_filltable_example.md`
  - 0276 正式案例：一个挂到 Workspace 侧边栏的文档页面示例，证明结构、布局位置和主要内容都可以通过填表定义。
- `data_models_filltable_guide.md`
  - 0348 数据模型入口：说明 Feishu-aligned `Data.*` 目标合同、通用数据 pin、临时消息边界，以及当前部分 0296-era 模板仍待迁移的实现债务；0355 已完成 `Data.Single` + `Data.Array.One` 的无兼容切换。
- `matrix_userline_phase1.md`
  - 0283 最小 Matrix 用户产品线：说明 `1016-1019` 的分工、最小登录、单会话消息闭环，以及本地 Synapse 测试用户的注册与验证方式。
- `matrix_userline_phase2.md`
  - 0284 基础聊天界面：说明 `1016-1021` 的分工、房间切换、时间线、输入框、成员面板，以及当前房间的一发一收验证方式。
- `slide_app_zip_import_v1.md`
  - 0302 Slide app 导入：说明 zip 包格式、导入字段、安装/卸载规则，以及最短导入验证步骤。
- `slide_workspace_generalization.md`
  - 0289 Phase B：说明什么算 slide-capable app、Workspace 统一 registry 字段、默认选择与删除规则。
- `slide_app_filltable_create_v1.md`
  - 0290 Slide app 填表创建：说明 creator app 填哪些字段、创建后如何自动挂载，以及它与 0302 zip 导入共用的 payload 合同。
- `slide_ui_mainline_guide.md`
  - 0291 主文档：把 Slide UI 当前主线入口、Gallery 展示面、Workspace 入口和细分说明页收成统一导航。
- `slide_ui_evidence_runbook.md`
  - 0291 证据 runbook：定义本地和远端两条最小取证路径，以及 cloud deploy 后的验证步骤。
- `slide_matrix_delivery_v1.md`
  - 0309 正式版：说明 slide app 当前怎么经 Matrix media + importer pin-chain 交付、包结构和最短验证。
- `slide_delivery_and_runtime_overview_v1.md`
  - 0313 总览页：并排解释 slide app 的安装交付链和导入后运行链。
- `slide-app-runtime/`
  - 0350/0351/0352 开发者入口：包含滑动 APP 运行链路说明，以及给第三方提供方使用的最小 `Input + Submit + Display Label` 完整示例、可视化说明和交互式 HTML。
- `slide_python_install_client_v1.md`
  - 0316 Python 示例：给同事一个可直接运行的 slide app 安装客户端。
- `slide_upload_auth_and_cache_contract_v1.md`
  - 0312 正式合同：冻结上传鉴权模式、`/api/media/upload`、cache-priming 与 `media_not_cached` 边界。
- `slide_matrix_delivery_preview_v0.md`
  - 0304 历史预告：已被 `slide_matrix_delivery_v1.md` 取代，仅保留当时的冻结前背景。
- `ui_components_v2.md`
  - UI 模型填表开发者指南：说明 `cellwise.ui.v1` 怎么填表、label 含义、布局组合、数据绑定和事件触发。
- `design_system_v2.md`
  - 视觉 token 与样式规范。

## 归档说明

- 历史交接类文档已迁出/收敛；迭代事实以 `docs/iterations/*/runlog.md` 为准。
- 本目录不放测试数据和临时草稿。
