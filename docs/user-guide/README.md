---
title: "User Guide Index"
doc_type: user-guide
status: active
updated: 2026-03-27
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
- `ui_components_v2.md`
  - 组件能力与 AST 用法。
- `design_system_v2.md`
  - 视觉 token 与样式规范。

## 归档说明

- 历史交接类文档已迁出/收敛；迭代事实以 `docs/iterations/*/runlog.md` 为准。
- 本目录不放测试数据和临时草稿。
