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

## Gallery 预览

访问 Gallery 页面可以查看所有新组件的实时演示：

1. 启动服务器: `cd packages/ui-model-demo-server && bun server.mjs`
2. 访问: `http://127.0.0.1:9000/#/gallery`
3. 滚动到 "Wave D: New UI Components (v2)" 区域

---

## 更新日志

- **2026-02-06**: 新增 StatCard, StatusBadge, Terminal, Icon 组件
- **2026-02-06**: 扩展 Text (size/weight/color), Button (icon/variant), Container (justify/align/wrap)
