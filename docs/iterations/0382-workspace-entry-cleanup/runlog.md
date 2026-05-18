---
title: "0382 - Workspace Entry Cleanup Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0382-workspace-entry-cleanup
id: 0382-workspace-entry-cleanup
phase: completed
---

# Iteration 0382-workspace-entry-cleanup Runlog

## Environment

- Date: 2026-05-19
- Branch: `dropx/dev_0382-workspace-entry-cleanup`
- Runtime: local first, then cloud

## Execution Records

### Step 1

- Command: `node scripts/tests/test_0382_workspace_entry_cleanup_contract.mjs`
- Key output: `test_0382_workspace_entry_cleanup_contract: PASS`
- Result: PASS
- Commit: pending

### Step 2

- Command: local deploy + local browser verification
- Key output:
  - `SKIP_IMAGE_BUILD=1 bash scripts/ops/deploy_local.sh` completed; UI Server available at `http://localhost:30900`.
  - Local `/snapshot` `ws_apps_registry`: `Gallery | Docs | E2E 颜色生成器 | Three Scene | Static | 滑动 APP 导入 | 最小 Submit 双总线示例 | 工作区管理器`.
  - Playwright opened `http://127.0.0.1:30900/#/workspace`, verified exactly 8 visible entries, opened all 8 entries, and found no forbidden legacy entry names in the asset table.
- Result: PASS
- Commit: pending

### Step 3

- Command: cloud deploy + remote browser verification
- Key output:
  - Synced source to remote revision `a420adc` and ran `deploy_cloud_full.sh --revision a420adc`.
  - Deploy script verified UI Server source hashes inside the pod and completed cloud rollout.
  - Remote `/snapshot` `ws_apps_registry`: `Gallery | Docs | E2E 颜色生成器 | Three Scene | Static | 滑动 APP 导入 | 最小 Submit 双总线示例 | 工作区管理器`.
  - Playwright opened `https://app.dongyudigital.com/#/workspace`, verified exactly 8 visible entries, opened all 8 entries, and found no forbidden legacy entry names in the asset table.
  - Remote deployments ready: `ui-server:1/1`, `mbr-worker:1/1`, `remote-worker:1/1`, `workspace-manager:1/1`.
- Result: PASS
- Commit: pending

## Docs Updated

- [x] No SSOT semantics change required; this iteration changes visible Workspace entry selection only.
