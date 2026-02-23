# Ops One-Click Commands

本文件是仓库内 **一键运维命令的知识库**（canonical entry）。

维护约定：
1. 当脚本参数、默认端口、依赖前置发生变化时，必须同步更新本文件。
2. 新增一键脚本时，必须在本文件追加“用途 + 命令 + PASS 判定”。
3. `README.md` 中的一键命令应保持与本文件一致。

---

## Model 100 Submit Roundtrip（一键）

用途：
- 在本地 UI Server 复现实例闭环：`Generate Color` 从 submit 到回包。
- 自动对齐 k8s（OrbStack）中的 Matrix room/token，避免 room mismatch。

命令：
```bash
bash scripts/ops/run_model100_submit_roundtrip_local.sh --port 9011 --stop-after
```

PASS 判定：
- baseline 5 个 deployment ready
- 本地 server Matrix connected（对齐 k8s room）
- 验证输出包含：
  - submit response `result=ok`
  - `loading/inflight=true -> processed/inflight=false`
  - final state `ready=true` 且 `ui_event_error=null`

---

## 拆分执行（调试用）

```bash
bash scripts/ops/check_runtime_baseline.sh \
&& bash scripts/ops/start_local_ui_server_k8s_matrix.sh --port 9011 --force-kill-port \
&& bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:9011
```

脚本说明：
- `start_local_ui_server_k8s_matrix.sh`：读取 k8s `mbr-worker-config/secret` 并启动本地 server。
- `verify_model100_submit_roundtrip.sh`：执行一次 submit 并轮询闭环状态。
- `run_model100_submit_roundtrip_local.sh`：一键串联上述流程。

---

## 0154 LLM Dispatch Roundtrip（一键）

用途：
- 验证 `0154` 的 LLM 增强路由闭环（规则命中 / LLM 高置信 / 低置信拒绝 / LLM 不可用降级）。
- 默认使用本地 mock ollama，确保示例命令可稳定复跑；可切换真实 Ollama。

命令（推荐，默认 mock）：
```bash
bash scripts/ops/run_0154_llm_dispatch_local.sh
```

命令（真实 Ollama）：
```bash
bash scripts/ops/run_0154_llm_dispatch_local.sh --real-ollama
```

PASS 判定：
- `docs_refresh_tree` 返回 `routed_by=rule`
- 未注册自然语言 action 返回 `routed_by=llm`
- 低置信度返回 `code=low_confidence` 且包含 `candidates`
- LLM 路由禁用/不可用时降级为 `unknown_action`

脚本说明：
- `mock_ollama_server.mjs`：确定性 mock（`/api/generate` / `/api/tags`）。
- `start_local_ui_server_with_ollama.sh`：注入 LLM 环境启动本地 UI server。
- `verify_llm_dispatch_roundtrip.sh`：执行 4 条验收用例并严格判定 PASS/FAIL。
- `run_0154_llm_dispatch_local.sh`：一键串联启动和验证（支持 `--real-ollama`）。

---

## 0155 Prompt FillTable Roundtrip（一键）

用途：
- 验证 `0155` Prompt FillTable 闭环：`Preview -> Apply -> Replay Guard -> Policy Reject`。
- 默认使用本地 mock ollama，确保无真实模型时也可复跑；可切换真实 Ollama。

命令（推荐，默认 mock）：
```bash
bash scripts/ops/run_0155_prompt_filltable_local.sh
```

命令（真实 Ollama）：
```bash
bash scripts/ops/run_0155_prompt_filltable_local.sh --real-ollama
```

命令（真实 Ollama + 指定模型标签）：
```bash
bash scripts/ops/run_0155_prompt_filltable_local.sh --real-ollama --llm-model qwen2.5:14b
```

PASS 判定：
- `llm_filltable_preview` 返回 `result=ok`，并生成非空 `llm_prompt_preview_id`
- `llm_filltable_apply` 返回 `result=ok`，且 `Model 100 title == "Prompt FillTable Demo"`
- 重复 apply 同一 `preview_id` 返回 `code=preview_replay`
- 负数模型记录在 apply 阶段被拒绝，返回 `code=apply_failed`

脚本说明：
- `verify_0155_prompt_filltable.sh`：执行 Preview/Apply/Replay/Reject 四段验收并严格判定 PASS/FAIL。
- `run_0155_prompt_filltable_local.sh`：一键串联 mock ollama + 本地 server 启动 + 0155 验证。
