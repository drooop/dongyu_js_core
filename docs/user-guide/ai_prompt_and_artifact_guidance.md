---
title: "AI 协作规约与 Artifact 使用指南"
doc_type: user-guide
status: active
updated: 2026-05-10
source: ai
---

# AI 协作规约与 Artifact 使用指南

本指南说明以后如何写本项目里的 AI 协作规则，以及什么时候使用 HTML / visualized / interactive artifact。

结论很简单：

- 规则先分类，再写正文。
- 默认交付用 Markdown 或文本。
- HTML 不作为默认输出；只有明确需要 visualized / interactive 文档，或用户明确要求 HTML 时才使用。

## 官方依据

本指南基于以下 OpenAI 官方资料重新整理：

- OpenAI Prompt guidance: `https://developers.openai.com/api/docs/guides/prompt-guidance`
- OpenAI Prompt engineering: `https://developers.openai.com/api/docs/guides/prompt-engineering`
- ChatGPT prompt engineering best practices: `https://help.openai.com/en/articles/10032626-prompt-ingineering-best-practices-for-chatgpt`
- OpenAI Reasoning best practices: `https://developers.openai.com/api/docs/guides/reasoning-best-practices`
- OpenAI Prompt caching: `https://developers.openai.com/api/docs/guides/prompt-caching`
- OpenAI Structured model outputs: `https://developers.openai.com/api/docs/guides/structured-outputs`
- OpenAI Codex best practices: `https://developers.openai.com/codex/learn/best-practices`
- Codex AGENTS.md guide: `https://developers.openai.com/codex/guides/agents-md`

这些资料共同指向几条做法：清晰、具体、结果优先；稳定上下文放前面和长期文档里；推理模型偏好简洁直接的要求；格式要求尽量用 schema 或例子约束；规则需要靠验证和 eval 闭环，而不是靠反复加重语气。

## 三类规则

| 类型 | 适合内容 | 写法 | 例子 |
|---|---|---|---|
| 硬约束 | 安全禁区、数据真源、流程闸门、禁止操作、必填字段、语义合同 | 可以用“必须 / 禁止 / 不得 / MUST / NEVER” | 禁止绕过 ModelTable；远端禁区命令不得执行；验证必须 PASS/FAIL |
| 判断规则 | 是否搜索、是否追问、是否生成 artifact、是否使用 HTML、是否继续探索 | 条件 -> 动作 -> 停止条件 -> 验证 | 如果信息可能过期，就查官方来源；如果上下文足够，就直接推进 |
| 偏好建议 | 语气、篇幅、汇报顺序、默认格式、协作节奏 | 默认倾向 + 让位条件 | 默认结论先行；简单任务用短回复；用户明确要求时覆盖默认 |

## 写规约的顺序

1. 先写目标：这条规则想防止什么问题，或稳定什么行为。
2. 再写适用范围：适用于哪个仓库、目录、任务或角色。
3. 再写分类：硬约束、判断规则、偏好建议。
4. 再写验证：怎样知道规则被正确执行。
5. 最后写例外：什么情况下可以停下、升级、追问或让用户裁决。

## 推荐写法

判断类规则不要写成：

```text
回答前必须先搜索。
```

改成：

```text
当问题涉及可能变化的信息、官方产品能力、价格、部署状态、法律/财务/医疗等高风险内容时，先查权威来源；如果已有上下文足够且信息稳定，可以直接回答，并说明依据。
```

artifact 类规则不要写成：

```text
每次都生成 HTML artifact。
```

改成：

```text
默认使用 Markdown 或文本；只有需要 visualized / interactive 文档，或者用户明确要求 HTML 时，才生成 HTML。生成后需要打开检查关键内容和交互。
```

格式类规则不要只写：

```text
必须输出正确 JSON。
```

改成：

```text
当输出需要被程序读取时，提供 schema、字段表或例子；验证字段是否完整、枚举值是否合法、是否能被解析。
```

## HTML / visualized artifact 边界

适合使用 HTML 的情况：

- 需要可视化地比较多个方案。
- 需要交互式筛选、展开、导出或演示。
- 需要给非技术读者一个可打开的视觉说明页。
- 用户明确要求 HTML。

不适合使用 HTML 的情况：

- 只是结论、短解释、普通修复汇报。
- 只是为了显得完整或好看。
- 会让 SSOT、iteration 记录和验证证据变得分散。

本项目里的 HTML artifact 是阅读和交互产物，不是 SSOT。真实规则仍以 `CLAUDE.md`、`AGENTS.md`、`docs/ssot/`、`docs/WORKFLOW.md` 和 `docs/iterations/*` 为准。

## 本项目默认模板

以后新增或改写 AI 协作规约时，优先按这个模板写：

```text
目标：
- 这条规则要稳定什么行为。

分类：
- 硬约束 / 判断规则 / 偏好建议。

规则：
- 条件：
- 动作：
- 停止条件：
- 验证：

例外：
- 什么时候停下并让用户裁决。

示例：
- 一个正确例子。
- 一个反例。
```

## 落盘位置

- 影响每次执行的硬规则：写入 `CLAUDE.md`。
- repo-local 协作与导航：写入 `AGENTS.md`。
- 稳定治理规则：写入 `docs/ssot/execution_governance_ultrawork_doit.md` 或相关 SSOT。
- 给使用者看的说明：写入 `docs/user-guide/`。
- 一次性事实和证据：写入对应 `docs/iterations/<id>/runlog.md`。

## 检查清单

提交前检查：

- 是否把规则分成了硬约束、判断规则、偏好建议。
- 是否把判断项写成了条件规则，而不是无条件绝对命令。
- 是否给出了验证方式。
- 是否避免把 HTML 变成默认输出。
- 是否把长期规则写进长期文档，而不是只留在聊天里。
