---
title: "0157a — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0157a-spec-migration-gate
id: 0157a-spec-migration-gate
phase: phase1
---

# 0157a — Resolution (HOW)

## 0. Execution Strategy

采用“先登记、后合并、再校验”顺序：

1. 先登记 0157a~0163，解除后续迭代的执行阻断。
2. 再按条款差异（diff）更新 CLAUDE/SSOT/架构文档，不做整文件覆盖。
3. 最后用可复现 grep 验证关键段落是否全部落地。

## 1. Step Overview

| Step | Title | Scope | Files | Verification | Acceptance | Rollback |
|---|---|---|---|---|---|---|
| 1 | 迭代登记 | 在总索引登记 0157a~0163 | `docs/ITERATIONS.md` | `rg '0157a|...|0163'` | 全部可检索 | 回退该文件改动 |
| 2 | CLAUDE 条款合并 | 新增 PIN/model/function/type 条款并更新禁用项 | `CLAUDE.md` | `rg 'PIN_SYSTEM|MODEL_FORMS|FUNCTION_LABELS|MODEL_TYPE_REGISTRY'` | 关键段落齐全 | 回退该文件改动 |
| 3 | Runtime SSOT 合并 | 追加新 label 语义、模型形态与函数值格式条款 | `docs/ssot/runtime_semantics_modeltable_driven.md` | `rg '5\.3 模型形态|函数标签格式|数据模型 PIN 接口规范'` | §5.3/§6/§8 存在 | 回退该文件改动 |
| 4 | 注册表新建 | 新增 label_type_registry 权威表 | `docs/ssot/label_type_registry.md` | `test -f .../label_type_registry.md` | 文件存在且可读 | 删除新文件 |
| 5 | 架构 SSOT 合并 | 补充 3.4/6/7 结构章节 | `docs/architecture_mantanet_and_workers.md` | `rg '^## 6\. PIN|^## 7\. 能力分层|3\.4 Model Forms'` | 章节存在 | 回退该文件改动 |
| 6 | 0157a 文档归档 | 完成本迭代 plan/resolution/runlog | `docs/iterations/0157a-spec-migration-gate/*` | 手动检查 + runlog 记录 | 文档完整可审计 | 回退该目录改动 |

## 2. Planned Verification Commands

1. `rg -n '0157a-spec-migration-gate|0157b-runtime-merge|0158-runtime-new-label-types|0159-filltable-new-types|0160-ft-system-models-migration|0161-server-workers-adapt|0162-ft-test-migration|0163-cleanup-deprecated-labels' docs/ITERATIONS.md`
2. `rg -n 'PIN_SYSTEM|MODEL_FORMS|FUNCTION_LABELS|MODEL_TYPE_REGISTRY|DEPRECATED label types' CLAUDE.md`
3. `rg -n '### 5\.3 模型形态约束|## 6\. 函数标签格式|## 8\. 数据模型 PIN 接口规范|兼容期映射' docs/ssot/runtime_semantics_modeltable_driven.md`
4. `test -f docs/ssot/label_type_registry.md && echo PASS:label_type_registry`
5. `rg -n '^## 6\. PIN 系统架构|^## 7\. 能力分层|3\.4 Model Forms' docs/architecture_mantanet_and_workers.md`

## 3. Conflict Table

| Item | A | B | Decision |
|---|---|---|---|
| 术语升级方式 | 直接整文件替换 | 逐条款 diff 合并 | 采用逐条款 diff 合并，保留现有不冲突段落 |
| 旧类型处理 | 立即删除 | 兼容期 DEPRECATED | 0157a 标注 DEPRECATED；0163 再清理 |
| pin.model.* 与 model_id=0 | 未明确 | 明确排除 | 在 `CLAUDE.md` 与 `label_type_registry.md` 同步明确 |
