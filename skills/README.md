# Skills Index

Only canonical repo-level skills index: `skills/README.md`.

本仓库的 skill 体系分为三类：
- **Formal skills**：位于 `skills/<skill>/`，包含 `SKILL.md`（可选 `README.md`/产物文件）。
- **OpenCode skills**：位于 `.opencode/skills/<skill>/SKILL.md`，由 oh-my-opencode/OpenCode 自动加载。
- **Legacy/compat skills**：位于 `.codex/skills/<skill>/SKILL.md`，用于历史兼容；与 `.opencode/skills/` 的同名 skill 内容应保持一致。

## Formal skills
- `skills/dongyu-project-lexicon/`：项目术语表与语义边界（语义 SSOT，避免与 `docs/architecture_mantanet_and_workers.md` 冲突）。SKILL: `skills/dongyu-project-lexicon/SKILL.md`
- `skills/regular-iteration/`：常规迭代 Phase1 规划流程（仅文档，不改代码）。SKILL: `skills/regular-iteration/SKILL.md`

## OpenCode skills (project-level)
- `.opencode/skills/doit/`：严格分 Phase 的迭代执行 skill（对齐 `docs/WORKFLOW.md`/`docs/ITERATIONS.md`）。SKILL: `.opencode/skills/doit/SKILL.md`
- `.opencode/skills/doit-auto/`：长周期 Roadmap/多 Iteration 编排（只产出文档，不实现）。SKILL: `.opencode/skills/doit-auto/SKILL.md`

## Legacy/compat skills
- `.codex/skills/doit/`：legacy 位置（与 `.opencode/skills/doit/` 保持一致）
- `.codex/skills/doit-auto/`：legacy 位置（与 `.opencode/skills/doit-auto/` 保持一致）
