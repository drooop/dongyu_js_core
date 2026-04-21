---
title: "文档型页面填表能力扩展 — 设计文档"
doc_type: note
status: active
updated: 2026-04-21
source: ai
iteration_id: 0275-doc-page-filltable-extension
---

# 文档型页面填表能力扩展 — 设计文档

## 1. 现状总结

### 1.1 已具备的填表成 UI 能力

经 0253-0257 hard-cut 系列冻结，当前 repo 的 UI 体系已完成从旧 `page_asset_v0` 到 `cellwise.ui.v1` 的切换。现有能力：

**cellwise authoring 合同（0253 冻结）**
- `ui_authoring_version = "cellwise.ui.v1"` 作为唯一 UI 来源标志
- 每个 UI 节点占一个 Cell，通过 `ui_node_id` + `ui_component` + `ui_parent` + `ui_order` 构建树
- 布局由 `ui_layout`（row/column/grid）+ `ui_gap` + `ui_wrap` 控制
- 文本由 `ui_text` / `ui_title` / `ui_label` / `ui_placeholder` 表达
- 视觉变体由 `ui_variant` 控制
- 任意 props 可通过 `ui_props_json` 注入

**cellwise compiler（0254 实现）**
- `ui_cellwise_projection.js` 扫描模型所有 cell，收集 `ui_node_id` + `ui_component`，构建树输出 AST
- 支持 read binding（`ui_read_model_id/p/r/c/k` → 跨模型读取）
- 支持 write routing（`ui_write_action` + `ui_write_mode` → pin/owner-materialization）

**组件注册表（0156 + 后续扩展，38 个组件）**
- 容器类：Root, Container, Card, Box, Form, FormItem
- 文本类：Text, CodeBlock, Html, Divider
- 输入类：Input, NumberInput, Select, Switch, Checkbox, Slider, FileInput, DatePicker, TimePicker, RadioGroup, Radio
- 数据展示：Table, TableColumn, Tree, Pagination, ProgressBar, StatusBadge, StatCard
- 导航交互：Tabs, TabPane, Dialog, Drawer, Button, Link, Breadcrumb
- 特殊：Include, ThreeScene, Terminal, ColorBox, Icon

**Workspace app 模式（0270/0272 验证）**
- host model（app 展示层）+ truth model（业务 truth）双模型架构
- Workspace 侧边栏挂载 + Open 打开
- 远端双总线 / 本地程序模型两种链路可通过改表切换

**写入与权限（0244-0249, 0255, 0266）**
- business write 一律 pin/owner-materialization
- scoped patch authority：运行态只允许当前模型 helper 执行 scoped patch
- cross-model pin owner materialization 已打通

### 1.2 能力不足：文档型页面无法靠细粒度填表搭建

参考文件 `workspace_ui_filltable_example_visualized.html` 包含以下文档元素，当前 cellwise 体系尚不能自然表达：

| 文档元素 | 当前状态 | 缺口 |
|---------|---------|------|
| 多级标题（h1-h3） | Text 组件无 heading level 语义 | 需要 heading level 支持 |
| 段落文本 | Text 可显示单行，但无段落语义和多段支持 | 需要 paragraph / prose 模式 |
| 有序/无序列表 | 无专门列表组件 | 需要 List / ListItem |
| 代码块（含语法高亮） | CodeBlock 存在但未经文档场景验证 | 需确认 language prop、多行文本填表 |
| 提示/警告框（callout） | 无专门组件 | 需要 Callout / Alert |
| 内嵌图表（Mermaid） | 无 Mermaid 渲染组件 | 需要 MermaidDiagram |
| 数据表格 | Table 存在但面向结构化数据 | 文档表格需简化填表方式 |
| Hero/Banner | 无专门组件 | 可用 Container + 样式 label 组合 |
| 编号徽章 | 无 | 可用 Icon/Text + 样式组合 |
| 分隔线 | Divider 存在 | 已具备 |
| 内联代码 / 加粗 / 斜体 | 纯文本，无 inline rich text | 需要有限 inline markup |
| 锚点导航 / TOC | 无 | 需要 anchor + TOC 组件 |
| 图片嵌入 | FileInput 可上传，但无 Image 展示组件 | 需要 Image 组件 |

### 1.3 核心矛盾

文档型页面的本质是「大量文本块 + 结构化排版」。当前 cellwise 体系设计假设是「每个 UI 节点对应一个交互控件」，对于文档型页面会面临两个现实问题：

1. **Cell 数量爆炸**：一篇 10 节的文档如果每个段落、每个列表项都占一个 Cell，可能需要 50-100+ 个 Cell。
2. **多行文本填表困难**：当前 label value 是单值字符串，对于多段 markdown 或多行代码块，用 `ui_text` 一个字段装不下或不易编辑。

这两个问题决定了设计方案必须在"细粒度"和"实用性"之间取得平衡。

---

## 2. 六个设计问题的回答

### Q1: 现在 repo 已经具备哪些"通过填表形成 UI"的能力？

见 §1.1。总结：cellwise authoring 合同 + compiler + 38 组件注册表 + read/write binding + Workspace 双模型架构 + scoped patch authority。当前已能通过填表搭建交互型页面（如 0270 Fill-Table 示例的 Input + Button + Label）。

### Q2: 还有哪些能力不足？

见 §1.2 差距表。核心不足：
- 缺少文档语义组件（Heading, Paragraph, List, Callout, Image, MermaidDiagram）
- 缺少 inline rich text 能力（bold/italic/inline code 无法在 ui_text 内表达）
- 多行/多段文本的填表体验未设计（label value 目前是单值字符串）
- 无 TOC/anchor 导航机制

### Q3: 这次扩展应该优先补哪些 UI 能力？

按文档页面的最低可用集排序：

**P0 — 必须有（MVP）**
1. Heading 组件（level 1-4）
2. Paragraph 组件（支持多行纯文本）
3. List / ListItem 组件（有序/无序）
4. Callout / Alert 组件（tip / info / warning / danger）
5. Image 组件（src 来自 label 或 MXC URL）
6. Section 容器（带可选 title + 编号 badge）

**P1 — 应该有（完整体验）**
7. MermaidDiagram 组件（value = mermaid DSL 字符串）
8. CodeBlock 文档场景验证 + language prop
9. 有限 inline markup（在 ui_text 中支持 `**bold**` / `*italic*` / `` `code` ``）
10. Anchor / TOC 自动生成

**P2 — 锦上添花**
11. Hero / Banner 容器变体
12. 编号 Badge 组件
13. 文档表格简化填表

### Q4: 这些能力应该放在什么层次？

| 层次 | 变更内容 | Tier |
|------|---------|------|
| **组件注册表** | 新增 Heading, Paragraph, List, ListItem, Callout, Image, MermaidDiagram, Section, Anchor, TOC, Badge | Tier 2（注册表是 JSON 配置） |
| **renderer 能力** | 为新组件实现 Vue render 函数；Mermaid 需引入 mermaid.js 依赖 | Tier 1（renderer 代码变更） |
| **cellwise authoring 字段约定** | 新增 `ui_heading_level` 等 UI authoring 字段（label.k）；这些字段的 label.t 使用现有常规类型（str/int），不需要新增 label.t。需更新 cellwise authoring contract 文档 | Tier 2（字段约定，不涉及 label_type_registry.md） |
| **cellwise compiler** | 识别新 label → 转换为 props（如 `ui_heading_level` → `props.level`） | Tier 1（compiler 代码变更） |
| **layout / style** | 无新机制；Section 用现有 Container + `ui_variant` 表达 | 不变 |
| **inline rich text** | 在 renderer Text/Paragraph 组件中解析有限 markdown subset | Tier 1（renderer 变更） |
| **绑定能力** | 不变；文档组件以 read-only 为主 | 不变 |

### Q5: 哪些地方必须坚持细粒度填表？哪些可以接受有限聚合？

**必须细粒度（一个 Cell = 一个语义单元）**
- 每个 Section 一个 Cell
- 每个 Heading 一个 Cell
- 每个 Callout 一个 Cell
- 每个 Image 一个 Cell
- 每个 MermaidDiagram 一个 Cell
- 树结构声明（parent/order）

**可以接受有限聚合**
- `ui_text` 允许包含多行文本（换行符保留）
- `ui_text` 允许有限 inline markup（`**bold**` / `*italic*` / `` `code` ``）
- `ui_mermaid_code` 允许包含完整 mermaid DSL 字符串（这是不可拆分的原子单元）
- CodeBlock 的 `ui_text` 允许多行代码
- List 组件内的 ListItem 可以用 `ui_text` 存放单项文本，但每个 item 仍然是独立 Cell

**明确禁止**
- 不允许整页 markdown 字符串塞进一个 label（退回旧路线）
- 不允许 HTML 字符串直接注入（安全性 + 违反 cellwise 原则）
- 不允许大块 JSON AST 作为 label value

### Q6: 最终怎样设计一个正式示例？

建议创建一个新的 Workspace app：`Doc Page Fill-Table Example`

**模型结构（遵循 host + truth 双模型架构）**

- Model 1013 — Doc Page app host
  - `app_name = "Doc Page Fill-Table Example"`
  - `ui_authoring_version = "cellwise.ui.v1"`
  - 页面骨架 UI 节点
  - 挂载 child truth model

- Model 1014 — Doc Page truth model
  - 文档内容 label（标题文本、段落文本、列表项文本、代码、mermaid DSL）
  - 文档结构参数（heading level、callout type、list type、image src）
  - 样式参数（section 背景色、字体大小等）

**页面结构（约 30-40 个 Cell）**

```
Root Container
├── Hero Section (Container, variant=hero)
│   ├── Heading (level=1, text="文档标题")
│   └── Paragraph (text="副标题描述")
├── Section 1 (Container, variant=section)
│   ├── Heading (level=2, text="第一节")
│   ├── Paragraph (text="说明文字...")
│   ├── Callout (type=tip, text="提示内容")
│   └── MermaidDiagram (code="graph TD...")
├── Section 2
│   ├── Heading (level=2)
│   ├── List (type=ordered)
│   │   ├── ListItem (text="步骤一")
│   │   ├── ListItem (text="步骤二")
│   │   └── ListItem (text="步骤三")
│   └── CodeBlock (language=json, text="{ ... }")
└── Section 3
    ├── Heading (level=2)
    ├── Image (src=mxc://... or /p/.../image.png)
    └── Paragraph (text="图片说明")
```

**验证点**
1. Workspace 侧边栏出现新条目
2. 打开后渲染出完整文档页面
3. 改 truth model 的文本 label → 页面文字立即更新
4. 改 heading level → 标题层级变化
5. 改 callout type → 提示框颜色/图标变化
6. 改 mermaid code → 图表重新渲染
7. 删除后按文档重建可恢复

---

## 3. 可选方案

### 方案 A：最小组件扩展（推荐）

**思路**：在现有 cellwise authoring 框架内，只新增最少量的文档语义组件，不改变 cellwise 核心机制。

**变更清单**
- 组件注册表：+8 组件（Heading, Paragraph, List, ListItem, Callout, Image, MermaidDiagram, Section）
- cellwise authoring 字段约定：+5 UI authoring 字段（`ui_heading_level`, `ui_list_type`, `ui_callout_type`, `ui_image_src`, `ui_mermaid_code`），均使用现有 label.t（str/int）
- renderer：为 8 个新组件实现 Vue render 函数
- cellwise compiler：识别新 label → props 映射
- inline markup：在 Text/Paragraph renderer 中支持有限 markdown subset

**优点**
- 变更面最小，不影响现有页面
- 完全遵循 cellwise 一 Cell 一节点 原则
- 新组件与现有组件平行，无架构侵入

**缺点**
- 大型文档 Cell 数较多（30-50 个）
- inline rich text 解析引入新的 renderer 复杂度

**Tier 影响**：Tier 1 变更约 2 处（renderer + compiler），Tier 2 变更为组件注册 JSON + 示例 patch + authoring 字段约定文档

**风险**：低。组件间无耦合，可逐个验证。

---

### 方案 B：Markdown Block 聚合组件

**思路**：新增一个 `MarkdownBlock` 组件，其 `ui_text` 接受一段完整 markdown（含标题、列表、代码块），renderer 内部用 markdown parser 转为 HTML。

**变更清单**
- 组件注册表：+1 组件（MarkdownBlock）
- renderer：引入 markdown parser（如 marked.js）
- label 无新增（复用 `ui_text`）

**优点**
- Cell 数最少，一个 Section 可以只用一个 MarkdownBlock
- 用户填表时更接近"写文档"的体验

**缺点**
- 违反 cellwise 一 Cell 一节点原则——一个 Cell 内嵌了整棵子树
- markdown 解析引入 XSS 风险（需要 sanitizer）
- 内部结构不可按 label 单独控制（改标题层级需要改 markdown 文本）
- 与现有 read binding 机制不兼容（binding 粒度是 label，不是 markdown 内部节点）
- 退向"大块文本塞进一个 label"的旧路线

**Tier 影响**：Tier 1 变更 2 处（renderer + markdown parser 依赖），Tier 2 无
**风险**：中高。与 cellwise 哲学冲突，长期维护成本高。

---

### 方案 C：混合模式（细粒度结构 + 局部聚合内容）

**思路**：结构层（Section, Heading, List）保持细粒度 Cell，但内容层允许 Paragraph 和 CodeBlock 的 `ui_text` 包含有限 markdown subset（仅 inline markup + 换行）。同时为 Mermaid 提供专门组件。

**变更清单**
- 与方案 A 相同的组件集
- `ui_text` 允许多行文本和有限 inline markup
- 不引入独立 markdown parser，仅在 renderer 中做 regex 替换

**优点**
- 在方案 A 基础上放宽 `ui_text` 的表达力，减少因 inline formatting 导致的额外 Cell
- 结构语义仍然细粒度可控
- 不需要完整 markdown parser

**缺点**
- inline markup 解析边界需要明确冻结（避免滑坡到完整 markdown）
- regex 替换可能有边界 case

**Tier 影响**：与方案 A 相同
**风险**：低-中。需要冻结 inline markup subset 规约。

---

## 4. 推荐方案

**推荐方案 C（混合模式）**。

理由：
1. 保持结构层细粒度，不违反 cellwise 核心原则
2. 允许 `ui_text` 包含有限 inline markup，避免纯文本中需要加粗/代码时必须拆 Cell 的不现实性
3. 不引入重量级 markdown parser 依赖
4. 与现有 read binding / write routing 完全兼容
5. 可分步交付：先交付纯文本版组件（P0），再补 inline markup（P1），再补 Mermaid（P1）

### 4.1 推荐的 Inline Markup Subset

冻结以下 subset，不允许扩展：

| 语法 | 输出 | 说明 |
|------|------|------|
| `**text**` | **bold** | 加粗 |
| `*text*` | *italic* | 斜体 |
| `` `code` `` | `code` | 内联代码 |
| `\n` | 换行 | 段落内换行 |

不支持：链接、图片、标题、列表、表格等块级 markdown。这些必须用独立 Cell + 组件表达。

### 4.2 新增 UI Authoring 字段约定（label.k）

以下字段使用现有 label.t（`str` / `int`），不需要在 `label_type_registry.md` 中注册新 label.t。它们是 cellwise authoring contract 的扩展字段，需更新 cellwise authoring contract 文档。

| label.k（字段名） | label.t（使用现有类型） | 值域 | 说明 |
|-----------|------|------|------|
| `ui_heading_level` | `int` | 1-4 | Heading 组件的层级 |
| `ui_list_type` | `str` | `ordered` / `unordered` | List 组件的类型 |
| `ui_callout_type` | `str` | `tip` / `info` / `warning` / `danger` | Callout 框类型 |
| `ui_image_src` | `str` | URL / MXC URI / 相对路径 | Image 组件来源 |
| `ui_image_alt` | `str` | 任意文本 | Image 替代文本 |
| `ui_mermaid_code` | `str` | mermaid DSL | MermaidDiagram 组件代码 |
| `ui_code_language` | `str` | json / js / python / ... | CodeBlock 语法高亮语言 |
| `ui_section_number` | `int` | 1-99 | Section 编号（可选） |

**重要区分**：`label_type_registry.md` 是 `label.t`（如 `str`, `int`, `pin.in`, `func.js`）的权威注册表。上述字段是 `label.k`（字段名/key），不属于 label.t 注册范围。

### 4.3 新增组件清单

| 组件 | tree_kind | 必要 label | 可选 label |
|------|-----------|-----------|-----------|
| Heading | heading | ui_text, ui_heading_level | ui_props_json |
| Paragraph | paragraph | ui_text | ui_props_json |
| List | list | ui_list_type | ui_gap |
| ListItem | list_item | ui_text | ui_order |
| Callout | callout | ui_text, ui_callout_type | ui_title |
| Image | image | ui_image_src | ui_image_alt, ui_props_json |
| MermaidDiagram | mermaid_diagram | ui_mermaid_code | ui_props_json |
| Section | section | — | ui_title, ui_section_number, ui_variant |

### 4.4 实施分期

**Phase A（MVP，1 个 iteration）**
- 注册 8 个新组件到 component_registry_v1.json
- 更新 cellwise authoring contract 文档（新增 8 个 label.k 字段约定，使用现有 label.t）
- 实现 7 个完整 Vue render 函数 + MermaidDiagram 占位渲染 — 在 renderer.mjs 单文件内新增（mermaid.js 真实渲染留 Phase B）
- cellwise compiler 识别新 label.k → props 映射
- 修复 Static Workspace 已知阻塞（FileInput 点击无反应 + 缺少删除按钮）
- 创建最小示例模型（1 个 Section + 1 个 Heading + 1 个 Paragraph）
- 本地部署验证

**Phase B（Mermaid + Inline Markup，1 个 iteration）**
- MermaidDiagram renderer（引入 mermaid.js CDN 或 bundled）
- Paragraph/Text 的 inline markup 解析
- 扩展示例模型到完整文档页面
- 冻结 inline markup subset 规约

**Phase C（正式示例 + 文档，1 个 iteration）**
- 创建 Model 1013/1014 正式 Workspace app
- 编写用户教程（类似 0270 的用户指南）
- 云端部署验证
- 编写重建教程

---

## 5. 正式示例建议结构

### 5.1 模型分配

| Model ID | 用途 | Cell 数（估算） |
|----------|------|--------------|
| 1013 | Doc Page app host（UI 结构） | 30-40 |
| 1014 | Doc Page truth model（内容数据 + 样式参数） | 10-15 |

### 5.2 Model 1014 Truth Model 根格 Label

```
model_type = model.table
doc_title = "Workspace UI 填表示例 — 可视化指南"
doc_subtitle = "通过填写模型表，逐步搭建出文档界面"
section_1_title = "总览"
section_1_text = "这个案例最终会得到什么界面..."
section_2_title = "模型关系"
callout_1_text = "默认状态是远端模式..."
mermaid_1_code = "graph TD\n  A[Model 0] --> B[Model 1009]\n  ..."
code_1_text = "{ \"from\": \"(self, confirm)\", ... }"
code_1_language = "json"
hero_bg_color = "#1e3a5f"
section_bg_color = "#ffffff"
heading_font_size = "20px"
```

### 5.3 Model 1013 App Host UI 节点（示意）

```
(0,0,0) — root: ui_authoring_version=cellwise.ui.v1, ui_root_node_id=doc_root
(0,1,0) — doc_root: Container, layout=column
(0,2,0) — hero: Section, variant=hero
  (0,2,1) — hero_heading: Heading, level=1, read -> 1014/doc_title
  (0,2,2) — hero_subtitle: Paragraph, read -> 1014/doc_subtitle
(0,3,0) — section_1: Section, section_number=1
  (0,3,1) — section_1_heading: Heading, level=2, read -> 1014/section_1_title
  (0,3,2) — section_1_text: Paragraph, read -> 1014/section_1_text
  (0,3,3) — section_1_diagram: MermaidDiagram, read -> 1014/mermaid_1_code
(0,4,0) — section_2: Section, section_number=2
  ...
(0,5,0) — callout_1: Callout, type=tip, read -> 1014/callout_1_text
...
```

### 5.4 Workspace 挂载

```
Model 0 -> Model 1013 (via model.submt)
Model 1013 (x,y,z) -> Model 1014 (via model.submt)
Model -2 / ws_apps_registry: 新增 doc_page_example 条目
```

---

## 6. 验收方式

### 6.1 Phase A 验收

1. 8 个新组件出现在 component_registry_v1.json（`components` 对象下）
2. 8 个新 UI authoring 字段约定记录在 cellwise authoring contract 文档中
3. 最小示例（Section + Heading + Paragraph）通过 cellwise compiler → renderer 渲染
4. 本地 Workspace 中可见并可打开
5. 改 truth model 的 `doc_title` label → 页面标题立即更新

### 6.2 Phase B 验收

1. MermaidDiagram 组件渲染 mermaid DSL
2. Paragraph 中 `**bold**` / `*italic*` / `` `code` `` 正确渲染
3. inline markup subset 规约文档冻结

### 6.3 Phase C 验收

1. 完整文档页面由 30-40 个 Cell 组成，Workspace 中可见
2. 与 `visualized.html` 视觉效果近似
3. 删除后按教程重建可恢复
4. 云端部署验证通过

---

## 7. 风险与回滚

| 风险 | 影响 | 缓解 |
|------|------|------|
| 新组件与现有 renderer 冲突 | 中 | 新组件独立注册，不修改现有组件 |
| Mermaid.js 依赖引入包体膨胀 | 中 | 可 CDN 加载，不 bundle |
| inline markup 滑坡到完整 markdown | 高 | 冻结 subset 规约，不扩展 |
| Cell 数过多导致性能问题 | 低 | 40 个 Cell 在当前架构内可控 |
| 与 0253 cellwise 合同冲突 | 高 | 新 label 作为 cellwise 合同的合法扩展，不修改核心机制 |

**回滚方案**：每个 Phase 独立，可单独回滚。组件注册表 + renderer + authoring 字段约定均为增量，删除即回滚。

---

## 8. 附属修复：Static Workspace 已知阻塞

0272 Static Workspace 在实际使用中暴露两个问题，必须在本轮一并修复，否则会成为文档型页面能力验证的现实阻塞：

### 8.1 FileInput 点击无反应

- 现象：Workspace 下 Static 页面的"上传文件"按钮点击后没有反应
- 影响：无法验证 Image 组件的 MXC URL 来源链路
- 修复范围：renderer.mjs 中 FileInput 组件的事件绑定

### 8.2 已挂载项目缺少删除按钮

- 现象：已挂载的 Static 项目列表中没有"删除"操作
- 需求：删除时需一并清理 `/p/<projectName>/...` 的实际文件/目录
- 影响：不能验证"删除后重建"的完整流程
- 修复范围：Static truth model 的 action handler + 文件清理逻辑
