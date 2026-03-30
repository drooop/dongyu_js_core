---
title: "0223 — local-cluster-browser-evidence Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-03-25
source: ai
iteration_id: 0223-local-cluster-browser-evidence
id: 0223-local-cluster-browser-evidence
phase: phase4
---

# 0223 — local-cluster-browser-evidence Runlog

## Environment

- Date: 2026-03-25
- Branch: `dropx/dev_0223-local-cluster-browser-evidence`
- Runtime: local cluster + real Playwright MCP browser evidence

## Execution Records

- Final verdict: `Local environment not effective`
- Evidence summary:
  - live `/snapshot` 仍显示旧 surface：
    - `home_asset = null`
    - `matrix_asset = null`
    - `gallery_asset_present = false`
    - `ws_registry_model_ids = [-103,-100,1,2,100,1001,1002]`
  - real Playwright MCP browser evidence:
    - Home 仍是旧 `home-datatable` / DataTable surface
    - Workspace 仍显示旧 asset tree 与旧 workspace registry
    - Prompt 页面可访问，但不能抵消 Home / Workspace 的旧 baseline 事实
  - browser console 仅见非阻塞 `favicon.ico 404`

### Browser Evidence

- URL:
  - `http://127.0.0.1:30900/#/`
  - `http://127.0.0.1:30900/#/workspace`
  - `http://127.0.0.1:30900/#/prompt`
- Page title:
  - `UI Model Demo`
- Console:
  - `[INFO] [dy] debug helpers ...`
  - `[ERROR] favicon.ico 404`
- Artifacts:
  - `output/playwright/0223-local-cluster-browser-evidence/home.png`
  - `output/playwright/0223-local-cluster-browser-evidence/workspace.png`
  - `output/playwright/0223-local-cluster-browser-evidence/prompt.png`

### Browser Findings

- Home:
  - 顶部 target 显示 `home-datatable`
  - 页面主体是 DataTable，不是 `0210-0217` 期望的新 page-asset Home surface
- Workspace:
  - asset tree 仍是 `Gallery / Bus Trace / Model 1 / Model 2 / E2E 颜色生成器 / 请假申请 / 设备报修`
  - 缺少 `0222` 期望的扩展 registry 结果
- Prompt:
  - 页面可正常打开并截图
  - 说明站点不是整体不可用
  - 但它不能推翻 Home / Workspace 仍停留在旧 baseline 的事实

### Adjudication

- `0229` 已证明 local ops bridge 可用
- 但 `0223` 的真实浏览器取证表明：当前本地环境暴露的 UI baseline 仍未对齐 `0210-0217`
- 因此本 iteration 的合法终态是：
  - `Local environment not effective`

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] `docs/iterations/0222-local-cluster-rollout-baseline/runlog.md` reviewed
- [x] `docs/iterations/0229-local-ops-bridge-smoke/runlog.md` reviewed
