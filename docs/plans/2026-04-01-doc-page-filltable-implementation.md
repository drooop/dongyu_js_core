---
title: "文档型页面填表能力 MVP 基础扩展 — 实施文档"
doc_type: note
status: active
updated: 2026-04-21
source: ai
iteration_id: 0275-doc-page-filltable-extension
---

# 文档型页面填表能力 MVP 基础扩展 — 实施文档

本文档基于设计文档 `2026-04-01-doc-page-filltable-design.md` 的推荐方案 C，定义 Phase A（MVP）的具体实施路径。

## 1. 实施范围

本 iteration（0275）覆盖 Phase A（MVP 基础能力）+ Static 已知阻塞修复。Phase B（Mermaid + inline markup）和 Phase C（完整正式示例）将在后续 iteration 中执行。

### 1.1 Phase A 交付物

| 交付物 | 文件位置 | 类型 |
|--------|---------|------|
| 组件注册扩展 | `packages/ui-renderer/src/component_registry_v1.json` 的 `components` 对象 | Tier 2（JSON 配置） |
| 新组件 renderer 代码 | `packages/ui-renderer/src/renderer.mjs`（在现有单文件中新增 vnode dispatch 分支） | Tier 1（renderer 代码） |
| Cellwise compiler 扩展 | `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js` | Tier 1（compiler） |
| Cellwise authoring 字段约定文档 | `docs/plans/2026-03-27-cellwise-ui-authoring-contract-v1.md`（追加章节） | 文档 |
| 最小示例 patch | `packages/worker-base/system-models/` 或 `deploy/sys-v1ns/` | Tier 2（JSON patch） |
| Static FileInput 修复 | `packages/ui-renderer/src/renderer.mjs` | Tier 1（bug fix） |
| Static 删除按钮 + 文件清理 | truth model action handler + server 路由 | Tier 1/2 |
| 用户指南草稿 | `docs/user-guide/doc_page_filltable_guide.md`（新建） | 文档 |

### 1.2 不在本 iteration 范围

- MermaidDiagram 真实渲染实现（mermaid.js 集成，Phase B；Phase A 仅注册 + 占位渲染）
- Inline markup 解析（Phase B）
- 完整正式示例 Model 1013/1014（Phase C）
- 云端部署（Phase C）

### 1.3 重要概念区分

本 iteration 新增的 `ui_heading_level`、`ui_callout_type` 等字段是 **label.k**（字段名/key），不是 **label.t**（标签类型）。它们使用现有 label.t（`str`、`int`），不需要修改 `label_type_registry.md`。需要更新的是 cellwise authoring contract 文档。

## 2. 实施步骤概览

### Step 0: Static Workspace 已知阻塞修复

**目标**：修复 0272 Static Workspace 的两个已知问题，为后续文档型页面能力验证扫除现实阻塞。

**子任务 0a — FileInput 点击无反应**

- 定位：`packages/ui-renderer/src/renderer.mjs` 中 FileInput vnode 的事件绑定
- 修复：确认 `change` 事件 → `upload_media` action 的触发链路是否正常
- 验证：本地部署后 Static 页面点击"上传"可弹出文件选择器

**子任务 0b — 已挂载项目缺少删除按钮 + 文件清理**

- 定位：Static truth model 的 action handler（如 Model 1012 的 func.js）
- 修复：新增 delete action → 清理 truth model label + 删除 `/p/<projectName>/...` 文件/目录
- 验证：删除后项目从列表消失，`/p/<projectName>/` 返回 404

### Step 1: 组件注册

**目标**：在 `component_registry_v1.json` 的 `components` 对象中新增 8 个组件条目。

**文件**：`packages/ui-renderer/src/component_registry_v1.json`

**具体变更**：在现有 `components` 对象内追加：

```json
"Heading": { "tree_kind": "Heading", "vnode_kind": "Heading" },
"Paragraph": { "tree_kind": "Paragraph", "vnode_kind": "Paragraph" },
"List": { "tree_kind": "List", "vnode_kind": "List" },
"ListItem": { "tree_kind": "ListItem", "vnode_kind": "ListItem" },
"Callout": { "tree_kind": "Callout", "vnode_kind": "Callout" },
"Image": { "tree_kind": "Image", "vnode_kind": "Image" },
"MermaidDiagram": { "tree_kind": "MermaidDiagram", "vnode_kind": "MermaidDiagram" },
"Section": { "tree_kind": "Section", "vnode_kind": "Section" }
```

**验证**：

```bash
node -e "const r=JSON.parse(require('fs').readFileSync('packages/ui-renderer/src/component_registry_v1.json','utf8')); const docs=['Heading','Paragraph','List','ListItem','Callout','Image','MermaidDiagram','Section']; docs.forEach(d=>{if(!r.components[d])throw new Error(d+' missing from components')}); console.log('PASS: all doc components registered in components object')"
```

### Step 2: 新组件 Renderer 实现

**目标**：在 `renderer.mjs` 单文件中新增 vnode dispatch 分支，处理 7 个新组件（MermaidDiagram Phase A 仅做占位）。

**文件**：`packages/ui-renderer/src/renderer.mjs`（单文件，无 components/ 子目录）

**设计约束**：

- Heading：根据 `props.level` 渲染 `h1`-`h4`，支持 `props.text`
- Paragraph：渲染 `<p>`，`\n` 转 `<br>`，支持 `props.text`
- List：根据 `props.listType` 渲染 `<ul>` 或 `<ol>`，children 为 ListItem
- ListItem：渲染 `<li>`，`props.text`
- Callout：根据 `props.calloutType` 渲染带边框色和背景色的 div + 可选 `props.title`
- Image：渲染 `<img>`，`props.src` + `props.alt`，max-width: 100%
- Section：Container 变体，带可选 `props.title` + `props.sectionNumber` badge
- MermaidDiagram：Phase A 仅渲染 `<pre class="mermaid-placeholder">{code}</pre>` 占位

**验证**：本地部署后手动确认各组件可渲染

### Step 3: Cellwise Compiler 扩展

**目标**：让 `ui_cellwise_projection.js` 识别新 label.k 并映射到 node props。

**文件**：`packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`

**映射规则**（label.k → props）：

```javascript
if (labels.ui_heading_level) node.props.level = parseInt(labels.ui_heading_level.v);
if (labels.ui_list_type) node.props.listType = labels.ui_list_type.v;
if (labels.ui_callout_type) node.props.calloutType = labels.ui_callout_type.v;
if (labels.ui_image_src) node.props.src = labels.ui_image_src.v;
if (labels.ui_image_alt) node.props.alt = labels.ui_image_alt.v;
if (labels.ui_mermaid_code) node.props.code = labels.ui_mermaid_code.v;
if (labels.ui_code_language) node.props.language = labels.ui_code_language.v;
if (labels.ui_section_number) node.props.sectionNumber = parseInt(labels.ui_section_number.v);
```

**验证**：

```bash
node scripts/tests/test_0275_cellwise_doc_components.mjs
```

### Step 4: 最小示例 Patch

**目标**：创建最小文档页面示例（Section + Heading + Paragraph + Callout + List），验证 cellwise 链路。

**文件**：`packages/worker-base/system-models/doc_page_minimal_example.json` 或 `deploy/sys-v1ns/`

**验证**：本地部署后页面可渲染，改 label → 页面更新

### Step 5: Cellwise Authoring Contract 文档更新

**目标**：在 cellwise authoring contract 文档中追加新 label.k 字段约定。

**文件**：
- `docs/plans/2026-03-27-cellwise-ui-authoring-contract-v1.md`（追加章节）
- `docs/user-guide/doc_page_filltable_guide.md`（新建草稿）

**不修改**：`docs/ssot/label_type_registry.md`（无新 label.t）

### Step 6: 回归测试

**测试矩阵**：
- 现有 unit tests：`node scripts/tests/test_runtime_*.mjs`
- 0270 合同测试：`node scripts/tests/test_0270_*.mjs`
- 0272 Static 合同测试：`node scripts/tests/test_0272_*.mjs`
- 新组件合同测试：`node scripts/tests/test_0275_cellwise_doc_components.mjs`
- 本地 smoke：部署后浏览器验证 Home / Workspace / 0270 示例 / Static 上传删除

## 3. 依赖关系

```
Step 0 (Static fixes) — 独立，可并行
Step 1 (注册) → Step 2 (renderer) → Step 3 (compiler) → Step 4 (示例)
                                                          ↘ Step 5 (docs)
Step 0 + Step 4 + Step 5 → Step 6 (回归)
```

## 4. 分支策略

- 分支：`dev_0275-doc-page-filltable-extension`
- 完成后 merge 到 `dev`

## 5. 回滚计划

每个 Step 独立可回滚：
- Step 0: revert Static 修复相关变更
- Step 1: 从 registry JSON 的 `components` 对象删除新条目
- Step 2: revert renderer.mjs 中新增的 vnode dispatch 分支
- Step 3: revert compiler 变更
- Step 4: 删除 patch 文件
- Step 5: revert 文档变更

最坏情况：整个分支不 merge，不影响 dev 主线。
