---
title: "0383 - UI Server Matrix Suite Slide App Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0383-ui-server-matrix-suite-slide-app
id: 0383-ui-server-matrix-suite-slide-app
phase: completed
---

# Iteration 0383-ui-server-matrix-suite-slide-app Resolution

## Execution Strategy

- 先冻结设计，再由 sub-agent 用 `codex-code-review` 审查；审查通过后才进入实现。
- 实现按“小阶段 -> sub-agent review -> 修正 -> 下一阶段”的顺序推进。
- 尽量使用现有 UI 组件组合完成现代聊天界面；只有确实缺少表达能力时才扩展通用 UI 组件或图标映射。
- 所有正式按钮动作使用 `bus_event_v2`，由 Model 0 `pin.bus.cb.in` 先路由到 Model 0 的 `Matrix Suite` hosting cell 引脚，再进入 `Matrix Suite` 根模型的 `matrix_suite_request` 引脚，最后由程序模型更新本模型表。

## Step 1

- Scope: 设计冻结与 review gate。
- Files: `docs/plans/2026-05-19-matrix-suite-slide-app-design.md`、0383 iteration docs、`docs/ITERATIONS.md`。
- Verification: sub-agent 使用 `codex-code-review` 审查设计和实施分解；runlog 记录 Approved / Change Requested。
- Acceptance: 设计明确 UI 信息架构、模型表分层、程序模型动作、Model 0 ingress、浏览器验收项和已知不做项。
- Rollback: 删除 0383 docs 与 index 记录。

## Step 2

- Scope: 模型表与 Workspace 入口实现。
- Files: `packages/worker-base/system-models/workspace_positive_models.json`、`runtime_hierarchy_mounts.json`、`workspace_manager_asset_manager_ui.json`（如需要）、`packages/ui-model-demo-frontend/src/model_ids.js`、相关构造脚本或测试 fixture。
- Verification: 新增 `scripts/tests/test_0383_matrix_suite_slide_app_contract.mjs`，检查模型 ID、Workspace 可见性、UI 粒度、Model 0 route 必须经 `model.submt` hosting cell、功能入口、禁止 direct frontend Matrix call。
- Acceptance: `Matrix Suite` 可被派生到 Workspace registry，且模型合同测试 PASS。
- Rollback: 回退新增模型记录、mount 与 allowlist。

## Step 3

- Scope: 程序模型动作与数据更新。
- Files: `workspace_positive_models.json` 中 `Matrix Suite` 的 `func.js`、pins、connections、state labels。
- Verification: 合同测试执行程序动作模拟，确认 send/edit/create/update/delete/call/media/settings 等动作更新目标 labels。
- Acceptance: 所有动作输入为临时 ModelTable record array，输出只写本模型表状态或显式 pin.out。
- Rollback: 回退 Step 3 新增/修改 labels。

## Step 4

- Scope: UI 体验细化与必要的通用 UI 扩展。
- Files: `packages/ui-renderer/src/component_registry_v1.json`、`renderer.mjs`/`renderer.js`（仅在需要通用能力时）、`workspace_positive_models.json`。
- Verification: `npm -C packages/ui-model-demo-frontend run build`、renderer 相关测试、0383 合同测试。
- Acceptance: 页面接近参考图的信息密度和布局；快速输入不因持久化推送产生明显回跳，composer draft 使用合适的 commit policy。
- Rollback: 回退 UI 扩展与对应模型 labels。

## Step 5

- Scope: 本地部署与真实浏览器验证。
- Files: local deployment/runtime state。
- Verification: 先重启/部署本地 UI Server，再用 Playwright 访问 `http://127.0.0.1:30900/#/workspace`；打开 `Matrix Suite` 并执行核心交互，包含 `FileInput` 小文件上传和 share file 成功显示，同时复验颜色生成器。
- Acceptance: 浏览器实测 PASS；截图/关键 DOM 或 `/snapshot` 证据写入 runlog，File sharing 必须有成功文件记录，不能只用失败提示通过验收。
- Rollback: 重新部署上一版 main。

## Step 6

- Scope: 最终 review 与收尾。
- Files: 0383 docs、所有实现文件。
- Verification: sub-agent final review + `git diff --check` + 关键测试集合。
- Acceptance: review Approved，无未处理 findings；runlog 标记 PASS，iteration 可进入 Completed。
- Rollback: 按前述步骤回退分支改动。

## Notes

- Generated at: 2026-05-19
- Browser verification is mandatory before reporting completion.
- Completed after local deployment, Playwright browser verification, and final review gate.
