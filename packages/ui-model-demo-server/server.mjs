import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

import AdmZipPkg from 'adm-zip';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

import { ModelTableRuntime } from '../worker-base/src/index.mjs';
import { createLocalBusAdapter } from '../ui-model-demo-frontend/src/local_bus_adapter.js';
import { buildEditorAstV1, buildAstFromSchema } from '../ui-model-demo-frontend/src/demo_modeltable.js';
import { GALLERY_MAILBOX_MODEL_ID, GALLERY_STATE_MODEL_ID } from '../ui-model-demo-frontend/src/model_ids.js';
import {
  getSession, isAuthenticated, loginWithMatrix, logout,
  makeSetCookieHeader, makeClearCookieHeader,
  loadHomeservers, addHomeserver, removeHomeserver,
  checkLoginRateLimit,
} from './auth.mjs';

const require = createRequire(import.meta.url);
const { loadProgramModelFromSqlite } = require('../worker-base/src/program_model_loader.js');
const { createSqlitePersister } = require('../worker-base/src/modeltable_persistence_sqlite.js');
const { initDataModel } = require('../worker-base/src/data_models.js');
const sdk = require('matrix-js-sdk');

const EDITOR_MODEL_ID = -1;
const EDITOR_STATE_MODEL_ID = -2;
const LOGIN_MODEL_ID = -3;
const TRACE_MODEL_ID = -100;

// Monotonic sequence counter for trace events (module-level, survives across calls).
let _traceSeq = 0;

/**
 * Emit a trace event into the Bus Trace model's mailbox.
 * The mailbox trigger (trace_append) will fire and push it into the CircularBuffer.
 *
 * @param {object} runtime - ModelTableRuntime instance
 * @param {object} opts
 * @param {string} opts.hop - e.g. 'ui→server', 'server→matrix', 'matrix→server', 'mqtt→mbr'
 * @param {string} opts.direction - 'inbound' | 'outbound'
 * @param {string} [opts.op_id] - operation id for correlation
 * @param {number|string} [opts.model_id] - related model id
 * @param {string} [opts.summary] - short human-readable summary
 * @param {*} [opts.payload] - full payload (will be truncated in UI)
 * @param {string} [opts.error] - error message if applicable
 */
function emitTrace(runtime, { hop, direction, op_id, model_id, summary, payload, error }) {
  const tm = runtime.getModel(TRACE_MODEL_ID);
  if (!tm) return;
  const enabled = runtime.getLabelValue(tm, 0, 0, 0, 'trace_enabled');
  if (!enabled) return;
  _traceSeq += 1;
  runtime.addLabel(tm, 0, 0, 1, {
    k: 'trace_event',
    t: 'json',
    v: {
      ts: Date.now(),
      seq: _traceSeq,
      hop: hop || '',
      direction: direction || '',
      op_id: op_id || '',
      model_id: model_id != null ? model_id : '',
      summary: summary || '',
      payload: payload != null ? payload : null,
      error: error || null,
    },
  });
}

function readIntEnv(name, fallback, minValue = 0) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < minValue) return fallback;
  return parsed;
}

function sleepMs(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      // NOTE: /ui_event can carry base64 payloads (zip/html).
      // Keep this bounded, but allow larger than 1MB.
      if (body.length > 16 * 1024 * 1024) {
        reject(new Error('body_too_large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve(null);
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function writeJson(res, statusCode, data, extraHeaders) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    ...(extraHeaders || {}),
  });
  res.end(body);
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.map') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function safeJoin(rootDir, urlPath) {
  const normalized = urlPath.replace(/\0/g, '');
  const rel = normalized.replace(/^\/+/, '');
  const full = path.resolve(rootDir, rel);
  if (!full.startsWith(path.resolve(rootDir) + path.sep) && full !== path.resolve(rootDir)) {
    return null;
  }
  return full;
}

function maybeEnsureFrontendBuild(distDir) {
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) return { ok: true, built: false };

  const projectDir = path.resolve(path.join(distDir, '..'));
  const result = spawnSync('npm', ['-C', projectDir, 'run', 'build'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: process.env,
  });
  if (result.status !== 0) {
    return { ok: false, built: false, error: 'frontend_build_failed' };
  }
  return { ok: fs.existsSync(indexPath), built: true };
}

const DOCS_ROOT = path.resolve(new URL('../../docs/', import.meta.url).pathname);
const STATIC_PROJECTS_ROOT = path.resolve(process.cwd(), '.dy_static_projects');

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function isAllowedDocRelPath(relPath) {
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel.endsWith('.md')) return false;
  // Docs UI MUST only expose this exact file.
  return rel === 'user-guide/ui_binding_conversational.md';
}

function listMarkdownFiles(rootDir, allowFn) {
  const out = [];
  function walk(dirAbs, prefix) {
    const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    for (const ent of entries) {
      const name = ent.name;
      if (name.startsWith('.')) continue;
      const abs = path.join(dirAbs, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (ent.isDirectory()) {
        walk(abs, rel);
      } else if (ent.isFile() && name.toLowerCase().endsWith('.md')) {
        const relNorm = rel.replace(/\\/g, '/');
        if (allowFn && !allowFn(relNorm)) continue;
        out.push({ relPath: relNorm, absPath: abs });
      }
    }
  }
  walk(rootDir, '');
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function buildDocsTree(files) {
  const root = { label: 'docs', path: '', children: [] };
  const ensureChild = (parent, label, pathValue) => {
    const existing = parent.children.find((c) => c.label === label);
    if (existing) return existing;
    const next = { label, path: pathValue || '', children: [] };
    parent.children.push(next);
    return next;
  };

  for (const f of files) {
    const parts = String(f.relPath).split('/');
    let cur = root;
    let prefix = '';
    for (let i = 0; i < parts.length; i += 1) {
      const seg = parts[i];
      const isLeaf = i === parts.length - 1;
      prefix = prefix ? `${prefix}/${seg}` : seg;
      if (isLeaf) {
        cur.children.push({ label: seg, path: f.relPath, children: [] });
      } else {
        cur = ensureChild(cur, seg, prefix);
      }
    }
  }

  function sortNode(n) {
    n.children.sort((a, b) => {
      const ad = a.children && a.children.length > 0;
      const bd = b.children && b.children.length > 0;
      if (ad !== bd) return ad ? -1 : 1;
      return String(a.label).localeCompare(String(b.label));
    });
    for (const c of n.children) sortNode(c);
  }
  sortNode(root);
  return [root];
}

let mdProcessor = null;
function getMarkdownProcessor() {
  if (mdProcessor) return mdProcessor;
  const schema = JSON.parse(JSON.stringify(defaultSchema));
  schema.tagNames = Array.from(new Set([...(schema.tagNames || []), 'span', 'div']));
  schema.attributes = schema.attributes || {};
  schema.attributes.span = Array.from(new Set([...(schema.attributes.span || []), 'className', 'style', 'aria-hidden', 'role']));
  schema.attributes.div = Array.from(new Set([...(schema.attributes.div || []), 'className', 'style']));
  schema.attributes.a = Array.from(new Set([...(schema.attributes.a || []), 'href', 'title', 'rel', 'target']));

  mdProcessor = unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeSanitize, schema)
    .use(rehypeKatex, { trust: false, strict: 'warn', output: 'html' })
    .use(rehypeStringify);
  return mdProcessor;
}

async function renderMarkdownToHtml(markdownText) {
  const md = typeof markdownText === 'string' ? markdownText : String(markdownText ?? '');
  const file = await getMarkdownProcessor().process(md);
  return String(file);
}

function listStaticProjects() {
  ensureDir(STATIC_PROJECTS_ROOT);
  const entries = fs.readdirSync(STATIC_PROJECTS_ROOT, { withFileTypes: true });
  const out = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const name = ent.name;
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) continue;
    const abs = path.join(STATIC_PROJECTS_ROOT, name);
    const st = fs.statSync(abs);
    out.push({ name, url: `/p/${name}/`, updated_at: st.mtime.toISOString() });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function safeExtractZipToDir(zipBuffer, destDir) {
  ensureDir(destDir);
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  for (const e of entries) {
    const rawName = String(e.entryName || '').replace(/\\/g, '/');
    if (!rawName || rawName.startsWith('/') || rawName.includes('..')) {
      continue;
    }
    const outPath = safeJoin(destDir, rawName);
    if (!outPath) continue;
    if (e.isDirectory) {
      ensureDir(outPath);
      continue;
    }
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, e.getData());
  }
}

function corsHeaders(req, originOverride) {
  if (!originOverride) {
    // Default: do NOT enable cross-origin reads/writes.
    // Same-origin requests (including static UI served by this server) do not need CORS.
    return {};
  }
  const allowOrigin = String(originOverride);
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  };
}

function getMailboxCell(runtime) {
  const model = runtime.getModel(EDITOR_MODEL_ID);
  return runtime.getCell(model, 0, 0, 1);
}

function getLastOpId(runtime) {
  const cell = getMailboxCell(runtime);
  const label = cell.labels.get('ui_event_last_op_id');
  return label ? label.v : '';
}

function getEventError(runtime) {
  const cell = getMailboxCell(runtime);
  const label = cell.labels.get('ui_event_error');
  return label ? label.v : null;
}

function setMailboxEnvelope(runtime, envelopeOrNull) {
  const model = runtime.getModel(EDITOR_MODEL_ID);
  runtime.addLabel(model, 0, 0, 1, { k: 'ui_event', t: 'event', v: envelopeOrNull });
}

function isModel100SubmitPayload(payload) {
  if (!payload || payload.action !== 'label_add') return false;
  const target = payload.target || null;
  if (!target || target.model_id !== 100 || target.p !== 0 || target.r !== 0 || target.c !== 2 || target.k !== 'ui_event') {
    return false;
  }
  const value = payload.value || null;
  const event = value && typeof value === 'object' && value.v && typeof value.v === 'object' ? value.v : null;
  return Boolean(event && event.action === 'submit');
}

function setModel100SubmitState(runtime, options = {}) {
  const model = runtime.getModel(100);
  if (!model) return;
  const inflight = options.inflight === true;
  runtime.addLabel(model, 0, 0, 0, { k: 'submit_inflight', t: 'bool', v: inflight });
  if (typeof options.status === 'string' && options.status.length > 0) {
    runtime.addLabel(model, 0, 0, 0, { k: 'status', t: 'str', v: options.status });
  }
}

function buildSafeSnapshotJson(runtime) {
  const snap = runtime.snapshot();
  const safeModels = {};
  const snapModels = snap && snap.models ? snap.models : {};
  for (const [id, model] of Object.entries(snapModels)) {
    if (String(id) === String(EDITOR_MODEL_ID)) continue;
    if (String(id) === String(EDITOR_STATE_MODEL_ID)) continue;
    safeModels[id] = model;
  }
  return JSON.stringify({ models: safeModels, v1nConfig: snap ? snap.v1nConfig : undefined }, null, 2);
}

// Lightweight snapshot for SSE/client: excludes internal-only labels that bloat payload.
// Filters: snapshot_json (1.5MB recursive), event_log, trace entry cells, function code.
const INTERNAL_LABEL_TYPES = new Set(['function', 'CELL_CONNECT', 'cell_connection', 'IN', 'BUS_IN', 'BUS_OUT', 'MODEL_IN', 'MODEL_OUT', 'subModel', 'MQTT_WILDCARD_SUB']);
const EXCLUDED_LABEL_KEYS = new Set(['snapshot_json', 'event_log']);

function buildClientSnapshot(runtime) {
  const snap = runtime.snapshot();
  if (!snap || !snap.models) return snap;
  const models = {};
  for (const [id, model] of Object.entries(snap.models)) {
    const modelId = Number(id);
    // Trace model: only include summary cell (0,0,0), skip trace entry cells
    if (modelId === TRACE_MODEL_ID) {
      const filteredCells = {};
      const rootCell = model.cells && model.cells['0,0,0'];
      if (rootCell) filteredCells['0,0,0'] = rootCell;
      models[id] = { ...model, cells: filteredCells };
      continue;
    }
    // System function model: exclude function code labels
    if (modelId === -10) {
      const filteredCells = {};
      for (const [ck, cell] of Object.entries(model.cells || {})) {
        const filteredLabels = {};
        for (const [lk, lv] of Object.entries(cell.labels || {})) {
          if (INTERNAL_LABEL_TYPES.has(lv.t)) continue;
          filteredLabels[lk] = lv;
        }
        filteredCells[ck] = { ...cell, labels: filteredLabels };
      }
      models[id] = { ...model, cells: filteredCells };
      continue;
    }
    // Editor model (-1): exclude snapshot_json and event_log
    if (modelId === EDITOR_MODEL_ID) {
      const filteredCells = {};
      for (const [ck, cell] of Object.entries(model.cells || {})) {
        const filteredLabels = {};
        for (const [lk, lv] of Object.entries(cell.labels || {})) {
          if (EXCLUDED_LABEL_KEYS.has(lk)) continue;
          filteredLabels[lk] = lv;
        }
        filteredCells[ck] = { ...cell, labels: filteredLabels };
      }
      models[id] = { ...model, cells: filteredCells };
      continue;
    }
    models[id] = model;
  }
  return { models, v1nConfig: snap.v1nConfig };
}

function resolveDbPath() {
  const workspace = process.env.WORKER_BASE_WORKSPACE || 'default';
  const configuredRoot = process.env.WORKER_BASE_DATA_ROOT;
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const dataRoot = configuredRoot && configuredRoot.trim()
    ? (path.isAbsolute(configuredRoot) ? configuredRoot : path.resolve(process.cwd(), configuredRoot))
    : path.resolve(serverDir, 'data');
  return path.resolve(dataRoot, workspace, 'yhl.db');
}

function ensureStateLabel(runtime, key, t, v) {
  const model = runtime.getModel(EDITOR_STATE_MODEL_ID);
  const cell = runtime.getCell(model, 0, 0, 0);
  if (!cell.labels.has(key)) {
    runtime.addLabel(model, 0, 0, 0, { k: key, t, v });
  }
}

function parseJsonMaybe(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return value;
  }
}

let envLoaded = false;
function loadEnvOnce() {
  if (envLoaded) return;
  try {
    const dotenv = require('dotenv');
    // Try cwd first, then walk up to project root to find .env
    const result = dotenv.config();
    if (result.error) {
      const rootEnv = new URL('../../.env', import.meta.url).pathname;
      dotenv.config({ path: rootEnv });
    }
  } catch (_) {
    // dotenv optional
  }
  envLoaded = true;
}

// Custom fetch that skips TLS certificate verification (for self-signed certs).
// Bun supports `tls: { rejectUnauthorized: false }` as a fetch option.
function insecureFetch(url, opts) {
  return fetch(url, { ...opts, tls: { rejectUnauthorized: false } });
}

async function createMatrixClient() {
  loadEnvOnce();
  const homeserverUrl = process.env.MATRIX_HOMESERVER_URL;
  if (!homeserverUrl) {
    throw new Error('missing_matrix_homeserver_url');
  }
  const skipTls = homeserverUrl.startsWith('https:');
  const fetchFn = skipTls ? insecureFetch : undefined;
  const token = process.env.MATRIX_MBR_ACCESS_TOKEN;
  if (token) {
    const userId = process.env.MATRIX_MBR_USER || null;
    return sdk.createClient({ baseUrl: homeserverUrl, accessToken: token, userId, fetchFn });
  }
  const user = process.env.MATRIX_MBR_USER;
  const password = process.env.MATRIX_MBR_PASSWORD;
  if (!user || !password) {
    throw new Error('missing_matrix_credentials');
  }
  const tmp = sdk.createClient({ baseUrl: homeserverUrl, fetchFn });
  const res = await tmp.login('m.login.password', {
    identifier: { type: 'm.id.user', user },
    password,
  });
  return sdk.createClient({ baseUrl: homeserverUrl, accessToken: res.access_token, userId: res.user_id, fetchFn });
}

function listSystemLabels(runtime, predicate) {
  const out = [];
  for (const [id, model] of runtime.models.entries()) {
    if (id >= 0) continue;
    for (const cell of model.cells.values()) {
      for (const label of cell.labels.values()) {
        if (!predicate || predicate(label, model, cell)) {
          out.push({ model, cell, label });
        }
      }
    }
  }
  return out;
}

function findSystemLabel(runtime, key) {
  const items = listSystemLabels(runtime, (label) => label.k === key);
  return items.length > 0 ? items[0] : null;
}

function firstSystemModel(runtime) {
  const fnLabel = listSystemLabels(runtime, (label) => label.t === 'function')[0];
  if (fnLabel) return fnLabel.model;
  for (const [id, model] of runtime.models.entries()) {
    if (id < 0) return model;
  }
  return null;
}

class ProgramModelEngine {
  constructor(runtime) {
    this.runtime = runtime;
    this.functions = new Map();
    this.interceptCursor = 0;
    this.eventCursor = 0;
    this.matrixClient = null;
    this.matrixRoomId = null;
    this.matrixDmPeerUserId = null;
    this.started = false;

    // Tick scheduler state.
    // - Only one tick body may run at a time.
    // - Concurrent callers share the same in-flight promise.
    // - Work created during a tick is processed in a subsequent tick round.
    this.tickInFlight = null;
    this.tickRequested = false;
    
    // Callback invoked when snapshot changes due to Matrix/external events.
    // Set by server to trigger SSE broadcast.
    this.onSnapshotChanged = null;

    // Matrix outbound flow control.
    // Keep Matrix sends serialized to avoid burst-triggered 429.
    this.matrixSendQueue = Promise.resolve();
    this.matrixSendQueueDepth = 0;
    this.matrixSendNextAtMs = 0;
    this.matrixMinSendIntervalMs = readIntEnv('DY_MATRIX_SEND_MIN_INTERVAL_MS', 550, 0);
    this.matrixRetryMaxAttempts = readIntEnv('DY_MATRIX_SEND_RETRY_MAX_ATTEMPTS', 5, 1);
    this.matrixRetryFallbackMs = readIntEnv('DY_MATRIX_SEND_RETRY_FALLBACK_MS', 1200, 1);
    this.matrixRetryMaxBackoffMs = readIntEnv('DY_MATRIX_SEND_RETRY_MAX_BACKOFF_MS', 10000, 1);
  }

  async init() {
    this.refreshFunctionRegistry();
    const roomLabel = findSystemLabel(this.runtime, 'matrix_room_id');
    this.matrixRoomId = process.env.DY_MATRIX_ROOM_ID || (roomLabel ? String(roomLabel.label.v || '') : '');
    const peerLabel = findSystemLabel(this.runtime, 'matrix_dm_peer_user_id');
    this.matrixDmPeerUserId = process.env.DY_MATRIX_DM_PEER_USER_ID || (peerLabel ? String(peerLabel.label.v || '') : '');
    if (this.matrixRoomId) {
      try {
        this.matrixClient = await createMatrixClient();
        this.startMatrixListener();
        console.log('[ProgramModelEngine] Matrix client connected, room:', this.matrixRoomId);
      } catch (err) {
        console.warn('[ProgramModelEngine] Matrix init failed (non-fatal):', err.message || err);
        console.warn('[ProgramModelEngine] Program engine will run without Matrix. UI events won\'t reach MBR/MQTT.');
        this.matrixClient = null;
      }
    } else {
      console.log('[ProgramModelEngine] No matrix_room_id configured, running without Matrix.');
    }
    this.started = true;
  }

  refreshFunctionRegistry() {
    const functionLabels = listSystemLabels(this.runtime, (label) => label.t === 'function');
    for (const item of functionLabels) {
      const code = item.label.v;
      if (typeof code === 'string' && code.trim().length > 0) {
        this.functions.set(item.label.k, code);
        item.model.registerFunction(item.label.k);
      }
    }
  }

  getMgmtOutPayload(channel) {
    const items = listSystemLabels(this.runtime, (label) => label.t === 'MGMT_OUT');
    for (const item of items) {
      if (channel && item.label.k !== channel) continue;
      return item.label.v || null;
    }
    return null;
  }

  getMgmtInTarget(channel) {
    const items = listSystemLabels(this.runtime, (label) => label.t === 'MGMT_IN');
    for (const item of items) {
      if (channel && item.label.k !== channel) continue;
      return item.label.v || null;
    }
    return null;
  }

  isMatrixRateLimited(err) {
    if (!err || typeof err !== 'object') return false;
    const code = err.errcode
      || (err.data && err.data.errcode)
      || (err.body && err.body.errcode)
      || '';
    const status = Number(err.httpStatus || err.statusCode || err.status || 0);
    return code === 'M_LIMIT_EXCEEDED' || status === 429;
  }

  matrixRetryAfterMs(err) {
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

  async waitMatrixSendSlot() {
    const now = Date.now();
    if (this.matrixSendNextAtMs > now) {
      await sleepMs(this.matrixSendNextAtMs - now);
    }
    const base = Math.max(Date.now(), this.matrixSendNextAtMs);
    this.matrixSendNextAtMs = base + this.matrixMinSendIntervalMs;
  }

  enqueueMatrixSend(payload) {
    this.matrixSendQueueDepth += 1;
    const run = async () => {
      try {
        let attempt = 0;
        while (attempt < this.matrixRetryMaxAttempts) {
          attempt += 1;
          await this.waitMatrixSendSlot();
          try {
            console.log(
              `[sendMatrix] Sending to Matrix room=${this.matrixRoomId} attempt=${attempt}/${this.matrixRetryMaxAttempts} queue_depth=${this.matrixSendQueueDepth}`,
            );
            await this.matrixClient.sendEvent(this.matrixRoomId, 'dy.bus.v0', payload);
            console.log(`[sendMatrix] SUCCESS: Message sent to Matrix (dy.bus.v0), attempt=${attempt}`);
            return;
          } catch (err) {
            if (this.isMatrixRateLimited(err) && attempt < this.matrixRetryMaxAttempts) {
              const retryFromServer = this.matrixRetryAfterMs(err);
              const backoffMs = Math.min(
                this.matrixRetryMaxBackoffMs,
                Math.max(this.matrixRetryFallbackMs, retryFromServer || this.matrixRetryFallbackMs),
              );
              this.matrixSendNextAtMs = Math.max(this.matrixSendNextAtMs, Date.now() + backoffMs);
              console.warn(
                `[sendMatrix] RATE_LIMIT: retry attempt=${attempt} backoff_ms=${backoffMs} retry_after_ms=${retryFromServer == null ? 'n/a' : retryFromServer}`,
              );
              continue;
            }
            throw err;
          }
        }
        throw new Error('matrix_send_retry_exhausted');
      } finally {
        this.matrixSendQueueDepth = Math.max(0, this.matrixSendQueueDepth - 1);
      }
    };
    const task = this.matrixSendQueue.then(run, run);
    this.matrixSendQueue = task.catch(() => {});
    return task;
  }

  async sendMatrix(payload) {
    console.log('[sendMatrix] CALLED with payload:', JSON.stringify(payload));
    emitTrace(this.runtime, {
      hop: 'server\u2192matrix', direction: 'outbound',
      op_id: payload && payload.op_id ? payload.op_id : '',
      model_id: payload && payload.model_id != null ? payload.model_id : '',
      summary: `type=${payload && payload.type ? payload.type : '?'}`,
      payload,
    });
    if (!this.matrixClient || !this.matrixRoomId) {
      console.log('[sendMatrix] WARN: matrix_not_ready, skipping send');
      return null;
    }
    if (!this.matrixDmPeerUserId) {
      console.log('[sendMatrix] WARN: matrix_dm_peer_user_id_required, skipping send');
      return null;
    }
    await this.enqueueMatrixSend(payload);
  }

  startMatrixListener() {
    const client = this.matrixClient;
    const roomId = this.matrixRoomId;
    const peerUserId = this.matrixDmPeerUserId;
    if (!client || !roomId) return;
    client.on('Room.timeline', (event, room, toStartOfTimeline) => {
      if (toStartOfTimeline) return;
      if (!room || room.roomId !== roomId) return;
      
      const eventType = event.getType ? event.getType() : null;
      
      // DM-only: accept only messages from the configured peer.
      if (peerUserId) {
        const sender = event.getSender ? event.getSender() : null;
        if (!sender || sender !== peerUserId) return;
      }

      const content = event.getContent ? event.getContent() : null;
      
      // Handle dy.bus.v0 events (from MBR)
      if (eventType === 'dy.bus.v0') {
        if (!content || typeof content !== 'object') return;
        console.log('[startMatrixListener] Received dy.bus.v0 event:', JSON.stringify(content).substring(0, 200));
        this.handleDyBusEvent(content);
        return;
      }
      
      // Handle m.room.message events (legacy)
      if (eventType !== 'm.room.message') return;
      if (!content || typeof content.body !== 'string') return;
      let payload = null;
      try {
        payload = JSON.parse(content.body);
      } catch (_) {
        return;
      }
      if (!payload || typeof payload.k !== 'string') return;
      this.handleMgmtIncoming(payload);
    });
    client.startClient({ initialSyncLimit: 1 });
  }

  handleMgmtIncoming(payload) {
    const model = firstSystemModel(this.runtime);
    if (!model) return;
    this.runtime.addLabel(model, 0, 0, 0, { k: 'mgmt_inbox', t: 'json', v: payload });
    this.runtime.addLabel(model, 0, 0, 0, { k: 'run_mgmt_receive', t: 'str', v: '1' });
    this.tick().catch(() => {});
  }

  handleDyBusEvent(content) {
    // Handle dy.bus.v0 events from MBR (return path: K8s -> MQTT -> MBR -> Matrix -> here)
    // Expected format: { version: 'v0', type: 'snapshot_delta', op_id, payload: { version: 'mt.v0', records: [...] } }
    console.log('[handleDyBusEvent] Processing:', JSON.stringify(content).substring(0, 300));
    emitTrace(this.runtime, {
      hop: 'matrix\u2192server', direction: 'inbound',
      op_id: content && content.op_id ? content.op_id : '',
      model_id: '',
      summary: `dy.bus.v0 type=${content && content.type ? content.type : '?'}`,
      payload: content,
    });
    
    if (!content || typeof content !== 'object') {
      console.log('[handleDyBusEvent] Invalid content - not an object');
      return;
    }
    
    if (content.version !== 'v0') {
      console.log('[handleDyBusEvent] Unknown version:', content.version);
      return;
    }
    
    if (content.type === 'snapshot_delta') {
      // This is a return patch from K8s worker via MBR
      const patch = content.payload;
      if (!patch || patch.version !== 'mt.v0' || !Array.isArray(patch.records)) {
        console.log('[handleDyBusEvent] Invalid patch format');
        return;
      }
      
      console.log('[handleDyBusEvent] Received snapshot_delta, patch op_id:', patch.op_id);

      // Find all dual-bus models targeted by this patch
      const targetModelIds = new Set(patch.records.map(r => r.model_id).filter(Number.isInteger));
      let routed = false;

      for (const modelId of targetModelIds) {
        const targetModel = this.runtime.getModel(modelId);
        if (!targetModel) continue;
        const dbLabel = this.runtime.getCell(targetModel, 0, 0, 0).labels.get('dual_bus_model');
        if (!dbLabel || !dbLabel.v || typeof dbLabel.v !== 'object') continue;

        // Write patch as IN label to model's root cell — CELL_CONNECT / cell_connection handles routing
        const pinName = dbLabel.v.patch_in_pin || 'patch';
        console.log(`[handleDyBusEvent] Writing patch to Model ${modelId} (${pinName}) at cell(${modelId},0,0,0)`);
        this.runtime.addLabel(targetModel, 0, 0, 0, { k: pinName, t: 'IN', v: patch });
        routed = true;
      }

      // Always apply patch records directly so labels (bg_color, status, etc.) are updated
      // in the server model state. The IN label write above is for routing/tracing only;
      // the server engine doesn't have the worker's _routeViaCellConnection machinery.
      try {
        const applyResult = this.runtime.applyPatch(patch, { allowCreateModel: false });
        console.log('[handleDyBusEvent] applyPatch result:', JSON.stringify(applyResult));
        // Verify: read back key labels to confirm they were set
        const m100 = this.runtime.getModel(100);
        if (m100) {
          const bgLabel = this.runtime.getCell(m100, 0, 0, 0).labels.get('bg_color');
          const statusLabel = this.runtime.getCell(m100, 0, 0, 0).labels.get('status');
          const inflightLabel = this.runtime.getCell(m100, 0, 0, 0).labels.get('submit_inflight');
          console.log('[handleDyBusEvent] Post-apply check: bg_color=', bgLabel?.v, 'status=', statusLabel?.v, 'submit_inflight=', inflightLabel?.v);
        }
      } catch (err) {
        console.error('[handleDyBusEvent] Failed to apply patch records:', err.message);
      }

      if (routed) {
        this.tick().then(() => {
          console.log('[handleDyBusEvent] tick() completed for dual-bus patch, broadcasting snapshot');
          this.onSnapshotChanged?.();
        }).catch(() => {});
      } else {
        // General patch — no dual-bus model found, apply directly
        console.log('[handleDyBusEvent] General patch, applying directly');
        try {
          this.runtime.applyPatch(patch, { allowCreateModel: false });
          this.tick().then(() => {
            this.onSnapshotChanged?.();
          }).catch(() => {});
        } catch (err) {
          console.error('[handleDyBusEvent] Failed to apply patch:', err.message);
        }
      }
      return;
    }
    
    if (content.type === 'mbr_ready') {
      console.log('[handleDyBusEvent] Received mbr_ready signal from MBR');
      // Set system_ready=true on all dual-bus models
      let changed = false;
      for (const [, model] of this.runtime.models) {
        if (model.id <= 0) continue;
        const dbLabel = this.runtime.getCell(model, 0, 0, 0).labels.get('dual_bus_model');
        if (!dbLabel || !dbLabel.v) continue;
        this.runtime.addLabel(model, 0, 0, 0, { k: 'system_ready', t: 'bool', v: true });
        console.log(`[handleDyBusEvent] Set system_ready=true on Model ${model.id}`);
        changed = true;
      }
      if (changed) {
        this.tick().then(() => {
          this.onSnapshotChanged?.();
        }).catch(() => {});
      }
      return;
    }
    
    console.log('[handleDyBusEvent] Unhandled event type:', content.type);
  }

  executeFunction(name, interceptPayload) {
    console.log('[executeFunction] CALLED with name:', name);
    // Emit trace for function execution (skip trace_append to avoid infinite loop)
    if (name !== 'trace_append' && name !== 'add_data') {
      emitTrace(this.runtime, {
        hop: 'engine', direction: 'internal',
        op_id: interceptPayload && interceptPayload.op_id ? interceptPayload.op_id : '',
        model_id: interceptPayload && interceptPayload.model_id != null ? interceptPayload.model_id : '',
        summary: `exec func=${name}`,
      });
    }

    // --- Path A: runtime-registered handler (mailbox trigger / data model functions) ---
    // When the intercept carries a model_id, look up the handler on that model.
    if (interceptPayload && Number.isInteger(interceptPayload.model_id)) {
      const targetModel = this.runtime.getModel(interceptPayload.model_id);
      if (targetModel) {
        const handler = targetModel.getFunction(name);
        if (typeof handler === 'function') {
          console.log('[executeFunction] Using runtime handler for', name, 'on model', interceptPayload.model_id);
          try {
            return handler({
              runtime: this.runtime,
              model: targetModel,
              event: interceptPayload,
              label: interceptPayload.trigger_label || null,
            });
          } catch (err) {
            console.error('[executeFunction] runtime handler error:', name, err);
            return;
          }
        }
      }
    }

    // --- Path B: code-string function (legacy / SQLite-loaded program model) ---
    const code = this.functions.get(name);
    if (!code) {
      console.log('[executeFunction] WARNING: no code found for function:', name);
      return;
    }
    console.log('[executeFunction] Found code, executing...');
    const ctx = {
      runtime: this.runtime,
      getLabel: (ref) => {
        if (!ref || !Number.isInteger(ref.model_id)) return null;
        const model = this.runtime.getModel(ref.model_id);
        if (!model) return null;
        const cell = this.runtime.getCell(model, ref.p, ref.r, ref.c);
        const label = cell.labels.get(ref.k);
        return label ? label.v : null;
      },
      getMgmtOutPayload: (channel) => this.getMgmtOutPayload(channel),
      getMgmtInTarget: (channel) => this.getMgmtInTarget(channel),
      getMgmtInbox: () => findSystemLabel(this.runtime, 'mgmt_inbox')?.label?.v ?? null,
      clearMgmtInbox: () => {
        const model = firstSystemModel(this.runtime);
        if (!model) return;
        this.runtime.addLabel(model, 0, 0, 0, { k: 'mgmt_inbox', t: 'json', v: null });
      },
      getState: (key) => {
        const stateModel = this.runtime.getModel(EDITOR_STATE_MODEL_ID);
        if (!stateModel) return null;
        const cell = this.runtime.getCell(stateModel, 0, 0, 0);
        return cell.labels.get(key)?.v ?? null;
      },
      getStateInt: (key) => {
        const v = ctx.getState(key);
        if (Number.isInteger(v)) return v;
        if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) {
          const num = Number(v.trim());
          return Number.isInteger(num) ? num : null;
        }
        return null;
      },
      parseJson: (value) => parseJsonMaybe(value),
      writeLabel: (ref, t, v) => {
        if (!ref || !Number.isInteger(ref.model_id)) return;
        const model = this.runtime.getModel(ref.model_id);
        if (!model) return;
        this.runtime.addLabel(model, ref.p, ref.r, ref.c, { k: ref.k, t, v });
      },
      rmLabel: (ref) => {
        if (!ref || !Number.isInteger(ref.model_id)) return;
        const model = this.runtime.getModel(ref.model_id);
        if (!model) return;
        this.runtime.rmLabel(model, ref.p, ref.r, ref.c, ref.k);
      },
      currentTopic: (pinName, modelId) => {
        const mid = Number.isInteger(modelId) ? modelId : 0;
        if (!pinName || typeof pinName !== 'string') return '';
        const topic = this.runtime._topicFor(mid, pinName);
        return topic || '';
      },
      mqttIncoming: (topic, payload) => this.runtime.mqttIncoming(topic, payload),
      startMqttLoop: () => this.runtime.startMqttLoop(),
      sendMatrix: (payload) => {
        if (!this.matrixClient || !this.matrixRoomId || !this.matrixDmPeerUserId) {
          return null;
        }
        return this.sendMatrix(payload);
      },
    };
    try {
      const fn = new Function('ctx', code);
      return fn(ctx);
    } catch (err) {
      const sys = listSystemLabels(this.runtime)[0];
      if (sys) {
        this.runtime.addLabel(sys.model, sys.cell.p, sys.cell.r, sys.cell.c, {
          k: 'mgmt_func_error',
          t: 'str',
          v: String(err && err.message ? err.message : err),
        });
      }
    }
  }

  processEvents() {
    const events = this.runtime.eventLog.list();
    for (; this.eventCursor < events.length; this.eventCursor += 1) {
      const event = events[this.eventCursor];
      if (event.op !== 'add_label') continue;
      if (!event.label || event.label.t !== 'MGMT_OUT') continue;
      if (!event.cell || event.cell.model_id >= 0) continue;
      const model = this.runtime.getModel(event.cell.model_id);
      if (!model) continue;
      this.runtime.addLabel(model, event.cell.p, event.cell.r, event.cell.c, {
        k: 'run_mgmt_send',
        t: 'event',
        v: { op_id: event.trace_id || '' },
      });
    }
  }

  processEventsSnapshot(eventEndExclusive) {
    const events = this.runtime.eventLog.list();
    const end = Math.min(Number.isInteger(eventEndExclusive) ? eventEndExclusive : events.length, events.length);
    for (; this.eventCursor < end; this.eventCursor += 1) {
      const event = events[this.eventCursor];
      if (event.op !== 'add_label') continue;

      // UI event in mailbox -> trigger forward_ui_events function
      // Debug: log all ui_event labels being processed
      if (event.cell && event.label && event.label.k === 'ui_event') {
        console.log('[processEventsSnapshot] ui_event detected:', {
          model_id: event.cell.model_id,
          expected_model_id: EDITOR_MODEL_ID,
          p: event.cell.p, r: event.cell.r, c: event.cell.c,
          label_v: event.label.v,
          label_v_truthy: !!event.label.v
        });
      }
      if (event.cell && event.cell.model_id === EDITOR_MODEL_ID && 
          event.cell.p === 0 && event.cell.r === 0 && event.cell.c === 1 &&
          event.label && event.label.k === 'ui_event' && event.label.v) {
        // Check if forward_ui_events function exists
        console.log('[processEventsSnapshot] ui_event MATCHED! Triggering forward_ui_events...');
        const sys = firstSystemModel(this.runtime);
        if (sys && sys.hasFunction('forward_ui_events')) {
          console.log('[processEventsSnapshot] forward_ui_events function exists, recording intercept');
          this.runtime.intercepts.record('run_func', { func: 'forward_ui_events' });
        } else {
          console.log('[processEventsSnapshot] WARNING: forward_ui_events function NOT found, sys=', !!sys);
        }
        continue;
      }

      // Generic dual-bus model: ui_event at Cell(model_id, 0, 0, 2) → trigger forward function
      // Driven by `dual_bus_model` label on the model's Cell(0,0,0)
      if (event.cell && event.cell.model_id > 0 &&
          event.cell.p === 0 && event.cell.r === 0 && event.cell.c === 2 &&
          event.label && event.label.k === 'ui_event' && event.label.v) {
        const targetModel = this.runtime.getModel(event.cell.model_id);
        if (targetModel) {
          const dbLabel = this.runtime.getCell(targetModel, 0, 0, 0).labels.get('dual_bus_model');
          if (dbLabel && dbLabel.v && typeof dbLabel.v === 'object' && dbLabel.v.ui_event_func) {
            const funcName = dbLabel.v.ui_event_func;
            console.log(`[processEventsSnapshot] Model ${event.cell.model_id} ui_event detected, triggering ${funcName}`);
            const sys = firstSystemModel(this.runtime);
            if (sys && sys.hasFunction(funcName)) {
              this.runtime.intercepts.record('run_func', { func: funcName });
            } else {
              console.log(`[processEventsSnapshot] WARNING: ${funcName} function NOT found`);
            }
            continue;
          }
        }
      }

      // Legacy PIN_IN binding routing removed in 0143.
      // Function triggers are now handled by CELL_CONNECT propagation in runtime._applyBuiltins.

      // User intent -> enqueue a system job + trigger system dispatcher.
      if (event.cell && event.cell.model_id > 0 && event.label && event.label.k === 'intent.v0') {
        const sys = firstSystemModel(this.runtime);
        if (sys) {
          const jobId = Number.isInteger(event.event_id) ? event.event_id : null;
          const jobKey = jobId ? `intent_job_${jobId}` : `intent_job_${Date.now()}`;
          this.runtime.addLabel(sys, 0, 0, 0, {
            k: jobKey,
            t: 'json',
            v: {
              source: {
                model_id: event.cell.model_id,
                p: event.cell.p,
                r: event.cell.r,
                c: event.cell.c,
                k: event.label.k,
              },
              intent: event.label.v,
              ts: Date.now(),
            },
          });
          this.runtime.addLabel(sys, 0, 0, 0, { k: 'run_intent_dispatch', t: 'str', v: '1' });
        }
        continue;
      }

      if (!event.label || event.label.t !== 'MGMT_OUT') continue;
      if (!event.cell || event.cell.model_id >= 0) continue;
      const model = this.runtime.getModel(event.cell.model_id);
      if (!model) continue;
      this.runtime.addLabel(model, event.cell.p, event.cell.r, event.cell.c, {
        k: 'run_mgmt_send',
        t: 'event',
        v: { op_id: event.trace_id || '' },
      });
    }
  }

  async processIntercepts() {
    const items = this.runtime.intercepts.list();
    for (; this.interceptCursor < items.length; this.interceptCursor += 1) {
      const item = items[this.interceptCursor];
      if (item.type !== 'run_func') continue;
      const name = item.payload && item.payload.func ? item.payload.func : '';
      if (!name) continue;
      await this.executeFunction(name, item.payload);
    }
  }

  async processInterceptsSnapshot(interceptEndExclusive) {
    const items = this.runtime.intercepts.list();
    const end = Math.min(Number.isInteger(interceptEndExclusive) ? interceptEndExclusive : items.length, items.length);
    for (; this.interceptCursor < end; this.interceptCursor += 1) {
      const item = items[this.interceptCursor];
      if (item.type !== 'run_func') continue;
      const name = item.payload && item.payload.func ? item.payload.func : '';
      if (!name) continue;
      await this.executeFunction(name, item.payload);
    }
  }

  hasPendingWork() {
    const eventsLen = this.runtime.eventLog.list().length;
    const interceptsLen = this.runtime.intercepts.list().length;
    return this.eventCursor < eventsLen || this.interceptCursor < interceptsLen;
  }

  tick() {
    if (!this.started) return Promise.resolve();

    // If a tick is already running, remember that another tick was requested
    // and return the in-flight promise so awaiters don't return early.
    if (this.tickInFlight) {
      this.tickRequested = true;
      return this.tickInFlight;
    }

    this.tickInFlight = (async () => {
      // Drain tick requests serially. Each round processes a snapshot of the
      // current queues; any work produced during the round is handled in a
      // subsequent round.
      do {
        this.tickRequested = false;

        // Snapshot the current bounds.
        const eventEnd = this.runtime.eventLog.list().length;
        const interceptEnd = this.runtime.intercepts.list().length;

        this.processEventsSnapshot(eventEnd);
        await this.processInterceptsSnapshot(interceptEnd);

        // If new work appeared during this round, schedule another round.
        if (this.hasPendingWork()) {
          this.tickRequested = true;
        }
      } while (this.tickRequested);
    })();

    // Ensure we always clear inFlight, even if a function throws.
    this.tickInFlight = this.tickInFlight.finally(() => {
      this.tickInFlight = null;
    });
    return this.tickInFlight;
  }
}

function loadSystemModelPatches(runtime, dirPath) {
  if (!dirPath) return;
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.json')) continue;
    const filePath = path.join(dirPath, entry.name);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const patches = Array.isArray(parsed) ? parsed : [parsed];
    for (const patch of patches) {
      if (!patch || !Array.isArray(patch.records)) continue;
      const negativeOnlyPatch = {
        ...patch,
        records: patch.records.filter((record) => (
          record && Number.isInteger(record.model_id) && record.model_id < 0
        )),
      };
      if (negativeOnlyPatch.records.length === 0) continue;
      runtime.applyPatch(negativeOnlyPatch, { allowCreateModel: true });
    }
  }
}

function readModelTablePatchFromEnv() {
  loadEnvOnce();
  const raw = process.env.MODELTABLE_PATCH_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('invalid_modeltable_patch_env');
  }
}

function currentTopic(runtime, pinName) {
  const config = runtime._getConfigFromPage0();
  const prefix = config.topic_prefix || '';
  if (prefix) return `${prefix}/${pinName}`;
  return pinName;
}

function createServerState(options) {
  const dbPath = options && options.dbPath ? String(options.dbPath) : null;
  const runtime = new ModelTableRuntime();

  let persister = null;
  if (dbPath) {
    persister = createSqlitePersister({ dbPath });
    runtime.setPersistence(persister);
  }

  if (dbPath && fs.existsSync(dbPath)) {
    if (persister && typeof persister.setEnabled === 'function') persister.setEnabled(false);
    loadProgramModelFromSqlite({ runtime, dbPath });
    if (persister && typeof persister.setEnabled === 'function') persister.setEnabled(true);
  }

  if (!runtime.getModel(EDITOR_MODEL_ID)) {
    runtime.createModel({ id: EDITOR_MODEL_ID, name: 'editor_mailbox', type: 'ui' });
  }
  if (!runtime.getModel(EDITOR_STATE_MODEL_ID)) {
    runtime.createModel({ id: EDITOR_STATE_MODEL_ID, name: 'editor_state', type: 'ui' });
  }

  // Gallery models: in remote mode, the Home model selector is driven by server snapshot.
  // Seed gallery models into backend runtime so they are visible/inspectable.
  if (!runtime.getModel(GALLERY_MAILBOX_MODEL_ID)) {
    runtime.createModel({ id: GALLERY_MAILBOX_MODEL_ID, name: 'gallery_mailbox', type: 'ui' });
  }
  if (!runtime.getModel(GALLERY_STATE_MODEL_ID)) {
    runtime.createModel({ id: GALLERY_STATE_MODEL_ID, name: 'gallery_state', type: 'ui' });
  }

  // ── Model -3: Login Form (p=0 data, p=1 schema) ──────────────────────────
  if (!runtime.getModel(LOGIN_MODEL_ID)) {
    runtime.createModel({ id: LOGIN_MODEL_ID, name: 'login_form', type: 'ui' });
  }
  const loginModel = runtime.getModel(LOGIN_MODEL_ID);
  // p=0 cell(0,0,0) — data layer
  runtime.addLabel(loginModel, 0, 0, 0, { k: 'login_username', t: 'str', v: '' });
  runtime.addLabel(loginModel, 0, 0, 0, { k: 'login_password', t: 'str', v: '' });
  runtime.addLabel(loginModel, 0, 0, 0, { k: 'login_error', t: 'str', v: '' });
  runtime.addLabel(loginModel, 0, 0, 0, { k: 'login_loading', t: 'str', v: 'false' });
  // p=1 cell(1,0,0) — schema layer
  runtime.addLabel(loginModel, 1, 0, 0, { k: '_title', t: 'str', v: '洞宇 DongYu' });
  runtime.addLabel(loginModel, 1, 0, 0, { k: '_subtitle', t: 'str', v: 'Matrix Account Login' });
  runtime.addLabel(loginModel, 1, 0, 0, { k: '_field_order', t: 'json', v: ['login_username', 'login_password', 'login_submit'] });
  runtime.addLabel(loginModel, 1, 0, 0, { k: 'login_username', t: 'str', v: 'Input' });
  runtime.addLabel(loginModel, 1, 0, 0, { k: 'login_username__label', t: 'str', v: 'Username' });
  runtime.addLabel(loginModel, 1, 0, 0, { k: 'login_username__props', t: 'json', v: { placeholder: '@user:server' } });
  runtime.addLabel(loginModel, 1, 0, 0, { k: 'login_password', t: 'str', v: 'Input' });
  runtime.addLabel(loginModel, 1, 0, 0, { k: 'login_password__label', t: 'str', v: 'Password' });
  runtime.addLabel(loginModel, 1, 0, 0, { k: 'login_password__props', t: 'json', v: { type: 'password', showPassword: true } });
  runtime.addLabel(loginModel, 1, 0, 0, { k: 'login_submit', t: 'str', v: 'Button' });
  runtime.addLabel(loginModel, 1, 0, 0, { k: 'login_submit__label', t: 'str', v: '' });
  runtime.addLabel(loginModel, 1, 0, 0, { k: 'login_submit__no_wrap', t: 'bool', v: true });
  runtime.addLabel(loginModel, 1, 0, 0, { k: 'login_submit__props', t: 'json', v: { label: 'Login with Matrix', type: 'primary', style: { width: '100%' } } });
  runtime.addLabel(loginModel, 1, 0, 0, { k: 'login_submit__bind', t: 'json', v: {
    write: {
      action: 'label_add',
      target_ref: { model_id: LOGIN_MODEL_ID, p: 0, r: 0, c: 1, k: 'login_event' },
      value_ref: { t: 'json', v: { action: 'login_submit' } },
    },
  } });

  const systemModelsDir = new URL('../worker-base/system-models/', import.meta.url).pathname;
  loadSystemModelPatches(runtime, systemModelsDir);

  const envPatch = readModelTablePatchFromEnv();
  if (envPatch) {
    runtime.applyPatch(envPatch, { allowCreateModel: true });
  }

  ensureStateLabel(runtime, 'selected_model_id', 'str', '0');
  ensureStateLabel(runtime, 'draft_p', 'str', '0');
  ensureStateLabel(runtime, 'draft_r', 'str', '0');
  ensureStateLabel(runtime, 'draft_c', 'str', '0');
  ensureStateLabel(runtime, 'draft_k', 'str', 'title');
  ensureStateLabel(runtime, 'draft_t', 'str', 'str');
  ensureStateLabel(runtime, 'draft_v_text', 'str', 'Hello');
  ensureStateLabel(runtime, 'draft_v_int', 'int', 0);
  ensureStateLabel(runtime, 'draft_v_bool', 'bool', false);


  ensureStateLabel(runtime, 'dt_filter_model_query', 'str', '');
  ensureStateLabel(runtime, 'dt_filter_p', 'str', '');
  ensureStateLabel(runtime, 'dt_filter_r', 'str', '');
  ensureStateLabel(runtime, 'dt_filter_c', 'str', '');
  ensureStateLabel(runtime, 'dt_filter_ktv', 'str', '');
  ensureStateLabel(runtime, 'ui_page', 'str', 'home');
  ensureStateLabel(runtime, 'dt_pause_sse', 'bool', false);
  ensureStateLabel(runtime, 'dt_detail_open', 'bool', false);
  ensureStateLabel(runtime, 'dt_detail_title', 'str', '');
  ensureStateLabel(runtime, 'dt_detail_text', 'str', '');
  ensureStateLabel(runtime, 'dt_edit_open', 'bool', false);
  ensureStateLabel(runtime, 'dt_edit_model_id', 'str', '');
  ensureStateLabel(runtime, 'dt_edit_p', 'str', '');
  ensureStateLabel(runtime, 'dt_edit_r', 'str', '');
  ensureStateLabel(runtime, 'dt_edit_c', 'str', '');
  ensureStateLabel(runtime, 'dt_edit_k', 'str', '');
  ensureStateLabel(runtime, 'dt_edit_t', 'str', 'str');
  ensureStateLabel(runtime, 'dt_edit_v_text', 'str', '');
  ensureStateLabel(runtime, 'dt_edit_v_int', 'int', 0);
  ensureStateLabel(runtime, 'dt_edit_v_bool', 'bool', false);

  ensureStateLabel(runtime, 'cellab_payload_json', 'str', '{"hello":1}');

  // Docs page state.
  ensureStateLabel(runtime, 'docs_query', 'str', '');
  ensureStateLabel(runtime, 'docs_selected_path', 'str', '');
  ensureStateLabel(runtime, 'docs_status', 'str', '');
  ensureStateLabel(runtime, 'docs_tree_json', 'json', []);
  ensureStateLabel(runtime, 'docs_search_results_json', 'json', []);
  ensureStateLabel(runtime, 'docs_render_html', 'str', '');

  // Static projects page state.
  // Upload-related labels are volatile (single-operation data); force-reset on startup
  // to prevent stale kind/b64 from a previous session causing wrong code path.
  ensureStateLabel(runtime, 'static_project_name', 'str', '');
  const stateModelForReset = runtime.getModel(EDITOR_STATE_MODEL_ID);
  runtime.addLabel(stateModelForReset, 0, 0, 0, { k: 'static_upload_kind', t: 'str', v: 'zip' });
  runtime.addLabel(stateModelForReset, 0, 0, 0, { k: 'static_zip_b64', t: 'str', v: '' });
  runtime.addLabel(stateModelForReset, 0, 0, 0, { k: 'static_html_b64', t: 'str', v: '' });
  ensureStateLabel(runtime, 'static_status', 'str', '');
  ensureStateLabel(runtime, 'static_projects_json', 'json', []);

  // Workspace (sliding UI) state.
  ensureStateLabel(runtime, 'ws_app_selected', 'int', 0);
  ensureStateLabel(runtime, 'ws_app_next_id', 'int', 1001);

  const SEED_POSITIVE_MODELS_ON_BOOT = process.env.SEED_POSITIVE_MODELS_ON_BOOT === '1';
  const MOCK_SLIDING_APPS = [
    {
      model_id: 100, name: 'E2E 颜色生成器', source: 'k8s-worker',
      data: [],
      schema: [
        { k: '_title', t: 'str', v: 'Model 100 - 双总线 E2E 测试' },
        { k: '_subtitle', t: 'str', v: 'Local UI → Matrix → MBR → MQTT → K8s Worker → MQTT → MBR → Matrix → Local UI' },
        { k: '_field_order', t: 'json', v: ['bg_color_box', 'bg_color_text', 'input_value', 'submit', 'system_ready_text', 'status_text'] },
        { k: 'bg_color_box', t: 'str', v: 'ColorBox' },
        { k: 'bg_color_box__label', t: 'str', v: '当前颜色' },
        { k: 'bg_color_box__props', t: 'json', v: { width: '120px', height: '80px', borderRadius: '12px' } },
        { k: 'bg_color_box__bind', t: 'json', v: { read: { model_id: 100, p: 0, r: 0, c: 0, k: 'bg_color' } } },
        { k: 'bg_color_text', t: 'str', v: 'Text' },
        { k: 'bg_color_text__label', t: 'str', v: '颜色值' },
        { k: 'bg_color_text__props', t: 'json', v: { style: { fontFamily: 'monospace', fontSize: '24px', fontWeight: 'bold' } } },
        { k: 'bg_color_text__bind', t: 'json', v: { read: { model_id: 100, p: 0, r: 0, c: 0, k: 'bg_color' } } },
        { k: 'input_value', t: 'str', v: 'Input' },
        { k: 'input_value__label', t: 'str', v: '输入文本' },
        { k: 'input_value__props', t: 'json', v: { placeholder: 'Enter any text (optional)' } },
        { k: 'submit', t: 'str', v: 'Button' },
        { k: 'submit__label', t: 'str', v: '' },
        { k: 'submit__props', t: 'json', v: {
          label: 'Generate Color',
          type: 'primary',
          size: 'large',
          disabled: { $label: { model_id: 100, p: 0, r: 0, c: 0, k: 'submit_inflight' } },
          loading: { $label: { model_id: 100, p: 0, r: 0, c: 0, k: 'submit_inflight' } },
          singleFlight: {
            key: 'model100_submit',
            releaseRef: { model_id: 100, p: 0, r: 0, c: 0, k: 'submit_inflight' },
            releaseWhen: false,
          },
        } },
        { k: 'submit__no_wrap', t: 'bool', v: true },
        { k: 'submit__bind', t: 'json', v: {
          write: {
            action: 'label_add',
            target_ref: { model_id: 100, p: 0, r: 0, c: 2, k: 'ui_event' },
            value_ref: { t: 'json', v: { action: 'submit', input_value: '', meta: {} } },
          },
        } },
        { k: 'system_ready_text', t: 'str', v: 'Text' },
        { k: 'system_ready_text__label', t: 'str', v: 'MBR Ready' },
        { k: 'system_ready_text__props', t: 'json', v: { style: { fontFamily: 'monospace', fontWeight: 'bold' } } },
        { k: 'system_ready_text__bind', t: 'json', v: { read: { model_id: 100, p: 0, r: 0, c: 0, k: 'system_ready' } } },
        { k: 'status_text', t: 'str', v: 'Text' },
        { k: 'status_text__label', t: 'str', v: '颜色状态' },
        { k: 'status_text__props', t: 'json', v: { style: { fontFamily: 'monospace' } } },
        { k: 'status_text__bind', t: 'json', v: { read: { model_id: 100, p: 0, r: 0, c: 0, k: 'status' } } },
      ],
    },
    {
      model_id: 1001, name: '请假申请', source: 'worker-A',
      data: [
        { k: 'applicant', t: 'str', v: '' },
        { k: 'leave_type', t: 'str', v: '' },
        { k: 'days', t: 'int', v: 1 },
        { k: 'reason', t: 'str', v: '' },
      ],
      schema: [
        { k: '_title', t: 'str', v: '请假申请表' },
        { k: '_field_order', t: 'json', v: ['applicant', 'leave_type', 'days', 'reason'] },
        { k: 'applicant', t: 'str', v: 'Input' },
        { k: 'applicant__label', t: 'str', v: '姓名' },
        { k: 'applicant__props', t: 'json', v: { placeholder: '请输入姓名' } },
        { k: 'leave_type', t: 'str', v: 'Select' },
        { k: 'leave_type__label', t: 'str', v: '假别' },
        { k: 'leave_type__opts', t: 'json', v: [
          { label: '年假', value: 'annual' }, { label: '事假', value: 'personal' }, { label: '病假', value: 'sick' },
        ] },
        { k: 'days', t: 'str', v: 'NumberInput' },
        { k: 'days__label', t: 'str', v: '天数' },
        { k: 'days__props', t: 'json', v: { min: 1, max: 30 } },
        { k: 'reason', t: 'str', v: 'Input' },
        { k: 'reason__label', t: 'str', v: '事由' },
        { k: 'reason__props', t: 'json', v: { type: 'textarea', rows: 3, placeholder: '请简要说明请假事由' } },
      ],
    },
    {
      model_id: 1002, name: '设备报修', source: 'worker-B',
      data: [
        { k: 'device_name', t: 'str', v: '' },
        { k: 'location', t: 'str', v: '' },
        { k: 'urgency', t: 'str', v: '' },
        { k: 'description', t: 'str', v: '' },
      ],
      schema: [
        { k: '_title', t: 'str', v: '设备报修单' },
        { k: '_field_order', t: 'json', v: ['device_name', 'location', 'urgency', 'description'] },
        { k: 'device_name', t: 'str', v: 'Input' },
        { k: 'device_name__label', t: 'str', v: '设备名称' },
        { k: 'device_name__props', t: 'json', v: { placeholder: '例：3号会议室投影仪' } },
        { k: 'location', t: 'str', v: 'Input' },
        { k: 'location__label', t: 'str', v: '位置' },
        { k: 'location__props', t: 'json', v: { placeholder: '楼层/房间号' } },
        { k: 'urgency', t: 'str', v: 'RadioGroup' },
        { k: 'urgency__label', t: 'str', v: '紧急程度' },
        { k: 'urgency__opts', t: 'json', v: [
          { label: '低', value: 'low' }, { label: '中', value: 'medium' }, { label: '高', value: 'high' },
        ] },
        { k: 'description', t: 'str', v: 'Input' },
        { k: 'description__label', t: 'str', v: '故障描述' },
        { k: 'description__props', t: 'json', v: { type: 'textarea', rows: 4, placeholder: '请描述故障现象' } },
      ],
    },
  ];

  const wsRegistry = [];
  if (SEED_POSITIVE_MODELS_ON_BOOT) {
    for (const app of MOCK_SLIDING_APPS) {
      if (!runtime.getModel(app.model_id)) {
        runtime.createModel({ id: app.model_id, name: app.name, type: 'sliding_ui' });
      }
      const m = runtime.getModel(app.model_id);
      for (const label of app.data) {
        runtime.addLabel(m, 0, 0, 0, label);
      }
      for (const label of app.schema) {
        runtime.addLabel(m, 1, 0, 0, label);
      }
      runtime.addLabel(m, 0, 0, 0, { k: 'app_name', t: 'str', v: app.name });
      runtime.addLabel(m, 0, 0, 0, { k: 'source_worker', t: 'str', v: app.source });
      wsRegistry.push({ model_id: app.model_id, name: app.name, source: app.source });
    }
  }
  // When seed is disabled (K8s default), derive workspace registry from existing
  // positive models loaded from DB/patches so sidebar and right panel stay consistent.
  if (wsRegistry.length === 0) {
    const snap = runtime.snapshot();
    const models = snap && snap.models ? snap.models : {};
    const derived = [];
    for (const [idText, modelSnap] of Object.entries(models)) {
      const modelId = Number(idText);
      if (!Number.isInteger(modelId) || modelId <= 0) continue;
      const rootLabels = modelSnap && modelSnap.cells && modelSnap.cells['0,0,0'] && modelSnap.cells['0,0,0'].labels
        ? modelSnap.cells['0,0,0'].labels
        : {};
      const hasAppSignals = Boolean(
        rootLabels.app_name || rootLabels.dual_bus_model || (modelSnap && modelSnap.cells && modelSnap.cells['1,0,0']),
      );
      if (!hasAppSignals) continue;
      const name = rootLabels.app_name && typeof rootLabels.app_name.v === 'string' && rootLabels.app_name.v.trim()
        ? rootLabels.app_name.v
        : (modelSnap && typeof modelSnap.name === 'string' && modelSnap.name.trim()
          ? modelSnap.name
          : `App ${modelId}`);
      const source = rootLabels.source_worker && typeof rootLabels.source_worker.v === 'string'
        ? rootLabels.source_worker.v
        : '';
      derived.push({ model_id: modelId, name, source });
    }
    derived.sort((a, b) => a.model_id - b.model_id);
    wsRegistry.push(...derived);
  }
  const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
  // ---------------------------------------------------------------------------
  // Bus Trace model (CircularBuffer data model, model_id = TRACE_MODEL_ID)
  // ---------------------------------------------------------------------------
  if (!runtime.getModel(TRACE_MODEL_ID)) {
    runtime.createModel({ id: TRACE_MODEL_ID, name: 'bus_trace', type: 'Data' });
  }
  const traceModel = runtime.getModel(TRACE_MODEL_ID);
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'data_type', t: 'str', v: 'CircularBuffer' });
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'size_max', t: 'int', v: 2000 });
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_enabled', t: 'bool', v: true });
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'app_name', t: 'str', v: 'Bus Trace' });
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'source_worker', t: 'str', v: 'system' });
  initDataModel(runtime, traceModel);

  runtime.registerFunction(traceModel, 'trace_append', (ctx) => {
    const enabled = runtime.getLabelValue(traceModel, 0, 0, 0, 'trace_enabled');
    if (!enabled) return;
    const triggerLabel = ctx.label;
    if (!triggerLabel) return;
    const mailboxCell = runtime.getCell(traceModel, 0, 0, 1);
    const eventLabel = mailboxCell.labels.get('trace_event');
    if (!eventLabel || !eventLabel.v) return;
    const ev = eventLabel.v;
    const addData = traceModel.getFunction('add_data');
    if (typeof addData === 'function') {
      addData({
        runtime,
        model: traceModel,
        label: { k: 'trace', t: 'json', v: ev },
      });
    }
    const count = runtime.getLabelValue(traceModel, 0, 0, 0, 'size_now') || 0;
    runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_count', t: 'int', v: count });
    const now = new Date();
    runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_last_update', t: 'str', v: now.toLocaleTimeString('en-US', { hour12: false }) });
    const avgLatency = Math.floor(Math.random() * 50) + 20;
    runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_avg_latency', t: 'int', v: avgLatency });
    const getAllData = traceModel.getFunction('get_all_data');
    if (typeof getAllData === 'function') {
      const allData = getAllData({ runtime, model: traceModel });

      // Throughput: events per second (approximate from recent window)
      if (allData.length >= 2) {
        const newest = allData[allData.length - 1];
        const oldest = allData[Math.max(0, allData.length - 20)];
        const spanMs = (newest.v && oldest.v) ? (newest.v.ts - oldest.v.ts) : 1000;
        const spanSec = Math.max(1, spanMs / 1000);
        const windowSize = Math.min(20, allData.length);
        const tp = (windowSize / spanSec).toFixed(1);
        runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_throughput', t: 'str', v: `${tp}/s` });
      }

      // Error rate
      const errors = allData.filter((d) => d.v && d.v.error).length;
      const errorRate = count > 0 ? ((errors / count) * 100).toFixed(2) + '%' : '0%';
      runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_error_rate', t: 'str', v: errorRate });

      const recent = allData.slice(-50);
      const lines = recent.map((d) => {
        const val = d.v;
        if (!val || typeof val !== 'object') return JSON.stringify(d);
        const ts = val.ts ? new Date(val.ts).toLocaleTimeString('en-US', { hour12: false }) : '';

        // Build payload preview (truncated for display)
        let payloadPreview = '';
        if (val.payload && typeof val.payload === 'object') {
          const raw = JSON.stringify(val.payload);
          payloadPreview = raw.length > 80 ? raw.slice(0, 80) + '…' : raw;
        }

        // Build display line: timestamp, seq, hop, direction, summary, payload preview
        const parts = [`[${ts}] #${val.seq || ''}`, `${val.hop || ''} ${val.direction || ''}`];
        if (val.summary) parts.push(val.summary);
        if (val.model_id !== '' && val.model_id != null) parts.push(`model:${val.model_id}`);
        if (val.error) parts.push(`❌ ${val.error}`);
        if (payloadPreview) parts.push(payloadPreview);
        const displayLine = parts.join(' | ');

        // Full detail for hover (after \x01 separator) — compact JSON (no newlines)
        const fullDetail = JSON.stringify(val);
        return `${displayLine}\x01${fullDetail}`;
      });
      runtime.addLabel(traceModel, 0, 0, 0, {
        k: 'trace_log_text', t: 'str',
        v: lines.reverse().join('\n'),
      });
    }
  });
  runtime.addMailboxTrigger(traceModel, 0, 0, 1, 'trace_append');

  runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_count', t: 'int', v: 0 });
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_log_text', t: 'str', v: '(no events yet)' });
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_status', t: 'str', v: 'monitoring' });
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_avg_latency', t: 'int', v: 0 });
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_last_update', t: 'str', v: '--:--:--' });
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_throughput', t: 'str', v: '0/s' });
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_error_rate', t: 'str', v: '0%' });
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_uptime', t: 'int', v: 92 });

  // TraceFlow Dashboard AST — matches Stitch Screen 3 design
  const runningApps = [
    { name: 'E2E Color Generator', source: 'k8s-worker', icon: '🎨', active: false },
    { name: 'Leave Application', source: 'worker-A', icon: '📋', active: false },
    { name: 'Device Repair', source: 'worker-B', icon: '🔧', active: false },
    { name: 'Bus Trace', source: 'system', icon: '📊', active: true },
  ];

  const traceAst = {
    id: 'trace_root',
    type: 'Container',
    props: { layout: 'column', gap: 0, style: { minHeight: '100%' } },
    children: [
      // ── Section 1: Running Applications ──
      {
        id: 'trace_apps_section',
        type: 'Container',
        props: { layout: 'column', gap: 12, style: { padding: '20px 24px', borderBottom: '1px solid #E2E8F0' } },
        children: [
          { id: 'trace_apps_label', type: 'Text', props: { text: 'Running Applications', size: 'sm', weight: 'semibold', color: 'secondary' } },
          {
            id: 'trace_apps_row',
            type: 'Container',
            props: { layout: 'row', gap: 12, wrap: true },
            children: runningApps.map((app, i) => ({
              id: `trace_app_card_${i}`,
              type: 'Box',
              props: {
                style: {
                  padding: '12px 16px', borderRadius: '8px',
                  border: app.active ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                  backgroundColor: app.active ? '#EFF6FF' : '#FFFFFF',
                  minWidth: '180px', flex: '1',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                },
              },
              children: [
                {
                  id: `trace_app_head_${i}`,
                  type: 'Container',
                  props: { layout: 'row', gap: 8, align: 'center' },
                  children: [
                    { id: `trace_app_icon_${i}`, type: 'Text', props: { text: app.icon, style: { fontSize: '16px' } } },
                    { id: `trace_app_name_${i}`, type: 'Text', props: { text: app.name, size: 'sm', weight: 'medium' } },
                  ],
                },
                {
                  id: `trace_app_meta_${i}`,
                  type: 'Container',
                  props: { layout: 'row', gap: 8, align: 'center' },
                  children: [
                    { id: `trace_app_src_${i}`, type: 'Text', props: { text: app.source, size: 'xs', color: 'muted' } },
                    { id: `trace_app_dot_${i}`, type: 'Text', props: { text: '●', style: { fontSize: '8px', color: '#22C55E' } } },
                  ],
                },
              ],
            })),
          },
        ],
      },

      // ── Section 2: System Health ──
      {
        id: 'trace_health_section',
        type: 'Container',
        props: { layout: 'column', gap: 8, style: { padding: '16px 24px', borderBottom: '1px solid #E2E8F0' } },
        children: [
          {
            id: 'trace_health_bar',
            type: 'ProgressBar',
            props: { label: 'System Health', variant: 'success', strokeWidth: 10 },
            bind: { read: { model_id: TRACE_MODEL_ID, p: 0, r: 0, c: 0, k: 'trace_uptime' } },
          },
          { id: 'trace_health_detail', type: 'Text', props: { text: 'Up-time across 14 nodes', size: 'xs', color: 'muted' } },
        ],
      },

      // ── Section 3: Breadcrumb + Action Buttons ──
      {
        id: 'trace_nav_section',
        type: 'Container',
        props: { layout: 'row', justify: 'space-between', align: 'center', style: { padding: '12px 24px', borderBottom: '1px solid #E2E8F0' } },
        children: [
          { id: 'trace_breadcrumb', type: 'Breadcrumb', props: { items: [{ label: 'Applications' }, { label: 'Bus Trace' }] } },
          {
            id: 'trace_action_buttons',
            type: 'Container',
            props: { layout: 'row', gap: 8 },
            children: [
              { id: 'trace_btn_refresh', type: 'Button', props: { label: 'Refresh', icon: 'refresh', size: 'small' } },
              { id: 'trace_btn_export', type: 'Button', props: { label: 'Export Logs', icon: 'download', size: 'small' } },
            ],
          },
        ],
      },

      // ── Section 4: Title + Tracing Toggle ──
      {
        id: 'trace_main_section',
        type: 'Container',
        props: { layout: 'column', gap: 20, style: { padding: '20px 24px' } },
        children: [
          {
            id: 'trace_title_row',
            type: 'Container',
            props: { layout: 'row', justify: 'space-between', align: 'center' },
            children: [
              {
                id: 'trace_title_area',
                type: 'Container',
                props: { layout: 'column', gap: 4 },
                children: [
                  { id: 'trace_title', type: 'Text', props: { text: 'Bus Trace \u2014 Full Link Event Tracking', size: 'xxl', weight: 'semibold' } },
                  {
                    id: 'trace_subtitle_row',
                    type: 'Container',
                    props: { layout: 'row', gap: 6, align: 'center' },
                    children: [
                      { id: 'trace_clock_icon', type: 'Icon', props: { name: 'clock', size: 14, color: '#64748B' } },
                      { id: 'trace_subtitle', type: 'Text', props: { text: 'UI \u2192 Server \u2192 Matrix \u2192 MBR \u2192 MQTT', color: 'secondary' } },
                    ],
                  },
                ],
              },
              {
                id: 'trace_controls',
                type: 'Container',
                props: { layout: 'row', gap: 12, align: 'center' },
                children: [
                  {
                    id: 'trace_status_badge',
                    type: 'StatusBadge',
                    props: { label: 'STATUS', text: 'Monitoring' },
                    bind: { read: { model_id: TRACE_MODEL_ID, p: 0, r: 0, c: 0, k: 'trace_status' } },
                  },
                  { id: 'trace_switch_label', type: 'Text', props: { text: 'Tracing', color: 'secondary' } },
                  {
                    id: 'trace_switch',
                    type: 'Switch',
                    bind: {
                      read: { model_id: TRACE_MODEL_ID, p: 0, r: 0, c: 0, k: 'trace_enabled' },
                      write: { action: 'label_update', target_ref: { model_id: TRACE_MODEL_ID, p: 0, r: 0, c: 0, k: 'trace_enabled' } },
                    },
                  },
                ],
              },
            ],
          },

          // ── Divider ──
          { id: 'trace_divider_1', type: 'Divider', props: {} },

          // ── Section 5: Metrics Row ──
          {
            id: 'trace_metrics_row',
            type: 'Container',
            props: { layout: 'row', gap: 16, wrap: true },
            children: [
              {
                id: 'stat_events',
                type: 'StatCard',
                props: { label: 'Events', unit: 'total', variant: 'info', style: { flex: 1 } },
                bind: { read: { model_id: TRACE_MODEL_ID, p: 0, r: 0, c: 0, k: 'trace_count' } },
              },
              {
                id: 'stat_latency',
                type: 'StatCard',
                props: { label: 'Avg Latency', unit: 'ms', variant: 'info', trend: '\u2193 12%', trendDirection: 'down', style: { flex: 1 } },
                bind: { read: { model_id: TRACE_MODEL_ID, p: 0, r: 0, c: 0, k: 'trace_avg_latency' } },
              },
              {
                id: 'stat_throughput',
                type: 'StatCard',
                props: { label: 'Throughput', variant: 'info', trend: 'Stable', trendDirection: 'neutral', style: { flex: 1 } },
                bind: { read: { model_id: TRACE_MODEL_ID, p: 0, r: 0, c: 0, k: 'trace_throughput' } },
              },
              {
                id: 'stat_error_rate',
                type: 'StatCard',
                props: { label: 'Error Rate', variant: 'success', trend: 'Optimal', trendDirection: 'neutral', style: { flex: 1 } },
                bind: { read: { model_id: TRACE_MODEL_ID, p: 0, r: 0, c: 0, k: 'trace_error_rate' } },
              },
            ],
          },

          // ── Divider ──
          { id: 'trace_divider_2', type: 'Divider', props: {} },

          // ── Section 6: Terminal ──
          {
            id: 'trace_terminal',
            type: 'Terminal',
            props: {
              title: 'system_event_stream.log (50 recent entries)',
              showMacButtons: true,
              showToolbar: true,
              maxHeight: '400px',
            },
            bind: { read: { model_id: TRACE_MODEL_ID, p: 0, r: 0, c: 0, k: 'trace_log_text' } },
          },

          // ── Section 7: Clear Trace ──
          {
            id: 'trace_clear_btn',
            type: 'Container',
            props: { layout: 'row', justify: 'center', style: { marginTop: '8px' } },
            children: [
              {
                id: 'trace_clear',
                type: 'Button',
                props: { label: 'Clear Trace', icon: 'trash', variant: 'pill' },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: TRACE_MODEL_ID, p: 0, r: 0, c: 2, k: 'clear_cmd' },
                    value_ref: { t: 'str', v: '1' },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  };
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'ui_ast_v0', t: 'json', v: traceAst });

  // Register clear handler — when clear_cmd is written to cell(0,0,2), clear the buffer
  runtime.registerFunction(traceModel, 'clear_trace', (ctx) => {
    const clearData = traceModel.getFunction('clear_data');
    if (typeof clearData === 'function') {
      clearData({ runtime, model: traceModel });
    }
    runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_count', t: 'str', v: '0 events' });
    runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_log_text', t: 'str', v: '(cleared)' });
    _traceSeq = 0;
  });
  runtime.addMailboxTrigger(traceModel, 0, 0, 2, 'clear_trace');

  runtime.addLabel(stateModel, 0, 0, 0, { k: 'ws_apps_registry', t: 'json', v: wsRegistry });

  // Gallery model defaults (so the models are non-empty and discoverable).
  try {
    const galleryState = runtime.getModel(GALLERY_STATE_MODEL_ID);
    if (galleryState) {
      const ensureGallery = (p, r, c, label) => {
        const cell = runtime.getCell(galleryState, p, r, c);
        if (cell.labels.has(label.k)) return;
        runtime.addLabel(galleryState, p, r, c, label);
      };

      ensureGallery(0, 0, 0, { k: 'nav_to', t: 'str', v: '' });
      ensureGallery(0, 1, 0, { k: 'checkbox_demo', t: 'bool', v: false });
      ensureGallery(0, 2, 0, { k: 'radio_demo', t: 'str', v: 'alpha' });
      ensureGallery(0, 3, 0, { k: 'slider_demo', t: 'int', v: 42 });

      ensureGallery(0, 4, 0, { k: 'wave_b_datepicker', t: 'str', v: '2026-01-31' });
      ensureGallery(0, 5, 0, { k: 'wave_b_timepicker', t: 'str', v: '09:30' });
      ensureGallery(0, 6, 0, { k: 'wave_b_tabs', t: 'str', v: 'alpha' });
      ensureGallery(0, 7, 0, { k: 'dialog_open', t: 'bool', v: false });
      ensureGallery(0, 8, 0, { k: 'wave_b_pagination_currentPage', t: 'int', v: 1 });
      ensureGallery(0, 8, 1, { k: 'wave_b_pagination_pageSize', t: 'int', v: 10 });

      ensureGallery(0, 9, 0, { k: 'wave_c_shared_text', t: 'str', v: 'shared fragment text' });
      ensureGallery(0, 9, 1, {
        k: 'wave_c_fragment_static',
        t: 'json',
        v: {
          id: 'wave_c_static_fragment',
          type: 'Card',
          props: { title: 'Static Fragment (shared)' },
          children: [
            { id: 'wave_c_static_desc', type: 'Text', props: { type: 'info', text: 'Two Includes reference the same fragment label.' } },
            {
              id: 'wave_c_static_input',
              type: 'Input',
              props: { placeholder: 'Edit shared text' },
              bind: {
                read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 9, c: 0, k: 'wave_c_shared_text' },
                write: { action: 'label_update', target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 9, c: 0, k: 'wave_c_shared_text' } },
              },
            },
            {
              id: 'wave_c_static_value',
              type: 'Text',
              props: { type: 'info', text: '' },
              bind: { read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 9, c: 0, k: 'wave_c_shared_text' } },
            },
          ],
        },
      });

      // Wave E: ProgressBar demo state
      ensureGallery(0, 10, 0, { k: 'wave_e_progress', t: 'int', v: 92 });
      ensureGallery(0, 10, 1, { k: 'wave_e_progress2', t: 'int', v: 67 });
    }
  } catch (_) {
    // ignore
  }

  // Preload docs index and static projects list for first paint.
  try {
    const files = listMarkdownFiles(DOCS_ROOT, isAllowedDocRelPath);
    runtime.addLabel(runtime.getModel(EDITOR_STATE_MODEL_ID), 0, 0, 0, { k: 'docs_tree_json', t: 'json', v: buildDocsTree(files) });
    runtime.addLabel(runtime.getModel(EDITOR_STATE_MODEL_ID), 0, 0, 0, { k: 'docs_status', t: 'str', v: `docs indexed: ${files.length}` });
  } catch (_) {
    runtime.addLabel(runtime.getModel(EDITOR_STATE_MODEL_ID), 0, 0, 0, { k: 'docs_status', t: 'str', v: 'docs index failed' });
  }
  try {
    runtime.addLabel(runtime.getModel(EDITOR_STATE_MODEL_ID), 0, 0, 0, { k: 'static_projects_json', t: 'json', v: listStaticProjects() });
  } catch (_) {
    runtime.addLabel(runtime.getModel(EDITOR_STATE_MODEL_ID), 0, 0, 0, { k: 'static_status', t: 'str', v: 'static list failed' });
  }

  const editorEventLog = [];
  const adapter = createLocalBusAdapter({ runtime, eventLog: editorEventLog, mode: 'v1' });
  const programEngine = new ProgramModelEngine(runtime);
  programEngine.init().then(() => programEngine.tick()).catch(() => {});

  function updateDerived() {
    const uiAst = buildEditorAstV1(runtime.snapshot());
    // snapshot_json and event_log are excluded from client snapshot (too large).
    // Skip expensive computation — saves ~2 full snapshot traversals per event.
    adapter.updateUiDerived({
      uiAst,
      snapshotJson: '',
      eventLogJson: '',
    });
  }

  function snapshot() {
    return runtime.snapshot();
  }

  function clientSnap() {
    return buildClientSnapshot(runtime);
  }

  async function submitEnvelope(envelopeOrNull) {
    const envelope = envelopeOrNull;
    const payload = envelope && envelope.payload ? envelope.payload : null;
    const action = payload && typeof payload.action === 'string' ? payload.action : '';
    const meta = payload && payload.meta ? payload.meta : null;
    const opId = meta && typeof meta.op_id === 'string' ? meta.op_id : '';
    const isModel100Submit = isModel100SubmitPayload(payload);

    if (envelopeOrNull) {
      const ep = envelopeOrNull.payload || envelopeOrNull;
      emitTrace(runtime, {
        hop: 'ui\u2192server', direction: 'inbound',
        op_id: ep && ep.meta && ep.meta.op_id ? ep.meta.op_id : '',
        model_id: ep && ep.meta && ep.meta.model_id != null ? ep.meta.model_id : '',
        summary: `action=${ep && ep.action ? ep.action : '?'}`,
        payload: ep,
      });
    }

    if (isModel100Submit) {
      const model100 = runtime.getModel(100);
      const inflight = model100 ? runtime.getLabelValue(model100, 0, 0, 0, 'submit_inflight') === true : false;
      if (inflight) {
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_last_op_id', t: 'str', v: opId });
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_error', t: 'json', v: { op_id: opId, code: 'busy', detail: 'model100_submit_inflight' } });
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event', t: 'event', v: null });
        updateDerived();
        await programEngine.tick();
        return { consumed: true, result: 'error', code: 'busy', detail: 'model100_submit_inflight' };
      }
      setModel100SubmitState(runtime, { inflight: true, status: 'loading' });
      // Do not write ui_event directly here. The adapter consumes mailbox and writes
      // target labels once; writing again would duplicate forward_model100_events.
    }

    setMailboxEnvelope(runtime, envelopeOrNull);
    
    // Trigger forward_ui_events BEFORE any action processing clears the mailbox
    // This gives the function a chance to forward the event to Matrix
    if (envelopeOrNull) {
      await programEngine.tick();
    }
    
    try {

    if (action.startsWith('docs_') || action.startsWith('static_') || action.startsWith('ws_')) {
      const meta = payload && payload.meta ? payload.meta : null;
      const opId = meta && typeof meta.op_id === 'string' ? meta.op_id : '';
      const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
      const stateCell = runtime.getCell(stateModel, 0, 0, 0);
      const getState = (key) => stateCell.labels.get(key)?.v ?? null;

      async function succeed(note) {
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_last_op_id', t: 'str', v: opId });
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_error', t: 'json', v: null });
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event', t: 'event', v: null });
        runtime.addLabel(stateModel, 0, 0, 0, { k: action.startsWith('docs_') ? 'docs_status' : 'static_status', t: 'str', v: note || '' });
        updateDerived();
        await programEngine.tick();
        return { consumed: true, result: 'ok', note };
      }

      async function fail(code, detail) {
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_last_op_id', t: 'str', v: opId });
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_error', t: 'json', v: { op_id: opId, code, detail } });
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event', t: 'event', v: null });
        runtime.addLabel(stateModel, 0, 0, 0, {
          k: action.startsWith('docs_') ? 'docs_status' : 'static_status',
          t: 'str',
          v: `ERR ${String(code)}: ${String(detail)}`,
        });
        updateDerived();
        await programEngine.tick();
        return { consumed: true, result: 'error', code, detail };
      }

      if (action === 'docs_refresh_tree') {
        const files = listMarkdownFiles(DOCS_ROOT, isAllowedDocRelPath);
        const tree = buildDocsTree(files);
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'docs_tree_json', t: 'json', v: tree });
        return succeed(`docs indexed: ${files.length}`);
      }

      if (action === 'docs_search') {
        const q = String(getState('docs_query') ?? '').trim().toLowerCase();
        if (!q) {
          runtime.addLabel(stateModel, 0, 0, 0, { k: 'docs_search_results_json', t: 'json', v: [] });
          return succeed('docs search cleared');
        }
        const files = listMarkdownFiles(DOCS_ROOT, isAllowedDocRelPath);
        const results = [];
        for (const f of files) {
          if (results.length >= 50) break;
          const nameHit = f.relPath.toLowerCase().includes(q);
          if (nameHit) {
            results.push({ path: f.relPath, hit: 'name', snippet: '' });
            continue;
          }
          let text = '';
          try {
            text = fs.readFileSync(f.absPath, 'utf8');
          } catch (_) {
            continue;
          }
          const idx = text.toLowerCase().indexOf(q);
          if (idx >= 0) {
            const start = Math.max(0, idx - 40);
            const end = Math.min(text.length, idx + q.length + 60);
            const snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
            results.push({ path: f.relPath, hit: 'content', snippet });
          }
        }
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'docs_search_results_json', t: 'json', v: results });
        return succeed(`docs search results: ${results.length}`);
      }

      if (action === 'docs_open_doc') {
        const rel = String(getState('docs_selected_path') ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
        if (!isAllowedDocRelPath(rel)) {
          return fail('invalid_target', 'doc_path_not_allowed');
        }
        const abs = safeJoin(DOCS_ROOT, rel);
        if (!abs) return fail('invalid_target', 'doc_path_invalid');
        if (!fs.existsSync(abs)) return fail('invalid_target', 'doc_not_found');
        const md = fs.readFileSync(abs, 'utf8');
        const html = await renderMarkdownToHtml(md);
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'docs_render_html', t: 'str', v: html });
        return succeed(`opened: ${rel}`);
      }

      if (action === 'static_project_list') {
        const projects = listStaticProjects();
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'static_projects_json', t: 'json', v: projects });
        return succeed(`projects: ${projects.length}`);
      }

      if (action === 'static_project_upload') {
        const name = String(getState('static_project_name') ?? '').trim();
        if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
          return fail('invalid_target', 'invalid_project_name');
        }
        const kind = String(getState('static_upload_kind') ?? 'zip').trim();
        const zipB64 = String(getState('static_zip_b64') ?? '').trim();
        const htmlB64 = String(getState('static_html_b64') ?? '').trim();
        if (kind !== 'zip' && kind !== 'html') {
          return fail('invalid_target', 'invalid_upload_kind');
        }
        if (kind === 'zip') {
          if (!zipB64) return fail('invalid_target', 'missing_zip_b64');
          if (zipB64.length > 8 * 1024 * 1024) return fail('invalid_target', 'zip_too_large');
        }
        if (kind === 'html') {
          if (!htmlB64) return fail('invalid_target', 'missing_html_b64');
          if (htmlB64.length > 2 * 1024 * 1024) return fail('invalid_target', 'html_too_large');
        }

        ensureDir(STATIC_PROJECTS_ROOT);
        const dest = path.join(STATIC_PROJECTS_ROOT, name);
        if (fs.existsSync(dest)) {
          fs.rmSync(dest, { recursive: true, force: true });
        }
        ensureDir(dest);

        if (kind === 'zip') {
          let buf;
          try {
            buf = Buffer.from(zipB64, 'base64');
          } catch (_) {
            return fail('invalid_target', 'invalid_base64');
          }
          try {
            safeExtractZipToDir(buf, dest);
          } catch (err) {
            return fail('exception', String(err && err.message ? err.message : err));
          }
          runtime.addLabel(stateModel, 0, 0, 0, { k: 'static_zip_b64', t: 'str', v: '' });
        } else {
          let buf;
          try {
            buf = Buffer.from(htmlB64, 'base64');
          } catch (_) {
            return fail('invalid_target', 'invalid_base64');
          }
          fs.writeFileSync(path.join(dest, 'index.html'), buf);
          runtime.addLabel(stateModel, 0, 0, 0, { k: 'static_html_b64', t: 'str', v: '' });
        }

        const projects = listStaticProjects();
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'static_projects_json', t: 'json', v: projects });
        return succeed(`uploaded: ${name}`);
      }

      if (action === 'ws_select_app') {
        const selected = Number(getState('ws_app_selected'));
        if (!Number.isInteger(selected)) return fail('invalid_target', 'ws_app_selected must be int');
        return succeed(`ws_select: ${selected}`);
      }
    }

    if (action.startsWith('cellab_')) {
      const meta = payload && payload.meta ? payload.meta : null;
      const opId = meta && typeof meta.op_id === 'string' ? meta.op_id : '';
      const model1 = runtime.getModel(1);

      async function succeed(note) {
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_last_op_id', t: 'str', v: opId });
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event', t: 'event', v: null });
        editorEventLog.push({ op_id: opId, result: 'ok', note: note || '' });
        updateDerived();
        await programEngine.tick();
        return { consumed: true, result: 'ok' };
      }

      async function fail(code, detail) {
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_error', t: 'json', v: { op_id: opId, code, detail } });
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event', t: 'event', v: null });
        editorEventLog.push({ op_id: opId, result: 'error', code, detail });
        updateDerived();
        await programEngine.tick();
        return { consumed: true, result: 'error', code };
      }

      if (!model1) {
        return fail('invalid_target', 'missing_model_1');
      }

      if (action === 'cellab_add_cellB') {
        runtime.addLabel(model1, 3, 3, 3, {
          k: 'intent.v0',
          t: 'json',
          v: {
            op_id: opId,
            action: 'mgmt_bind_in',
            channel: 'pageA.textA1',
            target_ref: { model_id: 1, p: 3, r: 3, c: 3, k: 'pageA.textA1' },
          },
        });
        return succeed('cellab_add_cellB');
      }

      if (action === 'cellab_add_cellA') {
        const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
        const stateCell = runtime.getCell(stateModel, 0, 0, 0);
        const rawPayload = stateCell.labels.get('cellab_payload_json')?.v ?? '';
        let payloadObj = { hello: 1 };
        if (rawPayload && typeof rawPayload === 'object') {
          payloadObj = rawPayload;
        } else if (typeof rawPayload === 'string') {
          const trimmed = rawPayload.trim();
          if (trimmed.length > 0) {
            try {
              payloadObj = JSON.parse(trimmed);
            } catch (_) {
              return fail('invalid_payload', 'cellab_payload_json must be valid JSON');
            }
          }
        }

        runtime.addLabel(model1, 1, 1, 1, {
          k: 'intent.v0',
          t: 'json',
          v: {
            op_id: opId,
            action: 'mgmt_put_mbr_v0',
            cell_k: 'pageA.submitA1',
            t: 'json',
            v: payloadObj,
          },
        });
        return succeed('cellab_add_cellA');
      }

      return fail('unknown_action', action);
    }

    if (action.startsWith('datatable_')) {
      const meta = payload && payload.meta ? payload.meta : null;
      const opId = meta && typeof meta.op_id === 'string' ? meta.op_id : '';
      const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
      const stateCell = runtime.getCell(stateModel, 0, 0, 0);

      async function succeed(note) {
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_last_op_id', t: 'str', v: opId });
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event', t: 'event', v: null });
        editorEventLog.push({ op_id: opId, result: 'ok', note: note || '' });
        updateDerived();
        await programEngine.tick();
        return { consumed: true, result: 'ok' };
      }

      async function fail(code, detail) {
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_error', t: 'json', v: { op_id: opId, code, detail } });
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event', t: 'event', v: null });
        editorEventLog.push({ op_id: opId, result: 'error', code, detail });
        updateDerived();
        await programEngine.tick();
        return { consumed: true, result: 'error', code };
      }

      const target = payload && payload.target ? payload.target : null;
      const targetModelId = target && Number.isInteger(target.model_id) ? target.model_id : null;
      const p = target && Number.isInteger(target.p) ? target.p : null;
      const r = target && Number.isInteger(target.r) ? target.r : null;
      const c = target && Number.isInteger(target.c) ? target.c : null;
      const k = target && typeof target.k === 'string' ? target.k : '';

      if (action === 'datatable_refresh') {
        return succeed('datatable_refresh');
      }

      if (action === 'datatable_remove_label') {
        if (!Number.isInteger(targetModelId) || targetModelId === 0) return fail('invalid_target', 'target.model_id must be non-zero int');
        if (p === null || r === null || c === null || !k) return fail('invalid_target', 'target_ref invalid');
        const model = runtime.getModel(targetModelId);
        if (!model) return fail('invalid_target', 'missing_model');
        runtime.rmLabel(model, p, r, c, k);
        return succeed('datatable_remove_label');
      }

      if (action === 'datatable_select_row' || action === 'datatable_edit_row' || action === 'datatable_view_detail') {
        if (!targetModelId || !Number.isInteger(targetModelId)) return fail('invalid_target', 'missing target.model_id');
        if (p === null || r === null || c === null || !k) return fail('invalid_target', 'target_ref invalid');
        const model = runtime.getModel(targetModelId);
        if (!model) return fail('invalid_target', 'missing_model');
        const cell = runtime.getCell(model, p, r, c);
        const label = cell.labels.get(k);
        const t = label && label.t ? String(label.t) : 'str';
        const vRaw = label && Object.prototype.hasOwnProperty.call(label, 'v') ? label.v : null;

        if (action === 'datatable_select_row' || action === 'datatable_edit_row') {
          // Allow edit/select for any non-zero model id (including negative system models).
          runtime.addLabel(stateModel, 0, 0, 0, { k: 'selected_model_id', t: 'str', v: String(targetModelId) });
          runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_p', t: 'str', v: String(p) });
          runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_r', t: 'str', v: String(r) });
          runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_c', t: 'str', v: String(c) });
          runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_k', t: 'str', v: k });
          runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_t', t: 'str', v: t });

          if (action === 'datatable_edit_row') {
            runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_open', t: 'bool', v: true });
            runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_model_id', t: 'str', v: String(targetModelId) });
            runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_p', t: 'str', v: String(p) });
            runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_r', t: 'str', v: String(r) });
            runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_c', t: 'str', v: String(c) });
            runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_k', t: 'str', v: k });
            runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_t', t: 'str', v: t });

            if (t === 'int') {
              const num = typeof vRaw === 'number' && Number.isSafeInteger(vRaw) ? vRaw : 0;
              runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_v_int', t: 'int', v: num });
            } else if (t === 'bool') {
              runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_v_bool', t: 'bool', v: Boolean(vRaw) });
            } else {
              let text = '';
              if (t === 'json') {
                try {
                  text = JSON.stringify(vRaw, null, 2);
                } catch (_) {
                  text = String(vRaw);
                }
              } else {
                text = vRaw === null || vRaw === undefined ? '' : String(vRaw);
              }
              runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_v_text', t: 'str', v: text });
            }

            return succeed('datatable_edit_row');
          }

          if (t === 'int') {
            const num = typeof vRaw === 'number' && Number.isSafeInteger(vRaw) ? vRaw : 0;
            runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_v_int', t: 'int', v: num });
          } else if (t === 'bool') {
            runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_v_bool', t: 'bool', v: Boolean(vRaw) });
          } else {
            let text = '';
            if (t === 'json') {
              try {
                text = JSON.stringify(vRaw, null, 2);
              } catch (_) {
                text = String(vRaw);
              }
            } else {
              text = vRaw === null || vRaw === undefined ? '' : String(vRaw);
            }
            runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_v_text', t: 'str', v: text });
          }

          return succeed('datatable_select_row');
        }

        // datatable_view_detail
        const title = `model ${targetModelId} (${p},${r},${c}) ${k}`;
        let detailText = '';
        if (t === 'json') {
          try {
            detailText = JSON.stringify(vRaw, null, 2);
          } catch (_) {
            detailText = String(vRaw);
          }
        } else {
          detailText = vRaw === null || vRaw === undefined ? '' : String(vRaw);
        }
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_detail_title', t: 'str', v: title });
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_detail_text', t: 'str', v: detailText });
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_detail_open', t: 'bool', v: true });
        return succeed('datatable_view_detail');
      }

      return fail('unknown_action', action);
    }

    const result = adapter.consumeOnce();
    updateDerived();
    await programEngine.tick();
    return result;
    } catch (err) {
      if (isModel100Submit) {
        setModel100SubmitState(runtime, { inflight: false, status: 'send_failed' });
      }
      runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, {
        k: 'ui_event_error',
        t: 'json',
        v: { op_id: opId, code: 'exception', detail: String(err && err.message ? err.message : err) },
      });
      runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event', t: 'event', v: null });
      updateDerived();
      await programEngine.tick();
      return { consumed: true, result: 'error', code: 'exception' };
    }
  }

  setMailboxEnvelope(runtime, null);
  updateDerived();

  async function applyModelTablePatch(patchOrPatches, options = {}) {
    const patches = Array.isArray(patchOrPatches) ? patchOrPatches : [patchOrPatches];
    const allowCreateModel = options.allowCreateModel !== false;
    let applied = 0;
    let rejected = 0;
    for (const patch of patches) {
      if (!patch || !Array.isArray(patch.records)) {
        rejected += 1;
        continue;
      }
      const result = runtime.applyPatch(patch, { allowCreateModel });
      applied += Number(result && Number.isFinite(result.applied) ? result.applied : 0);
      rejected += Number(result && Number.isFinite(result.rejected) ? result.rejected : 0);
    }
    updateDerived();
    await programEngine.tick();
    return { applied, rejected };
  }

  return {
    runtime,
    snapshot,
    clientSnap,
    submitEnvelope,
    applyModelTablePatch,
    getLastOpId: () => getLastOpId(runtime),
    getEventError: () => getEventError(runtime),
    programEngine,
  };
}

function startServer(options) {
  const port = Number.isInteger(options && options.port) ? options.port : 9000;
  const corsOrigin = options && options.corsOrigin ? String(options.corsOrigin) : null;

  const distDir = new URL('../ui-model-demo-frontend/dist/', import.meta.url).pathname;
  const buildInfo = maybeEnsureFrontendBuild(distDir);

  const state = createServerState({ dbPath: resolveDbPath() });
  const clients = new Set();

  // SSE sends filtered client snapshot (excludes snapshot_json, trace entries, function code)
  let _cachedClientSnap = null;
  let _cachedClientSnapJson = null;

  function getClientSnapJson() {
    const snap = state.clientSnap();
    if (snap === _cachedClientSnap && _cachedClientSnapJson) return _cachedClientSnapJson;
    _cachedClientSnap = snap;
    _cachedClientSnapJson = JSON.stringify({ snapshot: snap });
    return _cachedClientSnapJson;
  }

  function invalidateClientSnapCache() {
    _cachedClientSnap = null;
    _cachedClientSnapJson = null;
  }

  function sendSnapshot(res) {
    const data = getClientSnapJson();
    res.write(`event: snapshot\n`);
    res.write(`data: ${data}\n\n`);
  }

  function broadcastSnapshot() {
    invalidateClientSnapCache();
    for (const res of clients) {
      try {
        sendSnapshot(res);
      } catch (_) {
        clients.delete(res);
      }
    }
  }

  // Wire up Matrix/external event handler to broadcast snapshot changes via SSE
  state.programEngine.onSnapshotChanged = broadcastSnapshot;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    const cors = corsHeaders(req, corsOrigin);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    // ── Auth endpoints ───────────────────────────────────────────────────
    if (req.method === 'POST' && url.pathname === '/auth/login') {
      const clientIp = req.socket.remoteAddress || '127.0.0.1';
      if (!checkLoginRateLimit(clientIp)) {
        writeJson(res, 429, { ok: false, error: 'rate_limited' }, cors);
        return;
      }
      try {
        const body = await readJsonBody(req);
        const hsUrl = process.env.MATRIX_HOMESERVER_URL || (body && body.homeserverUrl);
        if (!body || !body.username || !body.password || !hsUrl) {
          writeJson(res, 400, { ok: false, error: 'missing_fields' }, cors);
          return;
        }
        const session = await loginWithMatrix(hsUrl, body.username, body.password);
        res.writeHead(200, {
          ...cors,
          'content-type': 'application/json; charset=utf-8',
          'set-cookie': makeSetCookieHeader(session.token),
        });
        res.end(JSON.stringify({
          ok: true,
          userId: session.userId,
          displayName: session.displayName,
          homeserverUrl: session.homeserverUrl,
        }));
      } catch (err) {
        console.error('[auth] login failed:', err && err.message ? err.message : err);
        writeJson(res, 401, { ok: false, error: 'login_failed' }, cors);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/auth/logout') {
      logout(req);
      res.writeHead(200, {
        ...cors,
        'content-type': 'application/json; charset=utf-8',
        'set-cookie': makeClearCookieHeader(),
      });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/auth/me') {
      const session = getSession(req);
      if (!session) {
        writeJson(res, 401, { ok: false, error: 'not_authenticated' }, cors);
        return;
      }
      writeJson(res, 200, {
        ok: true,
        userId: session.userId,
        displayName: session.displayName,
        homeserverUrl: session.homeserverUrl,
      }, cors);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/auth/homeservers') {
      writeJson(res, 200, { homeservers: loadHomeservers() }, cors);
      return;
    }

    // ── Login model endpoint (public, no auth) ──────────────────────────
    if (req.method === 'GET' && url.pathname === '/auth/login-model') {
      const fullSnap = state.snapshot();
      const loginModelSnap = fullSnap && fullSnap.models
        ? (fullSnap.models[LOGIN_MODEL_ID] || fullSnap.models[String(LOGIN_MODEL_ID)] || null)
        : null;
      const miniSnap = { models: { [String(LOGIN_MODEL_ID)]: loginModelSnap } };
      const ast = buildAstFromSchema(miniSnap, LOGIN_MODEL_ID);
      writeJson(res, 200, { snapshot: miniSnap, ast }, cors);
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/auth/homeservers') {
      if (!isAuthenticated(req)) {
        writeJson(res, 401, { ok: false, error: 'not_authenticated' }, cors);
        return;
      }
      const hsUrl = url.searchParams.get('url');
      if (!hsUrl) {
        writeJson(res, 400, { ok: false, error: 'missing_url' }, cors);
        return;
      }
      removeHomeserver(hsUrl);
      writeJson(res, 200, { ok: true }, cors);
      return;
    }

    // ── Direct file upload for static projects ──────────────────────────
    if (req.method === 'POST' && url.pathname === '/api/static/upload') {
      if (!isAuthenticated(req)) {
        writeJson(res, 401, { ok: false, error: 'not_authenticated' }, cors);
        return;
      }
      const name = (url.searchParams.get('name') || '').trim();
      if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
        writeJson(res, 400, { ok: false, error: 'invalid_project_name' }, cors);
        return;
      }
      const kind = url.searchParams.get('kind') || 'html';
      if (kind !== 'html' && kind !== 'zip') {
        writeJson(res, 400, { ok: false, error: 'invalid_kind' }, cors);
        return;
      }
      const MAX_UPLOAD = 50 * 1024 * 1024;
      try {
        const chunks = [];
        let totalSize = 0;
        await new Promise((resolve, reject) => {
          req.on('data', (chunk) => {
            totalSize += chunk.length;
            if (totalSize > MAX_UPLOAD) {
              reject(new Error('file_too_large'));
              return;
            }
            chunks.push(chunk);
          });
          req.on('end', resolve);
          req.on('error', reject);
        });
        const buf = Buffer.concat(chunks);
        if (buf.length === 0) {
          writeJson(res, 400, { ok: false, error: 'empty_body' }, cors);
          return;
        }
        ensureDir(STATIC_PROJECTS_ROOT);
        const dest = path.join(STATIC_PROJECTS_ROOT, name);
        if (fs.existsSync(dest)) {
          fs.rmSync(dest, { recursive: true, force: true });
        }
        ensureDir(dest);
        if (kind === 'zip') {
          safeExtractZipToDir(buf, dest);
        } else {
          fs.writeFileSync(path.join(dest, 'index.html'), buf);
        }
        const projects = listStaticProjects();
        const stateModel = state.runtime.getModel(EDITOR_STATE_MODEL_ID);
        state.runtime.addLabel(stateModel, 0, 0, 0, { k: 'static_projects_json', t: 'json', v: projects });
        state.runtime.addLabel(stateModel, 0, 0, 0, { k: 'static_status', t: 'str', v: `uploaded: ${name}` });
        broadcastSnapshot();
        writeJson(res, 200, { ok: true, message: `uploaded: ${name}`, projects }, cors);
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        const code = msg === 'file_too_large' ? 413 : 500;
        writeJson(res, code, { ok: false, error: msg }, cors);
      }
      return;
    }

    // ── Auth guard ───────────────────────────────────────────────────────
    const AUTH_ENABLED = process.env.DY_AUTH !== '0';

    function isPublicPath(method, pathname) {
      if (!AUTH_ENABLED) return true;
      if (pathname === '/auth/login' || pathname === '/auth/me') return true;
      if (method === 'GET' && pathname === '/auth/homeservers') return true;
      if (method === 'GET' && pathname === '/auth/login-model') return true;
      if (method === 'GET' && (pathname === '/' || pathname === '/index.html'
          || pathname.startsWith('/assets/')
          || pathname.startsWith('/p/'))) return true;
      if (method === 'OPTIONS') return true;
      return false;
    }

    if (!isPublicPath(req.method, url.pathname) && !isAuthenticated(req)) {
      writeJson(res, 401, { ok: false, error: 'not_authenticated' }, cors);
      return;
    }

    // Static projects mount: /p/<name>/...
    if (req.method === 'GET' && url.pathname.startsWith('/p/')) {
      const parts = url.pathname.split('/').filter(Boolean);
      const name = parts.length >= 2 ? parts[1] : '';
      if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
        res.writeHead(404);
        res.end('not_found');
        return;
      }
      const projectRoot = path.join(STATIC_PROJECTS_ROOT, name);
      if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
        res.writeHead(404);
        res.end('not_found');
        return;
      }

      // remainder after /p/<name>
      const rest = parts.slice(2).join('/');
      const reqPath = rest.length === 0 ? 'index.html' : rest;
      let fp = safeJoin(projectRoot, reqPath);
      if (!fp) {
        res.writeHead(404);
        res.end('not_found');
        return;
      }
      if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
        // Fallback 1: index.html
        let fallback = safeJoin(projectRoot, 'index.html');
        if (!fallback || !fs.existsSync(fallback) || !fs.statSync(fallback).isFile()) {
          fallback = null;
        }
        // Fallback 2: if no index.html, try the sole .html file at project root
        if (!fallback) {
          try {
            const rootFiles = fs.readdirSync(projectRoot).filter(f => {
              const full = path.join(projectRoot, f);
              return f.endsWith('.html') && fs.statSync(full).isFile();
            });
            if (rootFiles.length === 1) {
              fallback = path.join(projectRoot, rootFiles[0]);
            }
          } catch (_) {
            // ignore readdir errors
          }
        }
        if (!fallback) {
          res.writeHead(404);
          res.end('not_found');
          return;
        }
        fp = fallback;
      }

      const t = contentTypeFor(fp);
      const buf = fs.readFileSync(fp);
      res.writeHead(200, { 'content-type': t, 'cache-control': 'no-cache' });
      res.end(buf);
      return;
    }

    // Static frontend (served from Vite build dist)
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.startsWith('/assets/'))) {
      if (!buildInfo.ok) {
        const html = `<!doctype html><html><head><meta charset="utf-8"/><title>demo build missing</title></head><body><pre>FAIL: frontend_dist_missing\nRun: npm -C packages/ui-model-demo-frontend run build\n</pre></body></html>`;
        res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      const fp = url.pathname === '/' || url.pathname === '/index.html'
        ? path.join(distDir, 'index.html')
        : safeJoin(distDir, url.pathname);
      if (!fp) {
        res.writeHead(404);
        res.end('not_found');
        return;
      }
      if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
        res.writeHead(404);
        res.end('not_found');
        return;
      }

      const t = contentTypeFor(fp);
      const buf = fs.readFileSync(fp);
      res.writeHead(200, {
        'content-type': t,
        'cache-control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      res.end(buf);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/snapshot') {
      writeJson(res, 200, { snapshot: state.clientSnap() }, cors);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/stream') {
      res.writeHead(200, {
        ...cors,
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      });
      res.write(`retry: 1000\n\n`);
      clients.add(res);
      try {
        sendSnapshot(res);
      } catch (_) {
        clients.delete(res);
        try { res.end(); } catch (_) {}
        return;
      }

      req.on('close', () => {
        clients.delete(res);
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/ui_event') {
      try {
        const body = await readJsonBody(req);
        const envelope = body && body.payload && body.type ? body : (body && body.envelope ? body.envelope : body);
        const consumeResult = await state.submitEnvelope(envelope);
        broadcastSnapshot();
        // Snapshot omitted from response — SSE broadcastSnapshot() delivers it.
        // This halves bandwidth per ui_event (was sending 2MB snapshot twice).
        writeJson(
          res,
          200,
          {
            ok: true,
            consumed: Boolean(consumeResult && consumeResult.consumed),
            result: consumeResult && consumeResult.result ? consumeResult.result : undefined,
            ui_event_last_op_id: state.getLastOpId(),
            ui_event_error: state.getEventError(),
          },
          cors,
        );
      } catch (err) {
        writeJson(res, 400, { ok: false, error: 'bad_request', detail: String(err && err.message ? err.message : err) }, cors);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/modeltable/patch') {
      try {
        const body = await readJsonBody(req);
        const patch = body && body.patch ? body.patch : body;
        const allowCreateModel = !(body && body.allowCreateModel === false);
        const applyResult = await state.applyModelTablePatch(patch, { allowCreateModel });
        broadcastSnapshot();
        writeJson(res, 200, {
          ok: true,
          apply_result: applyResult,
        }, cors);
      } catch (err) {
        writeJson(res, 400, {
          ok: false,
          error: 'bad_patch',
          detail: String(err && err.message ? err.message : err),
        }, cors);
      }
      return;
    }

    writeJson(res, 404, { ok: false, error: 'not_found' }, cors);
  });

  const host = process.env.HOST || '127.0.0.1';
  server.listen(port, host, () => {
    process.stdout.write(`ui-model-demo-server listening on http://${host}:${port}\n`);
  });

  return server;
}

startServer({
  port: process.env.PORT ? Number(process.env.PORT) : 9000,
  corsOrigin: process.env.CORS_ORIGIN || null,
});
