import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
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
import { buildEditorAstV1 } from '../ui-model-demo-frontend/src/demo_modeltable.js';
import { GALLERY_MAILBOX_MODEL_ID, GALLERY_STATE_MODEL_ID } from '../ui-model-demo-frontend/src/model_ids.js';

const require = createRequire(import.meta.url);
const { loadProgramModelFromSqlite } = require('../worker-base/src/program_model_loader.js');
const { createSqlitePersister } = require('../worker-base/src/modeltable_persistence_sqlite.js');
const sdk = require('matrix-js-sdk');

const EDITOR_MODEL_ID = -1;
const EDITOR_STATE_MODEL_ID = -2;

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
  // Docs UI MUST only expose docs/user-guide/**
  return rel.startsWith('user-guide/');
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

function resolveDbPath() {
  const workspace = process.env.WORKER_BASE_WORKSPACE || 'default';
  return path.resolve(process.cwd(), 'data', workspace, 'yhl.db');
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

async function createMatrixClient() {
  loadEnvOnce();
  // Must be set before any HTTPS request to skip self-signed cert validation
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  const homeserverUrl = process.env.MATRIX_HOMESERVER_URL;
  if (!homeserverUrl) {
    throw new Error('missing_matrix_homeserver_url');
  }
  const token = process.env.MATRIX_MBR_ACCESS_TOKEN;
  if (token) {
    const userId = process.env.MATRIX_MBR_USER || null;
    return sdk.createClient({ baseUrl: homeserverUrl, accessToken: token, userId });
  }
  const user = process.env.MATRIX_MBR_USER;
  const password = process.env.MATRIX_MBR_PASSWORD;
  if (!user || !password) {
    throw new Error('missing_matrix_credentials');
  }
  const tmp = sdk.createClient({ baseUrl: homeserverUrl });
  const res = await tmp.login('m.login.password', {
    identifier: { type: 'm.id.user', user },
    password,
  });
  return sdk.createClient({ baseUrl: homeserverUrl, accessToken: res.access_token, userId: res.user_id });
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
  }

  async init() {
    this.refreshFunctionRegistry();
    const roomLabel = findSystemLabel(this.runtime, 'matrix_room_id');
    this.matrixRoomId = roomLabel ? String(roomLabel.label.v || '') : '';
    const peerLabel = findSystemLabel(this.runtime, 'matrix_dm_peer_user_id');
    this.matrixDmPeerUserId = peerLabel ? String(peerLabel.label.v || '') : '';
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

  async sendMatrix(payload) {
    console.log('[sendMatrix] CALLED with payload:', JSON.stringify(payload));
    if (!this.matrixClient || !this.matrixRoomId) {
      console.log('[sendMatrix] ERROR: matrix_not_ready');
      throw new Error('matrix_not_ready');
    }
    if (!this.matrixDmPeerUserId) {
      console.log('[sendMatrix] ERROR: matrix_dm_peer_user_id_required');
      throw new Error('matrix_dm_peer_user_id_required');
    }
    console.log('[sendMatrix] Sending to Matrix room:', this.matrixRoomId);
    // Use dy.bus.v0 event type for MBR worker compatibility
    await this.matrixClient.sendEvent(this.matrixRoomId, 'dy.bus.v0', payload);
    console.log('[sendMatrix] SUCCESS: Message sent to Matrix (dy.bus.v0)');
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
      
      // Check if any record targets Model 100
      const hasModel100 = patch.records.some(r => r.model_id === 100);
      
      if (hasModel100) {
        // Write to Model 100 PIN_IN (patch_in) at Cell (0,1,1) with type 'IN'
        // This will trigger on_model100_patch_in function via processEventsSnapshot
        const model100 = this.runtime.getModel(100);
        if (model100) {
          console.log('[handleDyBusEvent] Writing patch to Model 100 PIN_IN (patch_in)');
          this.runtime.addLabel(model100, 0, 1, 1, { k: 'patch_in', t: 'IN', v: patch });
          this.tick().then(() => {
            console.log('[handleDyBusEvent] tick() completed for Model 100 patch, broadcasting snapshot');
            this.onSnapshotChanged?.();
          }).catch(() => {});
        } else {
          console.log('[handleDyBusEvent] Model 100 not found, cannot write PIN_IN');
        }
      } else {
        // General patch - apply directly or route to appropriate handler
        console.log('[handleDyBusEvent] General patch (not Model 100), applying directly');
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
      const model100 = this.runtime.getModel(100);
      if (model100) {
        this.runtime.addLabel(model100, 0, 0, 0, { k: 'system_ready', t: 'bool', v: true });
        console.log('[handleDyBusEvent] Set system_ready=true on Model 100');
        this.tick().then(() => {
          this.onSnapshotChanged?.();
        }).catch(() => {});
      }
      return;
    }
    
    console.log('[handleDyBusEvent] Unhandled event type:', content.type);
  }

  executeFunction(name) {
    console.log('[executeFunction] CALLED with name:', name);
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
      sendMatrix: (payload) => this.sendMatrix(payload),
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

      // Model 100 ui_event -> trigger forward_model100_events function
      // This forwards UI events from Model 100 to K8s via dual-bus
      if (event.cell && event.cell.model_id === 100 && 
          event.cell.p === 0 && event.cell.r === 0 && event.cell.c === 2 &&
          event.label && event.label.k === 'ui_event' && event.label.v) {
        console.log('[processEventsSnapshot] Model 100 ui_event detected, triggering forward_model100_events');
        const sys = firstSystemModel(this.runtime);
        if (sys && sys.hasFunction('forward_model100_events')) {
          this.runtime.intercepts.record('run_func', { func: 'forward_model100_events' });
        } else {
          console.log('[processEventsSnapshot] WARNING: forward_model100_events function NOT found');
        }
        continue;
      }

      // Model 100 PIN_IN (patch_in) -> trigger on_model100_patch_in function
      // This handles return patches from K8s worker via dual-bus
      if (event.cell && event.cell.model_id === 100 && 
          event.cell.p === 0 && event.cell.r === 1 && event.cell.c === 1 &&
          event.label && event.label.t === 'IN' && event.label.k === 'patch_in') {
        console.log('[processEventsSnapshot] Model 100 patch_in detected, triggering on_model100_patch_in');
        const sys = firstSystemModel(this.runtime);
        if (sys && sys.hasFunction('on_model100_patch_in')) {
          this.runtime.intercepts.record('run_func', { func: 'on_model100_patch_in' });
        } else {
          console.log('[processEventsSnapshot] WARNING: on_model100_patch_in function NOT found');
        }
        continue;
      }

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
      await this.executeFunction(name);
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
      await this.executeFunction(name);
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
      runtime.applyPatch(patch, { allowCreateModel: true });
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

  const systemModelsDir = new URL('../worker-base/system-models/', import.meta.url).pathname;
  loadSystemModelPatches(runtime, systemModelsDir);

  const envPatch = readModelTablePatchFromEnv();
  if (envPatch) {
    runtime.applyPatch(envPatch, { allowCreateModel: true });
  }

  // Ensure the default user model exists.
  // The UI defaults to selected_model_id=1; without a model 1 the renderer will show an empty/missing state.
  if (!runtime.getModel(1)) {
    runtime.createModel({ id: 1, name: 'M1', type: 'main' });
  }

  ensureStateLabel(runtime, 'selected_model_id', 'str', '1');
  ensureStateLabel(runtime, 'draft_p', 'str', '0');
  ensureStateLabel(runtime, 'draft_r', 'str', '0');
  ensureStateLabel(runtime, 'draft_c', 'str', '0');
  ensureStateLabel(runtime, 'draft_k', 'str', 'title');
  ensureStateLabel(runtime, 'draft_t', 'str', 'str');
  ensureStateLabel(runtime, 'draft_v_text', 'str', 'Hello');
  ensureStateLabel(runtime, 'draft_v_int', 'int', 0);
  ensureStateLabel(runtime, 'draft_v_bool', 'bool', false);

  ensureStateLabel(runtime, 'pin_demo_host', 'str', '127.0.0.1');
  ensureStateLabel(runtime, 'pin_demo_port', 'int', 1883);
  ensureStateLabel(runtime, 'pin_demo_client_id', 'str', 'pin-demo');
  ensureStateLabel(runtime, 'pin_demo_pin', 'str', 'demo');
  ensureStateLabel(runtime, 'pin_demo_in_json', 'str', '{"value":1}');
  ensureStateLabel(runtime, 'pin_demo_out_json', 'str', '{"value":2}');

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

  // Seed mock sliding-UI models (p=0 data + p=1 UI schema).
  // Convention: see buildAstFromSchema() in demo_modeltable.js.
  const MOCK_SLIDING_APPS = [
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
  ensureStateLabel(runtime, 'ws_apps_registry', 'json', wsRegistry);

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
    adapter.updateUiDerived({
      uiAst,
      snapshotJson: buildSafeSnapshotJson(runtime),
      eventLogJson: JSON.stringify(editorEventLog, null, 2),
    });
  }

  function snapshot() {
    return runtime.snapshot();
  }

  async function submitEnvelope(envelopeOrNull) {
    setMailboxEnvelope(runtime, envelopeOrNull);
    
    // Trigger forward_ui_events BEFORE any action processing clears the mailbox
    // This gives the function a chance to forward the event to Matrix
    if (envelopeOrNull) {
      await programEngine.tick();
    }
    
    const envelope = envelopeOrNull;
    const payload = envelope && envelope.payload ? envelope.payload : null;
    const action = payload && typeof payload.action === 'string' ? payload.action : '';

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

    if (action.startsWith('pin_demo_')) {
      const meta = payload && payload.meta ? payload.meta : null;
      const opId = meta && typeof meta.op_id === 'string' ? meta.op_id : '';
      const model0 = runtime.getModel(0);
      const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
      const stateCell = runtime.getCell(stateModel, 0, 0, 0);
      const getState = (key) => stateCell.labels.get(key)?.v ?? null;

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

      const pinName = String(getState('pin_demo_pin') || 'demo').trim();
      if (!pinName) return fail('invalid_target', 'missing_pin');

      if (action === 'pin_demo_set_mqtt_config') {
        const host = String(getState('pin_demo_host') || '').trim();
        const port = Number(getState('pin_demo_port'));
        const clientId = String(getState('pin_demo_client_id') || '').trim();
        if (!host || !Number.isInteger(port) || !clientId) {
          return fail('invalid_target', 'invalid_mqtt_config');
        }
        runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_target_host', t: 'str', v: host });
        runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_target_port', t: 'int', v: port });
        runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_target_client_id', t: 'str', v: clientId });
        return succeed('pin_demo_set_mqtt_config');
      }

      if (action === 'pin_demo_start_mqtt_loop') {
        runtime.startMqttLoop();
        return succeed('pin_demo_start_mqtt_loop');
      }

      if (action === 'pin_demo_declare_pin_in') {
        runtime.addLabel(model0, 0, 0, 1, { k: pinName, t: 'PIN_IN', v: pinName });
        return succeed('pin_demo_declare_pin_in');
      }

      if (action === 'pin_demo_declare_pin_out') {
        runtime.addLabel(model0, 0, 0, 1, { k: pinName, t: 'PIN_OUT', v: pinName });
        return succeed('pin_demo_declare_pin_out');
      }

      if (action === 'pin_demo_inject_in') {
        const raw = getState('pin_demo_in_json');
        const payloadValue = parseJsonMaybe(raw);
        const topic = currentTopic(runtime, pinName);
        runtime.mqttIncoming(topic, { pin: pinName, t: 'IN', value: payloadValue });
        return succeed('pin_demo_inject_in');
      }

      if (action === 'pin_demo_send_out') {
        const raw = getState('pin_demo_out_json');
        const payloadValue = parseJsonMaybe(raw);
        runtime.addLabel(model0, 0, 1, 1, { k: pinName, t: 'OUT', v: payloadValue });
        return succeed('pin_demo_send_out');
      }

      return fail('unknown_action', action);
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
      const opId = (() => {
        const meta = payload && payload.meta ? payload.meta : null;
        return meta && typeof meta.op_id === 'string' ? meta.op_id : '';
      })();
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

  return {
    runtime,
    snapshot,
    submitEnvelope,
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

  function sendSnapshot(res) {
    const data = JSON.stringify({ snapshot: state.snapshot() });
    res.write(`event: snapshot\n`);
    res.write(`data: ${data}\n\n`);
  }

  function broadcastSnapshot() {
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
      writeJson(res, 200, { snapshot: state.snapshot() }, cors);
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
        writeJson(
          res,
          200,
          {
            ok: true,
            consumed: Boolean(consumeResult && consumeResult.consumed),
            result: consumeResult && consumeResult.result ? consumeResult.result : undefined,
            ui_event_last_op_id: state.getLastOpId(),
            ui_event_error: state.getEventError(),
            snapshot: state.snapshot(),
          },
          cors,
        );
      } catch (err) {
        writeJson(res, 400, { ok: false, error: 'bad_request', detail: String(err && err.message ? err.message : err) }, cors);
      }
      return;
    }

    writeJson(res, 404, { ok: false, error: 'not_found' }, cors);
  });

  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`ui-model-demo-server listening on http://127.0.0.1:${port}\n`);
  });

  return server;
}

startServer({
  port: process.env.PORT ? Number(process.env.PORT) : 9000,
  corsOrigin: process.env.CORS_ORIGIN || null,
});
