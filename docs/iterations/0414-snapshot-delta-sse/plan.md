---
title: "Iteration 0414 Plan"
doc_type: iteration_plan
status: planned
updated: 2026-06-10
source: codex
---

# Iteration 0414 Plan

## 0. Metadata
- ID: 0414-snapshot-delta-sse
- Date: 2026-06-10
- Owner: Codex
- Branch: dropx/dev_0414-snapshot-delta-sse
- Related:
  - `docs/iterations/0412-app1-todo-latency-debug/`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/remote_store.js`

## 1. Goal
降低 UI Server 在滑动 App 交互后的前端刷新成本：在保留 `/snapshot` 全量恢复能力的前提下，让 `/stream` 优先发送带 `snapshot_seq` / `op_id` 的增量 `snapshot_patch`，客户端用 patch 局部更新当前 snapshot。

## 2. Background
0412 已确认当前成功 `bus_event_v2` 后不应立即同步拉完整 `/snapshot`，而应等待 SSE；但 SSE 当前仍发送完整 client snapshot。本地测得首个 SSE snapshot frame 约 576KB。随着模型、滑动 App、Matrix Chat 和文档 App 增多，完整 snapshot 的服务端序列化、网络传输和前端状态替换都会继续放大。

## 3. Invariants (Must Not Change)
- ModelTable 仍是正式状态唯一来源；前端 patch 只是 client-visible snapshot 的传输优化。
- UI 正式业务事件仍必须经 `/bus_event` -> Model 0 / pin bus / owner materialization，不得新增前端直写业务 label 的路径。
- `/snapshot` 必须继续返回完整、按 principal 过滤后的 client snapshot，用于首次加载、重连和恢复。
- principal 过滤、secret redaction、capability gate 必须和现有 `/snapshot` 语义一致；patch 不得泄漏全量 snapshot 中不可见的信息。
- 若客户端发现 patch 顺序缺口、base 不匹配或 patch 解析失败，必须回退拉取完整 `/snapshot`，不得静默显示错误状态。
- 不引入兼容旧违规数据链路；新增的是 transport optimization，不是新的业务写入合同。

## 4. Scope
### 4.1 In Scope
- 定义 client-visible snapshot envelope metadata：
  - `snapshot_seq`
  - `base_snapshot_seq`
  - `op_id`
  - `patch_kind`
- 服务端在 `/stream` 中新增 `snapshot_patch` 事件；初始连接仍发送完整 `snapshot`。
- 服务端基于“上一份已按当前 principal/capability 过滤后的 client snapshot”和“下一份已按同 principal/capability 过滤后的 client snapshot”生成 patch。
- 若 SSE client 的 principal/capability key 与该 client 的 baseline key 不一致，必须发送完整 `snapshot` reset 并替换 baseline；不得跨 principal/capability 生成 delete/replace patch。
- patch 最小粒度先支持：
  - replace/delete model
  - replace/delete cell
  - replace/delete label
  - replace `v1nConfig`
- 客户端 `remote_store` 支持接收并应用 `snapshot_patch`，且与 0412 的 `bus_event_last_op_id` fallback 取消逻辑协同。
- 增加 deterministic tests 覆盖 patch 生成、patch apply、SSE patch frame、小包尺寸和 fallback recovery。
- 更新 0414 runlog，记录真实命令、关键输出、本地部署和浏览器验证。

### 4.2 Out of Scope
- 不把所有运行时写入改成 patch 日志。
- 不改变 ModelTable 持久化、程序模型执行、pin payload 规约。
- 不在本迭代实现远端 MBR/MQTT/worker 链路延迟优化。
- 不做 WebSocket 替换；若 SSE patch 能满足当前目标，继续保留 SSE。
- 不重构 UI 模型组件或 To Do 业务返回内容。

## 5. Non-goals
- 不追求最优 diff 算法；以正确、安全、可恢复的 label/cell/model 级 patch 为优先。
- 不保证每个 patch 都比完整 snapshot 小；若变更过大或不适合 diff，服务端可发送完整 snapshot。
- 不改变首次加载必须获取完整 snapshot 的事实。

## 6. Success Criteria (Definition of Done)
- 服务端 `/stream` 初始事件仍是完整 `snapshot`，后续普通 label 级变化优先产生 `snapshot_patch`，且 patch 中包含 `snapshot_seq`、`base_snapshot_seq` 和可选 `op_id`。
- 客户端能应用 patch 并得到与完整 `/snapshot` 等价的可见状态；顺序缺口或 patch 失败时会主动拉完整 `/snapshot` 恢复。
- 0412 的成功 `bus_event_v2` 后 deferred fallback 只能在“应用后的可见 snapshot 中 `bus_event_last_op_id` 等于 expected op id”时取消；patch envelope 的 `op_id` 不能单独取消 fallback，stale/unrelated patch 不得误取消。
- 小型 label 更新的 SSE patch frame 明显小于完整 snapshot frame，并在 runlog 中记录对比数据。
- 本地部署成功，真实浏览器打开 `http://localhost:30900/#/` 后页面正常加载、无外层横向/纵向滚动、SSE patch 事件可被观察到或用脚本验证。
- 每个小阶段和最终整体均由 sub-agent 使用 `codex-code-review` 审查，阻塞项全部修复。

## 7. Risks & Mitigations
- Risk: patch 绕过 principal 过滤造成信息泄漏。
  - Impact: 已登录能力不同的客户端可能看到不该看到的 label。
  - Mitigation: 只对“已过滤后的 client snapshot”做 diff；每个 SSE client 按自己的 session/principal 保存 last snapshot。
- Risk: 同一个 SSE 连接内 principal/capability 降级后仍用旧 baseline 做 diff。
  - Impact: patch delete/replace path 可能暴露受限 model id、label key 或 capability-only 结构。
  - Mitigation: baseline 绑定 principal/capability key；key 变化时只发送完整 filtered snapshot reset，不发送跨 key patch。
- Risk: patch 顺序错乱导致前端状态漂移。
  - Impact: UI 显示旧状态或混合状态。
  - Mitigation: patch 带 `base_snapshot_seq`；客户端不匹配则拉完整 `/snapshot`。
- Risk: 变更过大时 diff 生成和应用成本高于完整 snapshot。
  - Impact: 优化反而拖慢大规模变化。
  - Mitigation: 设定 patch 操作数量/JSON 大小阈值，超过阈值则发送完整 `snapshot`。
- Risk: 0412 fallback 被 patch 事件错误取消。
  - Impact: 丢失可见更新后不再恢复。
  - Mitigation: 继续要求 patch 或 snapshot 中的 `bus_event_last_op_id` 与 expected op id 匹配。

## 8. Open Questions
None. 本迭代按“保留 SSE，改 full snapshot stream 为 patch-first stream”执行。

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/ui_to_matrix_event_flow.md`
  - `docs/ssot/tier_boundary_and_conformance_testing.md`
- Notes:
  - 本迭代只优化 client-visible projection 的 transport，不改变 ModelTable state ownership。
  - `/stream snapshot_patch` 是 client-visible transport contract，必须评估是否需要在 SSOT / user guide 中说明。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `CLAUDE.md`
  - `docs/WORKFLOW.md`
- Notes:
  - 先登记 iteration 和计划，review gate 通过后再实现。
  - 每个 step 后写 runlog，并用 sub-agent review。
