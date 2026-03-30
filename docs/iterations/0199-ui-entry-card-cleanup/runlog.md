---
title: "Iteration 0199-ui-entry-card-cleanup Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0199-ui-entry-card-cleanup
id: 0199-ui-entry-card-cleanup
phase: phase3
---

# Iteration 0199-ui-entry-card-cleanup Runlog

## Environment

- Date: 2026-03-20
- Branch: `dropx/dev_0199-ui-entry-card-cleanup`
- Runtime: local repo + docs vault

Review Gate Record
- Iteration ID: 0199-ui-entry-card-cleanup
- Review Date: 2026-03-20
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户已明确确认：`0199-ui-entry-card-cleanup 通过 Gate，可以开始实施`
  - 范围锁定为两件事：
    - 修 `Card.title` 的 renderer bug
    - 收口 Header 中 `gallery/docs/static` 入口

## Execution Records

### Step 1

- Command:
  - `git checkout -b dropx/dev_0199-ui-entry-card-cleanup`
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0199-ui-entry-card-cleanup --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - `rg -n "nav_visible|ws_selected_title|\\$label|Card|resolveRefsDeep|getLabelValue|deriveWorkspaceSelected" packages/worker-base/system-models/nav_catalog_ui.json packages/worker-base/system-models/workspace_catalog_ui.json packages/ui-renderer/src/renderer.mjs packages/ui-model-demo-server/server.mjs`
  - `sed -n '1,220p' packages/ui-renderer/src/renderer.mjs`
  - `sed -n '220,380p' packages/ui-renderer/src/renderer.mjs`
  - `sed -n '860,980p' packages/ui-renderer/src/renderer.mjs`
- Key output:
  - 已确认 Header 可见页当前包含 `gallery/docs/static`
  - 已确认 `ws_selected_title` 由 server 以 `t: "str"` 写入
  - 已确认 renderer 在 `buildVueNode` 中先 `resolveRefsDeep(props)`，但 `Card` 分支又直接读取原始 `node.props.title`
  - 已确认 `[object Object]` 根因是 `Card.title` 绕过解析后的 `props.title`
  - 已确认本轮范围收紧为：
    - 修 `Card.title`
    - 收口 Header 入口
    - 不并入 `0200`
- Result: PASS
- Commit: N/A

### Step 2

- Command:
  - `apply_patch` 更新：
    - `packages/ui-renderer/src/renderer.js`
    - `packages/ui-renderer/src/renderer.mjs`
    - `packages/worker-base/system-models/nav_catalog_ui.json`
    - `scripts/tests/test_0199_card_title_label_resolution.mjs`
    - `scripts/tests/test_0199_nav_catalog_visibility_contract.mjs`
  - `node scripts/tests/test_0199_card_title_label_resolution.mjs`
  - `node scripts/tests/test_0199_nav_catalog_visibility_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `node scripts/tests/test_0186_renderer_commit_policy_contract.mjs`
  - `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `node scripts/tests/test_0191b_gallery_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_docs_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_static_asset_resolution.mjs`
- Key output:
  - `Card.title` 现在使用解析后的 `props.title`
  - `renderTreeNode` 的 `Card.title` 路径也同步对齐，避免 tree/runtime 行为分叉
  - Header visible pages 已收口为 `home/workspace/prompt`
  - 新增的 2 条合同测试先 RED 后 GREEN
  - 相关 renderer / asset / demo 回归全部 PASS
- Result: PASS
- Commit: `2a8b20d`

### Step 3

- Command:
  - `npm -C packages/ui-model-demo-frontend run dev`
  - `command -v npx >/dev/null 2>&1 && echo NPX_OK`
  - 浏览器打开 `http://127.0.0.1:5173/#/workspace`
  - Playwright browser harness 挂载最小 `Card`：
    - 读取 `$label -> ws_selected_title`
    - 截图并复制到 `output/playwright/0199-ui-entry-card-cleanup-smoke.png`
  - `git switch dev`
  - `git merge --no-ff dropx/dev_0199-ui-entry-card-cleanup -m "merge: complete 0199 ui entry card cleanup"`
  - `git push origin dev`
- Key output:
  - Header 浏览器可见按钮仅剩：
    - `首页`
    - `Workspace`
    - `Prompt`
  - 浏览器最小 `Card` harness 文本为：
    - `Workspace / Gallery`
    - `body`
  - 截图证据：
    - `/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/0199-ui-entry-card-cleanup-smoke.png`
  - 本轮不触及 runtime / server / worker / deploy
  - implementation commit: `2a8b20d`
  - merge commit: `5f69685`
  - `origin/dev` 已同步到 `5f69685`
- Result: PASS
- Commit: `5f69685`

## Docs Updated

- [x] `docs/ITERATIONS.md` reviewed
- [x] `docs/ssot/tier_boundary_and_conformance_testing.md` reviewed
- [x] `docs/iterations/0199-local-integrated-browser-validation/*` reviewed
