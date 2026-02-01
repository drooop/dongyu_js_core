const sdk = require('matrix-js-sdk');

let envLoaded = false;

function loadEnv() {
  if (envLoaded) return;
  try {
    const dotenv = require('dotenv');
    dotenv.config();
  } catch (_) {
    // dotenv is optional if env is provided externally
  }
  envLoaded = true;
}

function requireEnv(keys) {
  const missing = [];
  const out = {};
  for (const key of keys) {
    const value = process.env[key];
    if (!value) missing.push(key);
    out[key] = value || null;
  }
  if (missing.length > 0) {
    throw new Error(`missing_env:${missing.join(',')}`);
  }
  return out;
}

async function loginWithPassword(homeserverUrl, user, password) {
  const client = sdk.createClient({ baseUrl: homeserverUrl });
  const res = await client.login('m.login.password', {
    identifier: { type: 'm.id.user', user },
    password,
  });
  return sdk.createClient({ baseUrl: homeserverUrl, accessToken: res.access_token, userId: res.user_id });
}

async function waitForSync(client, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('sync_timeout'));
    }, timeoutMs);
    client.once('sync', (state) => {
      if (state === 'PREPARED') {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

async function createMatrixLiveAdapter(options = {}) {
  loadEnv();
  const { roomId, roomAlias, syncTimeoutMs = 20000 } = options;
  if (!roomId && !roomAlias) {
    throw new Error('missing_room_identifier');
  }

  const homeserverUrl = requireEnv(['MATRIX_HOMESERVER_URL']).MATRIX_HOMESERVER_URL;
  const hasToken = Boolean(process.env.MATRIX_MBR_ACCESS_TOKEN);

  let client = null;
  let userId = null;
  if (hasToken) {
    userId = process.env.MATRIX_MBR_USER || null;
    client = sdk.createClient({ baseUrl: homeserverUrl, accessToken: process.env.MATRIX_MBR_ACCESS_TOKEN, userId });
  } else {
    const env = requireEnv(['MATRIX_MBR_USER', 'MATRIX_MBR_PASSWORD']);
    client = await loginWithPassword(homeserverUrl, env.MATRIX_MBR_USER, env.MATRIX_MBR_PASSWORD);
    userId = client.getUserId ? client.getUserId() : null;
  }

  async function joinRoomSafe(target) {
    try {
      return await client.joinRoom(target);
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (target && target.startsWith('!') && msg.includes('no servers')) {
        const domain = target.split(':')[1] || null;
        if (domain) {
          return await client.joinRoom(target, { viaServers: [domain] });
        }
      }
      throw err;
    }
  }

  const activeRoom = await joinRoomSafe(roomId || roomAlias);
  const activeRoomId = typeof activeRoom === 'string' ? activeRoom : activeRoom.roomId;

  const trace = [];
  const listeners = new Set();

  client.on('Room.timeline', (event, room, toStartOfTimeline) => {
    if (toStartOfTimeline) return;
    if (room && room.roomId !== activeRoomId) return;
    if (event.getType && event.getType() !== 'dy.bus.v0') return;
    const content = event.getContent ? event.getContent() : null;
    if (!content || typeof content !== 'object') return;
    trace.push({ type: 'recv', room_id: activeRoomId, event_id: event.getId?.(), content });
    for (const fn of listeners) fn(content);
  });

  client.startClient({ initialSyncLimit: 1 });
  await waitForSync(client, syncTimeoutMs);

  async function publish(event) {
    const res = await client.sendEvent(activeRoomId, 'dy.bus.v0', event);
    const eventId = res?.event_id || null;
    trace.push({ type: 'send', room_id: activeRoomId, event_id: eventId, content: event });
    return { ok: true, room_id: activeRoomId, event_id: eventId, user_id: userId };
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') {
      throw new Error('invalid_subscriber');
    }
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function list() {
    return trace.slice();
  }

  function close() {
    if (client && client.stopClient) {
      client.stopClient();
    }
  }

  return {
    kind: 'matrix-live',
    room_id: activeRoomId,
    user_id: userId,
    publish,
    subscribe,
    close,
    trace: { list },
  };
}

module.exports = {
  createMatrixLiveAdapter,
};
