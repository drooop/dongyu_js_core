# 滑动 UI / Workspace 工作台 — 现状、共识与实施计划

> 更新时间：2026-02-05
> 状态：Phase 1 待实施

---

## 1. 项目背景

洞宇 APP 是一个"可运行/可安装能力模块与小应用"的小系统。多个远端 K8s Worker 可以提供 UI（如请假申请、设备报修），通过管理总线"滑动"到本地 APP。Workspace 工作台页面是这些滑动 UI 的入口。

---

## 2. 当前已完成的工作

### 2.1 Static Hosting ZIP Bug 修复（已上线）

| 文件 | 修复内容 |
|------|---------|
| `remote_store.js` (行 237-288) | 提取 `flushDraftsNow()`，非 `label_update` 动作发送前强制 flush pending drafts |
| `server.mjs` (行 980-987) | `static_upload_kind` / `static_zip_b64` / `static_html_b64` 改用 `addLabel` 强制重置 |
| `server.mjs` (行 1627-1653) | `/p/` 路由增加 Fallback：没有 `index.html` 时找根目录唯一的 `.html` 文件 |

### 2.2 Workspace 框架（已完成，部分需重构）

| 组件 | 文件 | 状态 |
|------|------|------|
| 路由 `/#/workspace` | `router.js` | ✅ |
| 导航栏 Workspace 按钮 | `demo_app.js` | ✅ |
| Server 端 workspace state labels | `server.mjs` | ✅ |
| Mock 模型 1001/1002（含 `ui_ast_v0`） | `server.mjs` | ⚠️ 需重构（去掉 `ui_ast_v0`，改用 p=0/p=1） |
| `ws_select_app` action 处理 | `server.mjs` + `local_bus_adapter.js` | ✅ |
| Workspace 页面 UI AST（左列表+右渲染） | `demo_modeltable.js` | ⚠️ 需重构（改为调用 `buildAstFromSchema()`） |

---

## 3. 渲染架构理解（关键共识）

### 3.1 Renderer 渲染的是 AST 组件树，不是原始单元格

```
AST 节点 { id, type, props, children, bind }
  → renderer.mjs 的 buildVueNode() 递归渲染
    → 每个节点按 type 映射到 Vue 组件（ElInput、ElButton 等）
    → bind.read 从 snapshot 中读取单元格值
    → bind.write 在用户交互时写回单元格
```

### 3.2 两层分离

| 层 | 含义 | 来源 |
|----|------|------|
| 布局层（AST） | 放什么组件、怎么排列、绑定哪个字段 | 需要某处定义 |
| 数据层（Labels） | 字段的实际值 | ModelTable 单元格 |

### 3.3 当前代码中的两种模式

**模式 1（主页面 home/docs/static/workspace）**：
- `buildEditorAstV1(snapshot)` 在 server/frontend 共用代码中生成 AST
- AST 存为 `ui_ast_v0` label → SSE 推送 → renderer 渲染

**模式 2（Model 100）**：
- `model100_ast.js` 在前端硬编码 250 行 AST
- 通过 `buildModel100Ast()` 返回，renderer 直接渲染
- Model 100 本身只有数据 labels（`input_value`, `bg_color`, `status` 等），没有 AST

### 3.4 滑动 UI 的目标模式

- 模型不携带 `ui_ast_v0`（这是动语 APP 侧的页面级 AST 规范标识）
- 模型用 **p=0 存数据值，p=1 存 UI 描述**，全部是 ModelTable 原生 cell 格式
- 前端有通用函数 `buildAstFromSchema(snapshot, modelId)` 从 p=1 自动生成 AST

---

## 4. 设计共识

### 4.1 UI 描述格式（p=1 schema）

UI 描述使用 ModelTable 原生 cell 结构，不另建解释体系：

```
p=0 (数据页)：
  (0,0,0) k:'bg_color',    t:'str',  v:'#FFFFFF'      ← 实际值
  (0,0,0) k:'input_value',  t:'str',  v:''             ← 实际值

p=1 (UI 描述页)：
  (1,0,0) k:'bg_color',      t:'str',  v:'ColorBox'    ← 组件类型
  (1,0,0) k:'input_value',   t:'str',  v:'Input'       ← 组件类型
  (1,0,0) k:'status',        t:'str',  v:'Text'        ← 只读文本

  额外配置用 sibling labels：
  (1,0,0) k:'leave_type__opts', t:'json', v:[{"label":"年假","value":"annual"}, ...]
  (1,0,0) k:'input_value__props', t:'json', v:{"placeholder":"请输入..."}
```

前端 `buildAstFromSchema()` 读 p=1 → 自动推导 bind.read/write refs → 生成完整 AST。

### 4.2 Model ID 分配策略

| 范围 | 用途 | 分配方式 |
|------|------|---------|
| 负数 (< 0) | 系统 model（editor_state, mailbox 等） | 固定硬编码 |
| 0 | 保留 | — |
| 1 ~ 999 | 用户创建的普通 model | 用户手动 |
| 1000 ~ 1999 | 系统内置滑动应用（`deletable=false`） | 固定硬编码 |
| 2000+ | 用户安装的滑动应用（`deletable=true`） | 自动递增（`ws_app_next_id`） |

### 4.3 Model 必备 Labels

| Cell | Label key | type | 说明 |
|------|-----------|------|------|
| (0,0,0) | `app_name` | str | 显示名 |
| (0,0,0) | `app_icon` | str | 图标标识（可为空） |
| (0,0,0) | `source_worker` | str | 来源 worker |
| (0,0,0) | `source_model_id` | int | 远端原始 model_id |
| (0,0,0) | `installed_at` | str | 安装时间 ISO8601 |
| (0,0,0) | `deletable` | bool | `true`=用户可删，`false`=系统内置 |

### 4.4 持久化

- **存储位置**：文件系统 `data/sliding_apps/{model_id}/`
  - `model.json` — 模型数据
  - `metadata.json` — app_name, author, version, source_worker 等
  - `assets/` — 静态文件（图片等）
- **ModelTable 只存 registry 索引**：`ws_apps_registry` label 在 editor_state 上
- **当前阶段**：本地文件夹 = 远端 OSS
- **重启恢复**：从文件夹扫描恢复，不重建
- **删除语义**：从 registry 移除 + 从 runtime 卸载；系统内置（`deletable=false`）拒绝删除

### 4.5 基座架构

| 层 | 位置 | 职责 |
|----|------|------|
| Renderer | 前端 | AST → Vue VNode + 事件采集（可开源） |
| Runtime（基座） | 后端 | ModelTable 运行、程序模型、流程模型、PIN（不开源） |
| Persistence | 后端 | SQLite（运行状态）+ 文件系统（滑动 app 数据） |

前端是"薄终端"，不含基座逻辑。所有数据变更走后端 runtime，前端只渲染 snapshot。

### 4.6 暂缓项

- **隔离与权限**：滑动 UI 只能写自己的 model；分用户隔离 — 等 APP 壳实现后再做
- **传输协议**：Matrix envelope 格式 — 做到时再讨论

---

## 5. 实施计划

### Phase 1：p=0/p=1 schema 机制 + 前端 buildAstFromSchema

| 步骤 | 内容 |
|------|------|
| 1.1 | 定义 p=1 UI 描述的 label 约定（组件类型 + 额外配置的 sibling label 命名） |
| 1.2 | 重构 mock 模型 1001/1002：去掉 `ui_ast_v0`，改为 p=0 数据 + p=1 UI 描述 |
| 1.3 | 前端新增 `buildAstFromSchema(snapshot, modelId)`：读 p=1 → 自动生成 AST |
| 1.4 | 重构 workspace 页面：右侧改为调用 `buildAstFromSchema()` |

### Phase 2：Model 100 接入 workspace

| 步骤 | 内容 |
|------|------|
| 2.1 | 给 Model 100 补 p=1 UI 描述 labels |
| 2.2 | 注册到 `ws_apps_registry`（系统内置，`deletable=false`） |
| 2.3 | 验证：workspace 选 Model 100 → 右侧自动渲染 color form |

### Phase 3：文件系统持久化 + 删除

| 步骤 | 内容 |
|------|------|
| 3.1 | 建立 `data/sliding_apps/{model_id}/` 目录结构 |
| 3.2 | Server 启动时从文件夹扫描恢复 registry |
| 3.3 | 实现 `ws_delete_app` action + `deletable` 检查 |
| 3.4 | Workspace 左侧列表增加删除按钮 |

---

## 6. 关键文件清单

| 文件 | 角色 |
|------|------|
| `packages/ui-model-demo-server/server.mjs` | UI Server：状态初始化、model 创建、action 处理、HTTP 路由 |
| `packages/ui-model-demo-frontend/src/demo_modeltable.js` | UI AST 构建器：根据 snapshot 生成各页面 UI 树 |
| `packages/ui-model-demo-frontend/src/demo_app.js` | App Shell：路由、导航栏、页面切换 |
| `packages/ui-model-demo-frontend/src/model100_ast.js` | Model 100 硬编码 AST（Phase 2 后可能重构） |
| `packages/ui-model-demo-frontend/src/router.js` | 路由定义 |
| `packages/ui-model-demo-frontend/src/remote_store.js` | Remote mode store：SSE、POST、draft coalescing |
| `packages/ui-model-demo-frontend/src/local_bus_adapter.js` | Action 白名单、local mode 处理 |
| `packages/ui-renderer/src/renderer.mjs` | 渲染器：AST → Vue VNode |
| `packages/worker-base/system-models/test_model_100_ui.json` | Model 100 数据定义（本地侧） |

---

## 7. 运行信息

- Server 端口：9000
- 启动命令：`cd packages/ui-model-demo-server && bun server.mjs`
- 前端构建：`cd packages/ui-model-demo-frontend && npm run build`
- Workspace URL：`http://127.0.0.1:9000/?mode=remote&server=http://127.0.0.1:9000#/workspace`
