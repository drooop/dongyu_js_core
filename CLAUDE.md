# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言要求 (Language Requirement)

**所有输出必须使用中文**。专有名词（如 ModelTable、Cell、MQTT、PIN_IN/OUT 等）或可能产生歧义的术语保留英文。

## 核心理念

**可以把 ModelTable 理解为"Excel 编程范式"的推广**：Cell 即数据、内建 `k` 即公式、UI 即表格的可视化。但这个项目更进一步——用 Cell 统一描述数据、UI、程序逻辑、流程，形成完整的应用系统。

核心组件：
- **ModelTable**：唯一事实来源（Cell 结构：`p/r/c/k/t/v`）
- **Software Worker Base**：解释执行 ModelTable 的运行时引擎
- **Sliding UI**：Vue3 + Element Plus 渲染器，是 ModelTable 的"投影"
- **Dual Bus**：管理总线（用户交互）+ 控制总线（MQTT 设备控制）

详细的架构评价和改进建议见 `docs/architecture_review.md`（按需查阅）。

## Critical Documents (Read First)

- **AGENTS.md** - IMMUTABLE execution constitution (never modify without explicit user instruction)
- **docs/architecture_mantanet_and_workers.md** - Architecture SSOT (Single Source of Truth)
- **docs/WORKFLOW.md** - Iteration workflow (all non-emergency work must follow this)
- **docs/ITERATIONS.md** - Iteration registry (check current status here)
- **docs/ssot/mt_v0_patch_ops.md** - mt.v0 Patch 操作规范（add_label, rm_label, create_model, cell_clear）

## Build & Development Commands

### Frontend (packages/ui-model-demo-frontend)
```bash
cd packages/ui-model-demo-frontend
npm run dev      # Vite dev server at http://127.0.0.1:5173
npm run build    # Production build
npm run test     # Run validation scripts
```

### Backend Server
```bash
node packages/ui-model-demo-server/server.mjs [--port 9000]
```

### Validation Scripts (run from repo root)
```bash
node scripts/validate_builtins_v0.mjs           # Runtime built-in operations
node scripts/validate_ui_renderer_v0.mjs        # UI renderer
node scripts/validate_ui_ast_v0x.mjs            # UI AST spec
node scripts/validate_pin_mqtt_loop.mjs         # PIN_IN/OUT + MQTT
node scripts/validate_dual_worker_slide_e2e_v0.mjs  # End-to-end flow
```

## 目录职责与文件落位 (Directory Ownership)

- 先分类再落位：新文件必须先判断属于哪一类（产品代码/部署资产/流程文档/测试资产），再决定目录，不允许“先放根目录再说”。
- 根目录只允许仓库级入口与全局配置；任何任务期产物（调试输出、临时脚本、实验文件）都不得落在根目录。
- 未经用户明确同意，不新增新的顶层目录；需要新增时优先复用现有职责目录。
- `docs/` 只用于规范、架构、流程与迭代记录（plan/resolution/runlog）。`docs/` 不是测试数据仓；测试输入、测试输出、临时快照不得放入 `docs/`。
- 迭代证据按 `docs/WORKFLOW.md` 执行：默认以 `runlog.md` 记录可复现命令与结果；仅在“必须保留的人类证据”场景下，才放 `docs/iterations/<id>/assets/`。
- 测试相关文件按用途分层：
  - 可复用且可版本化的 fixture 放 `scripts/fixtures/`（或对应 package 内 fixture 目录）。
  - 本地测试输入/临时数据库/临时导出放 `test_files/` 或 package 局部临时目录，并保持 gitignored。
- 部署与运行环境资产放在基础设施目录（如 `k8s/`），并与业务代码、文档目录分离。
- 就近归属原则：文件应放在其主要消费者旁边（哪个 package 使用，就落在哪个 package 或其子目录），避免跨域散落。
- 收尾检查是必做项：结束任务前必须确认新增文件均在职责目录内；若出现错放，先归位再结束。
- 发生文件迁移时，必须同步修正文档、脚本和命令中的路径引用，保证可执行性不回归。
- `docs/tmp/` 仅用于仓库约定的 handoff/compact 文稿，不用于存放测试数据或调试产物。

## Package Structure

| Package | Purpose |
|---------|---------|
| `packages/worker-base/` | ModelTable runtime, built-in k operations, MQTT/PIN |
| `packages/ui-renderer/` | UI AST interpretation, Vue3 component rendering |
| `packages/ui-model-demo-frontend/` | Vue3 + Vite demo app with ModelTable editor |
| `packages/ui-model-demo-server/` | Elysia.js HTTP/SSE server |
| `packages/bus-mgmt/` | Bus adapters (loopback, Matrix future) |
| `packages/mbr/` | Message Bridge Robot between buses |

## Key Architecture Patterns

### Cell Labels (k types)
- `k:"value"` - Simple value storage
- `k:"pin_in"` - Control bus input (MQTT subscription)
- `k:"pin_out"` - Control bus output (MQTT publish)
- `k:"ui_event"` - UI event mailbox (model -1, cell 0,0,1)

### Reserved Model IDs
- Model 0: Main/root model
- Model -1: Mailbox (UI events, system signals)
- Model -2: Editor state

### UI Event Flow
UI events → write to Cell (mailbox) → program model triggers observe → side effects via PIN_OUT → MQTT

## Reference Implementation

`vendor/PICtest/` contains the Python reference implementation. It serves as the **behavior oracle**:
- When implementing runtime semantics, extract behavior from PICtest first
- JS implementation should match PICtest's observable behavior
- PICtest wins when implementations disagree (unless SSOT forbids it)

## Iteration Workflow

All non-emergency work follows phases:
1. **Phase 0 (Intake)**: Create iteration in `docs/iterations/<id>/`
2. **Phase 1 (Planning)**: Write `plan.md` + `resolution.md` (docs only, no code)
3. **Phase 2 (Review Gate)**: Get Approved status before proceeding
4. **Phase 3 (Execution)**: Implement by Step, write evidence to `runlog.md`
5. **Phase 4 (Completion)**: Update ITERATIONS.md status

Branch convention: `dev_<id>` for iteration work, merge to `dev` when complete.

## Debugging

**问题定位链路**：当 UI 不符合预期时，按以下顺序排查：

```
Cell 值 → 程序模型触发器 → UI AST 生成 → Renderer 解释 → 总线消息
```

每一层都可能出问题，需要逐层检查。

```javascript
// Browser console
window.dyPrintMailbox()    // Show UI event mailbox
window.dyPrintSnapshot()   // Print ModelTable snapshot
window.__DY_STORE          // Access store directly

// Runtime inspection
runtime.eventLog.list()    // Label operations (Cell 变化)
runtime.mqttTrace.list()   // MQTT events (总线消息)
```

## Important Constraints

- **UI is projection only**: UI reads from ModelTable; changes write to cells
- **No UI-only validation**: All validation must be scriptable and reproducible
- **Behavior-oracle first**: Runtime semantics come from PICtest, not invented
- **Verification-first**: Every change needs executable verification
