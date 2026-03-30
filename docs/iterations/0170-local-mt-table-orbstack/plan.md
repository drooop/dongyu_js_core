---
title: "Iteration 0170-local-mt-table-orbstack Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0170-local-mt-table-orbstack
id: 0170-local-mt-table-orbstack
phase: phase1
---

# Iteration 0170-local-mt-table-orbstack Plan

## Goal

- 在本机 Orbstack 上完整部署本地 stack，并以 `mt-table` 作为本地 Ollama 模型跑通 `prompt filltable` 的 preview/apply 与浏览器实测。
- 将本轮排障方法、约束与使用边界落盘到共享知识库，使其他协作者能够按文档复现 `mt-table` 驱动的生成流程。

## Scope

- In scope:
  - 本地 K8s/Orbstack 环境下的 `ui-server + remote-worker + mbr-worker + synapse` 联调。
  - `prompt filltable` 的 LLM 推理链路，包括 `server.mjs`、本地 deploy env、默认模型参数与实际 preview/apply 验证。
  - `remote-worker` 因 `mqtt_package_unavailable` 导致的本地 CrashLoop 回归修复。
  - 面向共享知识库与用户文档的 runbook/约束补充，特别是新规约下的“所有权链路”口径。
- Out of scope:
  - 远端 cloud deploy 与公网链路复验。
  - 与本轮无关的 UI/renderer 新功能扩展。
  - 恢复旧版 `op=add_label/remove_label` 直接改表语义。

## Invariants / Constraints

- `docs/architecture_mantanet_and_workers.md`、`docs/ssot/runtime_semantics_modeltable_driven.md`、`docs/ssot/host_ctx_api.md` 为语义 SSOT。
- `ctx` 和宿主能力不得绕过 ModelTable 直接触发副作用；新规约下的变更必须遵循所有权链路。
- 本地 LLM 功能以本机 Ollama `mt-table` 为准；若远端“本地环境”无 LLM 服务，禁用是正常行为，不作为失败判据。
- 先写 failing/guard test，再动运行时代码或部署默认值。
- 成功后必须评估并更新共享知识库与用户指南，不只停留在 runlog。

## Success Criteria

- 本地 `ui-server` 在 Orbstack 中读取 `DY_LLM_MODEL=mt-table`、`DY_LLM_MAX_TOKENS=512`、`DY_LLM_TIMEOUT_MS=120000`。
- `prompt filltable` 在本地 `preview -> apply` 路径可成功完成，不再出现 `filltable_json_parse_failed` 或 `mqtt_package_unavailable` 阻塞。
- 浏览器中至少完成一次本地 `mt-table` 相关功能实测，并保留截图/日志证据。
- 共享知识库中新增或更新一份可执行 runbook，清楚说明：
  - 如何在 Orbstack 使用 `mt-table`
  - 为什么不能再按旧 `op` 语义直接改模型表
  - 新规约下应如何通过 owner / hostApi / preview-apply 链路完成变更

## Inputs

- Created at: 2026-03-06
- Iteration ID: 0170-local-mt-table-orbstack
