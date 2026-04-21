---
title: "0235 — local-home-surface-materialization-fix Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0235-local-home-surface-materialization-fix
id: 0235-local-home-surface-materialization-fix
phase: phase1
---

# 0235 — local-home-surface-materialization-fix Resolution

## Execution Strategy

- 先冻结 `0234` fresh browser evidence、`/snapshot` 与 `home_catalog_ui.json` authoritative asset 的矛盾事实，确保修复目标只聚焦 Home。
- 再优先验证并修正 `root_home` asset 本体是否仍把 legacy `home-datatable` 当作 primary surface；只有 asset 修正不足以解释 drift 时，才继续扩到 route/projection chain。
- 以 TDD / validator-first 方式修正最小链路。
- 最后用 local gate + focused browser/validator 证明 Home 不再回到 legacy target。

## Delivery Boundaries

- 允许：
  - local Home route / projection / asset selection 相关最小代码改动
  - 对应 deterministic tests / validators
  - `docs/iterations/0235-local-home-surface-materialization-fix/runlog.md`
- 不允许：
  - remote tasks
  - remote deploy / remote browser
  - 广泛架构重写

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Freeze Home Drift Contract | 固定 `0234` 的 fresh evidence、local snapshot 与 authoritative `root_home` asset 事实，只收敛 Home blocker | `0234` runlog/report + `home_catalog_ui.json` | browser/snapshot/asset assertions | 只回退文档 |
| 2 | Localize Authoritative Asset vs Projection Mismatch | 确认问题首先是否存在于 `root_home` asset 本体；若存在，再定义最小回归面 | `home_catalog_ui.json`, home tests/validators, route/projection readers | deterministic asset/test assertions | 不改行为 |
| 3 | Fix Minimal Home Surface Chain | 先写失败的 focused test/validator，再修最小缺口；优先 asset，本步必要时才扩到 projection | `home_catalog_ui.json` + smallest required consumers/tests | focused tests/validators/build | revert code change |
| 4 | Re-verify Local Home Surface | 用 local gate + focused evidence 确认 Home 不再 legacy，并为 `0236` 放行 | local gate + focused browser/validator | PASS/FAIL verdict | rerun gate or revert |

## Step 1 — Freeze Home Drift Contract

- Scope:
  - 冻结 `0234` 已经观察到的 fresh browser 与 snapshot 事实
  - 同时冻结 `root_home` asset 本体当前仍带 legacy marker/readonly table 结构的 repo 事实
  - 明确 0235 不再重查 Matrix Debug / Gallery / Prompt，只看 Home
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && python3 - <<'PY'
import json, urllib.request
obj=json.load(urllib.request.urlopen('http://127.0.0.1:30900/snapshot', timeout=10))
print(obj['snapshot']['models']['-22']['cells']['0,1,0']['labels']['page_asset_v0']['v']['id'])
PY
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && jq -r '.home.surface_marker, .home.legacy_home_datatable_detected' output/playwright/20ad18d0-3e52-4c48-9935-0464f8b4fbc2/local-effective-rerun/report.json
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "txt_home_target|home-datatable|card_home_datatable|TableColumn" packages/worker-base/system-models/home_catalog_ui.json
```

## Step 2 — Localize Home Route Mismatch

- Scope:
  - 先验证问题是否已经在 authoritative asset 层成立，而不是直接假设 route/projection 落错
  - 若 asset 本体已足以解释 drift，本步输出的结论应明确把 Step 3 写成 asset-first repair
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_home_asset_resolution.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_demo.mjs
```

## Step 3 — Fix Minimal Home Materialization Chain

- Scope:
  - 仅修定位出来的最小缺口
  - 先写失败的 focused test/validator，再修实现
  - 优先预期写入面：
    - `packages/worker-base/system-models/home_catalog_ui.json`
    - `scripts/tests/test_0235_home_surface_contract.mjs`（new）
    - `packages/ui-model-demo-frontend/scripts/validate_home_surface_local.mjs`（new）
  - 只有当 authoritative asset 修正后仍不足以让 Home 浏览器 surface 对齐时，才允许扩到：
    - `packages/ui-model-demo-frontend/src/route_ui_projection.js`
    - `packages/ui-model-demo-frontend/src/remote_store.js`
    - `packages/ui-model-demo-server/server.mjs`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0235_home_surface_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_surface_local.mjs
```

## Step 4 — Re-verify Local Home Surface

- Scope:
  - 确认 Home 已不再落到 legacy target
  - 不要求在本 iteration 内重做完整 `0234` evidence pack；只要求 enough evidence 放行 `0236`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_surface_local.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && python3 - <<'PY'
import json, urllib.request
obj=json.load(urllib.request.urlopen('http://127.0.0.1:30900/snapshot', timeout=10))
print(obj['snapshot']['models']['-22']['cells']['0,1,0']['labels']['page_asset_v0']['v']['id'])
PY
```

## Rollback Principle

- 若 Step 3 修复导致 local gate 回退，先回滚该最小代码改动
- 不通过 remote 或 ad-hoc live patch 修复 local Home 问题
