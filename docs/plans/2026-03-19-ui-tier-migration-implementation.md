---
title: "UI Tier Migration Implementation Plan"
doc_type: note
status: active
updated: 2026-03-21
source: ai
---

# UI Tier Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将当前 UI 层从“Tier 1/2 混合硬编码”迁移为“最小 Tier 1 解释器 + Tier 2 页面资产”的稳定结构，使后续页面/示例/能力迭代尽量只修改模型资产。

**Architecture:** 保留最小 Tier 1：renderer、component registry、transport/host adapter、稳定 schema projection 协议、route/hash 同步桥接。将 Header/nav、Gallery、Workspace 目录、Home/Docs/Static/Prompt、Login seed 与 server 侧整页 AST 生成逐步迁为模型资产，并在迁移期间通过明确的 fallback 优先级实现新旧并存。

**Tech Stack:** Node.js、Vue 3、Element Plus、ModelTable runtime、JSON patch (`mt.v0`)、前端 renderer、ui-model-demo-server。

---

## Program Summary

本迁移采用“渐进绞杀式”路线，按以下 4 个实施单元推进：

1. `0191a-ui-protocol-freeze`
   - 冻结最小 Tier 1 协议与新旧共存切换点
2. `0191b-gallery-modelization`
   - 将 Gallery 从 JS 页面迁为模型资产，并接入 Workspace
3. `0191c-nav-login-prompt-dehardcode`
   - 去硬编码导航，迁移 Login 与 Prompt 页面
4. `0191d-static-docs-home-legacy-removal`
   - 迁移 Static / Docs / Home，并删除旧 AST 生成链

## Global Constraints

- 只允许 2 类内容留在 Tier 1：
  - 通用解释器语义
  - 宿主桥接能力
- 任何页面内容、文案、导航结构、目录结构、示例列表、页面状态结构，若可由静态模型资产表达，则必须留在 Tier 2。
- 迁移期间必须支持“新旧并存但各自完整”；不得出现旧页面拆半、新页面未接上的中间态。
- server 侧 legacy AST 生成只允许作为迁移期间 fallback；不得作为新增页面来源。

## Phase Mapping

| Phase | Iteration | 目标 |
|---|---|---|
| Phase 0 | `0191a` | 冻结 `schema projection`、`route catalog`、页面资产装载优先级、legacy AST fallback 退出路径 |
| Phase 1 | `0191b` | Gallery 模型化，并作为能力示例入口接入 Workspace |
| Phase 2 | `0191c` | 导航去硬编码，迁移 Login / Prompt |
| Phase 3 | `0191d` | 迁移 Static / Docs / Home |
| Phase 4 | `0191d` | 删除 `buildEditorAstV0/V1`、`buildGalleryAst`、`GalleryRemoteRoot`、server 侧整页 AST 生成 |

## Migration Priority

### P0. 冻结切换点

- 定义 page asset 装载优先级：
  - 若页面已有模型资产，则以前端读取的模型资产为准
  - 若页面尚未迁移，则回退到 legacy `buildEditorAstV1`
- 定义 route catalog 协议：
  - 页面入口列表来自模型资产
  - Tier 1 只负责 route 监听 / 同步，不负责页面清单
- 定义 schema projection 协议：
  - `_title`
  - `_subtitle`
  - `_field_order`
  - `field`
  - `field__label`
  - `field__props`
  - `field__opts`
  - `field__bind`
  - `field__no_wrap`

### P1. 迁最独立的页面来源

- 先迁 Gallery
- 再迁导航与 Workspace 左侧目录
- 再迁 Login / Prompt

### P2. 迁宿主能力绑定更重的系统页

- `Static`
- `Docs`
- `Home`

## Verification Rules

- 每个实施单元都必须同时具备：
  - Functional PASS：页面仍可正常打开与交互
  - Conformance PASS：页面内容来源迁入 Tier 2，未新增不必要 Tier 1 逻辑
- 每迁完一个页面，都必须验证：
  - 页面可打开
  - 既有组件交互正常
  - 新增一个同协议页面无需改前端 JS

## Rollback Strategy

- 每个实施单元独立回滚
- 在 Phase 4 之前，legacy `buildEditorAstV1` 必须保留为 fallback
- 仅当所有迁移页面均能从模型资产稳定渲染后，才允许删除 legacy AST 生成链

## Decision Log

- `buildAstFromSchema()` 当前暂视为 Tier 1 的“通用 projection 解释层”，但必须从页面组装代码中独立出来并冻结协议。
- route/hash 只保留“监听/同步”能力；页面名、页面列表、导航文案与默认入口策略均迁为模型资产。
- 后续“新增页面”应默认只改 Tier 2；只有“新增组件语义”或“新增宿主桥接能力”才允许修改 Tier 1。
