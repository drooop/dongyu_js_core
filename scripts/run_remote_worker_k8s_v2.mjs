/**
 * K8s Remote Worker v2
 * 
 * 支持 Model 100 的完整程序模型执行，用于双总线 E2E 测试。
 * 基于 run_worker_remote_v0.mjs 的模式，使用 runtime 的 MQTT 自动机制。
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { WorkerEngineV0, loadSystemPatch } from './worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');

// 配置
const MQTT_HOST = process.env.MQTT_HOST || 'host.docker.internal';
const MQTT_PORT = parseInt(process.env.MQTT_PORT || '1883', 10);
const MQTT_USER = process.env.MQTT_USER || 'u';
const MQTT_PASS = process.env.MQTT_PASS || 'p';
const WORKER_ID = parseInt(process.env.WORKER_ID || '2', 10);

console.log('[k8s-worker-v2] Starting...');
console.log(`[k8s-worker-v2] MQTT: ${MQTT_HOST}:${MQTT_PORT}`);
console.log(`[k8s-worker-v2] Worker ID: ${WORKER_ID}`);

// 创建 Runtime
const rt = new ModelTableRuntime();

// 加载系统 patch（设置 mqtt_topic_mode 等）
loadSystemPatch(rt);

// 确保系统模型存在
if (!rt.getModel(-10)) {
  rt.createModel({ id: -10, name: 'system', type: 'system' });
}

// 配置 MQTT payload 模式
rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'mt_v0' });

// 启动 MQTT 循环
const mqttResult = rt.startMqttLoop({
  transport: 'real',
  host: MQTT_HOST,
  port: MQTT_PORT,
  client_id: `dy-k8s-worker-${WORKER_ID}-${Date.now()}`,
  username: MQTT_USER,
  password: MQTT_PASS,
  tls: false,
});
console.log('[k8s-worker-v2] MQTT startMqttLoop result:', JSON.stringify(mqttResult));

// 加载 Model 100 完整定义
const model100Path = path.join(process.cwd(), 'packages/worker-base/system-models/test_model_100_full.json');
if (fs.existsSync(model100Path)) {
  const patch = JSON.parse(fs.readFileSync(model100Path, 'utf8'));
  const applyResult = rt.applyPatch(patch, { allowCreateModel: true });
  console.log('[k8s-worker-v2] Model 100 loaded, apply result:', JSON.stringify(applyResult));
  
  // 打印 PIN 注册状态
  console.log('[k8s-worker-v2] PIN_IN set:', [...rt.pinInSet]);
  console.log('[k8s-worker-v2] PIN_OUT set:', [...rt.pinOutSet]);
  
  // 打印订阅状态
  if (rt.mqttClient) {
    console.log('[k8s-worker-v2] MQTT subscriptions:', [...(rt.mqttClient.subscriptions || [])]);
  }
} else {
  console.error('[k8s-worker-v2] Model 100 patch file not found:', model100Path);
  process.exit(1);
}

// 创建 Worker Engine
const engine = new WorkerEngineV0({ runtime: rt, mgmtAdapter: null, mqttPublish: null });

// 事件监听：检测 PIN_IN 并触发程序模型
let eventCursor = 0;
const timer = setInterval(() => {
  const events = rt.eventLog.list();
  for (; eventCursor < events.length; eventCursor += 1) {
    const e = events[eventCursor];
    if (!e || e.op !== 'add_label') continue;
    
    // 检测 Model 100 的 event_in PIN_IN
    if (e.cell && e.cell.model_id === 100 && e.cell.p === 0 && e.cell.r === 1 && e.cell.c === 1) {
      if (e.label && e.label.t === 'IN' && e.label.k === 'event_in') {
        console.log('[k8s-worker-v2] Detected event_in, triggering on_model100_event_in');
        rt.addLabel(rt.getModel(-10), 0, 0, 0, { k: 'run_on_model100_event_in', t: 'str', v: '1' });
      }
    }
  }
  engine.tick();
}, 50);
timer.unref();

// 心跳日志
setInterval(() => {
  const model100 = rt.getModel(100);
  if (model100) {
    const cell = rt.getCell(model100, 0, 0, 0);
    const bgColor = cell.labels.get('bg_color')?.v || 'N/A';
    const status = cell.labels.get('status')?.v || 'N/A';
    console.log(`[k8s-worker-v2] Heartbeat - Model 100: bg_color=${bgColor}, status=${status}`);
  }
}, 30000);

console.log('[k8s-worker-v2] Ready and listening for events on Model 100...');
