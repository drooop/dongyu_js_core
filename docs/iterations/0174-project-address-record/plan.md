---
title: "0174 — 本地 / 远端项目地址记录"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0174-project-address-record
id: 0174-project-address-record
phase: phase1
---

# 0174 — 本地 / 远端项目地址记录

## Goal

- 新增一份 `docs/user-guide` 文档，集中记录当前仓库可核对的本地 / 远端项目地址，包括本地仓库路径、docs 落盘路径、常用本地访问入口、远端部署主机、远端仓库路径与公开访问入口。

## Scope

- In scope:
- 基于 repo 内现有脚本、runlog、配置样例整理“当前记录中的地址”。
- 新增 user-guide 文档，并在 `docs/user-guide/README.md` 中挂入口。
- 为本次文档工作补齐 iteration 合同与 runlog。
- Out of scope:
- 修改任何 deploy 脚本、远端环境变量、SSH 配置或 k8s 资源。
- 读取本机 SSH config 之外的外部环境，或假设 repo 未记录的地址。

## Invariants / Constraints

- `CLAUDE.md` 仍是最高优先级约束；本次只写文档，不改 runtime / server / worker 行为。
- 文档内容必须仅基于 repo 可见事实；若同类地址存在多个口径，需要标明“来源”和“适用场景”，而不是强行合并。
- `docs` 是 symlink，user-guide 实际落在外部 Obsidian vault；文档需避免误导读者把 git worktree 与 docs 落盘路径视为同一目录。

## Success Criteria

- `docs/user-guide/project_address_record.md` 成功创建，并包含本地 / 远端地址分类表。
- 文档明确区分：文件系统路径、服务访问 URL、远端部署路径/主机、k8s 上下文辅助地址。
- `docs/user-guide/README.md` 已新增入口。
- `rg` 与 `obsidian_docs_audit` 能对文档内容和 frontmatter 给出 PASS 级验证信号。

## Inputs

- Created at: 2026-03-07
- Iteration ID: 0174-project-address-record
- Trigger:
  - 用户要求“撰写 docs 下的一份新的 user-guide，内容是当前本地和远端的项目地址记录”。
