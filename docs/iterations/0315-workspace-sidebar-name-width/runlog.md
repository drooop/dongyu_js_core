---
title: "0315 — workspace-sidebar-name-width Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0315-workspace-sidebar-name-width
id: 0315-workspace-sidebar-name-width
phase: phase3
---

# 0315 — workspace-sidebar-name-width Runlog

## Environment

- Date: `2026-04-13`
- Branch: `dev_0315-workspace-sidebar-name-width`
- Runtime: planning

## Review Gate Record

### Review 1 — User

- Iteration ID: `0315-workspace-sidebar-name-width`
- Review Date: `2026-04-13`
- Review Type: `User`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 不加宽侧栏
  - 压缩 `source / Actions`
  - 让 app 名称更长

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed

## Execution Record

### 2026-04-13 — Step 1 TDD Red

**Test added**
- `scripts/tests/test_0315_workspace_sidebar_layout_contract.mjs`

**Command**
- `node scripts/tests/test_0315_workspace_sidebar_layout_contract.mjs` → FAIL

**Red reason**
- `col_ws_name` 仍是 `minWidth = 140`

### 2026-04-13 — Step 2 Minimal Layout Change

**Updated**
- `packages/worker-base/system-models/workspace_catalog_ui.json`

**Changed**
- 左侧栏总宽保持：
  - `260px`
- 列宽调整为：
  - `name.minWidth = 180`
  - `source.width = 72`
  - `actions.width = 124`

**Intent**
- 不加宽左侧栏
- 给名称更多显示空间
- 压缩 `source / Actions`
- 不改 `Open / Delete` 行为

### 2026-04-13 — Step 3 Deterministic Verification

**Commands**
- `node scripts/tests/test_0315_workspace_sidebar_layout_contract.mjs` → PASS
- `node scripts/tests/test_0311_workspace_pin_addressing_server_flow.mjs` → PASS
- `node scripts/ops/obsidian_docs_audit.mjs --root docs` → PASS

**Meaning**
- 新列宽分配已被测试固定
- workspace 侧栏操作行为未回归

### 2026-04-13 — Visual Verification Attempt

**Attempted**
- 用本地 `bun packages/ui-model-demo-server/server.mjs` 起服务：PASS
- 尝试用 Playwright 打开 `http://127.0.0.1:3900/#/workspace`

**Blocked**
- Playwright Chrome persistent-context 启动失败：
  - 浏览器日志显示“正在现有的浏览器会话中打开”
- 因此本轮未能完成浏览器真验截图/点击

**Result**
- 视觉真验受本机 Playwright/Chrome 会话冲突阻塞
- 已保留静态和行为回归 PASS 作为本轮完成依据
