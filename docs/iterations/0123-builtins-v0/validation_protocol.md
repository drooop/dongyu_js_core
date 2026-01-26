# Validation Protocol v0 (builtins-v0)

本协议定义 builtins-v0 的 PASS/FAIL 判定口径，基于 EventLog / snapshot / intercepts。

## Inputs
- Concrete Key Implementation Ledger：`docs/iterations/0123-builtins-v0/ledger.md`
- Coverage Matrix / Harness Assertion Rules：`docs/iterations/0122-oracle-harness-plan/harness_plan.md`
- EventLog Contract：`docs/ssot/modeltable_runtime_v0.md`

---

## PASS/FAIL Rules

### 1) EventLog Consistency
- PASS：每个 key 的触发输入均产生 Ledger 预期的 EventLog 序列（字段齐全、顺序一致）。
- FAIL：缺失事件、顺序错乱、或字段不一致（尤其是 `op/result/reason`）。

### 2) Snapshot Consistency
- PASS：事件序列执行后的 ModelTable snapshot 与 Ledger 预期一致。
- FAIL：snapshot 与预期不一致或缺失关键 label。

### 3) Intercepts Consistency
- PASS：Ledger 标注的 intercept 必须可观测（例如 `init_inner_connection` / `init_type` / `Cell.run`）。
- FAIL：未触发 intercept 或触发未证据支持的额外 intercept。

### 4) Error Semantics
- PASS：错误场景（例如 run_<func> 未注册）产生 `EventLog(op=error, result=rejected, reason=func_not_found)`。
- FAIL：silent fail 或错误事件字段不符合约定。

### 5) Stage 2.3 Boundary (MQTT)
- PASS：无任何 MQTT pub/sub 副作用（除非有明确 PICtest 证据且属于本 key）。
- FAIL：出现未证据支持的 MQTT 行为。

---

## Validation Workflow (Document-level)
1) 从 Ledger 中提取 key-by-key 预期 EventLog 序列。
2) 对照实现产生的 EventLog / snapshot / intercept trace。
3) 逐条给出 PASS/FAIL 判定与原因。

## Notes
- 本协议为文档级规范；具体脚本实现由后续迭代落地。
