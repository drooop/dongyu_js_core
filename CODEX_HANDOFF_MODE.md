---
title: "Codex Handoff Mode"
doc_type: governance
status: active
updated: 2026-03-07
source: ai
---

# Codex Dropmode

本文件定义本仓库内 Codex/OpenCode 的 `dropmode` 会话迁移协议。

边界：
- 这是 developer workflow 约定，不是产品功能。
- 它不改变 fill-table、runtime、server、worker 的任何语义。
- 与 `CLAUDE.md` 冲突时，以 `CLAUDE.md` 为准。
- `docs/CODEX_HANDOFF_MODE.md` 若存在，可视为外置知识库镜像；本仓库内以本文件为 git-tracked canonical 版本。

## 1. Default State

- 在本仓库中，`dropmode` 默认开启。
- `$dropmode` 是 canonical skill trigger。
- 开启时，assistant 在每次回复前都要静默判断：
  - 当前任务是否建议升级到更大上下文的新会话继续。
  - 如果当前会话已处于 large-session mode，接下来的任务是否建议降级到普通会话继续。
- “large-session mode” 指按大窗配置或大窗迁移流程启动的会话，不等于已验证底层真实 `1M` 生效。
- 协议内部需要维护 `dropmode_session_mode = unknown|regular|large`。
- assistant 应按以下顺序尽力推断这个状态：
  - 当前会话可见的 `/status`
  - Codex 配置或 profile 线索
  - 既有迁移包 / `compact_handoff` 的 `Session Mode`
  - 用户明确说“我现在是 1M / large / 大窗 / 常规 / 非1M”
- 其中配置/profile 只能作为启发式参考，不能冒充强证明。

## 2. Reply Contract

- 每次回复都应继续输出 `effort_suggestion: medium|high|xhigh — <short reason>`。
- 若判断“建议升级”，则在回复末尾追加：
  - `本方案建议升级到 1M 新会话后继续。若确认升级，请明确回复：升级后继续。`
- 若判断“建议降级”，则在回复末尾追加：
  - `接下来的任务建议降级并在新会话继续。若确认降级，请明确回复：降级后继续。`
- 若不建议迁移，则不追加迁移提示。

## 3. Consent Rule

- 用户未明确同意迁移前，assistant 必须继续当前对话。
- 不能因为给出了升级/降级建议，就默认停止当前任务。
- 不能声称已经在当前活跃会话内“切换到 1M”或“降级成功”。

## 4. Confirmation Flow

- assistant 只有在上一条回复刚刚给出升级/降级建议时，才允许把 `升级后继续` / `降级后继续` 解释成确认。
- 用户回复 `升级后继续` 且当前 pending 状态为 upgrade 后，assistant 的下一条回复必须输出迁移包：
  - `compact_handoff`
  - 新会话启动方式
  - 新会话首条 prompt 模板
- 这份迁移包必须写明 target session mode = `large`
- 用户回复 `降级后继续` 且当前 pending 状态为 downgrade 后，同样输出上述迁移包。
- 这份迁移包必须写明 target session mode = `regular`
- 如果当前没有匹配的 pending 建议，assistant 不能伪造迁移包。
- 新会话 prompt 必须先要求读取 `compact_handoff`，再继续任务，不得默认重做已完成部分。

## 5. $dropmode Toggle

- `$dropmode` 使用 Codex CLI 的正常 skill 触发机制。
- 每次调用都必须取反当前状态，并清空当前 pending 迁移建议。
- 每次取反后都必须只输出一条结果语句，不得输出交接摘要、handoff、迁移包或其他解释：
  - 开启时：`dropmode 已开启：后续回复将执行升级/降级迁移判断。`
  - 关闭时：`dropmode 已关闭：后续回复不再主动给出升级/降级迁移建议。`
- 这条 toggle 回复是特例：不附带 `effort_suggestion`。
- 当 `dropmode` 关闭时：
  - assistant 不再主动追加升级/降级建议。
  - 但若用户明确要求生成 `compact_handoff`、新会话 prompt、或显式要求迁移，仍应执行。

## 6. compact_handoff Minimum Contract

`compact_handoff` 至少包含：
- Goal
- Context
- Session Mode
- Done
- Locked Decisions
- Open
- Risks
- Read First
- Verify
- Next

要求：
- 不回贴长历史、长日志、长 diff。
- `Read First` 控制在 3 到 5 个路径。
- `Next` 只能有一个动作。

## 7. New Session Prompt Contract

新会话首条 prompt 模板必须明确：
- 这是续作，不要重做已完成部分。
- 先阅读 `compact_handoff`。
- 再按 `Read First` 补读最小必要文件。
- 若 handoff 与代码现状不一致，以代码现状为准并指出差异。
- 若仍缺关键上下文，再扩大读取范围。
