---
title: "0239 — local-home-selector-model0-fix Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-26
source: ai
iteration_id: 0239-local-home-selector-model0-fix
id: 0239-local-home-selector-model0-fix
phase: phase1
---

# 0239 — local-home-selector-model0-fix Resolution

## HOW

0239 的执行方式采用“先冻结 home selector 当前合同，再补 focused guard，然后修最小 state chain，最后用 live local spot-check 为 `0240` 放行”的顺序推进。

本版 HOW 的目标不是保留一个空 scaffold，而是把当前真实代码事实写成可执行合同：

- `model0` option 目前为何缺失
- `selected_model_id` 在 `home` 为何会继承 stray 值
- local demo / server / browser current value 三段链路该如何对齐

核心原则：

- 不改 Tier 1 runtime semantics
- 不把 0239 偷扩成 Matrix Debug、remote browser 或 baseline iteration
- 不用 fallback 文案、静态占位值、或手工改 live state 来假装 `model0` 已经可选
- 先修 source state，再决定是否需要最小化触达 renderer consumption
- 如果最小写入面不足以解释 failure，必须先在 `runlog.md` 写清楚新增断点，再扩 scope

## Preconditions

- Working directory:
  - `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Target branch:
  - `dropx/dev_0239-local-home-selector-model0-fix`
- Canonical live local endpoint:
  - `http://127.0.0.1:30900`
- Required tooling:
  - `bash`
  - `node`
  - `npm`
  - `curl`
  - `jq`
- Strongest current hypothesis before execution:
  - `deriveEditorModelOptions()` 仍在 inventory 阶段排除了 `model0`
  - `server.mjs` 只有 `workspace` 选择同步，没有 `home` canonical reset
  - `demo_modeltable.js` 的首页 baseline 仍是 `selected_model_id = '1'`
  - browser current-value 问题至少部分由 source-state drift 引起，renderer 只应作为条件扩展

## Delivery Boundaries

- Allowed minimal write surface:
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `scripts/tests/test_0239_home_selector_model0_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_home_selector_server_sse.mjs`
- Read-only but mandatory investigation surface:
  - `docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md`
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `scripts/tests/test_0212_home_crud_contract.mjs`
  - `scripts/tests/test_0182_workspace_route_init_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
- Conditional write surface:
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
- Not allowed:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - Matrix Debug files / deploy scripts / remote scripts
  - 手工写数据库、手工改 live `/snapshot`、手工改 persisted data 来伪造 `selected_model_id = 0`

## Stop Conditions

- Step 1 若证明 current failure 不能用 `inventory omission + home canonicalization gap + type alignment risk` 解释，必须先记录新的断点，再决定是否继续。
- 任一步若需要修改 runtime label semantics、model placement semantics、或 Home page formal asset contract，必须停止并重新规划。
- 若 Step 3 触达 renderer，但只改了 `.mjs` 或只改了 `.js`，视为未完成，不得进入 Step 4。
- Step 4 若 live `30900` endpoint 不可达，只能报 `repo-fixed / live-unverified`，不得声称 local environment 已 fully ready。

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Freeze Home Selector Contract | 固定 0237 证据与当前代码事实，明确问题是否收敛在 inventory + home reconciliation + type alignment | `0237` runlog, `home_catalog_ui.json`, `editor_page_state_derivers.js`, `server.mjs`, `demo_modeltable.js`, `renderer.mjs/js` | `sed` + `rg` source checks | 只读，无业务回退 |
| 2 | Add Focused Selector Guards | 新增最小红灯 guard，覆盖 model0 inventory、home canonical selected value、server/local parity | new focused test + new server validator + existing home/workspace contracts | focused tests + existing contracts | 删除新增 guard / 回退 validator 扩写 |
| 3 | Fix Minimal Home Selector State Chain | 修最小 derivation/reconciliation 链路，使 Step 2 由红转绿，并保持 workspace/home 合同不回退 | `editor_page_state_derivers.js`, `server.mjs`, `demo_modeltable.js`, optional `renderer.mjs/js` | focused tests + existing contracts + build | 回退最小修复 commit |
| 4 | Re-verify Live Local Readiness | 用 deterministic live `ui_event + /snapshot` spot-check 证明 `model0` 已能作为 Home canonical current value，为 0240 放行 | Step 3 changed files + live `30900` endpoint | repo-side PASS + live snapshot PASS | 回退 Step 3 或恢复 live probe 前状态 |

## Step 1 — Freeze Home Selector Contract

- Scope:
  - 重新冻结 `0237` 已确认的 Home selector 红灯事实
  - 用当前代码直接确认三项 source-level gap：
    - `editor_model_options_json` 目前为何没有 `0`
    - `ui_page = home` 时为何没有 `selected_model_id = 0` 的 canonical reconcile
    - local demo 与 server baseline 为何不一致
  - 同时确认 renderer 只是“待验证风险位”，不是先验默认写入面
- Files:
  - `docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md`
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '20,90p' docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '80,135p' packages/worker-base/system-models/home_catalog_ui.json
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "m\\.id !== 0|selected_model_id|uiPage !== 'workspace'|ensureLabel\\(runtime, stateModel, 0, 0, 0, \\{ k: 'selected_model_id'" packages/ui-model-demo-frontend/src/editor_page_state_derivers.js packages/ui-model-demo-server/server.mjs packages/ui-model-demo-frontend/src/demo_modeltable.js
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '565,590p' packages/ui-renderer/src/renderer.mjs && sed -n '565,590p' packages/ui-renderer/src/renderer.js
```

- Acceptance:
  - 已书面固定当前 Home selector 的三条关键事实：
    - Home `Select` 绑定 `editor_model_options_json` 与 `selected_model_id`
    - `deriveEditorModelOptions()` 当前排除了 `model0`
    - server 只有 `workspace` selection reconcile，local demo 首页初始 baseline 仍是 `1`
  - 已确认 renderer 当前只是直接透传绑定值；是否需要触达 renderer 要留给 Step 2/3 的 focused guard 再裁决
  - Step 2 的最小 guard 面能够据此收敛到 state/projection 问题，而不是抽象“浏览器坏了”
- Rollback:
  - 本步只读；无业务回退

## Step 2 — Add Focused Selector Guards

- Scope:
  - 把 0239 问题收敛成 focused、可重复、可判定的红灯 guard
  - guard 至少覆盖三类断言：
    - `editor_model_options_json` 必须包含 `value == 0`
    - `ui_page = home` 时，`selected_model_id` 必须归一回 canonical `0`
    - local demo 与 server 初始首页 baseline 必须一致，不允许一个是 `0`、一个是 `1`
  - 如果 Step 1 证明 renderer 也必须被 guard 覆盖，则在本步补充对应断言，而不是把 renderer 风险留到人工 eyeballing
- Files:
  - `scripts/tests/test_0239_home_selector_model0_contract.mjs` (new)
  - `packages/ui-model-demo-frontend/scripts/validate_home_selector_server_sse.mjs` (new)
  - `packages/ui-model-demo-frontend/scripts/validate_editor.mjs` (only if a small renderer-focused assertion extension is required)
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0239_home_selector_model0_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_selector_server_sse.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_workspace_route_init_contract.mjs
```

- Acceptance:
  - 新增 focused guard 文件存在且命名固定
  - 在当前 regression 基线下，新 guard 能稳定暴露红灯
  - `test_0212_home_crud_contract` 与 `test_0182_workspace_route_init_contract` 仍保持可运行，说明 guard 没有错误扩大 scope
  - 若本步确认 renderer 必须纳入 guard，`runlog.md` 中必须先记录原因，再允许 Step 3 触达 `renderer.mjs/js`
- Rollback:
  - 删除 Step 2 新增 guard 文件
  - 若扩写了 `validate_editor.mjs`，回退到执行前版本

## Step 3 — Fix Minimal Home Selector State Chain

- Scope:
  - 以 Step 2 红灯为准，修最小 derivation / reconciliation 链路
  - 修复优先顺序：
    - `editor_model_options_json` 重新表达 `model0`
    - `ui_page = home` 时的 `selected_model_id` canonicalization
    - local demo 与 server baseline 对齐
    - 只有在前 3 项都为绿但 browser current value 仍失败时，才允许最小化触达 renderer
  - 不允许通过“把所有页面都 reset 为 `0`”来换取 Home green
  - 不允许通过隐藏其他模型来伪造 `model0` 选中成功
- Files:
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
    - only if Step 2 proves state-side green is insufficient
  - `packages/ui-model-demo-frontend/src/remote_store.js`
    - only if Step 2/3 proves fallback `?? 1` still reintroduces home drift
  - Step 2 focused guard files
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0239_home_selector_model0_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_selector_server_sse.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_workspace_route_init_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_editor.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build
```

- Acceptance:
  - Step 2 focused guards 从红转绿
  - server 与 local demo 首页 baseline 对齐为 `0`
  - `editor_model_options_json` 包含 `value == 0`
  - `ui_page = home` 时，`selected_model_id` 回到 `0` / `"0"` 的同值表示
  - `workspace` 现有同步合同没有回退
  - 若 renderer 被触达，`.mjs` 与 `.js` 行为保持对齐，且必须由 focused guard 证明确有必要
- Rollback:
  - 使用 `git revert <step3_commit>` 回退最小修复
  - 若 touched renderer，必须成对回退 `renderer.mjs` 与 `renderer.js`
  - 回退后重跑上述验证命令，确认恢复到执行前状态

## Step 4 — Re-verify Live Local Readiness

- Scope:
  - 用 repo-side green + live local deterministic probe 两层一起证明 0239 已为 `0240` 做好前置条件
  - 本步不要求完整 browser rerun，但必须证明 live local endpoint 上：
    - `model0` 已进入 option inventory
    - `ui_page = home` 时，stray `selected_model_id` 会被拉回 canonical `0`
- Files:
  - Step 3 实际改动文件
  - `packages/ui-model-demo-frontend/scripts/validate_home_selector_server_sse.mjs`
  - live `http://127.0.0.1:30900/ui_event`
  - live `http://127.0.0.1:30900/snapshot`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_selector_server_sse.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node --input-type=module - <<'NODE'
const base = 'http://127.0.0.1:30900';

async function postEnvelope(envelope) {
  const resp = await fetch(`${base}/ui_event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
  });
  if (!resp.ok) throw new Error(`ui_event_http_${resp.status}`);
  const data = await resp.json();
  if (!data.ok || data.result === 'error') {
    throw new Error(`ui_event_failed:${data.code || data.detail || 'unknown'}`);
  }
}

function labelUpdate(opId, key, value) {
  return {
    event_id: Date.now(),
    type: 'label_update',
    source: 'it0239_probe',
    ts: Date.now(),
    payload: {
      action: 'label_update',
      meta: { op_id: opId },
      target: { model_id: -2, p: 0, r: 0, c: 0, k: key },
      value,
    },
  };
}

await postEnvelope(labelUpdate('it0239_force_selected_stray', 'selected_model_id', { t: 'str', v: '-2' }));
await postEnvelope(labelUpdate('it0239_force_home', 'ui_page', { t: 'str', v: 'home' }));

const snapResp = await fetch(`${base}/snapshot`);
if (!snapResp.ok) throw new Error(`snapshot_http_${snapResp.status}`);
const snapData = await snapResp.json();
const labels = snapData?.snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels ?? {};
const selected = labels.selected_model_id?.v;
const options = Array.isArray(labels.editor_model_options_json?.v) ? labels.editor_model_options_json.v : [];

if (!(selected === 0 || selected === '0')) {
  throw new Error(`selected_model_id_not_home_canonical:${selected}`);
}
if (!options.some((entry) => entry && entry.value === 0)) {
  throw new Error('model0_option_missing');
}

console.log('PASS live_home_selector_model0_spot_check');
NODE
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '(.snapshot.models["-2"].cells["0,0,0"].labels.ui_page.v == "home") and ((.snapshot.models["-2"].cells["0,0,0"].labels.selected_model_id.v == 0) or (.snapshot.models["-2"].cells["0,0,0"].labels.selected_model_id.v == "0")) and (.snapshot.models["-2"].cells["0,0,0"].labels.editor_model_options_json.v | any(.value == 0))'
```

- Acceptance:
  - repo-side focused validator 保持 PASS
  - live local probe 能稳定把 stray home selection 拉回 `0`
  - live `/snapshot` 上同时满足：
    - `ui_page == "home"`
    - `selected_model_id == 0` 或 `"0"`
    - `editor_model_options_json` contains `value == 0`
  - 已为 `0240` 提供 deterministic downstream 前置条件，不需要再靠人工页面操作猜测是否修好
- Rollback:
  - 若需要回退代码，先 `git revert <step3_commit>`，再重跑 Step 4 验证
  - 若只需要恢复 live probe 前的 UI 状态，使用相同 `/ui_event` 路径把 Step 4 开始时记录的 `ui_page` 与 `selected_model_id` 写回

