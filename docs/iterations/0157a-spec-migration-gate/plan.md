---
title: "0157a — 规约 Diff 合并 + SSOT 正式切换"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0157a-spec-migration-gate
id: 0157a-spec-migration-gate
phase: phase1
---

# 0157a — 规约 Diff 合并 + SSOT 正式切换

## 0. Metadata

- ID: `0157a-spec-migration-gate`
- Date: 2026-03-06
- Branch: `dev_0157a-spec-migration-gate`
- Type: docs-only（Phase 1）
- 前置：无
- 依赖输出：为 0157b~0163 提供 SSOT 法律基础

## 1. Goal

在不触碰运行时代码的前提下，将新版规约合并进项目：

1. 新 label.t（PIN 体系）成为 SSOT 权威定义。
2. 旧 label.t 在兼容期内标记为 DEPRECATED（禁止新模型继续引入）。
3. `docs/ITERATIONS.md` 先登记 0157a~0163，满足后续迭代执行门禁。

## 2. Scope

### 2.1 In Scope

- 更新 `docs/ITERATIONS.md`：新增 0157a~0163 条目，状态 `Planned`。
- 更新仓库根 `CLAUDE.md`（逐条款 diff 合并，不整文件替换）：
  - 新增 `PIN_SYSTEM`、`MODEL_FORMS`、`FUNCTION_LABELS`、`MODEL_TYPE_REGISTRY`。
  - 更新 `CAPABILITY_TIERS`：追加新类型，并将旧类型标记为兼容期 DEPRECATED。
  - 更新 `FORBIDDEN`：新增“新模型禁止使用 DEPRECATED label types”。
  - 更新 `ARCH_INVARIANTS`：补充 PIN decoupling 与模型形态约束。
- 更新 `docs/ssot/runtime_semantics_modeltable_driven.md`（逐条款合并）：
  - 在 §5.2 增补新 label.t 与 DEPRECATED 映射。
  - 新增 §5.3 模型形态约束。
  - 新增 §6 函数标签格式。
  - 新增 §8 数据模型 PIN 接口规范。
- 新建 `docs/ssot/label_type_registry.md`。
- 更新 `docs/architecture_mantanet_and_workers.md`：补充 §3.4 模型形态、§6 PIN 系统、§7 能力分层。

### 2.2 Out of Scope

- 任何 runtime/server/worker 代码变更。
- JSON patch、fixtures、测试脚本迁移。
- 旧兼容分支清理（0163 执行）。

## 3. Invariants / Constraints

- 严格遵循 `CLAUDE.md`：Phase 1 仅文档改动。
- `WORKFLOW.md` 门禁：后续 Phase 3 之前必须有明确 Gate 记录。
- `fill-table-only` 门禁与分支命名约束在本迭代只记录，不执行代码层开关操作。
- pin.model.* 不处理 `model_id=0`；`model_id=0` 对外出入口由 pin.bus.* 专属。

## 4. Success Criteria

- `docs/ITERATIONS.md` 已可检索到 0157a~0163。
- `CLAUDE.md` 出现并定义 `PIN_SYSTEM` / `MODEL_FORMS` / `FUNCTION_LABELS` / `MODEL_TYPE_REGISTRY`。
- `docs/ssot/runtime_semantics_modeltable_driven.md` 出现 §5.3、§6、§8 新条款。
- `docs/ssot/label_type_registry.md` 已创建并可读。
- `docs/architecture_mantanet_and_workers.md` 出现 §3.4、§6、§7。

## 5. Risks

1. 条款合并遗漏导致后续迭代引用歧义。
   - 缓解：统一以 grep 检查关键段落存在。
2. 文档编号调整影响历史引用。
   - 缓解：仅新增，不删除旧语义条款；通过 runlog 记录变更点。
3. 旧新术语并存造成误读。
   - 缓解：在注册表与 CLAUDE 同步标注 DEPRECATED。
