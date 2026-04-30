---
title: "0350 Slide App Runtime User Guide Plan"
doc_type: iteration-plan
status: completed
updated: 2026-04-29
source: ai
---

# Iteration 0350-slide-app-runtime-user-guide Plan

## Goal

把当前滑动 APP 从编写、交付、安装、自动建引脚、前端点击、后端程序触发、管理总线外发到回流的实际链路讲清楚，并落到 `docs/user-guide/` 下的开发者文档与可视化页面。

同时复核当前远端域名 / SSH 事实：说明 SSH 使用的 IP 与用户名，并判断域名解析异常是否来自本地 DNS server 还是权威 DNS / 域名状态。

## Scope

- In scope:
- DNS / SSH current-state verification and runlog evidence.
- Dedicated user-guide folder for slide app runtime authoring and delivery.
- Markdown developer guide with ModelTable fill examples.
- Self-contained visualized interactive HTML that explains the same runtime chain.
- Deterministic test that anchors the guide to current code contracts.
- Out of scope:
- Changing runtime semantics, importer behavior, deployment scripts, or remote Kubernetes state.
- Adding new UI components or widening frontend `/bus_event` allow-lists.
- Rewriting older historical slide docs beyond index/navigation updates.

## Invariants / Constraints

- ModelTable remains SSOT; UI is projection only.
- Formal business ingress enters `bus_event_v2 -> Model 0 (0,0,0) pin.bus.in -> pin route -> target`.
- Pin payloads are temporary ModelTable record arrays; persistence is explicit materialization only.
- Every `model.table` root `(0,0,0)` is seeded with the three default root program chains from `default_table_programs.json`.
- Side effects are expressed as labels / pins, not frontend direct truth mutation.

## Success Criteria

- SSH IP and username are verified and recorded.
- DNS result distinguishes authoritative/registrar expiration from local DNS cache/server issues.
- User guide covers:
  - default root program chains on `(0,0,0)`;
  - slide app authoring;
  - zip / media / importer / mount deployment;
  - install-time auto-created ingress and egress pins;
  - frontend click to backend target cell;
  - backend program model authoring and trigger;
  - app root to Model 0 management bus send path.
- Visualized HTML is local and self-contained.
- Existing slide ingress/egress and mgmt-bus contract tests still pass.
- New 0350 docs contract test passes.

## Inputs

- Created at: 2026-04-29
- Iteration ID: 0350-slide-app-runtime-user-guide
