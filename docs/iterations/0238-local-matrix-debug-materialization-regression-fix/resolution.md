---
title: "0238 — local-matrix-debug-materialization-regression-fix Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-26
source: ai
iteration_id: 0238-local-matrix-debug-materialization-regression-fix
id: 0238-local-matrix-debug-materialization-regression-fix
phase: phase1
---

# 0238 — local-matrix-debug-materialization-regression-fix Resolution

## HOW

0238 的执行方式采用“先冻结 regression 事实，再恢复 authoritative sync + guard，最后通过 canonical local repair 证明 live snapshot 已重新 materialize”的顺序推进。

本版 HOW 明确替换掉原始 scaffold 中的泛化占位内容，要求所有 Step 都绑定到当前真实存在的文件、真实可执行的命令和明确的 stop condition。

核心原则：

- 不重写 `0213` Matrix Debug formal contract
- 不用 browser/renderer fallback 掩盖 persisted-asset regression
- 不修改 `packages/worker-base/src/runtime.js` / `runtime.mjs`
- 不把 0238 偷扩成 Home selector 或 remote iteration
- 若 Step 1 证明断点不止于 sync/manifest omission，必须先写清楚下一断点，再决定是否扩到 loader/deploy/server

## Preconditions

- Working directory:
  - `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Target branch:
  - `dropx/dev_0238-local-matrix-debug-materialization-regression-fix`
- Canonical local endpoint:
  - `http://127.0.0.1:30900`
- Canonical local persisted asset root default:
  - `/Users/drop/dongyu/volume/persist/assets`
- Required tooling:
  - `bash`
  - `node`
  - `python3`
  - `curl`
  - `jq`
  - `kubectl`
  - `docker`
- Strongest current hypothesis before execution:
  - current `scripts/ops/sync_local_persisted_assets.sh` again omits:
    - `matrix_debug_surface.json`
    - `intent_handlers_matrix_debug.json`
  - current `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs` no longer guards this omission
  - `deploy_local.sh` still calls `sync_local_persisted_assets.sh`, and `ui-server` still loads authoritative persisted assets through `applyPersistedAssetEntries`, so the most likely break is a reintroduced authoritative sync/manifest regression
- If the hypothesis is disproven:
  - only then may execution expand to:
    - `packages/worker-base/src/persisted_asset_loader.mjs`
    - `scripts/ops/deploy_local.sh`
    - `scripts/ops/ensure_runtime_baseline.sh`
    - `packages/ui-model-demo-server/server.mjs`

## Delivery Boundaries

- Allowed minimal write surface:
  - `scripts/ops/sync_local_persisted_assets.sh`
  - `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
- Read-only but mandatory investigation surface:
  - `packages/worker-base/system-models/matrix_debug_surface.json`
  - `packages/worker-base/system-models/intent_handlers_matrix_debug.json`
  - `packages/worker-base/src/persisted_asset_loader.mjs`
  - `scripts/ops/deploy_local.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/check_runtime_baseline.sh`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md`
  - `docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md`
- Not allowed:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/**`
  - Home selector/frontend-specific fixes
  - remote ops / remote evidence
  - manual edits under live persisted asset root or live snapshot state

## Stop Conditions

- Step 1 若证明 temp persisted asset root 已经完整包含这两个 Matrix Debug 文件和对应 manifest entry，但 live `/snapshot` 仍缺失 `page_asset_v0`，必须先记录下一断点是 loader、deploy 还是 ui-server overwrite，再决定是否继续改代码。
- 任一步若需要修改 `matrix_debug_surface.json` 的 formal contract、`Model -100` placement 规则或 runtime 解释器语义，必须停止并重新规划。
- Step 3 若 `kubectl`、Docker 或 `http://127.0.0.1:30900/snapshot` 不可达，只能给出 `blocked/unverified`，不得声称 live local 已修复。

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Freeze Regression And Localize The Break | 固定 0237 已确认的 repo-green/live-red 事实，并证明 current break 是否再次落在 sync/manifest omission | `scripts/ops/sync_local_persisted_assets.sh`, `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`, `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`, `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`, `docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md`, `docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md` | existing green validators + temp asset root reproduction + live snapshot fact freeze | 只读分析，无业务回退 |
| 2 | Restore Authoritative Sync And Guard | 用最小改动恢复 Matrix Debug persisted-asset externalization 与 end-to-end regression guard | `scripts/ops/sync_local_persisted_assets.sh`, `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs` | shell syntax + repo tests + temp asset root assertions | 回退 Step 2 最小修复 commit |
| 3 | Re-materialize Through Canonical Local Repair | 通过 canonical local repair 把恢复后的 authoritative assets materialize 到 live environment | `scripts/ops/deploy_local.sh`, `scripts/ops/ensure_runtime_baseline.sh`, `scripts/ops/check_runtime_baseline.sh`, Step 2 实际改动文件 | canonical repair + baseline gate + live snapshot assertions | 回退 Step 2 改动并重新 repair |
| 4 | Lock The Regression Surface For Downstream Evidence | 同时证明 repo-side guard、isolated validator 与 live snapshot 都重新对齐，为 0240 提供稳定前置条件 | `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`, `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`, `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`, Step 2 实际改动文件 | repo-side PASS + temp asset root PASS + live snapshot PASS | 回退 Step 2/3 改动并恢复执行前基线 |

## Step 1 — Freeze Regression And Localize The Break

- Scope:
  - 冻结 `0237` Step 1 已经确认的事实：
    - repo-side contracts green
    - live local `/snapshot` red
    - browser symptom 为 `Model -100 has no UI schema or AST.`
  - 用 current codebase 再确认 current branch 是否真的再次把 Matrix Debug persisted-asset inputs 和 regression guard 一起丢掉
  - 结论必须明确回答：
    - omission 是否已在 temp persisted asset root 中直接复现
    - 如果复现，Step 2 是否可以保持在最小写入面
    - 如果不能复现，下一断点在哪一层
- Files:
  - `scripts/ops/sync_local_persisted_assets.sh`
  - `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `packages/worker-base/src/persisted_asset_loader.mjs`
  - `scripts/ops/deploy_local.sh`
  - `packages/ui-model-demo-server/server.mjs`
  - `docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md`
  - `docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && python3 - <<'PY'
from pathlib import Path

source = Path('scripts/ops/sync_local_persisted_assets.sh').read_text(encoding='utf-8')
loader_test = Path('scripts/tests/test_0200b_persisted_asset_loader_contract.mjs').read_text(encoding='utf-8')

sync_missing = 'matrix_debug_surface.json' not in source and 'intent_handlers_matrix_debug.json' not in source
guard_missing = 'test_repo_sync_externalizes_matrix_debug_surface_and_handlers_for_ui_server' not in loader_test

if sync_missing and guard_missing:
    print('PASS current_regression_signature_confirmed')
    raise SystemExit(0)

print(f'FAIL current_regression_signature_confirmed sync_missing={sync_missing} guard_missing={guard_missing}')
raise SystemExit(1)
PY
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && tmpdir="$(mktemp -d)" && LOCAL_PERSISTED_ASSET_ROOT="$tmpdir" bash scripts/ops/sync_local_persisted_assets.sh >/dev/null && python3 - "$tmpdir" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
manifest = json.loads((root / 'manifest.v0.json').read_text(encoding='utf-8'))
paths = {entry.get('path') for entry in manifest.get('entries', [])}
checks = {
    'system/ui/matrix_debug_surface.json': (root / 'system/ui/matrix_debug_surface.json').exists(),
    'system/ui/intent_handlers_matrix_debug.json': (root / 'system/ui/intent_handlers_matrix_debug.json').exists(),
}
in_manifest = {
    'system/ui/matrix_debug_surface.json': 'system/ui/matrix_debug_surface.json' in paths,
    'system/ui/intent_handlers_matrix_debug.json': 'system/ui/intent_handlers_matrix_debug.json' in paths,
}

if all(not checks[key] and not in_manifest[key] for key in checks):
    print('PASS current_temp_root_reproduces_matrix_debug_omission')
    raise SystemExit(0)

print({'files': checks, 'manifest': in_manifest})
raise SystemExit(1)
PY
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0 == null'
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '20,140p' docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md && sed -n '1,120p' docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md
```

- Acceptance:
  - 已经重新固定三组事实：
    - `0213` contract green
    - `validate_matrix_debug_server_sse` green
    - current sync/guard regression signature 与 temp asset root omission 都可复现
  - 若 live endpoint 可达，已再次固定 `Model -100 / 0,1,0 / page_asset_v0 == null`
  - Step 2 可以保持在 `sync_local_persisted_assets.sh + test_0200b_persisted_asset_loader_contract.mjs` 的最小写入面
- Rollback:
  - 本步只读；删除临时目录即可，无业务回退

## Step 2 — Restore Authoritative Sync And Guard

- Scope:
  - 把 `matrix_debug_surface.json` 与 `intent_handlers_matrix_debug.json` 重新纳入 canonical local persisted-asset sync
  - 恢复 `0233` 已经证明必要的 end-to-end regression guard，使 omission 在 repo-side tests 中再次可见
  - 不改 formal surface 内容，只恢复 authoritative externalization 和 loader proof
- Files:
  - `scripts/ops/sync_local_persisted_assets.sh`
  - `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash -n scripts/ops/sync_local_persisted_assets.sh
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && tmpdir="$(mktemp -d)" && LOCAL_PERSISTED_ASSET_ROOT="$tmpdir" bash scripts/ops/sync_local_persisted_assets.sh >/dev/null && python3 - "$tmpdir" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
manifest = json.loads((root / 'manifest.v0.json').read_text(encoding='utf-8'))
paths = [entry.get('path') for entry in manifest.get('entries', []) if entry.get('scope') and 'ui-server' in entry.get('scope')]
required = [
    'system/ui/matrix_debug_surface.json',
    'system/ui/intent_handlers_matrix_debug.json',
]

for item in required:
    if not (root / item).exists():
        raise SystemExit(f'missing_file:{item}')
    if item not in paths:
        raise SystemExit(f'missing_manifest_entry:{item}')

print('PASS restored_matrix_debug_sync_and_manifest')
PY
```

- Acceptance:
  - temp persisted asset root 同时包含两个文件和对应 `ui-server` manifest entry
  - `test_0200b_persisted_asset_loader_contract.mjs` 再次能直接证明 persisted loader materializes Matrix Debug page asset 与 handler
  - `test_0213_matrix_debug_surface_contract.mjs` 继续为绿，说明 formal contract 未被回退
- Rollback:
  - 使用 `git revert <step2_commit>` 回退 Step 2 最小修复
  - 回退后重跑上述 Step 2 验证命令，确认仓库回到执行前状态

## Step 3 — Re-materialize Through Canonical Local Repair

- Scope:
  - 通过真实 local repair 路径把恢复后的 authoritative persisted assets 重新 materialize 到 live local environment
  - 禁止直接手改 live persisted asset root、手改运行中模型或跳过 canonical deploy 脚本
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

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -c '{page_asset: .snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0.v.id, trace_status: .snapshot.models["-100"].cells["0,0,0"].labels.trace_status.v, app_name: .snapshot.models["-100"].cells["0,0,0"].labels.app_name.v}'
```

- Acceptance:
  - canonical local repair 成功执行，或至少明确返回了为什么被环境阻塞
  - live `/snapshot` 已恢复 `matrix_debug_root`
  - `Model -100` 的 trace host glue 仍存在，说明修复没有把 Matrix Debug 退回为仅 repo-side contract
  - 若 `check_runtime_baseline.sh` 仍非绿，但 direct snapshot 已绿，必须在 runlog 中明确写成 `repo-fixed / live-partial / gate-red`，不得直接宣称 iteration 完成
- Rollback:
  - 先 `git revert <step2_commit>` 回退 authoritative sync/guard 修复
  - 再重新执行 `bash scripts/ops/ensure_runtime_baseline.sh`
  - 若环境因此回到执行前红灯状态，需在 runlog 中记录回退后 snapshot 事实

## Step 4 — Lock The Regression Surface For Downstream Evidence

- Scope:
  - 用 repo-side tests、temp persisted asset root 和 live snapshot 三层一起锁住 0238 修复结果
  - 为 `0240-local-browser-evidence-rerun-after-0238-0239` 提供明确、稳定的前置条件
- Files:
  - `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - Step 2 实际改动文件
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && tmpdir="$(mktemp -d)" && LOCAL_PERSISTED_ASSET_ROOT="$tmpdir" bash scripts/ops/sync_local_persisted_assets.sh >/dev/null && node --input-type=module - "$tmpdir" <<'NODE'
import { createRequire } from 'node:module';
import path from 'node:path';

const assetRoot = process.argv[2];
const require = createRequire(path.resolve('package.json'));
const { ModelTableRuntime } = require(path.resolve('packages/worker-base/src/runtime.js'));
const { applyPersistedAssetEntries } = await import(path.resolve('packages/worker-base/src/persisted_asset_loader.mjs'));

const runtime = new ModelTableRuntime();
applyPersistedAssetEntries(runtime, {
  assetRoot,
  scope: 'ui-server',
  authority: 'authoritative',
  kind: 'patch',
  phases: ['00-system-base', '10-system-negative', '30-system-positive'],
  applyOptions: { allowCreateModel: true, trustedBootstrap: true },
});

const traceModel = runtime.getModel(-100);
const dispatchModel = runtime.getModel(-10);
const pageAsset = traceModel ? runtime.getCell(traceModel, 0, 1, 0).labels.get('page_asset_v0')?.v : null;
const refreshHandler = dispatchModel ? runtime.getCell(dispatchModel, 0, 0, 0).labels.get('handle_matrix_debug_refresh')?.v : null;

if (pageAsset?.id !== 'matrix_debug_root') throw new Error('matrix_debug_root_not_materialized_from_temp_root');
if (typeof refreshHandler?.code !== 'string') throw new Error('matrix_debug_refresh_handler_missing_from_temp_root');
console.log('PASS temp_root_materializes_matrix_debug_surface_and_handler');
NODE
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0.v.id == "matrix_debug_root"'
```

- Acceptance:
  - repo-side contract、isolated validator、temp-root loader proof、live snapshot proof 全部对齐
  - Matrix Debug formal surface 不再从 current live local environment 掉出
  - `0240` 可以把 0238 视为 authoritative precondition，而不是仍需手工解释的 known regression
- Rollback:
  - 回退 Step 2/3 实际实现 commit
  - 重新执行 Step 1 的 current regression signature 检查，确认是否回到执行前红灯状态

## Definition Of Done

- Step 1-4 的验证命令全部 PASS，或在 Step 3 明确记录 `blocked/unverified` 且未误报 live 修复完成
- `scripts/ops/sync_local_persisted_assets.sh` 再次 externalize `matrix_debug_surface.json` 与 `intent_handlers_matrix_debug.json`
- `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs` 再次对这两项 authoritative inputs 建立 end-to-end guard
- live `/snapshot` 重新满足 `Model -100 / 0,1,0 / page_asset_v0.v.id == "matrix_debug_root"`
- 0238 的最终解释仍然是 authoritative materialization chain 修复，而不是 browser fallback

## Rollback Strategy

- Code rollback:
  - 只允许通过 `git revert <commit>` 回退 0238 的实际实现提交
- Environment rollback:
  - 回退后必须重新执行 `bash scripts/ops/ensure_runtime_baseline.sh`，让 local environment 与回退后的 authoritative assets 重新对齐
- Re-evaluation trigger:
  - 出现以下任一情况时，必须停止并重新裁决：
    - temp persisted asset root 已包含两个 Matrix Debug 文件，但 live snapshot 仍缺失 `matrix_debug_root`
    - Step 2 修复需要触碰 runtime 解释器或 formal page asset contract
    - canonical local repair 无法执行，且没有足够证据区分 `repo-fixed` 与 `live-fixed`
