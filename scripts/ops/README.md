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
