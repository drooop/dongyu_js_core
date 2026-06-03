---
title: "User Guide Index"
doc_type: user-guide
status: active
updated: 2026-05-12
source: ai
---

# User Guide Index

本目录面向使用者、集成者和文档读者。它解释“当前怎么用、怎么验证、遇到边界看哪里”，不覆盖 `CLAUDE.md`、`docs/ssot/**` 或 iteration runlog。

阅读规则：

- 需要 current truth 时，先读本索引标为 current 的 Markdown 指南，再回到对应 SSOT。
- 需要图解或交互阅读时，才打开 visualized / interactive HTML。
- `*_prompt.txt` 和 `diary/**` 是 archive，不作为当前操作指令。
- 如果用户指南和 SSOT 冲突，以 SSOT 为准，并把用户指南当作待修正对象。

## Current Core Guides

| File | Role | Notes |
|---|---|---|
| `modeltable_user_guide.md` | current living guide | ModelTable、Mailbox、PIN/MGMT、Web Tablet Desktop 的统一用户口径。 |
| `ai_prompt_and_artifact_guidance.md` | current collaboration guide | 0365 规约撰写方法：硬约束 / 判断规则 / 偏好建议，以及 HTML 使用边界。 |
| `project_address_record.md` | current address record | 本地仓库、远端 deploy、公开 URL 等仍被脚本/runlog 使用的地址。 |
| `data_models_filltable_guide.md` | current data model guide | Feishu-aligned `Data.*` 目标合同、通用 pin、临时消息边界与 0355 状态。 |
| `filltable_capability_matrix.md` | current capability matrix | Prompt FillTable 能力项、case 和 runner 入口。 |
| `prompt_filltable_owner_chain_and_deploy.md` | current runbook/guide | Prompt FillTable owner-chain 口径与本地/cloud deploy 导航。 |

## Current UI And Workspace Guides

| File | Role | Notes |
|---|---|---|
| `ui_binding_conversational.md` | current explanation | “看似双向绑定”的现状、边界和真实链路。 |
| `ui_components_v2.md` | current authoring guide | `cellwise.ui.v1` 填表、label、布局、绑定、事件触发。 |
| `ui_model_basic_filltable_guide.md` | current authoring guide | 基础 UI 模型手工填表指南，覆盖 layout、Button/Input/Text/Dialog/Tabs 与局部页面切换。 |
| `ui_event_matrix_mqtt_configuration.md` | current configuration guide | UI 事件经 Matrix/MQTT 到设备或模型 PIN 的配置。 |
| `ui_model_filltable_workspace_example.md` | current/example | Home 中逐条填写 label 并修改正数 UI model 显示结果。 |
| `workspace_ui_filltable_example.md` | current/example | 0270 Workspace UI 填表示例。 |
| `doc_page_filltable_guide.md` | current/example | 0275 文档型页面最小可工作填表路径。 |
| `doc_workspace_filltable_example.md` | current/example | 0276 Workspace 文档页面示例。 |
| `static_workspace_rebuild.md` | current runbook | Static 页面上传 HTML/ZIP 并挂载到 `/p/<projectName>/...`。 |
| `design_system_v2.md` | current design reference | 视觉 token 与样式规范；若与实现不同，应按当前 UI SSOT/实现复核。 |

## Current Slide App Guides

| File | Role | Notes |
|---|---|---|
| `slide-app-runtime/README.md` | current entrypoint | 滑动 APP 运行链路子目录入口。 |
| `slide-app-runtime/slide_app_runtime_developer_guide.md` | current developer guide | 当前滑动 APP 的开发、安装、运行和外发链路。 |
| `slide-app-runtime/workspace_manager_interaction_guide.md` | current provider guide | 如何上传滑动 APP ZIP、记录资源路径、发布 Workspace Manager 可安装索引，以及 topic 拼接规则。 |
| `slide-app-runtime/minimal_submit_app_provider_guide.md` | current provider guide | 最小 Submit 双总线示例、R1 填表、zip 导入、外部 Matrix/MQTT 测试。 |
| `slide-app-runtime/minimal_submit_app_provider_visualized.md` | visualized Markdown companion | 最小 Submit 示例的图解说明。 |
| `slide_app_zip_import_v1.md` | current slide guide | zip 包格式、导入字段、安装/卸载和最短验证。 |
| `slide_app_filltable_create_v1.md` | current slide guide | 通过填表创建 slide app 并自动挂载。 |
| `slide_executable_import_v1.md` | current slide guide | slide executable import 当前可用路径。 |
| `slide_delivery_and_runtime_overview_v1.md` | current overview | slide app 安装交付链和导入后运行链。 |
| `slide_matrix_delivery_v1.md` | current delivery guide | Matrix media + importer pin-chain 交付、包结构和验证。 |
| `slide_python_install_client_v1.md` | current install-client guide | Python 安装客户端示例。 |
| `slide_ui_mainline_guide.md` | current navigation guide | Slide UI 当前主线、Gallery、Workspace 和细分说明页。 |
| `slide_upload_auth_and_cache_contract_v1.md` | current contract guide | 上传鉴权、`/api/media/upload`、cache priming 和 `media_not_cached`。 |
| `slide_workspace_generalization.md` | status-bound guide/plan | slide-capable app 与 Workspace registry 说明；使用前按当前 SSOT 复核。 |

## Runbooks And Evidence Guides

| File | Role | Notes |
|---|---|---|
| `color_generator_e2e_runbook.md` | runbook | Model 100 颜色生成器双总线复现实操和 Playwright 终验。 |
| `llm_cognition_ollama_runbook.md` | runbook | LLM routing、本地 Orbstack `mt-table` prompt filltable 操作。 |
| `orchestrator_local_smoke.md` | runbook | Orchestrator 本地 smoke、failure kind 和 evidence surface。 |
| `slide_ui_evidence_runbook.md` | evidence runbook | 本地/远端 Slide UI 取证路径和 cloud deploy 后验证。 |
| `matrix_userline_phase1.md` | phase runbook | 0283 Matrix 用户线最小登录和单会话闭环。 |
| `matrix_userline_phase2.md` | phase runbook | 0284 基础聊天界面、房间切换、时间线、输入和成员面板。 |
| `matrix_chat_feature_matrix.md` | feature checklist | Matrix Chat 已实现功能、交互动作和验证清单。 |

## Visualized / Interactive HTML

HTML 只作为阅读或交互 companion。真实规则仍以 Markdown 指南和 SSOT 为准。

| File | Role | Notes |
|---|---|---|
| `ai_prompt_and_artifact_guidance.html` | visualized guide | 0365 AI 协作规约图解版。 |
| `workspace_ui_filltable_example_visualized.md` | visualized Markdown | Workspace 文档页面填表示例图解。 |
| `workspace_ui_filltable_example_visualized.html` | visualized HTML | Workspace 文档页面填表示例的可视化页面。 |
| `slide-app-runtime/slide_app_runtime_flow_visualized.html` | visualized HTML | Slide App Runtime 流程可视化页面。 |
| `slide-app-runtime/minimal_submit_app_provider_interactive.html` | interactive HTML | 最小 Submit 示例的交互式说明。 |

## Superseded Or Preview Material

| File | Role | Notes |
|---|---|---|
| `slide_matrix_delivery_preview_v0.md` | superseded preview | 已被 `slide_matrix_delivery_v1.md` 取代，仅保留冻结前背景。 |

## Prompt Archive

这些文件是历史 prompt，不是当前工作指令。

| File | Role |
|---|---|
| `claude_code_wave_launcher_0210_0217_prompt.txt` | historical prompt |
| `claude_code_wave_post_0232_prompt.txt` | historical prompt |
| `orchestrator_wave_0210_0217_prompt.txt` | historical prompt |
| `orchestrator_wave_0218_0221_prompt.txt` | historical prompt |
| `orchestrator_wave_post_0232_prompt.txt` | historical prompt |

## Diary / Archive

| File | Role |
|---|---|
| `diary/2026/2026-02-01_0122-0133_weekly/handoff_compact.md` | diary archive |
| `diary/2026/2026-02-01_0122-0133_weekly/weekly-report.md` | diary archive |
