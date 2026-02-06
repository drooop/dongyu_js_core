# Roadmap: Sliding UI Workspace

> 来源：原 `docs/handover/sliding_ui_workspace_plan.md` 的有效内容收敛。  
> 目标：把 Workspace 从“静态 AST 页面”演进到“ModelTable UI schema 驱动”。

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
- `<0`：系统模型
- `1~999`：普通用户模型
- `1000~1999`：系统内置应用
- `2000+`：用户安装应用（自动递增）

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
