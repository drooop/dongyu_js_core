---
title: "滑动 UI 组件指南 (v2)"
doc_type: user-guide
status: active
updated: 2026-03-23
source: ai
---

# 滑动 UI 组件指南 (v2)

本文档介绍 v2 版本新增的 UI 组件，以及如何通过 Schema 或 AST 方式使用它们。

## 目录

1. [StatCard - 统计卡片](#statcard---统计卡片)
2. [StatusBadge - 状态徽章](#statusbadge---状态徽章)
3. [Terminal - 终端日志](#terminal---终端日志)
4. [Icon - 图标组件](#icon---图标组件)
5. [Text 扩展](#text-扩展---尺寸权重颜色)
6. [Button 扩展](#button-扩展---图标变体)
7. [Container 扩展](#container-扩展---布局控制)
8. [ThreeScene - 3D 场景投影](#threescene---3d-场景投影)

---

## StatCard - 统计卡片

用于展示关键指标数据，包含标签、数值和单位。

### Props

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `label` | string | 是 | 顶部小标签 (如 "事件计数") |
| `value` | number/string | 否 | 显示的数值 (可通过 bind 绑定) |
| `unit` | string | 否 | 数值后的单位 (如 "events", "ms") |
| `variant` | string | 否 | 颜色变体: default/success/warning/error/info |

### AST 示例

```json
{
  "id": "stat_events",
  "type": "StatCard",
  "props": {
    "label": "事件计数",
    "value": 170,
    "unit": "events recorded",
    "variant": "default"
  }
}
```

### 数据绑定示例

```json
{
  "id": "stat_bound",
  "type": "StatCard",
  "props": { "label": "实时计数", "unit": "条" },
  "bind": {
    "read": { "model_id": -100, "p": 0, "r": 0, "c": 0, "k": "trace_count" }
  }
}
```

### p=1 Schema 方式 (buildAstFromSchema)

目前 StatCard 需要使用 AST 方式，暂不支持 p=1 schema 简写。

---

## StatusBadge - 状态徽章

用于显示系统/服务状态，带有状态指示点和文字。

### Props

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `label` | string | 否 | 顶部小标签 (默认 "STATUS") |
| `status` | string | 否 | 状态值: monitoring/online/success/warning/error/offline/idle |
| `text` | string | 否 | 状态描述文字 (如 "Monitoring") |

### 状态颜色对照

| status | 颜色 | 用途 |
|--------|------|------|
| `monitoring` | 绿色 #22C55E | 监控中 |
| `online` | 绿色 #22C55E | 在线 |
| `success` | 绿色 #22C55E | 成功 |
| `warning` | 橙色 #F59E0B | 警告 |
| `pending` | 橙色 #F59E0B | 等待中 |
| `error` | 红色 #EF4444 | 错误 |
| `offline` | 红色 #EF4444 | 离线 |
| `idle` | 灰色 #94A3B8 | 空闲 |

### AST 示例

```json
{
  "id": "status_badge",
  "type": "StatusBadge",
  "props": {
    "label": "STATUS",
    "status": "monitoring",
    "text": "Monitoring"
  }
}
```

---

## Terminal - 终端日志

仿 macOS 终端风格的日志查看器，适合显示系统日志、事件流等。

### Props

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 否 | 标题栏文字 (默认 "terminal") |
| `content` | string | 否 | 日志内容 (可通过 bind 绑定) |
| `showMacButtons` | boolean | 否 | 是否显示红黄绿圆点 (默认 true) |
| `showToolbar` | boolean | 否 | 是否显示工具栏按钮 (默认 true) |
| `maxHeight` | string | 否 | 最大高度 (默认 "400px") |

### AST 示例

```json
{
  "id": "trace_terminal",
  "type": "Terminal",
  "props": {
    "title": "system_event_stream.log (最新 50 条)",
    "showMacButtons": true,
    "showToolbar": true,
    "maxHeight": "400px"
  },
  "bind": {
    "read": { "model_id": -100, "p": 0, "r": 0, "c": 0, "k": "trace_log_text" }
  }
}
```

---

## Icon - 图标组件

显示预定义的图标符号。

### Props

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 图标名称 |
| `size` | number | 否 | 图标尺寸 (默认 16px) |
| `color` | string | 否 | 图标颜色 (CSS 颜色值) |

### 可用图标列表

| name | 显示 | 说明 |
|------|------|------|
| `refresh` | ↻ | 刷新 |
| `close` | ✕ | 关闭 |
| `check` | ✓ | 确认 |
| `plus` | + | 添加 |
| `minus` | − | 减少 |
| `search` | 🔍 | 搜索 |
| `download` | ⬇ | 下载 |
| `upload` | ⬆ | 上传 |
| `copy` | 📋 | 复制 |
| `trash` | 🗑 | 删除 |
| `edit` | ✎ | 编辑 |
| `clock` | 🕐 | 时钟 |
| `settings` | ⚙ | 设置 |
| `user` | 👤 | 用户 |
| `star` | ★ | 收藏 |
| `activity` | 📊 | 活动 |
| `zap` | ⚡ | 闪电 |
| `alert` | ⚠ | 警告 |
| `info` | ℹ | 信息 |
| `terminal` | 💻 | 终端 |

### AST 示例

```json
{
  "id": "icon_clock",
  "type": "Icon",
  "props": {
    "name": "clock",
    "size": 24,
    "color": "#3B82F6"
  }
}
```

---

## Text 扩展 - 尺寸/权重/颜色

Text 组件新增 size、weight、color 属性支持。

### 新增 Props

| 属性 | 类型 | 值 | 说明 |
|------|------|-----|------|
| `size` | string | xs/sm/md/lg/xl/xxl/stat | 字体大小 |
| `weight` | string | normal/medium/semibold/bold | 字重 |
| `color` | string | primary/secondary/muted/success/warning/error/info | 预设颜色 |

### 尺寸对照

| size | 像素 |
|------|------|
| `xs` | 12px |
| `sm` | 13px |
| `md` | 14px (默认) |
| `lg` | 16px |
| `xl` | 20px |
| `xxl` | 24px |
| `stat` | 36px |

### 颜色对照

| color | HEX |
|-------|-----|
| `primary` | #1E293B |
| `secondary` | #64748B |
| `muted` | #94A3B8 |
| `success` | #22C55E |
| `warning` | #F59E0B |
| `error` | #EF4444 |
| `info` | #3B82F6 |

### AST 示例

```json
{
  "id": "title",
  "type": "Text",
  "props": {
    "text": "Bus Trace — 全链路事件追踪",
    "size": "xxl",
    "weight": "semibold",
    "color": "primary"
  }
}
```

### p=1 Schema 方式

```
k: 'my_title'     t: 'str'  v: 'Text'
k: 'my_title__props'  t: 'json'  v: { "size": "xl", "weight": "bold", "color": "primary" }
```

---

## Button 扩展 - 图标/变体

Button 组件新增 icon、variant 属性支持。

### 新增 Props

| 属性 | 类型 | 说明 |
|------|------|------|
| `icon` | string | 图标名称 (参考 Icon 组件) |
| `iconPosition` | string | 图标位置: left/right (默认 left) |
| `variant` | string | 按钮变体: pill/text/link |

### Variant 说明

| variant | 效果 |
|---------|------|
| (默认) | 标准按钮 |
| `pill` | 胶囊形按钮 (圆角 9999px) |
| `text` | 文字按钮 (无背景) |
| `link` | 链接样式 |

### AST 示例

```json
{
  "id": "clear_btn",
  "type": "Button",
  "props": {
    "label": "清空 Trace",
    "icon": "refresh",
    "variant": "pill",
    "type": "primary"
  },
  "bind": {
    "write": {
      "action": "label_add",
      "target_ref": { "model_id": -100, "p": 0, "r": 0, "c": 2, "k": "clear_cmd" },
      "value_ref": { "t": "str", "v": "1" }
    }
  }
}
```

### p=1 Schema 方式

```
k: 'my_button'     t: 'str'  v: 'Button'
k: 'my_button__props'  t: 'json'  v: { "label": "点击", "icon": "check", "variant": "pill", "type": "success" }
```

---

## Container 扩展 - 布局控制

Container 组件新增 justify、align、wrap 属性。

### 新增 Props

| 属性 | 类型 | 说明 |
|------|------|------|
| `justify` | string | 主轴对齐: flex-start/center/flex-end/space-between/space-around |
| `align` | string | 交叉轴对齐: flex-start/center/flex-end/stretch |
| `wrap` | boolean | 是否换行 |

### AST 示例

```json
{
  "id": "header_row",
  "type": "Container",
  "props": {
    "layout": "row",
    "gap": 16,
    "justify": "space-between",
    "align": "center"
  },
  "children": [
    { "id": "left", "type": "Text", "props": { "text": "左侧" } },
    { "id": "right", "type": "Text", "props": { "text": "右侧" } }
  ]
}
```

---

## 完整示例：Bus Trace 页面 AST

以下是 Bus Trace 系统应用的完整 AST 结构示例：

```json
{
  "id": "trace_root",
  "type": "Container",
  "props": { "layout": "column", "gap": 24 },
  "children": [
    {
      "id": "trace_header",
      "type": "Container",
      "props": { "layout": "row", "justify": "space-between", "align": "flex-start" },
      "children": [
        {
          "id": "trace_title_area",
          "type": "Container",
          "props": { "layout": "column", "gap": 4 },
          "children": [
            { "id": "trace_title", "type": "Text", "props": { "text": "Bus Trace — 全链路事件追踪", "size": "xxl", "weight": "semibold" } },
            {
              "id": "trace_subtitle_row",
              "type": "Container",
              "props": { "layout": "row", "gap": 6, "align": "center" },
              "children": [
                { "id": "trace_clock_icon", "type": "Icon", "props": { "name": "clock", "size": 14, "color": "#64748B" } },
                { "id": "trace_subtitle", "type": "Text", "props": { "text": "实时记录: UI → Server → Matrix → MBR → MQTT 全链路消息", "color": "secondary" } }
              ]
            }
          ]
        },
        {
          "id": "trace_controls",
          "type": "Container",
          "props": { "layout": "row", "gap": 16, "align": "center" },
          "children": [
            { "id": "trace_status_badge", "type": "StatusBadge", "props": { "label": "STATUS", "text": "Monitoring" } },
            { "id": "trace_switch_label", "type": "Text", "props": { "text": "Trace 开关", "color": "secondary" } },
            { "id": "trace_switch", "type": "Switch", "bind": { "read": { "model_id": -100, "p": 0, "r": 0, "c": 0, "k": "trace_enabled" } } }
          ]
        }
      ]
    },
    {
      "id": "trace_stats_row",
      "type": "Container",
      "props": { "layout": "row", "gap": 16 },
      "children": [
        { "id": "stat_events", "type": "StatCard", "props": { "label": "事件计数", "unit": "events recorded" }, "bind": { "read": { "model_id": -100, "p": 0, "r": 0, "c": 0, "k": "trace_count" } } },
        { "id": "stat_latency", "type": "StatCard", "props": { "label": "平均延迟", "unit": "ms" }, "bind": { "read": { "model_id": -100, "p": 0, "r": 0, "c": 0, "k": "trace_avg_latency" } } },
        { "id": "stat_update", "type": "StatCard", "props": { "label": "最新更新", "unit": "now" }, "bind": { "read": { "model_id": -100, "p": 0, "r": 0, "c": 0, "k": "trace_last_update" } } }
      ]
    },
    {
      "id": "trace_terminal",
      "type": "Terminal",
      "props": { "title": "system_event_stream.log (最新 50 条)", "showMacButtons": true, "maxHeight": "400px" },
      "bind": { "read": { "model_id": -100, "p": 0, "r": 0, "c": 0, "k": "trace_log_text" } }
    },
    {
      "id": "trace_clear_btn",
      "type": "Container",
      "props": { "layout": "row", "justify": "center" },
      "children": [
        { "id": "trace_clear", "type": "Button", "props": { "label": "清空 Trace", "icon": "refresh", "variant": "pill", "type": "primary" } }
      ]
    }
  ]
}
```

---

## ThreeScene - 3D 场景投影

用于把 mounted child model 中的 scene labels 投影成浏览器端 Three.js scene。它是 renderer primitive + host cache，不是 truth source。

### Props

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sceneGraphRef` | LabelRef | 是 | 指向 child model 的 `scene_graph_v0` |
| `cameraStateRef` | LabelRef | 是 | 指向 child model 的 `camera_state_v0` |
| `selectedEntityIdRef` | LabelRef | 否 | 指向 child model 的 `selected_entity_id` |
| `sceneStatusRef` | LabelRef | 否 | 指向 child model 的 `scene_status` |
| `auditLogRef` | LabelRef | 否 | 指向 child model 的 `scene_audit_log` |
| `width` / `height` | string/number | 否 | 画布尺寸 |
| `background` | string | 否 | 场景背景色 |
| `actions` | object | 否 | formal CRUD action names，仅用于显式暴露 contract |

### 使用约束

- 浏览器内的 `scene/camera/mesh` 只是 disposable cache，不拥有 business truth。
- authoritative truth 必须仍在正数 child model labels。
- local mode 不允许复制 CRUD 逻辑；0216 的 local path 必须返回 `unsupported / three_scene_remote_only`。
- server-backed CRUD 必须走 `ui_event -> intent_dispatch_table -> handle_three_scene_*`。

### AST 示例

```json
{
  "id": "three_scene_workspace_view",
  "type": "ThreeScene",
  "props": {
    "width": "100%",
    "height": 360,
    "background": "#020617",
    "sceneGraphRef": { "model_id": 1008, "p": 0, "r": 0, "c": 0, "k": "scene_graph_v0" },
    "cameraStateRef": { "model_id": 1008, "p": 0, "r": 0, "c": 0, "k": "camera_state_v0" },
    "selectedEntityIdRef": { "model_id": 1008, "p": 0, "r": 0, "c": 0, "k": "selected_entity_id" },
    "sceneStatusRef": { "model_id": 1008, "p": 0, "r": 0, "c": 0, "k": "scene_status" },
    "auditLogRef": { "model_id": 1008, "p": 0, "r": 0, "c": 0, "k": "scene_audit_log" },
    "actions": {
      "create": "three_scene_create_entity",
      "select": "three_scene_select_entity",
      "update": "three_scene_update_entity",
      "delete": "three_scene_delete_entity"
    }
  }
}
```

### 推荐挂载方式

- Workspace 只挂 parent scene app model，例如 `Model 1007`。
- parent page asset 可以直接渲染 `ThreeScene`，但 child truth model 例如 `Model 1008` 仍必须通过 `model.submt` 显式挂载。
- child model 不应带 `app_name`，否则会被错误暴露成独立 Workspace app。

## Gallery 预览

访问 Gallery 页面可以查看所有新组件的实时演示：

1. 启动服务器: `cd packages/ui-model-demo-server && bun server.mjs`
2. 访问: `http://127.0.0.1:9000/#/gallery`
3. 滚动到 "Wave D: New UI Components (v2)" 区域

---

## 更新日志

- **2026-02-06**: 新增 StatCard, StatusBadge, Terminal, Icon 组件
- **2026-02-06**: 扩展 Text (size/weight/color), Button (icon/variant), Container (justify/align/wrap)
- **2026-03-23**: 新增 ThreeScene 组件，冻结 Workspace parent-mounted child scene contract 与 remote-only local boundary
