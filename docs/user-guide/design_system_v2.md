# 洞宇滑动 UI 设计系统 v2

本文档定义了洞宇应用的视觉设计规范，确保所有界面保持一致的风格。

---

## 1. 颜色系统 (Color Palette)

### 主题色

| 名称 | HEX | 用途 |
|------|-----|------|
| **Primary Blue** | `#3B82F6` | 主按钮、链接、选中状态 |
| **Primary Blue Light** | `#EFF6FF` | 选中项背景 |
| **Primary Blue Border** | `#BFDBFE` | 选中项边框 |

### 背景色

| 名称 | HEX | 用途 |
|------|-----|------|
| **Page Background** | `#F8FAFC` | 页面底色 |
| **Card Background** | `#FFFFFF` | 卡片、面板背景 |
| **Terminal Background** | `#1E293B` | 终端、代码区背景 |
| **Terminal Title Bar** | `#334155` | 终端标题栏 |

### 文字颜色

| 名称 | HEX | CSS 变量建议 | 用途 |
|------|-----|-------------|------|
| **Primary Text** | `#1E293B` | `--text-primary` | 标题、重要内容 |
| **Secondary Text** | `#64748B` | `--text-secondary` | 描述、副标题 |
| **Muted Text** | `#94A3B8` | `--text-muted` | 提示、辅助信息 |
| **Terminal Text** | `#E2E8F0` | `--text-terminal` | 终端文字 |

### 状态色

| 状态 | HEX | 用途 |
|------|-----|------|
| **Success / Online** | `#22C55E` | 成功、在线、监控中 |
| **Warning / Pending** | `#F59E0B` | 警告、等待中 |
| **Error / Offline** | `#EF4444` | 错误、离线 |
| **Info** | `#3B82F6` | 信息提示 |

### 边框色

| 名称 | HEX | 用途 |
|------|-----|------|
| **Border Default** | `#E2E8F0` | 卡片边框、分隔线 |
| **Border Dark** | `#334155` | 终端边框 |

---

## 2. 字体系统 (Typography)

### 字体栈

```css
/* 主字体 */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

/* 等宽字体 (终端、代码) */
font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
```

### 尺寸规范

| Token | 像素 | 用途 |
|-------|------|------|
| `xs` | 12px | 徽章标签、辅助文字 |
| `sm` | 13px | 小字、来源标注 |
| `md` | 14px | 正文 (默认) |
| `lg` | 16px | 强调正文 |
| `xl` | 20px | 小标题 |
| `xxl` | 24px | 页面标题 |
| `stat` | 36px | 统计数字 |

### 字重规范

| Token | 值 | 用途 |
|-------|-----|------|
| `normal` | 400 | 正文 |
| `medium` | 500 | 标签、中等强调 |
| `semibold` | 600 | 标题、按钮文字 |
| `bold` | 700 | 统计数字、重要数据 |

### 行高

| 用途 | 行高 |
|------|------|
| 标题 | 1.2 - 1.3 |
| 正文 | 1.5 |
| 终端 | 1.6 |

---

## 3. 间距系统 (Spacing)

### 基础间距

| Token | 值 | 用途 |
|-------|-----|------|
| `spacing-xs` | 4px | 紧凑间距 |
| `spacing-sm` | 8px | 小间距 |
| `spacing-md` | 12px | 中等间距 |
| `spacing-lg` | 16px | 大间距 |
| `spacing-xl` | 24px | 区域间距 |
| `spacing-2xl` | 32px | 大区域间距 |

### 组件内边距

| 组件 | 内边距 |
|------|--------|
| 卡片 | 16px - 24px |
| 按钮 (默认) | 8px 16px |
| 按钮 (胶囊) | 8px 24px |
| 统计卡片 | 16px 20px |
| 终端内容区 | 16px |
| 侧边栏项 | 10px 12px |

---

## 4. 圆角系统 (Border Radius)

| Token | 值 | 用途 |
|-------|-----|------|
| `radius-sm` | 6px | 小元素 |
| `radius-md` | 8px | 按钮、输入框、侧边栏项 |
| `radius-lg` | 12px | 卡片、终端 |
| `radius-xl` | 16px | 大卡片 |
| `radius-full` | 9999px | 胶囊按钮、状态圆点 |

---

## 5. 阴影系统 (Shadows)

| 用途 | CSS |
|------|-----|
| 卡片默认 | `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1)` |
| 卡片悬浮 | `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)` |
| 终端 | 无阴影，使用边框 |

---

## 6. 组件样式规范

### StatCard (统计卡片)

```css
.stat-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 16px 20px;
  min-width: 140px;
}

.stat-card__label {
  font-size: 12px;
  color: #94A3B8;
  font-weight: 500;
  margin-bottom: 8px;
}

.stat-card__value {
  font-size: 36px;
  font-weight: 700;
  color: #1E293B;
  line-height: 1.1;
}

.stat-card__unit {
  font-size: 14px;
  color: #64748B;
  margin-left: 8px;
}
```

### StatusBadge (状态徽章)

```css
.status-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #F8FAFC;
  border-radius: 8px;
  border: 1px solid #E2E8F0;
}

.status-badge__label {
  font-size: 10px;
  color: #94A3B8;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  /* 颜色根据状态变化 */
}

.status-badge__text {
  font-size: 14px;
  color: #1E293B;
  font-weight: 600;
}
```

### Terminal (终端日志)

```css
.terminal {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #334155;
}

.terminal__title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #334155;
}

.terminal__mac-buttons {
  display: flex;
  gap: 8px;
}

.terminal__mac-button {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.terminal__mac-button--close { background: #EF4444; }
.terminal__mac-button--minimize { background: #F59E0B; }
.terminal__mac-button--maximize { background: #22C55E; }

.terminal__title {
  font-size: 13px;
  color: #94A3B8;
}

.terminal__content {
  background: #1E293B;
  padding: 16px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #E2E8F0;
  max-height: 400px;
  overflow-y: auto;
}
```

### 侧边栏项

```css
.sidebar-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: all 150ms ease;
}

.sidebar-item:hover {
  background: #F8FAFC;
}

.sidebar-item--active {
  background: #EFF6FF;
  border-color: #BFDBFE;
}

.sidebar-item__icon {
  font-size: 18px;
  line-height: 1.4;
}

.sidebar-item__name {
  font-size: 14px;
  font-weight: 500;
  color: #1E293B;
}

.sidebar-item--active .sidebar-item__name {
  font-weight: 600;
  color: #3B82F6;
}

.sidebar-item__source {
  font-size: 12px;
  color: #94A3B8;
}
```

### 分组标题

```css
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-top: 8px;
  margin-bottom: 4px;
}

.section-header__icon {
  font-size: 14px;
}

.section-header__title {
  font-size: 12px;
  font-weight: 600;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

---

## 7. 布局规范

### Workspace 布局

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  首页  Gallery  Docs  Static  [Workspace]  PIN  Test  │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  资产树       │  [选中应用的内容区]                          │
│  ASSET TREE  │                                              │
│              │  标题行: 标题 + 副标题 | 状态徽章 + 开关      │
│  ⚙️ 系统应用  │                                              │
│    Bus Trace │  统计卡片行: [卡片1] [卡片2] [卡片3]          │
│              │                                              │
│  👤 数字员工  │  主内容区: Terminal / Form / 其他组件         │
│    颜色生成器 │                                              │
│    请假助手   │  操作按钮: [清空] [其他操作]                  │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 间距层级

- 页面外边距: 16px
- 区域间距: 24px
- 组件间距: 16px
- 元素间距: 8-12px

---

## 8. 响应式断点

| 断点 | 宽度 | 说明 |
|------|------|------|
| `sm` | < 640px | 移动设备 |
| `md` | 640px - 1024px | 平板 |
| `lg` | > 1024px | 桌面 |

---

## 9. 图标规范

### 可用图标

通过 `Icon` 组件的 `name` 属性使用：

- 操作类: `refresh`, `close`, `check`, `plus`, `minus`, `edit`, `trash`, `copy`
- 导航类: `search`, `settings`, `user`
- 状态类: `clock`, `star`, `alert`, `info`, `activity`, `zap`
- 工具类: `download`, `upload`, `terminal`

### 图标尺寸规范

| 用途 | 尺寸 |
|------|------|
| 内联图标 | 14px |
| 按钮图标 | 16px |
| 卡片图标 | 18-24px |
| 大图标 | 32px+ |

---

## 10. 动效规范

### 过渡时长

| 类型 | 时长 | 缓动函数 |
|------|------|----------|
| 快速 | 150ms | ease |
| 标准 | 200ms | ease |
| 慢速 | 300ms | ease |

### 常用过渡

```css
/* 悬浮状态变化 */
transition: all 150ms ease;

/* 背景色变化 */
transition: background-color 200ms ease;

/* 展开/收起 */
transition: height 300ms ease, opacity 200ms ease;
```

---

## 更新日志

- **2026-02-06**: 初始版本，基于设计稿提取
