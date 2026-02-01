# Validation Protocol v0 (pin-mqtt-loop)

本协议定义 Stage 2.3 的验证口径：PIN_IN/OUT + 本地 Docker MQTT loop。

## Required Traces
- EventLog (ModelTable)
- snapshot (ModelTable)
- intercepts (runtime status / init_inner_connection)
- mqtt_trace (connect target, subscribe/publish topics, payload)

## Structural Declaration Assertions
- PIN_IN/PIN_OUT 必须作为结构性声明进入 ModelTable（通过 add_label / rm_label）。\n
- 任何 MQTT 副作用必须由对应 add_label/rm_label 驱动（不得绕过 ModelTable）。\n

## PIN Mapping Assertions (v0)
- PIN registry cell（page0: p=0,r=0,c=1）存在 PIN_IN/PIN_OUT 声明：\n
  - `k="<pin_name>" t="PIN_IN"` / `k="<pin_name>" t="PIN_OUT"`\n
- PIN mailbox cell（page0: p=0,r=1,c=1）用于运行期消息写回：\n
  - MQTT IN → add_label(`k="<pin_name>" t="IN" v="<payload>"`)\n
  - PIN OUT → publish from mailbox `t="OUT"`\n

## MQTT Topic & Payload Assertions (v0)
- Topic: `<prefix>/<pin_name>`（若 prefix 为空则为 `<pin_name>`）\n
- Payload: JSON `{ "pin": "<pin_name>", "value": <payload>, "t": "IN|OUT" }`\n
- QoS: 0; Retain: false\n
> 若 PICtest 未明确 topic/payload，则对齐点仅限 PIN 行为副作用；topic 字符串不作为硬性一致条件。

## MQTT Topic Mode (Backward Compatible)

默认仍是 Stage 2 v0：`<prefix>/<pin_name>`。

为支持同一 runtime 同时服务多个 `model_id`（multi-model），引入一个可选 mode：

### Mode: `uiput_mm_v1`

**配置（写入 page0 config cell：`model_id=0,p=0,r=0,c=0`）**
- `k="mqtt_topic_mode" t="str" v="uiput_mm_v1"`
- `k="mqtt_topic_base" t="str" v="UIPUT/<workspace>/<DAM>/<PIC>/<DE>/<SW>"`

**Topic 规则（v1）**
- Topic: `<base>/<model_id>/<pin_k>`
  - `<base> == mqtt_topic_base`
  - `<model_id>` 为十进制整数（例如 `2`）
  - `<pin_k>` 为 leaf（不得包含 `/`）

**结构性声明位置（v1）**
- PIN registry cell（每个 model 自己一份）：`model_id=<model_id>, p=0,r=0,c=1`
  - `k=<pin_k>, t=PIN_IN|PIN_OUT`
- PIN mailbox cell（每个 model 自己一份）：`model_id=<model_id>, p=0,r=1,c=1`
  - MQTT IN → add_label(`k=<pin_k>, t=IN, v=<payload>`)
  - PIN OUT → publish from mailbox `t=OUT`

**兼容性约束**
- `mqtt_topic_mode` 未设置时视为 Stage 2 v0；不得影响既有用例。

---

## Test Cases & Assertions

### Case A: Args 覆盖写入用例
**Setup**
- 启动参数提供 mqtt target（host/port/client_id/...）。

**Assertions**
- EventLog: page0 配置 labels 被 add_label 覆盖写入（可观测）。
- snapshot: page0 配置 label 值与 args 一致。
- mqtt_trace: connect target 使用覆盖后的配置。
- runtime status intercept: `mqtt_runtime_status = running`。

### Case B: 无 args 读取用例
**Setup**
- 启动参数不含 mqtt target；page0 预置配置完整。

**Assertions**
- EventLog: 无 args 覆盖写入记录。
- snapshot: 使用 page0 预置配置。
- mqtt_trace: connect target 使用 page0 配置。
- runtime status intercept: `mqtt_runtime_status = running`。

### Case C: 缺配置失败用例
**Setup**
- 启动参数不含 mqtt target；page0 缺必填项。

**Assertions**
- EventLog: 写入 `mqtt_runtime_error_*` labels。
- snapshot: error_code/error_reason/detail 存在。
- mqtt_trace: 不进入 publish/subscribe loop。
- runtime status intercept: `mqtt_runtime_status = failed`。

---

## PASS/FAIL Rules
- PASS：三类用例的 EventLog/snapshot/intercepts 与 mqtt_trace 均满足断言，且 PIN 映射符合 Structural Declaration 规则。
- FAIL：任何断言失败，或出现未证据支持的 MQTT 行为，或绕过 ModelTable 触发副作用。
