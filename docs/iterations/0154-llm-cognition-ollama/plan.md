---
title: "0154 — LLM 认知层接入（Ollama Qwen 32B）"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0154-llm-cognition-ollama
id: 0154-llm-cognition-ollama
phase: phase1
---

# 0154 — LLM 认知层接入（Ollama Qwen 32B）

## 0. Metadata
- ID: 0154-llm-cognition-ollama
- Date: 2026-02-23
- Owner: AI (User Approved)
- Branch: dev_0154-llm-cognition-ollama
- Depends on: 0153-cognition-feedback-loop (must be completed first)
- Related:
  - 0152-server-intent-dispatch (dispatch 基础)
  - 0153-cognition-feedback-loop (scene_context + action_lifecycle 基础)
  - `CLAUDE.md` (CAPABILITY_TIERS, fill-table-first)
  - `docs/architecture_mantanet_and_workers.md`

## 1. Goal
在 0153 建立的四环架构（感知→认知→决策→行动→反馈）基础上，接入本地 LLM（Ollama + Qwen 2.5 32B），增强认知层和决策层能力：
- 认知增强：LLM 辅助构建 scene_context（复杂场景理解、多步流程追踪）
- 决策增强：LLM 辅助 intent dispatch（模糊意图消解、未注册 action 智能路由）
- 为"数字员工"的 AI 化奠定基础

## 2. Background

### 2.1 从规则到智能
0152 实现了基于查表的 intent dispatch：确定性 action → handler 映射。
0153 实现了 scene_context + action_lifecycle：结构化的认知和反馈。
但两者都是**规则驱动**——当 action 字符串不在表中、当场景复杂需要推理时，系统无能为力。

LLM 的引入解决：
- **模糊意图识别**：用户输入"帮我请个假"→ 识别为 ws_select_app(1001)
- **多步流程理解**：理解"我刚才搜索的那个文档"引用了上一次 docs_search 的结果
- **场景建模**：根据历史意图序列，推断用户当前工作流阶段

### 2.2 技术选型
- **Ollama**：本地 LLM 推理框架，OpenAI-compatible API，零外部依赖
- **Qwen 2.5 32B (Q4_K_M)**：32GB RAM 下可运行，中文能力强，适合场景理解和意图分类
- **接入方式**：hostApi 注册，function label 调用，结果写回 ModelTable

## 3. Invariants (Must Not Change)
- runtime.js 不改
- 0152 dispatch_table + 0153 scene_context 机制继续工作（LLM 是增强，不是替代）
- 确定性 action（在 dispatch_table 中的）不经过 LLM（性能保证）
- 现有功能行为等价
- LLM 不可用时系统降级到规则模式（不崩溃）

## 4. Scope

### 4.1 In Scope

**A. Ollama 环境搭建**
- 安装 ollama（macOS）
- 拉取 `qwen2.5:32b`（Q4_K_M 量化，~20GB）
- 如果 32B 实际运行过慢，降级到 `qwen2.5:14b`
- 验证 `/api/generate` 和 `/api/chat` 端点可用

**B. ctx.hostApi.llmInfer 能力注入**
- server 侧新增 hostApi：
  ```javascript
  hostApi: {
    llmInfer: async (prompt, options) => {
      // POST http://localhost:11434/api/generate
      // model: 'qwen2.5:32b'
      // prompt: string
      // options: { temperature, max_tokens, system_prompt }
      // return: { ok, data: { response, model, eval_duration } }
    }
  }
  ```
- 注意：function label 当前是 sync 执行的。LLM 调用是 async。
  需要评估：
  - 方案 1：扩展 executeFunction 支持 async function label（影响 Tier 1）
  - 方案 2：LLM 调用在 dispatch 层（server.mjs submitEnvelope 中）执行，结果传入 function label（保持 Tier 2）
  - 优先方案 2，避免改 runtime

**C. LLM 增强 intent dispatch**
- dispatch 链扩展：
  ```
  1. intent_dispatch_table 查表 → 命中 → 直接执行（不经 LLM）
  2. 未命中 → 检查是否启用 LLM dispatch
  3. 启用 → 构造 prompt（scene_context + action + available_actions）
  4. LLM 返回 {matched_action, confidence, reasoning}
  5. confidence >= threshold → dispatch matched_action
  6. confidence < threshold → 写回 UI，让用户确认/选择
  ```
- prompt 模板（Model -10 function label 或 config label）
- confidence threshold 可配置（config label on Model 0）

**D. LLM 增强 scene_context**
- update_scene_context 函数增强：
  - 简单场景（确定性 action）→ 规则更新（0153 逻辑）
  - 复杂场景标记（多步流程、模糊引用）→ 调用 LLM 更新 scene_context
  - LLM 输入：recent_intents + current event + session_vars
  - LLM 输出：更新后的 scene_context 子集

**E. 降级与容错**
- ollama 不可用 → 跳过 LLM，走规则路径（0152+0153 行为）
- LLM 超时（>10s）→ 中断，走规则路径
- LLM 返回解析失败 → 记录错误，走规则路径
- action_lifecycle 记录 LLM 参与情况（confidence 字段 < 1.0 表示 LLM 辅助）

**F. E2E 验证场景**
1. 确定性 action（docs_refresh_tree）→ 不经 LLM → 行为不变
2. 未注册 action + LLM 可用 → LLM 匹配到已注册 action → dispatch 成功
3. 未注册 action + LLM 不可用 → 走 fallback → 返回 unknown_action
4. 模糊意图（自然语言）→ LLM 识别 → dispatch
5. LLM 低置信度 → 写回 UI 候选列表 → 用户确认

### 4.2 Out of Scope
- runtime.js 改动
- 前端 UI 展示（LLM 结果展示、确认交互由后续迭代处理）
- 多模型切换（本迭代固定 Qwen 2.5 32B）
- 训练/微调（使用 Qwen 原始权重）
- K8s 部署（本迭代仅本地开发环境）
- 物理设备控制接入（远期）

## 5. Success Criteria
1. `ollama run qwen2.5:32b` 可正常交互
2. `ctx.hostApi.llmInfer("你好")` 返回有效响应
3. 未注册 action 发送后，LLM 正确匹配到最接近的已注册 action
4. 确定性 action 不经过 LLM，延迟不增加
5. 停止 ollama 后，所有现有功能正常（降级验证）
6. action_lifecycle.confidence 字段：规则路径 = 1.0，LLM 路径 = LLM 返回值
7. scene_context 经 LLM 增强后，多步操作的上下文理解正确

## 6. Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Qwen 32B 推理延迟过高（>5s） | 用户体验差 | 降级到 14B；或仅对非实时操作启用 LLM |
| 32GB RAM 不足以同时运行 server + LLM | OOM | 监控内存；考虑 14B 或 offload to disk |
| LLM 返回非结构化输出 | 解析失败 | 严格 prompt engineering + JSON mode；失败走降级 |
| function label 是 sync，LLM 是 async | 架构不兼容 | dispatch 层调 LLM（方案 2），不改 executeFunction |
| LLM 安全风险（prompt injection） | 恶意 action 执行 | LLM 只做 intent → registered_action 映射，不执行任意代码 |

## 7. Design Decisions (for Review Gate)
1. **LLM 调用位置**：优先 submitEnvelope 层（server.mjs），避免改 runtime。
2. **LLM 只做匹配不做执行**：LLM 输出必须是 dispatch_table 中已注册的 action name，不能是任意代码。安全边界。
3. **Qwen 32B 优先**：32GB RAM 可运行 Q4_K_M。实测如果过慢则降级到 14B。
4. **降级优先**：LLM 是增强而非必要条件。任何 LLM 故障不影响现有功能。
