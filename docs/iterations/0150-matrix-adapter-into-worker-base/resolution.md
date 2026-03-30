---
title: "0150 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0150-matrix-adapter-into-worker-base
id: 0150-matrix-adapter-into-worker-base
phase: phase1
---

# 0150 — Resolution (HOW)

## 0. Execution Rules
- Work branch: `dev_0150-matrix-adapter-into-worker-base`
- Steps execute in order; real outputs only in `runlog.md`.
- Verification must be deterministic PASS/FAIL.

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Introduce worker-base adapters | 迁移 Matrix/loopback adapter 到 worker-base | `packages/worker-base/src/matrix_live.js`, `packages/worker-base/src/loopback.js` | `node -e "require('./packages/worker-base/src/matrix_live.js')"` | require 成功 | revert files |
| 2 | Update all call sites | scripts/worker/ui-server 全量切换 import | `scripts/*.mjs`, `packages/ui-model-demo-server/server.mjs`, `k8s/Dockerfile.mbr-worker` | `rg -n \"packages/bus-mgmt\" -S scripts packages k8s | wc -l` | 不再引用 bus-mgmt | revert edits |
| 3 | Delete bus-mgmt | 删除 `packages/bus-mgmt/` 并修复引用 | `packages/bus-mgmt/**` | `test ! -d packages/bus-mgmt` | 目录移除 | restore dir |
| 4 | Update docs | 更新 handover/docs 引用路径 | `docs/handover/dam-worker-guide.md` | `rg -n \"bus-mgmt\" docs/handover/dam-worker-guide.md` | 不再提及旧路径 | revert docs |
| 5 | Local verification | 本地构建 + Playwright burst 验证 | (no new files) | `docker build ...` + `node /tmp/test_color_latency_pw.cjs ...` | PASS | revert deployments |
| 6 | Cloud verification (optional but recommended) | dy-cloud 重建并 rollout mbr-worker/ui-server | (deploy artifacts) | 同 runlog | PASS | rollback image tag |

## 2. Step Details

### Step 1 — Introduce worker-base adapters
**Goal**
- 把 `packages/bus-mgmt/src/{matrix_live,loopback,adapter}.js` 迁入 `packages/worker-base/src/`。

**Implementation**
- 新增：
  - `packages/worker-base/src/matrix_live.js`：拷贝现有逻辑，并增加可选 `peerUserId` 入参用于 ui-server 的 DM sender filter。
  - `packages/worker-base/src/loopback.js`：保留原 loopback adapter API。
  - `packages/worker-base/src/mgmt_bus_event_v0.js`（或等价）：承载 `assertMgmtBusEventV0` 这类校验逻辑，供 loopback/matrix 复用。

**Validation**
- `node -e "require('./packages/worker-base/src/matrix_live.js')"`
- `node -e "require('./packages/worker-base/src/loopback.js')"`

**Rollback**
- 回退新增文件。

---

### Step 2 — Update all call sites
**Goal**
- 全仓库统一引用 worker-base adapter。

**Scope**
- 更新 scripts：
  - `scripts/run_worker_v0.mjs`
  - `scripts/run_worker_ui_side_v0.mjs`
  - `scripts/validate_dual_worker_slide_e2e_v0.mjs`
  - `scripts/validate_dual_worker_slide_e2e_mailbox_v0.mjs`
  - `scripts/validate_dual_worker_slide_e2e_mailbox_ops_v0.mjs`
  - `scripts/validate_mailbox_to_matrix_v0.mjs`
  - `scripts/validate_dual_bus_harness_v0.mjs`（loopback + matrix）
- 更新 `k8s/Dockerfile.mbr-worker`：移除 `COPY packages/bus-mgmt/`。
- 更新 `packages/ui-model-demo-server/server.mjs`：
  - 使用 worker-base adapter 的 `createMatrixLiveAdapter()` 处理 `dy.bus.v0` 的 send/recv。
  - 保留 `DY_MATRIX_DM_PEER_USER_ID` sender filter（通过 adapter 的 `peerUserId` 或在回调中实现）。
  - legacy `m.room.message` mgmt 收取：保留现状（若仍需要），不强行下沉到 adapter。

**Validation**
- `rg -n "packages/bus-mgmt" -S scripts packages k8s` 必须为 0。

**Rollback**
- 回退相关文件修改。

---

### Step 3 — Delete bus-mgmt
**Goal**
- 删除 `packages/bus-mgmt/` 并确保引用已清零。

**Validation**
- `test ! -d packages/bus-mgmt`
- `rg -n "bus-mgmt" -S .` 仅允许命中历史记录（archive/iterations runlog）；如命中生产代码则 FAIL。

**Rollback**
- 从 git 恢复目录。

---

### Step 4 — Update docs
**Goal**
- 文档不再指向 `packages/bus-mgmt/**`。

**Validation**
- `rg -n "packages/bus-mgmt" -S docs | cat` 仅允许命中历史迭代 runlog（如 0149）或明确标注 deprecated；否则修复。

---

### Step 5 — Local verification
**Validation**
- `docker build --no-cache -f k8s/Dockerfile.mbr-worker -t dy-mbr-worker:v2 .`
- `kubectl -n dongyu rollout restart deployment/mbr-worker && kubectl -n dongyu rollout status deployment/mbr-worker --timeout=180s`
- `kubectl -n dongyu rollout restart deployment/ui-server && kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`
- `NODE_PATH=$PWD/node_modules node /tmp/test_color_latency_pw.cjs http://127.0.0.1:30900 10`

**Acceptance**
- burst clicks 全 PASS，且无 `submit_inflight` 永久卡死。

---

### Step 6 — Cloud verification (dy-cloud)
**Validation (example)**
- `ssh dy-cloud "cd /home/wwpic/dongyuapp && docker build --no-cache -f k8s/Dockerfile.mbr-worker -t dy-mbr-worker:v2 . && docker save dy-mbr-worker:v2 -o /tmp/dy-mbr-worker-v2.tar"`
- 导入镜像 job + rollout（沿用既有导入流程）
- `NODE_PATH=$PWD/node_modules node /tmp/test_color_latency_pw.cjs https://app.dongyudigital.com 10`

**Rollback**
- 回滚到旧镜像 tag（需要在 runlog 记录旧 digest/tag）。

