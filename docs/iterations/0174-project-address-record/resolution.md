---
title: "0174 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0174-project-address-record
id: 0174-project-address-record
phase: phase1
---

# 0174 — Resolution (HOW)

## Execution Strategy

- 先登记 iteration 并完成 plan/resolution/runlog，再从 `scripts/ops/README.md`、`deploy/env/*.example`、cloud deploy runlog 与当前 worktree 路径抽取地址事实，最后新增一份 user-guide 并更新目录入口。验证以 `rg` 命中与 `obsidian_docs_audit` 为准。

## Step 1

- Scope:
- 登记 `0174` iteration，补齐 WHAT/HOW/Runlog 的基础治理记录。
- Files:
- `docs/ITERATIONS.md`
- `docs/iterations/0174-project-address-record/plan.md`
- `docs/iterations/0174-project-address-record/resolution.md`
- `docs/iterations/0174-project-address-record/runlog.md`
- Verification:
- `rg -n "0174-project-address-record|本地 / 远端项目地址记录" docs/ITERATIONS.md docs/iterations/0174-project-address-record`
- Acceptance:
- iteration 已登记，且 plan/resolution/runlog 可独立说明本轮目标、步骤与验证。
- Rollback:
- 回退 `0174` 的索引行与 iteration 目录文档。

## Step 2

- Scope:
- 新增“当前本地 / 远端项目地址记录” user-guide，并在 user-guide 索引中挂入口。
- Files:
- `docs/user-guide/project_address_record.md`
- `docs/user-guide/README.md`
- Verification:
- `rg -n "/Users/drop/codebase/cowork/dongyuapp_elysia_based|/Users/drop/Documents/drip/Projects/dongyuapp|124.71.43.80|/home/wwpic/dongyuapp|https://app.dongyudigital.com|http://127.0.0.1:9011|http://localhost:30900" docs/user-guide/project_address_record.md`
- Acceptance:
- user-guide 明确区分本地仓库路径、docs 实际落盘路径、本地常用 URL、远端主机/仓库路径/公开入口，并说明来源。
- Rollback:
- 回退新增文档与 README 入口。

## Step 3

- Scope:
- 执行 docs frontmatter 审计与事实记录收口。
- Files:
- `docs/iterations/0174-project-address-record/runlog.md`
- Verification:
- `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Acceptance:
- docs 审计通过，无 frontmatter 缺口；runlog 中有实际命令与 PASS/FAIL。
- Rollback:
- 回退 runlog 中本轮记录。

## Notes

- Review Gate:
  - Decision: Approved
  - Basis: 用户明确要求直接撰写新的 user-guide，可视为本轮文档执行授权。
