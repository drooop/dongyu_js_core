---
title: "0337 — slide-flow-doc-realignment-implementation Plan"
doc_type: iteration-plan
status: approved
updated: 2026-04-26
source: ai
iteration_id: 0337-slide-flow-doc-realignment-implementation
id: 0337-slide-flow-doc-realignment-implementation
phase: phase3
---

# 0337 — slide-flow-doc-realignment-implementation Plan

## Goal
Implement the approved `0335-slide-flow-current-truth-realignment` by rewriting the developer-facing slide app process documentation around the current four-part flow.

## Scope
- In scope:
  - Rewrite the main slide delivery/runtime overview into four sections: 安装交付, App 结构, 页面运行, 外发回流.
  - Reuse existing zip import and Matrix delivery guidance where it is still current.
  - Remove or clearly mark obsolete wording that describes formal browser events as directly writing target cells.
  - Explicitly separate local UI draft / overlay from formal business ingress.
  - Add deterministic text checks for required current-truth wording and forbidden obsolete current wording.
- Out of scope:
  - Runtime behavior changes.
  - New slide installer APIs.
  - New Matrix / MQTT / MBR route behavior.

## Invariants / Constraints
- Current formal ingress is `bus_event_v2 -> Model 0 (0,0,0) pin.bus.in -> pin route -> target`.
- Local UI draft / overlay is not formal business truth.
- No doc may present server or frontend direct target-cell patching as the current formal business ingress.
- Lower-priority user-guide docs must not override `CLAUDE.md` or `docs/ssot/runtime_semantics_modeltable_driven.md`.

## Success Criteria
- The main slide overview has the four required sections and path descriptions.
- Obsolete direct-cell wording is absent from current user-guide/SSOT prose or clearly marked historical/superseded.
- A deterministic test covers required phrases and forbidden current wording.
- Documentation verification commands pass.

## Inputs
- Approved contract iteration: `docs/iterations/0335-slide-flow-current-truth-realignment/`
- Candidate files from 0335:
  - `docs/user-guide/slide_delivery_and_runtime_overview_v1.md`
  - `docs/user-guide/slide_app_zip_import_v1.md`
  - `docs/user-guide/slide_matrix_delivery_v1.md`
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
