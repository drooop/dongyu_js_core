---
title: "0382 - Workspace Entry Cleanup Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0382-workspace-entry-cleanup
id: 0382-workspace-entry-cleanup
phase: completed
---

# Iteration 0382-workspace-entry-cleanup Resolution

## Execution Strategy

- 用共享 Workspace 入口 allowlist 收敛 server 与 local demo 的派生 registry。
- 将 Docs 明确标记为可见 Workspace 入口，将 Three Scene 显示名从历史编号改为用户指定名称。
- 部署本地后用 `/snapshot` 与真实浏览器共同确认，再同步到远端并重复验证。

## Step 1

- Scope: 源码入口合同与自动检查。
- Files: `model_ids.js`、server/local registry 派生逻辑、Docs/Workspace seed patches、0382 contract test。
- Verification: `node scripts/tests/test_0382_workspace_entry_cleanup_contract.mjs`。
- Acceptance: 自动检查确认 8 项 allowlist、Docs 可见、Three Scene 显示名正确。
- Rollback: 回退 0382 分支改动即可恢复旧资产树。

## Step 2

- Scope: 本地部署与浏览器验证。
- Files: local runtime deployment state。
- Verification: local `/snapshot` + Playwright 打开 Workspace 并读取侧边栏。
- Acceptance: 侧边栏只有 8 个指定入口，保留项可打开。
- Rollback: 重新部署上一版 main。

## Step 3

- Scope: 远端部署与清理验证。
- Files: remote runtime deployment state。
- Verification: remote `/snapshot` + Playwright 打开 Workspace。
- Acceptance: 远端侧边栏只有 8 个指定入口。
- Rollback: 远端重新部署上一版 main revision。

## Notes

- Local verification passed before cloud deployment.
- Cloud deployment used source revision `a420adc` for the implementation rollout and passed public browser verification at `https://app.dongyudigital.com/#/workspace`.
