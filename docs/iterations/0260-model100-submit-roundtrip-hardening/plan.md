---
title: "Iteration 0260-model100-submit-roundtrip-hardening Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0260-model100-submit-roundtrip-hardening
id: 0260-model100-submit-roundtrip-hardening
phase: phase1
---

# Iteration 0260-model100-submit-roundtrip-hardening Plan

## Goal

- 让颜色生成器（Model 100）重新符合当前 hard-cut 主线：
  - 浏览器按钮可点击
  - submit 去程/回程按正式链路执行
  - remote-worker patch 自身符合当前 pin / submt / scoped privilege 规约
  - `bg_color / status / scene_context / action_lifecycle` 一致
  - 具备本地 live 浏览器证据

## Scope

- In scope:
  - `submit` 的 authoritative server routing
  - stale `submit_inflight` recovery
  - remote-worker patch 对当前 runtime 语义的规约一致性修复
  - `patch` / `patch_out` return-path contract 对齐
  - local live browser proof
- Out of scope:
  - 远端环境
  - 非 Model 100 的业务页面
  - 新架构扩展讨论

## Invariants / Constraints

- 不允许 direct business-state write 绕过正式链路。
- 颜色生成器修复必须与当前 hard-cut 主线一致，不能回退到旧兼容方案。
- 不允许为了临时跑通而放宽 scoped privilege 或恢复旧时代的跨层直写。
- remote-worker / mbr / local server 三段都必须服从同一套 topic、pin 和权限合同。
- 浏览器是否通过必须以真实页面和 `/snapshot` 同时判定。
- local / isolated / live 三层行为必须一致，不能只修其中一层。

## Success Criteria

- `Generate Color` 在本地 live 页面可点击，不再因陈旧 inflight 卡死。
- submit 不再被 server 误路由到 home/llm dispatch。
- remote-worker 收到 `/100/event` 后，不再因 `direct_access_privilege_required` 卡死。
- return path topic 口径收敛，`patch` / `patch_out` 不再漂移。
- remote-worker / records-only E2E contract 恢复 PASS。
- 点击后可观察到：
  - `bg_color` 改变
  - `status=processed`
  - `submit_inflight=false`
  - `scene_context` / `action_lifecycle` 有一致进展
- 本地 `30900` 浏览器证据落盘。

## Inputs

- Created at: 2026-03-29
- Iteration ID: 0260-model100-submit-roundtrip-hardening
