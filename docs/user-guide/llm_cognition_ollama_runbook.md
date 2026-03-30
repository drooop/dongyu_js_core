---
title: "LLM Cognition Ollama Runbook"
created: 2026-02-24
updated: 2026-03-21
tags:
  - dongyu
  - runbook
  - llm
  - ollama
doc_type: user-guide
status: active
source: ai
---

# LLM Cognition Ollama Runbook

## 1. 目的

覆盖两条已经实测过的本地 LLM 链路：
- `0154-llm-cognition-ollama`：规则命中 / LLM 辅助路由 / 低置信度拒绝 / degrade。
- `0170-local-mt-table-orbstack`：Orbstack + 本机 Ollama `mt-table` 的 `prompt filltable preview/apply`。

`0154` 的核心链路：
- 规则命中 action 走 `rule` 路径（不经 LLM）。
- 未命中 action 由 LLM 辅助匹配并路由（`routed_by=llm`）。
- 低置信度拒绝执行并返回候选（`low_confidence`）。
- LLM 路由不可用或禁用时自动降级（`unknown_action`）。

关联：
- [[docs/ITERATIONS|迭代索引]]
- [[docs/iterations/0154-llm-cognition-ollama/plan|0154 plan]]
- [[docs/iterations/0154-llm-cognition-ollama/runlog|0154 runlog]]
- [[docs/iterations/0170-local-mt-table-orbstack/plan|0170 plan]]
- [[docs/iterations/0170-local-mt-table-orbstack/runlog|0170 runlog]]
- [[scripts/ops/README|ops 一键命令总表]]
- [[docs/user-guide/filltable_capability_matrix|FillTable Capability Matrix]]
- [[docs-shared/engineering/local-orbstack-ollama-runbook|共享知识库：通用 Orbstack/Ollama 方法]]

## 2. 一键命令

`0154` 默认（推荐，mock ollama，稳定可复跑）：

```bash
bash scripts/ops/run_0154_llm_dispatch_local.sh
```

`0154` 真实 Ollama：

```bash
bash scripts/ops/run_0154_llm_dispatch_local.sh --real-ollama
```

`0170` Orbstack + `mt-table`：

```bash
bash scripts/ops/deploy_local.sh
bash scripts/ops/check_runtime_baseline.sh
bash scripts/ops/verify_0155_prompt_filltable.sh --base-url http://127.0.0.1:30900
```

如果需要从本机起一个独立的本地 server，而不是直接复用 Orbstack 中的 `ui-server`：

```bash
bash scripts/ops/create_mt_label_qwen35.sh
bash scripts/ops/run_0155_prompt_filltable_local.sh --real-ollama --llm-model mt-label
```

`0188` 当前推荐：`mt-label` 由本机 `qwen3.5:9b` 构建，保留 owner-chain prompt contract，但额外收紧了 JSON-only / no-tool-call 输出约束。

`0188` 之后，能力回归不再只看单条 `0155`。更完整的自然语言填表回归入口：

```bash
bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label
bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label-35b
```

## 3. PASS 判定

### 3.1 `0154`

脚本输出 `PASS` 且包含以下判定：
1. `docs_refresh_tree` 返回 `routed_by=rule`。
2. 未注册自然语言 action 返回 `routed_by=llm`。
3. 低置信度返回 `code=low_confidence`，并带 `candidates`。
4. LLM 路由禁用或 endpoint 不可用时，降级返回 `code=unknown_action`。

### 3.2 `0170`

脚本输出 `PASS` 且包含以下判定：
1. Orbstack baseline ready：`mosquitto/synapse/remote-worker/mbr-worker/ui-server` 全部 `readyReplicas=1`。
2. `llm_filltable_preview` 返回 `result=ok`，并生成非空 `llm_prompt_preview_id`。
3. `llm_filltable_apply` 返回 `result=ok`。
4. replay guard 返回 `code=preview_replay`。
5. 非法 preview 或超限 preview 仍会被策略拒绝。

浏览器实测的可见状态：
- `preview ready (confirm then apply): accepted=... rejected=...`
- `apply done: applied=... rejected=...`

## 4. 拆分执行（调试）

### 4.1 `0154`

```bash
node scripts/ops/mock_ollama_server.mjs 11435 &
bash scripts/ops/start_local_ui_server_with_ollama.sh \
  --port 9012 \
  --llm-base-url http://127.0.0.1:11435 \
  --force-kill-port
bash scripts/ops/verify_llm_dispatch_roundtrip.sh --base-url http://127.0.0.1:9012
```

### 4.2 `0170`

前提：
- `kubectl config current-context` 必须是 `orbstack`
- `ollama list` 必须能看到 `mt-table:latest`

```bash
bash scripts/ops/deploy_local.sh
bash scripts/ops/check_runtime_baseline.sh

# 直接使用 Orbstack 暴露的 ui-server
bash scripts/ops/verify_0155_prompt_filltable.sh --base-url http://127.0.0.1:30900
```

浏览器路径：

```text
http://127.0.0.1:30900/#/prompt
```

如需查看当前 `ui-server` 的 LLM 环境：

```bash
kubectl -n dongyu exec deploy/ui-server -- sh -lc \
  'echo MODEL=$DY_LLM_MODEL BASE=$DY_LLM_BASE_URL TIMEOUT=$DY_LLM_TIMEOUT_MS TOKENS=$DY_LLM_MAX_TOKENS'
```

## 5. 经验与约束（0170）

### 5.1 本地默认值

- `DY_LLM_MODEL=mt-label`
- `DY_LLM_MAX_TOKENS=1024`
- `DY_LLM_TIMEOUT_MS=180000`
- `DY_LLM_BASE_URL=http://host.docker.internal:11434`

`0188` 的本地推荐建模命令：

```bash
bash scripts/ops/create_mt_label_qwen35.sh
```

生成后的 `mt-label` 事实上是：
- `FROM qwen3.5:9b`
- `temperature=0.1`
- `top_p=0.9`
- `top_k=40`
- 附带 JSON-only / no-tool-call system prompt

如需 35B 版本：

```bash
bash scripts/ops/create_mt_label_qwen35.sh --modelfile scripts/ops/mt-label-qwen35-35b-a3b.Modelfile mt-label-35b
```

### 5.2 Warm-up 现象

`mt-table` 对完整 filltable prompt 的单次生成耗时很长。`0170` 的直接实测里：
- 等价 full prompt 直连 Ollama，单次约 `1:33.89`
- 首轮 `verify_0155_prompt_filltable.sh --base-url http://127.0.0.1:30900` 返回过 `llm_timeout`
- 紧接着 warm 后复跑，同一脚本完整 PASS

结论：
- 本地 `mt-table` 链路可跑通
- 但不是“稳定秒回”
- runbook 必须把 cold start / warm-up 记为已知现象，而不是当作偶发噪音忽略

### 5.3 正式口径：owner-chain，不是 records bridge

当前 `server.mjs` 的 `llmFilltablePreview / llmFilltableApply` 已切到 owner-chain：
- LLM 输出 `proposal + candidate_changes`
- preview 返回 `accepted_changes / rejected_changes / owner_plan`
- apply 只消费 `accepted_changes` 并回写 `applied_changes`
- 旧的 records-only preview payload 会被显式拒绝（`legacy_preview_contract`）

这条链路现在既适合：
- 本地验证 `mt-label(qwen3.5:9b)` 是否能理解 owner-chain prompt
- 调试 `filltable_policy`、preview/apply guard 与 owner materialization
- 按能力矩阵验证“字段映射 / query-only / parent-child blocked / clarification”是否稳定

也可以作为对外说明的正式接口口径。生成动作应遵循：
1. UI / caller 提交 prompt，只请求 preview
2. 宿主解析 LLM 的 `candidate_changes`
3. owner 侧校验、翻译并决定是否 materialize 具体写入
4. apply 只执行 owner 已确认的变更
5. 真实写表仍由 owner 触发；`add_label/remove_label` 只保留在宿主内部执行层

如果要对外说明“如何利用本地 LLM 做生成动作”，必须强调：
- LLM 不直接拥有模型表写权限
- owner-chain 才是新版规约下的正式 authoring contract

## 6. 维护约定（后续迭代沿用）

1. 新增或修改一键命令时，同步更新 `scripts/ops/README.md` 与本 runbook。
2. 任何命令默认需给出可复跑 PASS 判定（明确字段，不用“看起来正常”）。
3. 若命令依赖环境（例如 Ollama 模型、OrbStack/K8s），必须提供最小可运行 fallback（例如 mock 模式）。

## 7. 文档边界

- 通用环境方法放共享知识库 `engineering/local-orbstack-ollama-runbook.md`。
- 本文只保留本项目的：
  - 脚本入口
  - 默认值
  - PASS 判定
  - `mt-table` 与 owner-chain 的项目口径
