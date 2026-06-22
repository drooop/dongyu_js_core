import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sdk = require('matrix-js-sdk');

// ── Session Store (in-memory) ──────────────────────────────────────────────

const sessions = new Map(); // token → { userId, homeserverUrl, displayName, accessToken, createdAt }
const oidcPendingStates = new Map(); // state → { codeVerifier, nonce, returnTo, redirectUri, createdAt }
const oidcConsumedStates = new Map(); // state → expiresAt
const oidcInflightStates = new Map(); // state → expiresAt
const matrixSsoPendingStates = new Map(); // state → { sessionToken, homeserverUrl, returnTo, createdAt }
const oidcMetadataCache = new Map(); // issuer → metadata
const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60; // 7 days
const MAX_SESSIONS = 10000;
const OIDC_PENDING_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MATRIX_SSO_PENDING_TTL_MS = 5 * 60 * 1000;
const OIDC_STATE_COOKIE = 'dy_oidc_state';
const OIDC_STATE_COOKIE_VERSION = 'v1';

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

function isLoopbackHostname(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname === '[::1]';
}

function shouldUseSecureCookie(req = null) {
  const override = String(process.env.DY_COOKIE_SECURE || '').trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(override)) return true;
  if (['0', 'false', 'no'].includes(override)) return false;
  if (req && req.headers) {
    const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
    const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    if (proto === 'https') return true;
    try {
      const parsed = new URL(`${proto || 'http'}://${hostHeader || '127.0.0.1'}`);
      if (parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname)) return false;
    } catch (_) {
      // Fall through to environment default below.
    }
  }
  return process.env.NODE_ENV === 'production';
}

function secureCookieAttribute(req = null) {
  return shouldUseSecureCookie(req) ? '; Secure' : '';
}

function requestHostname(req = null) {
  if (!req || !req.headers) return '';
  try {
    return new URL(getRequestOrigin(req)).hostname;
  } catch (_) {
    return '';
  }
}

function urlHostname(value) {
  try {
    return new URL(String(value || '')).hostname;
  } catch (_) {
    return '';
  }
}

function hasExplicitOidcStateSecret() {
  return Boolean(
    process.env.DY_OIDC_STATE_SECRET
    || process.env.DY_SESSION_SECRET
    || process.env.DY_AUTH_SECRET
    || process.env.DY_COOKIE_SECRET
  );
}

function isLoopbackOidcBoundary(req = null, redirectUri = '') {
  const reqHost = requestHostname(req);
  const redirectHost = urlHostname(redirectUri);
  return Boolean(reqHost && redirectHost && isLoopbackHostname(reqHost) && isLoopbackHostname(redirectHost));
}

function assertOidcStateSecretBoundary(req = null, redirectUri = '') {
  if (hasExplicitOidcStateSecret()) return;
  if (process.env.NODE_ENV === 'production' || !isLoopbackOidcBoundary(req, redirectUri)) {
    throw new Error('oidc_state_secret_required');
  }
}

export function makeSetCookieHeader(token, maxAge, req = null) {
  const age = typeof maxAge === 'number' ? maxAge : SESSION_MAX_AGE_S;
  const secure = secureCookieAttribute(req);
  return `dy_session=${token}; HttpOnly; SameSite=Lax; Path=/${secure}; Max-Age=${age}`;
}

export function makeClearCookieHeader(req = null) {
  const secure = secureCookieAttribute(req);
  return `dy_session=; HttpOnly; SameSite=Lax; Path=/${secure}; Max-Age=0`;
}

function oidcStateCookieKey() {
  const secret = process.env.DY_OIDC_STATE_SECRET
    || process.env.DY_SESSION_SECRET
    || process.env.DY_AUTH_SECRET
    || process.env.DY_COOKIE_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('oidc_state_secret_required');
  }
  return crypto.createHash('sha256').update(String(secret || 'dongyu-local-oidc-state-v1')).digest();
}

function sealOidcPendingState(pending) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', oidcStateCookieKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(pending), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    OIDC_STATE_COOKIE_VERSION,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

function openOidcPendingState(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 4 || parts[0] !== OIDC_STATE_COOKIE_VERSION) return null;
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const ciphertext = Buffer.from(parts[2], 'base64url');
    const tag = Buffer.from(parts[3], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', oidcStateCookieKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plaintext);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function isValidOidcPendingShape(pending) {
  return Boolean(
    pending
    && typeof pending === 'object'
    && typeof pending.state === 'string'
    && typeof pending.codeVerifier === 'string'
    && typeof pending.nonce === 'string'
    && typeof pending.returnTo === 'string'
    && typeof pending.redirectUri === 'string'
    && typeof pending.issuer === 'string'
    && typeof pending.clientId === 'string'
    && Number.isFinite(Number(pending.createdAt))
  );
}

function sealOidcStateValue(state, pending, req = null) {
  assertOidcStateSecretBoundary(req, pending?.redirectUri || '');
  return sealOidcPendingState({ ...pending, state });
}

export function makeOidcStateCookieHeader(state, pending = null, req = null) {
  const secure = shouldUseSecureCookie(req);
  const value = pending ? sealOidcStateValue(state, pending, req) : state;
  const attrs = [
    `${OIDC_STATE_COOKIE}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/auth/sso/callback',
  ];
  if (secure) attrs.push('Secure');
  attrs.push(`Max-Age=${Math.floor(OIDC_PENDING_TTL_MS / 1000)}`);
  return attrs.join('; ');
}

export function makeClearOidcStateCookieHeader(req = null) {
  const secure = shouldUseSecureCookie(req);
  const attrs = [
    `${OIDC_STATE_COOKIE}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/auth/sso/callback',
  ];
  if (secure) attrs.push('Secure');
  attrs.push('Max-Age=0');
  return attrs.join('; ');
}

function toPublicSession(session) {
  if (!session) return null;
  const matrixUserId = session.matrixUserId || (session.provider === 'matrix' ? session.userId : '');
  return {
    provider: session.provider || 'matrix',
    userId: session.userId,
    subject: session.subject || session.userId,
    email: session.email || '',
    username: session.username || '',
    homeserverUrl: session.homeserverUrl || '',
    displayName: session.displayName,
    matrixUserId,
    roles: Array.isArray(session.roles) ? [...session.roles] : [],
    capabilities: Array.isArray(session.capabilities) ? [...session.capabilities] : [],
    matrixConnected: Boolean(session.accessToken),
  };
}

// ── Session helpers ────────────────────────────────────────────────────────

export function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.get('dy_session');
  if (!token) return null;
  const session = getValidSessionRecordByToken(token);
  if (!session) return null;
  return toPublicSession(session);
}

export function getSessionWithToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.get('dy_session');
  if (!token) return null;
  const session = getValidSessionRecordByToken(token);
  if (!session) return null;
  const matrixUserId = session.matrixUserId || (session.provider === 'matrix' ? session.userId : '');
  return {
    provider: session.provider || 'matrix',
    userId: session.userId,
    subject: session.subject || session.userId,
    email: session.email || '',
    username: session.username || '',
    homeserverUrl: session.homeserverUrl,
    displayName: session.displayName,
    matrixUserId,
    matrixDeviceId: session.matrixDeviceId || '',
    roles: Array.isArray(session.roles) ? [...session.roles] : [],
    capabilities: Array.isArray(session.capabilities) ? [...session.capabilities] : [],
    accessToken: session.accessToken,
    idToken: session.idToken,
    oidcAccessToken: session.oidcAccessToken,
  };
}

export function isAuthenticated(req) {
  return getSession(req) !== null;
}

function getSessionTokenFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies.get('dy_session') || '';
}

function getValidSessionRecordByToken(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  const elapsed = (Date.now() - session.createdAt) / 1000;
  if (elapsed > SESSION_MAX_AGE_S) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function sessionHasCapability(session, capability) {
  const capabilities = Array.isArray(session?.capabilities) ? session.capabilities : [];
  return capabilities.includes(capability);
}

// ── ZITADEL / OIDC Login ──────────────────────────────────────────────────

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function randomUrlSafe(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256Base64Url(value) {
  return crypto.createHash('sha256').update(value).digest('base64url');
}

function decodeBase64UrlJson(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function safeReturnTo(value) {
  if (!value || typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const parsed = new URL(value, 'http://dy.local');
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

function getRequestOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1';
  return `${String(proto).split(',')[0]}://${String(host).split(',')[0]}`;
}

export function isOidcConfigured(env = process.env) {
  return Boolean(env.DY_OIDC_ISSUER && env.DY_OIDC_CLIENT_ID);
}

export function getOidcConfig({ env = process.env, req = null } = {}) {
  const issuer = trimTrailingSlash(env.DY_OIDC_ISSUER);
  const clientId = String(env.DY_OIDC_CLIENT_ID || '').trim();
  if (!issuer || !clientId) {
    throw new Error('oidc_not_configured');
  }
  const origin = req ? getRequestOrigin(req) : '';
  return {
    issuer,
    clientId,
    clientSecret: env.DY_OIDC_CLIENT_SECRET || '',
    redirectUri: env.DY_OIDC_REDIRECT_URI || (origin ? `${origin}/auth/sso/callback` : ''),
    postLogoutRedirectUri: env.DY_OIDC_POST_LOGOUT_REDIRECT_URI || (origin ? `${origin}/` : ''),
    scope: env.DY_OIDC_SCOPE || 'openid profile email urn:zitadel:iam:org:project:id:zitadel:aud',
  };
}

async function fetchOidcMetadata(config, fetchFn = fetch) {
  const cached = oidcMetadataCache.get(config.issuer);
  if (cached) return cached;
  const resp = await fetchFn(`${config.issuer}/.well-known/openid-configuration`);
  if (!resp.ok) throw new Error('oidc_metadata_failed');
  const metadata = await resp.json();
  if (metadata.issuer !== config.issuer) throw new Error('oidc_issuer_mismatch');
  for (const key of ['authorization_endpoint', 'token_endpoint', 'userinfo_endpoint', 'jwks_uri']) {
    if (!metadata[key]) throw new Error(`oidc_metadata_missing_${key}`);
  }
  oidcMetadataCache.set(config.issuer, metadata);
  return metadata;
}

function cleanupOidcPendingStates() {
  const now = Date.now();
  for (const [state, pending] of oidcPendingStates) {
    if (now - pending.createdAt > OIDC_PENDING_TTL_MS) {
      oidcPendingStates.delete(state);
    }
  }
  for (const [state, expiresAt] of oidcConsumedStates) {
    if (now > expiresAt) oidcConsumedStates.delete(state);
  }
  for (const [state, expiresAt] of oidcInflightStates) {
    if (now > expiresAt) oidcInflightStates.delete(state);
  }
}

function finalizeOidcState(stateKey) {
  oidcPendingStates.delete(stateKey);
  oidcConsumedStates.set(stateKey, Date.now() + OIDC_PENDING_TTL_MS);
  oidcInflightStates.delete(stateKey);
}

function markOidcStateFinalized(error) {
  const err = error instanceof Error ? error : new Error(String(error || 'oidc_callback_failed'));
  err.oidcStateFinalized = true;
  return err;
}

export async function startOidcLogin({ req, returnTo, fetchFn = fetch } = {}) {
  cleanupOidcPendingStates();
  const config = getOidcConfig({ req });
  const metadata = await fetchOidcMetadata(config, fetchFn);
  const codeVerifier = randomUrlSafe(48);
  const codeChallenge = sha256Base64Url(codeVerifier);
  const stateId = randomUrlSafe(32);
  const nonce = randomUrlSafe(32);
  const redirectUri = config.redirectUri;
  const pending = {
    codeVerifier,
    nonce,
    returnTo: safeReturnTo(returnTo),
    redirectUri,
    issuer: config.issuer,
    clientId: config.clientId,
    createdAt: Date.now(),
  };
  const state = sealOidcStateValue(stateId, pending, req);
  oidcPendingStates.set(stateId, pending);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: config.scope,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return {
    authorizationUrl: `${metadata.authorization_endpoint}?${params.toString()}`,
    state,
    stateCookie: makeOidcStateCookieHeader(state, null, req),
  };
}

function findJwk(jwks, header) {
  const keys = Array.isArray(jwks && jwks.keys) ? jwks.keys : [];
  if (header.kid) {
    const found = keys.find((key) => key.kid === header.kid);
    if (found) return found;
  }
  return keys.find((key) => key.alg === header.alg) || keys[0] || null;
}

async function verifyJwtWithJwks(jwt, { metadata, clientId, issuer, nonce, fetchFn = fetch }) {
  const parts = String(jwt || '').split('.');
  if (parts.length !== 3) throw new Error('invalid_id_token');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeBase64UrlJson(encodedHeader);
  const claims = decodeBase64UrlJson(encodedPayload);
  if (header.alg !== 'RS256') throw new Error('unsupported_id_token_alg');
  const jwksResp = await fetchFn(metadata.jwks_uri);
  if (!jwksResp.ok) throw new Error('oidc_jwks_failed');
  const jwks = await jwksResp.json();
  const jwk = findJwk(jwks, header);
  if (!jwk) throw new Error('id_token_key_not_found');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();
  const ok = verifier.verify(crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(encodedSignature, 'base64url'));
  if (!ok) throw new Error('invalid_id_token_signature');
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== issuer) throw new Error('invalid_id_token_issuer');
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(clientId)) throw new Error('invalid_id_token_audience');
  if (!claims.sub) throw new Error('invalid_id_token_subject');
  if (Number(claims.exp || 0) < now - 30) throw new Error('expired_id_token');
  if (nonce && claims.nonce !== nonce) throw new Error('invalid_id_token_nonce');
  return claims;
}

function extractRoles(claims) {
  const roles = new Set();
  const claimEntries = claims && typeof claims === 'object' ? Object.entries(claims) : [];
  for (const [key, value] of claimEntries) {
    if (!/^urn:zitadel:iam:org:project(?::[^:]+)?:roles$/.test(key)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const roleKey of Object.keys(value)) roles.add(String(roleKey));
    }
  }
  for (const key of ['roles', 'role', 'groups']) {
    const value = claims && claims[key];
    if (Array.isArray(value)) {
      for (const item of value) roles.add(String(item));
    } else if (typeof value === 'string' && value) {
      roles.add(value);
    }
  }
  return [...roles].sort();
}

export function deriveCapabilitiesFromRoles(roles) {
  const caps = new Set(['app:read', 'workspace:read']);
  const normalized = (Array.isArray(roles) ? roles : []).map((role) => String(role).toLowerCase());
  const hasAny = (...needles) => normalized.some((role) => needles.some((needle) => role.includes(needle)));
  const hasDongyuAny = (...needles) => normalized.some((role) => (
    (role === 'dongyu' || role.startsWith('dongyu.') || role.startsWith('dongyu:'))
    && needles.some((needle) => role.includes(needle))
  ));
  if (hasDongyuAny('admin', 'owner')) {
    caps.add('app:write');
    caps.add('workspace:write');
    caps.add('slide_app:use');
    caps.add('matrix:connect');
    caps.add('management_bus:use');
  }
  if (hasDongyuAny('workspace', 'slide')) {
    caps.add('workspace:write');
    caps.add('slide_app:use');
  }
  if (hasDongyuAny('matrix')) caps.add('matrix:connect');
  if (hasDongyuAny('management', 'mgmt', 'bus')) caps.add('management_bus:use');
  return [...caps].sort();
}

function normalizeOidcPrincipal(claims) {
  const roles = extractRoles(claims);
  const email = typeof claims.email === 'string' ? claims.email : '';
  const username = typeof claims.preferred_username === 'string' ? claims.preferred_username : '';
  const displayName = claims.name || username || email || claims.sub;
  return {
    provider: 'zitadel',
    subject: String(claims.sub),
    userId: `zitadel:${claims.sub}`,
    email,
    username,
    displayName: String(displayName),
    roles,
    capabilities: deriveCapabilitiesFromRoles(roles),
  };
}

function createSessionRecord(session) {
  if (sessions.size >= MAX_SESSIONS) {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [k, v] of sessions) {
      if (v.createdAt < oldestTime) { oldestTime = v.createdAt; oldestKey = k; }
    }
    if (oldestKey) sessions.delete(oldestKey);
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { ...session, createdAt: Date.now() });
  return token;
}

export async function completeOidcLogin({ req, code, state, fetchFn = fetch } = {}) {
  cleanupOidcPendingStates();
  if (!code || !state) throw new Error('missing_oidc_callback_fields');
  const cookies = parseCookies(req.headers.cookie);
  const cookieValue = cookies.get(OIDC_STATE_COOKIE);
  let pending = null;
  let stateKey = state;
  const restoredFromState = openOidcPendingState(state);
  if (isValidOidcPendingShape(restoredFromState)) {
    pending = restoredFromState;
    stateKey = restoredFromState.state;
    const restoredFromCookie = cookieValue ? openOidcPendingState(cookieValue) : null;
    const cookieMatchesState = cookieValue === state
      || (isValidOidcPendingShape(restoredFromCookie) && restoredFromCookie.state === stateKey);
    if (!cookieMatchesState && !isLoopbackOidcBoundary(req, pending.redirectUri)) {
      throw new Error('invalid_oidc_state');
    }
  } else {
    if (!cookieValue) throw new Error('invalid_oidc_state');
    if (cookieValue === state) {
      pending = oidcPendingStates.get(state);
      stateKey = state;
    } else {
      const restored = openOidcPendingState(cookieValue);
      if (!isValidOidcPendingShape(restored) || restored.state !== state) {
        throw new Error('invalid_oidc_state');
      }
      pending = restored;
      stateKey = restored.state;
    }
  }
  if (!pending) throw new Error('invalid_oidc_state');
  if (Date.now() - Number(pending.createdAt) > OIDC_PENDING_TTL_MS) {
    oidcPendingStates.delete(stateKey);
    oidcInflightStates.delete(stateKey);
    throw new Error('invalid_oidc_state');
  }
  if (oidcConsumedStates.has(stateKey)) throw new Error('invalid_oidc_state');
  if (oidcInflightStates.has(stateKey)) throw new Error('invalid_oidc_state');
  const config = getOidcConfig({ req });
  if (pending.issuer !== config.issuer || pending.clientId !== config.clientId || pending.redirectUri !== config.redirectUri) {
      throw new Error('invalid_oidc_state');
  }
  oidcInflightStates.set(stateKey, Date.now() + OIDC_PENDING_TTL_MS);
  let metadata = null;
  try {
    metadata = await fetchOidcMetadata(config, fetchFn);
  } catch (error) {
    oidcInflightStates.delete(stateKey);
    throw error;
  }
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: pending.redirectUri,
    client_id: config.clientId,
    code_verifier: pending.codeVerifier,
  });
  if (config.clientSecret) body.set('client_secret', config.clientSecret);
  let tokenResp = null;
  try {
    tokenResp = await fetchFn(metadata.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (error) {
    oidcInflightStates.delete(stateKey);
    throw error;
  }
  const tokenJson = await tokenResp.json().catch(() => ({}));
  if (!tokenResp.ok) {
    oidcInflightStates.delete(stateKey);
    throw new Error(tokenJson.error || tokenJson.message || 'oidc_token_exchange_failed');
  }
  if (!tokenJson.access_token || !tokenJson.id_token) {
    finalizeOidcState(stateKey);
    throw markOidcStateFinalized(new Error(tokenJson.error || tokenJson.message || 'oidc_token_exchange_failed'));
  }
  try {
    const idClaims = await verifyJwtWithJwks(tokenJson.id_token, {
      metadata,
      clientId: config.clientId,
      issuer: config.issuer,
      nonce: pending.nonce,
      fetchFn,
    });
    const userinfoResp = await fetchFn(metadata.userinfo_endpoint, {
      headers: { authorization: `Bearer ${tokenJson.access_token}` },
    });
    const userinfo = userinfoResp.ok ? await userinfoResp.json().catch(() => ({})) : {};
    if (userinfo.sub && userinfo.sub !== idClaims.sub) throw new Error('oidc_userinfo_subject_mismatch');
    const safeUserinfo = { ...userinfo };
    for (const key of ['iss', 'aud', 'nonce', 'sub', 'exp', 'iat']) {
      delete safeUserinfo[key];
    }
    const principal = normalizeOidcPrincipal({ ...idClaims, ...safeUserinfo });
    const token = createSessionRecord({
      ...principal,
      homeserverUrl: '',
      accessToken: '',
      idToken: tokenJson.id_token,
      oidcAccessToken: tokenJson.access_token,
    });
    finalizeOidcState(stateKey);
    return {
      token,
      returnTo: pending.returnTo,
      session: toPublicSession(sessions.get(token)),
    };
  } catch (error) {
    finalizeOidcState(stateKey);
    throw markOidcStateFinalized(error);
  }
}

async function buildOidcLogoutUrl({ req, session, fetchFn = fetch } = {}) {
  if (!session || session.provider !== 'zitadel') return '';
  let config = null;
  let metadata = null;
  try {
    config = getOidcConfig({ req });
    metadata = await fetchOidcMetadata(config, fetchFn);
  } catch (_) {
    return '';
  }
  const endpoint = typeof metadata.end_session_endpoint === 'string'
    ? metadata.end_session_endpoint.trim()
    : '';
  if (!endpoint) return '';
  let parsedEndpoint = null;
  let parsedIssuer = null;
  try {
    parsedEndpoint = new URL(endpoint);
    parsedIssuer = new URL(config.issuer);
  } catch (_) {
    return '';
  }
  if (!['http:', 'https:'].includes(parsedEndpoint.protocol)) return '';
  if (
    parsedEndpoint.protocol !== 'https:'
    && !isLoopbackHostname(parsedEndpoint.hostname)
  ) {
    return '';
  }
  if (parsedEndpoint.origin !== parsedIssuer.origin) return '';
  const params = new URLSearchParams();
  if (session.idToken) params.set('id_token_hint', session.idToken);
  params.set('client_id', config.clientId);
  if (config.postLogoutRedirectUri) {
    params.set('post_logout_redirect_uri', config.postLogoutRedirectUri);
  }
  parsedEndpoint.search = params.toString();
  return parsedEndpoint.toString();
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

// ── Matrix SSO bridge ─────────────────────────────────────────────────────

function matrixSsoPendingTtlMs() {
  const raw = process.env.DY_MATRIX_SSO_PENDING_TTL_MS;
  const parsed = Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MATRIX_SSO_PENDING_TTL_MS;
}

function cleanupMatrixSsoPendingStates() {
  const now = Date.now();
  const ttl = matrixSsoPendingTtlMs();
  for (const [state, pending] of matrixSsoPendingStates) {
    if (now - pending.createdAt > ttl) {
      matrixSsoPendingStates.delete(state);
    }
  }
}

function configuredMatrixSsoHomeserverOrigins() {
  const candidates = [];
  if (process.env.MATRIX_HOMESERVER_URL) candidates.push(process.env.MATRIX_HOMESERVER_URL);
  if (process.env.DY_MATRIX_SSO_ALLOWED_HOMESERVERS) {
    candidates.push(...String(process.env.DY_MATRIX_SSO_ALLOWED_HOMESERVERS).split(','));
  }
  for (const item of loadHomeservers()) {
    candidates.push(typeof item === 'string' ? item : item?.url);
  }
  const origins = new Set();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') continue;
    try {
      origins.add(validateHomeserverUrl(candidate));
    } catch (_) {
      // Ignore invalid persisted/configured entries instead of widening access.
    }
  }
  return origins;
}

function normalizeMatrixSsoHomeserverUrl(homeserverUrl) {
  const requested = homeserverUrl || process.env.MATRIX_HOMESERVER_URL || '';
  if (!requested) throw new Error('missing_homeserver_url');
  const validated = validateHomeserverUrl(requested);
  const allowed = configuredMatrixSsoHomeserverOrigins();
  if (!allowed.has(validated)) throw new Error('homeserver_not_allowed');
  return validated;
}

async function fetchMatrixLoginFlows(homeserverUrl, fetchFn = fetch) {
  const resp = await fetchFn(`${homeserverUrl}/_matrix/client/v3/login`, {
    headers: { accept: 'application/json' },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error('matrix_login_flows_failed');
  const flows = Array.isArray(data?.flows) ? data.flows : [];
  const types = new Set(flows.map((flow) => String(flow?.type || '')));
  if (!types.has('m.login.sso')) throw new Error('matrix_sso_not_supported');
  if (!types.has('m.login.token')) throw new Error('matrix_token_login_not_supported');
}

export async function startMatrixSso({ req, homeserverUrl, returnTo, fetchFn = fetch } = {}) {
  cleanupMatrixSsoPendingStates();
  const sessionToken = getSessionTokenFromRequest(req || { headers: {} });
  const session = getValidSessionRecordByToken(sessionToken);
  if (!session) throw new Error('matrix_session_missing');
  if (!sessionHasCapability(session, 'matrix:connect')) throw new Error('permission_denied');
  const validatedHomeserver = normalizeMatrixSsoHomeserverUrl(homeserverUrl);
  await fetchMatrixLoginFlows(validatedHomeserver, fetchFn);
  const state = randomUrlSafe(32);
  const callbackUrl = new URL('/auth/matrix/callback', getRequestOrigin(req || { headers: {} }));
  callbackUrl.searchParams.set('state', state);
  matrixSsoPendingStates.set(state, {
    sessionToken,
    homeserverUrl: validatedHomeserver,
    returnTo: safeReturnTo(returnTo),
    createdAt: Date.now(),
  });
  const redirectUrl = new URL('/_matrix/client/v3/login/sso/redirect', validatedHomeserver);
  redirectUrl.searchParams.set('redirectUrl', callbackUrl.toString());
  addHomeserver(validatedHomeserver);
  return {
    state,
    homeserverUrl: validatedHomeserver,
    redirectUrl: redirectUrl.toString(),
  };
}

export async function completeMatrixSso({ state, loginToken, fetchFn = fetch } = {}) {
  cleanupMatrixSsoPendingStates();
  if (!state || !loginToken) throw new Error('missing_matrix_sso_callback_fields');
  const pending = matrixSsoPendingStates.get(state);
  if (!pending) throw new Error('invalid_matrix_sso_state');
  matrixSsoPendingStates.delete(state);
  const session = getValidSessionRecordByToken(pending.sessionToken);
  if (!session) throw new Error('matrix_session_missing');
  if (!sessionHasCapability(session, 'matrix:connect')) throw new Error('permission_denied');
  const resp = await fetchFn(`${pending.homeserverUrl}/_matrix/client/v3/login`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      type: 'm.login.token',
      token: loginToken,
      initial_device_display_name: 'Dongyu App',
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data || typeof data.access_token !== 'string' || !data.access_token || typeof data.user_id !== 'string' || !data.user_id) {
    throw new Error(data && data.errcode ? String(data.errcode) : 'matrix_token_exchange_failed');
  }
  session.homeserverUrl = pending.homeserverUrl;
  session.accessToken = data.access_token;
  session.matrixUserId = data.user_id;
  session.matrixDeviceId = typeof data.device_id === 'string' ? data.device_id : '';
  session.matrixConnectedAt = Date.now();
  addHomeserver(pending.homeserverUrl);
  return {
    returnTo: pending.returnTo || '/',
    session: toPublicSession(session),
  };
}

export function getMatrixStatus(req) {
  const token = getSessionTokenFromRequest(req || { headers: {} });
  const session = getValidSessionRecordByToken(token);
  const publicSession = toPublicSession(session);
  return {
    ok: true,
    matrixConnected: Boolean(publicSession?.matrixConnected),
    homeserverUrl: publicSession?.homeserverUrl || '',
    matrixUserId: publicSession?.matrixUserId || '',
  };
}

export function disconnectMatrix(req) {
  const token = getSessionTokenFromRequest(req || { headers: {} });
  const session = getValidSessionRecordByToken(token);
  if (!session) throw new Error('matrix_session_missing');
  session.homeserverUrl = '';
  session.accessToken = '';
  session.matrixUserId = '';
  session.matrixDeviceId = '';
  session.matrixConnectedAt = 0;
  return getMatrixStatus(req);
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

  const session = {
    provider: 'matrix',
    userId,
    matrixUserId: userId,
    matrixDeviceId: loginRes.device_id || '',
    homeserverUrl: validatedOrigin,
    displayName,
    roles: [],
    capabilities: ['app:read', 'workspace:read', 'matrix:connect'],
    accessToken: loginRes.access_token,
  };
  const token = createSessionRecord(session);

  // Persist homeserver to history
  addHomeserver(validatedOrigin);

  return { token, userId: session.userId, homeserverUrl: session.homeserverUrl, displayName: session.displayName };
}

export async function logout(req, { fetchFn = fetch, includeOidcLogoutUrl = true } = {}) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.get('dy_session');
  const session = token ? getValidSessionRecordByToken(token) : null;
  if (token) sessions.delete(token);
  if (!includeOidcLogoutUrl) return { logoutUrl: '' };
  const logoutUrl = await buildOidcLogoutUrl({ req, session, fetchFn });
  return { logoutUrl };
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
