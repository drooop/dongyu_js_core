import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sdk = require('matrix-js-sdk');

// ── Session Store (in-memory) ──────────────────────────────────────────────

const sessions = new Map(); // token → { userId, homeserverUrl, displayName, createdAt }
const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60; // 7 days
const MAX_SESSIONS = 10000;

// Periodic cleanup of expired sessions (every 10 minutes).
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if ((now - session.createdAt) / 1000 > SESSION_MAX_AGE_S) {
      sessions.delete(token);
    }
  }
}, 10 * 60 * 1000).unref();

// ── Cookie helpers ─────────────────────────────────────────────────────────

export function parseCookies(header) {
  const map = new Map();
  if (!header || typeof header !== 'string') return map;
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) map.set(k, v);
  }
  return map;
}

export function makeSetCookieHeader(token, maxAge) {
  const age = typeof maxAge === 'number' ? maxAge : SESSION_MAX_AGE_S;
  const secure = process.env.NODE_ENV === 'development' ? '' : '; Secure';
  return `dy_session=${token}; HttpOnly; SameSite=Strict; Path=/${secure}; Max-Age=${age}`;
}

export function makeClearCookieHeader() {
  const secure = process.env.NODE_ENV === 'development' ? '' : '; Secure';
  return `dy_session=; HttpOnly; SameSite=Strict; Path=/${secure}; Max-Age=0`;
}

// ── Session helpers ────────────────────────────────────────────────────────

export function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.get('dy_session');
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  const elapsed = (Date.now() - session.createdAt) / 1000;
  if (elapsed > SESSION_MAX_AGE_S) {
    sessions.delete(token);
    return null;
  }
  return { userId: session.userId, homeserverUrl: session.homeserverUrl, displayName: session.displayName };
}

export function isAuthenticated(req) {
  return getSession(req) !== null;
}

// ── Rate Limiting ──────────────────────────────────────────────────────────

const loginAttempts = new Map(); // ip → { count, resetAt }
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

// Periodic cleanup of expired rate limit entries.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}, 5 * 60 * 1000).unref();

// ── SSRF Protection ────────────────────────────────────────────────────────

export function validateHomeserverUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('invalid_homeserver_url');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('invalid_homeserver_protocol');
  }
  const hostname = parsed.hostname;
  // Block metadata endpoints and private ranges
  if (hostname === '169.254.169.254'
      || hostname === '[fd00::c0a8:1]'
      || hostname.startsWith('10.')
      || hostname.startsWith('192.168.')
      || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) {
    throw new Error('blocked_internal_url');
  }
  return parsed.origin;
}

// ── Matrix Login ───────────────────────────────────────────────────────────

function createFetchFn(homeserverUrl) {
  // Only skip TLS for self-signed certs when explicitly opted in via env.
  if (homeserverUrl.startsWith('https:') && process.env.DY_SKIP_TLS === '1') {
    return (url, opts) => fetch(url, { ...opts, tls: { rejectUnauthorized: false } });
  }
  return undefined;
}

export async function loginWithMatrix(homeserverUrl, username, password) {
  if (!homeserverUrl || typeof homeserverUrl !== 'string') {
    throw new Error('missing_homeserver_url');
  }
  if (!username || !password) {
    throw new Error('missing_credentials');
  }

  // SSRF protection
  const validatedOrigin = validateHomeserverUrl(homeserverUrl);

  const fetchFn = createFetchFn(validatedOrigin);
  const client = sdk.createClient({ baseUrl: validatedOrigin, fetchFn });

  const loginRes = await client.login('m.login.password', {
    identifier: { type: 'm.id.user', user: username },
    password,
  });

  const userId = loginRes.user_id || `@${username}`;
  const displayName = loginRes.display_name || userId;

  // Invalidate the Matrix access_token we just obtained (best-effort).
  try {
    const tmpClient = sdk.createClient({
      baseUrl: validatedOrigin,
      accessToken: loginRes.access_token,
      userId,
      fetchFn,
    });
    await tmpClient.logout(true);
  } catch (err) {
    console.warn('[auth] Matrix token cleanup failed:', err && err.message ? err.message : err);
  }

  // Evict oldest session if at capacity.
  if (sessions.size >= MAX_SESSIONS) {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [k, v] of sessions) {
      if (v.createdAt < oldestTime) { oldestTime = v.createdAt; oldestKey = k; }
    }
    if (oldestKey) sessions.delete(oldestKey);
  }

  const token = crypto.randomBytes(32).toString('hex');
  const session = { userId, homeserverUrl: validatedOrigin, displayName, createdAt: Date.now() };
  sessions.set(token, session);

  // Persist homeserver to history
  addHomeserver(validatedOrigin);

  return { token, userId: session.userId, homeserverUrl: session.homeserverUrl, displayName: session.displayName };
}

export function logout(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.get('dy_session');
  if (token) sessions.delete(token);
}

// ── Homeserver history persistence ─────────────────────────────────────────

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const HS_FILE = process.env.DY_HOMESERVERS_FILE
  || path.join(serverDir, 'data', 'default', 'homeservers.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadHomeservers() {
  try {
    if (!fs.existsSync(HS_FILE)) return [];
    const raw = fs.readFileSync(HS_FILE, 'utf-8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (err) {
    console.warn('[auth] Failed to load homeservers:', err && err.message ? err.message : err);
    return [];
  }
}

function saveHomeservers(list) {
  ensureDir(path.dirname(HS_FILE));
  fs.writeFileSync(HS_FILE, JSON.stringify(list, null, 2) + '\n', 'utf-8');
}

export function addHomeserver(url) {
  if (!url || typeof url !== 'string') return;
  const normalized = url.replace(/\/+$/, '');
  const list = loadHomeservers();
  if (list.some(item => (typeof item === 'string' ? item : item.url) === normalized)) return;
  list.push({ url: normalized, label: normalized });
  saveHomeservers(list);
}

export function removeHomeserver(url) {
  if (!url || typeof url !== 'string') return;
  const normalized = url.replace(/\/+$/, '');
  const list = loadHomeservers();
  const filtered = list.filter(item => (typeof item === 'string' ? item : item.url) !== normalized);
  saveHomeservers(filtered);
}
