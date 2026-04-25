---
title: "0148 — ft skill + 分支级自动 Fill-Table-Only 门禁"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0148-ft-skill-branch-gate
id: 0148-ft-skill-branch-gate
phase: phase1
---

# 0148 — ft skill + 分支级自动 Fill-Table-Only 门禁

## 0. Metadata
- ID: 0148-ft-skill-branch-gate
- Date: 2026-02-14
- Owner: AI (User Approved)
- Branch: dev_0148-ft-skill-branch-gate
- Related:
  - `docs/ssot/fill_table_only_mode.md`
  - `scripts/validate_fill_table_only_mode.mjs`
  - `.githooks/pre-commit`
  - `CLAUDE.md` (fill-table-first, branch rules)

## 1. Goal
用户只需输入 `$ft ...`，不需要手动运行任何 `on/off` 命令：
- 进入 `dev_<id>-ft-*` 分支时自动启用 Fill-Table-Only 门禁（commit 自动强制校验 staged 文件）。
- 离开该分支时自动解除门禁。
- 同时提供 `ft` skill：自动创建 ft 分支、确保 hooks 安装，并以 Fill-Table-Only 方式推进“只填表实现”的任务对话与交付。

## 2. Background
现有模式需要显式 `on/off`（即便可以由 AI 执行），仍存在“忘关/跨分支污染”的风险。
用户选择方案 3（分支级生命周期），希望门禁严格绑定分支，自动启停。

## 3. Invariants (Must Not Change)
- Fill-Table-Only 语义不变：白名单路径以 `scripts/validate_fill_table_only_mode.mjs` 为准。
- 不修改 runtime 解释器与业务服务实现。
- 门禁只针对 **staged** 文件（避免被工作区历史脏改动误伤）。
- 未进入 ft 分支时，普通提交不受影响且无额外噪声输出。

## 4. Scope
### 4.1 In Scope
- 更新 `.githooks/pre-commit`：检测分支名，匹配 `-ft-` 时自动执行 guard。
- 更新 `docs/ssot/fill_table_only_mode.md`：写明“分支级自动启停”与 `$ft` skill 的触发语义。
- 创建 `ft` skill（安装到 `/Users/drop/.codex/skills/ft/`）。
- 补测试，确保行为稳定。

### 4.2 Out of Scope
- 远端 CI/服务端 hook 强制。
- 颜色生成器案例本身的填表内容（会作为 `$ft ...` 的下一次实际任务执行）。

## 5. Non-goals
- 不追求“git commit --no-verify 无法绕过”（本地 hook 天生可绕过；真正强制需要 CI/服务端）。

## 6. Success Criteria (Definition of Done)
- 在分支名包含 `-ft-` 时，运行 `.githooks/pre-commit` 会执行并强制 Fill-Table guard。
- 在非 ft 分支时，`.githooks/pre-commit` 直接退出 0 且不输出 SKIP 噪声。
- `docs/ssot/fill_table_only_mode.md` 明确 `$ft` 的自动化行为与分支命名约定。
- 新增测试脚本 PASS。

## 7. Risks & Mitigations
- Risk: 分支命名不符合约定导致门禁未触发。
  - Mitigation: `ft` skill 必须自动创建符合 `dev_<id>-ft-<desc>` 的分支。
- Risk: hooks 未安装导致门禁未触发。
  - Mitigation: `ft` skill 自动执行 `bash scripts/ops/install_git_hooks.sh` 并验证 `core.hooksPath`。

## 8. Open Questions
None.
