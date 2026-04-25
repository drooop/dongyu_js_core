---
title: "Iteration 0275-doc-page-filltable-extension Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0275-doc-page-filltable-extension
id: 0275-doc-page-filltable-extension
phase: phase1
---

# Iteration 0275-doc-page-filltable-extension Resolution

## Step 0: Static Workspace 已知阻塞修复

### 0.1 Scope

修复 0272 Static Workspace 的两个已知问题：FileInput 点击无反应、已挂载项目缺少删除按钮。

### 0.2 子任务 0a — FileInput 点击无反应

- 定位：`packages/ui-renderer/src/renderer.mjs` 中 FileInput vnode 的事件绑定链路
- 诊断：确认 `change` 事件是否正确绑定到 native `<input type="file">`，`upload_media` action 是否触发
- 修复：根据诊断结果修复事件绑定或 action 触发链

### 0.3 子任务 0b — 已挂载项目删除按钮 + 文件清理

- 定位：Static truth model（Model 1012）的 action handler + server 路由
- 实现：
  1. 在 Static 页面 UI 中增加删除按钮（cellwise authoring 新增 Button node）
  2. 新增 delete action intent → handler 清理 truth model label + 调用 server API 删除 `/p/<projectName>/...`
  3. server 端需要文件删除路由（如已有则复用）

### 0.4 Files

- `packages/ui-renderer/src/renderer.mjs`（FileInput 修复）
- `packages/worker-base/system-models/` 或 `deploy/sys-v1ns/`（Static patch 追加删除按钮）
- Model -10 intent handler（新增 static_delete action）
- server 文件删除路由（如需新增）

### 0.5 Verification

```bash
# 本地部署后
bash scripts/ops/deploy_local.sh
# 浏览器验证：
# 1. Static 页面 → 点击上传按钮 → 文件选择器弹出
# 2. 上传文件后 MXC URL 写入 truth model
# 3. 已挂载项目出现删除按钮 → 点击删除 → 列表消失 + /p/<name>/ 返回 404
```

### 0.6 Acceptance

- FileInput 可触发文件选择器并完成上传
- 删除按钮可见，点击后项目被移除且文件被清理

### 0.7 Rollback

Revert 相关 patch 和 renderer 变更。

---

## Step 1: 组件注册

### 1.1 Scope

在 `component_registry_v1.json` 的 `components` 对象中新增 8 个文档语义组件。

### 1.2 新增组件

| tree_kind | vnode_kind | 说明 |
|-----------|-----------|------|
| Heading | Heading | 多级标题（h1-h4） |
| Paragraph | Paragraph | 段落文本（支持多行） |
| List | List | 有序/无序列表容器 |
| ListItem | ListItem | 列表项 |
| Callout | Callout | 提示/警告框 |
| Image | Image | 图片展示 |
| MermaidDiagram | MermaidDiagram | Mermaid 图表（Phase A 仅占位） |
| Section | Section | 文档段落容器 |

### 1.3 Files

- `packages/ui-renderer/src/component_registry_v1.json`

### 1.4 Verification

```bash
node -e "
const r = JSON.parse(require('fs').readFileSync('packages/ui-renderer/src/component_registry_v1.json', 'utf8'));
const docs = ['Heading','Paragraph','List','ListItem','Callout','Image','MermaidDiagram','Section'];
docs.forEach(d => { if (!r.components[d]) throw new Error(d + ' missing from r.components') });
console.log('PASS: all', docs.length, 'doc components registered in components object');
console.log('Total components:', Object.keys(r.components).length);
"
```

### 1.5 Acceptance

- 8 个新组件存在于 `r.components` 对象中
- 与现有 38 个组件无命名冲突
- 总数从 38 增至 46

### 1.6 Rollback

从 `components` 对象删除 8 个新条目。

---

## Step 2: 新组件 Renderer 实现

### 2.1 Scope

在 `renderer.mjs` 单文件中新增 vnode dispatch 分支，处理 7 个新组件 + MermaidDiagram 占位。当前 renderer 是单文件分发，无 components/ 子目录，所有新组件 render 函数直接写在 renderer.mjs 内。

### 2.2 组件设计

**Heading**
- props: `{ text: String, level: Number(1-4) }`
- 输出: `h(('h' + level), {}, text)` — 即动态 h1-h4 标签
- 样式: 按 level 递减字号，inherit color

**Paragraph**
- props: `{ text: String }`
- 输出: `h('p', ...)` — `\n` 转 `h('br')` 或拆分为多个 text node
- Phase B 追加 inline markup 解析

**List**
- props: `{ listType: 'ordered'|'unordered' }`
- 输出: `h(listType === 'ordered' ? 'ol' : 'ul', {}, children)`

**ListItem**
- props: `{ text: String }`
- 输出: `h('li', {}, text)`

**Callout**
- props: `{ text: String, calloutType: 'tip'|'info'|'warning'|'danger', title: String? }`
- 输出: 带 border-left + 背景色的 div
- 样式映射:
  - tip: `border-left: 4px solid #16a34a; background: #f0fdf4`
  - info: `border-left: 4px solid #2563eb; background: #eff6ff`
  - warning: `border-left: 4px solid #d97706; background: #fef3c7`
  - danger: `border-left: 4px solid #dc2626; background: #fef2f2`

**Image**
- props: `{ src: String, alt: String? }`
- 输出: `h('img', { src, alt, style: 'max-width:100%; height:auto' })`

**Section**
- props: `{ title: String?, sectionNumber: Number?, variant: String? }`
- 输出: `h('div', { class: 'doc-section' }, [titleBar?, ...children])`
- titleBar: 如有 title，渲染带可选编号 badge 的标题栏
- variant=hero: 渐变背景 + 白色文字

**MermaidDiagram (Phase A placeholder)**
- props: `{ code: String }`
- 输出: `h('pre', { class: 'mermaid-placeholder', style: 'background:#f1f5f9; padding:12px; border-radius:6px; overflow-x:auto' }, code)`
- Phase B 替换为 mermaid.js 实际渲染

### 2.3 Files

- `packages/ui-renderer/src/renderer.mjs`（在现有 vnode dispatch switch/if 链中新增分支）

### 2.4 Verification

```bash
# 本地部署后手动浏览器验证
bash scripts/ops/deploy_local.sh
# 访问包含新组件的页面，确认渲染正确
```

### 2.5 Acceptance

- 每个组件给定合法 props 可渲染对应 DOM
- Heading level=1 渲染 h1，level=4 渲染 h4
- Callout type=tip 渲染 green 边框
- Image src 渲染 img 标签
- Section 渲染带 padding/border 的容器
- MermaidDiagram 渲染 pre 占位

### 2.6 Rollback

从 renderer.mjs 删除新增的 vnode dispatch 分支。

---

## Step 3: Cellwise Compiler 扩展

### 3.1 Scope

修改 `ui_cellwise_projection.js`，使其识别新 label.k 并映射到 node props。这些 label.k 字段使用现有 label.t（str/int），不涉及新 label.t。

### 3.2 映射规则（label.k → props）

```javascript
// 在 buildNodeFromCell（或等效函数）中新增：
if (labels.ui_heading_level) node.props.level = parseInt(labels.ui_heading_level.v);
if (labels.ui_list_type) node.props.listType = labels.ui_list_type.v;
if (labels.ui_callout_type) node.props.calloutType = labels.ui_callout_type.v;
if (labels.ui_image_src) node.props.src = labels.ui_image_src.v;
if (labels.ui_image_alt) node.props.alt = labels.ui_image_alt.v;
if (labels.ui_mermaid_code) node.props.code = labels.ui_mermaid_code.v;
if (labels.ui_code_language) node.props.language = labels.ui_code_language.v;
if (labels.ui_section_number) node.props.sectionNumber = parseInt(labels.ui_section_number.v);
```

### 3.3 Files

- `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`

### 3.4 Verification

```bash
node scripts/tests/test_0275_cellwise_doc_components.mjs
# 测试内容：给定含新 label.k 的 model snapshot，验证 compiler 输出 AST 含正确 props
```

### 3.5 Acceptance

- 含 `ui_heading_level` (label.t=int, label.v=2) 的 cell → AST node `{ type: "Heading", props: { level: 2 } }`
- 含 `ui_callout_type` (label.t=str, label.v="warning") 的 cell → AST node `{ type: "Callout", props: { calloutType: "warning" } }`
- 不影响现有组件的 AST 输出

### 3.6 Rollback

Revert `ui_cellwise_projection.js` 中新增的 label.k → props 映射行。

---

## Step 4: 最小示例 Patch

### 4.1 Scope

创建最小文档页面示例 patch，包含：
- 1 个 Section 容器
- 1 个 Heading（level=2）
- 2 个 Paragraph
- 1 个 Callout（type=tip）
- 1 个 List + 3 个 ListItem

暂不创建完整 Workspace app host。可选择在现有 Model 1009 下增加 tab/page，或创建临时正数 model。

### 4.2 示例 Patch 结构

所有 label 均使用现有 label.t（str/int）：

```json
[
  { "model_id": "<TBD>", "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "UI.DocExample" },
  { "model_id": "<TBD>", "p": 0, "r": 0, "c": 0, "k": "ui_authoring_version", "t": "str", "v": "cellwise.ui.v1" },
  { "model_id": "<TBD>", "p": 0, "r": 0, "c": 0, "k": "ui_root_node_id", "t": "str", "v": "doc_example_root" },

  { "...": "doc_example_root: Container, layout=column" },
  { "...": "section_1: Section, ui_title='示例段落', ui_section_number=1" },
  { "...": "heading_1: Heading, ui_text='文档填表示例', ui_heading_level=2" },
  { "...": "para_1: Paragraph, ui_text='这是通过填写模型表构建出来的文档页面。\\n每个段落都是独立的模型 Cell。'" },
  { "...": "callout_1: Callout, ui_text='所有内容都可以通过改标签来修改。', ui_callout_type='tip', ui_title='提示'" },
  { "...": "list_1: List, ui_list_type='ordered'" },
  { "...": "item_1: ListItem, ui_text='步骤一：创建模型'" },
  { "...": "item_2: ListItem, ui_text='步骤二：填写标签'" },
  { "...": "item_3: ListItem, ui_text='步骤三：查看页面'" }
]
```

### 4.3 Files

- `packages/worker-base/system-models/doc_page_minimal_example.json` 或 `deploy/sys-v1ns/*/doc_page_minimal_example.json`

### 4.4 Verification

```bash
bash scripts/ops/deploy_local.sh
# 浏览器访问 → 确认渲染正确
# 改 heading text label → 标题更新
```

### 4.5 Acceptance

- 页面显示 Section 容器 + Heading + Paragraph + Callout + List
- 视觉合理（标题大字、段落正文、callout 有色框、列表有序号）

### 4.6 Rollback

删除 patch JSON 文件。

---

## Step 5: Cellwise Authoring Contract 文档更新

### 5.1 Scope

- 更新 cellwise authoring contract 文档：追加 8 个新 label.k 字段约定
- 新建用户指南草稿
- **不修改** `docs/ssot/label_type_registry.md`（无新 label.t）

### 5.2 新增 label.k 字段约定

| label.k | label.t（现有） | 值域 | 适用组件 | 说明 |
|---------|---------------|------|---------|------|
| `ui_heading_level` | `int` | 1-4 | Heading | 标题层级 |
| `ui_list_type` | `str` | ordered/unordered | List | 列表类型 |
| `ui_callout_type` | `str` | tip/info/warning/danger | Callout | 提示框变体 |
| `ui_image_src` | `str` | URL/MXC URI/相对路径 | Image | 图片来源 |
| `ui_image_alt` | `str` | 任意文本 | Image | 替代文本 |
| `ui_mermaid_code` | `str` | mermaid DSL | MermaidDiagram | 图表代码 |
| `ui_code_language` | `str` | json/js/python/... | CodeBlock | 语法高亮语言 |
| `ui_section_number` | `int` | 1-99 | Section | 编号（可选） |

### 5.3 Files

- `docs/plans/2026-03-27-cellwise-ui-authoring-contract-v1.md`（追加章节）
- `docs/user-guide/doc_page_filltable_guide.md`（新建草稿）

### 5.4 Verification

- 文档中 8 个字段约定存在且与 compiler 映射一致
- 用户指南可独立阅读

### 5.5 Acceptance

- authoring contract 文档追加章节完成
- 用户指南包含：组件清单、label.k 清单、最小示例填表步骤

### 5.6 Rollback

Revert 文档变更。

---

## Step 6: 回归测试

### 6.1 Scope

确认新增组件、compiler 变更和 Static 修复不影响现有功能。

### 6.2 测试矩阵

| 测试项 | 分类 | 命令 |
|--------|------|------|
| 现有 unit tests | unit | `node scripts/tests/test_runtime_*.mjs` |
| 0270 合同测试 | unit | `node scripts/tests/test_0270_*.mjs` |
| 0272 Static 合同测试 | unit | `node scripts/tests/test_0272_*.mjs` |
| 新组件合同测试 | unit | `node scripts/tests/test_0275_cellwise_doc_components.mjs` |
| Static 修复 smoke | e2e | 部署后浏览器验证上传 + 删除 |
| 本地页面 smoke | e2e | 部署后浏览器验证 Home / Workspace / 0270 / 新示例 |

### 6.3 Verification

```bash
# unit tests (无需 Docker)
node scripts/tests/test_runtime_*.mjs
node scripts/tests/test_0270_*.mjs
node scripts/tests/test_0272_*.mjs
node scripts/tests/test_0275_cellwise_doc_components.mjs

# e2e (需要 Docker + K8s)
bash scripts/ops/ensure_runtime_baseline.sh
bash scripts/ops/deploy_local.sh
# 手动浏览器验证
```

### 6.4 Acceptance

- 所有现有 unit tests PASS
- 所有现有 e2e 页面无回归
- Static 上传 + 删除工作
- 新组件测试 PASS

### 6.5 Rollback

如回归失败，revert 整个分支。

---

## Conformance Review

| 维度 | 评估 |
|------|------|
| Tier 1 / Tier 2 边界 | 组件注册 JSON = Tier 2；renderer.mjs 代码 + compiler = Tier 1。边界清晰。 |
| label.t vs label.k | 本轮新增的均为 label.k（字段名），使用现有 label.t（str/int）。不修改 label_type_registry.md。 |
| 负数 / 正数模型放置 | 示例 patch 使用正数 model（用户模型空间），符合规约。 |
| 数据所有权 | 文档内容 label 归 truth model 所有，UI 节点归 host model。 |
| 数据流向 | read binding（truth → host → render），文档组件为只读，无反向写入。 |
| 数据链路 | cellwise compiler → renderer，无跳层。 |
| 模型 ID 冲突 | 正式示例 Model ID 分配为 1013/1014（避开 1011/1012 已被 0272 Static 占用）。 |
