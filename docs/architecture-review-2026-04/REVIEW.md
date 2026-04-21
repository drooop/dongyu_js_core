---
title: "架构评审报告：dongyu_js_core (dongyuapp_elysia_based)"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# 架构评审报告：dongyu_js_core (dongyuapp_elysia_based)

**评审日期**: 2026-04-10
**评审范围**: 全栈架构（Runtime Core / Server API / Frontend / Deployment）
**评审目标**: 识别架构优势、风险点与权衡，为后续演进提供决策参考

---

## 1. 系统概述

dongyu_js_core 是一个 **ModelTable 驱动的运行时与 UI 平台**，核心范式为"填表优先"（fill-table-first）：应用行为通过结构化 ModelTable 声明式定义，运行时解释结构声明产生副作用，而非传统命令式编程。

### 技术栈总览

| 层级 | 技术选型 |
|------|---------|
| Runtime 宿主 | Bun / Node.js（双 CJS/ESM） |
| 前端 | Vue 3 + Vite + Element Plus |
| Web Server | Node.js 原生 `http` 模块 |
| 3D 渲染 | Three.js（CDN 懒加载） |
| 数据库 | SQLite（模型持久化） |
| 消息总线 | MQTT（Mosquitto / EMQX） |
| 联邦通信 | Matrix 协议（Synapse homeserver） |
| 容器化 | Docker（多镜像：Bun + Node） |
| 编排 | Kubernetes（本地 K3s + 云端 RKE2） |

### 核心架构模式

```
User Input
    │
    ▼
┌─────────────────┐     SSE / HTTP      ┌──────────────────┐
│   Vue 3 Frontend │ ◄──────────────────► │  Node.js Server  │
│   (Projection)   │                      │  (server.mjs)    │
└────────┬────────┘                      └────────┬─────────┘
         │                                        │
         │  UI AST                    addLabel / rmLabel
         │                                        │
         ▼                                        ▼
┌─────────────────┐                      ┌──────────────────┐
│  ui_cellwise_    │                      │  ModelTable       │
│  projection.js   │ ◄─── snapshot ──── │  Runtime          │
│  ui_schema_      │                      │  (runtime.mjs)   │
│  projection.js   │                      └────────┬─────────┘
└─────────────────┘                               │
                                          Label Side Effects
                                                  │
                                    ┌─────────────┼─────────────┐
                                    ▼             ▼             ▼
                               ┌────────┐  ┌──────────┐  ┌──────────┐
                               │  MQTT  │  │  Matrix  │  │  SQLite  │
                               │  Bus   │  │  Live    │  │  Persist │
                               └────────┘  └──────────┘  └──────────┘
```

---

## 2. 各层架构分析

### 2.1 Runtime Core（运行时核心）

**核心机制**: `ModelTableRuntime` 实现了一个 **label 驱动的状态机**。基本执行单元是向 3D 网格（page, row, column）中的 cell 添加 label。每个 label 包含三个组成部分：`k`（键名）、`t`（类型标签）、`v`（值）。

**Label Type Dispatch（标签类型分发）**:

运行时通过 `_applyLabelTypes()` 和 `_applyBuiltins()` 进行分发：

| Label Type | 副作用 |
|------------|--------|
| `pin.in` / `pin.out` | Cell 路由 + 图传播 |
| `pin.bus.in` / `pin.bus.out` | 跨模型 MQTT 通信 |
| `pin.connect.label` / `.cell` / `.model` | 布线规则定义 |
| `func.js` / `func.python` | 函数注册与执行 |
| `MQTT_WILDCARD_SUB` | 动态 MQTT 订阅 |
| `submt` | 子模型声明 |

**三级路由系统**:
1. `cellConnectionRoutes` — cell 级直接跳转
2. `cellConnectGraph` — 图式多跳传播（带环检测）
3. `modelConnectionRoutes` — 跨模型边界路由

**持久化**: 采用 event-sourcing-lite 模式。每次 label 增删触发 `onLabelAdded()` / `onLabelRemoved()` 回调，写入 SQLite `mt_data` 表。状态仅存内存，持久化为 write-through 但非事务性。

**函数执行**: JS 函数通过 `AsyncFunction` 构造器执行，30 秒超时。函数接收冻结的 `ctx` 对象，仅能通过 `getLabel()` / `writeLabel()` / `rmLabel()` / `publishMqtt()` 与系统交互。

#### 评价

| 维度 | 评级 | 说明 |
|------|------|------|
| 灵活性 | ★★★★★ | 任何 label type 可触发自定义逻辑 |
| 可扩展性 | ★★☆☆☆ | 新 label type 需修改 `_applyBuiltins()` 硬编码 switch |
| 可理解性 | ★★☆☆☆ | 三级路由语义重叠，认知负担高 |
| 确定性 | ★★★☆☆ | Promise.all 传播顺序非确定性，并发写入结果取决于微任务调度 |
| 类型安全 | ★☆☆☆☆ | 无 TypeScript，label 坐标和类型全为字符串/数字，无 schema 校验 |

---

### 2.2 Server / API 层

**框架**: 原生 Node.js `http.createServer()`，无中间件系统或路由库。

**核心 Endpoints**:

| 路径 | 方法 | 功能 |
|------|------|------|
| `/auth/login` | POST | Matrix 协议代理登录 |
| `/auth/me` | GET | 当前用户信息 |
| `/ui_event` | POST | 核心操作处理（event envelope） |
| `/snapshot` | GET | 全量模型快照 |
| `/stream` | GET | SSE 实时推送 |
| `/api/media/upload` | POST | Matrix 媒体上传 |
| `/p/[slug]` | GET | 页面资产（Markdown + KaTeX） |

**认证**: Cookie-based session（`dy_session`），in-memory session store（7 天 TTL，最大 10,000 并发），委托 Matrix homeserver 验证凭证。SSRF 防护：校验 homeserver URL，拒绝内网地址段。

**Policy Engine** (`filltable_policy.mjs`): 约束 LLM 产生的 model 变更 — 最大 10 个变更/请求、64KB/值上限、白名单 label type、保护系统标签键。

**LLM 集成**: 三阶段 pipeline — 意图路由（Intent Routing）→ 场景上下文（Scene Context）→ 填表规划（Filltable Planning）。Provider 为 Ollama，含存活检测和优雅降级。

#### 评价

| 维度 | 评级 | 说明 |
|------|------|------|
| 简洁性 | ★★★★☆ | 极简 HTTP handler，无框架开销 |
| 安全性 | ★★★☆☆ | 有 rate limiting、SSRF 防护、HttpOnly cookie；缺少 request body size limit、CSRF token |
| 可扩展性 | ★★☆☆☆ | 单线程同步路由，无并发控制；SSE 全量推送无 delta 编码 |
| 可维护性 | ★★☆☆☆ | 单文件 server.mjs 承载所有路由、认证、SSE、LLM 逻辑 |
| 可观测性 | ★★★☆☆ | 有 trace model (ID -100) 和 event 追踪；无结构化日志或 metrics |

---

### 2.3 Frontend 层

**架构**: Vue 3 SPA，**模型投影引擎**设计 — snapshot → projection → VNode tree。

**双模式运行**:
- **Local Mode**: 进程内 `ModelTableRuntime`，localStorage 持久化，端口 5173
- **Remote Mode**: HTTP + SSE 连接后端（端口 9000），支持多用户

**投影系统**:
- `ui_cellwise_projection.js` — 细粒度：每个 cell 映射为一个 VNode，支持嵌套层级和样式覆盖
- `ui_schema_projection.js` — 轻量级：从 schema metadata 自动生成 FormItem

**状态管理**: Vue `reactive()` 包装 snapshot 对象。组件通过 `getSnapshot()` 派生 UI AST，避免显式 props 穿透。Remote store 维护 `overlayStore` 管理 in-flight 值的 staged/committed 状态。

**消息总线**: `local_bus_adapter.js` 做 UI 事件到模型变更的桥接。操作 ID 追踪防止重放攻击，action 白名单控制允许的操作类型。

#### 评价

| 维度 | 评级 | 说明 |
|------|------|------|
| 架构清晰度 | ★★★★☆ | 单向数据流：snapshot → projection → render |
| 灵活性 | ★★★★☆ | 双模式 (local/remote) 使用同一 UI 代码 |
| 性能 | ★★☆☆☆ | `deep: true` watch 全量 snapshot；大模型下全量重渲染 |
| 可维护性 | ★★★☆☆ | action 白名单 30+ 项硬编码，扩展需改代码部署 |
| 错误处理 | ★★☆☆☆ | 投影失败静默降级，可能隐藏 model schema 损坏 |

---

### 2.4 Deployment 层

**本地 (K3s / Docker Desktop)**:
- Namespace `dongyu`，单副本 Deployment
- Mosquitto MQTT + Synapse Matrix + SQLite
- Host-path PV (`/Users/drop/dongyu/volume/persist/`)
- LLM 启用（Ollama via `host.docker.internal:11434`）

**云端 (RKE2 @ dongyudigital.com)**:
- EMQX Enterprise 替代 Mosquitto
- NGINX Ingress + LetsEncrypt TLS
- LLM 禁用 (`DY_LLM_ENABLED=0`)
- Host-path PV (`/home/wwpic/dongyu/volume/persist/`）

**Docker 镜像策略**:

| 镜像 | 基础镜像 | 用途 |
|------|---------|------|
| `dy-ui-server:v1` | `oven/bun:latest` | UI Server + 前端构建 |
| `dy-remote-worker:v3` | `oven/bun:latest` | 远程 worker |
| `dy-ui-side-worker:v1` | `node:22-slim` | UI 侧 worker |
| `dy-mbr-worker:v2` | `node:22-slim` | MBR worker |

**异构运行时**: UI Server 用 Bun（快速启动），Workers 用 Node.js（稳定性）。

#### 评价

| 维度 | 评级 | 说明 |
|------|------|------|
| 环境隔离 | ★★★★☆ | 本地/云端清晰分离 |
| 安全性 | ★★☆☆☆ | MQTT 匿名访问、TLS 全局禁用、ConfigMap 存敏感信息 |
| 可扩展性 | ★☆☆☆☆ | 单副本，无 HPA，无 StorageClass |
| 运维成熟度 | ★★☆☆☆ | 无 CI/CD pipeline，纯脚本部署，无集中化日志/监控 |
| 灾备 | ★☆☆☆☆ | SQLite + host-path 无备份策略，session 内存存储重启丢失 |

---

## 3. 数据流全景

```
用户操作
    │
    ▼
Frontend: dispatchAddLabel()
    │
    ▼
Bus Adapter: consumeOnce()  ──── 操作验证 + allowlist 检查
    │
    ├── [Local Mode] ──► runtime.addLabel() ──► snapshot 更新 (reactive)
    │
    └── [Remote Mode] ──► POST /ui_event ──► Server runtime.addLabel()
                                                    │
                                              ┌─────┼─────┐
                                              ▼     ▼     ▼
                                          SQLite  MQTT  Matrix
                                          persist  pub   send
                                                    │
                                              ┌─────┼─────┐
                                              ▼     ▼     ▼
                                          Workers  Other  Other
                                                  Clients Models
    │
    ▼
Snapshot 更新 ──► getUiAst() ──► cellwise/schema projection ──► VNode ──► DOM
```

---

## 4. 关键架构风险

### 4.1 高风险

| # | 风险 | 影响 | 建议 |
|---|------|------|------|
| R1 | **三级路由系统语义重叠** | 维护成本高，Bug 难以定位。cellConnectionRoutes / cellConnectGraph / modelConnectionRoutes 三套布线语言并行，新开发者学习曲线陡峭 | 考虑统一为单一路由引擎 + 不同粒度的 adapter |
| R2 | **Promise.all 传播非确定性** | 并发 label 写入时结果取决于微任务调度顺序而非逻辑顺序，可能导致难以复现的状态不一致 | 引入逻辑时钟或确定性调度队列 |
| R3 | **无 TypeScript，无 schema 校验** | label 坐标和类型全为原始字符串/数字，runtime 运行时才发现类型错误 | 为 label type、cell coordinate、ctx API 添加 TypeScript 类型定义 |
| R4 | **SSE 全量快照推送** | 每次状态变更向所有客户端推送完整 snapshot（注释提及"2MB snapshot"），网络和 CPU 开销线性增长 | 实现 delta 编码或 JSON Patch 差量推送 |
| R5 | **LLM Prompt Injection** | 用户文本直接进入 prompt 模板，无可见的转义或沙箱化，恶意输入可能绕过 policy engine | 在 prompt 构建层增加 input sanitization 和 output validation |

### 4.2 中等风险

| # | 风险 | 影响 | 建议 |
|---|------|------|------|
| R6 | **In-memory session store** | 服务器重启丢失所有用户会话；单机上限 10K 会话无分布式方案 | 可考虑持久化到 SQLite 或 Redis |
| R7 | **Label type 硬编码 dispatch** | `_applyBuiltins()` 中 switch 语句随 label type 增长而膨胀 | 设计 label type plugin 注册机制 |
| R8 | **MQTT 匿名访问** | 本地和云端均无 MQTT 认证，任何能访问网络的客户端都可发布/订阅 | 至少云端启用 EMQX ACL |
| R9 | **前端 deep watch 全量 snapshot** | 大模型场景下每次 label 变更触发全量 Vue reactivity 追踪 | 引入细粒度订阅或 computed 缓存层 |
| R10 | **SQLite host-path 无备份** | 数据库文件直接挂载在宿主机，无自动备份或复制策略 | 定时备份 + WAL checkpoint |

### 4.3 低风险（但值得关注）

| # | 风险 | 说明 |
|---|------|------|
| R11 | ConfigMap 存储敏感信息 | 应迁移至 K8s Secret + 外部密钥管理 |
| R12 | 无 API 版本控制 | 破坏性变更强制所有客户端同步更新 |
| R13 | 前端 action 白名单硬编码 | 30+ action 需代码变更才能扩展 |
| R14 | Three.js 内存泄漏风险 | 大规模场景更新期间可能遗留未释放的 geometry/material |
| R15 | 无 HTTP request body size limit | 可被大 payload DoS 攻击 |

---

## 5. 架构权衡分析

### 5.1 ModelTable-Driven vs. 传统 MVC

| 维度 | ModelTable-Driven | 传统 MVC |
|------|-------------------|----------|
| **灵活性** | 极高 — 新功能 = 新 label type，无需新增路由/控制器 | 中等 — 每个功能需显式 endpoint + handler |
| **学习曲线** | 陡峭 — 需理解 cell/label/type/routing 四层抽象 | 平缓 — 广为人知的模式 |
| **可调试性** | 困难 — 副作用由 label 隐式触发，调用栈不直观 | 容易 — 显式调用链 |
| **适用场景** | 高度动态、用户自定义工作流 | 固定业务逻辑、CRUD 应用 |

**权衡结论**: ModelTable 范式适合项目的核心定位（用户通过"填表"定义应用行为），但需要更好的工具支撑（类型系统、调试器、可视化路由图）来降低认知成本。

### 5.2 原生 HTTP vs. Web 框架

**选择**: 原生 `http.createServer()`
**优势**: 零依赖、完全控制、启动极快
**代价**: 手动 URL 解析、无中间件链、单文件膨胀（server.mjs 承载全部逻辑）
**建议**: 当前规模可接受；若 endpoint 数量翻倍，考虑引入轻量路由库（如 Hono）

### 5.3 Bun vs. Node.js 异构运行时

**选择**: UI Server 用 Bun，Workers 用 Node.js
**优势**: Bun 快速启动 + 内置打包；Node.js 生态成熟
**代价**: 运维复杂度（两套镜像基础、两套依赖管理）、runtime.js / runtime.mjs 双实现需保持行为一致
**建议**: 长期统一到单一运行时，减少同步成本

### 5.4 SSE vs. WebSocket

**选择**: Server-Sent Events（单向推送）
**优势**: 简单、浏览器原生支持、无需额外协议
**代价**: 客户端仅能接收，操作仍需 HTTP POST；全量推送无差量优化
**建议**: 当前够用；若需双向实时（如协作编辑），再考虑 WebSocket

---

## 6. 改进建议优先级

### P0（建议立即关注）

1. **SSE Delta 编码** — 将全量 snapshot 推送改为 JSON Patch 差量，减少带宽和客户端渲染压力
2. **Request Body Size Limit** — server.mjs 增加 `Content-Length` 校验，防止大 payload DoS
3. **LLM Input Sanitization** — prompt 构建层增加用户输入过滤

### P1（短期改进）

4. **Label Type Plugin 机制** — 将 `_applyBuiltins()` 的硬编码 switch 重构为可注册的 handler map
5. **TypeScript 类型定义** — 至少为 label、cell coordinate、ctx API 添加 `.d.ts`
6. **MQTT 认证** — 云端 EMQX 启用 ACL，本地开发可保持匿名

### P2（中期演进）

7. **路由系统统一** — 三级路由合并为统一引擎
8. **前端细粒度订阅** — 替换 `deep: true` watch 为按 model/cell 的选择性响应
9. **Session 持久化** — in-memory store 迁移至 SQLite 或 Redis
10. **CI/CD Pipeline** — 自动化构建、测试、部署流水线

### P3（长期愿景）

11. **确定性调度** — 引入逻辑时钟解决 Promise.all 非确定性问题
12. **可观测性栈** — Prometheus + Grafana + 结构化 JSON 日志
13. **API 版本控制** — path-based 或 header-based 版本策略
14. **多副本支持** — 无状态化 server + 外部状态存储

---

## 7. 总结

dongyu_js_core 是一个 **架构上大胆、理念上独特** 的系统。ModelTable-driven 范式为"用户自定义应用行为"提供了极高的灵活性，同时项目在文档治理（SSOT 层级、CLAUDE.md 约束、WORKFLOW.md 迭代流程）方面展现了超出常规项目的严谨度。

主要优势在于：声明式架构的表达力、文档纪律的严格执行、以及本地/云端部署的清晰分离。主要挑战在于：运行时复杂度（三级路由 + 非确定性传播）、缺乏类型安全保障、以及运维基础设施的成熟度不足（无 CI/CD、无监控、单副本部署）。

项目当前处于 **原型到产品的过渡期** — 核心理念已验证，下一步需要在可维护性、可观测性和安全性方面补齐短板，以支撑更大规模的使用场景。

---

*本评审基于代码库静态分析，未包含运行时性能测试或负载测试数据。建议后续补充实际运行环境的 benchmark。*
