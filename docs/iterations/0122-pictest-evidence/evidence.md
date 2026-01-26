# PICtest 行为证据表（built-in k / PIN / trigger）

## Evidence Levels
- Level A：直接可观测行为（源码中明确的条件与副作用，调用路径清晰）。
- Level B：基于调用链的可推导行为（需运行态条件成立，或隐含前置条件）。
- Level C：依赖外部环境或运行态不确定因素（需要额外实验/脚本确认）。

---

## Step 1 — Enumeration / 枚举与分类（仅收集与分类，不归纳）

### 1) Label 类型（具备 label_init 侧效应）
- `WebHandlerLabel`：`vendor/PICtest/yhl/labels.py`（`WebHandlerLabel.label_init`）
- `SubmtLabel`：`vendor/PICtest/yhl/labels.py`（`SubmtLabel.label_init`）
- `FunctionLabel`：`vendor/PICtest/yhl/labels.py`（`FunctionLabel.label_init`）
- `RunLabel`：`vendor/PICtest/yhl/labels.py`（`RunLabel.label_init`）
- `ConnectLabel`：`vendor/PICtest/yhl/labels.py`（`ConnectLabel.label_init`）
- `InLabel` / `OutLabel` / `LogInLabel` / `LogOutLabel`：`vendor/PICtest/yhl/labels.py`（对应 `label_init`）

### 2) label.k 的特殊处理（Cell.add_label 内部）
- `local_mqtt` / `global_mqtt` / `model_type` / `data_type` / `v1n_id`：`vendor/PICtest/yhl/core.py`（`Cell.add_label`）

### 2.1) Built-in k Inventory (Concrete Keys)
> 仅列出 **PICtest 运行时明确识别** 的具体 key（非抽象分类），并标注证据等级。

**Observed Keys (Level A)**
- `local_mqtt` / `global_mqtt` / `model_type` / `data_type` / `v1n_id`\n  - 证据：`vendor/PICtest/yhl/core.py`（`Cell.add_label`）\n  - 行为：写入时触发特定分支或阻断覆盖（详见 Step 2 表格）
- `CELL_CONNECT` / `MODEL_CONNECT` / `V1N_CONNECT` / `DE_CONNECT` / `DAM_CONNECT` / `PIC_CONNECT` / `WORKSPACE_CONNECT`\n  - 证据：`vendor/PICtest/yhl/labels.py`（`ConnectLabel.label_init` 的允许集合）\n  - 行为：仅 CELL/MODEL/V1N 触发连接初始化，其它待验证（见 Notes）
- `run_` 前缀（例如 `run_<func>`）\n  - 证据：`vendor/PICtest/yhl/labels.py`（`RunLabel.label_init`）\n  - 行为：用于触发 `Cell.run`；不以 `run_` 开头会报错并返回

**Discovery Rule (for remaining keys, to be applied in next Iteration)**\n
- 在 PICtest 中搜索对 `label.k` 的**显式分支判断**或**白名单校验**，作为“运行时识别 key”的唯一证据来源。\n
- 对于仅作为业务数据键使用、且无运行时分支的 `label.k`，**不得**纳入 Built-in k Inventory。\n
- 若发现新 key，必须：\n  1) 绑定文件路径 + 符号位置；\n  2) 标注 Evidence Level；\n  3) 在证据表中补充可观测输入/副作用。\n+
### 3) PIN 体系
- `PINType` 枚举：`vendor/PICtest/yhl/Connect/PIN.py`（`PINType`）
- `PIN.save_` / `PIN.receive`：`vendor/PICtest/yhl/Connect/PIN.py`
- Function 内建 PIN：`vendor/PICtest/yhl/function.py`（`Function.__init__`）
- 单元格默认 LOG_OUT 引脚：`vendor/PICtest/yhl/Connect/manageCell.py`（`ManageCell.__init__`）

### 4) 连接与触发入口
- `ManageCell.init_pin` / `init_inner_connection` / `add_connect`：`vendor/PICtest/yhl/Connect/manageCell.py`
- `Cell.add_label` 触发 `label_init`：`vendor/PICtest/yhl/core.py`
- `Function.handle_call` / `Function.run`：`vendor/PICtest/yhl/function.py`

### 5) ConnectLabel 接受的连接类型（label.k 允许值）
- `CELL_CONNECT` / `MODEL_CONNECT` / `V1N_CONNECT` / `DE_CONNECT` / `DAM_CONNECT` / `PIC_CONNECT` / `WORKSPACE_CONNECT`
  - 来源：`vendor/PICtest/yhl/labels.py`（`ConnectLabel.label_init`）

---

## Step 2 — Behavior Evidence Table

### A) Label 触发行为（Label.label_init）

| Item | Input | Conditions | Side Effects | Error Behavior | Idempotency | Evidence Level | Source |
|---|---|---|---|---|---|---|---|
| FunctionLabel.label_init | label.k=函数名, label.v=回调名/None | 被 `Cell.add_label` 调用 | 调用 `Model.add_method(...)` 注册方法包装器 | 若方法不存在或重复：移除 label 并记录错误 | 同名方法已存在会阻止再次添加 | Level A | `vendor/PICtest/yhl/labels.py` (`FunctionLabel.label_init`), `vendor/PICtest/yhl/core.py` (`Model.add_method`) |
| RunLabel.label_init | label.k 以 `run_` 开头 | 需有运行中的 asyncio loop | 调用 `Cell.run(function_name)`；若 label.v 非 Label 则封装为 `Label(k="", t=type(v).__name__)` | k 不以 `run_` 开头会记录错误并返回 | 若无运行中的 loop 直接返回 | Level A | `vendor/PICtest/yhl/labels.py` (`RunLabel.label_init`) |
| ConnectLabel.label_init | label.k ∈ 允许集合，label.v 为 dict | 允许集合：CELL_CONNECT/MODEL_CONNECT/V1N_CONNECT/DE_CONNECT/DAM_CONNECT/PIC_CONNECT/WORKSPACE_CONNECT | 根据 label.k 触发连接初始化（CELL/MODEL/V1N） | k 不在允许集合或 v 非 dict：记录错误并返回 | 连接初始化是否重复取决于 connect_manage 实现 | Level A | `vendor/PICtest/yhl/labels.py` (`ConnectLabel.label_init`) |
| InLabel.label_init | label.k=引脚名, label.v=引脚值 | 总是执行；主单元格会向 Model/V1N 扩散 | 调用 `connect_manage.init_pin`（Cell/Model/V1N） | 无显式错误分支 | 由 connect_manage 是否已存在引脚决定 | Level A | `vendor/PICtest/yhl/labels.py` (`InLabel.label_init`) |
| OutLabel.label_init | 同上 | 同上 | 同上（OUT） | 同上 | 同上 | Level A | `vendor/PICtest/yhl/labels.py` (`OutLabel.label_init`) |
| LogInLabel.label_init | 同上 | 同上 | 同上（LOG_IN） | 同上 | 同上 | Level A | `vendor/PICtest/yhl/labels.py` (`LogInLabel.label_init`) |
| LogOutLabel.label_init | 同上 | 同上 | 同上（LOG_OUT） | 同上 | 同上 | Level A | `vendor/PICtest/yhl/labels.py` (`LogOutLabel.label_init`) |

### B) PIN 与连接机制

| Item | Input | Conditions | Side Effects | Error Behavior | Idempotency | Evidence Level | Source |
|---|---|---|---|---|---|---|---|
| PIN.save_ | value | `LABEL_REGISTRY` 包含 pin_type.value | 生成对应 Label 并 `parent.add_label` | 未找到类型时记录错误并用 `Label(t="NONE")` | 覆盖同 key 的 Label（由 `Cell.add_label` 决定） | Level A | `vendor/PICtest/yhl/Connect/PIN.py` (`PIN.save_`), `vendor/PICtest/yhl/core.py` (`Cell.add_label`) |
| PIN.receive | value | connectTo 列表存在或 specialHandle 设置 | 对每个连接异步 `save_`；若 specialHandle 存在则执行 | 无显式错误分支 | 连接列表中每次都会发送 | Level A | `vendor/PICtest/yhl/Connect/PIN.py` (`PIN.receive`) |
| Function.__init__ (pins) | function name | 创建时 | 创建 `$<name>_cin$`/`$<name>_cout$`/`$<name>_lout$`，并将 cin 绑定 specialHandle | 若 parent 不是 Cell 或 pin_type 非法会打印错误 | 每次 Function 实例化都会创建新 PIN | Level A | `vendor/PICtest/yhl/function.py` (`Function.__init__`) |
| ManageCell.init_pin | pin_name/pin_type/value | 仅当 cell 存在 | 若未找到 pin 则创建；若已完成连接初始化且 value 非 None：异步 `pin.receive(value)` | 若函数引脚名格式不合法会打印错误（来自 `get_function_pin`) | 复用或新建 pin 取决于是否已存在 | Level A | `vendor/PICtest/yhl/Connect/manageCell.py` (`init_pin`, `get_function_pin`) |
| ManageCell.init_inner_connection | CELL_CONNECT dict | CELL_CONNECT label 存在 | 为 source/target pin 建立连接并标记 `is_connect_init=True` | 源/目标 pin 不存在会打印错误 | 重复连接由 `PIN.add_connect(check=True)` 控制 | Level A | `vendor/PICtest/yhl/Connect/manageCell.py` (`init_inner_connection`, `PIN.add_connect`) |
| ManageCell.add_connect | source_pin/target_pin | pin_type 必须匹配 | 建立连接并写回 `CELL_CONNECT` | 类型不匹配/循环连接会记录错误并返回 | 重复连接被去重 | Level A | `vendor/PICtest/yhl/Connect/manageCell.py` (`add_connect`), `vendor/PICtest/yhl/Connect/PIN.py` (`PIN.add_connect`) |

### C) Function 触发与输出

| Item | Input | Conditions | Side Effects | Error Behavior | Idempotency | Evidence Level | Source |
|---|---|---|---|---|---|---|---|
| Function.handle_call | value | 由 pin_callin specialHandle 触发 | 调用 `Function.run`；若 value 非 Label 则封装为 `Label(k="", t=type(value).__name__)` | 无显式错误分支 | 每次收到都会触发 | Level A | `vendor/PICtest/yhl/function.py` (`handle_call`) |
| Function.run | label/callback/show_UI | 异步执行 func；`not_function_call` 决定是否触发 pin_callout | 结果非 None 时记录 info；若 `not_function_call=True` 触发 `pin_callout.save_` | try/except 记录 error | 无显式幂等控制 | Level A | `vendor/PICtest/yhl/function.py` (`run`) |
| Model.add_method wrapper | label | FunctionLabel 已注册 | 调用 `Function.run(..., not_function_call=False)`（结果不触发 pin_callout） | 同名方法存在则移除 label 并记录错误 | 重复添加同名方法被拒绝 | Level A | `vendor/PICtest/yhl/core.py` (`Model.add_method`) |

### D) Cell.add_label 特殊 key 处理

| Item | Input | Conditions | Side Effects | Error Behavior | Idempotency | Evidence Level | Source |
|---|---|---|---|---|---|---|---|
| Cell.add_label (general) | label | 总是执行 | 更新 label.s/i/m 并写 DB；调用 `label_init` | 无显式错误分支 | 同 key 覆盖（部分 key 有阻断） | Level A | `vendor/PICtest/yhl/core.py` (`Cell.add_label`) |
| v1n_id 覆盖阻断 | label.k=`v1n_id` | 主模型主单元格且 model.id==0 | 直接 return（不覆盖） | 无显式错误分支 | 已存在时阻断覆盖 | Level A | `vendor/PICtest/yhl/core.py` (`Cell.add_label`) |
| data_type 覆盖阻断 | label.k=`data_type` | Data 模型主单元格 | 直接 return（不覆盖） | 无显式错误分支 | 已存在时阻断覆盖 | Level A | `vendor/PICtest/yhl/core.py` (`Cell.add_label`) |
| local_mqtt / global_mqtt | label.k=`local_mqtt`/`global_mqtt` | MT 主模型主单元格 | 设置 `v1n.local_mqtt_ip` / `v1n.global_mqtt_ip` | 无显式错误分支 | 每次写入覆盖 | Level A | `vendor/PICtest/yhl/core.py` (`Cell.add_label`) |
| data_type 初次定义 | label.k=`data_type` | Data 模型主单元格且此前为空 | 移除 `CELL_CONNECT` 并 `init_type()` | 无显式错误分支 | 仅首次触发 | Level A | `vendor/PICtest/yhl/core.py` (`Cell.add_label`) |

---

## Notes / Uncertainties (待验证)
- `ConnectLabel` 允许的 key 包含 `DE_CONNECT/DAM_CONNECT/PIC_CONNECT/WORKSPACE_CONNECT`，但当前 `label_init` 仅处理 CELL/MODEL/V1N 三类；其它类型的实际行为需要额外样例或运行态证据（建议 Level C 验证）。
- MQTT 与外部总线行为不在本 Iteration 范围内；相关可观测行为需后续在 Test Harness 中验证。
