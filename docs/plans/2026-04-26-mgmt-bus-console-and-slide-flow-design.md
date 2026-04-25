---
title: "Mgmt Bus Console And Slide Flow Design"
doc_type: plan
status: approved
updated: 2026-04-26
source: ai
---

# Mgmt Bus Console And Slide Flow Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the approved management bus console surface and align slide app process docs with the current Model 0 ingress truth.

**Architecture:** The console is a positive `model.table` projected through `cellwise.ui.v1`; it stores only local UI state and sends formal actions through `bus_event_v2` into `Model 0 pin.bus.in`. The slide docs are rewritten as a current-truth developer guide, separating installation, app structure, page runtime, and egress/return flow.

**Tech Stack:** ModelTable JSON records, Node deterministic tests, Vue frontend renderer, local Workspace runtime.

---

## Design Decisions

- Use model id `1036` for `Mgmt Bus Console` because current positive ids end at `1035`.
- Build the first console from existing components: `Container`, `Card`, `Tabs`, `Table`, `Terminal`, `Input`, `Button`, `StatusBadge`.
- Do not copy Matrix room state, Model 0 route labels, or MBR truth into the console model. Store only UI-facing state such as selected subject, draft text, and inspector text.
- Treat formal send as a ModelTable record-array payload. If the renderer cannot express this today, add a generic `bind.write.bus_event_v2` contract instead of hard-coding the console.
- Rewrite slide process docs around four sections: 安装交付, App 结构, 页面运行, 外发回流.
- Mark or remove older direct-target-cell language whenever it describes current formal business ingress.

## Alternatives Considered

- Hard-code a new management page in the frontend. Rejected because it bypasses the model-table UI direction.
- Add dedicated `RoomList` / `EventTimeline` components immediately. Deferred because the approved contract says existing cellwise components should be tried first.
- Keep the old slide runtime prose and add a short warning. Rejected because it would continue mixing local UI draft behavior with formal business ingress.
