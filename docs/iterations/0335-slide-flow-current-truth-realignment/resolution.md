---
title: "0335 — slide-flow-current-truth-realignment Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-26
source: ai
iteration_id: 0335-slide-flow-current-truth-realignment
id: 0335-slide-flow-current-truth-realignment
phase: phase1
---

# 0335 — slide-flow-current-truth-realignment Resolution

## Execution Strategy

This is a planning / documentation-realignment iteration. Do not rewrite the user guide in this iteration.

1. Locate prior slide-flow descriptions.
2. Freeze the 4-part target structure.
3. Identify obsolete direct-cell wording.
4. Define follow-up rewrite scope and verification.

## Step 1 — Locate Prior Descriptions
- Primary files found:
  - `docs/user-guide/slide_delivery_and_runtime_overview_v1.md`
  - `docs/user-guide/slide_app_zip_import_v1.md`
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
- Acceptance:
  - Follow-up rewrite has concrete source files, not an abstract memory of prior plans.

## Step 2 — Freeze 4-Part Structure
- Required sections:
  - 安装交付
  - App 结构
  - 页面运行
  - 外发回流
- Acceptance:
  - Each section has a concrete path description and boundary.

## Step 3 — Correct Current-Truth Conflict
- Obsolete wording to remove or mark historical:
  - “浏览器事件先直达目标 cell”
  - “server 直接把目标 pin 写到目标 cell” as current formal business ingress
- Replacement wording:
  - local draft / overlay is not formal business
  - formal business ingress enters through `bus_event_v2 -> Model 0 pin.bus.in`
- Acceptance:
  - Follow-up docs cannot mix local UI draft with formal business ingress.

## Step 4 — Verification Plan
- Follow-up rewrite should verify with:
  - `rg -n "浏览器事件先直达目标 cell|server 直接把目标 pin 写到目标 cell" docs/user-guide docs/ssot`
  - `rg -n "bus_event_v2.*Model 0.*pin.bus.in|本地 UI 草稿|正式业务 ingress" docs/user-guide docs/ssot`
  - docs audit if available.

## Step 5 — Handoff
- Follow-up implementation is docs-only unless the rewrite exposes an executable contract mismatch.
- Any executable mismatch must become a new implementation iteration, not be silently patched inside the docs rewrite.
