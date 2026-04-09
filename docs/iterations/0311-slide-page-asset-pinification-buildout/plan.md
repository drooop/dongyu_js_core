---
title: "0311 — slide-page-asset-pinification-buildout Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-09
source: ai
iteration_id: 0311-slide-page-asset-pinification-buildout
id: 0311-slide-page-asset-pinification-buildout
phase: phase1
---

# 0311 — slide-page-asset-pinification-buildout Plan

## Goal

- 把内置页面和系统动作按钮改成“按钮 = cell pin 投影”。

## Status

- 本计划依赖 `0310` 先冻结：
  - 前端 pin 直寻址 envelope
  - projection 如何下发 pin 名
  - 系统动作按钮的 cell 化审计结果

## Audit Input From 0310

- 已有独立 cell，可直接进入 pin 化：
  - `Model 100 submit`
  - `slide_app_import`
  - `slide_app_create`
  - `ws_select_app`
  - `ws_app_delete`
- 动作别名复用已有按钮：
  - `ws_app_select` 复用 `ws_select_app`
- 当前未发现现成按钮 cell，需要先补 page_asset / cell：
  - `ws_app_add`
