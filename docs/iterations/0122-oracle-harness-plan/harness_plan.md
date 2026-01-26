# Oracle Test Harness Plan (Stage 1.2)

## Purpose
本文件定义对照测试方案的**具体 key 覆盖**与断言规则，覆盖范围以 PICtest 运行时识别的**实际 built-in k key**为准（具体 key 列表组织）。

---

## Built-in k Discovery Protocol (Summary)
基于 `docs/iterations/0122-oracle-harness-plan/plan.md` 的 Discovery Protocol，built-in k 的来源必须来自：
1) Label registry / dispatch maps
2) add_label / save_ / receive 等入口的 special-case 分支
3) Connect / ManageCell 对连接类 key 的识别
4) 系统 meta keys（影响 v1n/config 的 key）

Completion Rule：Inventory 必须覆盖上述四类信号源且每个 key 绑定源文件与符号；无运行时分支识别的业务键必须排除并记录依据。

---

## Concrete Key Inventory
> 仅列出 PICtest 运行时**明确识别**的具体 key（非抽象分类）。

| Key | Recognition Signal | Evidence Level | Source |
|---|---|---|---|
| local_mqtt | `Cell.add_label` special-case | A | `vendor/PICtest/yhl/core.py` (`Cell.add_label`) |
| global_mqtt | `Cell.add_label` special-case | A | `vendor/PICtest/yhl/core.py` (`Cell.add_label`) |
| model_type | `Cell.add_label` special-case | A | `vendor/PICtest/yhl/core.py` (`Cell.add_label`) |
| data_type | `Cell.add_label` special-case | A | `vendor/PICtest/yhl/core.py` (`Cell.add_label`) |
| v1n_id | `Cell.add_label` special-case | A | `vendor/PICtest/yhl/core.py` (`Cell.add_label`) |
| CELL_CONNECT | `ConnectLabel` allow-list | A | `vendor/PICtest/yhl/labels.py` (`ConnectLabel.label_init`) |
| MODEL_CONNECT | `ConnectLabel` allow-list | A | `vendor/PICtest/yhl/labels.py` (`ConnectLabel.label_init`) |
| V1N_CONNECT | `ConnectLabel` allow-list | A | `vendor/PICtest/yhl/labels.py` (`ConnectLabel.label_init`) |
| DE_CONNECT | `ConnectLabel` allow-list | A | `vendor/PICtest/yhl/labels.py` (`ConnectLabel.label_init`) |
| DAM_CONNECT | `ConnectLabel` allow-list | A | `vendor/PICtest/yhl/labels.py` (`ConnectLabel.label_init`) |
| PIC_CONNECT | `ConnectLabel` allow-list | A | `vendor/PICtest/yhl/labels.py` (`ConnectLabel.label_init`) |
| WORKSPACE_CONNECT | `ConnectLabel` allow-list | A | `vendor/PICtest/yhl/labels.py` (`ConnectLabel.label_init`) |
| run_<func> (pattern) | `RunLabel` prefix check | A | `vendor/PICtest/yhl/labels.py` (`RunLabel.label_init`) |

Notes:
- `run_<func>` 是**模式化 key**，具体 key 由 function name 实例化，但识别规则为 `run_` 前缀。
- 仅作为业务数据键、且无运行时识别分支的 key 不纳入 Inventory。

---

## Coverage Matrix (Concrete Key Coverage Matrix)

| Key | Trigger Input Construction | Expected Side Effects | Evidence Level | Harness Intercepts |
|---|---|---|---|---|
| local_mqtt | 在主模型( MT / 0,0,0 )写入 `StrLabel("local_mqtt", <ip>)` | `v1n.local_mqtt_ip` 更新；ModelTable 保存 label | A | Cell.add_label 事件、v1n config 读数、DB 写入 |
| global_mqtt | 在主模型( MT / 0,0,0 )写入 `StrLabel("global_mqtt", <ip>)` | `v1n.global_mqtt_ip` 更新；ModelTable 保存 label | A | Cell.add_label 事件、v1n config 读数、DB 写入 |
| model_type | 在模型主单元格写入 `StrLabel("model_type", <type>)` | 若旧值变更，触发模型类型重置分支（当前实现为 pass） | A | Cell.add_label 事件、model_type 变更记录 |
| data_type | 在 Data 模型主单元格写入 `StrLabel("data_type", <type>)` | 初次定义时移除 `CELL_CONNECT` 并 `init_type()`；后续覆盖被阻断 | A | Cell.add_label / rm_label 事件、Model.init_type 调用点 |
| v1n_id | 在主模型主单元格写入 `StrLabel("v1n_id", <id>)` | 若已存在且主模型 id==0 则覆盖被阻断 | A | Cell.add_label 事件、label 覆盖阻断日志 |
| CELL_CONNECT | 写入 `ConnectLabel("CELL_CONNECT", <dict>)` | 触发 `cell.connect_manage.init_inner_connection()` | A | ConnectLabel.label_init、ManageCell.init_inner_connection |
| MODEL_CONNECT | 写入 `ConnectLabel("MODEL_CONNECT", <dict>)` | 若位于模型主单元格，触发 `model.connect_manage.init_inner_connection()` | A | ConnectLabel.label_init、ManageModel.init_inner_connection |
| V1N_CONNECT | 写入 `ConnectLabel("V1N_CONNECT", <dict>)` | 若位于顶层主模型主单元格，触发 `v1n.connect_manage.init_inner_connection()` | A | ConnectLabel.label_init、ManageV1N.init_inner_connection |
| DE_CONNECT | 写入 `ConnectLabel("DE_CONNECT", <dict>)` | 通过 allow-list 校验；当前无额外分支行为 | A | ConnectLabel.label_init（无分支副作用） |
| DAM_CONNECT | 写入 `ConnectLabel("DAM_CONNECT", <dict>)` | 通过 allow-list 校验；当前无额外分支行为 | A | ConnectLabel.label_init（无分支副作用） |
| PIC_CONNECT | 写入 `ConnectLabel("PIC_CONNECT", <dict>)` | 通过 allow-list 校验；当前无额外分支行为 | A | ConnectLabel.label_init（无分支副作用） |
| WORKSPACE_CONNECT | 写入 `ConnectLabel("WORKSPACE_CONNECT", <dict>)` | 通过 allow-list 校验；当前无额外分支行为 | A | ConnectLabel.label_init（无分支副作用） |
| run_<func> | 写入 `RunLabel("run_<func>", <value>)` | 触发 `Cell.run(<func>)`；若 v 非 Label 则封装 | A | RunLabel.label_init、Cell.run 调用、Function.run |

---

## Harness Assertion Rules

### 1) Evidence Level Handling
- Level A：必须严格一致（输入、输出、副作用都需一致）。
- Level B：允许在不影响可观测结果的前提下存在实现差异，但必须记录偏差并补充验证。
- Level C：必须标注“待确认”，需要补充样例或脚本实验后才能进入实现迭代。

### 2) ModelTable Diff Assertions
- 对所有 key 的触发，必须记录 `Cell.add_label` / `rm_label` 的输入与结果（p/r/c/k/t/v）。
- 对覆盖阻断类行为（例如 `v1n_id` / `data_type`），断言“未覆盖”的结果必须可观察。

### 3) Error & Log Assertions
- 对于非法 key 或不满足前置条件的场景（例如 `run_` 前缀错误），
  必须通过 `Cell.error` 或日志输出呈现错误，作为断言依据。

### 4) Bus / MQTT Assertions
- 本阶段仅定义拦截点：如后续发现 MQTT publish 行为，必须记录 topic/payload 与触发 key 的映射。
- 在未有 PICtest 证据前，不得臆造 MQTT 副作用。

### 5) Harness Intercepts (Standardized)
- ModelTable change log（Cell.add_label / rm_label 事件）
- Function execution trace（Function.run / pin_callout）
- Connect init trace（ManageCell/Model/V1N.init_inner_connection）
- v1n config snapshot（local_mqtt/global_mqtt）

---

## Open Issues (for Review Gate)
- `DE_CONNECT/DAM_CONNECT/PIC_CONNECT/WORKSPACE_CONNECT` 的后续实际副作用是否存在，需要运行态证据确认。
- `run_<func>` 的实际可构造 key 列表依赖 FunctionLabel 注册，需在 Test Harness 中定义最小样例函数集。
