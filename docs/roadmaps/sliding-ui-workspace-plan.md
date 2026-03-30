---
title: "Roadmap: Sliding UI Workspace"
doc_type: roadmap
status: active
updated: 2026-03-21
source: ai
---

# Roadmap: Sliding UI Workspace

> 目标：把 Workspace 从"静态 AST 页面"演进到"ModelTable UI schema 驱动"。
> 历史说明：roadmap 只表达产品/演进方向，不是当前模型 id 与模型标签语义的权威来源；如与 `CLAUDE.md` 或 `docs/ssot/**` 冲突，以上位规范为准。

## 1. 背景

- Workspace 是“可安装/可滑动应用”的入口。
- UI 必须保持 `ModelTable -> AST -> Renderer` 的投影模式。
- 现状已具备 workspace 页面框架，但部分区域仍依赖硬编码 AST。

## 2. 关键共识

- Renderer 渲染 AST，不直接渲染原始 Cell。
- UI 交互写 Cell；业务副作用仍由程序模型触发。
- 建议使用 `p=0` 存业务数据、`p=1` 存 UI schema，再由 `buildAstFromSchema` 生成 AST。

## 3. 数据与模型约束

### 3.1 Model ID 规划
- `<0`：软件工人系统级能力层
- `0`：根/中间层模型
- `>0`：用户创建模型

### 3.2 应用元数据（建议）
- `app_name`
- `app_icon`
- `source_worker`
- `source_model_id`
- `installed_at`
- `deletable`

## 4. 持久化策略

- 持久化根目录：`packages/ui-model-demo-server/data/sliding_apps/{model_id}/`
- 建议文件：
  - `model.json`
  - `metadata.json`
  - `assets/`
- `ws_apps_registry` 只保留索引，不存完整资产体。

## 5. 实施阶段

### Phase 1: Schema 驱动
- 引入 `p=1` UI schema 约定
- 增加 `buildAstFromSchema(snapshot, modelId)`
- 逐步替换硬编码 AST

### Phase 2: 内置应用接入
- 把 Model 100 等内置应用纳入 registry
- 验证 workspace 右侧渲染由 schema 驱动

### Phase 3: 文件系统恢复与删除
- 启动时扫描 `sliding_apps/` 恢复 registry
- 实现删除动作与 `deletable` 保护

## 6. 验收标准

- workspace 页面不依赖固定 mock AST 才能渲染
- 应用安装/重启恢复/删除均可脚本复现
- 不破坏“UI 只写格子”的架构边界
