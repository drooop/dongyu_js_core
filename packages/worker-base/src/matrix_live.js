'use strict';

const sdk = require('matrix-js-sdk');

let envLoaded = false;

function sleepMs(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readIntEnv(name, fallback, minValue = 0) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < minValue) return fallback;
  return parsed;
}

function readAuthString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function isPlaceholderValue(value) {
  const normalized = readAuthString(value).toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith('placeholder')) return true;
  return normalized.includes('placeholder-') || normalized.includes('will-update-after-synapse-setup');
}

function firstValidValue(...values) {
  for (const value of values) {
    const normalized = readAuthString(value);
    if (!normalized) continue;
    if (isPlaceholderValue(normalized)) continue;
    return normalized;
  }
  return '';
}

// Matrix-js-sdk on Node may rely on global TLS settings only for its own fetch.
// Provide a self-signed-safe fetch for https homeserver URLs when needed.
function insecureFetch(url, opts) {
  return fetch(url, { ...opts, tls: { rejectUnauthorized: false } });
}

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

async function loginWithPassword(homeserverUrl, user, password, fetchFn) {
  const client = sdk.createClient({ baseUrl: homeserverUrl, fetchFn });
  const res = await client.login('m.login.password', {
    identifier: { type: 'm.id.user', user },
    password,
  });
  return sdk.createClient({ baseUrl: homeserverUrl, accessToken: res.access_token, userId: res.user_id });
}

async function loginWithToken(homeserverUrl, accessToken, userId, fetchFn) {
  const tokenClient = sdk.createClient({
    baseUrl: homeserverUrl,
    accessToken,
    userId: userId || null,
    fetchFn,
  });
  await tokenClient.whoami();
  return tokenClient;
}

function isAuthError(err) {
  if (!err) return false;
  const code = (err.errcode || '').toString();
  const status = Number(err.httpStatus || err.statusCode || err.status || 0);
  return code === 'M_UNKNOWN_TOKEN'
    || code === 'M_FORBIDDEN'
    || status === 401
    || status === 403;
}

function isRateLimited(err) {
  if (!err || typeof err !== 'object') return false;
  const code = (err.errcode || (err.data && err.data.errcode) || '').toString();
  const status = Number(err.httpStatus || err.statusCode || err.status || 0);
  return code === 'M_LIMIT_EXCEEDED' || status === 429;
}

function retryAfterMs(err) {
  if (!err || typeof err !== 'object') return null;
  const raw = (err.data && err.data.retry_after_ms)
    || (err.body && err.body.retry_after_ms)
    || err.retryAfterMs
    || null;
  if (raw == null) return null;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
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

/**
 * Matrix mgmt adapter over `dy.bus.v0` events (non-E2EE).
 *
 * Options:
 * - roomId / roomAlias: required (one of them)
 * - syncTimeoutMs: default 20s
 * - peerUserId: optional; when set, only accept events from this sender (DM safety)
 */
async function createMatrixLiveAdapter(options = {}) {
  loadEnv();
  const {
    roomId,
    roomAlias,
    syncTimeoutMs = 20000,
    peerUserId,
    homeserverUrl: homeserverUrlOpt,
    accessToken: accessTokenOpt,
    userId: userIdOpt,
    password: passwordOpt,
  } = options;
  if (!roomId && !roomAlias) {
    throw new Error('missing_room_identifier');
  }

  const homeserverUrl = firstValidValue(homeserverUrlOpt, process.env.MATRIX_HOMESERVER_URL);
  if (!homeserverUrl) {
    throw new Error('missing_env:MATRIX_HOMESERVER_URL');
  }
  const skipTls = homeserverUrl.startsWith('https:');
  const fetchFn = skipTls ? insecureFetch : undefined;
  const candidates = [
    {
      kind: 'token',
      source: 'options.accessToken',
      accessToken: firstValidValue(accessTokenOpt),
      userId: firstValidValue(userIdOpt),
    },
    {
      kind: 'password',
      source: 'options.password',
      user: firstValidValue(userIdOpt),
      password: firstValidValue(passwordOpt),
    },
    {
      kind: 'token',
      source: 'MATRIX_MBR_BOT_ACCESS_TOKEN',
      accessToken: firstValidValue(process.env.MATRIX_MBR_BOT_ACCESS_TOKEN),
      userId: firstValidValue(process.env.MATRIX_MBR_BOT_USER),
    },
    {
      kind: 'token',
      source: 'MATRIX_MBR_ACCESS_TOKEN',
      accessToken: firstValidValue(process.env.MATRIX_MBR_ACCESS_TOKEN),
      userId: firstValidValue(process.env.MATRIX_MBR_USER),
    },
    {
      kind: 'password',
      source: 'MATRIX_MBR_BOT_PASSWORD',
      user: firstValidValue(process.env.MATRIX_MBR_BOT_USER),
      password: firstValidValue(process.env.MATRIX_MBR_BOT_PASSWORD),
    },
    {
      kind: 'password',
      source: 'MATRIX_MBR_PASSWORD',
      user: firstValidValue(process.env.MATRIX_MBR_USER),
      password: firstValidValue(process.env.MATRIX_MBR_PASSWORD),
    },
  ].filter((candidate) => {
    if (candidate.kind === 'token') return Boolean(candidate.accessToken);
    return Boolean(candidate.user && candidate.password);
  });

  let client = null;
  let userId = null;
  for (const candidate of candidates) {
    if (candidate.kind === 'token') {
      try {
        client = await loginWithToken(homeserverUrl, candidate.accessToken, candidate.userId, fetchFn);
        userId = candidate.userId || client.getUserId?.();
        console.log('[matrix_live] token auth success:', candidate.source, candidate.userId || 'whoami');
        break;
      } catch (err) {
        if (!isAuthError(err)) throw err;
        console.warn(
          `[matrix_live] token auth failed for ${candidate.source} (${candidate.userId || 'unknown'}):`,
          err.errcode || err.message || err,
        );
      }
      continue;
    }
    try {
      client = await loginWithPassword(homeserverUrl, candidate.user, candidate.password, fetchFn);
      userId = client.getUserId ? client.getUserId() : candidate.user;
      console.log('[matrix_live] password auth success:', candidate.source, candidate.user);
      break;
    } catch (err) {
      if (!isAuthError(err)) throw err;
      console.warn(
        `[matrix_live] password auth failed for ${candidate.source} (${candidate.user}):`,
        err.errcode || err.message || err,
      );
    }
  }

  if (!client) {
    throw new Error('missing_matrix_credentials');
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

  // Matrix outbound flow control.
  // Keep sends serialized + paced to avoid Synapse 429 bursts.
  let sendQueue = Promise.resolve();
  let sendQueueDepth = 0;
  let sendNextAtMs = 0;
  const sendMinIntervalMs = readIntEnv('DY_MATRIX_SEND_MIN_INTERVAL_MS', 550, 0);
  const retryMaxAttempts = readIntEnv('DY_MATRIX_SEND_RETRY_MAX_ATTEMPTS', 5, 1);
  const retryFallbackMs = readIntEnv('DY_MATRIX_SEND_RETRY_FALLBACK_MS', 1200, 1);
  const retryMaxBackoffMs = readIntEnv('DY_MATRIX_SEND_RETRY_MAX_BACKOFF_MS', 10000, 1);

  async function waitSendSlot() {
    const now = Date.now();
    if (sendNextAtMs > now) {
      await sleepMs(sendNextAtMs - now);
    }
    const base = Math.max(Date.now(), sendNextAtMs);
    sendNextAtMs = base + sendMinIntervalMs;
  }

  function enqueueSend(event) {
    sendQueueDepth += 1;
    const run = async () => {
      try {
        let attempt = 0;
        while (attempt < retryMaxAttempts) {
          attempt += 1;
          await waitSendSlot();
          try {
            const res = await client.sendEvent(activeRoomId, 'dy.bus.v0', event);
            return res;
          } catch (err) {
            if (isRateLimited(err) && attempt < retryMaxAttempts) {
              const retryFromServer = retryAfterMs(err);
              const backoffMs = Math.min(
                retryMaxBackoffMs,
                Math.max(retryFallbackMs, retryFromServer || retryFallbackMs),
              );
              sendNextAtMs = Math.max(sendNextAtMs, Date.now() + backoffMs);
              console.warn(
                `[matrix_live] RATE_LIMIT: retry attempt=${attempt} backoff_ms=${backoffMs} retry_after_ms=${retryFromServer == null ? 'n/a' : retryFromServer}`,
              );
              continue;
            }
            throw err;
          }
        }
        throw new Error('matrix_send_retry_exhausted');
      } finally {
        sendQueueDepth = Math.max(0, sendQueueDepth - 1);
      }
    };
    const task = sendQueue.then(run, run);
    sendQueue = task.catch(() => {});
    return task;
  }

  const trace = [];
  const listeners = new Set();

  client.on('Room.timeline', (event, room, toStartOfTimeline) => {
    if (toStartOfTimeline) return;
    if (room && room.roomId !== activeRoomId) return;
    if (event.getType && event.getType() !== 'dy.bus.v0') return;
    if (peerUserId) {
      const sender = event.getSender ? event.getSender() : null;
      if (!sender || sender !== peerUserId) return;
    }
    const content = event.getContent ? event.getContent() : null;
    if (!content || typeof content !== 'object') return;
    trace.push({ type: 'recv', room_id: activeRoomId, event_id: event.getId?.(), content });
    for (const fn of listeners) fn(content);
  });

  client.startClient({ initialSyncLimit: 1 });
  await waitForSync(client, syncTimeoutMs);

  async function publish(event) {
    const res = await enqueueSend(event);
    const eventId = res?.event_id || null;
    trace.push({ type: 'send', room_id: activeRoomId, event_id: eventId, content: event });
    return { ok: true, room_id: activeRoomId, event_id: eventId, user_id: userId, queue_depth: sendQueueDepth };
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
