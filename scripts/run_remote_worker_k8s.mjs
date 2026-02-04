import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');
const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

// 配置
const MQTT_HOST = process.env.MQTT_HOST || 'host.docker.internal';
const MQTT_PORT = parseInt(process.env.MQTT_PORT || '1883');
const MODEL_ID = parseInt(process.env.WORKER_MODEL_ID || '2');
const TOPIC = `UIPUT/ws/dam/pic/de/sw/${MODEL_ID}/#`;

console.log('[remote_worker] Starting...');
console.log(`[remote_worker] MQTT: ${MQTT_HOST}:${MQTT_PORT}`);
console.log(`[remote_worker] Topic: ${TOPIC}`);

// 创建 Runtime
const runtime = new ModelTableRuntime();

// 加载程序模型
const patchPath = path.join(process.cwd(), 'packages/worker-base/system-models/remote_worker_model.json');
if (fs.existsSync(patchPath)) {
  const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
  runtime.applyPatch(patch, { allowCreateModel: true });
  console.log('[remote_worker] Program model loaded');
} else {
  console.error('[remote_worker] Patch file not found:', patchPath);
  process.exit(1);
}

// 连接 MQTT
const client = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
  clientId: `remote_worker_${Date.now()}`,
  clean: true,
  reconnectPeriod: 1000,
});

client.on('connect', () => {
  console.log(`[remote_worker] Connected to MQTT`);
  client.subscribe(TOPIC, (err) => {
    if (err) {
      console.error('[remote_worker] Subscribe error:', err);
    } else {
      console.log(`[remote_worker] Subscribed to ${TOPIC}`);
    }
  });
});

client.on('message', (topic, payload) => {
  console.log(`[remote_worker] <<< ${topic}`);

  try {
    const data = JSON.parse(payload.toString());
    console.log('[remote_worker] Payload:', JSON.stringify(data).substring(0, 100));

    // 写入 PIN_IN (Model 2, Cell 0,1,1)
    const model = runtime.getModel(MODEL_ID);
    if (!model) {
      console.error('[remote_worker] Model not found:', MODEL_ID);
      return;
    }

    runtime.addLabel(model, 0, 1, 1, {
      k: 'mqtt_in',
      t: 'json',
      v: data
    });

    console.log('[remote_worker] Data written to PIN_IN');

    // 执行程序模型 (需要实现 tick 机制或调用 run_ function)
    // 这里简化处理：直接执行函数
    const sysModel = runtime.getModel(-10);
    const funcCell = runtime.getCell(sysModel, 3, 0, 0);
    const funcLabel = funcCell.labels.get('process_mqtt_message');

    if (funcLabel && funcLabel.t === 'function') {
      // 创建 ctx 上下文
      const ctx = {
        getLabel: (ref) => {
          const m = runtime.getModel(ref.model_id);
          const c = runtime.getCell(m, ref.p, ref.r, ref.c);
          return c.labels.get(ref.k)?.v || null;
        },
        setLabel: (ref, label) => {
          const m = runtime.getModel(ref.model_id);
          runtime.addLabel(m, ref.p, ref.r, ref.c, label);
        },
        runtime
      };

      try {
        const fn = new Function('ctx', funcLabel.v);
        fn(ctx);
      } catch (err) {
        console.error('[remote_worker] Function execution error:', err);
      }
    }

  } catch (err) {
    console.error('[remote_worker] Message processing error:', err);
  }
});

client.on('error', (err) => {
  console.error('[remote_worker] MQTT error:', err);
});

client.on('close', () => {
  console.log('[remote_worker] MQTT connection closed');
});

// 心跳
setInterval(() => {
  const model = runtime.getModel(MODEL_ID);
  if (model) {
    const cellCount = model.cells?.size || 0;
    console.log(`[remote_worker] Heartbeat - Model ${MODEL_ID} has ${cellCount} cells`);
  }
}, 30000);

console.log('[remote_worker] Ready and listening...');
