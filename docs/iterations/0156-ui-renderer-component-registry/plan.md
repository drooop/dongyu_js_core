---
title: "0156 — UI Renderer 组件约定表先行（Registry-First）"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0156-ui-renderer-component-registry
id: 0156-ui-renderer-component-registry
phase: phase1
---

# 0156 — UI Renderer 组件约定表先行（Registry-First）

## 0. Metadata

- ID: `0156-ui-renderer-component-registry`
- Date: 2026-03-03
- Branch: `dev_0156-ui-renderer-component-registry`
- Related:
  - `CLAUDE.md`（HARD_RULES / CAPABILITY_TIERS / fill-table-first）
  - `docs/WORKFLOW.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `packages/ui-renderer/AGENTS.md`

## 1. Goal

将 `ui-renderer` 从“组件行为硬编码仓库”重构为“原语解释器 + 组件约定表”，实现：

1. 新增组件类型时默认只改约定表，不改 renderer 主干。
2. 去除 `directUpload` 与 `window.__dyPendingFiles` 旁路。
3. FileInput 默认走 `upload_media`，结果写 `mxc://`。
4. `node.type` 权威来源切换为 registry（含结构节点）。

## 2. Scope

### 2.1 In Scope

1. `packages/ui-renderer` 引入 `component_registry_v1`（JSON）与 registry-first 渲染调度。
2. Renderer 新增行为原语：`upload_media`（host 执行）。
3. `scripts/validate_ui_ast_v0x.mjs` 改为按 registry 动态校验 node.type。
4. static upload 链路改为 `mxc://`：
   - 前端 FileInput 上传得到 `mxc://`
   - intent handler 从 `mxc://` 拉取并落地 static 项目
5. 删除 `POST /api/static/upload` 直传 API。
6. 使用“当前登录用户”Matrix 身份上传媒体（token 仅内存会话）。

### 2.2 Out of Scope

1. 新增 WebRTC/stream 等新原语。
2. Matrix token 持久化到磁盘。
3. 保留 legacy directUpload 回退路径。

## 3. Invariants / Constraints

1. UI 仍是 ModelTable 投影；业务真值不在 UI。
2. UI 事件仍通过 mailbox 合同进系统（`model_id=-1 cell(0,0,1)`）。
3. Renderer 不直接写业务副作用网络逻辑；上传动作由 host 提供能力。
4. CJS/ESM renderer 行为保持一致。

## 4. Success Criteria

1. `renderer.mjs/.js` 不再出现 `directUpload` 与 `__dyPendingFiles`。
2. AST validator 不再硬编码 `NODE_TYPES` 白名单。
3. static 页面上传流程可用：选文件 -> 得到 `mxc://` -> `static_project_upload` 成功。
4. `/api/static/upload` 路由已删除，替换为媒体上传能力。
5. 回归验证脚本通过（含新增 registry/upload 场景）。

## 5. Risks

1. 一次切换影响面大。
   - 缓解：先补失败用例，逐步替换并持续回归。
2. Matrix token 会话模型变更。
   - 缓解：仅内存保留，不经 `/auth/me` 返回，不落盘。
3. static 上传链路从 base64 切 mxc，可能出现下载权限问题。
   - 缓解：基于当前 UI 会话 token 下载，失败写 `ui_event_error` 与 `static_status`。
