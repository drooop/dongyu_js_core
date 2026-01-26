# Concrete Key Implementation Ledger

本 Ledger 以 Concrete Key Inventory 为唯一索引，逐条给出实现计划与验证口径。

## References
- Evidence: `docs/iterations/0122-pictest-evidence/evidence.md`
- Coverage Matrix & Harness Rules: `docs/iterations/0122-oracle-harness-plan/harness_plan.md`
- EventLog Contract: `docs/ssot/modeltable_runtime_v0.md`

---

## MVP Keys (v0 必做)
- `local_mqtt`
- `global_mqtt`
- `model_type`
- `data_type`
- `v1n_id`
- `CELL_CONNECT`
- `MODEL_CONNECT`
- `V1N_CONNECT`
- `run_<func>` (pattern)

## Deferred Keys (v0 延后)
- `DE_CONNECT`
- `DAM_CONNECT`
- `PIC_CONNECT`
- `WORKSPACE_CONNECT`

**Deferred 原因与策略**
- 当前 PICtest 证据仅表明 allow-list 校验，无额外副作用；v0 仅识别并接受，不触发连接初始化。
- 若后续证据显示存在额外语义，需在新迭代补充证据与实现。

---

## Key-by-Key Implementation Ledger

### Key: local_mqtt
- Evidence Source: `docs/iterations/0122-pictest-evidence/evidence.md`（Cell.add_label 特殊分支）
- Trigger Input (Coverage Matrix): 主模型( MT / 0,0,0 )写入 `StrLabel("local_mqtt", <ip>)`
- Expected EventLog Sequence:
  - `event_id`: inc, `op`: add_label, `cell`: (0,0,0), `label`: (k=local_mqtt,t=str,v=<ip>), `prev_label`: optional, `result`: applied
- Expected Side Effects / Intercepts:
  - v1n.local_mqtt_ip 更新
  - intercept: Cell.add_label, v1n config snapshot
- PASS/FAIL (Harness Rules):
  - PASS: EventLog 顺序一致，snapshot/v1n config 与期望一致
  - FAIL: label 未写入或 v1n.local_mqtt_ip 未更新
- Uncovered / Limits:
  - 不触发 MQTT pub/sub（Stage 2.3 边界）

### Key: global_mqtt
- Evidence Source: `docs/iterations/0122-pictest-evidence/evidence.md`（Cell.add_label 特殊分支）
- Trigger Input: 主模型( MT / 0,0,0 )写入 `StrLabel("global_mqtt", <ip>)`
- Expected EventLog Sequence:
  - add_label event for (k=global_mqtt,t=str,v=<ip>)
- Expected Side Effects / Intercepts:
  - v1n.global_mqtt_ip 更新
  - intercept: Cell.add_label, v1n config snapshot
- PASS/FAIL:
  - PASS: EventLog + v1n config 一致
  - FAIL: label 未写入或 v1n.global_mqtt_ip 未更新
- Uncovered / Limits:
  - 不触发 MQTT pub/sub（Stage 2.3 边界）

### Key: model_type
- Evidence Source: `docs/iterations/0122-pictest-evidence/evidence.md`（Cell.add_label 分支，当前实现为 pass）
- Trigger Input: 模型主单元格写入 `StrLabel("model_type", <type>)`
- Expected EventLog Sequence:
  - add_label event for (k=model_type,t=str,v=<type>)
- Expected Side Effects / Intercepts:
  - 记录 model_type 变更；无额外 reset/init 行为
- PASS/FAIL:
  - PASS: EventLog 记录更新，且无 reset/init 等额外副作用
  - FAIL: 出现任何 reset/init 行为或其它未证据支持副作用
- Uncovered / Limits:
  - 若未来证据显示初始化重置行为，需新增条目

### Key: data_type
- Evidence Source: `docs/iterations/0122-pictest-evidence/evidence.md`（Cell.add_label 分支）
- Trigger Input: Data 模型主单元格写入 `StrLabel("data_type", <type>)`
- Expected EventLog Sequence:
  - add_label event for (k=data_type,t=str,v=<type>)
  - rm_label event for (k=CELL_CONNECT)
- Expected Side Effects / Intercepts:
  - **首次定义**：按固定顺序触发 `init_type` intercept（顺序：add_label → rm_label(CELL_CONNECT) → init_type intercept）
  - intercept: rm_label + init_type 追踪点
- PASS/FAIL:
  - PASS: EventLog 顺序与预期一致且 `init_type` intercept 发生
  - FAIL: 顺序不一致、未记录 rm_label、或出现额外副作用
- Uncovered / Limits:
  - 后续覆盖阻断行为需按证据表执行

### Key: v1n_id
- Evidence Source: `docs/iterations/0122-pictest-evidence/evidence.md`（Cell.add_label 分支）
- Trigger Input: 主模型主单元格写入 `StrLabel("v1n_id", <id>)`
- Expected EventLog Sequence:
  - add_label event 或 rejected event（若已存在且 model.id==0）
- Expected Side Effects / Intercepts:
  - intercept: 覆盖阻断路径
- PASS/FAIL:
  - PASS: 覆盖阻断按证据执行
  - FAIL: 覆盖被错误允许或无记录
- Uncovered / Limits:
  - 无额外副作用

### Key: CELL_CONNECT
- Evidence Source: `docs/iterations/0122-pictest-evidence/evidence.md`（ConnectLabel allow-list）
- Trigger Input: `ConnectLabel("CELL_CONNECT", <dict>)`
- Expected EventLog Sequence:
  - add_label event for (k=CELL_CONNECT,t=connect,v=<dict>)
- Expected Side Effects / Intercepts:
  - 触发 cell.connect_manage.init_inner_connection（可观测 intercept）
- PASS/FAIL:
  - PASS: EventLog 记录 + init_inner_connection intercept 可观测
  - FAIL: 未触发 init 或出现未证据支持副作用
- Uncovered / Limits:
  - 连接后传输细节不在本轮范围

### Key: MODEL_CONNECT
- Evidence Source: `docs/iterations/0122-pictest-evidence/evidence.md`（ConnectLabel allow-list）
- Trigger Input: `ConnectLabel("MODEL_CONNECT", <dict>)`
- Expected EventLog Sequence:
  - add_label event for (k=MODEL_CONNECT,t=connect,v=<dict>)
- Expected Side Effects / Intercepts:
  - 若位于模型主单元格，触发 model.connect_manage.init_inner_connection（可观测 intercept）
- PASS/FAIL:
  - PASS: EventLog 记录 + init_inner_connection intercept 可观测
  - FAIL: 未触发 init 或不符合条件触发
- Uncovered / Limits:
  - 连接后传输细节不在本轮范围

### Key: V1N_CONNECT
- Evidence Source: `docs/iterations/0122-pictest-evidence/evidence.md`（ConnectLabel allow-list）
- Trigger Input: `ConnectLabel("V1N_CONNECT", <dict>)`
- Expected EventLog Sequence:
  - add_label event for (k=V1N_CONNECT,t=connect,v=<dict>)
- Expected Side Effects / Intercepts:
  - 若位于顶层主模型主单元格，触发 v1n.connect_manage.init_inner_connection（可观测 intercept）
- PASS/FAIL:
  - PASS: EventLog 记录 + init_inner_connection intercept 可观测
  - FAIL: 未触发 init 或不符合条件触发
- Uncovered / Limits:
  - 连接后传输细节不在本轮范围

### Key: run_<func> (pattern)
- Evidence Source: `docs/iterations/0122-pictest-evidence/evidence.md`（RunLabel.label_init）
- Trigger Input: `RunLabel("run_<func>", <value>)`
- Expected EventLog Sequence:
  - add_label event for (k=run_<func>,t=run,v=<value>)
  - 触发 Cell.run(<func>)（intercept）
  - **若 func 未注册**：记录 `event_id` 对应的 error 事件（op=error, result=rejected, reason=func_not_found）
- Expected Side Effects / Intercepts:
  - intercept: Cell.run / Function.run
- PASS/FAIL:
  - PASS: func 已注册时触发执行；未注册时产生 error 事件（不得 silent fail）
  - FAIL: 未注册时无 error 记录或出现未证据支持副作用
- Uncovered / Limits:
  - `<func>` 必须已注册；若不存在应记录错误

### Key: DE_CONNECT (Deferred)
- Evidence Source: `docs/iterations/0122-pictest-evidence/evidence.md`（ConnectLabel allow-list）
- Trigger Input: `ConnectLabel("DE_CONNECT", <dict>)`
- Expected EventLog Sequence:
  - add_label event for (k=DE_CONNECT,t=connect,v=<dict>)
- Expected Side Effects / Intercepts:
  - 无额外副作用（仅 allow-list 校验）
- PASS/FAIL:
  - PASS: 写入成功且无额外副作用
  - FAIL: 出现未证据支持副作用
- Uncovered / Limits:
  - 语义未知，待后续证据补充

### Key: DAM_CONNECT (Deferred)
- Evidence Source: `docs/iterations/0122-pictest-evidence/evidence.md`（ConnectLabel allow-list）
- Trigger Input: `ConnectLabel("DAM_CONNECT", <dict>)`
- Expected EventLog Sequence:
  - add_label event for (k=DAM_CONNECT,t=connect,v=<dict>)
- Expected Side Effects / Intercepts:
  - 无额外副作用（仅 allow-list 校验）
- PASS/FAIL:
  - PASS: 写入成功且无额外副作用
  - FAIL: 出现未证据支持副作用
- Uncovered / Limits:
  - 语义未知，待后续证据补充

### Key: PIC_CONNECT (Deferred)
- Evidence Source: `docs/iterations/0122-pictest-evidence/evidence.md`（ConnectLabel allow-list）
- Trigger Input: `ConnectLabel("PIC_CONNECT", <dict>)`
- Expected EventLog Sequence:
  - add_label event for (k=PIC_CONNECT,t=connect,v=<dict>)
- Expected Side Effects / Intercepts:
  - 无额外副作用（仅 allow-list 校验）
- PASS/FAIL:
  - PASS: 写入成功且无额外副作用
  - FAIL: 出现未证据支持副作用
- Uncovered / Limits:
  - 语义未知，待后续证据补充

### Key: WORKSPACE_CONNECT (Deferred)
- Evidence Source: `docs/iterations/0122-pictest-evidence/evidence.md`（ConnectLabel allow-list）
- Trigger Input: `ConnectLabel("WORKSPACE_CONNECT", <dict>)`
- Expected EventLog Sequence:
  - add_label event for (k=WORKSPACE_CONNECT,t=connect,v=<dict>)
- Expected Side Effects / Intercepts:
  - 无额外副作用（仅 allow-list 校验）
- PASS/FAIL:
  - PASS: 写入成功且无额外副作用
  - FAIL: 出现未证据支持副作用
- Uncovered / Limits:
  - 语义未知，待后续证据补充
