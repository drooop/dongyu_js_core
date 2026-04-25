---
title: "0335 — slide-flow-current-truth-realignment Run Log"
doc_type: iteration-runlog
status: planned
updated: 2026-04-26
source: ai
iteration_id: 0335-slide-flow-current-truth-realignment
id: 0335-slide-flow-current-truth-realignment
phase: phase1
---

# 0335 — slide-flow-current-truth-realignment Run Log

规则：只记事实（FACTS）。不要写愿景。此 iteration 当前只落 planning / documentation-realignment 文档，不改用户指南正文。

## Environment
- Date: `2026-04-26`
- Branch: `dev_0331-0333-pin-payload-ui`
- Runtime: local macOS, repo `/Users/drop/codebase/cowork/dongyuapp_elysia_based`

## Planning Record
- User requested the slide process be reorganized into 4 parts:
  - 安装交付
  - App 结构
  - 页面运行
  - 外发回流
- User specified the correction:
  - older docs saying “浏览器事件先直达目标 cell” conflict with higher-priority current rules and 0326 tests.
  - future docs must distinguish local UI draft from formal business ingress.
- Repository search found the obsolete current wording in `docs/user-guide/slide_delivery_and_runtime_overview_v1.md`.

## Commands Executed
- `rg -n "滑动|slide app|安装交付|materialize|pin\\.bus\\.in|浏览器事件|direct|直达|正式业务 ingress|Model 0" docs/iterations docs/ssot docs/user-guide | head -200`
- `sed -n '1,220p' docs/user-guide/slide_delivery_and_runtime_overview_v1.md`
- `sed -n '1,130p' docs/user-guide/slide_app_zip_import_v1.md`

## Key Findings
- `slide_delivery_and_runtime_overview_v1.md` already has useful installation and structure content.
- Its runtime-trigger section still says browser events first reach the target cell directly.
- `runtime_semantics_modeltable_driven.md` already states the current ingress path through `Model 0 pin.bus.in`.

## Verification
- Documentation planning only; final repository checks cover formatting and commit readiness.
