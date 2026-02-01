# Evidence Pointers: PICtest Matrix/MQTT (v0)

本文件仅记录 PICtest 中与 Matrix/MQTT 通道相关的“证据指针/可观测事实来源”，不做语义发明，不构成对外契约。

## 0. Scope
- 仅列出可定位的源码路径与文档证据指针。
- 不推导未证据支持的字段/行为。
- 任何契约化结论必须写入 `contract_dual_bus_v0.md`，并标注“证据来源/待确认”。

## 1. 已有文档证据指针（本仓库）
- `docs/v1n_concept_and_implement.md`
  - MQTT topic 规则指针：
    - `PICtest/yhl/Connect/manageV1N.py` 使用 `USERPUT/{v1n_id}/{pin_name}/{pin_type}`
    - `PICtest/yhl/Connect/manageModelUI.py` 使用 `UIPUT/{v1n_id}/{model_id}/{pin.name}/{pin.pin_type}`
  - Matrix 通道指针：
    - `PICtest/yhl/Connect/manageModelUI.py` 通过 `MatrixClientManager` 建立通道
    - room id 在 PICtest 中硬编码（文档中给出示例值）
- `docs/concepts/pictest_pin_and_program_model.md`
  - 运行时副作用入口：`Cell.add_label` → `label_init`（PIN_IN/OUT 行为由结构性声明触发）
- `docs/iterations/0122-pictest-evidence/evidence.md`
  - 证据记录格式与 Level A 行为锚点

## 2. PICtest 源码指针（仅指针，不作推导）
- `vendor/PICtest/yhl/Connect/manageV1N.py`
  - MQTT 主题规则（V1N 级别）
- `vendor/PICtest/yhl/Connect/manageModelUI.py`
  - MQTT 主题规则（UI 模型级别）
  - Matrix 通道管理（MatrixClientManager）
- `vendor/PICtest/yhl/MQTT/MQTT.py`
  - MQTT 客户端管理器（MQTT_Client_Manager）
- `vendor/PICtest/yhl/Connect/PIN.py`
  - PIN 发送/接收与写回（PIN.save_ / PIN.receive）

## 3. 可观测事实（基于文档指针，需进一步证据化）
- MQTT topic 与 room id 在 PICtest 内部硬编码存在（是否对外契约：待确认）。
- Matrix 通道由 `manageModelUI.py` 负责建立与管理（具体消息映射规则：待补证据）。

## 4. 待确认问题清单
- 上游是否依赖 PICtest 的 MQTT topic 规则与 Matrix room id（契约性）。
- Matrix 收发与 ModelTable 结构性声明之间的精确映射是否在 PICtest 有可观测证据（需补证据表）。
- Matrix 事件 payload 是否包含可稳定解析的 op_id/trace_id（需补证据表）。
