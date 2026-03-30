---
title: "Current Local and Remote Project Address Record"
doc_type: user-guide
status: active
updated: 2026-03-21
source: ai
---

# Current Local and Remote Project Address Record

本页只记录当前仓库中已经出现、且仍被脚本或 runlog 使用的“项目地址”。

边界：
- 只记录 repo 可见事实，不补写本机 SSH config、secret 或外部资产系统中的信息。
- “地址”分为文件系统路径、服务访问 URL、远端主机/仓库路径、k8s 相关上下文，不混写成同一种概念。
- 若同一类地址有多个口径，本页会注明来源与适用场景。

## 1. 本地文件路径

| 类型 | 当前记录 | 来源 | 说明 |
|---|---|---|---|
| 本地仓库根目录 | `/Users/drop/codebase/cowork/dongyuapp_elysia_based` | 当前 worktree；多份 runlog 显式使用该路径 | 当前 git worktree 根目录。 |
| `docs` 实际落盘目录 | `/Users/drop/Documents/drip/Projects/dongyuapp` | `docs` symlink；`0172` runlog 已记录 | `docs/` 在仓库中是 symlink，user-guide 实际写入该 Obsidian vault。 |
| 远端部署脚本在本地仓库中的入口 | `scripts/ops/deploy_cloud.sh` | `scripts/ops/README.md` | 本地编辑入口；远端执行时对应远端绝对路径见下文。 |

## 2. 本地常用访问入口

| 类型                          | 当前记录                     | 来源                                                                                           | 说明                            |
| --------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------- |
| 本地默认 ui-server origin       | `http://127.0.0.1:9000`  | frontend `main.js` / `remote_store.js` / `vite.config.js`                                    | 前端 remote 模式和代理默认回指该地址。       |
| Model 100 本地 roundtrip 常用端口 | `http://127.0.0.1:9011`  | `scripts/ops/run_model100_submit_roundtrip_local.sh` / `start_local_ui_server_k8s_matrix.sh` | 本地 runbook 的常用验证入口。           |
| Local k8s NodePort UI       | `http://127.0.0.1:30900` | `scripts/ops/deploy_local.sh` / `scripts/ops/README.md`                                      | 本地 K8s baseline 就绪后的常见 UI 入口，也是 `0221` workspace smoke 的唯一 canonical URL。 |
| 本机 Ollama                   | `http://127.0.0.1:11434` | `scripts/ops/run_0154_llm_dispatch_local.sh` / `run_0155_prompt_filltable_local.sh`          | 仅适用于启用真实 Ollama 的本地验证。        |

## 3. 远端主机与仓库路径

| 类型 | 当前记录 | 来源 | 说明 |
|---|---|---|---|
| 远端目标主机 | `124.71.43.80` | `CLAUDE.md` / `deploy/env/cloud.env.example` | repo 中明确标记为 `dy-cloud` 的 RKE2 目标主机。 |
| 远端仓库根目录 | `/home/wwpic/dongyuapp` | `scripts/ops/README.md` / `0165`、`0149` runlog | cloud deploy 与远端文件同步都以该目录为基准。 |
| 远端 deploy 脚本绝对路径 | `/home/wwpic/dongyuapp/scripts/ops/deploy_cloud.sh` | `scripts/ops/README.md` / `scripts/ops/deploy_cloud.sh` 注释 | canonical cloud deploy 入口。 |
| 远端用户态 kubeconfig | `/home/wwpic/.kube/config` | `0149` runlog 多条 `kubectl --kubeconfig` 命令 | repo 中的远端人工排障命令大量使用该路径。 |
| 远端 root/rke2 kubeconfig | `/etc/rancher/rke2/rke2.yaml` | `deploy/env/cloud.env.example` | 主要出现在 cloud env 样例中，适用于 root/rke2 侧脚本口径。 |

## 4. 远端公开访问入口

| 类型 | 当前记录 | 来源 | 说明 |
|---|---|---|---|
| Cloud UI Server | `https://app.dongyudigital.com` | `scripts/ops/deploy_cloud.sh` / `0165`、`0149` runlog | 当前 repo 中已落盘的 cloud 对外访问地址。 |
| Cloud workspace 路由示例 | `https://app.dongyudigital.com/#/workspace` | `0167` / `0168` runlog | 远端 Playwright smoke 和手工复验使用的 workspace 入口。 |

## 5. 相关上下文地址

| 类型 | 当前记录 | 来源 | 说明 |
|---|---|---|---|
| Kubernetes namespace | `dongyu` | `deploy/env/local.env.example` / `deploy/env/cloud.env.example` / `k8s/*` | 本地和 cloud manifest 当前都使用该 namespace。 |
| Local Matrix server name | `localhost` | `deploy/env/local.env.example` / `k8s/local/synapse.yaml` | 本地 baseline 口径。 |
| Cloud Matrix server name | `dongyu.local` | `deploy/env/cloud.env.example` / `0165` runlog Matrix Room | cloud baseline 口径。 |

## 6. 使用建议

- 需要找命令与 PASS 判定：先看 [[scripts/ops/README|Ops One-Click Commands]]。
- 需要找本地 Prompt FillTable / Ollama 路径：看 [[docs/user-guide/llm_cognition_ollama_runbook|LLM Cognition Ollama Runbook]]。
- 需要找 deploy 事实证据：优先看 `0149`、`0165`、`0167`、`0168`、`0169` 的 runlog，而不是只看聊天记录。
- 若 repo 后续变更了主机、仓库根目录、公开域名或本地默认端口，本页必须同步更新。
