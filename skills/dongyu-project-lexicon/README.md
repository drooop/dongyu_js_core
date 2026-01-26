# dongyu-project-lexicon

本 skill 用于建立并维护本仓库的“项目术语表（Project Lexicon）”，作为仓库内语义与术语一致性的基线。

## 目的与适用范围
- 面向本仓库的所有 Iteration 规划、运行时语义讨论、UI/交互分析与测试设计。
- 避免外部项目术语/定义“搬运式迁移”。如需迁移，必须在本仓库内重新定义并指明边界。

## 权威性与优先级
- 术语语义优先级（从高到低）：
  1) `docs/architecture_mantanet_and_workers.md`（架构 SSOT）
  2) `AGENTS.md`（执行宪法 + 术语入口）
  3) `skills/dongyu-project-lexicon/LEXICON.md`（术语表正文）
- 若代码/文档/迭代产出与术语表冲突：必须先在术语表中记录“当前事实”，再决定是否变更实现。

## 使用规则
- 开始任何 Iteration Phase1 或进行重要设计讨论前，先阅读 `skills/dongyu-project-lexicon/LEXICON.md`。
- 新引入或修改核心术语时，必须同步更新 `LEXICON.md`。
- 若术语存在歧义或行为不一致，必须记录为“当前事实”，禁止自行统一语义。

## 产物与位置
- 术语表正文：`skills/dongyu-project-lexicon/LEXICON.md`
- Skill 指引：`skills/dongyu-project-lexicon/SKILL.md`
- 仓库 Skill 索引（唯一 canonical）：`skills/README.md`
