# Manual addLabel Case (CellA/CellB)

目标：用 `ModelTableRuntime.addLabel()` “一条 label 一条 label”地手工搭出一个最小案例，能体现当前基础能力：
- ModelTable patch 口径只允许 `add_label` / `rm_label`（唯一副作用入口）。
- Control Bus（MQTT）侧的 PIN_IN / PIN_OUT 声明与 mailbox 写入行为可以被纯 addLabel 驱动，并可通过 `mqttTrace` 与 `eventLog` 观测。

本案例用两个 Cell 来做角色抽象：
- CellA：模拟滑动 UI（Sliding UI）“写格子”的意图来源。
- CellB：模拟远端软件工人（Remote Worker）“处理后写回”的状态落点。

注意：本手动案例为了聚焦 “addLabel 触发能力”，会直接驱动 Control Bus 的 PIN mailbox（这在真实产品里必须由 MBR 桥接层完成，UI 不应直连总线）。对照 0132 的 Stage4 叙事：
- 真正链路是：UI event（MgmtBus）→ MBR → MQTT（ControlBus）→ worker-base → MQTT → MBR → MgmtBus → UI projection。
- 本文展示的是：在 worker-base runtime 内，**仅用 addLabel 就能产生/接收 PIN 消息**，这构成上述链路的“可观测执行侧基础能力”。

## 0. 关键实现口径（请以源码为准）

- Patch record op：`applyPatch()` 只支持 `add_label` / `rm_label`，不支持 `create_model` 等。
  - `packages/worker-base/src/runtime.js:209`（applyPatch）
  - `docs/ssot/runtime_semantics_modeltable_driven.md`（SSOT：副作用入口 + patch op 集合）
- Stage2（默认）下 PIN registry/mailbox 在 `model_id=0` 的固定 cell。
- `uiput_mm_v1`（multi-model）下，每个 `model_id` 各自拥有一份 PIN registry/mailbox：
  - registry：`model_id=<model_id>, p=0, r=0, c=1`
  - mailbox：`model_id=<model_id>, p=0, r=1, c=1`
  - 详见：`docs/iterations/0123-pin-mqtt-loop/validation_protocol.md`

## 1. 可复制执行脚本（推荐：逐步运行 + 每步观察）

你可以把下面脚本保存为临时文件运行，也可以直接在 node REPL 分段执行。

运行：
```bash
node - <<'NODE'
const { ModelTableRuntime } = require('./packages/worker-base/src/runtime.js');

function dump(rt, title) {
  const lastEvents = rt.eventLog.list().slice(-6);
  const lastMqtt = rt.mqttTrace.list().slice(-6);
  console.log('\n# ' + title);
  console.log('eventLog.tail=', JSON.stringify(lastEvents, null, 2));
  console.log('mqttTrace.tail=', JSON.stringify(lastMqtt, null, 2));
}

const rt = new ModelTableRuntime();

// --- CellA / CellB: 仅用于“角色落点”的可视化 ---
// CellA: model 1, cell (0,0,0)
// CellB: model 2, cell (0,0,0)
rt.createModel({ id: 1, name: 'CellA_UI', type: 'ui' });
rt.createModel({ id: 2, name: 'CellB_Worker', type: 'data' });

// Step A1: CellA 声明一次“滑动 UI 意图”（纯写格子，不触发总线）
rt.addLabel(rt.getModel(1), 0, 0, 0, {
  k: 'cellA.intent',
  t: 'json',
  v: { op_id: 'op-manual-1', action: 'pin_in', pin: 'demo', value: { payload: 1 } },
});
dump(rt, 'A1: CellA intent recorded');

// Step B1: 配置 MQTT 目标（仍然只是 addLabel 到 config cell）
// config cell = model 0, (0,0,0)
rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'mqtt_target_host', t: 'str', v: '127.0.0.1' });
rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'mqtt_target_port', t: 'int', v: 1883 });
rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'mqtt_target_client_id', t: 'str', v: 'manual-client' });

// Enable multi-model topic mode:
// Topic = <base>/<model_id>/<pin_k>
rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de/sw' });
dump(rt, 'B1: MQTT config + topic mode labels added');

// Step B2: 启动 MQTT loop（这是 host capability，不是 label）
rt.startMqttLoop();
dump(rt, 'B2: startMqttLoop()');

// Step B3: 声明 PIN_IN / PIN_OUT（uiput_mm_v1: 每个 model 自己 registry）
// registry cell = model <id>, (0,0,1)
rt.addLabel(rt.getModel(1), 0, 0, 1, { k: 'demo', t: 'PIN_IN', v: 'demo' });
rt.addLabel(rt.getModel(1), 0, 0, 1, { k: 'demo', t: 'PIN_OUT', v: 'demo' });
rt.addLabel(rt.getModel(2), 0, 0, 1, { k: 'demo', t: 'PIN_IN', v: 'demo' });
rt.addLabel(rt.getModel(2), 0, 0, 1, { k: 'demo', t: 'PIN_OUT', v: 'demo' });
dump(rt, 'B3: PIN_IN + PIN_OUT declared for model 1 and 2');

// Step B4: (模拟 MBR 的结果) 往 pin mailbox 写 OUT（model 1）
// mailbox cell = model 1, (0,1,1)
rt.addLabel(rt.getModel(1), 0, 1, 1, {
  k: 'demo',
  t: 'OUT',
  v: { op_id: 'op-manual-1', payload: { payload: 1 } },
});
dump(rt, 'B4: Model1 mailbox OUT written -> mqtt publish');

// Step B5: (模拟远端工人回包) 注入 IN 消息（进入 model 2）
// mqttIncoming 是 host capability；成功后会 addLabel 到 model2 mailbox，且记录 mqttTrace inbound
rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/2/demo', { pin: 'demo', t: 'IN', value: { op_id: 'op-manual-1', payload: { payload: 2 } } });
dump(rt, 'B5: mqttIncoming(IN) -> model2 mailbox IN');

// Step C1: 把“远端工人结果”写到 CellB（仍然是 addLabel；真实 worker 会由程序模型/流程模型驱动）
rt.addLabel(rt.getModel(2), 0, 0, 0, {
  k: 'cellB.last_result',
  t: 'json',
  v: { op_id: 'op-manual-1', pin: 'demo', value: { payload: 2 } },
});
dump(rt, 'C1: CellB result recorded');
NODE
```

你应该能观察到：
- `mqttTrace` 至少包含一次 `connect`、一次 `subscribe`、一次 `publish`（OUT）、一次 `inbound`（IN）。
- `eventLog` 会记录每个 `add_label`（含 `prev_label` 覆盖信息）。

## 2. 本案例的 Label 清单（逐条说明）

### CellA（模拟 Sliding UI）

1) `cellA.intent`
- 位置：`model_id=1, p=0, r=0, c=0`
- `t=json`
- `v={ op_id, action, pin, value }`
- 含义：模拟“滑动 UI 写格子”的用户意图（它本身不应该触发总线副作用）。
- 观测：`eventLog` 出现 `op=add_label`，cell 指向 model 1。

### Control Bus 配置（运行时配置都是 label）

2) `mqtt_target_host`
- 位置：`model_id=0, p=0, r=0, c=0`
- `t=str`, `v=127.0.0.1`
- 含义：MQTT host。

3) `mqtt_target_port`
- 位置：`model_id=0, p=0, r=0, c=0`
- `t=int`, `v=1883`
- 含义：MQTT port。

4) `mqtt_target_client_id`
- 位置：`model_id=0, p=0, r=0, c=0`
- `t=str`, `v=manual-client`
- 含义：MQTT client id。

5) `mqtt_topic_mode`
- 位置：`model_id=0, p=0, r=0, c=0`
- `t=str`, `v=uiput_mm_v1`
- 含义：启用 multi-model topic 模式。

6) `mqtt_topic_base`
- 位置：`model_id=0, p=0, r=0, c=0`
- `t=str`, `v=UIPUT/ws/dam/pic/de/sw`
- 含义：topic base（最终 topic 形如 `<base>/<model_id>/<pin_k>`）。

### PIN 声明（结构性声明）

7) `demo` with `t=PIN_IN`（model 1/2 各一份）
- 位置：`model_id=1 or 2, p=0, r=0, c=1`（PIN registry cell, per-model）
- `k=demo, t=PIN_IN, v=demo`
- 含义：声明一个可订阅的 pin；当 MQTT loop 已启动时会触发 subscribe。
- 观测：`mqttTrace` 出现 `subscribe topic="demo/demo"`（取决于 prefix）。

8) `demo` with `t=PIN_OUT`（model 1/2 各一份）
- 位置：`model_id=1 or 2, p=0, r=0, c=1`
- `k=demo, t=PIN_OUT, v=demo`
- 含义：声明一个可出站的 pin；配合 mailbox `t=OUT` 写入会触发 publish。

### PIN mailbox（收发消息的“邮箱”）

9) `demo` with `t=OUT`
- 位置：`model_id=1, p=0, r=1, c=1`（PIN mailbox cell, per-model）
- `k=demo, t=OUT, v={ op_id, payload }`
- 含义：往控制总线发出 PIN_OUT（worker → 外部）。
- 观测：`mqttTrace` 出现 `publish topic="demo/demo" payload={pin:"demo",t:"OUT",...}`。

10) `demo` with `t=IN`（由 `mqttIncoming()` 间接写入）
- 位置：`model_id=2, p=0, r=1, c=1`
- `k=demo, t=IN, v={ pin, t:"IN", value }`
- 含义：控制总线入站 PIN_IN（外部 → worker）。
- 观测：`mqttTrace` 出现 `inbound`，且 `eventLog` 新增一次 `add_label`（t=IN）。

### CellB（模拟 Remote Worker 的“落点状态”）

11) `cellB.last_result`
- 位置：`model_id=2, p=0, r=0, c=0`
- `t=json`
- `v={ op_id, pin, value }`
- 含义：模拟“远端软件工人”把处理结果写回到自己的状态（真实系统里应由程序模型/流程模型观察 PIN mailbox 后执行写入）。

## 3. 这个手动案例如何映射回 0132

- 0132 的 Stage4 v0 contract 强调 `op_id` 是跨总线因果主键：本文所有涉及消息的 label 都携带 `op_id`，便于在 `eventLog` / `mqttTrace` 里做关联。
- 本文刻意不涉及 Matrix/mgmt bus 的真实收发（那部分应由 0132 harness：`scripts/validate_dual_bus_harness_v0.mjs` 覆盖）。
- 你可以把本文理解为：当 mgmt→mbr 已经把 UI event 翻译为 ControlBus PIN_IN/OUT 时，worker-base runtime 在“只靠 addLabel/mqttIncoming”条件下能够被完整驱动。

## 4. 额外：用户模型 intent.v0 → 系统负数模型执行（推荐入口）

为了符合“基座基础能力之外尽可能由基座基础模型 patch 提供”的原则，当前基座基础模型（`packages/worker-base/system-models/system_models.json`）提供了一个 system function：`intent_dispatch`。

宿主（例如 `packages/ui-model-demo-server/server.mjs`）会把用户模型里对 `intent.v0` 的写入识别为“请求”，并在系统负数模型中排队成 `intent_job_*`，然后触发 `run_intent_dispatch` 执行。

### 4.1 用户侧写入（model_id > 0）

在 user model（例如 model 1）里写入 label：

- `k=intent.v0, t=json, v={ op_id, action, ... }`

当前支持的 action（v0，最小集合）
- `pin_register`
  - `v={ op_id, action:"pin_register", pin_k:"demo" }`
- `pin_send_out`
  - `v={ op_id, action:"pin_send_out", pin_k:"demo", value:{...} }`

### 4.2 预期效果（可观测）

当你写入 `pin_register`：
- system 会在 `model_id=<user_model_id>, p=0,r=0,c=1` 写入：
  - `k=<pin_k>, t=PIN_IN`
  - `k=<pin_k>, t=PIN_OUT`

当你写入 `pin_send_out`：
- system 会在 `model_id=<user_model_id>, p=0,r=1,c=1` 写入：
  - `k=<pin_k>, t=OUT, v=<value>`

同时会写回一个用户可读的结果（同 cell）：
- `k=intent_result, t=json, v={ op_id, result:"ok"|"error", ... }`

### 4.3 与 multi-model topic 的关系

若启用了 `uiput_mm_v1`（`mqtt_topic_mode/mqtt_topic_base`），则上述 PIN 注册与 OUT 发送会落到 topic：

`<mqtt_topic_base>/<model_id>/<pin_k>`
