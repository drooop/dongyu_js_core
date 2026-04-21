---
title: "0237 — local-browser-surface-regressions-fix Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0237-local-browser-surface-regressions-fix
id: 0237-local-browser-surface-regressions-fix
phase: phase1
---

# 0237 — local-browser-surface-regressions-fix Resolution

## HOW

0237 的执行方式采用“先冻结 repo-green/live-red 差异，再补 focused regression guard，最后只修最小 surface 链路”的顺序推进。

当前重写本文件的原因也必须明确记录：

- 旧版 0237 `resolution.md` 仍有 `<new-...>` / `<focused-browser-surface-rerun>` 占位符
- 旧版还引用了仓库中不存在的 `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`
- 因而旧版 HOW 不满足自包含、可执行、可审计要求

本版 HOW 的核心原则：

- 不改 Tier 1 runtime semantics
- 不把 0237 偷扩成 baseline/deploy iteration
- 不用 fallback AST 或文案遮盖 `page_asset_v0` / selected-state 真问题
- 只在 server snapshot / frontend projection / selector consumption 范围内做最小修复
- 如果事实证明问题已超出该范围，立即停止并拆 follow-up

## Preconditions

- Working directory:
  - `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Target branch:
  - `dropx/dev_0237-local-browser-surface-regressions-fix`
- Canonical live local endpoint:
  - `http://127.0.0.1:30900`
- Required tools:
  - `node`
  - `npm`
  - `curl`
  - `jq`
- Known repo-side green facts before execution:
  - `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `node scripts/tests/test_0212_home_crud_contract.mjs`
- Known live local red facts before execution:
  - `curl /snapshot` currently shows:
    - `ui_page = "home"`
    - `ws_app_selected = -100`
    - `selected_model_id = -2`
    - `editor_model_options_json` lacks `value == 0`
    - `Model -100 / 0,1,0 / page_asset_v0 = null`

## Delivery Boundaries

- Allowed:
  - minimal changes in:
    - `packages/ui-model-demo-server/server.mjs`
    - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
    - `packages/ui-renderer/src/renderer.mjs`
    - `packages/ui-renderer/src/renderer.js`
    - `packages/ui-model-demo-frontend/src/route_ui_projection.js` only if Step 1 proves it is still needed
  - new focused tests / validators
  - `docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md` during Phase 3 only
- Not allowed:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - remote deploy / remote browser / remote evidence
  - silent fallback around missing Matrix Debug asset
  - broad baseline/deploy script changes unless 0237 is explicitly re-planned

## Stop Conditions

- Step 1 若证明 Matrix Debug failure 只能通过 persisted-asset/deploy pipeline 解释，而不是 server/frontend snapshot-projection-consumption 链路，0237 必须停止并拆 follow-up。
- 任一步若需要改 runtime label semantics、model placement semantics 或 `0213` / `0212` formal contract，必须停止并重新规划。
- 若 renderer 只改了 `renderer.mjs` 或只改了 `renderer.js`，视为未完成，不得进入 Step 4。

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Freeze Dual Regression Contract | 冻结 `0236` browser evidence、2026-03-26 live `/snapshot`、repo-side green validators 三组事实，确认问题落点 | `0236` runlog/report, `server.mjs`, `editor_page_state_derivers.js`, existing tests/validators | `jq` + `curl` + existing green validators | 只读，无业务回退 |
| 2 | Add Focused Regression Guards | 为 Matrix Debug browser surface 与 Home model selector 漂移补最小红灯 guard | new `test_0237_local_browser_surface_contract.mjs`, new `validate_local_browser_surface_server_sse.mjs`, existing editor validator | new focused tests/validators must be executable and initially red on current regression | 删除新增 guard |
| 3 | Fix Minimal Local Surface Chain | 修最小 server/frontend surface 链路，使 Step 2 由红转绿，同时保持旧合同不回退 | `server.mjs`, `editor_page_state_derivers.js`, `renderer.mjs`, `renderer.js`, optional `route_ui_projection.js`, Step 2 guards | focused guards + existing contracts + frontend build | 回退最小修复 commit |
| 4 | Re-verify Live Local Surface | 用 isolated validator + live snapshot spot-check 证明两处 regression 都消失，并为后续 browser rerun 放行 | Step 3 changed files + live `30900/snapshot` | isolated PASS + live `curl/jq` PASS | 回退 Step 3 或判定 live-unverified |

## Step 1 — Freeze Dual Regression Contract

- Scope:
  - 冻结 2026-03-25 `0236` browser 证据中的 Matrix Debug failure
  - 冻结 2026-03-26 live local `/snapshot` 中的 state drift
  - 同时确认 repo-side contract 与 isolated server-state validator 仍是 PASS
  - 本步的输出必须明确回答：
    - Matrix Debug failure 是 live state / snapshot 侧缺口，还是 workspace selected projection 侧缺口？
    - Home selector 是 option inventory 缺口、selected value 类型漂移，还是两者同时存在？
- Files:
  - `docs/iterations/0236-local-home-browser-evidence-rerun/runlog.md`
  - `output/playwright/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/local-home-rerun/report.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `scripts/tests/test_0212_home_crud_contract.mjs`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && jq '{matrix_debug, notes}' output/playwright/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/local-home-rerun/report.json
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq '{ui_page: .snapshot.models["-2"].cells["0,0,0"].labels.ui_page.v, ws_app_selected: .snapshot.models["-2"].cells["0,0,0"].labels.ws_app_selected.v, selected_model_id: .snapshot.models["-2"].cells["0,0,0"].labels.selected_model_id.v, editor_options_has_model0: (.snapshot.models["-2"].cells["0,0,0"].labels.editor_model_options_json.v | any(.value == 0)), trace_asset: .snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0.v}'
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs
```

- Acceptance:
  - 已书面冻结以下差异：
    - browser report 红
    - live `/snapshot` 红
    - repo-side contract / isolated server-state 绿
  - 已明确 Step 2 需要覆盖的两种失败：
    - `matrix_debug` selected app 无法解析 formal surface
    - Home selector inventory/value drift 不能表达 `model0`
  - 若 Step 1 已能证明问题超出 server/frontend scope，必须停止，不进入 Step 2
- Rollback:
  - 本步只读；无业务回退

## Step 2 — Add Focused Regression Guards

- Scope:
  - 把当前双 regression 写成 focused、可重复、可判定的 guard
  - guard 必须同时覆盖：
    - Matrix Debug selected workspace app 应解析到 formal surface，而不是 `ws_no_ast`
    - Home selector options 必须包含 `value == 0`
    - Home selector current value 必须与 option inventory 可匹配，不能再表现为 raw stray negative model
  - 旧版 scaffold 中的占位命令必须在此步被替换成真实文件和真实断言
- Files:
  - `scripts/tests/test_0237_local_browser_surface_contract.mjs` (new)
  - `packages/ui-model-demo-frontend/scripts/validate_local_browser_surface_server_sse.mjs` (new)
  - `packages/ui-model-demo-frontend/scripts/validate_editor.mjs` (existing, only if a small assertion extension is still needed)
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0237_local_browser_surface_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_local_browser_surface_server_sse.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_editor.mjs
```

- Acceptance:
  - Step 2 新增 guard 文件存在且命名固定
  - 在当前 regression 基线下，focused guards 应能稳定暴露红灯
  - generic editor validator 仍保持可运行，不因 focused guard 引入新的基础破坏
- Rollback:
  - 删除 Step 2 新增 guard 文件
  - 若扩写了现有 validator，则回退到执行前版本

## Step 3 — Fix Minimal Local Surface Chain

- Scope:
  - 先以 Step 2 的红灯为准，修最小 surface chain
  - Matrix Debug 修复优先顺序：
    - live/client snapshot 中 `Model -100 / 0,1,0 / page_asset_v0`
    - workspace selected-model projection
    - renderer consumption
  - Home selector 修复优先顺序：
    - `editor_model_options_json` inventory 生成
    - `selected_model_id` / option value normalization
    - Select 组件对 string/int current value 的匹配行为
  - 不允许把 Matrix Debug 问题“修”成 fallback AST；不允许为了显示 `model0` 而破坏负数模型 inspect 能力
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-model-demo-frontend/src/route_ui_projection.js`
    - only if Step 1 proves route composition is still wrong after state correction
  - Step 2 新增 guard 文件
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0237_local_browser_surface_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_local_browser_surface_server_sse.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_editor.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build
```

- Acceptance:
  - Step 2 focused guards 从红转绿
  - `0213` Matrix Debug contract 与 `0212` Home CRUD contract 仍保持 PASS
  - 若 renderer 被触达，`.mjs` / `.js` 两份实现均已同步
  - 修复解释仍然停留在 server/frontend surface scope 内
- Rollback:
  - 回退 Step 3 最小修复 commit
  - 若 touched renderer，必须成对回退 `renderer.mjs` 与 `renderer.js`
  - 重跑 Step 3 verification，确认回到执行前状态

## Step 4 — Re-verify Live Local Surface

- Scope:
  - 用 isolated validator 确认 repo-side fixed state
  - 再用 live local endpoint spot-check 证明真实 local browser input surface 已经不再重复当前 regression
  - 本 iteration 不要求在 Step 4 内重跑完整 orchestrator browser task，但必须为下一条 browser rerun 提供明确放行依据
- Files:
  - Step 3 实际改动文件
  - `scripts/tests/test_0237_local_browser_surface_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_local_browser_surface_server_sse.mjs`
  - live `http://127.0.0.1:30900/snapshot`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0237_local_browser_surface_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_local_browser_surface_server_sse.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0.v.id == "matrix_debug_root"'
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '(.snapshot.models["-2"].cells["0,0,0"].labels.editor_model_options_json.v | any(.value == 0)) and (.snapshot.models["-2"].cells["0,0,0"].labels.selected_model_id.v == 0 or .snapshot.models["-2"].cells["0,0,0"].labels.selected_model_id.v == "0")'
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node --input-type=module - <<'NODE'
import { buildAstFromSchema } from './packages/ui-model-demo-frontend/src/ui_schema_projection.js';
import { resolveRouteUiAst } from './packages/ui-model-demo-frontend/src/route_ui_projection.js';

const response = await fetch('http://127.0.0.1:30900/snapshot');
if (!response.ok) throw new Error(`snapshot_http_${response.status}`);
const body = await response.json();
const snapshot = body && body.snapshot ? body.snapshot : null;
if (!snapshot) throw new Error('snapshot_missing');

function findNode(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

const workspaceAst = resolveRouteUiAst(snapshot, '/workspace', { projectSchemaModel: buildAstFromSchema }).ast;
if (!findNode(workspaceAst, 'matrix_debug_header_card')) {
  throw new Error('matrix_debug_header_card_missing_from_live_workspace_projection');
}
console.log('PASS live_workspace_projection_matrix_debug');
NODE
```

- Acceptance:
  - isolated focused guards PASS
  - live `/snapshot` 不再出现 `trace_asset = null`
  - live home state 至少满足：
    - `editor_model_options_json` 包含 `0`
    - `selected_model_id` 回到 `0`
  - live route projection 不再落到 `ws_no_ast` warning
- Rollback:
  - 若 Step 3 已绿但 Step 4 live spot-check 仍红：
    - 先判定为 `repo-fixed / live-unverified`
    - 不得声称 browser regression 已 fully closed
  - 若确定是 Step 3 改动引入的 live regression，则回退 Step 3 最小修复并停止

## Rollback Principle

- 0237 的回退必须保持最小化：
  - 先回退 Step 3 修复
  - 再回退 Step 2 focused guard（仅在确认整个方案取消时）
- 不通过 fallback UI、手工改 live snapshot、或临时 browser workaround 来“回滚”
- 若最终证实问题根因超出 0237 的 server/frontend surface 边界，则回滚本 iteration 的尝试并拆分 follow-up iteration
