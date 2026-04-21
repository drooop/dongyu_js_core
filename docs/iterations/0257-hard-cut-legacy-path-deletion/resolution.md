---
title: "0257 — hard-cut-legacy-path-deletion Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0257-hard-cut-legacy-path-deletion
id: 0257-hard-cut-legacy-path-deletion
phase: phase1
---

# 0257 — hard-cut-legacy-path-deletion Resolution

## Strategy

0257 是真正的 hard-cut 收尾，只在新路径已在 live browser 层证明成立后执行。

## Steps

| Step | Name | Goal |
|---|---|---|
| 1 | Remove legacy authoring source | 删除旧手写 page AST authoring 入口 |
| 2 | Remove legacy direct write path | 删除 direct business bind.write 路径 |
| 3 | Rewrite docs and validators | SSOT、user-guide、regression 全部切新体系 |
| 4 | Re-run browser proof on cut mainline | 确认删旧后 live browser 仍成立 |

## Deletion Tranches

### Tranche A — Positive example / mounted example models

先处理：

- `1004`
- `1005`
- `1006`
- `1007`

原因：

- 它们属于 example / mounted example / showcase 角色
- 删除手写 `page_asset_v0` source 的风险低于顶层系统页
- 便于先证明“正数示例页也不再手写大 AST”

### Tranche B — System / top-level pages

再处理：

- `-21 Prompt`
- `-22 Home`
- `-23 Docs`
- `-24 Static`
- `-25 Workspace`
- `-100 Matrix Debug`
- `-103 Gallery`

原因：

- 这些页面是顶层导航与系统操作面
- 需要在正数示例页切干净后再动，避免一次切太大

### Tranche C — Test / fixture / residual paths

最后处理：

- `-26` test catalog
- fixtures / validators / docs references
