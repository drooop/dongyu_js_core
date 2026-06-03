#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs, { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSystemPatch } from '../worker_engine_v0.mjs';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

process.env.DY_AUTH = '0';

const CHAT_APP_MODEL_ID = 1083;
const CHAT_BUS_KEY = 'matrix_chat_1083_bus_event';
const ROOM = '!voice0401:synapse.dongyudigital.com';
const workspacePath = 'packages/worker-base/system-models/workspace_positive_models.json';
const hierarchyPath = 'packages/worker-base/system-models/runtime_hierarchy_mounts.json';

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function payload(action, extra = []) {
  return [
    mt('__mt_payload_kind', 'str', 'ui_event.v1'),
    mt('action', 'str', action),
    ...extra,
  ];
}

function wait(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function withServerState(options, fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0401-matrix-chat-voice-'));
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0401_voice_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null, ...options });
  try {
    await state.activateRuntimeMode('running');
    return await fn(state);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.DY_UI_SERVER_WORKER_ID;
  }
}

async function dispatchChat(state, action, extra = []) {
  const result = await state.submitEnvelope({
    type: 'bus_event_v2',
    bus_in_key: CHAT_BUS_KEY,
    value: payload(action, extra),
    meta: { op_id: `it0401_voice_${action}_${Date.now()}` },
  });
  assert.equal(result.result, 'ok', `${action} must route through Model 0`);
  assert.equal(result.routed_by, 'model0_busin', `${action} must use model0 bus ingress`);
  await wait();
}

function chatLabels(state) {
  return state.clientSnap().models[String(CHAT_APP_MODEL_ID)].cells['0,0,0'].labels;
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
      if (typeof this.onstop === 'function') {
        this.onstop();
      }
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
      if (priorNavigator) {
        Object.defineProperty(globalThis, 'navigator', priorNavigator);
      } else {
        delete globalThis.navigator;
      }
      globalThis.MediaRecorder = priorMediaRecorder;
    },
  };
}

function installThrowingAudioRecorder() {
  const priorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const priorMediaRecorder = globalThis.MediaRecorder;
  const stoppedTracks = [];
  class ThrowingMediaRecorder {
    constructor() {
      throw new Error('constructor_failed');
    }

    static isTypeSupported(type) {
      return String(type || '').startsWith('audio/');
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
  globalThis.MediaRecorder = ThrowingMediaRecorder;
  return {
    stoppedTracks,
    cleanup() {
      if (priorNavigator) {
        Object.defineProperty(globalThis, 'navigator', priorNavigator);
      } else {
        delete globalThis.navigator;
      }
      globalThis.MediaRecorder = priorMediaRecorder;
    },
  };
}

function eventValueRecords(label) {
  return label?.v?.value || label?.value || [];
}

async function assertVoiceButtonRecordsAndDispatches(createRenderer, label) {
  const audioEnv = installFakeAudioRecorder();
  const dispatched = [];
  const uploaded = [];
  const host = {
    getSnapshot: () => ({ models: {} }),
    uploadMedia: async (input) => {
      uploaded.push(input);
      return { uri: 'mxc://synapse.dongyudigital.com/voice0401', name: input.filename };
    },
    dispatchAddLabel: (item) => dispatched.push(item),
    dispatchRmLabel: () => {},
  };
  try {
    const node = {
      type: 'Button',
      id: 'voice_contract_button',
      props: { label: 'Voice', mediaAction: 'record_audio', audioRecordMs: 1, audioFilenamePrefix: 'voice-contract' },
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
    const renderer = createRenderer({ host, vue: fakeVue() });
    const vnode = renderer.renderVNode(node);
    await vnode.props.onClick();
    assert.equal(uploaded.length, 1, `${label} must upload one recorded audio blob`);
    assert.match(uploaded[0].filename, /^voice-contract-.*\.webm$/u, `${label} must generate a stable audio filename`);
    assert.equal(uploaded[0].contentType, 'audio/webm;codecs=opus', `${label} must upload with audio content type`);
    assert.equal(dispatched.length, 1, `${label} must dispatch after upload succeeds`);
    const records = eventValueRecords(dispatched[0]);
    assert.ok(records.some((record) => record.k === 'action' && record.v === 'start_voice'), `${label} must keep the model event action`);
    assert.ok(records.some((record) => record.k === 'media_uri' && record.v === 'mxc://synapse.dongyudigital.com/voice0401'), `${label} must pass uploaded media_uri to ModelTable event`);
    assert.ok(records.some((record) => record.k === 'file_name' && /\.webm$/u.test(String(record.v))), `${label} must pass generated audio filename`);
    assert.ok(records.some((record) => record.k === 'mime_type' && record.v === 'audio/webm;codecs=opus'), `${label} must pass audio mime type`);
    assert.ok(records.every((record) => Object.prototype.hasOwnProperty.call(record, 'v')), `${label} must keep every temporary ModelTable record PRCKTV-complete`);
    assert.ok(records.some((record) => record.k === 'media_error' && record.v === ''), `${label} must keep optional media_error explicit and empty on success`);
  } finally {
    assert.ok(audioEnv.stoppedTracks.length > 0, `${label} must close microphone tracks after successful recording`);
    audioEnv.cleanup();
  }
}

async function assertVoiceButtonClosesTracksWhenRecorderConstructionFails(createRenderer, label) {
  const audioEnv = installThrowingAudioRecorder();
  const dispatched = [];
  const host = {
    getSnapshot: () => ({ models: {} }),
    uploadMedia: async () => {
      throw new Error('should_not_upload');
    },
    dispatchAddLabel: (item) => dispatched.push(item),
    dispatchRmLabel: () => {},
  };
  try {
    const node = {
      type: 'Button',
      id: 'voice_contract_button_failure',
      props: { label: 'Voice', mediaAction: 'record_audio', audioRecordMs: 1, audioFilenamePrefix: 'voice-contract' },
      bind: {
        write: {
          bus_event_v2: true,
          bus_in_key: CHAT_BUS_KEY,
          value_ref: [
            mt('__mt_payload_kind', 'str', 'ui_event.v1'),
            mt('action', 'str', 'start_voice'),
            mt('media_error', 'str', { $ref: 'payload.media_error' }),
          ],
          value_t: 'modeltable',
          commit_policy: 'immediate',
        },
      },
    };
    const renderer = createRenderer({ host, vue: fakeVue() });
    const vnode = renderer.renderVNode(node);
    await vnode.props.onClick();
    assert.ok(audioEnv.stoppedTracks.length > 0, `${label} must close microphone tracks when MediaRecorder construction fails`);
    const records = eventValueRecords(dispatched[0]);
    assert.ok(records.some((record) => record.k === 'media_error' && record.v === 'constructor_failed'), `${label} must dispatch explicit media error`);
  } finally {
    audioEnv.cleanup();
  }
}

function test_matrix_chat_voice_button_is_model_driven_recorder() {
  const rt = loadRuntime();
  const ast = buildAstFromCellwiseModel(rt.snapshot(), CHAT_APP_MODEL_ID);
  const voice = findNode(ast, 'matrix_chat_voice_button');
  assert.equal(voice?.type, 'AudioRecorder', 'Voice must remain a model-defined recorder component');
  assert.equal(voice?.props?.maxRecordMs, 60000, 'Voice recorder must define a bounded recording duration');
  assert.equal(voice?.props?.finishOnEnter, true, 'Voice recorder must support Enter-to-finish');
  const valueRefText = JSON.stringify(voice?.bind?.write?.value_ref || []);
  assert.equal(voice?.bind?.write?.bus_event_v2, true, 'Voice recorder must emit through bus_event_v2');
  assert.equal(voice?.bind?.write?.bus_in_key, CHAT_BUS_KEY, 'Voice recorder must target Matrix Chat Model 0 ingress');
  assert.match(valueRefText, /"start_voice"/u, 'Voice button must emit start_voice');
  assert.match(valueRefText, /"media_uri"/u, 'Voice event must carry uploaded media_uri');
  assert.match(valueRefText, /"file_name"/u, 'Voice event must carry generated file_name');
  assert.match(valueRefText, /"mime_type"/u, 'Voice event must carry audio mime_type');
  assert.equal(valueRefText.includes('requires browser media capability wiring'), false, 'Voice model must not keep the fake not-connected path');
  return { key: 'matrix_chat_voice_button_is_model_driven_recorder', status: 'PASS' };
}

async function test_renderer_records_uploads_and_dispatches_voice_event() {
  const esm = await import(new URL('../../packages/ui-renderer/src/renderer.mjs', import.meta.url));
  const cjs = require('../../packages/ui-renderer/src/renderer.js');
  await assertVoiceButtonRecordsAndDispatches(esm.createRenderer, 'ESM');
  await assertVoiceButtonRecordsAndDispatches(cjs.createRenderer, 'CJS');
  return { key: 'renderer_records_uploads_and_dispatches_voice_event', status: 'PASS' };
}

async function test_renderer_closes_microphone_tracks_when_recorder_fails() {
  const esm = await import(new URL('../../packages/ui-renderer/src/renderer.mjs', import.meta.url));
  const cjs = require('../../packages/ui-renderer/src/renderer.js');
  await assertVoiceButtonClosesTracksWhenRecorderConstructionFails(esm.createRenderer, 'ESM');
  await assertVoiceButtonClosesTracksWhenRecorderConstructionFails(cjs.createRenderer, 'CJS');
  return { key: 'renderer_closes_microphone_tracks_when_recorder_fails', status: 'PASS' };
}

async function test_default_share_file_sends_matrix_audio_content() {
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  state.programEngine.matrixSuiteSession = {
    homeserverUrl: 'https://matrix.dongyudigital.com',
    accessToken: 'token',
    userId: '@drop:synapse.dongyudigital.com',
  };
  const priorFetch = globalThis.fetch;
  let capturedContent = null;
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === 'PUT') {
      capturedContent = JSON.parse(String(options.body || '{}'));
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ event_id: '$voice-default' }),
    };
  };
  try {
    const result = await state.programEngine.matrixSuiteDefaultCall('shareFile', {
      roomId: ROOM,
      mediaUri: 'mxc://synapse.dongyudigital.com/defaultVoice0401',
      fileName: 'default-voice.webm',
      mimeType: 'audio/webm;codecs=opus',
    });
    assert.equal(result.ok, true, 'default shareFile must send through Matrix');
    assert.equal(capturedContent.msgtype, 'm.audio', 'audio shareFile must send Matrix m.audio content');
    assert.equal(capturedContent.url, 'mxc://synapse.dongyudigital.com/defaultVoice0401');
    assert.equal(capturedContent.info.mimetype, 'audio/webm;codecs=opus');
  } finally {
    globalThis.fetch = priorFetch;
  }
  return { key: 'default_share_file_sends_matrix_audio_content', status: 'PASS' };
}

async function test_matrix_chat_start_voice_reaches_share_file_host_action() {
  const calls = [];
  return withServerState({
    matrixSuiteMatrixImpl: {
      shareFile: async (input) => {
        calls.push(input);
        return { ok: true, eventId: '$voice0401', ts: '12:01' };
      },
    },
  }, async (state) => {
    const model = state.runtime.getModel(CHAT_APP_MODEL_ID);
    state.runtime.addLabel(model, 0, 0, 0, {
      k: 'rooms_json',
      t: 'json',
      v: [{ id: ROOM, name: 'Voice Room', kind: 'room', conversation_group: 'rooms', members: ['drop'], archived: false }],
    });
    state.runtime.addLabel(model, 0, 0, 0, { k: 'active_room_id', t: 'str', v: ROOM });
    await dispatchChat(state, 'start_voice', [
      mt('media_uri', 'str', 'mxc://synapse.dongyudigital.com/voice0401'),
      mt('file_name', 'str', 'voice0401.webm'),
      mt('mime_type', 'str', 'audio/webm;codecs=opus'),
    ]);
    const root = chatLabels(state);
    assert.equal(calls.length, 1, 'start_voice must request the Matrix shareFile host action');
    assert.equal(calls[0].roomId, ROOM);
    assert.equal(calls[0].mediaUri, 'mxc://synapse.dongyudigital.com/voice0401');
    assert.equal(calls[0].fileName, 'voice0401.webm');
    const event = root.timeline_json.v.find((item) => item.event_id === '$voice0401');
    assert.ok(event, 'successful voice send must append a timeline event');
    assert.equal(event.msgtype, 'm.audio', 'successful voice send must append an audio event');
    assert.equal(event.card_kind, 'audio', 'successful voice send must render as an audio card');
    assert.match(root.status_text.v, /Voice shared via Matrix/u, 'status must report real voice send success');
    assert.equal(root.status_text.v.includes('not sent'), false, 'status must not be the old not-connected placeholder');
    return { key: 'matrix_chat_start_voice_reaches_share_file_host_action', status: 'PASS' };
  });
}

const tests = [
  test_matrix_chat_voice_button_is_model_driven_recorder,
  test_renderer_records_uploads_and_dispatches_voice_event,
  test_renderer_closes_microphone_tracks_when_recorder_fails,
  test_default_share_file_sends_matrix_audio_content,
  test_matrix_chat_start_voice_reaches_share_file_host_action,
];

for (const test of tests) {
  const result = await test();
  console.log(`${result.key}: ${result.status}`);
}
