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
