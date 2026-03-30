---
title: "Iteration 0191b-gallery-compliance-fix Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0191b-gallery-compliance-fix
id: 0191b-gallery-compliance-fix
phase: phase1
---

# Iteration 0191b-gallery-compliance-fix Plan

## Goal

- 修复 `0191b` 审查中指出的硬规则问题：`CLAUDE.md` 的 `MODEL_ID_REGISTRY` 未登记 `-101/-102/-103`。
- 顺手吸收一条低成本一致性修复：`gallery_store.js` 中将硬编码 `-2` 改为常量引用。

## Background

- `0191b-gallery-modelization` 已完成，但审查指出：
  - `packages/ui-model-demo-frontend/src/model_ids.js` 分配了 `-101/-102/-103`
  - `CLAUDE.md` 的 `MODEL_ID_REGISTRY` 尚未登记这些 id
  - `CLAUDE.md` 明确规定：使用未登记的 model_id range 属于 violation
- 同一轮审查还指出：
  - `gallery_store.js` 中对 Model `-2` 的读取仍是硬编码，可改为常量

## Scope

- In scope:
  - 在 `CLAUDE.md` 中登记 `-101/-102/-103`
  - 补充 `-100..-199` 的分配策略
  - 将 `gallery_store.js` 中的 `-2` 改为常量
- Out of scope:
  - 不处理 `gallery_model.js` dead code 清理
  - 不启动 `0191c`
  - 不调整 Gallery 行为和页面内容

## Invariants / Constraints

- 必须满足 `CLAUDE.md` 对 `MODEL_ID_REGISTRY` 的硬约束。
- 不得引入新的 model_id 分配，只允许把现有已使用 id 正式登记。
- 不改变 Gallery 运行时行为。

## Success Criteria

- `CLAUDE.md` 中存在 `-101/-102/-103` 的正式登记说明。
- `CLAUDE.md` 中补齐 `-100..-199` 的分配策略，不再出现“已使用但未覆盖区间”。
- `gallery_store.js` 不再直接写 `-2`。
- Gallery 相关验证保持通过。

## Risks & Mitigations

- Risk:
  - 只登记具体 id，不补区间策略。
  - Impact:
    - 后续继续落 `-10x` 系模型时仍会落入灰区。
  - Mitigation:
    - 同时补 `-100..-199` 的分配原则。

## Alternatives

### A. 推荐：登记区间 + 具体 id + 常量收口

- 优点：
  - 一次把硬规则问题收干净
  - 成本低
- 缺点：
  - 会额外触碰一处小代码文件

### B. 只登记具体 id

- 优点：
  - 改动更小
- 缺点：
  - 未解决区间策略空洞

当前推荐：A。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0191b-gallery-compliance-fix
- User review:
  - 用户明确指出 `MODEL_ID_REGISTRY` 未登记是必须修问题
