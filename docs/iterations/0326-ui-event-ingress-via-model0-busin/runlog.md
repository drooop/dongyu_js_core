---
title: "0326 — ui-event-ingress-via-model0-busin Runlog"
doc_type: iteration-runlog
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0326-ui-event-ingress-via-model0-busin
id: 0326-ui-event-ingress-via-model0-busin
phase: phase1
---

# 0326 — ui-event-ingress-via-model0-busin Runlog

## Environment

- Date: 2026-04-21
- Branch: `dev_0326-ui-event-ingress-via-model0-busin`
- Runtime: phase1 planning; execution pending phase2 Approved + 0324 + 0325 已 merged

## Planning Record

### Record 1 — Initial (2026-04-21)

- Inputs reviewed:
  - 0323 resolution 第 1 / 3 条（事件传输链 + 双总线链路）
  - 0323 runlog "Model 0 mt_bus_send 上行后的外发机制" 延后项
  - `packages/ui-model-demo-server/server.mjs` 现有 `/ui_event` + `submitEnvelope` + `processEventsSnapshot`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - 0321 + 0322 ingress/egress adapter 代码
  - memory `project_0323_implementation_roadmap.md`
- Locked conclusions:
  - envelope 新 shape：`{type:'ui_event_v2', bus_in_key, value, meta}`
  - 前端事件必经 Model 0 pin.bus.in
  - mt_bus_receive + mt_bus_send 业务在本迭代填（0324 只种骨架）
  - Matrix publish 走 tier 2 programEngine 路径；mt_bus_send on Model 0 只写 pin.bus.out
  - mailbox Model -1 UI 事件第一落点彻底删除
  - 与 0319 Superseded rewrite 同窗口 merge

## Review Gate Record

### Review 1 — pending

- Iteration ID: `0326-ui-event-ingress-via-model0-busin`
- Review Date: pending
- Review Type: User
- Review Index: 1
- Decision: pending
- Notes: 与 0319-Superseded / 0324 / 0325 / 0327 batch phase2 review

## Execution Records

### Step 1

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 2

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 3

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 4

- Command:
- Key output:
- Adapter 简化决策: (待填 — 选 A 还是 B)
- Result: PASS/FAIL
- Commit:

### Step 5

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 6

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

### Step 7

- Command:
- Key output:
- Result: PASS/FAIL
- Commit:

## Docs Updated

- [ ] `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` — §3-§9 统一 ingress/egress 链
- [ ] `docs/user-guide/slide_delivery_and_runtime_overview_v1.md` — §3 改写
- [ ] `docs/iterations/0319-slide-overview-gap-closure/` Superseded rewrite merge 与本迭代同窗口
