# PICtest PIN_IN/PIN_OUT 与程序模型触发机制（理解记录）

> 目的：将 PICtest 中与 PIN_IN/PIN_OUT、程序模型触发相关的“可观测行为”整理为可复用的理解记录。

## 0. 适用范围与约束

- 行为真值源：PICtest（以 `docs/iterations/0122-pictest-evidence/evidence.md` 的证据条目为准）。
- 语义裁判：`docs/ssot/runtime_semantics_modeltable_driven.md`（仅解释“结构性声明 → 副作用”，不替代 PICtest 证据）。
- 不做推测：仅记录证据表中的 Level A 行为与明确触发路径。

## 1. 证据锚点（PICtest 源码路径）

证据表引用的关键路径与符号：

- `vendor/PICtest/yhl/core.py`
  - `Cell.add_label`（触发 `label_init` 的统一入口）
  - `Model.add_method`（FunctionLabel 注册 wrapper）
- `vendor/PICtest/yhl/labels.py`
  - `InLabel/OutLabel/LogInLabel/LogOutLabel.label_init`
  - `RunLabel.label_init`
  - `FunctionLabel.label_init`
  - `ConnectLabel.label_init`
- `vendor/PICtest/yhl/function.py`
  - `Function.__init__`（创建 `$<name>_cin$/$<name>_cout$/$<name>_lout$`）
  - `Function.handle_call`（引脚触发入口）
  - `Function.run`（函数执行与输出写回）
- `vendor/PICtest/yhl/Connect/PIN.py`
  - `PINType`（PIN 类型枚举）
  - `PIN.save_`（将值写回为 Label 并 `add_label`）
  - `PIN.receive`（广播到连接的 PIN 并触发 specialHandle）
- `vendor/PICtest/yhl/Connect/manageCell.py`
  - `ManageCell.init_pin`（引脚初始化）
  - `ManageCell.init_inner_connection`（连接初始化）
  - `ManageCell.add_connect`（连接建立）

来源：`docs/iterations/0122-pictest-evidence/evidence.md`

## 2. PIN_IN / PIN_OUT 的 PICtest 行为理解

### 2.1 PIN 类型与基础操作

证据表中与 PIN 直接相关的行为：

- `PINType` 定义引脚类型（来源：`PICtest/yhl/Connect/PIN.py`）。
- `PIN.save_`：基于 `pin_type.value` 生成对应 Label 并调用 `parent.add_label`。
  - 若类型未知：记录错误并用 `Label(t="NONE")`。
- `PIN.receive`：将值广播到连接的引脚；若存在 `specialHandle` 则执行。

### 2.2 PIN 的初始化与连接

通过 `ManageCell` 完成 PIN 与连接初始化：

- `ManageCell.init_pin`：
  - 不存在则创建；若已完成连接初始化且 value 非空，会异步 `pin.receive(value)`。
- `ManageCell.init_inner_connection`：
  - 基于 `CELL_CONNECT` 建立 source/target PIN 连接，标记 `is_connect_init`。
- `ManageCell.add_connect`：
  - 校验 pin_type；类型不匹配或循环连接会报错并返回。

### 2.3 PIN_IN / PIN_OUT 的定位（以 Label 视角）

从证据表推导出的“结构性声明”触发路径：

- `Cell.add_label` → `label_init`（Label 触发入口）
- `InLabel/OutLabel.label_init`：调用 `connect_manage.init_pin`（Cell/Model/V1N）

这意味着：

- PIN_IN / PIN_OUT 的可观测行为依赖 `label_init` 与 `connect_manage.init_pin`。
- PIN 的实际副作用（连接、接收、发送）均由 PIN.save_ / PIN.receive 驱动。

## 3. 程序模型注册/加载过程（PICtest）

以下内容来自 `docs/v1n_concept_and_implement.md` 对 PICtest 初始化与装配流程的描述（作为当前仓库的可核验证据）。

### 3.1 初始化入口与主模型加载

- 启动入口通过 `yhl.main.init(v1n_name, mode, v1n_id)` 初始化 V1N。
- 主模型加载：`V1N.init_main_model` 调用 `Model.from_db(mt_name="MT", mt_id=0)` 加载主模型；失败时创建新 `Model(name="MT", id=0, model_type="main")` 并持久化。
- 子模型加载：`SubmtLabel.label_init` 在初始化阶段调用 `Model.from_db(mt_id=submt_id, mt_name=submt_path)`，加载子模型并挂到 `Model.submts_map`。

### 3.2 代码装配与函数注册

在 `yhl.main.init` 加载模型后，按顺序调用以下装配步骤：

1) `load_model_function`：遍历子模型并调用各模型的 `init_function`。
2) `load_user_function`：动态导入 `v1n.{v1n_name}.main:init_cell`，由该函数使用 `v1n.init_cellcode(...)` 把代码绑定到具体 Cell/Function。
3) `load_v1n_function_label`：扫描 `FunctionLabel` 并调用 `Model.add_method` 将函数暴露为模型方法。
4) `load_all_model_pin_connect`：初始化各层级 `connect_manage`，从 `IN/OUT/LOG_*` 标签恢复引脚，并根据 `CELL_CONNECT/MODEL_CONNECT` 等连接表恢复引脚连接关系。

### 3.1 三种触发入口（证据表 Level A）

1) **显式调用**
   - `Cell.run` 通过 `asyncio.create_task` 调度 `Function.run`。

2) **RunLabel 触发**
   - `RunLabel.label_init` 识别 `run_<func>` 前缀并触发 `Cell.run(function_name)`。
   - 若无事件循环则直接返回（初始化阶段不触发）。

3) **引脚触发**
   - `Function.__init__` 创建 `$<name>_cin$/$<name>_cout$/$<name>_lout$`，并将 cin 绑定 `specialHandle`。
   - `PIN.receive` 触发 `Function.handle_call` → `Function.run`。

### 3.2 方法注册与调用路径

- `FunctionLabel.label_init`：注册方法包装器 `Model.add_method`。
- `Model.add_method` wrapper：调用 `Function.run(..., not_function_call=False)`；结果不触发 `pin_callout`。

### 3.3 结果回传与扩散

- `Function.run` 产出结果后调用 `PIN.save_` 写回 Label。
- `PIN.receive` 将值广播到连接的 PIN，并触发下游。

## 4. 程序模型触发机制（PICtest）

来自 `docs/ssot/runtime_semantics_modeltable_driven.md` 的硬约束：

- 副作用只能通过 `add_label` / `rm_label` 触发。
- PIN_IN 只是“结构性声明”的一个实例，不是特例：
  - `Label(k=<topic>, t="PIN_IN")` 的副作用是 **订阅 topic**，并将外部消息写回 ModelTable。
- 删除 PIN_IN → 对应的 unsubscribe。
- 所有副作用必须可观测（EventLog / intercept），失败必须写回 ModelTable。

## 5. 运行时语义裁判（与 PIN/触发相关）

- `ConnectLabel` 允许的 key 包含 `DE_CONNECT/DAM_CONNECT/PIC_CONNECT/WORKSPACE_CONNECT`，但证据表显示当前只对 CELL/MODEL/V1N 三类有明确初始化行为，其它类型需要额外运行态证据。
- 外部总线（MQTT/Matrix）更细的触发语义不在本次记录范围内，需要在 Test Harness/对照验证中补证据。

## 6. 已知不确定项（保留）

围绕 PIN_IN/PIN_OUT 与触发机制的进一步问题可以在此文件追加：

- PIN 类型与 Label 类型的映射细则（以证据表为准）
- `connect_manage` 在 Model/V1N 层的差异化行为
- `run_<func>` 与 `FunctionLabel` 的执行边界
- 触发链路的幂等与错误回写策略

## 7. 后续讨论入口

围绕注册/加载过程的进一步问题可以在此文件追加：

- `init_cellcode` 的绑定范围与约束
- `load_*` 顺序与失败处理（是否有短路/回滚行为）
- FunctionLabel 扫描与 `Model.add_method` 的覆盖策略

## 8. 参考文档

- `docs/iterations/0122-pictest-evidence/evidence.md`
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/v1n_concept_and_implement.md`
