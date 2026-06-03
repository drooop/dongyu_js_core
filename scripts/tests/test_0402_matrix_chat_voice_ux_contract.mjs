#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { loadSystemPatch } from '../worker_engine_v0.mjs';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const CHAT_APP_MODEL_ID = 1083;
const CHAT_BUS_KEY = 'matrix_chat_1083_bus_event';
const workspacePath = 'packages/worker-base/system-models/workspace_positive_models.json';
const hierarchyPath = 'packages/worker-base/system-models/runtime_hierarchy_mounts.json';

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function loadRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  for (const pathname of [workspacePath, hierarchyPath]) {
    const result = rt.applyPatch(readJson(pathname), { allowCreateModel: true, trustedBootstrap: true });
    assert.equal(result.rejected, 0, `${pathname} must load without rejected records`);
  }
  return rt;
}

function findNode(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function fakeVue() {
  return {
    h(type, props, children) {
      return {
        type,
        props: props || {},
        children: Array.isArray(children) ? children : (children == null ? [] : [children]),
      };
    },
    resolveComponent: (name) => name,
  };
}

function flattenVNode(node, out = []) {
  if (node == null) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push({ text: String(node) });
    return out;
  }
  out.push(node);
  const children = typeof node.children === 'function' ? node.children() : node.children;
  if (Array.isArray(children)) {
    for (const child of children) flattenVNode(child, out);
  } else if (children != null) {
    flattenVNode(children, out);
  }
  return out;
}

function textOf(node) {
  return flattenVNode(node)
    .filter((item) => Object.prototype.hasOwnProperty.call(item, 'text'))
    .map((item) => item.text)
    .join('');
}

function findButton(node, pattern) {
  return flattenVNode(node).find((item) => item && item.type === 'button' && pattern.test(textOf(item))) || null;
}

function eventValueRecords(label) {
  return label?.v?.value || label?.value || [];
}

function startVoiceLabels(labels) {
  return labels.filter((label) => eventValueRecords(label).some((record) => record && record.k === 'action' && record.v === 'start_voice'));
}

function installFakeAudioRecorder() {
  const priorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const priorMediaRecorder = globalThis.MediaRecorder;
  const stoppedTracks = [];
  class FakeMediaRecorder {
    constructor(_stream, options = {}) {
      this.mimeType = options.mimeType || 'audio/webm';
      this.state = 'inactive';
      this.ondataavailable = null;
      this.onstop = null;
    }

    static isTypeSupported(type) {
      return String(type || '').startsWith('audio/');
    }

    start() {
      this.state = 'recording';
    }

    stop() {
      this.state = 'inactive';
      if (typeof this.ondataavailable === 'function') {
        this.ondataavailable({ data: new Blob(['voice-bytes'], { type: this.mimeType }) });
      }
      if (typeof this.onstop === 'function') this.onstop();
    }
  }
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop() { stoppedTracks.push('stop'); } }],
        }),
      },
    },
  });
  globalThis.MediaRecorder = FakeMediaRecorder;
  return {
    stoppedTracks,
    cleanup() {
      if (priorNavigator) Object.defineProperty(globalThis, 'navigator', priorNavigator);
      else delete globalThis.navigator;
      globalThis.MediaRecorder = priorMediaRecorder;
    },
  };
}

function installDelayedAudioRecorder() {
  const priorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const priorMediaRecorder = globalThis.MediaRecorder;
  const stoppedTracks = [];
  const resolvers = [];
  let requestCount = 0;
  class FakeMediaRecorder {
    constructor(_stream, options = {}) {
      this.mimeType = options.mimeType || 'audio/webm';
      this.state = 'inactive';
      this.ondataavailable = null;
      this.onstop = null;
    }

    static isTypeSupported(type) {
      return String(type || '').startsWith('audio/');
    }

    start() {
      this.state = 'recording';
    }

    stop() {
      this.state = 'inactive';
      if (typeof this.ondataavailable === 'function') {
        this.ondataavailable({ data: new Blob(['voice-bytes'], { type: this.mimeType }) });
      }
      if (typeof this.onstop === 'function') this.onstop();
    }
  }
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async () => {
          requestCount += 1;
          await new Promise((resolve) => resolvers.push(resolve));
          return {
            getTracks: () => [{ stop() { stoppedTracks.push('stop'); } }],
          };
        },
      },
    },
  });
  globalThis.MediaRecorder = FakeMediaRecorder;
  return {
    stoppedTracks,
    resolveAll() {
      while (resolvers.length > 0) resolvers.shift()();
    },
    get requestCount() {
      return requestCount;
    },
    cleanup() {
      if (priorNavigator) Object.defineProperty(globalThis, 'navigator', priorNavigator);
      else delete globalThis.navigator;
      globalThis.MediaRecorder = priorMediaRecorder;
    },
  };
}

function makeHost() {
  const labels = [];
  const uploaded = [];
  return {
    labels,
    uploaded,
    getSnapshot: () => ({ models: {} }),
    uploadMedia: async (input) => {
      uploaded.push(input);
      return { uri: 'mxc://synapse.dongyudigital.com/voice0402', name: input.filename };
    },
    dispatchAddLabel: (label) => labels.push(label),
    dispatchRmLabel: () => {},
  };
}

function audioRecorderNode(extraProps = {}) {
  return {
    type: 'AudioRecorder',
    id: 'voice_contract_manual_recorder',
    props: {
      startLabel: 'Voice',
      finishLabel: 'Finish',
      cancelLabel: 'Cancel',
      recordingTitle: 'Recording voice message',
      audioFilenamePrefix: 'voice-contract',
      maxRecordMs: 60000,
      finishOnEnter: true,
      ...extraProps,
    },
    bind: {
      write: {
        bus_event_v2: true,
        bus_in_key: CHAT_BUS_KEY,
        value_ref: [
          mt('__mt_payload_kind', 'str', 'ui_event.v1'),
          mt('action', 'str', 'start_voice'),
          mt('media_uri', 'str', { $ref: 'payload.media_uri' }),
          mt('file_name', 'str', { $ref: 'payload.file_name' }),
          mt('mime_type', 'str', { $ref: 'payload.mime_type' }),
          mt('media_error', 'str', { $ref: 'payload.media_error' }),
        ],
        value_t: 'modeltable',
        commit_policy: 'immediate',
      },
    },
  };
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function test_matrix_chat_voice_uses_manual_recorder_component() {
  const rt = loadRuntime();
  const ast = buildAstFromCellwiseModel(rt.snapshot(), CHAT_APP_MODEL_ID);
  const voice = findNode(ast, 'matrix_chat_voice_button');
  assert.equal(voice?.type, 'AudioRecorder', 'Voice must use a manual AudioRecorder UI component');
  assert.equal(voice?.props?.maxRecordMs, 60000, 'Voice recording must have a 60 second hard maximum');
  assert.equal(voice?.props?.finishOnEnter, true, 'Voice recording must support Enter-to-finish');
  assert.equal(voice?.props?.startLabel, 'Voice');
  assert.equal(voice?.props?.finishLabel, 'Finish');
  assert.equal(voice?.props?.cancelLabel, 'Cancel');
  const valueRefText = JSON.stringify(voice?.bind?.write?.value_ref || []);
  assert.equal(voice?.bind?.write?.bus_event_v2, true, 'Voice finish must dispatch bus_event_v2');
  assert.equal(voice?.bind?.write?.bus_in_key, CHAT_BUS_KEY, 'Voice finish must enter through Matrix Chat Model 0 route key');
  assert.match(valueRefText, /"start_voice"/u, 'Voice finish must emit start_voice');
  assert.match(valueRefText, /"media_uri"/u, 'Voice event must carry uploaded media_uri');
  assert.match(valueRefText, /"file_name"/u, 'Voice event must carry generated file_name');
  assert.match(valueRefText, /"mime_type"/u, 'Voice event must carry audio mime_type');
  return { key: 'matrix_chat_voice_uses_manual_recorder_component', status: 'PASS' };
}

async function assertManualRecorderStartFinish(createRenderer, label) {
  const audioEnv = installFakeAudioRecorder();
  const host = makeHost();
  try {
    const renderer = createRenderer({ host, vue: fakeVue() });
    const node = audioRecorderNode();
    const initial = renderer.renderVNode(node);
    const start = findButton(initial, /Voice/u);
    assert.ok(start, `${label} must render a start voice button`);
    await start.props.onClick();
    assert.equal(host.uploaded.length, 0, `${label} must not upload immediately after start`);
    assert.equal(startVoiceLabels(host.labels).length, 0, `${label} must not dispatch start_voice immediately after start`);
    const recording = renderer.renderVNode(node);
    assert.match(textOf(recording), /Recording voice message/u, `${label} must show a recording panel after start`);
    const finish = findButton(recording, /Finish/u);
    assert.ok(finish, `${label} must render a Finish control`);
    await finish.props.onClick();
    assert.equal(host.uploaded.length, 1, `${label} must upload after Finish`);
    const voiceLabels = startVoiceLabels(host.labels);
    assert.equal(voiceLabels.length, 1, `${label} must dispatch one start_voice event after Finish`);
    const records = eventValueRecords(voiceLabels[0]);
    assert.ok(records.every((record) => Object.prototype.hasOwnProperty.call(record, 'v')), `${label} must dispatch complete PRCKTV records`);
    assert.ok(records.some((record) => record.k === 'media_uri' && record.v === 'mxc://synapse.dongyudigital.com/voice0402'), `${label} must carry uploaded media_uri`);
    assert.ok(records.some((record) => record.k === 'file_name' && /\.webm$/u.test(String(record.v))), `${label} must carry generated filename`);
    assert.ok(records.some((record) => record.k === 'media_error' && record.v === ''), `${label} must keep media_error empty on success`);
    assert.ok(audioEnv.stoppedTracks.length > 0, `${label} must close microphone tracks after Finish`);
  } finally {
    audioEnv.cleanup();
  }
}

async function assertManualRecorderCancel(createRenderer, label) {
  const audioEnv = installFakeAudioRecorder();
  const host = makeHost();
  try {
    const renderer = createRenderer({ host, vue: fakeVue() });
    const node = audioRecorderNode();
    await findButton(renderer.renderVNode(node), /Voice/u).props.onClick();
    const cancel = findButton(renderer.renderVNode(node), /Cancel/u);
    assert.ok(cancel, `${label} must render Cancel while recording`);
    await cancel.props.onClick();
    assert.equal(host.uploaded.length, 0, `${label} must not upload on cancel`);
    assert.equal(startVoiceLabels(host.labels).length, 0, `${label} must not dispatch start_voice on cancel`);
    assert.ok(audioEnv.stoppedTracks.length > 0, `${label} must close microphone tracks on cancel`);
  } finally {
    audioEnv.cleanup();
  }
}

async function assertManualRecorderEnterAndAutoFinish(createRenderer, label) {
  const audioEnv = installFakeAudioRecorder();
  try {
    const enterHost = makeHost();
    const renderer = createRenderer({ host: enterHost, vue: fakeVue() });
    const node = audioRecorderNode();
    await findButton(renderer.renderVNode(node), /Voice/u).props.onClick();
    const recording = renderer.renderVNode(node);
    assert.equal(typeof recording.props.onKeydown, 'function', `${label} must expose Enter-to-finish on the recording panel`);
    await recording.props.onKeydown({ key: 'Enter', target: { tagName: 'DIV' }, preventDefault() {} });
    assert.equal(startVoiceLabels(enterHost.labels).length, 1, `${label} must dispatch start_voice after Enter`);

    const autoHost = makeHost();
    const autoRenderer = createRenderer({ host: autoHost, vue: fakeVue() });
    const autoNode = audioRecorderNode({ maxRecordMs: 5 });
    await findButton(autoRenderer.renderVNode(autoNode), /Voice/u).props.onClick();
    await wait(40);
    assert.equal(startVoiceLabels(autoHost.labels).length, 1, `${label} must auto-finish at maxRecordMs`);
  } finally {
    audioEnv.cleanup();
  }
}

async function assertManualRecorderPreventsStartupReentry(createRenderer, label) {
  const audioEnv = installDelayedAudioRecorder();
  const host = makeHost();
  try {
    const renderer = createRenderer({ host, vue: fakeVue() });
    const node = audioRecorderNode();
    const start = findButton(renderer.renderVNode(node), /Voice/u);
    const first = start.props.onClick();
    const second = start.props.onClick();
    await wait(10);
    assert.equal(audioEnv.requestCount, 1, `${label} must issue only one getUserMedia request while startup is pending`);
    audioEnv.resolveAll();
    await Promise.all([first, second]);
    const cancel = findButton(renderer.renderVNode(node), /Cancel/u);
    assert.ok(cancel, `${label} must render Cancel after the single startup completes`);
    await cancel.props.onClick();
    assert.equal(audioEnv.stoppedTracks.length, 1, `${label} must have exactly one managed stream to clean up`);
    assert.equal(host.uploaded.length, 0, `${label} must not upload during repeated startup clicks`);
    assert.equal(startVoiceLabels(host.labels).length, 0, `${label} must not dispatch during repeated startup clicks`);
  } finally {
    audioEnv.cleanup();
  }
}

async function assertManualRecorderCancelDuringStartup(createRenderer, label) {
  const audioEnv = installDelayedAudioRecorder();
  const host = makeHost();
  try {
    const renderer = createRenderer({ host, vue: fakeVue() });
    const node = audioRecorderNode();
    const start = findButton(renderer.renderVNode(node), /Voice/u);
    const started = start.props.onClick();
    await wait(10);
    const startingPanel = renderer.renderVNode(node);
    assert.match(textOf(startingPanel), /Starting voice recording/u, `${label} must show startup state while microphone permission is pending`);
    const cancel = findButton(startingPanel, /Cancel/u);
    assert.ok(cancel, `${label} must allow cancel while startup is pending`);
    await cancel.props.onClick();
    audioEnv.resolveAll();
    await started;
    const after = renderer.renderVNode(node);
    assert.ok(findButton(after, /Voice/u), `${label} must return to idle after startup cancel`);
    assert.equal(host.uploaded.length, 0, `${label} must not upload after startup cancel`);
    assert.equal(startVoiceLabels(host.labels).length, 0, `${label} must not dispatch start_voice after startup cancel`);
    assert.equal(audioEnv.stoppedTracks.length, 1, `${label} must close the stream that resolves after startup cancel`);
  } finally {
    audioEnv.cleanup();
  }
}

async function test_renderer_manual_recorder_contract() {
  const esm = await import(new URL('../../packages/ui-renderer/src/renderer.mjs', import.meta.url));
  const cjs = require('../../packages/ui-renderer/src/renderer.js');
  await assertManualRecorderStartFinish(esm.createRenderer, 'ESM');
  await assertManualRecorderStartFinish(cjs.createRenderer, 'CJS');
  await assertManualRecorderCancel(esm.createRenderer, 'ESM');
  await assertManualRecorderCancel(cjs.createRenderer, 'CJS');
  await assertManualRecorderEnterAndAutoFinish(esm.createRenderer, 'ESM');
  await assertManualRecorderEnterAndAutoFinish(cjs.createRenderer, 'CJS');
  await assertManualRecorderPreventsStartupReentry(esm.createRenderer, 'ESM');
  await assertManualRecorderPreventsStartupReentry(cjs.createRenderer, 'CJS');
  await assertManualRecorderCancelDuringStartup(esm.createRenderer, 'ESM');
  await assertManualRecorderCancelDuringStartup(cjs.createRenderer, 'CJS');
  return { key: 'renderer_manual_recorder_contract', status: 'PASS' };
}

const tests = [
  test_matrix_chat_voice_uses_manual_recorder_component,
  test_renderer_manual_recorder_contract,
];

for (const test of tests) {
  const result = await test();
  console.log(`${result.key}: ${result.status}`);
}
