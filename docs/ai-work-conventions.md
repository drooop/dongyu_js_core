---
title: "AI 工作约定"
doc_type: archive
status: deprecated
updated: 2026-05-10
source: ai
---

# AI 工作约定

Status: deprecated historical reference. Current AI execution rules live in `CLAUDE.md`, `docs/WORKFLOW.md`, and `docs/ssot/execution_governance_ultrawork_doit.md`.

> **DEPRECATED (2026-02-11)**
>
> 本文件内容已拆分合并至：
> - 关键约束 → `CLAUDE.md`（项目根目录，Claude Code 自动加载）
> - 详细工作流 → `docs/WORKFLOW.md`（含 review gate 模板、auto-approval 泛化版）
>
> 本文件原为旧 agent 工作流适配，其中的工具特定内容（固定外部 reviewer 序列、
> Prometheus/Sisyphus/Oracle/Librarian 角色分工）已不适用于当前工作流。
>
> 保留本文件仅供历史参考。新工作请遵循 `CLAUDE.md` + `docs/WORKFLOW.md`。

---

## 历史内容（仅供参考，不再生效）

### 旧 agent 工作流角色分工
- Prometheus：规划与拆分（Phase0/1）
- Sisyphus：Phase3 执行与迭代
- Oracle：方案评审、调试与根因分析
- Librarian / Explore：文档与代码快速定位
- Multimodal Looker：UI/截图类证据辅助

### Auto-Approval 固定调用序列（旧工作流专用）
1. Review #1：固定外部 reviewer A
2. Review #2：固定外部 reviewer B
3. Review #3：固定外部 reviewer A

> 泛化版本已移至 `docs/WORKFLOW.md` — Auto-Approval Policy。
