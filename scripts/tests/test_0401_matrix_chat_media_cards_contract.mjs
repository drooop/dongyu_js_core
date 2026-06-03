#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

process.env.DY_AUTH = '0';

const CHAT_APP_MODEL_ID = 1083;
const HOMESERVER = 'https://matrix.dongyudigital.com';
const DROP = '@drop:synapse.dongyudigital.com';
const MBR = '@mbr:synapse.dongyudigital.com';
const ROOM = '!media0401:synapse.dongyudigital.com';

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function mockMatrixFetch(url) {
  const parsed = new URL(url);
  const decodedPath = decodeURIComponent(parsed.pathname);
  if (decodedPath.endsWith('/joined_rooms')) {
    return Promise.resolve(response(200, { joined_rooms: [ROOM] }));
  }
  if (decodedPath.endsWith(`/user/${DROP}/account_data/m.direct`)) {
    return Promise.resolve(response(200, {}));
  }
  if (decodedPath.includes(`/rooms/${ROOM}/state/m.room.name`)) {
    return Promise.resolve(response(200, { name: '0401 Media Room' }));
  }
  if (decodedPath.includes(`/rooms/${ROOM}/state/m.room.canonical_alias`)) {
    return Promise.resolve(response(404, { errcode: 'M_NOT_FOUND', error: 'No alias' }));
  }
  if (decodedPath.includes(`/rooms/${ROOM}/state/m.room.topic`)) {
    return Promise.resolve(response(200, { topic: 'media card contract' }));
  }
  if (decodedPath.includes(`/rooms/${ROOM}/state/m.room.power_levels`)) {
    return Promise.resolve(response(200, { users: { [DROP]: 100 }, users_default: 0, invite: 0, kick: 50 }));
  }
  if (decodedPath.includes(`/rooms/${ROOM}/joined_members`)) {
    return Promise.resolve(response(200, {
      joined: {
        [DROP]: { display_name: 'drop' },
        [MBR]: { display_name: 'mbr' },
      },
    }));
  }
  if (decodedPath.includes(`/rooms/${ROOM}/messages`)) {
    return Promise.resolve(response(200, {
      chunk: [
        {
          event_id: '$audio',
          room_id: ROOM,
          sender: DROP,
          type: 'm.room.message',
          origin_server_ts: 1760000004000,
          content: {
            msgtype: 'm.audio',
            body: 'voice-note.ogg',
            url: 'mxc://synapse.dongyudigital.com/audio0401',
            info: { mimetype: 'audio/ogg', size: 4096, duration: 1200 },
          },
        },
        {
          event_id: '$image',
          room_id: ROOM,
          sender: MBR,
          type: 'm.room.message',
          origin_server_ts: 1760000003000,
          content: {
            msgtype: 'm.image',
            body: 'preview.png',
            url: 'mxc://synapse.dongyudigital.com/image0401',
            info: {
              mimetype: 'image/png',
              size: 8192,
              thumbnail_url: 'mxc://synapse.dongyudigital.com/thumb0401',
              w: 640,
              h: 360,
            },
          },
        },
        {
          event_id: '$file',
          room_id: ROOM,
          sender: DROP,
          type: 'm.room.message',
          origin_server_ts: 1760000002000,
          content: {
            msgtype: 'm.file',
            body: 'contract.pdf',
            filename: 'contract.pdf',
            url: 'mxc://synapse.dongyudigital.com/file0401',
            info: { mimetype: 'application/pdf', size: 16384 },
          },
        },
        {
          event_id: '$text',
          room_id: ROOM,
          sender: MBR,
          type: 'm.room.message',
          origin_server_ts: 1760000001000,
          content: { msgtype: 'm.text', body: 'plain text' },
        },
      ],
    }));
  }
  return Promise.resolve(response(404, { errcode: 'M_NOT_FOUND', error: `Unhandled ${decodedPath}` }));
}

function makeSnapshot(events) {
  return {
    models: {
      [String(CHAT_APP_MODEL_ID)]: {
        id: CHAT_APP_MODEL_ID,
        cells: {
          '0,0,0': {
            labels: {
              timeline_json: { k: 'timeline_json', t: 'json', v: events },
              active_room_id: { k: 'active_room_id', t: 'str', v: ROOM },
            },
          },
        },
      },
    },
  };
}

function makeHost(events) {
  return {
    getSnapshot: () => makeSnapshot(events),
    dispatchAddLabel: () => {},
    dispatchRmLabel: () => {},
  };
}

function timelineAst() {
  return {
    type: 'MessageTimeline',
    id: 'matrix_chat_timeline',
    props: {
      eventsRef: { model_id: CHAT_APP_MODEL_ID, p: 0, r: 0, c: 0, k: 'timeline_json' },
      activeRoomIdRef: { model_id: CHAT_APP_MODEL_ID, p: 0, r: 0, c: 0, k: 'active_room_id' },
      currentUser: DROP,
    },
    children: [],
  };
}

function collect(node, predicate, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (predicate(node)) out.push(node);
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) collect(child, predicate, out);
  return out;
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

function assertRendererCards(createRenderer, label, events) {
  const renderer = createRenderer({ host: makeHost(events), vue: fakeVue() });
  const tree = renderer.renderTree(timelineAst());
  assert.equal(tree.activeRoomId, ROOM, `${label} renderTree must keep active room id`);
  assert.equal(tree.events.length, 4, `${label} renderTree must expose four timeline events`);
  const byId = new Map(tree.events.map((event) => [event.event_id, event]));
  assert.equal(byId.get('$text').card_kind, 'text', `${label} text event must be a text card`);
  assert.equal(byId.get('$file').card_kind, 'file', `${label} file event must be a file card`);
  assert.equal(byId.get('$image').card_kind, 'image', `${label} image event must be an image card`);
  assert.equal(byId.get('$audio').card_kind, 'audio', `${label} audio event must be an audio card`);
  assert.match(byId.get('$file').download_url, /^\/api\/media\/download\?/u, `${label} file card needs a safe download URL`);
  assert.match(byId.get('$image').thumbnail_url, /^\/api\/media\/thumbnail\?/u, `${label} image card needs a thumbnail URL`);
  assert.match(byId.get('$audio').download_url, /^\/api\/media\/download\?/u, `${label} audio card needs a playback/download URL`);

  const vnode = renderer.renderVNode(timelineAst());
  const links = collect(vnode, (node) => node.type === 'a');
  const imgs = collect(vnode, (node) => node.type === 'img');
  const audio = collect(vnode, (node) => node.type === 'audio');
  assert.ok(links.some((node) => String(node.props.href || '').includes('/api/media/download?')), `${label} vnode must render a download/open link`);
  assert.ok(imgs.some((node) => String(node.props.src || '').includes('/api/media/thumbnail?')), `${label} vnode must render an image preview`);
  assert.ok(audio.some((node) => String(node.props.src || '').includes('/api/media/download?')), `${label} vnode must render audio playback`);
}

async function test_server_projects_matrix_media_to_safe_card_urls() {
  const { fetchMgmtBusConsoleJoinedRooms } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const result = await fetchMgmtBusConsoleJoinedRooms({
    homeserverUrl: HOMESERVER,
    accessToken: 'token',
    userId: DROP,
  }, { fetchImpl: mockMatrixFetch, timeoutMs: 1000, messageLimit: 5 });
  assert.equal(result.ok, true, 'Matrix room fetch must succeed');
  const byId = new Map(result.events.map((event) => [event.event_id, event]));
  assert.equal(byId.get('$file').card_kind, 'file');
  assert.match(byId.get('$file').download_url, /^\/api\/media\/download\?uri=mxc%3A%2F%2Fsynapse\.dongyudigital\.com%2Ffile0401/u);
  assert.equal(byId.get('$file').mime_type, 'application/pdf');
  assert.equal(byId.get('$file').size, 16384);
  assert.equal(byId.get('$image').card_kind, 'image');
  assert.match(byId.get('$image').thumbnail_url, /^\/api\/media\/thumbnail\?uri=mxc%3A%2F%2Fsynapse\.dongyudigital\.com%2Fthumb0401/u);
  assert.equal(byId.get('$image').width, 640);
  assert.equal(byId.get('$image').height, 360);
  assert.equal(byId.get('$audio').card_kind, 'audio');
  assert.match(byId.get('$audio').download_url, /^\/api\/media\/download\?uri=mxc%3A%2F%2Fsynapse\.dongyudigital\.com%2Faudio0401/u);
  assert.equal(byId.get('$audio').duration_ms, 1200);
  assert.equal(byId.get('$text').card_kind, 'text');
  return { key: 'server_projects_matrix_media_to_safe_card_urls', status: 'PASS' };
}

async function test_renderer_cards_are_aligned_between_esm_and_cjs() {
  const events = [
    { event_id: '$text', room_id: ROOM, sender: MBR, msgtype: 'm.text', body: 'plain text' },
    { event_id: '$file', room_id: ROOM, sender: DROP, msgtype: 'm.file', body: 'contract.pdf', file_name: 'contract.pdf', download_url: '/api/media/download?uri=mxc%3A%2F%2Fserver%2Ffile' },
    { event_id: '$image', room_id: ROOM, sender: MBR, msgtype: 'm.image', body: 'preview.png', file_name: 'preview.png', download_url: '/api/media/download?uri=mxc%3A%2F%2Fserver%2Fimage', thumbnail_url: '/api/media/thumbnail?uri=mxc%3A%2F%2Fserver%2Fthumb' },
    { event_id: '$audio', room_id: ROOM, sender: DROP, msgtype: 'm.audio', body: 'voice-note.ogg', file_name: 'voice-note.ogg', download_url: '/api/media/download?uri=mxc%3A%2F%2Fserver%2Faudio' },
  ];
  const esm = await import(new URL('../../packages/ui-renderer/src/renderer.mjs', import.meta.url));
  const cjs = require('../../packages/ui-renderer/src/renderer.js');
  assertRendererCards(esm.createRenderer, 'ESM', events);
  assertRendererCards(cjs.createRenderer, 'CJS', events);
  return { key: 'renderer_cards_are_aligned_between_esm_and_cjs', status: 'PASS' };
}

async function test_matrix_chat_share_file_sends_matrix_image_metadata() {
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  state.cacheUploadedMediaForTest('mxc://synapse.dongyudigital.com/share-image0401', {
    buffer: Buffer.from('fake-image-bytes'),
    contentType: 'image/png',
    filename: 'share-image.png',
    userId: DROP,
  });
  state.programEngine.matrixSuiteSession = {
    homeserverUrl: HOMESERVER,
    accessToken: 'token',
    userId: DROP,
  };
  const priorFetch = globalThis.fetch;
  let capturedContent = null;
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === 'PUT') {
      capturedContent = JSON.parse(String(options.body || '{}'));
    }
    return response(200, { event_id: '$sent-image' });
  };
  try {
    const result = await state.programEngine.matrixSuiteDefaultCall('shareFile', {
      roomId: ROOM,
      mediaUri: 'mxc://synapse.dongyudigital.com/share-image0401',
      fileName: 'share-image.png',
    });
    assert.equal(result.ok, true, 'shareFile must send through Matrix');
    assert.equal(capturedContent.msgtype, 'm.image', 'image upload must be sent as Matrix image message');
    assert.equal(capturedContent.body, 'share-image.png');
    assert.equal(capturedContent.url, 'mxc://synapse.dongyudigital.com/share-image0401');
    assert.equal(capturedContent.info.mimetype, 'image/png');
    assert.equal(capturedContent.info.size, Buffer.from('fake-image-bytes').length);
  } finally {
    globalThis.fetch = priorFetch;
  }
  return { key: 'matrix_chat_share_file_sends_matrix_image_metadata', status: 'PASS' };
}

async function test_media_proxy_serves_cached_download_and_thumbnail_bytes() {
  const { createServerState, handleMatrixMediaProxyRequest } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  const uri = 'mxc://synapse.dongyudigital.com/proxy0401';
  const bytes = Buffer.from('proxy-media-bytes');
  state.cacheUploadedMediaForTest(uri, {
    buffer: bytes,
    contentType: 'image/png',
    filename: 'proxy.png',
    userId: DROP,
  });
  const makeReq = (pathname) => ({
    method: 'GET',
    url: pathname,
    headers: { host: '127.0.0.1:9000' },
    socket: { remoteAddress: '127.0.0.1' },
  });
  const makeRes = () => {
    const chunks = [];
    return {
      statusCode: null,
      headers: null,
      body: null,
      writeHead(status, headers) {
        this.statusCode = status;
        this.headers = headers;
      },
      write(chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      },
      end(chunk) {
        if (chunk) this.write(chunk);
        this.body = Buffer.concat(chunks);
      },
    };
  };
  const downloadRes = makeRes();
  await handleMatrixMediaProxyRequest(makeReq(`/api/media/download?uri=${encodeURIComponent(uri)}&filename=proxy.png`), downloadRes, state, null, 'download');
  assert.equal(downloadRes.statusCode, 200, 'cached download must return success');
  assert.equal(downloadRes.headers['content-type'], 'image/png');
  assert.match(downloadRes.headers['content-disposition'], /^attachment/u);
  assert.deepEqual(downloadRes.body, bytes);

  const thumbnailRes = makeRes();
  await handleMatrixMediaProxyRequest(makeReq(`/api/media/thumbnail?uri=${encodeURIComponent(uri)}&filename=proxy.png`), thumbnailRes, state, null, 'thumbnail');
  assert.equal(thumbnailRes.statusCode, 200, 'cached thumbnail must return success');
  assert.match(thumbnailRes.headers['content-disposition'], /^inline/u);
  assert.deepEqual(thumbnailRes.body, bytes);
  return { key: 'media_proxy_serves_cached_download_and_thumbnail_bytes', status: 'PASS' };
}

const tests = [
  test_server_projects_matrix_media_to_safe_card_urls,
  test_renderer_cards_are_aligned_between_esm_and_cjs,
  test_matrix_chat_share_file_sends_matrix_image_metadata,
  test_media_proxy_serves_cached_download_and_thumbnail_bytes,
];

for (const test of tests) {
  const result = await test();
  console.log(`${result.key}: ${result.status}`);
}
