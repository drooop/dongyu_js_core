# AI 工作约定（Oh My OpenCode 适配）

本文件仅约束 AI 工作方式，不改变项目业务逻辑或产品定义。

## 1. 最高优先级
- `AGENTS.md` 是最高约束，未获明确授权不得修改。
- 架构 SSOT：`docs/architecture_mantanet_and_workers.md`。
- Charters：`docs/charters/*.md`（优先级低于 SSOT，高于 Iteration 产物）。
- 工作流：`docs/WORKFLOW.md` 与 `docs/ITERATIONS.md`。

## 2. 阶段纪律
- Phase1 只写文档，不改代码、不加依赖、不跑测试。
- Phase3 必须在 Approved 后开始；Approved 可以来自用户审核，或 OpenCode 连续 3 次审核通过后的自动放行。
- 每个 Step 必须按 `resolution.md` 顺序执行，且必须具备可执行验证。

## 2.1 Review Gate 记录模板
将以下记录写入 `docs/iterations/<id>/runlog.md` 的 Environment 区域。

```text
Review Gate Record
- Iteration ID:
- Review Date:
- Review Type: User / OpenCode
- Review Index: 1/2/3...
- Decision: Approved / Change Requested / On Hold
- Notes:
```

## 2.2 Auto-Approval（OpenCode 3 次审核放行）

当用户没有明确给出 Approved 时，允许 OpenCode 做多次独立审核来放行进入 Phase3。

固定调用序列（必须按此顺序）：
1) Review #1：`@oracle`
2) Review #2：`@momus`
3) Review #3：`@oracle`

放行条件：
- 最近连续 3 次 OpenCode Review 记录的 Decision 均为 Approved
- 没有任何未处理的 Change Requested

满足条件后：
- OpenCode 可以在 runlog 中追加一条 Review Gate Record（Decision=Approved，Notes=Auto-Approval after 3 reviews）并进入 Phase3。

## 6. 分支与合并（单人公司模式）

- 默认 Iteration 工作分支：`dev_<id>`
- Iteration 完成后：merge 到 `dev`（通常不需要 PR）
- `main` 只在需要发布/里程碑时从 `dev` 提升；此时再考虑 PR（dev → main）

## 3. oh-my-opencode 角色分工（建议）
- Prometheus：规划与拆分（Phase0/1）。
- Sisyphus：Phase3 执行与迭代。
- Oracle：方案评审、调试与根因分析。
- Librarian / Explore：文档与代码快速定位。
- Multimodal Looker：UI/截图类证据辅助。

## 4. 记录与证据
- 发现与执行证据只写入 `runlog.md`（事实，不写计划）。
- 关键信息必须落地到 `docs/iterations/<id>/` 文档。

## 5. 安全与清洁
- 不自动变更依赖或执行未在计划中的脚本。
- secrets 不入库；使用 `.env`/密管系统。
- `logs/` 与 `*.log` 必须保持 gitignored，不得提交。
