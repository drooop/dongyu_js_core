# PROJECT KNOWLEDGE BASE

Generated: 2026-02-14 01:11:19 +08:00
Commit: d9209a1
Branch: dev

## OVERVIEW
本仓库是 ModelTable-driven runtime + UI demo + worker orchestration 的混合仓库。
执行约束以 `CLAUDE.md` 为唯一最高优先级，`AGENTS.md` 仅做分层导航与本地工作提示。

## REPO-LOCAL COLLABORATION
- Scope:
  - 本节补充本仓库里的默认协作方式、汇报方式与信息搜集边界。
  - 若与 `CLAUDE.md` 或更高优先级文档冲突，以高优先级文档为准。
- Language:
  - 默认使用简体中文。
  - proper nouns 与容易歧义的概念保留 English。
  - 最终对用户汇报时，用平实、易懂的话说明结果；避免术语堆叠、实现细节和代码腔。
- Response style:
  - 第一行先给结论或当前状态，再写下一步（如果有）。
  - 不写寒暄，不做情绪性铺垫，不用教程口吻，不用营销口吻。
  - 不使用 emoji。
- Done criteria first:
  - 开始前先定义完成标准，并把它当作本轮收尾检查单。
  - 如果任务依赖运行结果、页面行为或脚本输出，完成标准里必须包含对应验证。
- Self-verification before reporting:
  - 写完不等于完成；回复前必须用可用工具自检。
  - 能运行就运行，能点流程就点流程，能看输出就看输出。
  - Web/UI 任务要检查页面加载、关键交互、渲染与行为。
  - Script/CLI 任务要用真实或有代表性的输入验证；能补边界情况时一并补。
  - 如果发现异常，先修复并重测；不要把“待用户再看一眼”当成交付。
  - 目标是让用户不需要参与中间 spot-check；除非确实缺少关键输入，否则尽量一次交付可用结果。
- Conventions discovery:
  - 新仓库或陌生区域，先只读这些入口：
    - `AGENTS.md`
    - `README.md`
    - `docs/ssot/`（优先 index / overview / manifest 类入口）
    - `docs/*.md` 第一层 Markdown（优先 `WORKFLOW` / `ARCHITECTURE` / `TERMS` / `CONTRIBUTING` / `ROADMAP` / `ITERATIONS`）
  - 沿文档内链最多跟进 2 层；到此为止，避免无限扩散。
- Missing critical constraints:
  - 如果 tech stack、entry points、acceptance criteria、branch/commit/PR 规则仍不清楚，最多问 3 个问题。
  - 每个问题都必须直接降低关键不确定性。
  - 在这些关键边界未明确前，不要靠猜测继续。
- Assumptions and boundaries:
  - 信息不完整但还能推进时，要显式写出假设，并说明如何验证这些假设。
  - 如果缺失信息会让结果不可靠，先指出缺的边界，再给出继续方案选项。
  - 不编造外部事实；拿不准就明确说不确定，并给出验证方法。

## STRUCTURE
```text
./
|- CLAUDE.md                  # authoritative constraints (SSOT for execution)
|- docs/                      # governance, SSOT, workflow, iterations ledger
|- scripts/                   # deterministic validators + ops/deploy entrypoints
|- packages/
|  |- worker-base/            # runtime interpreter and model semantics
|  |- ui-renderer/            # AST renderer and event dispatch adapter
|  |- ui-model-demo-frontend/ # Vue demo app and local/remote stores
|  |- ui-model-demo-server/   # HTTP/SSE server + auth + runtime host
|- deploy/sys-v1ns/           # fill-table patches (remote-worker / mbr)
|- k8s/                       # local/cloud manifests + image Dockerfiles
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| 执行优先级与硬约束 | `CLAUDE.md` | lower docs MUST NOT override higher docs |
| Dropmode 会话迁移协议 | `CODEX_HANDOFF_MODE.md` | developer workflow only; unrelated to fill-table/runtime semantics |
| 迭代流程与闸门 | `docs/WORKFLOW.md`, `docs/ITERATIONS.md` | iteration must be registered before work |
| 运行时语义/边界 | `docs/ssot/runtime_semantics_modeltable_driven.md` | mailbox, BUS_IN/OUT, CELL_CONNECT invariants |
| 标签注册表 | `docs/ssot/label_type_registry.md` | authoritative label.t registry + placement rules |
| 宿主能力边界 | `docs/ssot/host_ctx_api.md` | negative-model ctx API rules |
| Feishu 对齐裁决与协作文档组 | `docs/ssot/feishu_alignment_decisions_v0.md` | contains the 4 maintained Feishu docs, their URLs, purposes, and maintenance chain |
| Runtime 内核实现 | `packages/worker-base/src/runtime.js`, `packages/worker-base/src/runtime.mjs` | dual CJS/ESM must stay behavior-aligned |
| UI 渲染契约 | `packages/ui-renderer/src/renderer.mjs` | host adapter contract, event normalization |
| 前端入口 | `packages/ui-model-demo-frontend/src/main.js` | local/remote mode bootstrap |
| 服务器入口 | `packages/ui-model-demo-server/server.mjs` | serves frontend + runtime orchestration |
| 脚本验证入口 | `scripts/tests/`, `scripts/validate_*.mjs` | no single root test runner |
| 部署前置检查 | `scripts/ops/check_runtime_baseline.sh`, `scripts/ops/ensure_runtime_baseline.sh` | ensure script may mutate/deploy |

## CONVENTIONS
- Authority: `CLAUDE.md` > docs SSOT/charter/workflow > other docs.
- `docs/handover/**`, `docs/roadmaps/**`, `docs/logs/**` are non-normative unless explicitly promoted; do not use them to override `CLAUDE.md` or `docs/ssot/**`.
- Planning gate: no plan -> no code change; no Approved -> no execution.
- Iteration gate: register in `docs/ITERATIONS.md` before implementation.
- Single-developer workflow: default is local verification + local merge into `dev` + push; do not open a PR unless the user explicitly asks.
- Codex developer workflow supplements live in `CODEX_HANDOFF_MODE.md`; they govern chat/session migration only, not product/runtime behavior. Canonical trigger skill is `$dropmode`.
- Model discipline: ModelTable is SSOT, UI is projection only.
- Side effects: only via `add_label` / `rm_label`.
- Capability policy: fill-table-first; runtime changes only for interpreter semantics or bugfixes.
- Verification style: deterministic PASS/FAIL; avoid "looks ok".

## ANTI-PATTERNS (THIS PROJECT)
- Remote ops forbidden set in `CLAUDE.md` (k3s/systemctl/rancher/CNI/firewall/network mutations).
- Direct commits to `dev` (except merge commits).
- Routine PR creation in single-developer flow when the user did not ask for a PR.
- UI direct bus side effects or direct business-state writes.
- Side effects outside mailbox contract or outside `add_label` / `rm_label`.
- Silent failure (must write failure to ModelTable).
- Debug/temp artifacts in repo root, committed `logs/*.log`, repo secrets.

## UNIQUE STYLES
- Mixed runtime/tooling: Node scripts + Bun in selected Dockerfiles.
- Script-centric verification: `scripts/tests/test_*.mjs` and `scripts/validate_*.mjs` are first-class test surface.
- Historical ledger model: `docs/iterations/*` is evidence archive, not policy source.

## COMMANDS
```bash
# deterministic local checks
node scripts/tests/test_cell_connect_parse.mjs
node scripts/tests/test_bus_in_out.mjs
node scripts/validate_builtins_v0.mjs
node scripts/validate_ui_ast_v0x.mjs --case all

# frontend package
npm -C packages/ui-model-demo-frontend run build
npm -C packages/ui-model-demo-frontend run test

# pre-flight before e2e/deploy
bash scripts/ops/check_runtime_baseline.sh
bash scripts/ops/ensure_runtime_baseline.sh
```

## NOTES
- Root `npm test` is placeholder and intentionally fails; do not use as project signal.
- `scripts/ops/ensure_runtime_baseline.sh` can auto-apply/deploy; treat as mutating operation.
- `CLAUDE.m` file is absent in repo; canonical file is `CLAUDE.md`.
