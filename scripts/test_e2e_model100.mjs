#!/usr/bin/env node
/**
 * Model 100 E2E 测试脚本
 * 
 * 测试完整的双总线往返流程：
 * 1. 本地 Submit (Model 100, Cell 0,0,2, ui_event)
 * 2. → forward_model100_events → Matrix (dy.bus.v0, source_model_id: 100)
 * 3. → MBR Worker (mbr_mgmt_to_mqtt) → MQTT topic: UIPUT/.../100/event_in
 * 4. → K8s Worker PIN_IN → on_model100_event_in → 计算颜色
 * 5. → K8s PIN_OUT (patch: 更新 bg_color)
 * 6. → MQTT topic: UIPUT/.../100/patch_out
 * 7. → MBR (mbr_mqtt_to_mgmt) → Matrix (dy.bus.v0, snapshot_delta)
 * 8. → 本地 UI Server (handleDyBusEvent) → Model 100 PIN_IN (patch_in)
 * 9. → on_model100_patch_in → apply patch → bg_color 更新
 * 
 * 使用方法：
 * 1. 确保以下服务已启动：
 *    - Docker MQTT (1883)
 *    - Matrix Synapse
 *    - UI Server (9000)
 *    - MBR Worker
 *    - K8s Worker (或本地模拟)
 * 
 * 2. 运行测试：
 *    node scripts/test_e2e_model100.mjs
 */

import http from 'node:http';

const UI_SERVER_URL = process.env.UI_SERVER_URL || 'http://127.0.0.1:9000';
const TIMEOUT_MS = parseInt(process.env.E2E_TIMEOUT_MS || '30000', 10);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = JSON.stringify(body);
    
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body, parseError: e.message });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error('Request timeout'));
    });
    
    req.write(data);
    req.end();
  });
}

async function httpGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'GET',
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body, parseError: e.message });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error('Request timeout'));
    });
    
    req.end();
  });
}

function getModel100BgColor(snapshot) {
  if (!snapshot || !snapshot.models) return null;
  const model100 = snapshot.models['100'];
  if (!model100 || !model100.cells) return null;
  
  // Cell (0,0,0) 包含 bg_color
  const cellKey = '0,0,0';
  const cell = model100.cells[cellKey];
  if (!cell || !cell.labels) return null;
  
  const bgColorLabel = cell.labels.bg_color;
  return bgColorLabel ? bgColorLabel.v : null;
}

async function waitForColorChange(initialColor, timeoutMs) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const res = await httpGet(`${UI_SERVER_URL}/snapshot`);
    if (res.status !== 200) {
      console.log('[E2E] Snapshot request failed:', res.status);
      await sleep(500);
      continue;
    }
    
    const currentColor = getModel100BgColor(res.body.snapshot);
    if (currentColor && currentColor !== initialColor) {
      return { success: true, color: currentColor, elapsed: Date.now() - startTime };
    }
    
    await sleep(500);
  }
  
  return { success: false, elapsed: Date.now() - startTime };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Model 100 E2E Test - 双总线往返测试');
  console.log('='.repeat(60));
  console.log(`UI Server: ${UI_SERVER_URL}`);
  console.log(`Timeout: ${TIMEOUT_MS}ms`);
  console.log('');
  
  // Step 1: 获取初始状态
  console.log('[Step 1] 获取初始 snapshot...');
  let res;
  try {
    res = await httpGet(`${UI_SERVER_URL}/snapshot`);
  } catch (e) {
    console.error('[FAIL] 无法连接到 UI Server:', e.message);
    console.log('请确保 UI Server 正在运行: node packages/ui-model-demo-server/server.mjs');
    process.exit(1);
  }
  
  if (res.status !== 200) {
    console.error('[FAIL] Snapshot 请求失败:', res.status);
    process.exit(1);
  }
  
  const initialColor = getModel100BgColor(res.body.snapshot);
  console.log(`[Step 1] 初始 bg_color: ${initialColor || '(null - Model 100 may not be loaded)'}`);
  
  if (!initialColor) {
    console.log('[WARN] Model 100 不存在或没有 bg_color，可能需要先加载 model');
  }
  
  // Step 2: 发送 Submit 事件到 Model 100
  console.log('');
  console.log('[Step 2] 发送 Submit 事件到 Model 100...');
  
  const submitEvent = {
    type: 'ui_event',
    payload: {
      action: 'model100_submit',
      meta: {
        op_id: `e2e_test_${Date.now()}`,
      },
      target: {
        model_id: 100,
        p: 0, r: 0, c: 2,
        k: 'ui_event',
      },
      value: {
        t: 'event',
        v: {
          action: 'submit',
          input_value: 'test_input',
          timestamp: Date.now(),
        },
      },
    },
  };
  
  // 直接写入 Model 100 的 ui_event 来触发 forward_model100_events
  // 这需要通过 label_add action，需要 source: 'ui_renderer' 和 type: 'label_add'
  const opId = `e2e_submit_${Date.now()}`;
  const labelAddEvent = {
    source: 'ui_renderer',
    type: 'label_add',
    payload: {
      action: 'label_add',
      meta: {
        op_id: opId,
      },
      target: {
        model_id: 100,
        p: 0, r: 0, c: 2,
        k: 'ui_event',
      },
      value: {
        t: 'json',
        v: {
          action: 'submit',
          input_value: 'test_e2e',
          meta: { op_id: opId },
        },
      },
    },
  };
  
  try {
    res = await httpPost(`${UI_SERVER_URL}/ui_event`, labelAddEvent);
  } catch (e) {
    console.error('[FAIL] 发送事件失败:', e.message);
    process.exit(1);
  }
  
  if (res.status !== 200) {
    console.error('[FAIL] UI Event 请求失败:', res.status, res.body);
    process.exit(1);
  }
  
  console.log(`[Step 2] 事件已发送，response ok=${res.body.ok}`);
  
  // Step 3: 等待颜色变化
  console.log('');
  console.log(`[Step 3] 等待 bg_color 变化 (timeout: ${TIMEOUT_MS}ms)...`);
  console.log('         (需要 Matrix + MBR + K8s Worker 正常运行)');
  
  const result = await waitForColorChange(initialColor, TIMEOUT_MS);
  
  console.log('');
  console.log('='.repeat(60));
  if (result.success) {
    console.log('[PASS] E2E 测试成功!');
    console.log(`       初始颜色: ${initialColor}`);
    console.log(`       新颜色:   ${result.color}`);
    console.log(`       耗时:     ${result.elapsed}ms`);
  } else {
    console.log('[FAIL] E2E 测试失败 - 颜色未在超时时间内变化');
    console.log('');
    console.log('可能的原因:');
    console.log('  1. Matrix 未连接或配置错误');
    console.log('  2. MBR Worker 未运行');
    console.log('  3. K8s Worker (或本地模拟) 未运行');
    console.log('  4. MQTT Broker 未运行');
    console.log('  5. forward_model100_events 函数未正确触发');
    console.log('');
    console.log('调试步骤:');
    console.log('  - 检查 UI Server 日志中的 [forward_model100_events] 输出');
    console.log('  - 检查 MBR Worker 日志中的 [mbr-worker] 输出');
    console.log('  - 检查 K8s Worker 日志中的 [k8s-worker-v2] 输出');
  }
  console.log('='.repeat(60));
  
  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error('[ERROR] Unexpected error:', err);
  process.exit(1);
});
