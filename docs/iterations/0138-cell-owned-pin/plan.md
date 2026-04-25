---
title: "Iteration 0138-cell-owned-pin Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0138-cell-owned-pin
id: 0138-cell-owned-pin
phase: phase1
---

# Iteration 0138-cell-owned-pin Plan

## 0. Metadata
- ID: 0138-cell-owned-pin
- Date: 2026-02-09
- Owner: Codex + User
- Branch: dropx/dev_0138-cell-owned-pin
- Related: [[charters/dongyu_app_next_runtime]], [[ssot/runtime_semantics_modeltable_driven]], [[concepts/pictest_pin_and_program_model]]

## 1. Goal
将 PIN 语义升级为 Cell-owned（PIN 属于具体 Cell 的端口语义），并保持现有 registry/mailbox 模型可兼容运行。

## 2. Background
当前实现中 PIN 更像 MQTT 订阅声明，消息落在固定 mailbox，触发路径部分依赖 server 硬编码，导致 PIN 与 Cell 的归属关系弱化，与 Charter/SSOT 对“显式 Cell + 声明驱动副作用”的目标存在偏差。

## 3. Invariants (Must Not Change)
- 所有副作用仍通过 `addLabel/rmLabel` 驱动，不引入旁路写入。
- MQTT topic 模式与 payload 基本契约保持兼容。
- 旧模型（`PIN_IN/PIN_OUT.v` 为字符串或空）必须继续可运行。
- UI 仍只写 ModelTable，不直接写总线。

## 4. Scope
### 4.1 In Scope
- 为 `PIN_IN/PIN_OUT.v` 定义并支持 Cell-owned binding 结构（如 target/trigger/owner）。
- Runtime 在 `mqttIncoming/addLabel` 内完成入站路由与触发拦截记录。
- 兼容旧语义：无 binding 时回退固定 mailbox 逻辑。
- 更新 user-guide/ssot 与验证脚本。

### 4.2 Out of Scope
- 完整重建 PICtest Python Connect 管理器。
- 引入新的外部总线协议或改动 topic 分段规则。
- 扩展到 MGMT 总线语义重构。

## 5. Non-goals
- 本迭代不追求一次性移除所有 server 侧事件桥接逻辑。
- 本迭代不重写 program model 执行框架。

## 6. Success Criteria (Definition of Done)
1. 新增 Cell-owned PIN 声明后，MQTT 入站可直接路由到声明目标 Cell（非固定 mailbox）并可触发函数执行路径。
2. 旧声明格式继续工作，`validate_pin_mqtt_loop` 旧用例保持 PASS。
3. 新增至少一组“新语义 + 兼容语义”验证用例并在 runlog 记录 PASS。
4. `docs/user-guide/modeltable_user_guide.md` 与 `docs/ssot/runtime_semantics_modeltable_driven.md` 完成同步更新。
5. `binding.trigger_funcs` 的消费从 server 收敛到 runtime，并有脚本验证 PASS。

## 7. Risks & Mitigations
- Risk: 触发时序变化导致重复触发或漏触发。
  - Impact: 程序模型行为偏差。
  - Mitigation: 增加 event/intercept 顺序断言与最小回归场景。
- Risk: 旧模型配置被新语义误判。
  - Impact: 线上模型失效。
  - Mitigation: 明确类型守卫，旧格式走显式 fallback。
- Risk: runtime/server 双实现分叉持续。
  - Impact: 维护成本上升。
  - Mitigation: 优先把通用触发收敛到 runtime，server 仅保留编排职责。

## 8. Open Questions
- 本迭代内是否将“model100 patch_in”硬编码触发完全下沉 runtime：默认 Yes（若验证风险过高则降级为部分收敛）。

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - [[ssot/runtime_semantics_modeltable_driven]]
  - [[ssot/modeltable_runtime_v0]]
- Notes:
  - 保持 add_label/rm_label 入口一致性与可观测日志等价。

### 9.2 Charter Compliance Checklist
- Charter references:
  - [[charters/dongyu_app_next_runtime]]
- Notes:
  - 对齐 3.4 PIN 语义（explicit Cells）并保持 UI 不越权。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
