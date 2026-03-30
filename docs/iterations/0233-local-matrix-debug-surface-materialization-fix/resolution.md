---
title: "0233 — local-matrix-debug-surface-materialization-fix Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-25
source: ai
iteration_id: 0233-local-matrix-debug-surface-materialization-fix
id: 0233-local-matrix-debug-surface-materialization-fix
phase: phase1
---

# 0233 — local-matrix-debug-surface-materialization-fix Resolution

## HOW

执行顺序采用“先证实链路缺口，再做最小 authoritative 修复，最后通过 canonical local repair 重新证明环境有效”的方式推进。

核心原则：

- 不重写 `0213` Matrix debug contract
- 不绕过 persisted asset SSOT
- 不修改 `runtime.js` / `runtime.mjs`
- 不用 ad-hoc live patch 冒充 canonical repair
- 如果 Step 1 证明问题超出 local materialization 边界，必须停下并回到规划，而不是继续扩 scope

## Preconditions

- Working directory:
  - `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Target branch:
  - `dropx/dev_0233-local-matrix-debug-surface-materialization-fix`
- Canonical local endpoint:
  - `http://127.0.0.1:30900`
- Canonical persisted asset root default:
  - `/Users/drop/dongyu/volume/persist/assets`
- Required tooling:
  - `node`
  - `python3`
  - `bash`
  - `curl`
  - `kubectl`
  - `docker`
- Strongest current hypothesis before execution:
  - `scripts/ops/sync_local_persisted_assets.sh` 当前没有把 `matrix_debug_surface.json` 写入 local persisted asset root 和 `manifest.v0.json`
  - 这会导致 `deploy_local.sh` repair 后，ui-server 通过 persisted asset loader 看不到 `Model -100 / 0,1,0 / page_asset_v0`
- If the current hypothesis is disproven:
  - 仅允许继续检查 persisted asset loader 条件、deploy repair 顺序或 ui-server load/overwrite
  - 若需要改 Tier 1 runtime 或 page asset 合同，0233 必须停止

## Delivery Boundaries

- 优先允许修改：
  - `scripts/ops/sync_local_persisted_assets.sh`
  - `scripts/tests/test_0200b_local_externalization_contract.mjs`
  - `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`
- 仅在 Step 1 证实需要时才允许修改：
  - `packages/worker-base/src/persisted_asset_loader.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/ops/deploy_local.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
- 不允许扩到：
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/**`
  - Playwright/browser evidence 脚本
  - remote rollout / remote ops

## Stop Conditions

- Step 1 若证明 `matrix_debug_surface.json` 已经完整进入 persisted asset manifest，但 live snapshot 仍缺失 page asset，必须先给出“遗漏已被否定，下一断点是什么”的书面结论，再决定是否进入 loader/ui-server 检查。
- 任一执行步骤若需要修改 runtime 解释器、label 语义或 `0213` 的 page asset 合同，必须停止并返回新的规划裁决。
- Step 3 若 `kubectl`、Docker 或 `30900/snapshot` 不可达，最终只能给出 blocked/unverified，不得声称 local baseline ready。

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Freeze Contract And Localize The Gap | 冻结 `Model -100` 的 authoritative contract，证明缺口位于 repo asset → persisted asset → repair → live snapshot 链路中的哪一段 | `packages/worker-base/system-models/matrix_debug_surface.json`, `scripts/ops/sync_local_persisted_assets.sh`, `packages/worker-base/src/persisted_asset_loader.mjs`, `scripts/ops/deploy_local.sh`, `packages/ui-model-demo-server/server.mjs`, `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`, `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs` | contract tests + temp asset root reproduction + source inspection | 只读分析，无业务回退 |
| 2 | Apply Minimal Authoritative Chain Fix | 用最小改动把 `matrix_debug_surface.json` 纳入 canonical local persisted-assets 链，并补足回归保护 | `scripts/ops/sync_local_persisted_assets.sh`, `scripts/tests/test_0200b_local_externalization_contract.mjs`, `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`, `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`, `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`，以及 Step 1 证实后所需的最小附加文件 | shell syntax + contract tests + temp asset root assertion | 回退最小修复 commit |
| 3 | Re-materialize Through Canonical Local Repair | 走真实 local repair 路径，把修复后的 persisted assets materialize 到 live environment | `scripts/ops/deploy_local.sh`, `scripts/ops/ensure_runtime_baseline.sh`, `scripts/ops/check_runtime_baseline.sh`，以及 Step 2 实际改动文件 | canonical repair + gate PASS + live snapshot assertion | 回退 Step 2 改动并重跑 canonical repair |
| 4 | Lock Regression Surface For 0234 | 证明 0232 gate 已转绿且 matrix debug surface 回归到 0213 合同，为 0234 复验提供稳定前置条件 | `scripts/tests/test_0200b_local_externalization_contract.mjs`, `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`, `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`, `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`, `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs` | regression tests + gate + snapshot assertions | 回退 Step 2 改动并恢复到 Step 1 发现的基线 |

## Step 1 — Freeze Contract And Localize The Gap

- Scope:
  - 冻结 `0213` 对 `Model -100` 的正式合同与 `0232` 对 live local gate 的判定口径
  - 证明当前缺口究竟发生在以下哪一段：
    - `matrix_debug_surface.json` 根本未进入 persisted asset root
    - 文件进入了 root，但没有写入 `manifest.v0.json`
    - 文件和 manifest 都存在，但 repair/load-order 没有应用到 ui-server
    - 文件已应用，但 live snapshot 被旧 surface 覆盖
- Files:
  - `packages/worker-base/system-models/matrix_debug_surface.json`
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`
  - `scripts/ops/sync_local_persisted_assets.sh`
  - `packages/worker-base/src/persisted_asset_loader.mjs`
  - `scripts/ops/deploy_local.sh`
  - `packages/ui-model-demo-server/server.mjs`
  - `docs/iterations/0222-local-cluster-rollout-baseline/runlog.md`
  - `docs/iterations/0232-local-baseline-surface-gate/runlog.md`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "matrix_debug_surface\\.json|applyPersistedAssetEntries|resolvePersistedAssetRoot|sync_local_persisted_assets\\.sh|matrix_debug_page_asset=missing|trace_root" scripts/ops/sync_local_persisted_assets.sh packages/worker-base/src/persisted_asset_loader.mjs scripts/ops/deploy_local.sh packages/ui-model-demo-server/server.mjs docs/iterations/0222-local-cluster-rollout-baseline/runlog.md docs/iterations/0232-local-baseline-surface-gate/runlog.md
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && tmpdir="$(mktemp -d)" && LOCAL_PERSISTED_ASSET_ROOT="$tmpdir" bash scripts/ops/sync_local_persisted_assets.sh >/dev/null && python3 - "$tmpdir" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
manifest = json.loads((root / 'manifest.v0.json').read_text(encoding='utf-8'))
paths = {entry.get('path') for entry in manifest.get('entries', [])}
file_exists = (root / 'system/ui/matrix_debug_surface.json').exists()
in_manifest = 'system/ui/matrix_debug_surface.json' in paths

if file_exists == in_manifest:
    print(f'PASS file_exists={file_exists} in_manifest={in_manifest}')
    raise SystemExit(0)

print(f'FAIL partial_state file_exists={file_exists} in_manifest={in_manifest}')
raise SystemExit(1)
PY
```

- Acceptance:
  - `0213` 合同和 `0232` gate contract 仍然是绿色基线
  - 已明确当前链路缺口属于哪一类：
    - omission
    - manifest inconsistency
    - loader/deploy omission
    - overwrite
  - 若 temp asset root 已证明 omission 成立，则 Step 2 应保持在 sync/contract test 最小修复面
  - 若 omission 不成立，则必须在进入 Step 2 前给出“为什么需要扩到 loader/ui-server”的明确说明
- Rollback:
  - 本步只读；若临时运行了 temp asset root，只需删除临时目录，无需业务回退

## Step 2 — Apply Minimal Authoritative Chain Fix

- Scope:
  - 在不改 `0213` 合同和不改 runtime 语义的前提下，修复 authoritative local persisted-assets 链
  - 优先目标是让 `matrix_debug_surface.json` 对 `ui-server` scope 出现在 `system/ui/` 和 `manifest.v0.json`
  - 同时补足至少一层 repo-side regression guard，避免后续再次遗漏该 patch
- Files:
  - `scripts/ops/sync_local_persisted_assets.sh`
  - `scripts/tests/test_0200b_local_externalization_contract.mjs`
  - `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`
  - 若 Step 1 证实 omission 之外仍有最小补丁点，可额外修改：
    - `packages/worker-base/src/persisted_asset_loader.mjs`
    - `packages/ui-model-demo-server/server.mjs`
    - `scripts/ops/deploy_local.sh`
    - `scripts/ops/ensure_runtime_baseline.sh`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash -n scripts/ops/sync_local_persisted_assets.sh
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0200b_local_externalization_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && tmpdir="$(mktemp -d)" && LOCAL_PERSISTED_ASSET_ROOT="$tmpdir" bash scripts/ops/sync_local_persisted_assets.sh >/dev/null && test -f "$tmpdir/system/ui/matrix_debug_surface.json" && rg -n "system/ui/matrix_debug_surface\\.json" "$tmpdir/manifest.v0.json"
```

- Acceptance:
  - 修复后的 temp persisted asset root 中，`matrix_debug_surface.json` 文件与 manifest entry 同时存在
  - `0213` contract、persisted asset loader contract、`0232` gate contract 均保持 PASS
  - 如果 Step 2 需要触达 loader/ui-server/deploy 文件，修改必须能被 Step 1 的书面结论直接解释
- Rollback:
  - 回退 Step 2 最小修复 commit
  - 重新运行 `bash -n scripts/ops/sync_local_persisted_assets.sh` 与相关 contract tests，确认回到执行前状态

## Step 3 — Re-materialize Through Canonical Local Repair

- Scope:
  - 使用真实 canonical local repair 路径，把修复后的 persisted assets 重新 materialize 到 live environment
  - 禁止跳过 `sync_local_persisted_assets.sh` 或直接在 live env 中手改模型数据
- Files:
  - `scripts/ops/deploy_local.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/check_runtime_baseline.sh`
  - Step 2 实际改动文件
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/ensure_runtime_baseline.sh
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0.v.id == "matrix_debug_root"'
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '(.snapshot.models["-100"].cells["0,0,0"].labels.trace_status != null) and (.snapshot.models["-100"].cells["0,0,0"].labels.app_name.v == "Matrix Debug")'
```

- Acceptance:
  - `ensure_runtime_baseline.sh` 能通过 canonical repair 使 `check_runtime_baseline.sh` 返回 PASS
  - live `/snapshot` 中 `Model -100 / 0,1,0 / page_asset_v0` 已 materialize 为 `matrix_debug_root`
  - `Model -100 / 0,0,0` 的 trace/debug labels 仍存在，说明修复没有破坏已有 host glue
  - 若当前 shell 或 cluster 不可达，Step 3 只能产出 blocked/unverified，不得报 ready
- Rollback:
  - 先回退 Step 2 代码改动
  - 再重新执行 `bash scripts/ops/ensure_runtime_baseline.sh`
  - 若环境已因本次修复 materialize 新 surface，则回退后必须再次通过 canonical repair 回到回退后的 authoritative 状态

## Step 4 — Lock Regression Surface For 0234

- Scope:
  - 用 repo-side tests 和 live snapshot 一起确认 0233 修复没有伤到 `0213`/`0232` 既有合同
  - 形成 0234 可直接消费的 local effective 前置条件
- Files:
  - `scripts/tests/test_0200b_local_externalization_contract.mjs`
  - `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `scripts/ops/check_runtime_baseline.sh`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0200b_local_externalization_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh
```

- Acceptance:
  - repo-side contract tests 与 local server validation 全部 PASS
  - `0232` gate 保持绿色，不再出现 `matrix_debug_page_asset=missing`
  - 0234 无需额外手工 patch 或旁路 repair，即可直接开始 browser evidence rerun
- Rollback:
  - 回退 Step 2 引入的代码与测试改动
  - 重新执行 Step 1 的 temp asset root 检查，确认仓库回到修复前基线

## Definition Of Done

- Step 1-4 的验证命令全部通过，或在 Step 3 明确给出 blocked/unverified 且未误报 ready
- local canonical repair 后，live `/snapshot` 对 `Model -100` 的 page asset assertion 为 PASS
- `scripts/ops/check_runtime_baseline.sh` 的 matrix debug surface 检查转为 PASS，且 Home / Gallery / `ws_apps_registry` 不回退
- persisted asset sync 链路对 `matrix_debug_surface.json` 有 repo-side regression guard，避免未来再次遗漏
- `0234-local-browser-evidence-effective-rerun` 可以把 0233 修复后的 local environment 当作真实前置条件使用

## Rollback Strategy

- 代码回退：
  - 只允许通过 `git revert <step2_or_step3_commit>` 逆向回退本 iteration 的实际实现提交
- 环境回退：
  - 回退后必须重新执行 `bash scripts/ops/ensure_runtime_baseline.sh`，让本地 environment 与回退后的 authoritative assets 重新对齐
- 判定规则：
  - 只要再次出现以下任一情况，就视为需要回退或重新裁决：
    - `check_runtime_baseline.sh` 再次报 `matrix_debug_page_asset=missing`
    - live `/snapshot` 中 `Model -100 / 0,1,0 / page_asset_v0` 不等于 `matrix_debug_root`
    - Home / Gallery / `ws_apps_registry` gate 因 0233 修复发生回退
