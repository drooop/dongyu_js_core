# 0149 — Cloud 部署同步（ui-server 修复发布 + e2e 验证）

## 0. Metadata
- ID: 0149-cloud-deploy-sync-ui-server
- Date: 2026-02-14
- Owner: AI (User Approved)
- Branch: dev_0149-cloud-deploy-sync-ui-server
- Target: dy-cloud (124.71.43.80), k8s namespace `dongyu`, host `app.dongyudigital.com`
- Related:
  - `packages/ui-model-demo-server/server.mjs`
  - `k8s/Dockerfile.ui-server`
  - Remote repo path: `/home/wwpic/dongyuapp`

## 1. Goal
将本地已验证的 UI 行为修复（Generate Color 不再双触发、sidebar/workspace registry 在 seed=0 时可派生）同步到 dy-cloud 的 `ui-server`，并用自动化浏览器测试验证远端效果与本地一致。

## 2. Background
本地已对 `ui-server` 做了两类修复：
- 避免重复写入 `ui_event` 导致一次点击产生两次颜色变化。
- 在 `SEED_POSITIVE_MODELS_ON_BOOT=0` 时从 runtime snapshot 派生 workspace registry，避免 sidebar 空。

dy-cloud 当前使用独立目录 `/home/wwpic/dongyuapp`（非 git repo）构建与部署，需要通过文件同步 + 镜像重建发布。

## 3. Invariants (Must Not Change)
- 不执行 `systemctl start/stop/restart` 等被 `CLAUDE.md` 禁止的操作。
- 仅使用允许的远端操作：ssh/scp、docker build/save、kubectl apply/rollout/logs。
- 变更范围最小：只同步 `ui-server` 相关代码文件，不覆盖远端 env/secrets。

## 4. Scope
### 4.1 In Scope
- 同步 `packages/ui-model-demo-server/server.mjs` 到 dy-cloud。
- dy-cloud 上重建 `dy-ui-server:v1` 并导入到 node containerd（使用现有 job 模式）。
- `kubectl rollout restart deployment/ui-server` 并等待就绪。
- Playwright 对远端 UI 做最小 e2e：点击 Generate Color 一次只变一次；sidebar 非空。

### 4.2 Out of Scope
- 变更 dy-cloud 的 k8s manifests 或 secrets（除非验证必需）。
- 重建/发布 remote-worker/mbr-worker（除非验证必需）。

## 5. Success Criteria
- dy-cloud `ui-server` pod 重启后运行正常且日志无明显错误。
- 远端页面：单次点击 Generate Color 只产生一次颜色更新（无二次跳变）。
- sidebar/workspace list 显示正常（至少有 1 个 entry）。
- e2e 输出可复现并写入 runlog。
