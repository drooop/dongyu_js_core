# Ops One-Click Commands

本文件是仓库内 **一键运维命令的知识库**（canonical entry）。

维护约定：
1. 当脚本参数、默认端口、依赖前置发生变化时，必须同步更新本文件。
2. 新增一键脚本时，必须在本文件追加“用途 + 命令 + PASS 判定”。
3. `README.md` 中的一键命令应保持与本文件一致。

## 导航入口

若你先需要理解正式口径，再回来找命令：
- Prompt FillTable 的 owner-chain 说明：`docs/user-guide/prompt_filltable_owner_chain_and_deploy.md`
- ModelTable 用户口径：`docs/user-guide/modeltable_user_guide.md`
- 本项目 LLM / `mt-table` 本地 runbook：`docs/user-guide/llm_cognition_ollama_runbook.md`

若你已经明确要执行命令，本文件就是唯一 canonical 入口。

---

## Ops Task Surface（0226 contract freeze）

用途：
- 作为 orchestrator `ops_task` 可引用的 canonical shell surface 知识库。
- 为 `0227-0230` 提供统一术语：哪些脚本族允许进入 `ops_task`、何时必须先过 remote safety gate、哪些远端动作必须 stop。

当前边界：
- 0228 runtime 已接线：orchestrator 当前会把 `ops_task` authoritative ingest 到 `state.json` / `events.jsonl` / `status.txt` / `runlog.md`
- 0229/0230 只负责真实 shell smoke，不再补 phase contract
- 真实 shell smoke 仍尚未证明；当前 README 只说明已落地的 phase/runtime 能力边界，不把 0229/0230 的 smoke 结论提前写成已完成

canonical command families：
- local readonly baseline / readiness：
  - `bash scripts/ops/check_runtime_baseline.sh`
- local mutating deploy / ensure：
  - `bash scripts/ops/ensure_runtime_baseline.sh`
  - `bash scripts/ops/deploy_local.sh`
- remote readonly preflight / source gate：
  - `bash scripts/ops/remote_preflight_guard.sh`
  - `bash scripts/ops/remote_preflight_guard.sh --print-socket`
  - cloud deploy 内建 source integrity gate（`deploy_cloud_full.sh` / `deploy_cloud_app.sh`）
- remote mutating whitelist rollout：
  - `bash scripts/ops/sync_cloud_source.sh ...`
  - `sudo bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh --rebuild`
  - `sudo bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_app.sh --target <app> --revision <rev>`

`ops_task` canonical path 读法：
- orchestrator 只接收 machine-readable `ops_task`
- `request.json` / `result.json` / `stdout.log` / `stderr.log` / `artifacts/` 的 canonical 路径统一在：
  - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/`
- `ops_task.required_artifacts[]` 只声明文件名与 `media_type`；canonical 路径由 orchestrator materialize

remote safety gate（强制）：
- 任何 remote mutating `ops_task` 在执行前都必须先过 `remote_preflight_guard.sh`
- 若 `remote_preflight_guard.sh` 失败、rke2 判定失败、containerd socket 不可达、root/权限不足，必须以 `remote_guard_blocked` 收口，不得继续执行 mutating op
- `deploy_cloud_full.sh` / `deploy_cloud_app.sh` 额外自带 source integrity gate；若 source gate 失败，同样不能继续 rollout
- 若 request 在 preflight 就命中 `kubectl delete namespace` / `helm uninstall`，orchestrator 必须进入 `human_decision_required` / `On Hold`，不得 materialize/execute 该 `ops_task`

forbidden / critical-risk remote 边界：
- `forbidden_remote_op`：
  - `k3s`
  - `systemctl start|stop|restart|enable|disable` on `rke2` / `k3s` / `containerd` / `docker` / `sshd` / `networking`
  - 修改 `/etc/rancher/`
  - 修改 CNI、防火墙、网络接口
- `human_decision_required` / `On Hold`：
  - `kubectl delete namespace`
  - `helm uninstall`
  - 任何会影响其他 namespace 或 cluster-wide resources 的操作
- 这些 stop rules 来自 `CLAUDE.md` + `docs/ssot/orchestrator_hard_rules.md`；executor 不得自行把它们降级为 warning 或 `nonzero_exit`

---

## Cloud Remote RKE2 Gate（强制前置）

用途：
- 在远端部署前强制校验目标环境仍是 `rke2`，避免误入 `k3s`/错误 socket/权限不满足场景。
- 该 Gate 已接入 `scripts/ops/deploy_cloud.sh`，未通过时会直接中断部署。

命令（手动预检）：
```bash
bash scripts/ops/remote_preflight_guard.sh
```

命令（只输出检测到的 containerd socket）：
```bash
bash scripts/ops/remote_preflight_guard.sh --print-socket
```

PASS 判定：
- `kubectl get nodes` 可达且节点版本含 `+rke2`
- `k3s` service 非 active
- `ctr --address <socket> -n k8s.io version` 可连通

---

## Cloud Deploy Source Integrity Gate（强制）

用途：
- 防止“远端部署成功但镜像仍含旧前端/旧服务代码”。
- 将 cloud deploy 的构建源固定为 canonical 路径，并在 rollout 后校验容器内源码哈希。

已接入脚本：
- `scripts/ops/deploy_cloud_full.sh`
- `scripts/ops/deploy_cloud_app.sh`

Gate 内容：
1. 单一构建源校验：`k8s/Dockerfile.ui-server` 为唯一基准。若存在 `Dockerfile.ui-server` 且哈希不一致，直接失败。
2. Shadow manifest 漂移校验：若存在仓库根 `workers.yaml` 且与 `k8s/cloud/workers.yaml` 不一致，直接失败。
3. 源码指纹采集：部署前记录以下文件 SHA256：
   - `packages/ui-model-demo-server/server.mjs`
   - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
   - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
4. rollout 后容器源码验收：比较 pod 内同路径文件 SHA256，任一不一致即失败。
5. Prompt UI Guard 验收：检查 pod 内前端代码存在 `llmPromptAvailable` 与 `txt_prompt_unavailable` marker。

命令（远端 root，full deploy）：
```bash
sudo bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh
```

命令（远端 root，app fast deploy）：
```bash
sudo bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_app.sh --target ui-server
```

说明：
- `deploy_cloud.sh` 现仅作为兼容 wrapper，内部委托给 `deploy_cloud_full.sh`。
- `deploy_cloud_app.sh` 只允许目标集：`ui-server | mbr-worker | remote-worker`。

---

## Cloud Remote Build（推荐）

用途：
- 当前无私有镜像仓库时的 canonical cloud deploy 路径。
- 先同步目标 revision 到远端，再由远端本机 `docker build`，最后本机 `docker save | ctr import -` 导入 `rke2`。
- 避免继续走 `scp` 大 tar 主路径。

命令（先同步源码）：
```bash
bash scripts/ops/sync_cloud_source.sh \
  --ssh-user drop \
  --ssh-host 124.71.43.80 \
  --remote-repo /home/wwpic/dongyuapp \
  --remote-repo-owner wwpic \
  --revision "$(git rev-parse --short HEAD)"
```

命令（在远端主机上执行 full deploy）：
```bash
sudo bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh --rebuild
```

命令（在远端主机上执行 app fast deploy）：
```bash
sudo bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_app.sh --target ui-server --revision "$(git rev-parse --short HEAD)"
```

PASS 判定：
- `remote_preflight_guard.sh` PASS
- 远端 `rke2` 集群中的 MQTT broker 已就绪
- 目标 deployment rollout 成功
- source hash gate 通过
- 目标环境验收命令 PASS

说明：
- canonical SSH deploy user 是 `drop`，不是 `wwpic`。
- canonical remote repo 路径保持 `/home/wwpic/dongyuapp`，source sync 通过 `drop + sudo -u wwpic` 代持写入。
- 如果仍通过受限 sudo wrapper 远程触发部署，需要同步更新远端 wrapper / sudoers 白名单，使其允许新入口脚本。
- 本地 OrbStack baseline 与 cloud baseline 的 MQTT 拓扑不同：
  - 本地 `k8s/local/workers.yaml` 使用 `mosquitto.dongyu.svc.cluster.local`
  - 远端 `k8s/cloud/workers.yaml` 使用 `emqx-emqx-enterprise.emqx.svc.cluster.local`
  - 远端 `EMQX` 位于 `emqx` namespace，不在 `dongyu` namespace
  - `deploy_cloud_full.sh` / `deploy_cloud_app.sh` 默认假定远端 EMQX 已存在，不负责创建 broker

---

## Cloud Local-Build + Remote-Import（fallback only）

用途：
- 仅用于远端无法 build、wrapper 仍只允许旧入口、或离线构件交付等 fallback 场景。
- 不再是推荐主路径。

命令：
```bash
bash scripts/ops/deploy_cloud_ui_server_from_local.sh \
  --ssh-user drop \
  --ssh-host 124.71.43.80 \
  --remote-repo /home/wwpic/dongyuapp \
  --remote-repo-owner wwpic
```

说明：
- 脚本会本地 build/save，scp tar 到远端，并通过 `sudo DEPLOY_SOURCE_REV=<local_git_rev> deploy_cloud.sh --image-tar ...` 触发部署。
- 远端源码同步已统一委托给 `sync_cloud_source.sh`，因此同样遵循 `drop` 登录、`/home/wwpic/dongyuapp` 路径、`sudo -u wwpic` 代持写入。

PASS 判定：
- 远端 `ui-server` rollout 成功；
- `deploy_cloud.sh` 的源码哈希 gate 与 Prompt UI guard gate 全部通过。

---

## Model 100 Submit Roundtrip（OrbStack pod，推荐）

用途：
- 以 OrbStack pod 部署路径验证 `Generate Color` 从 submit 到回包。
- 当前 `0175` 的 canonical 验证口径是 `http://127.0.0.1:30900`，不是 host-side `9011` 临时 server。

命令：
```bash
bash scripts/ops/ensure_runtime_baseline.sh \
&& bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900
```

PASS 判定：
- baseline 5 个 deployment ready
- 验证输出包含：
  - submit response `result=ok`
  - `loading/inflight=true -> processed/inflight=false`
  - final state `ready=true` 且 `ui_event_error=null`

---

## Host-side 9011 路径（调试用，非 canonical）

用途：
- 在主机侧临时启动 `ui-server`，复用 `MODELTABLE_PATCH_JSON` 进行 debug。
- 该路径依赖 host 到 Matrix plane 的可达性，不作为 `0175` 的完成口径。

```bash
bash scripts/ops/ensure_runtime_baseline.sh \
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
- `0188` 起，推荐真实本地模型为 `mt-label`，其底座由 `qwen3.5:9b` 构建。
- `0188` 起，schema-aware prompt 已要求优先命中现有字段，并在不确定时先提问。

命令（推荐，默认 mock）：
```bash
bash scripts/ops/run_0155_prompt_filltable_local.sh
```

命令（真实 Ollama）：
```bash
bash scripts/ops/run_0155_prompt_filltable_local.sh --real-ollama
```

命令（先创建本地 `mt-label`）：
```bash
bash scripts/ops/create_mt_label_qwen35.sh
```

命令（真实 Ollama + 指定模型标签）：
```bash
bash scripts/ops/run_0155_prompt_filltable_local.sh --real-ollama --llm-model mt-label
```

命令（真实 Ollama + 35B 变体）：
```bash
bash scripts/ops/run_0155_prompt_filltable_local.sh --real-ollama --llm-model mt-label-35b
```

PASS 判定：
- `llm_filltable_preview` 返回 `result=ok`，并生成非空 `llm_prompt_preview_id`
- `llm_filltable_apply` 返回 `result=ok`，且 `Model 100 title == "Prompt FillTable Demo"`
- 重复 apply 同一 `preview_id` 返回 `code=preview_replay`
- 负数模型记录在 apply 阶段被拒绝，返回 `code=apply_failed`

脚本说明：
- `verify_0155_prompt_filltable.sh`：执行 Preview/Apply/Replay/Reject 四段验收并严格判定 PASS/FAIL。
- `run_0155_prompt_filltable_local.sh`：一键串联 mock ollama + 本地 server 启动 + 0155 验证。
- `create_mt_label_qwen35.sh`：用 `qwen3.5:9b` + 结构化输出参数创建本地 `mt-label`。

---

## 0188 FillTable Capability Matrix（一键）

用途：
- 按固定能力表回归自然语言填表，而不是只跑单一 `0155` 用例。
- 支持全量执行，也支持按 capability subset / scenario id 执行。
- 覆盖：基础写入、表单字段映射、query-only、父子模型负例、需要澄清时先提问。

命令（全量，9B）：
```bash
bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label
```

命令（全量，35B）：
```bash
bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label-35b
```

35B 预热说明：
- `mt-label-35b` 在本地 Ollama 下首轮 cold load 可能明显慢于 `mt-label`，症状通常是 runner 长时间停在第一个 preview 前。
- 若需要更稳定地执行 35B 验证，先手动把模型挂上，再跑 matrix：
```bash
ollama run mt-label-35b "{}"
```
- 看到一次最小响应后，再执行：
```bash
bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label-35b --tag forms
```
- 2026-03-17 本地实测：先挂载后，请假/报修两个 forms 场景 `passed=2 failed=0`。

命令（按 tag 子集）：
```bash
bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label --tag forms
bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label --tag structure
```

命令（按 scenario id）：
```bash
bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label --scenario leave_form_model1001_exact_mapping
```

PASS 判定：
- runner JSON summary 中 `failed=0`
- `leave_form_model1001_exact_mapping` 必须命中 `applicant/leave_type/days/reason`
- `repair_form_model1002_exact_mapping` 必须命中 `device_name/location/urgency/description`
- `parent_child_submodel_model11_blocked` 在当前 policy 下必须 blocked，不能创建 `Model11`

脚本说明：
- `filltable_capability_cases.mjs`：能力矩阵、标签、prompt 与断言的单一事实源。
- `run_filltable_capability_matrix.mjs`：对已有 server 执行 scenario 并产出 JSON report。
- `run_filltable_capability_matrix_local.sh`：本地启动 server、warm up 模型、执行矩阵并自动回收进程。
- `docs/user-guide/filltable_capability_matrix.md`：人类可读版能力表与选择方式。

---

## 0170 Local Orbstack + `mt-table` Prompt FillTable（实测）

用途：
- 在 Orbstack baseline 已就绪的前提下，直接验证本地 `ui-server` 通过本机 Ollama `mt-table` 跑通 `prompt filltable`。
- 该路径对应 `0170-local-mt-table-orbstack` 的实测方法。

命令：
```bash
bash scripts/ops/deploy_local.sh
bash scripts/ops/check_runtime_baseline.sh
bash scripts/ops/verify_0155_prompt_filltable.sh --base-url http://127.0.0.1:30900
```

PASS 判定：
- `check_runtime_baseline.sh` 输出 5 个 deployment 全部 ready。
- `verify_0155_prompt_filltable.sh` 输出：
  - `preview_response ... result:"ok"`
  - `apply_response ... result:"ok"`
  - `replay_response ... code:"preview_replay"`
  - `legacy_response ... code:"legacy_preview_contract"`
  - `too_many_changes_response ... code:"too_many_changes"`
  - `[verify-0155] PASS`

实测经验：
- 本地 `ui-server` 默认值：
  - `DY_LLM_MODEL=mt-table`
  - `DY_LLM_MAX_TOKENS=1024`
  - `DY_LLM_TIMEOUT_MS=180000`
- `mt-table` 首轮 full prompt 可能出现 warm-up 超时；`0170` 中观察到：
  - 首轮 `verify_0155` 曾返回 `llm_timeout`
  - 紧接着复跑同一命令即可 PASS
- 该现象说明链路可用，但推理不是“稳定秒回”。

边界说明：
- 当前 preview/apply 已切到 owner-chain 公共合同：
  - preview 产出 `accepted_changes` / `rejected_changes`
  - apply 回写 `applied_changes`
- `add_label` / `rm_label` 仅作为 owner 内部 materialization 细节，不再直接暴露给 LLM。

---

## Obsidian Docs Migration（一键）

用途：
- 将 `docs/`（Obsidian vault）批量规范为 Obsidian 友好格式：
  - 补齐 frontmatter（`title/doc_type/status/updated/source`）
  - 内部 `.md` 链接尽量转换为 wikilink（跳过外链、图片、代码块）

命令（先审计）：
```bash
node scripts/ops/obsidian_docs_audit.mjs --root docs
```

命令（共享知识库审计）：
```bash
node scripts/ops/obsidian_docs_audit.mjs --root docs-shared
```

命令（先 dry-run，再 apply）：
```bash
node scripts/ops/obsidian_docs_migrate.mjs --root docs --phase all
node scripts/ops/obsidian_docs_migrate.mjs --root docs --phase all --apply
```

命令（共享知识库迁移，自动补 `project`）：
```bash
node scripts/ops/obsidian_docs_migrate.mjs --root docs-shared --project dongyuapp --apply
```

命令（分批执行，推荐）：
```bash
# Phase A
node scripts/ops/obsidian_docs_migrate.mjs --root docs --phase A --apply
# Phase B
node scripts/ops/obsidian_docs_migrate.mjs --root docs --phase B --apply
```

完成后复检：
```bash
node scripts/ops/obsidian_docs_audit.mjs --root docs
```

脚本说明：
- `obsidian_docs_migrate.mjs`：迁移脚本（默认 dry-run，`--apply` 才写文件）。
- `obsidian_docs_audit.mjs`：审计脚本（frontmatter 完整度 + wikilink/残留 md 链接统计）。

---

## Obsidian Docs Pre-commit Gate（只审计）

用途：
- 在 commit 前阻断不合规文档进入仓库（只审计，不自动改写文件）。
- 检查 `docs/` 与 `docs-shared/` 的 frontmatter 完整性与残留 `.md` 链接问题。

默认行为：
- `.githooks/pre-commit` 每次提交都会执行：
```bash
node scripts/ops/validate_obsidian_docs_gate.mjs
```
- `ft` 分支仍会继续执行 Fill-Table-Only staged 校验（原逻辑不变）。

本地手动执行：
```bash
node scripts/ops/validate_obsidian_docs_gate.mjs
```

临时跳过（仅当前命令）：
```bash
SKIP_OBSIDIAN_DOCS_AUDIT=1 git commit -m "..."
```

---

## Obsidian Docs CI Gate（只审计）

用途：
- 在 CI 侧复用同一套审计规则，形成与 pre-commit 一致的双保险。

工作流：
- `.github/workflows/obsidian-docs-audit.yml`
- 触发：`pull_request`，以及推送到 `dev/main`
- 执行命令：
```bash
node scripts/ops/validate_obsidian_docs_gate.mjs
```
