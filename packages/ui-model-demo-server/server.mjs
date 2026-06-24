import http from 'node:http';
import crypto from 'node:crypto';
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
import { readMatrixBootstrapConfig, readMqttBootstrapConfig } from '../worker-base/src/bootstrap_config.mjs';
import { applyPersistedAssetEntries, resolvePersistedAssetRoot } from '../worker-base/src/persisted_asset_loader.mjs';
import { createLocalBusAdapter } from '../ui-model-demo-frontend/src/local_bus_adapter.js';
import { buildAstFromCellwiseModel } from '../ui-model-demo-frontend/src/ui_cellwise_projection.js';
import { buildAstFromSchema } from '../ui-model-demo-frontend/src/ui_schema_projection.js';
import { resolvePageAsset } from '../ui-model-demo-frontend/src/page_asset_resolver.js';
import {
  DESKTOP_APP_DETAIL_DRAWER_OPEN_LABEL,
  DESKTOP_APP_MANAGE_MODE_LABEL,
  DESKTOP_APP_VIEW_MODE_LABEL,
  DESKTOP_DELETE_CONFIRM_OPEN_LABEL,
  DESKTOP_DELETE_CONFIRM_TARGET_LABEL,
  DESKTOP_DELETE_RESULT_OPEN_LABEL,
  DESKTOP_FOREGROUND_APP_LABEL,
  DESKTOP_TASK_STACK_LABEL,
  DESKTOP_TASK_SWITCHER_OPEN_LABEL,
  deriveDesktopTaskStack,
  desktopAppRefKey,
  normalizeDesktopForegroundApp,
  normalizeDesktopTaskStack,
  readDesktopForegroundWorkspaceModelId,
} from '../ui-model-demo-frontend/src/desktop_app_state.js';
import {
  deriveEditorModelOptions,
  deriveHomeEditDialogTitle,
  deriveHomeMissingModelText,
  deriveHomeSelectedLabelText,
  deriveHomeTableRows,
  deriveMatrixDebugView,
  deriveSlidingFlowShellProjectionLabels,
  deriveSlidingFlowShellState,
  deriveSlideGalleryView,
  deriveStaticUploadReady,
  deriveWorkspaceSelected,
} from '../ui-model-demo-frontend/src/editor_page_state_derivers.js';
import {
  BUILTIN_WORKSPACE_APP_MODEL_IDS,
  DESKTOP_CATALOG_MODEL_ID,
  DOCS_CATALOG_MODEL_ID,
  DOC_PAGE_FILLTABLE_MINIMAL_MODEL_ID,
  FLOW_SHELL_DEFAULT_TAB,
  FLOW_SHELL_TAB_LABEL,
  GALLERY_CATALOG_MODEL_ID,
  GALLERY_MAILBOX_MODEL_ID,
  GALLERY_STATE_MODEL_ID,
  MATRIX_ACTIVE_CONVERSATION_MODEL_ID,
  MATRIX_ACTIVE_ROOM_MEMBERS_MODEL_ID,
  MATRIX_CHAT_UI_STATE_MODEL_ID,
  MATRIX_ROOM_DIRECTORY_MODEL_ID,
  MATRIX_SESSION_MODEL_ID,
  MATRIX_WORKSPACE_APP_MODEL_ID,
  WORKSPACE_ENTRY_MODEL_IDS,
} from '../ui-model-demo-frontend/src/model_ids.js';
import {
  getSession, getSessionWithToken, isAuthenticated, loginWithMatrix, logout,
  makeSetCookieHeader, makeClearCookieHeader,
  makeClearOidcStateCookieHeader,
  loadHomeservers, addHomeserver, removeHomeserver,
  checkLoginRateLimit,
  validateHomeserverUrl,
  startOidcLogin,
  completeOidcLogin,
  startMatrixSso,
  completeMatrixSso,
  getMatrixStatus,
  disconnectMatrix,
} from './auth.mjs';
import {
  normalizeFilltablePolicy,
  validateFilltableCandidateChanges,
  buildFilltableDigest,
  evaluateApplyPreviewGuard,
} from './filltable_policy.mjs';
import { buildFilltableModelInventoryFromSnapshot } from './filltable_prompt_context.mjs';
import { deriveMgmtBusConsoleProjection } from './mgmt_bus_console_projection.mjs';

const require = createRequire(import.meta.url);
const { loadProgramModelFromSqlite } = require('../worker-base/src/program_model_loader.js');
const { createSqlitePersister } = require('../worker-base/src/modeltable_persistence_sqlite.js');
const { initDataModel } = require('../worker-base/src/data_models.js');
const { createMatrixLiveAdapter } = require('../worker-base/src/matrix_live.js');
const matrixSdk = require('matrix-js-sdk');
const mqtt = require('mqtt');

const EDITOR_MODEL_ID = -1;
const EDITOR_STATE_MODEL_ID = -2;
const WORKSPACE_MANAGER_APP_MODEL_ID = 1051;
const WORKSPACE_ASSET_CATALOG_MODEL_ID = 1052;
const MATRIX_SUITE_APP_MODEL_ID = 1080;
const MATRIX_CHAT_APP_MODEL_ID = 1083;
const MATRIX_CHAT_BUS_EVENT_KEY = 'matrix_chat_1083_bus_event';
const BUS_EVENT_KEY = 'bus_event';
const BUS_EVENT_LAST_OP_KEY = 'bus_event_last_op_id';
const BUS_EVENT_ERROR_KEY = 'bus_event_error';
const BUS_EVENT_ENDPOINT_PATH = '/bus_event';
const UI_EVENT_TYPE = 'ui_event';
const UI_EVENT_ENDPOINT_PATH = '/ui_event';
const DERIVED_REFRESH_SCOPES = new Set(['business', 'home_or_editor', 'app_index', 'full']);
const LOGIN_MODEL_ID = -3;
const TRACE_MODEL_ID = -100; // Registered by 0213 as the Matrix debug / bus trace model id.
const MGMT_BUS_CONSOLE_MODEL_ID = 1036;
const DESKTOP_FOREGROUND_SHELL_MODEL_ID = -29;
const DEFAULT_UI_SERVER_V1N_ID = '5/10/28/35/13';
const CLIENT_SNAPSHOT_PROFILES = new Set(['bootstrap', 'visible', 'full']);
const BOOTSTRAP_MODEL0_LABEL_KEYS = new Set([
  'sys_worker_id',
  'sys_worker_role',
  'runtime_mode',
]);
const BOOTSTRAP_EDITOR_MAILBOX_LABEL_KEYS = new Set([
  BUS_EVENT_LAST_OP_KEY,
  BUS_EVENT_ERROR_KEY,
]);
const BOOTSTRAP_EDITOR_STATE_LABEL_KEYS = new Set([
  'ui_page',
  'ui_page_catalog_json',
  'ws_apps_registry',
  'ws_app_selected',
  'selected_model_id',
  DESKTOP_FOREGROUND_APP_LABEL,
  DESKTOP_TASK_STACK_LABEL,
  DESKTOP_TASK_SWITCHER_OPEN_LABEL,
  DESKTOP_APP_DETAIL_DRAWER_OPEN_LABEL,
  DESKTOP_APP_VIEW_MODE_LABEL,
  DESKTOP_APP_MANAGE_MODE_LABEL,
  DESKTOP_DELETE_CONFIRM_OPEN_LABEL,
  DESKTOP_DELETE_CONFIRM_TARGET_LABEL,
  'desktop_delete_confirm_title',
  'desktop_delete_confirm_text',
  DESKTOP_DELETE_RESULT_OPEN_LABEL,
  'desktop_delete_result_title',
  'desktop_delete_result_text',
]);
const BOOTSTRAP_GALLERY_STATE_LABEL_KEYS = new Set(['nav_to']);
const MGMT_BUS_CONSOLE_LOCAL_STATE_KEYS = new Set([
  'selected_subject',
  'selected_subject_id',
  'selected_event_id',
  'subject_filter',
  'timeline_filter',
  'timeline_sort',
  'inspector_tab',
  'composer_draft',
  'composer_action',
  'target_user_id',
  'last_refresh_requested_at',
  'last_ui_error',
]);
// Monotonic sequence counter for trace events (module-level, survives across calls).
let _traceSeq = 0;
const MEDIA_CACHE_TTL_MS = 15 * 60 * 1000;
const mediaUploadCache = new Map();

function slideAppExportUrlForRef(tableId, modelId) {
  const normalizedTableId = typeof tableId === 'string' && tableId.trim() ? tableId.trim() : 'host';
  if (!Number.isInteger(modelId)) return '';
  if (normalizedTableId === 'host') {
    return modelId > 0 ? `/api/slide-apps/${modelId}/export.zip` : '';
  }
  if (!isSafePinRouteSegment(normalizedTableId) || modelId < 0) return '';
  return `/api/slide-apps/export.zip?table_id=${encodeURIComponent(normalizedTableId)}&model_id=${encodeURIComponent(String(modelId))}`;
}

function deriveWorkspaceRegistryFromSnapshot({ snapshot, getParentInfo } = {}) {
  const derived = [];
  const seen = new Set();
  const allowedWorkspaceEntryIds = new Set(WORKSPACE_ENTRY_MODEL_IDS);
  const excludedModelIds = new Set([
    EDITOR_MODEL_ID,
    EDITOR_STATE_MODEL_ID,
    LOGIN_MODEL_ID,
    -10,
    GALLERY_MAILBOX_MODEL_ID,
    GALLERY_STATE_MODEL_ID,
  ]);

  const addOrReplace = (entry) => {
    if (!entry || !Number.isInteger(entry.model_id)) return;
    const tableId = typeof entry.table_id === 'string' && entry.table_id.trim() ? entry.table_id.trim() : 'host';
    if (tableId === 'host' && entry.model_id === 0) return;
    if (tableId !== 'host' && entry.model_id < 0) return;
    if (tableId === 'host' && excludedModelIds.has(entry.model_id)) return;
    const entryKey = `${tableId}|${entry.model_id}`;
    const normalizedEntry = { ...entry, table_id: tableId };
    const existing = derived.find((item) => `${item.table_id || 'host'}|${item.model_id}` === entryKey);
    if (existing) {
      Object.assign(existing, normalizedEntry);
      return;
    }
    derived.push(normalizedEntry);
    seen.add(entryKey);
  };

  const visitModel = (tableId, idText, modelSnap) => {
    const modelId = Number(idText);
    if (!Number.isInteger(modelId)) return;
    const normalizedTableId = typeof tableId === 'string' && tableId.trim() ? tableId.trim() : 'host';
    if (normalizedTableId === 'host' && modelId === 0) return;
    if (normalizedTableId !== 'host' && modelId < 0) return;
    const modelKey = `${normalizedTableId}|${modelId}`;
    if (seen.has(modelKey)) return;
    if (normalizedTableId === 'host' && excludedModelIds.has(modelId)) return;
    const rootLabels = modelSnap && modelSnap.cells && modelSnap.cells['0,0,0'] && modelSnap.cells['0,0,0'].labels
      ? modelSnap.cells['0,0,0'].labels
      : {};
    if (rootLabels.ws_deleted && rootLabels.ws_deleted.v === true) return;
    const isAllowedBuiltinEntry = normalizedTableId === 'host' && allowedWorkspaceEntryIds.has(modelId);
    const isInstalledSlideApp = Boolean(
      rootLabels.deletable && rootLabels.deletable.v === true
        && rootLabels.slide_capable && rootLabels.slide_capable.v === true,
    );
    if (!isAllowedBuiltinEntry && !isInstalledSlideApp) return;
    const parentInfo = typeof getParentInfo === 'function' && normalizedTableId === 'host' && modelId > 0 ? getParentInfo(modelId) : null;
    const hasAppSignals = modelId > 0 && normalizedTableId === 'host'
      ? Boolean(rootLabels.app_name || rootLabels.source_worker || (parentInfo && parentInfo.parentModelId === 0))
      : Boolean(rootLabels.app_name);
    if (!hasAppSignals) return;
    const name = rootLabels.app_name && typeof rootLabels.app_name.v === 'string' && rootLabels.app_name.v.trim()
      ? rootLabels.app_name.v
      : (modelSnap && typeof modelSnap.name === 'string' && modelSnap.name.trim()
        ? modelSnap.name
        : `App ${modelId}`);
    const source = rootLabels.source_worker && typeof rootLabels.source_worker.v === 'string'
      ? rootLabels.source_worker.v
      : '';
    const appOrigin = normalizedTableId === 'host' && BUILTIN_WORKSPACE_APP_MODEL_IDS.includes(modelId) ? 'builtin' : 'slid_in';
    const sourceDE = appOrigin === 'slid_in'
      ? String(rootLabels.source_de?.v || 'source unknown').trim() || 'source unknown'
      : '';
    const summary = rootLabels.slide_app_summary && typeof rootLabels.slide_app_summary.v === 'string'
      ? rootLabels.slide_app_summary.v
      : '';
    const deletable = rootLabels.deletable ? rootLabels.deletable.v === true : false;
    const slideCapable = rootLabels.slide_capable ? rootLabels.slide_capable.v === true : false;
    if (slideCapable && !summary.trim()) {
      throw new Error(`slide_capable workspace app ${modelId} missing required slide_app_summary`);
    }
    const slideSurfaceType = rootLabels.slide_surface_type && typeof rootLabels.slide_surface_type.v === 'string'
      ? rootLabels.slide_surface_type.v
      : '';
    const installedAt = rootLabels.installed_at && typeof rootLabels.installed_at.v === 'string'
      ? rootLabels.installed_at.v
      : '';
    const fromUser = rootLabels.from_user && typeof rootLabels.from_user.v === 'string'
      ? rootLabels.from_user.v
      : '';
    const toUser = rootLabels.to_user && typeof rootLabels.to_user.v === 'string'
      ? rootLabels.to_user.v
      : '';
    addOrReplace({
      table_id: normalizedTableId,
      model_id: modelId,
      name,
      summary,
      source,
      app_origin: appOrigin,
      source_de: sourceDE,
      deletable,
      delete_disabled: !deletable,
      slide_capable: slideCapable,
      slide_surface_type: slideSurfaceType,
      installed_at: installedAt,
      from_user: fromUser,
      to_user: toUser,
      export_url: slideCapable ? slideAppExportUrlForRef(normalizedTableId, modelId) : '',
      export_label: slideCapable ? 'Zip' : '',
    });
  };

  const models = snapshot && snapshot.models ? snapshot.models : {};
  for (const [idText, modelSnap] of Object.entries(models)) {
    visitModel('host', idText, modelSnap);
  }
  for (const [tableId, table] of Object.entries(snapshot?.tables || {})) {
    for (const [idText, modelSnap] of Object.entries(table?.models || {})) {
      visitModel(tableId, idText, modelSnap);
    }
  }
  derived.sort((a, b) => {
    const tableCmp = String(a.table_id || 'host').localeCompare(String(b.table_id || 'host'));
    return tableCmp || a.model_id - b.model_id;
  });
  return derived;
}

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
  const traceLabel = {
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
  };
  runtime.addLabel(tm, 0, 0, 1, traceLabel);
  const appendTrace = typeof tm.getFunction === 'function' ? tm.getFunction('trace_append') : null;
  if (typeof appendTrace === 'function') {
    appendTrace({ runtime, model: tm, label: traceLabel });
  }
}

function readIntEnv(name, fallback, minValue = 0) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < minValue) return fallback;
  return parsed;
}

function nowPerfMs() {
  const perf = globalThis && globalThis.performance && typeof globalThis.performance.now === 'function'
    ? globalThis.performance.now()
    : NaN;
  return Number.isFinite(perf) ? perf : Date.now();
}

function readEnvelopeMeta(envelopeOrNull) {
  if (!envelopeOrNull || typeof envelopeOrNull !== 'object') return {};
  const payload = envelopeOrNull.payload && typeof envelopeOrNull.payload === 'object'
    ? envelopeOrNull.payload
    : null;
  const meta = payload && payload.meta && typeof payload.meta === 'object'
    ? payload.meta
    : (envelopeOrNull.meta && typeof envelopeOrNull.meta === 'object' ? envelopeOrNull.meta : {});
  return meta && typeof meta === 'object' ? meta : {};
}

function roundMs(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value * 1000) / 1000) : null;
}

function withSubmitTiming(result, envelopeOrNull, timingStart) {
  if (!result || typeof result !== 'object') return result;
  const meta = readEnvelopeMeta(envelopeOrNull);
  const serverCompletedAt = Date.now();
  const serverCompletedPerfMs = nowPerfMs();
  return {
    ...result,
    timing: {
      op_id: typeof meta.op_id === 'string' ? meta.op_id : '',
      client_dispatch_ts: Number.isFinite(meta.client_dispatch_ts) ? meta.client_dispatch_ts : null,
      client_dispatch_perf_ms: Number.isFinite(meta.client_dispatch_perf_ms) ? meta.client_dispatch_perf_ms : null,
      server_received_at: timingStart.serverReceivedAt,
      server_received_perf_ms: timingStart.serverReceivedPerfMs,
      server_started_at: timingStart.serverStartedAt,
      server_started_perf_ms: timingStart.serverStartedPerfMs,
      server_completed_at: serverCompletedAt,
      server_completed_perf_ms: serverCompletedPerfMs,
      server_queue_wait_ms: roundMs(timingStart.serverStartedPerfMs - timingStart.serverReceivedPerfMs),
      server_duration_ms: roundMs(serverCompletedPerfMs - timingStart.serverStartedPerfMs),
      server_total_ms: roundMs(serverCompletedPerfMs - timingStart.serverReceivedPerfMs),
    },
  };
}

function readAuthString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function isPlaceholderValue(value) {
  const v = readAuthString(value).toLowerCase();
  if (!v) return true;
  if (v.startsWith('placeholder')) return true;
  return v.includes('placeholder-') || v.includes('will-update-after-synapse-setup');
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

function cacheUploadedMedia(uri, item) {
  if (!uri || typeof uri !== 'string') return;
  mediaUploadCache.set(uri, {
    ...item,
    createdAt: Date.now(),
  });
}

function normalizeMediaUploadPurpose(value) {
  const purpose = String(value || '').trim().toLowerCase();
  return purpose === 'slide-import' ? 'slide-import' : '';
}

function buildLocalCachedMediaUri(purpose) {
  const safePurpose = normalizeMediaUploadPurpose(purpose) || 'upload';
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  return `mxc://dongyu-local/${safePurpose}-${id}`;
}

function getCachedUploadedMedia(uri) {
  if (!uri || typeof uri !== 'string') return null;
  const item = mediaUploadCache.get(uri);
  if (!item) return null;
  if (Date.now() - item.createdAt > MEDIA_CACHE_TTL_MS) {
    mediaUploadCache.delete(uri);
    return null;
  }
  return item;
}

function parseMatrixMxcUri(uri) {
  const raw = String(uri || '').trim();
  const match = raw.match(/^mxc:\/\/([^/]+)\/(.+)$/u);
  if (!match) return null;
  return {
    uri: raw,
    serverName: decodeURIComponent(match[1]),
    mediaId: decodeURIComponent(match[2]),
  };
}

function safeDownloadFilename(value, fallback = 'matrix-media.bin') {
  const name = String(value || fallback).replace(/[\r\n]/gu, '').trim() || fallback;
  return name.replace(/[\\/:*?"<>|]/gu, '_').slice(0, 180) || fallback;
}

function matrixMediaDownloadUrl(uri, filename = '') {
  if (!parseMatrixMxcUri(uri)) return '';
  const params = new URLSearchParams({ uri: String(uri) });
  if (String(filename || '').trim()) params.set('filename', safeDownloadFilename(filename));
  return `/api/media/download?${params.toString()}`;
}

function matrixMediaThumbnailUrl(uri, filename = '') {
  if (!parseMatrixMxcUri(uri)) return '';
  const params = new URLSearchParams({ uri: String(uri) });
  if (String(filename || '').trim()) params.set('filename', safeDownloadFilename(filename));
  return `/api/media/thumbnail?${params.toString()}`;
}

function matrixMediaCardKind(msgtype, filename = '', uri = '', mimeType = '') {
  const type = String(msgtype || '').toLowerCase();
  const mime = String(mimeType || '').toLowerCase();
  if (type === 'm.image' || mime.startsWith('image/')) return 'image';
  if (type === 'm.audio' || mime.startsWith('audio/')) return 'audio';
  const target = `${String(filename || '')} ${String(uri || '')}`.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|\s|$)/u.test(target)) return 'image';
  if (/\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?|#|\s|$)/u.test(target)) return 'audio';
  if (type === 'm.file') return 'file';
  return 'text';
}

function matrixShareFileMessage(input = {}) {
  const mediaUri = String(input && input.mediaUri ? input.mediaUri : '').trim();
  const requestedName = String(input && input.fileName ? input.fileName : 'uploaded-file').trim() || 'uploaded-file';
  const cached = getCachedUploadedMedia(mediaUri);
  const cachedName = cached && typeof cached.filename === 'string' && cached.filename.trim()
    ? cached.filename.trim()
    : '';
  const fileName = cachedName || requestedName;
  const requestedMime = String(input && (input.mimeType || input.mime_type) ? (input.mimeType || input.mime_type) : '').trim();
  const mimeType = cached && typeof cached.contentType === 'string' && cached.contentType.trim()
    ? cached.contentType.trim()
    : requestedMime;
  const size = cached && Buffer.isBuffer(cached.buffer) ? cached.buffer.length : null;
  const cardKind = matrixMediaCardKind('m.file', fileName, mediaUri, mimeType);
  const msgtype = cardKind === 'image' ? 'm.image' : (cardKind === 'audio' ? 'm.audio' : 'm.file');
  const info = {};
  if (mimeType) info.mimetype = mimeType;
  if (Number.isFinite(size)) info.size = size;
  const content = {
    msgtype,
    body: fileName,
    url: mediaUri,
  };
  if (msgtype === 'm.file') content.filename = fileName;
  if (Object.keys(info).length > 0) content.info = info;
  return {
    content,
    cardKind,
    fileName,
    mimeType,
    size: Number.isFinite(size) ? size : null,
  };
}

async function uploadMatrixMedia({ homeserverUrl, accessToken, filename, contentType, body }) {
  const url = `${String(homeserverUrl).replace(/\/+$/, '')}/_matrix/media/v3/upload?filename=${encodeURIComponent(filename)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': contentType || 'application/octet-stream',
    },
    body,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data || typeof data.content_uri !== 'string' || data.content_uri.length === 0) {
    throw new Error(data && data.errcode ? String(data.errcode) : 'matrix_upload_failed');
  }
  return data.content_uri;
}

function matrixClientV3Url(homeserverUrl, suffix) {
  const base = String(homeserverUrl || '').replace(/\/+$/, '');
  const pathSuffix = String(suffix || '').startsWith('/') ? String(suffix) : `/${String(suffix || '')}`;
  return `${base}/_matrix/client/v3${pathSuffix}`;
}

async function fetchMatrixJson(session, suffix, {
  fetchImpl = fetch,
  allowNotFound = false,
  timeoutMs = 5000,
} = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  let resp;
  try {
    resp = await fetchImpl(matrixClientV3Url(session.homeserverUrl, suffix), {
      signal: controller ? controller.signal : undefined,
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        accept: 'application/json',
      },
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
  const data = await resp.json().catch(() => ({}));
  if (allowNotFound && resp.status === 404) return null;
  if (!resp.ok) {
    const err = new Error(data && data.errcode ? String(data.errcode) : `matrix_http_${resp.status}`);
    err.status = resp.status;
    err.data = data;
    throw err;
  }
  return data;
}

function matrixRoomErrorInfo(err, fallbackCode = 'matrix_room_request_failed') {
  if (!err) return { code: fallbackCode, detail: fallbackCode };
  const code = err.data && err.data.errcode ? String(err.data.errcode) : (err.message ? String(err.message) : fallbackCode);
  const detail = err.data && err.data.error ? String(err.data.error) : (err.message ? String(err.message) : code);
  return {
    code,
    detail,
    status: Number.isFinite(Number(err.status)) ? Number(err.status) : undefined,
  };
}

function matrixNetworkErrorInfo(err, fallbackCode = 'matrix_network_error') {
  return {
    code: fallbackCode,
    detail: err && err.message ? String(err.message) : fallbackCode,
  };
}

function isTransientMatrixNetworkError(err) {
  const text = String(err && (err.code || err.name || err.message) ? `${err.code || ''} ${err.name || ''} ${err.message || ''}` : '').toLowerCase();
  return text.includes('socket')
    || text.includes('econnreset')
    || text.includes('und_err_socket')
    || text.includes('closed unexpectedly')
    || text.includes('networkerror');
}

async function fetchMatrixPostWithRetry(url, options, { retryCount = 1, retryDelayMs = 150 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      if (attempt >= retryCount || !isTransientMatrixNetworkError(err)) throw err;
      await sleepMs(retryDelayMs * (attempt + 1));
    }
  }
  throw lastError;
}

function matrixEventTs(ts) {
  const numeric = Number(ts);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return new Date(numeric).toISOString().slice(11, 16);
}

function matrixMemberLabel(userId, info = {}) {
  const display = typeof info.display_name === 'string' && info.display_name.trim()
    ? info.display_name.trim()
    : '';
  return display ? `${display} (${userId})` : userId;
}

function normalizeMatrixJoinedMembers(data) {
  const joined = data && data.joined && typeof data.joined === 'object' ? data.joined : {};
  return Object.entries(joined)
    .filter(([userId]) => typeof userId === 'string' && userId.trim())
    .map(([userId, info]) => ({
      user_id: userId,
      display_name: typeof info?.display_name === 'string' ? info.display_name : '',
      avatar_url: typeof info?.avatar_url === 'string' ? info.avatar_url : '',
      label: matrixMemberLabel(userId, info || {}),
    }));
}

function matrixPowerLevelValue(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function matrixRoomPermissions(powerState, userId) {
  const state = powerState && typeof powerState === 'object' ? powerState : {};
  const users = state.users && typeof state.users === 'object' ? state.users : {};
  const usersDefault = matrixPowerLevelValue(state.users_default, 0);
  const ownPower = matrixPowerLevelValue(users[userId], usersDefault);
  const inviteLevel = matrixPowerLevelValue(state.invite, 0);
  const kickLevel = matrixPowerLevelValue(state.kick, 50);
  return {
    own_power: ownPower,
    invite_level: inviteLevel,
    kick_level: kickLevel,
    can_invite: ownPower >= inviteLevel,
    can_kick: ownPower >= kickLevel,
    can_leave: true,
  };
}

function matrixTimelineEvent(event, currentUserId = '') {
  const source = event && typeof event === 'object' ? event : {};
  const content = source.content && typeof source.content === 'object' ? source.content : {};
  const replacement = content['m.new_content'] && typeof content['m.new_content'] === 'object'
    ? content['m.new_content']
    : null;
  const rendered = replacement || content;
  const msgtype = String(rendered.msgtype || content.msgtype || source.type || 'm.text');
  const body = String(rendered.body || content.body || '');
  const info = rendered.info && typeof rendered.info === 'object'
    ? rendered.info
    : (content.info && typeof content.info === 'object' ? content.info : {});
  const mediaUri = String(rendered.url || content.url || '');
  const fileName = String(rendered.filename || content.filename || body || '');
  const mimeType = String(info.mimetype || rendered.mimetype || content.mimetype || '');
  const cardKind = matrixMediaCardKind(msgtype, fileName, mediaUri, mimeType);
  const thumbnailUri = String(info.thumbnail_url || rendered.thumbnail_url || content.thumbnail_url || '');
  const out = {
    event_id: String(source.event_id || ''),
    room_id: String(source.room_id || ''),
    sender: String(source.sender || 'system'),
    type: String(source.type || 'm.room.message'),
    msgtype,
    body,
    card_kind: cardKind,
    media_uri: mediaUri,
    file_name: fileName,
    mime_type: mimeType,
    size: Number.isFinite(Number(info.size)) ? Number(info.size) : null,
    duration_ms: Number.isFinite(Number(info.duration)) ? Number(info.duration) : null,
    width: Number.isFinite(Number(info.w)) ? Number(info.w) : null,
    height: Number.isFinite(Number(info.h)) ? Number(info.h) : null,
    download_url: cardKind !== 'text' ? matrixMediaDownloadUrl(mediaUri, fileName) : '',
    thumbnail_url: cardKind === 'image'
      ? (matrixMediaThumbnailUrl(thumbnailUri || mediaUri, fileName) || matrixMediaDownloadUrl(mediaUri, fileName))
      : '',
    ts: matrixEventTs(source.origin_server_ts),
    edited: Boolean(replacement || content?.['m.relates_to']?.rel_type === 'm.replace'),
    mine: currentUserId ? String(source.sender || '') === currentUserId : false,
  };
  if (out.size === null) delete out.size;
  if (out.duration_ms === null) delete out.duration_ms;
  if (out.width === null) delete out.width;
  if (out.height === null) delete out.height;
  if (!out.mime_type) delete out.mime_type;
  if (!out.media_uri) delete out.media_uri;
  if (!out.file_name) delete out.file_name;
  if (!out.download_url) delete out.download_url;
  if (!out.thumbnail_url) delete out.thumbnail_url;
  if (cardKind === 'text') delete out.card_kind;
  return {
    ...out,
    card_kind: cardKind,
  };
}

function matrixRoomKind(memberObjects, currentUserId, directFlag = false) {
  if (directFlag === true) return 'direct';
  const joinedIds = memberObjects.map((member) => member.user_id).filter(Boolean);
  if (currentUserId && joinedIds.length === 2 && joinedIds.includes(currentUserId)) return 'person';
  return 'room';
}

function matrixRoomConversationGroup(kind) {
  if (kind === 'invite') return 'invites';
  return kind === 'direct' || kind === 'person' || kind === 'dm' ? 'people' : 'rooms';
}

function matrixRoomKindLabel(kind, peerLabel = '') {
  if (kind === 'invite') return 'Invitation';
  if (kind === 'direct' || kind === 'dm') return peerLabel ? `Direct with ${peerLabel}` : 'Direct';
  if (kind === 'person') return peerLabel ? `1v1 room with ${peerLabel}` : '1v1 room';
  return 'Room';
}

function matrixDirectRoomIdsFromAccountData(data) {
  const out = new Set();
  if (!data || typeof data !== 'object' || Array.isArray(data)) return out;
  for (const roomIds of Object.values(data)) {
    if (!Array.isArray(roomIds)) continue;
    for (const roomId of roomIds) {
      if (typeof roomId === 'string' && roomId.trim()) out.add(roomId);
    }
  }
  return out;
}

function matrixInviteStateEventValue(events, eventType, field) {
  const match = events.find((event) => event && event.type === eventType && event.content && Object.prototype.hasOwnProperty.call(event.content, field));
  return match && match.content ? String(match.content[field] || '') : '';
}

function matrixInvitedRoomsFromSync(syncData, currentUserId = '') {
  const inviteRooms = syncData?.rooms?.invite;
  if (!inviteRooms || typeof inviteRooms !== 'object' || Array.isArray(inviteRooms)) return [];
  return Object.entries(inviteRooms)
    .filter(([roomId]) => typeof roomId === 'string' && roomId.trim())
    .map(([roomId, invite], index) => {
      const events = Array.isArray(invite?.invite_state?.events) ? invite.invite_state.events : [];
      const inviteMemberEvent = events.find((event) => event
        && event.type === 'm.room.member'
        && event.content
        && event.content.membership === 'invite'
        && (!currentUserId || event.state_key === currentUserId));
      const invitedBy = String(inviteMemberEvent?.sender || '');
      const roomName = matrixInviteStateEventValue(events, 'm.room.name', 'name');
      const alias = matrixInviteStateEventValue(events, 'm.room.canonical_alias', 'alias');
      const topic = matrixInviteStateEventValue(events, 'm.room.topic', 'topic');
      const displayName = roomName || alias || (invitedBy ? `Invitation from ${invitedBy}` : roomId);
      const members = [currentUserId, invitedBy].filter(Boolean);
      const memberObjects = members.map((userId) => ({
        user_id: userId,
        display_name: userId === invitedBy ? 'inviter' : '',
        avatar_url: '',
        label: userId,
      }));
      return {
        room_id: roomId,
        id: roomId,
        name: displayName,
        list_title: displayName,
        list_subtitle: invitedBy ? `Invitation from ${invitedBy}` : 'Matrix invitation',
        canonical_alias: alias,
        alias,
        topic,
        kind: 'invite',
        conversation_group: 'invites',
        is_direct: false,
        invited_by: invitedBy,
        dm_user_id: '',
        dm_display_name: '',
        members,
        member_objects: memberObjects,
        member_count: members.length,
        member_status: 'invite',
        member_error: null,
        history_status: 'invite',
        history_error: null,
        power_status: 'invite',
        power_error: null,
        can_join: true,
        can_invite: false,
        can_kick: false,
        can_leave: true,
        own_power: 0,
        invite_level: 0,
        kick_level: 50,
        last_message: '',
        source: 'matrix.invite',
        order: index,
      };
    });
}

function matrixProjectedRoom(room, index = 0) {
  const roomId = String(room && (room.room_id || room.id) ? (room.room_id || room.id) : '').trim();
  if (!roomId) return null;
  const rawKind = String(room.kind || '').trim();
  const kind = room.is_direct === true || rawKind === 'direct'
    ? 'direct'
    : (rawKind === 'person' ? 'person' : (rawKind === 'dm' ? 'dm' : (rawKind === 'invite' ? 'invite' : 'room')));
  const isPeople = matrixRoomConversationGroup(kind) === 'people';
  const name = String(room.name || room.canonical_alias || room.alias || (isPeople ? room.dm_display_name : '') || '').trim() || 'Unnamed room';
  const dmDisplayName = String(room.dm_display_name || room.dm_user_id || '').trim();
  const listTitle = isPeople ? (dmDisplayName || name) : name;
  const lastMessage = String(room.last_message || room.topic || '');
  const listSubtitle = isPeople
    ? [name && name !== listTitle ? name : '', lastMessage].filter(Boolean).join(' · ')
    : lastMessage;
  const members = Array.isArray(room.members) ? room.members : [];
  const memberObjects = Array.isArray(room.member_objects) ? room.member_objects : [];
  return {
    id: roomId,
    kind,
    conversation_group: matrixRoomConversationGroup(kind),
    name,
    list_title: listTitle,
    list_subtitle: listSubtitle,
    alias: String(room.canonical_alias || room.alias || ''),
    topic: String(room.topic || ''),
    avatar: listTitle.slice(0, 2).toUpperCase(),
    unread: Number.isFinite(Number(room.unread)) ? Number(room.unread) : 0,
    members,
    member_objects: memberObjects,
    member_count: Number.isFinite(Number(room.member_count)) ? Number(room.member_count) : members.length,
    member_status: String(room.member_status || 'unknown'),
    member_error: room.member_error || null,
    history_status: String(room.history_status || 'unknown'),
    history_error: room.history_error || null,
    power_status: String(room.power_status || 'unknown'),
    power_error: room.power_error || null,
    can_invite: room.can_invite === true,
    can_kick: room.can_kick === true,
    can_join: room.can_join === true,
    can_leave: room.can_leave !== false,
    own_power: Number.isFinite(Number(room.own_power)) ? Number(room.own_power) : 0,
    invite_level: Number.isFinite(Number(room.invite_level)) ? Number(room.invite_level) : 0,
    kick_level: Number.isFinite(Number(room.kick_level)) ? Number(room.kick_level) : 50,
    is_direct: kind === 'direct',
    invited_by: String(room.invited_by || ''),
    dm_user_id: String(room.dm_user_id || ''),
    dm_display_name: dmDisplayName,
    last_message: lastMessage,
    archived: false,
    source: 'matrix.joined_room',
    order: index,
  };
}

function matrixDedupeJoinedInviteRooms(rooms) {
  const list = Array.isArray(rooms) ? rooms.filter(Boolean) : [];
  const joinedIds = new Set(list
    .filter((room) => matrixRoomConversationGroup(String(room.kind || 'room')) !== 'invites')
    .map((room) => String(room.id || room.room_id || '').trim())
    .filter(Boolean));
  if (joinedIds.size === 0) return list;
  return list.filter((room) => {
    const roomId = String(room.id || room.room_id || '').trim();
    const isInvite = matrixRoomConversationGroup(String(room.kind || '')) === 'invites';
    return !(isInvite && joinedIds.has(roomId));
  });
}

function matrixProjectedTimeline(result) {
  const directEvents = Array.isArray(result?.events) ? result.events : [];
  if (directEvents.length > 0) return directEvents;
  const rooms = Array.isArray(result?.rooms) ? result.rooms : [];
  return rooms.flatMap((room) => Array.isArray(room?.timeline) ? room.timeline : []);
}

function mergeMatrixTimeline(existing, incoming) {
  const merged = new Map();
  for (const event of Array.isArray(existing) ? existing : []) {
    if (!event || typeof event !== 'object') continue;
    const key = String(event.event_id || event.id || `${event.room_id || ''}:${event.ts || ''}:${event.body || ''}`);
    merged.set(key, event);
  }
  for (const event of Array.isArray(incoming) ? incoming : []) {
    if (!event || typeof event !== 'object') continue;
    const key = String(event.event_id || event.id || `${event.room_id || ''}:${event.ts || ''}:${event.body || ''}`);
    merged.set(key, event);
  }
  return Array.from(merged.values());
}

export function resolveMgmtBusConsoleMatrixSession(runtime, env = process.env) {
  const matrixConfig = readMatrixBootstrapConfig(runtime);
  const homeserverUrl = firstValidValue(
    matrixConfig && matrixConfig.homeserverUrl,
    env.MATRIX_HOMESERVER_URL,
  );
  const accessToken = firstValidValue(matrixConfig && matrixConfig.accessToken);
  const userId = firstValidValue(matrixConfig && matrixConfig.userId);
  if (!homeserverUrl || !accessToken) {
    return {
      ok: false,
      code: 'matrix_session_missing',
      detail: !homeserverUrl ? 'missing_homeserver' : 'missing_access_token',
    };
  }
  return {
    ok: true,
    data: {
      homeserverUrl,
      accessToken,
      userId,
    },
  };
}

export async function fetchMgmtBusConsoleJoinedRooms(session, options = {}) {
  const normalized = session && typeof session === 'object' ? session : {};
  if (!normalized.homeserverUrl || !normalized.accessToken) {
    return { ok: false, code: 'matrix_session_missing', rooms: [] };
  }
  const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : fetch;
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 5000;
  const messageLimit = Number.isFinite(Number(options.messageLimit)) && Number(options.messageLimit) > 0
    ? Math.min(Number(options.messageLimit), 50)
    : 20;
  const joined = await fetchMatrixJson(normalized, '/joined_rooms', { fetchImpl, timeoutMs });
  const roomIds = Array.isArray(joined?.joined_rooms)
    ? joined.joined_rooms.filter((roomId) => typeof roomId === 'string' && roomId.trim())
    : [];
  const directAccountData = normalized.userId
    ? await fetchMatrixJson(normalized, `/user/${encodeURIComponent(normalized.userId)}/account_data/m.direct`, { fetchImpl, allowNotFound: true, timeoutMs }).catch(() => null)
    : null;
  const directRoomIds = matrixDirectRoomIdsFromAccountData(directAccountData);
  const syncFilter = encodeURIComponent(JSON.stringify({
    room: {
      timeline: { limit: 1 },
      state: { types: ['m.room.name', 'm.room.canonical_alias', 'm.room.topic', 'm.room.member'] },
    },
  }));
  const inviteSync = await fetchMatrixJson(normalized, `/sync?timeout=0&filter=${syncFilter}`, { fetchImpl, timeoutMs })
    .catch(() => null);
  const rooms = await Promise.all(roomIds.map(async (roomId) => {
    const encoded = encodeURIComponent(roomId);
    const [nameState, aliasState, topicState, powerStateResult, membersResult, messagesResult] = await Promise.all([
      fetchMatrixJson(normalized, `/rooms/${encoded}/state/m.room.name`, { fetchImpl, allowNotFound: true, timeoutMs }).catch(() => null),
      fetchMatrixJson(normalized, `/rooms/${encoded}/state/m.room.canonical_alias`, { fetchImpl, allowNotFound: true, timeoutMs }).catch(() => null),
      fetchMatrixJson(normalized, `/rooms/${encoded}/state/m.room.topic`, { fetchImpl, allowNotFound: true, timeoutMs }).catch(() => null),
      fetchMatrixJson(normalized, `/rooms/${encoded}/state/m.room.power_levels`, { fetchImpl, allowNotFound: true, timeoutMs })
        .then((data) => ({ ok: true, data }))
        .catch((err) => ({ ok: false, error: matrixRoomErrorInfo(err, 'matrix_power_levels_failed') })),
      fetchMatrixJson(normalized, `/rooms/${encoded}/joined_members`, { fetchImpl, timeoutMs })
        .then((data) => ({ ok: true, data }))
        .catch((err) => ({ ok: false, error: matrixRoomErrorInfo(err, 'matrix_joined_members_failed') })),
      fetchMatrixJson(normalized, `/rooms/${encoded}/messages?dir=b&limit=${encodeURIComponent(String(messageLimit))}`, { fetchImpl, timeoutMs })
        .then((data) => ({ ok: true, data }))
        .catch((err) => ({ ok: false, error: matrixRoomErrorInfo(err, 'matrix_room_messages_failed') })),
    ]);
    const memberObjects = membersResult.ok ? normalizeMatrixJoinedMembers(membersResult.data) : [];
    const memberLabels = memberObjects.map((member) => member.label);
    const directPeer = normalized.userId
      ? memberObjects.find((member) => member.user_id && member.user_id !== normalized.userId)
      : null;
    const kind = matrixRoomKind(memberObjects, normalized.userId, directRoomIds.has(roomId));
    const isPeople = matrixRoomConversationGroup(kind) === 'people';
    const rawEvents = messagesResult.ok && Array.isArray(messagesResult.data?.chunk)
      ? messagesResult.data.chunk
      : [];
    const timeline = rawEvents
      .filter((event) => event && event.type === 'm.room.message')
      .map((event) => matrixTimelineEvent({ ...event, room_id: event.room_id || roomId }, normalized.userId))
      .filter((event) => event.event_id || event.body)
      .reverse();
    const lastMessage = timeline.length > 0
      ? `${timeline[timeline.length - 1].sender}: ${timeline[timeline.length - 1].body || timeline[timeline.length - 1].file_name || timeline[timeline.length - 1].msgtype}`
      : '';
    const baseName = typeof nameState?.name === 'string' ? nameState.name : '';
    const alias = typeof aliasState?.alias === 'string' ? aliasState.alias : '';
    const displayName = baseName || alias || (isPeople && directPeer ? (directPeer.display_name || directPeer.user_id) : '');
    const dmDisplayName = directPeer ? (directPeer.display_name || directPeer.user_id) : '';
    const listTitle = isPeople ? (dmDisplayName || displayName || roomId) : (displayName || roomId);
    const listSubtitle = isPeople
      ? [displayName && displayName !== listTitle ? displayName : '', lastMessage].filter(Boolean).join(' · ')
      : lastMessage;
    const permissionState = powerStateResult.ok
      ? matrixRoomPermissions(powerStateResult.data || {}, normalized.userId || '')
      : { can_invite: false, can_kick: false, can_leave: true, power_error: powerStateResult.error };
    return {
      room_id: roomId,
      id: roomId,
      name: displayName,
      list_title: listTitle,
      list_subtitle: listSubtitle,
      canonical_alias: alias,
      alias,
      topic: typeof topicState?.topic === 'string' ? topicState.topic : '',
      kind,
      conversation_group: matrixRoomConversationGroup(kind),
      is_direct: kind === 'direct',
      dm_user_id: directPeer ? directPeer.user_id : '',
      dm_display_name: dmDisplayName,
      members: memberLabels,
      member_objects: memberObjects,
      member_count: memberObjects.length,
      member_status: membersResult.ok ? 'ok' : 'error',
      member_error: membersResult.ok ? null : membersResult.error,
      history_status: messagesResult.ok ? 'ok' : 'error',
      history_error: messagesResult.ok ? null : messagesResult.error,
      power_status: powerStateResult.ok ? 'ok' : 'error',
      power_error: powerStateResult.ok ? null : powerStateResult.error,
      can_invite: Boolean(permissionState.can_invite),
      can_kick: Boolean(permissionState.can_kick),
      can_leave: true,
      own_power: Number.isFinite(Number(permissionState.own_power)) ? Number(permissionState.own_power) : 0,
      invite_level: Number.isFinite(Number(permissionState.invite_level)) ? Number(permissionState.invite_level) : 0,
      kick_level: Number.isFinite(Number(permissionState.kick_level)) ? Number(permissionState.kick_level) : 50,
      last_message: lastMessage,
      timeline,
    };
  }));
  const invitedRooms = matrixInvitedRoomsFromSync(inviteSync, normalized.userId || '');
  return {
    ok: true,
    rooms: matrixDedupeJoinedInviteRooms(rooms.concat(invitedRooms)),
    events: rooms.flatMap((room) => Array.isArray(room.timeline) ? room.timeline : []),
  };
}

function matrixSuiteTxnId(prefix = 'dy') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function matrixSuiteLoginWithPassword({ homeserverUrl, userId, password }) {
  const rawHomeserver = String(homeserverUrl || '').trim();
  const user = String(userId || '').trim();
  const pass = String(password || '');
  if (!rawHomeserver) return { ok: false, code: 'missing_homeserver', detail: 'homeserver_required' };
  if (!user || !pass) return { ok: false, code: 'missing_credentials', detail: 'user_id_and_password_required' };
  const internalHomeserver = readAuthString(process.env.MATRIX_HOMESERVER_INTERNAL_URL) || 'http://synapse.dongyu.svc.cluster.local:8008';
  const resolvedHomeserver = rawHomeserver.includes('matrix.localhost') ? internalHomeserver : rawHomeserver;
  const validatedHomeserver = validateHomeserverUrl(resolvedHomeserver);
  const fetchFn = validatedHomeserver.startsWith('https:') && process.env.DY_SKIP_TLS === '1'
    ? (url, opts) => fetch(url, { ...opts, tls: { rejectUnauthorized: false } })
    : undefined;
  const client = matrixSdk.createClient({ baseUrl: validatedHomeserver, fetchFn });
  const login = await client.login('m.login.password', {
    identifier: { type: 'm.id.user', user },
    password: pass,
  });
  return {
    ok: true,
    userId: login.user_id || user,
    displayName: login.display_name || login.user_id || user,
    homeserverUrl: validatedHomeserver,
    accessToken: login.access_token,
  };
}

async function matrixSuiteSendRoomEvent(session, roomId, eventType, content) {
  if (!session || !session.homeserverUrl || !session.accessToken) {
    return { ok: false, code: 'matrix_session_missing', detail: 'login_required' };
  }
  const room = String(roomId || '').trim();
  if (!room) return { ok: false, code: 'missing_room_id', detail: 'room_id_required' };
  const txnId = matrixSuiteTxnId('matrix_suite');
  const url = `${String(session.homeserverUrl).replace(/\/+$/, '')}/_matrix/client/v3/rooms/${encodeURIComponent(room)}/send/${encodeURIComponent(eventType)}/${encodeURIComponent(txnId)}`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(content || {}),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data || typeof data.event_id !== 'string') {
    return {
      ok: false,
      code: data && data.errcode ? String(data.errcode) : 'matrix_send_failed',
      detail: data && data.error ? String(data.error) : `status=${resp.status}`,
    };
  }
  return { ok: true, eventId: data.event_id, ts: new Date().toISOString().slice(11, 16) };
}

async function matrixSuiteCreateRoomWithSession(session, input) {
  if (!session || !session.homeserverUrl || !session.accessToken) {
    return { ok: false, code: 'matrix_session_missing', detail: 'login_required' };
  }
  const name = String(input && input.name ? input.name : '').trim();
  if (!name) return { ok: false, code: 'missing_room_name', detail: 'name_required' };
  const kind = String(input && input.kind ? input.kind : 'room') === 'dm' ? 'direct' : 'room';
  const body = {
    name,
    preset: kind === 'direct' ? 'trusted_private_chat' : 'private_chat',
    is_direct: kind === 'direct',
  };
  const invite = String(input && input.inviteUserId ? input.inviteUserId : '').trim();
  if (invite) body.invite = [invite];
  const url = `${String(session.homeserverUrl).replace(/\/+$/, '')}/_matrix/client/v3/createRoom`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data || typeof data.room_id !== 'string') {
    return {
      ok: false,
      code: data && data.errcode ? String(data.errcode) : 'matrix_create_room_failed',
      detail: data && data.error ? String(data.error) : `status=${resp.status}`,
    };
  }
  return { ok: true, roomId: data.room_id, name, kind };
}

async function matrixSuitePostRoomMembership(session, roomId, endpoint, body) {
  if (!session || !session.homeserverUrl || !session.accessToken) {
    return { ok: false, code: 'matrix_session_missing', detail: 'login_required' };
  }
  const room = String(roomId || '').trim();
  if (!room) return { ok: false, code: 'missing_room_id', detail: 'room_id_required' };
  const url = `${String(session.homeserverUrl).replace(/\/+$/, '')}/_matrix/client/v3/rooms/${encodeURIComponent(room)}/${endpoint}`;
  let resp;
  try {
    resp = await fetchMatrixPostWithRetry(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body || {}),
    });
  } catch (err) {
    return { ok: false, ...matrixNetworkErrorInfo(err, `matrix_${endpoint}_network_error`) };
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return {
      ok: false,
      code: data && data.errcode ? String(data.errcode) : `matrix_${endpoint}_failed`,
      detail: data && data.error ? String(data.error) : `status=${resp.status}`,
    };
  }
  return { ok: true, roomId: room };
}

async function matrixSuiteInviteMemberWithSession(session, input) {
  const userId = String(input && input.userId ? input.userId : '').trim();
  if (!userId) return { ok: false, code: 'missing_user_id', detail: 'user_id_required' };
  return matrixSuitePostRoomMembership(session, input && input.roomId, 'invite', {
    user_id: userId,
    reason: String(input && input.reason ? input.reason : 'Invited from Matrix Chat'),
  });
}

async function matrixSuiteRemoveMemberWithSession(session, input) {
  const userId = String(input && input.userId ? input.userId : '').trim();
  if (!userId) return { ok: false, code: 'missing_user_id', detail: 'user_id_required' };
  return matrixSuitePostRoomMembership(session, input && input.roomId, 'kick', {
    user_id: userId,
    reason: String(input && input.reason ? input.reason : 'Removed from Matrix Chat'),
  });
}

async function matrixSuiteLeaveRoomWithSession(session, input) {
  return matrixSuitePostRoomMembership(session, input && input.roomId, 'leave', {
    reason: String(input && input.reason ? input.reason : 'Left from Matrix Chat'),
  });
}

async function matrixSuiteJoinRoomWithSession(session, input) {
  if (!session || !session.homeserverUrl || !session.accessToken) {
    return { ok: false, code: 'matrix_session_missing', detail: 'login_required' };
  }
  const room = String(input && input.roomId ? input.roomId : '').trim();
  if (!room) return { ok: false, code: 'missing_room_id', detail: 'room_id_required' };
  const url = `${String(session.homeserverUrl).replace(/\/+$/, '')}/_matrix/client/v3/join/${encodeURIComponent(room)}`;
  let resp;
  try {
    resp = await fetchMatrixPostWithRetry(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason: String(input && input.reason ? input.reason : 'Accepted from Matrix Chat') }),
    });
  } catch (err) {
    return { ok: false, ...matrixNetworkErrorInfo(err, 'matrix_join_network_error') };
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return {
      ok: false,
      code: data && data.errcode ? String(data.errcode) : 'matrix_join_failed',
      detail: data && data.error ? String(data.error) : `status=${resp.status}`,
    };
  }
  return { ok: true, roomId: String(data.room_id || room) };
}

async function matrixSuiteRefreshRoomsWithSession(session) {
  if (!session || !session.homeserverUrl || !session.accessToken) {
    return { ok: false, code: 'matrix_session_missing', detail: 'login_required' };
  }
  return fetchMgmtBusConsoleJoinedRooms(session);
}

async function handleMediaUploadRequest(req, res, state, corsOrigin = null) {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const cors = corsHeaders(req, corsOrigin);
  const uploadPurpose = normalizeMediaUploadPurpose(url.searchParams.get('purpose'));
  if (AUTH_ENABLED && !isAuthenticated(req)) {
    writeJson(res, 401, { ok: false, error: 'not_authenticated' }, cors);
    return;
  }
  const session = getSessionWithToken(req);
  const runtimeMatrixConfig = readMatrixBootstrapConfig(state.runtime);
  const uploadIdentity = (session && session.accessToken && session.homeserverUrl)
    ? {
      homeserverUrl: session.homeserverUrl,
      accessToken: session.accessToken,
      userId: session.matrixUserId || session.userId || '',
    }
    : (!AUTH_ENABLED
      ? {
        homeserverUrl: firstValidValue(
          runtimeMatrixConfig && runtimeMatrixConfig.homeserverUrl,
          process.env.MATRIX_HOMESERVER_URL,
        ),
        accessToken: firstValidValue(
          runtimeMatrixConfig && runtimeMatrixConfig.accessToken,
          process.env.MATRIX_MBR_BOT_ACCESS_TOKEN,
          process.env.MATRIX_MBR_ACCESS_TOKEN,
        ),
        userId: firstValidValue(
          runtimeMatrixConfig && runtimeMatrixConfig.userId,
          process.env.MATRIX_MBR_BOT_USER,
          process.env.MATRIX_MBR_USER,
        ),
      }
      : null);
  const canUseLocalSlideImportCache = AUTH_ENABLED && uploadPurpose === 'slide-import';
  if ((!uploadIdentity || !uploadIdentity.accessToken || !uploadIdentity.homeserverUrl) && !canUseLocalSlideImportCache) {
    writeJson(res, 401, { ok: false, error: 'matrix_session_missing' }, cors);
    return;
  }
  const filename = (url.searchParams.get('filename') || 'upload.bin').trim();
  if (!filename) {
    writeJson(res, 400, { ok: false, error: 'invalid_filename' }, cors);
    return;
  }
  const contentType = typeof req.headers['content-type'] === 'string' && req.headers['content-type'].trim()
    ? req.headers['content-type'].trim()
    : 'application/octet-stream';
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
    if (canUseLocalSlideImportCache && (!uploadIdentity || !uploadIdentity.accessToken || !uploadIdentity.homeserverUrl)) {
      const uri = buildLocalCachedMediaUri(uploadPurpose);
      cacheUploadedMedia(uri, {
        buffer: buf,
        contentType,
        filename,
        userId: session ? (session.userId || session.subject || '') : '',
      });
      writeJson(res, 200, {
        ok: true,
        uri,
        name: filename,
        size: buf.length,
        mime: contentType,
      }, cors);
      return;
    }
    const uri = await uploadMatrixMedia({
      homeserverUrl: uploadIdentity.homeserverUrl,
      accessToken: uploadIdentity.accessToken,
      filename,
      contentType,
      body: buf,
    });
    cacheUploadedMedia(uri, {
      buffer: buf,
      contentType,
      filename,
      userId: uploadIdentity.userId || '',
    });
    writeJson(res, 200, {
      ok: true,
      uri,
      name: filename,
      size: buf.length,
      mime: contentType,
    }, cors);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    const code = msg === 'file_too_large' ? 413 : 500;
    writeJson(res, code, { ok: false, error: msg }, cors);
  }
}

function resolveMatrixMediaIdentity(req, state) {
  const session = getSessionWithToken(req);
  if (session && session.accessToken && session.homeserverUrl) {
    return {
      homeserverUrl: session.homeserverUrl,
      accessToken: session.accessToken,
      userId: session.matrixUserId || session.userId || '',
    };
  }
  if (AUTH_ENABLED) return null;
  const runtimeMatrixConfig = readMatrixBootstrapConfig(state.runtime);
  return {
    homeserverUrl: firstValidValue(
      runtimeMatrixConfig && runtimeMatrixConfig.homeserverUrl,
      process.env.MATRIX_HOMESERVER_URL,
    ),
    accessToken: firstValidValue(
      runtimeMatrixConfig && runtimeMatrixConfig.accessToken,
      process.env.MATRIX_MBR_BOT_ACCESS_TOKEN,
      process.env.MATRIX_MBR_ACCESS_TOKEN,
    ),
    userId: firstValidValue(
      runtimeMatrixConfig && runtimeMatrixConfig.userId,
      process.env.MATRIX_MBR_BOT_USER,
      process.env.MATRIX_MBR_USER,
    ),
  };
}

function resolveRequestMatrixSession(req) {
  const session = getSessionWithToken(req);
  if (!session || !session.accessToken || !session.homeserverUrl) return null;
  return {
    homeserverUrl: session.homeserverUrl,
    accessToken: session.accessToken,
    userId: session.matrixUserId || session.userId || '',
    displayName: session.matrixUserId || session.displayName || session.userId || '',
  };
}

async function handleMatrixMediaProxyRequest(req, res, state, corsOrigin = null, mode = 'download') {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const cors = corsHeaders(req, corsOrigin);
  if (AUTH_ENABLED && !isAuthenticated(req)) {
    writeJson(res, 401, { ok: false, error: 'not_authenticated' }, cors);
    return;
  }
  const uri = String(url.searchParams.get('uri') || '').trim();
  const parsed = parseMatrixMxcUri(uri);
  if (!parsed) {
    writeJson(res, 400, { ok: false, error: 'invalid_mxc_uri' }, cors);
    return;
  }
  const filename = safeDownloadFilename(url.searchParams.get('filename') || parsed.mediaId);
  const cached = getCachedUploadedMedia(uri);
  if (cached && Buffer.isBuffer(cached.buffer)) {
    const disposition = mode === 'thumbnail' ? 'inline' : 'attachment';
    res.writeHead(200, {
      ...cors,
      'content-type': cached.contentType || 'application/octet-stream',
      'content-length': cached.buffer.length,
      'content-disposition': `${disposition}; filename="${safeDownloadFilename(cached.filename || filename)}"`,
      'cache-control': 'private, max-age=900',
    });
    res.end(cached.buffer);
    return;
  }
  const identity = resolveMatrixMediaIdentity(req, state);
  if (!identity || !identity.accessToken || !identity.homeserverUrl) {
    writeJson(res, 401, { ok: false, error: 'matrix_session_missing' }, cors);
    return;
  }
  const base = String(identity.homeserverUrl).replace(/\/+$/, '');
  const endpoint = mode === 'thumbnail'
    ? `${base}/_matrix/media/v3/thumbnail/${encodeURIComponent(parsed.serverName)}/${encodeURIComponent(parsed.mediaId)}?width=720&height=480&method=scale`
    : `${base}/_matrix/media/v3/download/${encodeURIComponent(parsed.serverName)}/${encodeURIComponent(parsed.mediaId)}`;
  try {
    const resp = await fetch(endpoint, {
      method: 'GET',
      headers: { authorization: `Bearer ${identity.accessToken}` },
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      writeJson(res, resp.status, {
        ok: false,
        error: 'matrix_media_fetch_failed',
        detail: detail.slice(0, 500),
      }, cors);
      return;
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    const contentType = resp.headers.get('content-type') || 'application/octet-stream';
    const disposition = mode === 'thumbnail' ? 'inline' : 'attachment';
    res.writeHead(200, {
      ...cors,
      'content-type': contentType,
      'content-length': buffer.length,
      'content-disposition': `${disposition}; filename="${filename}"`,
      'cache-control': 'private, max-age=900',
    });
    res.end(buffer);
  } catch (err) {
    writeJson(res, 502, {
      ok: false,
      error: 'matrix_media_proxy_failed',
      detail: err && err.message ? err.message : String(err),
    }, cors);
  }
}

function readPathEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return path.resolve(fallback);
  return path.resolve(String(raw));
}

const DEFAULT_LLM_DISPATCH_CONFIG = Object.freeze({
  enabled: true,
  provider: 'ollama',
  base_url: 'http://127.0.0.1:11434',
  model: 'mt-label',
  fallback_model: 'mt-label',
  timeout_ms: 120000,
  confidence_threshold: 0.78,
  max_candidates: 3,
  temperature: 0.1,
  max_tokens: 512,
});

const DEFAULT_LLM_SCENE_CONFIG = Object.freeze({
  enabled: true,
  timeout_ms: 8000,
  max_recent_intents: 20,
  temperature: 0.1,
  max_tokens: 260,
});

const DEFAULT_LLM_INTENT_PROMPT_TEMPLATE = [
  'You are an intent router for a ModelTable system.',
  'Return JSON only. No markdown fences.',
  'Input action: {{action}}',
  'Allowed actions (must choose from this list): {{available_actions}}',
  'Current scene context JSON: {{scene_context_json}}',
  'Mailbox payload JSON: {{mailbox_payload_json}}',
  'Output schema:',
  '{',
  '  "matched_action": "<string or empty>",',
  '  "confidence": <0..1 number>,',
  '  "reasoning": "<short string>",',
  '  "candidates": ["<string>", "<string>"]',
  '}',
].join('\n');

const DEFAULT_LLM_SCENE_PROMPT_TEMPLATE = [
  'You are a scene context updater.',
  'Return JSON only. No markdown fences.',
  'Current scene context JSON: {{scene_context_json}}',
  'Current action lifecycle JSON: {{action_lifecycle_json}}',
  'Current action: {{action}}',
  'Output schema:',
  '{',
  '  "current_app": <int or null>,',
  '  "active_flow": "<string or null>",',
  '  "flow_step": <int or null>,',
  '  "session_vars_patch": { "key": "value" }',
  '}',
].join('\n');

const DEFAULT_LLM_FILLTABLE_PROMPT_TEMPLATE = [
  'You are a strict ModelTable patch planner.',
  'Return exactly one JSON object and nothing else.',
  'User prompt: {{prompt_text}}',
  'Policy JSON: {{policy_json}}',
  'Allowed output schema JSON: {{output_schema_json}}',
  'Available positive model ids JSON: {{available_model_ids_json}}',
  'Model inventory JSON: {{model_inventory_json}}',
  'Output shape:',
  '{"proposal":{"summary":"...","operations":["..."],"queries":["..."],"requires_confirmation":true,"confirmation_question":"..."},"candidate_changes":[{"action":"set_label","target":{"model_id":100,"p":0,"r":0,"c":0,"k":"title"},"label":{"t":"str","v":"Demo"},"owner_hint":"modeltable_local_owner"}],"confidence":0.0,"reasoning":"..."}',
  'Rules:',
  '- JSON only, no markdown, no prose before or after JSON',
  '- never emit tool calls, XML tags, <think> blocks, or analysis outside the JSON object',
  '- operations and queries may be arrays of strings',
  '- candidate_changes only support action=set_label/remove_label',
  '- set_label requires target.model_id,target.p,target.r,target.c,target.k and label.t,label.v',
  '- remove_label requires target.model_id,target.p,target.r,target.c,target.k',
  '- max changes is 10',
  '- query-only requests must use candidate_changes: [] and put reads in proposal.queries',
  '- target.model_id must be one of available positive model ids',
  '- do not target model_id=0 or any negative model_id in candidate_changes',
  '- If model_inventory_json shows schema_fields for a target model, prefer those exact keys over inventing new keys',
  '- Map user phrases using schema_fields.key, ui_label, placeholder, and option labels/values before considering a new key',
  '- For enumerated fields with options, write the canonical option.value when it clearly matches the user request',
  '- Do not invent synonym keys like applicant_name when schema already has applicant',
  '- Only create a new non-schema key when the user explicitly names that new key and it is allowed by policy',
  '- If a field is ambiguous or no schema key matches confidently, omit that field from candidate_changes and ask one concise clarification question in proposal.confirmation_question',
  '- If the request needs structural changes or child-model creation that policy forbids, keep candidate_changes: [] and explain the block briefly in proposal.summary/confirmation_question',
  '- obey policy.allowed_label_types and policy.allow_structural_types',
  '- Structural t (func.js/func.python/pin.connect.label/pin.connect.cell/pin.bus.cb.in/pin.bus.cb.out/pin.bus.mb.in/pin.bus.mb.out/pin.table.in/pin.table.out/pin.single.in/pin.single.out/model.single/model.matrix/model.table/submt) are forbidden unless policy.allow_structural_types=true',
  '- pin.table.in / pin.table.out are for table-or-matrix models, and pin.single.in / pin.single.out are for model.single',
  '- For func.js/func.python, v must be object and include non-empty string field code',
  '- For pin.connect.*, v must be an array',
  '- For pin.bus.cb.* / pin.bus.mb.* / pin.table.* / pin.single.*, v must be JSON-serializable; use null for declaration-only ports when appropriate',
  '- For model.single/model.matrix/model.table, v must be a non-empty string',
  '- owner_hint is optional; if present, use modeltable_local_owner',
  '- Keep summary and reasoning short',
].join('\n');

function toFiniteNumber(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toIntInRange(value, fallback, minValue, maxValue) {
  const num = Math.trunc(toFiniteNumber(value, fallback));
  if (!Number.isFinite(num)) return fallback;
  return Math.min(maxValue, Math.max(minValue, num));
}

function toUnitInterval(value, fallback) {
  let num = toFiniteNumber(value, fallback);
  if (!Number.isFinite(num)) return fallback;
  if (num > 1 && num <= 100) {
    num = num / 100;
  }
  if (num < 0) num = 0;
  if (num > 1) num = 1;
  return num;
}

function normalizeLlmDispatchConfig(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = { ...DEFAULT_LLM_DISPATCH_CONFIG };
  if (typeof raw.enabled === 'boolean') out.enabled = raw.enabled;
  if (typeof raw.provider === 'string' && raw.provider.trim()) out.provider = raw.provider.trim();
  if (typeof raw.base_url === 'string' && raw.base_url.trim()) out.base_url = raw.base_url.trim();
  if (typeof raw.model === 'string' && raw.model.trim()) out.model = raw.model.trim();
  if (typeof raw.fallback_model === 'string' && raw.fallback_model.trim()) out.fallback_model = raw.fallback_model.trim();
  out.timeout_ms = toIntInRange(raw.timeout_ms, out.timeout_ms, 1000, 180000);
  out.confidence_threshold = toUnitInterval(raw.confidence_threshold, out.confidence_threshold);
  out.max_candidates = toIntInRange(raw.max_candidates, out.max_candidates, 1, 8);
  out.temperature = toFiniteNumber(raw.temperature, out.temperature);
  out.max_tokens = toIntInRange(raw.max_tokens, out.max_tokens, 32, 2048);
  return out;
}

function normalizeLlmSceneConfig(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = { ...DEFAULT_LLM_SCENE_CONFIG };
  if (typeof raw.enabled === 'boolean') out.enabled = raw.enabled;
  out.timeout_ms = toIntInRange(raw.timeout_ms, out.timeout_ms, 1000, 30000);
  out.max_recent_intents = toIntInRange(raw.max_recent_intents, out.max_recent_intents, 1, 50);
  out.temperature = toFiniteNumber(raw.temperature, out.temperature);
  out.max_tokens = toIntInRange(raw.max_tokens, out.max_tokens, 32, 2048);
  return out;
}

function readLlmDispatchConfig(runtime) {
  const model0 = runtime.getModel(0);
  const labelValue = model0 ? runtime.getLabelValue(model0, 0, 0, 0, 'llm_dispatch_config') : null;
  const cfg = normalizeLlmDispatchConfig(labelValue);
  if (readAuthString(process.env.DY_LLM_BASE_URL)) cfg.base_url = readAuthString(process.env.DY_LLM_BASE_URL);
  if (readAuthString(process.env.DY_LLM_MODEL)) cfg.model = readAuthString(process.env.DY_LLM_MODEL);
  if (readAuthString(process.env.DY_LLM_FALLBACK_MODEL)) cfg.fallback_model = readAuthString(process.env.DY_LLM_FALLBACK_MODEL);
  if (readAuthString(process.env.DY_LLM_ENABLED)) {
    cfg.enabled = readAuthString(process.env.DY_LLM_ENABLED) === '1' || readAuthString(process.env.DY_LLM_ENABLED).toLowerCase() === 'true';
  }
  if (readAuthString(process.env.DY_LLM_TIMEOUT_MS)) {
    cfg.timeout_ms = toIntInRange(process.env.DY_LLM_TIMEOUT_MS, cfg.timeout_ms, 1000, 180000);
  }
  if (readAuthString(process.env.DY_LLM_CONFIDENCE_THRESHOLD)) {
    cfg.confidence_threshold = toUnitInterval(process.env.DY_LLM_CONFIDENCE_THRESHOLD, cfg.confidence_threshold);
  }
  if (readAuthString(process.env.DY_LLM_MAX_TOKENS)) {
    cfg.max_tokens = toIntInRange(process.env.DY_LLM_MAX_TOKENS, cfg.max_tokens, 32, 2048);
  }
  if (readAuthString(process.env.DY_LLM_TEMPERATURE)) {
    cfg.temperature = toFiniteNumber(process.env.DY_LLM_TEMPERATURE, cfg.temperature);
  }
  return cfg;
}

function readLlmSceneConfig(runtime) {
  const model0 = runtime.getModel(0);
  const labelValue = model0 ? runtime.getLabelValue(model0, 0, 0, 0, 'llm_scene_config') : null;
  return normalizeLlmSceneConfig(labelValue);
}

function buildLlmUnavailableNotice(code, detail) {
  const safeDetail = readAuthString(detail);
  if (code === 'llm_disabled') {
    return '当前暂不可用：LLM 功能已禁用。';
  }
  if (code === 'invalid_target' && safeDetail === 'empty_prompt') {
    return '请输入 Prompt 后再执行。';
  }
  if (code === 'llm_unavailable') {
    return '当前暂不可用：未连接到 LLM 服务。';
  }
  if (code === 'llm_timeout') {
    return '当前暂不可用：LLM 请求超时。';
  }
  if (code === 'llm_http_error') {
    return '当前暂不可用：LLM 服务返回异常。';
  }
  if (safeDetail) {
    return `当前暂不可用：${safeDetail}`;
  }
  return '当前暂不可用：LLM 服务不可用。';
}

async function probeLlmPromptAvailability(runtime, options = {}) {
  const timeoutMs = toIntInRange(options.timeoutMs, 2500, 500, 15000);
  const cfg = readLlmDispatchConfig(runtime);
  if (!cfg.enabled) {
    return { available: false, code: 'llm_disabled', detail: 'llm_dispatch_disabled', cfg };
  }
  if (cfg.provider !== 'ollama') {
    return { available: false, code: 'llm_unavailable', detail: `unsupported_provider:${cfg.provider}`, cfg };
  }
  const baseUrlRaw = readAuthString(cfg.base_url);
  const modelRaw = readAuthString(cfg.model);
  if (!baseUrlRaw) {
    return { available: false, code: 'llm_unavailable', detail: 'missing_llm_base_url', cfg };
  }
  if (!modelRaw) {
    return { available: false, code: 'llm_unavailable', detail: 'missing_llm_model', cfg };
  }

  const endpoint = `${baseUrlRaw.replace(/\/+$/, '')}/api/tags`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('llm_timeout')), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { available: false, code: 'llm_http_error', detail: `status=${response.status}`, cfg };
    }
    let parsed = null;
    try {
      parsed = await response.json();
    } catch (_) {
      return { available: false, code: 'llm_bad_response', detail: 'llm_tags_not_json', cfg };
    }
    if (parsed && Array.isArray(parsed.models) && parsed.models.length > 0) {
      const modelNames = parsed.models
        .map((item) => {
          if (!item || typeof item !== 'object') return '';
          if (typeof item.model === 'string' && item.model.trim()) return item.model.trim();
          if (typeof item.name === 'string' && item.name.trim()) return item.name.trim();
          return '';
        })
        .filter(Boolean);
      if (modelNames.length > 0) {
        const exact = modelNames.some((name) => name === modelRaw);
        const prefix = modelNames.some((name) => name.startsWith(`${modelRaw}:`));
        if (!exact && !prefix) {
          return { available: false, code: 'llm_unavailable', detail: `model_not_found:${modelRaw}`, cfg };
        }
      }
    }
    return { available: true, code: 'ok', detail: '', cfg };
  } catch (err) {
    const name = err && typeof err === 'object' && typeof err.name === 'string' ? err.name : '';
    if (name === 'AbortError') {
      return { available: false, code: 'llm_timeout', detail: `timeout_ms=${timeoutMs}`, cfg };
    }
    return {
      available: false,
      code: 'llm_unavailable',
      detail: String(err && err.message ? err.message : err),
      cfg,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function overwriteLlmPromptAvailabilityState(runtime, availability) {
  const available = Boolean(availability && availability.available);
  const code = availability && typeof availability.code === 'string' ? availability.code : 'llm_unavailable';
  const detail = availability && typeof availability.detail === 'string' ? availability.detail : '';
  overwriteStateLabel(runtime, 'llm_prompt_available', 'bool', available);
  overwriteStateLabel(runtime, 'llm_prompt_notice', 'str', available ? '' : buildLlmUnavailableNotice(code, detail));
}

function readSystemPromptTemplate(runtime, key, fallback) {
  const sys = firstSystemModel(runtime);
  if (!sys) return fallback;
  const value = runtime.getLabelValue(sys, 0, 0, 0, key);
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return fallback;
}

function safeJsonStringify(value, fallback = '{}') {
  try {
    return JSON.stringify(value == null ? {} : value);
  } catch (_) {
    return fallback;
  }
}

function renderPromptTemplate(template, vars) {
  const source = typeof template === 'string' && template.length > 0 ? template : '';
  return source.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return '';
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

function extractFirstJsonObject(rawText) {
  if (typeof rawText !== 'string') return null;
  const text = rawText.trim();
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const content = fenced && fenced[1] ? fenced[1].trim() : text;

  try {
    return JSON.parse(content);
  } catch (_) {
    // continue
  }

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const candidate = content.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch (_) {
          // keep scanning
        }
      }
    }
  }
  return null;
}

function normalizeCandidateList(input, allowedSet, maxCount) {
  const arr = Array.isArray(input) ? input : [];
  const out = [];
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const action = item.trim();
    if (!action || !allowedSet.has(action)) continue;
    if (!out.includes(action)) out.push(action);
    if (out.length >= maxCount) break;
  }
  return out;
}

function parseLlmIntentResult(rawText, allowedActions, maxCandidates) {
  const allowedSet = new Set(Array.isArray(allowedActions) ? allowedActions : []);
  const parsed = extractFirstJsonObject(rawText);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, code: 'llm_parse_failed', detail: 'intent_json_parse_failed' };
  }

  const matchedRaw = typeof parsed.matched_action === 'string' ? parsed.matched_action.trim() : '';
  const matched = matchedRaw && allowedSet.has(matchedRaw) ? matchedRaw : '';
  const confidence = toUnitInterval(parsed.confidence, 0);
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : '';
  const candidates = normalizeCandidateList(parsed.candidates, allowedSet, Math.max(1, maxCandidates));
  if (matched && !candidates.includes(matched)) candidates.unshift(matched);

  return {
    ok: true,
    matched_action: matched,
    confidence,
    reasoning: reasoning.slice(0, 600),
    candidates: candidates.slice(0, Math.max(1, maxCandidates)),
  };
}

function parseLlmFilltableResult(rawText) {
  const parsed = extractFirstJsonObject(rawText);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, code: 'llm_parse_failed', detail: 'filltable_json_parse_failed' };
  }
  const candidate_changes = Array.isArray(parsed.candidate_changes) ? parsed.candidate_changes : [];
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.trim().slice(0, 1200) : '';
  const confidence = toUnitInterval(parsed.confidence, 0);
  const proposalRaw = parsed.proposal && typeof parsed.proposal === 'object' && !Array.isArray(parsed.proposal)
    ? parsed.proposal
    : {};
  const proposal = {
    summary: typeof proposalRaw.summary === 'string' ? proposalRaw.summary.trim().slice(0, 600) : '',
    operations: Array.isArray(proposalRaw.operations) ? proposalRaw.operations.slice(0, 20) : [],
    queries: Array.isArray(proposalRaw.queries) ? proposalRaw.queries.slice(0, 20) : [],
    requires_confirmation: typeof proposalRaw.requires_confirmation === 'boolean' ? proposalRaw.requires_confirmation : true,
    confirmation_question: typeof proposalRaw.confirmation_question === 'string'
      ? proposalRaw.confirmation_question.trim().slice(0, 280)
      : '',
  };
  return {
    ok: true,
    candidate_changes,
    reasoning,
    confidence,
    proposal,
  };
}

function createFilltablePreviewId() {
  const nonce = Math.random().toString(16).slice(2, 10);
  return `pf_${Date.now()}_${nonce}`;
}

function readFilltablePolicy(runtime) {
  const model0 = runtime.getModel(0);
  const raw = model0 ? runtime.getLabelValue(model0, 0, 0, 0, 'llm_filltable_policy') : null;
  return normalizeFilltablePolicy(raw);
}

function listPositiveModelIds(runtime, maxCount = 256) {
  const ids = [];
  const snap = runtime.snapshot();
  const models = snap && snap.models ? snap.models : {};
  for (const idText of Object.keys(models)) {
    const mid = Number(idText);
    if (!Number.isInteger(mid) || mid <= 0) continue;
    ids.push(mid);
    if (ids.length >= maxCount) break;
  }
  ids.sort((a, b) => a - b);
  return ids;
}

function summarizeFilltableChangeForProposal(change) {
  if (!change || typeof change !== 'object') return '';
  const action = typeof change.action === 'string' ? change.action.trim() : '';
  const target = change.target && typeof change.target === 'object' && !Array.isArray(change.target)
    ? change.target
    : {};
  const modelId = Number.isInteger(target.model_id) ? target.model_id : '?';
  const p = Number.isInteger(target.p) ? target.p : 0;
  const r = Number.isInteger(target.r) ? target.r : 0;
  const c = Number.isInteger(target.c) ? target.c : 0;
  const key = typeof target.k === 'string' ? target.k : '';
  if (action === 'set_label') {
    const type = change.label && typeof change.label === 'object' && typeof change.label.t === 'string'
      ? change.label.t
      : '?';
    return `set ${key}(${type}) on model ${modelId} cell(${p},${r},${c})`;
  }
  if (action === 'remove_label') {
    return `remove ${key} from model ${modelId} cell(${p},${r},${c})`;
  }
  return `${action || 'unknown'} on model ${modelId} cell(${p},${r},${c})`;
}

function normalizeFilltableProposal(rawProposal, acceptedChanges, rejectedChanges) {
  const proposal = rawProposal && typeof rawProposal === 'object' && !Array.isArray(rawProposal)
    ? rawProposal
    : {};
  const accepted = Array.isArray(acceptedChanges) ? acceptedChanges : [];
  const rejected = Array.isArray(rejectedChanges) ? rejectedChanges : [];
  const operations = [];
  const rawOperations = Array.isArray(proposal.operations) ? proposal.operations : [];
  for (const item of rawOperations) {
    if (operations.length >= 20) break;
    if (typeof item === 'string' && item.trim()) {
      operations.push({ summary: item.trim().slice(0, 280) });
      continue;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const summary = typeof item.summary === 'string' ? item.summary.trim().slice(0, 280) : '';
    if (!summary) continue;
    operations.push({
      summary,
      op: typeof item.op === 'string' ? item.op.trim() : undefined,
      model_id: Number.isInteger(item.model_id) ? item.model_id : undefined,
      p: Number.isInteger(item.p) ? item.p : undefined,
      r: Number.isInteger(item.r) ? item.r : undefined,
      c: Number.isInteger(item.c) ? item.c : undefined,
      k: typeof item.k === 'string' ? item.k : undefined,
      t: typeof item.t === 'string' ? item.t : undefined,
    });
  }
  if (operations.length === 0) {
    for (const change of accepted.slice(0, 10)) {
      const summary = summarizeFilltableChangeForProposal(change);
      if (!summary) continue;
      operations.push({
        summary,
        action: change.action,
        target: change.target,
        label_t: change.label && typeof change.label === 'object' ? change.label.t : undefined,
      });
    }
  }

  const queries = [];
  const rawQueries = Array.isArray(proposal.queries) ? proposal.queries : [];
  for (const item of rawQueries) {
    if (queries.length >= 20) break;
    if (typeof item === 'string' && item.trim()) {
      queries.push({ summary: item.trim().slice(0, 280) });
      continue;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const summary = typeof item.summary === 'string' ? item.summary.trim().slice(0, 280) : '';
    if (!summary) continue;
    queries.push({
      summary,
      target: typeof item.target === 'string' ? item.target.trim().slice(0, 180) : undefined,
    });
  }

  const acceptedCount = accepted.length;
  const rejectedCount = rejected.length;
  const defaultSummary = `planned writes=${acceptedCount}, rejected=${rejectedCount}, queries=${queries.length}`;
  const summary = typeof proposal.summary === 'string' && proposal.summary.trim()
    ? proposal.summary.trim().slice(0, 600)
    : defaultSummary;
  const confirmationQuestion = typeof proposal.confirmation_question === 'string' && proposal.confirmation_question.trim()
    ? proposal.confirmation_question.trim().slice(0, 280)
    : 'Please confirm apply for these label operations.';

  return {
    summary,
    operations,
    queries,
    requires_confirmation: true,
    confirmation_question: confirmationQuestion,
  };
}

function resolveFilltableOwner(change, runtime) {
  const target = change && typeof change === 'object' && change.target && typeof change.target === 'object'
    ? change.target
    : null;
  const modelId = target && Number.isInteger(target.model_id) ? target.model_id : null;
  if (!Number.isInteger(modelId) || modelId <= 0) {
    return { ok: false, code: 'owner_not_supported', detail: 'positive_model_id_required' };
  }
  if (typeof change.owner_hint === 'string' && change.owner_hint.trim() && change.owner_hint.trim() !== 'modeltable_local_owner') {
    return { ok: false, code: 'owner_not_supported', detail: 'owner_hint_not_supported' };
  }
  const model = runtime.getModel(modelId);
  if (!model) {
    return { ok: false, code: 'model_not_found', detail: String(modelId) };
  }
  return {
    ok: true,
    owner_id: `modeltable_local_owner:${modelId}`,
    owner_kind: 'modeltable_local_owner',
    model,
  };
}

function previewCandidateChangesByOwner(candidateChanges, runtime, policy) {
  const validation = validateFilltableCandidateChanges(candidateChanges, policy);
  const accepted_changes = [];
  const rejected_changes = validation.rejected_changes.slice();
  const ownerCounts = new Map();

  for (let i = 0; i < validation.accepted_changes.length; i += 1) {
    const change = validation.accepted_changes[i];
    const resolved = resolveFilltableOwner(change, runtime);
    if (!resolved.ok) {
      rejected_changes.push({ index: i, code: resolved.code, detail: resolved.detail, change });
      continue;
    }
    const normalized = {
      ...change,
      owner_id: resolved.owner_id,
      owner_kind: resolved.owner_kind,
    };
    accepted_changes.push(normalized);
    ownerCounts.set(resolved.owner_id, (ownerCounts.get(resolved.owner_id) || 0) + 1);
  }

  return {
    accepted_changes,
    rejected_changes,
    owner_plan: Array.from(ownerCounts.entries()).map(([owner_id, change_count]) => ({
      owner_id,
      owner_kind: 'modeltable_local_owner',
      change_count,
    })),
    stats: {
      ...validation.stats,
      accepted: accepted_changes.length,
      rejected: rejected_changes.length,
    },
    policy: validation.policy,
  };
}

function materializeFilltableChange(change) {
  const target = change && typeof change === 'object' && change.target && typeof change.target === 'object'
    ? change.target
    : null;
  if (!target) {
    return { ok: false, code: 'invalid_change', detail: 'missing_target' };
  }
  if (change.action === 'set_label') {
    const label = change.label && typeof change.label === 'object' && !Array.isArray(change.label)
      ? change.label
      : null;
    if (!label || typeof label.t !== 'string') {
      return { ok: false, code: 'invalid_change', detail: 'missing_label' };
    }
    return {
      ok: true,
      operation: {
        op: 'add_label',
        model_id: target.model_id,
        p: target.p,
        r: target.r,
        c: target.c,
        k: target.k,
        t: label.t,
        v: label.v,
      },
    };
  }
  if (change.action === 'remove_label') {
    return {
      ok: true,
      operation: {
        op: 'rm_label',
        model_id: target.model_id,
        p: target.p,
        r: target.r,
        c: target.c,
        k: target.k,
      },
    };
  }
  return { ok: false, code: 'invalid_change', detail: 'unsupported_action' };
}

function parseJsonObjectOrNull(value) {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

function parseOllamaGenerateResponseText(text, fallbackModel) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) {
    return { ok: false, code: 'llm_bad_response', detail: 'llm_empty_response' };
  }

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parsedLines = [];
  for (const line of lines) {
    try {
      parsedLines.push(JSON.parse(line));
    } catch (_) {
      if (lines.length === 1) {
        return { ok: false, code: 'llm_bad_response', detail: 'llm_response_not_json' };
      }
      return { ok: false, code: 'llm_bad_response', detail: 'llm_stream_chunk_not_json' };
    }
  }

  let model = typeof fallbackModel === 'string' && fallbackModel.trim() ? fallbackModel.trim() : '';
  let responseText = '';
  let evalDuration = null;
  let totalDuration = null;
  for (const item of parsedLines) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    if (typeof item.model === 'string' && item.model.trim()) model = item.model.trim();
    if (typeof item.response === 'string' && item.response.length > 0) responseText += item.response;
    if (Number.isFinite(item.eval_duration)) evalDuration = item.eval_duration;
    if (Number.isFinite(item.total_duration)) totalDuration = item.total_duration;
  }

  if (!responseText.trim()) {
    return { ok: false, code: 'llm_bad_response', detail: 'llm_empty_response' };
  }

  return {
    ok: true,
    data: {
      model,
      response: responseText,
      eval_duration: evalDuration,
      total_duration: totalDuration,
    },
  };
}

const LOCAL_EDITOR_ACTIONS = new Set([
  'label_add',
  'label_update',
  'label_remove',
  'cell_clear',
  'submodel_create',
  'datatable_refresh',
  'datatable_select_row',
  'datatable_edit_row',
  'datatable_view_detail',
  'datatable_remove_label',
  'cellab_add_cellA',
  'cellab_add_cellB',
]);

function shouldAttemptLlmIntentRouting(action) {
  if (typeof action !== 'string' || !action.trim()) return false;
  if (LOCAL_EDITOR_ACTIONS.has(action)) return false;
  if (action.startsWith('datatable_')) return false;
  if (action.startsWith('cellab_')) return false;
  return true;
}

function mergeSceneContext(baseValue, patchValue) {
  const base = baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue) ? baseValue : {};
  const patch = patchValue && typeof patchValue === 'object' && !Array.isArray(patchValue) ? patchValue : {};
  const merged = {
    current_app: Number.isInteger(base.current_app) ? base.current_app : 100,
    active_flow: typeof base.active_flow === 'string' ? base.active_flow : null,
    flow_step: Number.isInteger(base.flow_step) ? base.flow_step : 0,
    recent_intents: Array.isArray(base.recent_intents) ? base.recent_intents : [],
    last_action_result: base.last_action_result || null,
    session_vars: base.session_vars && typeof base.session_vars === 'object' && !Array.isArray(base.session_vars)
      ? { ...base.session_vars }
      : {},
  };

  if (Number.isInteger(patch.current_app) && patch.current_app > 0) {
    merged.current_app = patch.current_app;
  }
  if (typeof patch.active_flow === 'string') {
    merged.active_flow = patch.active_flow.slice(0, 120);
  } else if (patch.active_flow === null) {
    merged.active_flow = null;
  }
  if (Number.isInteger(patch.flow_step) && patch.flow_step >= 0) {
    merged.flow_step = patch.flow_step;
  }
  const patchVars = patch.session_vars_patch && typeof patch.session_vars_patch === 'object' && !Array.isArray(patch.session_vars_patch)
    ? patch.session_vars_patch
    : null;
  if (patchVars) {
    for (const [k, v] of Object.entries(patchVars)) {
      if (typeof k !== 'string' || !k.trim()) continue;
      merged.session_vars[k] = v;
    }
  }
  return merged;
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
      // NOTE: bus-event endpoint can carry base64 payloads (zip/html).
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
  if (ext === '.wasm') return 'application/wasm';
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

const DEFAULT_PERSIST_ROOT = readPathEnv(
  'DY_PERSIST_ROOT',
  path.resolve(process.env.HOME || process.cwd(), '.dongyuapp', 'persist'),
);
const DOCS_ROOT = readPathEnv('DOCS_ROOT', path.join(DEFAULT_PERSIST_ROOT, 'docs'));
const STATIC_PROJECTS_ROOT = readPathEnv('STATIC_PROJECTS_ROOT', path.join(DEFAULT_PERSIST_ROOT, 'static_projects'));
const AUTH_ENABLED = process.env.DY_AUTH !== '0';

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function isAllowedDocRelPath(relPath) {
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel.endsWith('.md')) return false;
  return true;
}

function listMarkdownFiles(rootDir, allowFn) {
  if (!rootDir || !fs.existsSync(rootDir)) return [];
  try {
    if (!fs.statSync(rootDir).isDirectory()) return [];
  } catch (_) {
    return [];
  }
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

function staticUploadCore(name, kind, buf) {
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
  return listStaticProjects();
}

const SLIDE_IMPORT_ALLOWED_UI_AUTHORING_VERSION = 'cellwise.ui.v1';
const SLIDE_IMPORT_HOST_INGRESS_LABEL = 'host_ingress_v1';
const SLIDE_IMPORT_HOST_INGRESS_SUPPORTED_SEMANTIC = 'submit';
const SLIDE_IMPORT_HOST_INGRESS_SUPPORTED_LOCATOR = 'root_relative_cell';
const SLIDE_IMPORT_HOST_INGRESS_SUPPORTED_VALUE_T = 'modeltable';
const SLIDE_IMPORT_DUAL_BUS_LABEL = 'dual_bus_model';
const SLIDE_IMPORT_REMOTE_BUS_ENDPOINT_LABEL = 'remote_bus_endpoint_v1';
const SLIDE_IMPORT_REPLY_PIN = 'result';
const SLIDE_IMPORT_FORBIDDEN_LABEL_TYPES = new Set([
  'func.python',
  '',
  'pin.bus.in',
  'pin.bus.out',
  'pin.bus.cb.in',
  'pin.bus.cb.out',
  'pin.bus.mb.in',
  'pin.bus.mb.out',
  'pin.connect.model',
  'ui.egress.binding.v1',
]);
const SLIDE_IMPORT_FORBIDDEN_LABEL_KEYS = new Set([
  'scope_privileged',
  'helper_executor',
  'owner_apply',
  'owner_apply_route',
  'owner_materialize',
]);
const SLIDE_EXPORT_EXCLUDED_LABEL_KEYS = new Set([
  'deletable',
  'installed_at',
  'imported_bundle_model_ids',
  'import_root_temp_id',
  'host_ingress_generated_model0_labels',
  'host_ingress_generated_mount',
  'host_ingress_generated_root_labels',
  'host_egress_generated_model0_labels',
  'host_egress_generated_mount',
  'mt_write',
  'mt_write_req',
  'mt_write_result',
  'mt_write_req_route',
  'mt_bus_receive',
  'mt_bus_receive_in',
  'mt_bus_receive_wiring',
  'mt_bus_send',
  'mt_bus_send_in',
  'mt_bus_send_wiring',
  'bus_event',
  'bus_event_last_op_id',
  'bus_event_error',
  'owner_request',
  'owner_route',
  'owner_materialize',
  'owner_pin_error',
  '__owner_last_request_id',
  '__owner_last_action',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidPublicPinName(value) {
  return typeof value === 'string'
    && value.trim() === value
    && /^[A-Za-z_][A-Za-z0-9_.-]*$/u.test(value);
}

function isSafePinRouteSegment(value) {
  return typeof value === 'string'
    && value.trim() === value
    && value.length > 0
    && !value.includes('/')
    && !value.includes('+')
    && !value.includes('#');
}

function readPinPayloadTableId(records, key, fallback = 'host') {
  const record = findTemporaryPayloadRecord(records, key);
  if (!record) return { ok: true, value: fallback, present: false };
  if (record.t !== 'str' || typeof record.v !== 'string' || !isSafePinRouteSegment(record.v)) {
    return { ok: false, code: 'invalid_pin_payload_records' };
  }
  return { ok: true, value: record.v, present: true };
}

function readPinPayloadEndpoint(records, prefix) {
  const table = readPinPayloadTableId(records, `${prefix}_table_id`, 'host');
  if (!table.ok) return null;
  return {
    worker_id: readTemporaryPayloadString(records, `${prefix}_worker_id`),
    table_id: table.value,
    table_id_present: table.present,
    model_id: readTemporaryPayloadInt(records, `${prefix}_model_id`),
    pin: readTemporaryPayloadString(records, `${prefix}_pin`),
  };
}

function isValidPinPayloadEndpoint(endpoint, options = {}) {
  if (!endpoint) return false;
  if (!isSafePinRouteSegment(endpoint.worker_id)) return false;
  if (!isSafePinRouteSegment(endpoint.table_id)) return false;
  if (!Number.isInteger(endpoint.model_id)) return false;
  const allowNonHostModelZero = options.allowNonHostModelZero === true;
  if (endpoint.table_id === 'host') {
    if (endpoint.model_id <= 0) return false;
  } else if (endpoint.model_id < 0 || (!allowNonHostModelZero && endpoint.model_id === 0)) {
    return false;
  }
  return isSafePinRouteSegment(endpoint.pin);
}

function isValidControlBusTopicBase(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
  const parts = value.split('/');
  return parts.length === 5
    && parts[0] === 'UIPUT'
    && parts.every((part) => isSafePinRouteSegment(part));
}

function isValidControlBusEndpointTopic(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
  const parts = value.split('/');
  return parts.length === 8
    && parts[0] === 'UIPUT'
    && parts.every((part) => isSafePinRouteSegment(part))
    && /^[1-9][0-9]*$/u.test(parts[6]);
}

function controlBusEndpointTopicParts(value) {
  if (!isValidControlBusEndpointTopic(value)) return null;
  const parts = value.split('/');
  return {
    base: parts.slice(0, 5).join('/'),
    endpoint: {
      worker_id: parts[5],
      model_id: Number(parts[6]),
      pin: parts[7],
    },
  };
}

function controlBusEndpointMatches(left, right) {
  return Boolean(left && right
    && left.worker_id === right.worker_id
    && left.model_id === right.model_id
    && left.pin === right.pin);
}

function buildControlBusEndpointTopicFromBase(base, endpoint) {
  if (!isValidControlBusTopicBase(base) || !endpoint) return '';
  if (!isSafePinRouteSegment(endpoint.worker_id)) return '';
  if (!Number.isInteger(endpoint.model_id) || endpoint.model_id <= 0) return '';
  if (!isSafePinRouteSegment(endpoint.pin)) return '';
  return `${base}/${endpoint.worker_id}/${endpoint.model_id}/${endpoint.pin}`;
}

function validatePinPayloadTopicContract({ messageRole, topic, responseTopic, endpoint, replyTarget }) {
  const topicParts = controlBusEndpointTopicParts(topic);
  if (!topicParts) return 'invalid_topic';
  const responseTopicParts = controlBusEndpointTopicParts(responseTopic);
  if (!responseTopicParts) return 'invalid_response_topic';
  if (responseTopicParts.base !== topicParts.base) return 'response_topic_mismatch';
  const replyTargetIsHost = !replyTarget || !replyTarget.table_id || replyTarget.table_id === 'host';
  if (replyTargetIsHost) {
    const expectedResponseTopic = buildControlBusEndpointTopicFromBase(topicParts.base, replyTarget);
    if (!expectedResponseTopic || responseTopic !== expectedResponseTopic) return 'response_topic_mismatch';
  }
  if (messageRole === 'request') {
    if (topic === responseTopic) return 'response_topic_mismatch';
    if (!controlBusEndpointMatches(topicParts.endpoint, endpoint)) return 'endpoint_mismatch';
    return null;
  }
  if (messageRole === 'response') {
    if (topic !== responseTopic) return 'response_topic_mismatch';
    if (!controlBusEndpointMatches(topicParts.endpoint, endpoint)) return 'endpoint_mismatch';
    if (replyTargetIsHost && !controlBusEndpointMatches(endpoint, replyTarget)) return 'endpoint_mismatch';
    return null;
  }
  return 'invalid_message_role';
}

function containsRouteReplyTo(value) {
  if (Array.isArray(value)) {
    return value.some((item) => containsRouteReplyTo(item));
  }
  if (!isPlainObject(value)) return false;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'reply_to' || key === 'route.reply_to') return true;
    if (containsRouteReplyTo(child)) return true;
  }
  return false;
}

function isLegacyPinPayloadKey(key) {
  return key === 'source_model_id'
    || key === 'pin'
    || key === 'route'
    || key === 'reply_to'
    || key === 'route.reply_to'
    || key === 'return_topic'
    || key === 'returnTopic'
    || key === 'result_topic';
}

function containsLegacyPinPayloadMetadata(value, seen = new WeakSet()) {
  if (!value) return false;
  if (Array.isArray(value)) {
    if (seen.has(value)) return false;
    seen.add(value);
    return value.some((item) => containsLegacyPinPayloadMetadata(item, seen));
  }
  if (!isPlainObject(value)) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (isLegacyPinPayloadKey(key)) return true;
    if (key === 'k' && typeof child === 'string' && isLegacyPinPayloadKey(child)) return true;
    if (key === 'route' && isPlainObject(child) && Object.prototype.hasOwnProperty.call(child, 'reply_to')) return true;
    if (containsLegacyPinPayloadMetadata(child, seen)) return true;
  }
  return false;
}

function containsLegacyPinPayloadMetadataInPinPayloadRecords(records) {
  const nestedPayloadLabel = findTemporaryPayloadRecord(records, 'payload');
  const nestedPayload = nestedPayloadLabel && nestedPayloadLabel.t === 'json' ? nestedPayloadLabel.v : null;
  const nestedKind = readTemporaryPayloadString(nestedPayload, '__mt_payload_kind');
  if (nestedKind !== 'slide_app_bundle_response.v1') {
    return containsLegacyPinPayloadMetadata(records);
  }
  const outerRecords = records.map((record) => (record && record.k === 'payload' ? { ...record, v: [] } : record));
  if (containsLegacyPinPayloadMetadata(outerRecords)) return true;
  for (const nestedRecord of nestedPayload) {
    if (!nestedRecord || typeof nestedRecord.k !== 'string') return true;
    if (isLegacyPinPayloadKey(nestedRecord.k)) return true;
    if (nestedRecord.k === 'bundle_payload') continue;
    if (containsLegacyPinPayloadMetadata(nestedRecord.v)) return true;
  }
  return false;
}

function resolveUiServerWorkerId() {
  const raw = process.env.DY_UI_SERVER_WORKER_ID || 'U1';
  const id = String(raw || '').trim();
  return id || 'U1';
}

function readModel0MqttTopicBase(runtime) {
  const model0 = runtime && typeof runtime.getModel === 'function' ? runtime.getModel(0) : null;
  const label = model0 ? runtime.getCell(model0, 0, 0, 0).labels.get('mqtt_topic_base') : null;
  return typeof label?.v === 'string' ? label.v.trim() : 'UIPUT/ws/dam/pic/de';
}

function buildEndpointTopic(runtime, endpoint) {
  const base = readModel0MqttTopicBase(runtime);
  return buildControlBusEndpointTopicFromBase(base, endpoint);
}

function buildRemoteEndpointTopic(runtime, remoteEndpoint, pinName) {
  const workerId = remoteEndpoint && remoteEndpoint.to ? remoteEndpoint.to.worker_id : '';
  const modelId = remoteEndpoint && remoteEndpoint.to ? remoteEndpoint.to.model_id : null;
  return buildEndpointTopic(runtime, { worker_id: workerId, model_id: modelId, pin: pinName });
}

function normalizeRemoteEndpointRouteKind(value) {
  if (!value || !Object.prototype.hasOwnProperty.call(value, 'route_kind')) return 'control';
  const routeKind = typeof value.route_kind === 'string' ? value.route_kind.trim() : '';
  return routeKind === 'control' || routeKind === 'management' ? routeKind : '';
}

function isSplitBusOutLabelType(typeName) {
  return typeName === 'pin.bus.cb.out' || typeName === 'pin.bus.mb.out';
}

function isTemporaryModelTableRecord(record) {
  if (!isPlainObject(record)) return false;
  const keys = Object.keys(record).sort();
  if (keys.length !== 7 || keys.join('|') !== 'c|id|k|p|r|t|v') return false;
  return Number.isInteger(record.id)
    && Number.isInteger(record.p)
    && Number.isInteger(record.r)
    && Number.isInteger(record.c)
    && typeof record.k === 'string'
    && record.k.length > 0
    && typeof record.t === 'string'
    && record.t.length > 0;
}

function isExpectedPinPayloadReturnRoute(content) {
  const parsed = parsePinPayloadRecordEnvelope(content);
  return Boolean(parsed.ok
    && parsed.replyTarget.worker_id === resolveUiServerWorkerId()
    && parsed.replyTarget.pin === 'result'
    && parsed.messageRole === 'response');
}

function sanitizeSlideExportName(input, fallback = 'slide-app') {
  const raw = String(input || '').trim().toLowerCase();
  const ascii = raw
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return ascii || fallback;
}

function shouldExcludeSlideExportLabel(label) {
  if (!label || typeof label.k !== 'string' || typeof label.t !== 'string') return true;
  if (SLIDE_EXPORT_EXCLUDED_LABEL_KEYS.has(label.k)) return true;
  if (SLIDE_IMPORT_FORBIDDEN_LABEL_KEYS.has(label.k) || String(label.k).startsWith('run_')) return true;
  if (SLIDE_IMPORT_FORBIDDEN_LABEL_TYPES.has(label.t)) return true;
  if (label.k.startsWith('__host_ingress_') || label.k.startsWith('__host_egress_')) return true;
  if (label.k.startsWith('host_ingress_generated_') || label.k.startsWith('host_egress_generated_')) return true;
  if (label.k.startsWith('bus_event')) return true;
  if (label.k.startsWith('__error_')) return true;
  if (label.k.startsWith('__owner_')) return true;
  return false;
}

function normalizeSlideExportRuntimeStateLabel(label, actualToTempId) {
  if (!label || typeof label.k !== 'string' || typeof label.t !== 'string') return label;
  if (label.t === 'pin.in' || label.t === 'pin.out') {
    return { ...label, v: null };
  }
  if (label.k === 'submit_inflight') {
    return { ...label, t: 'bool', v: false };
  }
  if (label.k === 'submit_inflight_started_at') {
    return { ...label, t: 'int', v: 0 };
  }
  if (
    label.k === 'status'
    || label.k === 'result_status'
    || label.k === 'remote_status'
    || label.k === 'conversation_status'
  ) {
    return { ...label, t: 'str', v: 'ready' };
  }
  return {
    ...label,
    v: normalizeSlideExportLabelValue(label, actualToTempId),
  };
}

function normalizeSlideExportRootRef(runtime, rootRef) {
  if (!runtime) return null;
  if (Number.isInteger(rootRef)) {
    return rootRef > 0 && runtime.getModel(rootRef) ? { table_id: 'host', model_id: rootRef } : null;
  }
  if (!rootRef || typeof rootRef !== 'object') return null;
  const tableId = typeof rootRef.table_id === 'string' && rootRef.table_id.trim() ? rootRef.table_id.trim() : 'host';
  const modelId = Number.isInteger(rootRef.model_id) ? rootRef.model_id : null;
  if (!Number.isInteger(modelId)) return null;
  if (tableId === 'host' && modelId <= 0) return null;
  if (tableId !== 'host' && modelId < 0) return null;
  return runtime.getModel({ table_id: tableId, model_id: modelId }) ? { table_id: tableId, model_id: modelId } : null;
}

function collectSlideExportModelRefs(runtime, rootRef) {
  const refs = [];
  const seen = new Set();
  const visit = (modelId) => {
    if (!Number.isInteger(modelId)) return;
    if (rootRef.table_id === 'host' && modelId <= 0) return;
    if (rootRef.table_id !== 'host' && modelId < 0) return;
    const key = `${rootRef.table_id}|${modelId}`;
    if (seen.has(key)) return;
    const model = runtime.getModel({ table_id: rootRef.table_id, model_id: modelId });
    if (!model) return;
    seen.add(key);
    refs.push({ table_id: rootRef.table_id, model_id: modelId });
    for (const cell of model.cells.values()) {
      for (const label of cell.labels.values()) {
        if (label && label.t === 'model.submt' && Number.isInteger(label.v)) {
          visit(label.v);
        }
      }
    }
  };
  visit(rootRef.model_id);
  return refs;
}

function remapSlideExportValue(value, actualToTempId) {
  if (Array.isArray(value)) {
    return value.map((item) => remapSlideExportValue(item, actualToTempId));
  }
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if ((key === 'model_id' || key.endsWith('_model_id')) && Number.isInteger(child) && actualToTempId.has(child)) {
      out[key] = actualToTempId.get(child);
    } else if (key === 'bus_in_key' && typeof child === 'string') {
      out[key] = child.replace(
        /^bus_event_(.+)_([1-9][0-9]*)_([0-9]+)_([0-9]+)_([0-9]+)$/u,
        (match, pinName, modelIdText, pText, rText, cText) => {
          const modelId = Number(modelIdText);
          if (!actualToTempId.has(modelId)) return match;
          return `bus_event_${pinName}_${actualToTempId.get(modelId)}_${pText}_${rText}_${cText}`;
        },
      );
    } else {
      out[key] = remapSlideExportValue(child, actualToTempId);
    }
  }
  return out;
}

function isModelIdReferenceKey(key) {
  return key === 'model_id' || (typeof key === 'string' && key.endsWith('_model_id'));
}

function normalizeSlideExportLabelValue(label, actualToTempId) {
  if (label && label.k === SLIDE_IMPORT_REMOTE_BUS_ENDPOINT_LABEL && isPlainObject(label.v)) {
    return normalizeRuntimeRemoteBusEndpoint(label.v) || label.v;
  }
  if (label && label.k === 'dual_bus_model' && isPlainObject(label.v)) {
    const mode = typeof label.v.mode === 'string' && label.v.mode.trim() ? label.v.mode.trim() : 'imported_host_egress';
    const egressPins = Array.isArray(label.v.egress_pins)
      ? Array.from(new Set(label.v.egress_pins.map((pin) => String(pin || '').trim()).filter(isValidPublicPinName)))
      : [];
    return { mode, egress_pins: egressPins };
  }
  if (label && label.t === 'model.submt' && Number.isInteger(label.v) && actualToTempId.has(label.v)) {
    return actualToTempId.get(label.v);
  }
  if (label && isModelIdReferenceKey(label.k) && Number.isInteger(label.v) && actualToTempId.has(label.v)) {
    return actualToTempId.get(label.v);
  }
  return remapSlideExportValue(label ? label.v : null, actualToTempId);
}

function buildSlideAppExportPayload(runtime, rootModelId) {
  const rootRef = normalizeSlideExportRootRef(runtime, rootModelId);
  if (!rootRef) {
    return { ok: false, code: 'invalid_target', detail: 'valid_slide_app_model_ref_required' };
  }
  const rootModel = runtime.getModel({ table_id: rootRef.table_id, model_id: rootRef.model_id });
  if (!rootModel) {
    return { ok: false, code: 'model_not_found', detail: `modelRef=${rootRef.table_id}/${rootRef.model_id}` };
  }
  const rootCell = runtime.getCell(rootModel, 0, 0, 0);
  const rootLabels = rootCell && rootCell.labels ? rootCell.labels : new Map();
  if (!rootLabels.has('slide_capable') || rootLabels.get('slide_capable').v !== true) {
    return { ok: false, code: 'not_exportable', detail: 'slide_capable_required' };
  }
  const modelRefs = collectSlideExportModelRefs(runtime, rootRef);
  const modelIds = modelRefs.map((ref) => ref.model_id);
  const actualToTempId = rootRef.table_id === 'host'
    ? new Map(modelIds.map((modelId, index) => [modelId, index]))
    : new Map(modelIds.map((modelId) => [modelId, modelId]));
  const records = [];
  for (const ref of modelRefs) {
    const tempId = actualToTempId.get(ref.model_id);
    const model = runtime.getModel({ table_id: ref.table_id, model_id: ref.model_id });
    if (!model) continue;
    const cells = Array.from(model.cells.values()).sort((a, b) => (
      (a.p - b.p) || (a.r - b.r) || (a.c - b.c)
    ));
    for (const cell of cells) {
      const labels = Array.from(cell.labels.values()).sort((a, b) => String(a.k).localeCompare(String(b.k)));
      for (const label of labels) {
        if (shouldExcludeSlideExportLabel(label)) continue;
        const normalizedLabel = normalizeSlideExportRuntimeStateLabel(label, actualToTempId);
        records.push({
          id: tempId,
          p: cell.p,
          r: cell.r,
          c: cell.c,
          k: normalizedLabel.k,
          t: normalizedLabel.t,
          v: normalizedLabel.v,
        });
      }
    }
  }
  const validation = validateSlideImportPayload(records);
  if (!validation.ok) {
    return { ok: false, code: validation.code || 'invalid_export', detail: validation.detail || 'export_payload_invalid' };
  }
  return { ok: true, data: { payload: records, modelIds, modelRefs, rootModelRef: rootRef } };
}

function buildSlideAppExportZip(runtime, rootModelId) {
  const payloadResult = buildSlideAppExportPayload(runtime, rootModelId);
  if (!payloadResult.ok) return payloadResult;
  const rootRef = payloadResult.data.rootModelRef;
  const model = runtime.getModel(rootRef);
  const appName = runtime.getLabelValue
    ? runtime.getLabelValue(model, 0, 0, 0, 'app_name')
    : '';
  const zipName = `${sanitizeSlideExportName(appName || (model && model.name) || `slide-app-${rootModelId}`)}.zip`;
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payloadResult.data.payload, null, 2), 'utf8'));
  return {
    ok: true,
    data: {
      filename: zipName,
      buffer: zip.toBuffer(),
      payload: payloadResult.data.payload,
      modelIds: payloadResult.data.modelIds,
    },
  };
}

function slideAppExportRefFromUrl(url) {
  const exportMatch = url.pathname.match(/^\/api\/slide-apps\/(\d+)\/export\.zip$/);
  const queryExport = url.pathname === '/api/slide-apps/export.zip';
  if (!exportMatch && !queryExport) return null;
  if (queryExport && !url.searchParams.has('table_id')) {
    return { ok: false, code: 'table_id_required' };
  }
  const tableId = queryExport
    ? String(url.searchParams.get('table_id') || '').trim()
    : 'host';
  const modelIdText = queryExport
    ? String(url.searchParams.get('model_id') || '').trim()
    : exportMatch[1];
  const modelId = /^(0|[1-9][0-9]*)$/u.test(modelIdText) ? Number(modelIdText) : NaN;
  if (!Number.isInteger(modelId) || !isSafePinRouteSegment(tableId)) {
    return { ok: false, code: 'invalid_export_ref' };
  }
  return { ok: true, ref: { table_id: tableId, model_id: modelId } };
}

function handleSlideAppExportRequest(req, res, state, corsOrigin = null) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const cors = corsHeaders(req, corsOrigin);
  const parsed = slideAppExportRefFromUrl(url);
  if (!parsed) return false;
  if (!parsed.ok) {
    writeJson(res, 400, { ok: false, error: parsed.code || 'invalid_export_ref' }, cors);
    return true;
  }
  const result = buildSlideAppExportZip(state.runtime, parsed.ref);
  if (!result || result.ok !== true) {
    const status = result && result.code === 'model_not_found' ? 404 : 400;
    writeJson(res, status, {
      ok: false,
      error: result && result.code ? result.code : 'export_failed',
      detail: result && result.detail ? result.detail : '',
    }, cors);
    return true;
  }
  const filename = result.data.filename || `slide-app-${parsed.ref.model_id}.zip`;
  res.writeHead(200, {
    'content-type': 'application/zip',
    'content-length': result.data.buffer.length,
    'content-disposition': `attachment; filename="${filename}"`,
    'cache-control': 'no-cache',
    ...cors,
  });
  res.end(result.data.buffer);
  return true;
}

function parseSlideImportPayloadFromZipBuffer(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries().filter((entry) => {
    if (!entry || entry.isDirectory) return false;
    return true;
  });
  const entryNames = entries.map((entry) => String(entry.entryName || '').replace(/\\/g, '/'));
  if (entryNames.some((name) => !name || name.startsWith('/') || name.split('/').includes('..'))) {
    throw new Error('zip_must_contain_exactly_one_app_payload_json');
  }
  if (entries.length !== 1 || String(entries[0].entryName || '').replace(/\\/g, '/') !== 'app_payload.json') {
    throw new Error('zip_must_contain_exactly_one_app_payload_json');
  }
  const raw = entries[0].getData().toString('utf8');
  const payload = JSON.parse(raw);
  if (!Array.isArray(payload)) {
    throw new Error('slide_import_payload_must_be_array');
  }
  return payload;
}

function groupTemporaryPayloadRecords(payload) {
  const groups = new Map();
  for (const record of payload) {
    if (!groups.has(record.id)) {
      groups.set(record.id, []);
    }
    groups.get(record.id).push(record);
  }
  return groups;
}

function findRootPayloadLabel(records, key) {
  return records.find((record) => (
    record
    && record.p === 0
    && record.r === 0
    && record.c === 0
    && record.k === key
  )) || null;
}

function readRootPayloadString(records, key) {
  const record = findRootPayloadLabel(records, key);
  return record && record.v != null ? String(record.v).trim() : '';
}

function readRootPayloadBool(records, key) {
  const record = findRootPayloadLabel(records, key);
  return record ? record.v === true : false;
}

function validateSlideImportHostIngress(records) {
  const declaration = findRootPayloadLabel(records, SLIDE_IMPORT_HOST_INGRESS_LABEL);
  if (!declaration) {
    return { ok: true, hostIngress: null };
  }
  if (declaration.t !== 'json' || !isPlainObject(declaration.v)) {
    return { ok: false, code: 'invalid_target', detail: 'invalid_host_ingress_shape' };
  }
  const boundaries = declaration.v.boundaries;
  if (!Array.isArray(boundaries) || boundaries.length === 0) {
    return { ok: false, code: 'invalid_target', detail: 'invalid_host_ingress_shape' };
  }
  const primaryBoundaries = boundaries.filter((entry) => isPlainObject(entry) && entry.primary === true);
  if (primaryBoundaries.length !== 1 || boundaries.length !== 1) {
    return { ok: false, code: 'invalid_target', detail: 'must_have_exactly_one_primary_host_ingress_boundary' };
  }
  const boundary = primaryBoundaries[0];
  const semantic = typeof boundary.semantic === 'string' ? boundary.semantic.trim() : '';
  const pinName = typeof boundary.pin_name === 'string' ? boundary.pin_name.trim() : '';
  const valueT = typeof boundary.value_t === 'string' ? boundary.value_t.trim() : '';
  if (semantic !== SLIDE_IMPORT_HOST_INGRESS_SUPPORTED_SEMANTIC) {
    return { ok: false, code: 'invalid_target', detail: 'unsupported_host_ingress_semantic' };
  }
  if (boundary.locator_kind !== SLIDE_IMPORT_HOST_INGRESS_SUPPORTED_LOCATOR) {
    return { ok: false, code: 'invalid_target', detail: 'unsupported_host_ingress_locator_kind' };
  }
  if (valueT !== SLIDE_IMPORT_HOST_INGRESS_SUPPORTED_VALUE_T) {
    return { ok: false, code: 'invalid_target', detail: 'unsupported_host_ingress_value_t' };
  }
  if (!pinName) {
    return { ok: false, code: 'invalid_target', detail: 'missing_host_ingress_pin_name' };
  }
  const locator = boundary.locator_value;
  if (!isPlainObject(locator) || !Number.isInteger(locator.p) || !Number.isInteger(locator.r) || !Number.isInteger(locator.c)) {
    return { ok: false, code: 'invalid_target', detail: 'invalid_host_ingress_locator_value' };
  }
  const targetPin = records.find((record) => (
    record
    && record.p === locator.p
    && record.r === locator.r
    && record.c === locator.c
    && record.k === pinName
  ));
  if (!targetPin || targetPin.t !== 'pin.in') {
    return { ok: false, code: 'invalid_target', detail: 'host_ingress_target_pin_missing' };
  }
  return {
    ok: true,
    hostIngress: {
      semantic,
      pinName,
      valueT,
      locator: {
        p: locator.p,
        r: locator.r,
        c: locator.c,
      },
      declaration: declaration.v,
    },
  };
}

function validateSlideImportRemoteBusEndpoint(records) {
  const declaration = findRootPayloadLabel(records, SLIDE_IMPORT_REMOTE_BUS_ENDPOINT_LABEL);
  if (!declaration) {
    return { ok: true, remoteEndpoint: null };
  }
  if (declaration.t !== 'json' || !isPlainObject(declaration.v)) {
    return { ok: false, code: 'invalid_target', detail: 'invalid_remote_bus_endpoint_shape' };
  }
  if (containsRouteReplyTo(declaration.v)) {
    return { ok: false, code: 'invalid_target', detail: 'remote_endpoint_must_not_declare_reply_to' };
  }
  const transport = typeof declaration.v.transport === 'string' ? declaration.v.transport.trim() : '';
  const to = isPlainObject(declaration.v.to) ? declaration.v.to : null;
  const workerId = to && typeof to.worker_id === 'string' ? to.worker_id.trim() : '';
  const modelId = to && Number.isInteger(to.model_id) ? to.model_id : null;
  const routeKind = normalizeRemoteEndpointRouteKind(declaration.v);
  if (transport !== 'mqtt' || !to || !isSafePinRouteSegment(workerId) || !Number.isInteger(modelId) || modelId <= 0) {
    return { ok: false, code: 'invalid_target', detail: 'invalid_remote_bus_endpoint_target' };
  }
  if (!routeKind) {
    return { ok: false, code: 'invalid_target', detail: 'invalid_remote_bus_endpoint_route_kind' };
  }
  if (Object.prototype.hasOwnProperty.call(to, 'pin')) {
    return { ok: false, code: 'invalid_target', detail: 'remote_endpoint_pin_is_runtime_owned' };
  }
  const endpointDeclaration = {
    transport,
    to: {
      worker_id: workerId,
      model_id: modelId,
    },
  };
  if (Object.prototype.hasOwnProperty.call(declaration.v, 'route_kind')) {
    endpointDeclaration.route_kind = routeKind;
  }
  return {
    ok: true,
    remoteEndpoint: {
      transport,
      route_kind: routeKind,
      to: {
        worker_id: workerId,
        model_id: modelId,
      },
      declaration: endpointDeclaration,
    },
  };
}

function validateSlideImportHostEgress(records) {
  const declaration = findRootPayloadLabel(records, SLIDE_IMPORT_DUAL_BUS_LABEL);
  if (!declaration) {
    return { ok: true, hostEgress: null };
  }
  if (declaration.t !== 'json' || !isPlainObject(declaration.v)) {
    return { ok: false, code: 'invalid_target', detail: 'invalid_dual_bus_model_shape' };
  }
  const mode = typeof declaration.v.mode === 'string' ? declaration.v.mode.trim() : '';
  if (mode !== 'imported_host_egress') {
    return { ok: false, code: 'invalid_target', detail: 'unsupported_dual_bus_model_mode' };
  }
  const egressPins = Array.isArray(declaration.v.egress_pins)
    ? declaration.v.egress_pins.map((pin) => String(pin || '').trim())
    : [];
  if (egressPins.length === 0) {
    return { ok: false, code: 'invalid_target', detail: 'dual_bus_model_egress_pins_required' };
  }
  const seenPins = new Set();
  const entries = [];
  for (const pinName of egressPins) {
    if (!isValidPublicPinName(pinName) || seenPins.has(pinName)) {
      return { ok: false, code: 'invalid_target', detail: 'invalid_dual_bus_model_egress_pin' };
    }
    seenPins.add(pinName);
    const targetPin = records.find((record) => (
      record
      && record.p === 0
      && record.r === 0
      && record.c === 0
      && record.k === pinName
    ));
    if (!targetPin || targetPin.t !== 'pin.out') {
      return { ok: false, code: 'invalid_target', detail: `host_egress_target_pin_missing:${pinName}` };
    }
    entries.push({
      semantic: pinName,
      pinName,
      dualBusDeclaration: {
        mode,
        egress_pins: [...egressPins],
      },
    });
  }
  return {
    ok: true,
    hostEgress: {
      mode,
      egressPins: [...egressPins],
      declaration: {
        mode,
        egress_pins: [...egressPins],
      },
      entries,
    },
  };
}

function validateSlideImportPayload(payload) {
  if (!Array.isArray(payload) || payload.length === 0) {
    return { ok: false, code: 'invalid_target', detail: 'empty_payload' };
  }
  const tempIds = new Set();
  for (const record of payload) {
    if (!record || !Number.isInteger(record.id) || record.id < 0) {
      return { ok: false, code: 'invalid_target', detail: 'invalid_temp_model_id' };
    }
    if (!Number.isInteger(record.p) || !Number.isInteger(record.r) || !Number.isInteger(record.c)) {
      return { ok: false, code: 'invalid_target', detail: 'invalid_prc' };
    }
    if (typeof record.k !== 'string' || !record.k.trim() || typeof record.t !== 'string' || !record.t.trim()) {
      return { ok: false, code: 'invalid_target', detail: 'invalid_label_shape' };
    }
    if (record.k === 'reply_to' || record.k === 'route.reply_to' || containsRouteReplyTo(record.v)) {
      return { ok: false, code: 'invalid_target', detail: 'bundle_must_not_declare_route_reply_to' };
    }
    if (SLIDE_IMPORT_FORBIDDEN_LABEL_KEYS.has(record.k) || String(record.k).startsWith('run_')) {
      return { ok: false, code: 'invalid_target', detail: `forbidden_label_key:${record.k}` };
    }
    if (SLIDE_IMPORT_FORBIDDEN_LABEL_TYPES.has(record.t)) {
      return { ok: false, code: 'invalid_target', detail: `forbidden_label_type:${record.t}` };
    }
    if (record.t === 'func.js') {
      if (!record.v || typeof record.v !== 'object' || Array.isArray(record.v) || typeof record.v.code !== 'string' || !record.v.code.trim()) {
        return { ok: false, code: 'invalid_target', detail: 'invalid_func_js_shape' };
      }
    }
    tempIds.add(record.id);
  }

  const groups = groupTemporaryPayloadRecords(payload);
  const rootCandidates = [];
  for (const [tempId, records] of groups.entries()) {
    if (readRootPayloadBool(records, 'slide_capable') !== true) continue;
    const modelType = findRootPayloadLabel(records, 'model_type');
    if (!modelType || modelType.t !== 'model.table') {
      return { ok: false, code: 'invalid_target', detail: 'slide_root_must_be_model_table' };
    }
    const appName = readRootPayloadString(records, 'app_name');
    const slideSummary = readRootPayloadString(records, 'slide_app_summary');
    const sourceWorker = readRootPayloadString(records, 'source_worker');
    const slideSurfaceType = readRootPayloadString(records, 'slide_surface_type');
    const fromUser = readRootPayloadString(records, 'from_user');
    const toUser = readRootPayloadString(records, 'to_user');
    const authoringVersion = readRootPayloadString(records, 'ui_authoring_version');
    const rootNodeId = readRootPayloadString(records, 'ui_root_node_id');
    if (!appName || !sourceWorker || !slideSurfaceType || !fromUser || !toUser || !rootNodeId) {
      return { ok: false, code: 'invalid_target', detail: 'missing_slide_root_metadata' };
    }
    if (!slideSummary || slideSummary.trim().length < 8) {
      return { ok: false, code: 'invalid_target', detail: 'missing_slide_app_summary' };
    }
    if (authoringVersion !== SLIDE_IMPORT_ALLOWED_UI_AUTHORING_VERSION) {
      return { ok: false, code: 'invalid_target', detail: 'unsupported_ui_authoring_version' };
    }
    const hostIngressValidation = validateSlideImportHostIngress(records);
    if (!hostIngressValidation.ok) {
      return hostIngressValidation;
    }
    const remoteEndpointValidation = validateSlideImportRemoteBusEndpoint(records);
    if (!remoteEndpointValidation.ok) {
      return remoteEndpointValidation;
    }
    const hostEgressValidation = validateSlideImportHostEgress(records);
    if (!hostEgressValidation.ok) {
      return hostEgressValidation;
    }
    if (hostEgressValidation.hostEgress && !remoteEndpointValidation.remoteEndpoint) {
      return { ok: false, code: 'invalid_target', detail: 'remote_bus_endpoint_required_for_host_egress' };
    }
    if (remoteEndpointValidation.remoteEndpoint && !hostEgressValidation.hostEgress) {
      return { ok: false, code: 'invalid_target', detail: 'dual_bus_model_required_for_remote_bus_endpoint' };
    }
    rootCandidates.push({
      tempId,
      appName,
      slideSummary,
      sourceWorker,
      slideSurfaceType,
      fromUser,
      toUser,
      hostIngress: hostIngressValidation.hostIngress,
      hostEgress: hostEgressValidation.hostEgress,
      remoteEndpoint: remoteEndpointValidation.remoteEndpoint,
    });
  }

  if (rootCandidates.length !== 1) {
    return { ok: false, code: 'invalid_target', detail: 'must_have_exactly_one_slide_root' };
  }

  return {
    ok: true,
    rootTempId: rootCandidates[0].tempId,
    tempIds: [...tempIds].sort((a, b) => a - b),
    metadata: rootCandidates[0],
    hostIngress: rootCandidates[0].hostIngress,
    hostEgress: rootCandidates[0].hostEgress,
    remoteEndpoint: rootCandidates[0].remoteEndpoint,
  };
}

function remapImportedValue(value, idMap) {
  if (Array.isArray(value)) {
    return value.map((item) => remapImportedValue(item, idMap));
  }
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (
      (key === 'model_id' || key.endsWith('_model_id'))
      && Number.isInteger(child)
      && idMap.has(child)
    ) {
      out[key] = idMap.get(child);
      continue;
    }
    if (key === 'bus_in_key' && typeof child === 'string') {
      out[key] = child.replace(
        /^bus_event_(.+)_([0-9]+)_([0-9]+)_([0-9]+)_([0-9]+)$/u,
        (match, pinName, tempIdText, pText, rText, cText) => {
          void pText;
          void rText;
          void cText;
          const tempId = Number(tempIdText);
          if (!idMap.has(tempId)) return match;
          return buildImportedHostIngressKeys(idMap.get(tempId), pinName).ingressKey;
        },
      );
      continue;
    }
    out[key] = remapImportedValue(child, idMap);
  }
  return out;
}

function remapImportedLabelValue(record, idMap) {
  if (record.t === 'model.submt' && Number.isInteger(record.v) && idMap.has(record.v)) {
    return idMap.get(record.v);
  }
  if (isModelIdReferenceKey(record.k) && Number.isInteger(record.v) && idMap.has(record.v)) {
    return idMap.get(record.v);
  }
  if (isPlainObject(record.v) || Array.isArray(record.v)) {
    return remapImportedValue(record.v, idMap);
  }
  return record.v;
}

function resolveNextWorkspaceMountCell(runtime) {
  const model0 = runtime.getModel(0);
  if (!model0) return { p: 2, r: 0, c: 0 };
  let maxC = -1;
  for (const cell of model0.cells.values()) {
    if (cell.p !== 2 || cell.r !== 0) continue;
    for (const label of cell.labels.values()) {
      if (label && (label.t === 'model.submt' || label.t === 'model.subtable')) {
        maxC = Math.max(maxC, cell.c);
      }
    }
  }
  return { p: 2, r: 0, c: maxC + 1 };
}

function sanitizeSlideAppTableSegment(value, fallback = 'slide-app') {
  const raw = String(value || '').trim().toLowerCase();
  const ascii = raw
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return ascii || fallback;
}

function readRuntimePrincipalOwnerId(runtime) {
  const direct = runtime && typeof runtime.principalOwnerId === 'string' ? runtime.principalOwnerId.trim() : '';
  if (direct) return direct;
  const key = readRuntimePrincipalKey(runtime);
  if (key.includes(':')) {
    const [, value] = key.split(/:(.*)/s);
    if (value && value.trim()) return value.trim();
  }
  return key || 'local-dev';
}

function buildSlideAppInstanceTableId(runtime, validation, mountCell) {
  const owner = sanitizeSlideAppTableSegment(readRuntimePrincipalOwnerId(runtime), 'local-dev');
  const app = sanitizeSlideAppTableSegment(validation?.metadata?.appName || 'slide-app');
  const cellSuffix = mountCell && Number.isInteger(mountCell.p) && Number.isInteger(mountCell.r) && Number.isInteger(mountCell.c)
    ? `${mountCell.p}-${mountCell.r}-${mountCell.c}`
    : '0-0-0';
  const base = `app:${owner}:${app}:${cellSuffix}`;
  let index = 1;
  let candidate = `${base}:${index}`;
  while (runtime && runtime.modelTables instanceof Map && runtime.modelTables.has(candidate)) {
    index += 1;
    candidate = `${base}:${index}`;
  }
  return candidate;
}

function buildImportedHostIngressKeys(rootModelId, semantic) {
  const base = `imported_host_${semantic}_${rootModelId}`;
  return {
    ingressKey: base,
    routeKey: `${base}_route`,
    relayPin: `__host_ingress_${semantic}`,
    relayRouteKey: `__host_ingress_${semantic}_route`,
  };
}

function buildImportedHostEgressKeys(rootModelId, semantic) {
  const base = `imported_${semantic}_${rootModelId}`;
  return {
    busOutKey: `${base}_bus`,
    mountRelayPin: `__host_egress_${semantic}_relay_${rootModelId}`,
    mountBridgeKey: `__host_egress_${semantic}_bridge_${rootModelId}`,
    model0BridgeIn: `__host_egress_${semantic}_bridge_in_${rootModelId}`,
    model0BridgeRouteKey: `${base}_route`,
    model0BridgeWiringKey: `${base}_bridge_wiring`,
    bridgeFunc: `bridge_imported_${semantic}_to_mt_bus_send_${rootModelId}`,
  };
}

function findModel0SubmodelMount(runtime, childModelId) {
  const model0 = runtime.getModel(0);
  if (!model0) return null;
  for (const cell of model0.cells.values()) {
    for (const label of cell.labels.values()) {
      if (label && label.t === 'model.submt' && label.v === childModelId) {
        return { p: cell.p, r: cell.r, c: cell.c };
      }
    }
  }
  return null;
}

function ensureModel0SubmodelMount(runtime, childModelId, preferredCell = null) {
  const existing = findModel0SubmodelMount(runtime, childModelId);
  if (existing) return existing;
  const model0 = runtime.getModel(0);
  if (!model0) return null;
  const mountCell = preferredCell && Number.isInteger(preferredCell.p) && Number.isInteger(preferredCell.r) && Number.isInteger(preferredCell.c)
    ? preferredCell
    : { p: 9, r: 0, c: Math.abs(childModelId) };
  runtime.addLabel(model0, mountCell.p, mountCell.r, mountCell.c, { k: 'model_type', t: 'model.submt', v: childModelId });
  return mountCell;
}

function materializeImportedHostIngressAdapter(runtime, rootModelId, mountCell, hostIngress) {
  if (!hostIngress) return null;
  const rootModel = runtime.getModel(rootModelId);
  const model0 = runtime.getModel(0);
  if (!rootModel || !model0 || !mountCell) return null;
  const keys = buildImportedHostIngressKeys(rootModelId, hostIngress.semantic);
  runtime.addLabel(rootModel, 0, 0, 0, { k: keys.relayPin, t: 'pin.in', v: null });
  runtime.addLabel(rootModel, 0, 0, 0, {
    k: keys.relayRouteKey,
    t: 'pin.connect.cell',
    v: [{
      from: [0, 0, 0, keys.relayPin],
      to: [[hostIngress.locator.p, hostIngress.locator.r, hostIngress.locator.c, hostIngress.pinName]],
    }],
  });
  runtime.addLabel(model0, mountCell.p, mountCell.r, mountCell.c, { k: keys.relayPin, t: 'pin.in', v: null });
  runtime.addLabel(model0, 0, 0, 0, { k: keys.ingressKey, t: 'pin.bus.cb.in', v: null });
  runtime.addLabel(model0, 0, 0, 0, {
    k: keys.routeKey,
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, keys.ingressKey], to: [[mountCell.p, mountCell.r, mountCell.c, keys.relayPin]] }],
  });
  runtime.addLabel(rootModel, 0, 0, 0, { k: 'host_ingress_generated_model0_labels', t: 'json', v: [keys.ingressKey, keys.routeKey] });
  runtime.addLabel(rootModel, 0, 0, 0, {
    k: 'host_ingress_generated_mount',
    t: 'json',
    v: { p: mountCell.p, r: mountCell.r, c: mountCell.c, keys: [keys.relayPin] },
  });
  runtime.addLabel(rootModel, 0, 0, 0, { k: 'host_ingress_generated_root_labels', t: 'json', v: [keys.relayPin, keys.relayRouteKey] });
  return keys;
}

function materializeImportedHostEgressAdapter(runtime, rootModelId, mountCell, hostEgress, remoteEndpoint) {
  if (!hostEgress) return null;
  const rootModel = runtime.getModel(rootModelId);
  const model0 = runtime.getModel(0);
  if (!rootModel || !model0 || !mountCell) {
    runtime.eventLog.record({
      op: 'host_egress_adapter_skipped',
      cell: { model_id: rootModelId, p: 0, r: 0, c: 0 },
      label: { k: 'host_egress_v1', t: 'json' },
      result: 'skipped',
      reason: !rootModel ? 'root_model_missing'
        : !model0 ? 'model0_missing'
        : 'mount_cell_missing',
    });
    return null;
  }
  if (!remoteEndpoint || !remoteEndpoint.to) return null;
  const keys = buildImportedHostEgressKeys(rootModelId, hostEgress.semantic);
  const routeTopic = buildRemoteEndpointTopic(runtime, remoteEndpoint, hostEgress.pinName);
  const responseTopic = buildEndpointTopic(runtime, {
    worker_id: resolveUiServerWorkerId(),
    model_id: rootModelId,
    pin: SLIDE_IMPORT_REPLY_PIN,
  });
  const routeKind = normalizeRemoteEndpointRouteKind(remoteEndpoint) || 'control';
  const hostPinType = routeKind === 'management' ? 'pin.bus.mb.out' : 'pin.bus.cb.out';
  const rootCell = runtime.getCell(rootModel, 0, 0, 0);
  const rootIngressPins = rootCell
    ? Array.from(rootCell.labels.entries())
      .filter(([, label]) => label && label.t === 'pin.in')
      .map(([key]) => key)
    : [];
  for (const pinName of rootIngressPins) {
    runtime.addLabel(model0, mountCell.p, mountCell.r, mountCell.c, { k: pinName, t: 'pin.in', v: null });
  }
  runtime.addLabel(model0, mountCell.p, mountCell.r, mountCell.c, { k: hostEgress.pinName, t: 'pin.out', v: null });
  runtime.addLabel(model0, 0, 0, 0, { k: keys.busOutKey, t: hostPinType, v: null });
  runtime.addLabel(model0, 0, 0, 0, { k: keys.model0BridgeIn, t: 'pin.in', v: null });
  runtime.addLabel(model0, 0, 0, 0, {
    k: keys.bridgeFunc,
    t: 'func.js',
    v: {
      code: [
        `const opId = 'imported_${rootModelId}_' + Date.now() + '_' + Math.random().toString(16).slice(2);`,
        `const mt = (k, t, v) => ({ id: 0, p: 0, r: 0, c: 0, k, t, v });`,
        `const payload = Array.isArray(label && label.v) ? label.v : [];`,
        `const principalLabel = V1N.readLabel(0, 0, 0, 'principal_runtime_key');`,
        `const principalKey = principalLabel && principalLabel.t === 'str' && typeof principalLabel.v === 'string' ? principalLabel.v : '';`,
        `V1N.addLabel('mt_bus_send_in', 'pin.in', [`,
        `  mt('__mt_payload_kind', 'str', 'bus_send.v1'),`,
        `  mt('__mt_request_id', 'str', opId),`,
        `  mt('message_role', 'str', 'request'),`,
        `  mt('bus', 'str', ${JSON.stringify(routeKind)}),`,
        `  mt('route_kind', 'str', ${JSON.stringify(routeKind)}),`,
        `  mt('topic', 'str', ${JSON.stringify(routeTopic)}),`,
        `  mt('response_topic', 'str', ${JSON.stringify(responseTopic)}),`,
        `  mt('bus_out_key', 'str', ${JSON.stringify(keys.busOutKey)}),`,
        `  mt('endpoint_worker_id', 'str', ${JSON.stringify(remoteEndpoint.to.worker_id)}),`,
        `  mt('endpoint_table_id', 'str', 'host'),`,
        `  mt('endpoint_model_id', 'int', ${remoteEndpoint.to.model_id}),`,
        `  mt('endpoint_pin', 'str', ${JSON.stringify(hostEgress.pinName)}),`,
        `  mt('origin_worker_id', 'str', ${JSON.stringify(resolveUiServerWorkerId())}),`,
        `  mt('origin_table_id', 'str', 'host'),`,
        `  mt('origin_model_id', 'int', ${rootModelId}),`,
        `  mt('origin_pin', 'str', ${JSON.stringify(hostEgress.pinName)}),`,
        `  mt('reply_target_worker_id', 'str', ${JSON.stringify(resolveUiServerWorkerId())}),`,
        `  mt('reply_target_table_id', 'str', 'host'),`,
        `  mt('reply_target_model_id', 'int', ${rootModelId}),`,
        `  mt('reply_target_pin', 'str', ${JSON.stringify(SLIDE_IMPORT_REPLY_PIN)}),`,
        `  ...(principalKey ? [mt('reply_target_principal_key', 'str', principalKey)] : []),`,
        `  mt('payload', 'json', payload),`,
        `]);`,
        'return;',
      ].join('\n'),
    },
  });
  runtime.addLabel(model0, 0, 0, 0, {
    k: keys.model0BridgeWiringKey,
    t: 'pin.connect.label',
    v: [{
      from: keys.model0BridgeIn,
      to: [`${keys.bridgeFunc}:in`],
    }],
  });
  runtime.addLabel(model0, 0, 0, 0, {
    k: keys.model0BridgeRouteKey,
    t: 'pin.connect.cell',
    v: [{
      from: [mountCell.p, mountCell.r, mountCell.c, hostEgress.pinName],
      to: [[0, 0, 0, keys.model0BridgeIn]],
    }],
  });
  const existingGenerated = runtime.getLabelValue(rootModel, 0, 0, 0, 'host_egress_generated_model0_labels');
  const generatedModel0Labels = Array.from(new Set([
    ...(Array.isArray(existingGenerated) ? existingGenerated : []),
    keys.busOutKey,
    keys.model0BridgeIn,
    keys.model0BridgeWiringKey,
    keys.model0BridgeRouteKey,
    keys.bridgeFunc,
  ]));
  runtime.addLabel(rootModel, 0, 0, 0, {
    k: 'host_egress_generated_model0_labels',
    t: 'json',
    v: generatedModel0Labels,
  });
  const existingMount = runtime.getLabelValue(rootModel, 0, 0, 0, 'host_egress_generated_mount');
  const mountKeys = Array.from(new Set([
    ...((existingMount && Array.isArray(existingMount.keys)) ? existingMount.keys : []),
    ...rootIngressPins,
    hostEgress.pinName,
  ]));
  runtime.addLabel(rootModel, 0, 0, 0, {
    k: 'host_egress_generated_mount',
    t: 'json',
    v: {
      p: mountCell.p,
      r: mountCell.r,
      c: mountCell.c,
      keys: mountKeys,
    },
  });
  runtime.addLabel(rootModel, 0, 0, 0, {
    k: `ui_egress_${hostEgress.pinName}_binding`,
    t: 'ui.egress.binding.v1',
    v: {
      from_pin: hostEgress.pinName,
      bus: routeKind,
      host_model_id: 0,
      host_cell: [0, 0, 0],
      host_pin_type: hostPinType,
      host_pin_key: keys.busOutKey,
      target: {
        transport: remoteEndpoint.transport,
        route_kind: routeKind,
        worker_id: remoteEndpoint.to.worker_id,
        model_id: remoteEndpoint.to.model_id,
        pin: hostEgress.pinName,
        topic: routeTopic,
      },
      reply_pin: SLIDE_IMPORT_REPLY_PIN,
      owned_by: 'ui-server-installer',
    },
  });
  return keys;
}

function normalizeRuntimeRemoteBusEndpoint(value) {
  if (!isPlainObject(value) || containsRouteReplyTo(value)) return null;
  const transport = typeof value.transport === 'string' ? value.transport.trim() : '';
  const to = isPlainObject(value.to) ? value.to : null;
  const workerId = to && typeof to.worker_id === 'string' ? to.worker_id.trim() : '';
  const modelId = to && Number.isInteger(to.model_id) ? to.model_id : null;
  const routeKind = normalizeRemoteEndpointRouteKind(value);
  if (transport !== 'mqtt' || !to || !workerId || !Number.isInteger(modelId) || modelId <= 0) return null;
  if (!routeKind) return null;
  if (Object.prototype.hasOwnProperty.call(to, 'pin')) return null;
  const normalized = {
    transport,
    to: {
      worker_id: workerId,
      model_id: modelId,
    },
  };
  if (Object.prototype.hasOwnProperty.call(value, 'route_kind')) {
    normalized.route_kind = routeKind;
  }
  return normalized;
}

function readRuntimeHostEgressEntries(runtime, rootModelId) {
  const rootModel = runtime.getModel(rootModelId);
  if (!rootModel) return [];
  const rootCell = runtime.getCell(rootModel, 0, 0, 0);
  const declaration = rootCell.labels.get(SLIDE_IMPORT_DUAL_BUS_LABEL)?.v ?? null;
  if (!isPlainObject(declaration) || declaration.mode !== 'imported_host_egress') return [];
  const egressPins = Array.isArray(declaration.egress_pins)
    ? declaration.egress_pins.map((pin) => String(pin || '').trim())
    : [];
  const seenPins = new Set();
  const entries = [];
  for (const pinName of egressPins) {
    if (!isValidPublicPinName(pinName) || seenPins.has(pinName)) return [];
    seenPins.add(pinName);
    const targetPin = rootCell.labels.get(pinName);
    if (!targetPin || targetPin.t !== 'pin.out') return [];
    entries.push({
      semantic: pinName,
      pinName,
      dualBusDeclaration: {
        mode: declaration.mode,
        egress_pins: [...egressPins],
      },
    });
  }
  return entries;
}

function materializeDeclaredHostEgressAdapters(runtime) {
  const materialized = [];
  for (const [modelId] of runtime.models) {
    if (!Number.isInteger(modelId) || modelId <= 0) continue;
    const rootModel = runtime.getModel(modelId);
    if (!rootModel) continue;
    const rootCell = runtime.getCell(rootModel, 0, 0, 0);
    const remoteEndpoint = normalizeRuntimeRemoteBusEndpoint(rootCell.labels.get(SLIDE_IMPORT_REMOTE_BUS_ENDPOINT_LABEL)?.v ?? null);
    if (!remoteEndpoint) continue;
    const entries = readRuntimeHostEgressEntries(runtime, modelId);
    if (entries.length === 0) continue;
    const mountCell = ensureModel0SubmodelMount(runtime, modelId);
    if (!mountCell) continue;
    for (const entry of entries) {
      const keys = materializeImportedHostEgressAdapter(runtime, modelId, mountCell, entry, remoteEndpoint);
      if (keys) materialized.push({ model_id: modelId, pin: entry.pinName });
    }
  }
  return materialized;
}

function reapplyAuthoritativePositiveSurface(runtime, { assetRoot, systemModelsDir }) {
  if (!runtime) return;
  if (assetRoot) {
    applyPersistedAssetEntries(runtime, {
      assetRoot,
      scope: 'ui-server',
      authority: 'authoritative',
      kind: 'patch',
      phases: ['30-system-positive'],
      applyOptions: { allowCreateModel: true, trustedBootstrap: true },
    });
    return;
  }
  loadFullModelPatches(runtime, systemModelsDir, [
    'workspace_positive_models.json',
    'doc_page_filltable_example_minimal.json',
    'slide_app_provider_docs_ui.json',
    'test_model_100_ui.json',
    'workspace_manager_asset_manager_ui.json',
    'runtime_hierarchy_mounts.json',
  ]);
}

function materializeSlideImportPayload(runtime, payload, validation) {
  const mountCell = resolveNextWorkspaceMountCell(runtime);
  const tableId = buildSlideAppInstanceTableId(runtime, validation, mountCell);
  const ownerPrincipalId = readRuntimePrincipalOwnerId(runtime);

  for (const tempId of validation.tempIds) {
    const name = tempId === validation.rootTempId
      ? validation.metadata.appName
      : `${validation.metadata.appName}#${tempId}`;
    runtime.createModel({ table_id: tableId, id: tempId, name, type: 'sliding_ui' });
  }

  for (const record of payload) {
    const model = runtime.getModel({ table_id: tableId, model_id: record.id });
    const nextValue = record.v;
    runtime.addLabel(model, record.p, record.r, record.c, { k: record.k, t: record.t, v: nextValue });
  }

  const rootModelId = validation.rootTempId;
  const rootModel = runtime.getModel({ table_id: tableId, model_id: rootModelId });
  const installedAt = new Date().toISOString();
  runtime.addLabel(rootModel, 0, 0, 0, { k: 'deletable', t: 'bool', v: true });
  runtime.addLabel(rootModel, 0, 0, 0, { k: 'installed_at', t: 'str', v: installedAt });
  runtime.addLabel(rootModel, 0, 0, 0, { k: 'imported_bundle_model_ids', t: 'json', v: [...validation.tempIds] });
  runtime.addLabel(rootModel, 0, 0, 0, { k: 'import_root_temp_id', t: 'int', v: validation.rootTempId });
  runtime.addLabel(rootModel, 0, 0, 0, { k: 'from_user', t: 'str', v: validation.metadata.fromUser });
  runtime.addLabel(rootModel, 0, 0, 0, { k: 'to_user', t: 'str', v: validation.metadata.toUser });
  if (validation.hostIngress) {
    runtime.addLabel(rootModel, 0, 0, 0, { k: SLIDE_IMPORT_HOST_INGRESS_LABEL, t: 'json', v: validation.hostIngress.declaration });
  }
  if (validation.hostEgress) {
    runtime.addLabel(rootModel, 0, 0, 0, { k: SLIDE_IMPORT_DUAL_BUS_LABEL, t: 'json', v: validation.hostEgress.declaration });
  }
  if (validation.remoteEndpoint) {
    runtime.addLabel(rootModel, 0, 0, 0, { k: SLIDE_IMPORT_REMOTE_BUS_ENDPOINT_LABEL, t: 'json', v: validation.remoteEndpoint.declaration });
  }

  const model0 = runtime.getModel(0);
  runtime.addLabel(model0, mountCell.p, mountCell.r, mountCell.c, {
    k: 'model_type',
    t: 'model.subtable',
    v: {
      table_id: tableId,
      root_model_id: rootModelId,
      owner_principal_id: ownerPrincipalId,
    },
  });
  runtime.addLabel(model0, mountCell.p, mountCell.r, mountCell.c, { k: 'app_name', t: 'str', v: validation.metadata.appName });
  runtime.addLabel(model0, mountCell.p, mountCell.r, mountCell.c, { k: 'slide_app_summary', t: 'str', v: validation.metadata.slideSummary });
  runtime.addLabel(model0, mountCell.p, mountCell.r, mountCell.c, { k: 'slide_app_table_id', t: 'str', v: tableId });
  const hostIngressKeys = null;
  const hostEgressKeys = null;

  return {
    tableId,
    rootModelId,
    rootModelRef: { table_id: tableId, model_id: rootModelId },
    modelIds: [...validation.tempIds],
    mountCell,
    hostIngressKeys,
    hostEgressKeys,
  };
}

function buildFilltableCreatedSlidePayload(spec) {
  const appName = String(spec && spec.appName ? spec.appName : '').trim();
  const sourceWorker = String(spec && spec.sourceWorker ? spec.sourceWorker : '').trim();
  const slideSurfaceType = String(spec && spec.slideSurfaceType ? spec.slideSurfaceType : 'workspace.page').trim() || 'workspace.page';
  const headline = String(spec && spec.headline ? spec.headline : '').trim();
  const bodyText = String(spec && spec.bodyText ? spec.bodyText : '').trim();
  const summary = String(
    spec && spec.summary
      ? spec.summary
      : (bodyText || headline || `${appName} created from the fill-table slide app creator.`),
  ).trim();
  return [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.FilltableCreatedSlideApp' },
    { id: 0, p: 0, r: 0, c: 0, k: 'app_name', t: 'str', v: appName },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_app_summary', t: 'str', v: summary },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_worker', t: 'str', v: sourceWorker },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_capable', t: 'bool', v: true },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_surface_type', t: 'str', v: slideSurfaceType },
    { id: 0, p: 0, r: 0, c: 0, k: 'from_user', t: 'str', v: 'local_filltable' },
    { id: 0, p: 0, r: 0, c: 0, k: 'to_user', t: 'str', v: 'workspace_local' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_root_node_id', t: 'str', v: 'created_slide_root' },
    { id: 0, p: 0, r: 2, c: 0, k: 'model_type', t: 'model.submt', v: 1 },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_node_id', t: 'str', v: 'created_slide_root' },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_component', t: 'str', v: 'Container' },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_layout', t: 'str', v: 'column' },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_gap', t: 'int', v: 12 },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_node_id', t: 'str', v: 'created_slide_title' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_component', t: 'str', v: 'Text' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_parent', t: 'str', v: 'created_slide_root' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_bind_json', t: 'json', v: { read: { model_id: 1, p: 0, r: 0, c: 0, k: 'headline' } } },
    { id: 0, p: 2, r: 3, c: 0, k: 'ui_node_id', t: 'str', v: 'created_slide_body_input' },
    { id: 0, p: 2, r: 3, c: 0, k: 'ui_component', t: 'str', v: 'Input' },
    { id: 0, p: 2, r: 3, c: 0, k: 'ui_parent', t: 'str', v: 'created_slide_root' },
    { id: 0, p: 2, r: 3, c: 0, k: 'ui_bind_json', t: 'json', v: {
      read: { model_id: 1, p: 0, r: 0, c: 0, k: 'body_text' },
      write: { action: 'ui_owner_label_update', target_ref: { model_id: 1, p: 0, r: 0, c: 0, k: 'body_text' }, commit_policy: 'on_blur' },
    } },
    { id: 0, p: 2, r: 4, c: 0, k: 'ui_node_id', t: 'str', v: 'created_slide_body_preview' },
    { id: 0, p: 2, r: 4, c: 0, k: 'ui_component', t: 'str', v: 'Text' },
    { id: 0, p: 2, r: 4, c: 0, k: 'ui_parent', t: 'str', v: 'created_slide_root' },
    { id: 0, p: 2, r: 4, c: 0, k: 'ui_bind_json', t: 'json', v: { read: { model_id: 1, p: 0, r: 0, c: 0, k: 'body_text' } } },
    { id: 1, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.FilltableCreatedSlideTruth' },
    { id: 1, p: 0, r: 0, c: 0, k: 'headline', t: 'str', v: headline },
    { id: 1, p: 0, r: 0, c: 0, k: 'body_text', t: 'str', v: bodyText },
  ];
}

function removeImportedBundleFromRuntime(runtime, rootModelId) {
  const rootModel = runtime.getModel(rootModelId);
  if (!rootModel) {
    return { ok: false, code: 'model_not_found' };
  }
  const rootCell = rootModel.getCell(0, 0, 0);
  const generatedModel0Labels = Array.isArray(rootCell.labels.get('host_ingress_generated_model0_labels')?.v)
    ? rootCell.labels.get('host_ingress_generated_model0_labels').v.filter((item) => typeof item === 'string' && item)
    : [];
  const generatedIngressMount = isPlainObject(rootCell.labels.get('host_ingress_generated_mount')?.v)
    ? rootCell.labels.get('host_ingress_generated_mount').v
    : null;
  const generatedEgressModel0Labels = Array.isArray(rootCell.labels.get('host_egress_generated_model0_labels')?.v)
    ? rootCell.labels.get('host_egress_generated_model0_labels').v.filter((item) => typeof item === 'string' && item)
    : [];
  const generatedEgressMount = isPlainObject(rootCell.labels.get('host_egress_generated_mount')?.v)
    ? rootCell.labels.get('host_egress_generated_mount').v
    : null;
  const generatedEgressSystemLabels = Array.isArray(rootCell.labels.get('host_egress_generated_system_labels')?.v)
    ? rootCell.labels.get('host_egress_generated_system_labels').v.filter((item) => typeof item === 'string' && item)
    : [];
  const importedIdsRaw = rootCell.labels.get('imported_bundle_model_ids');
  const modelIds = Array.isArray(importedIdsRaw && importedIdsRaw.v)
    ? importedIdsRaw.v.filter((item) => Number.isInteger(item))
    : [rootModelId];
  const targetIds = new Set(modelIds);

  if (generatedModel0Labels.length > 0) {
    const model0 = runtime.getModel(0);
    if (model0) {
      for (const key of generatedModel0Labels) {
        runtime.rmLabel(model0, 0, 0, 0, key);
      }
    }
  }
  if (generatedIngressMount && Number.isInteger(generatedIngressMount.p) && Number.isInteger(generatedIngressMount.r) && Number.isInteger(generatedIngressMount.c)) {
    const model0 = runtime.getModel(0);
    const mountKeys = Array.isArray(generatedIngressMount.keys) ? generatedIngressMount.keys.filter((item) => typeof item === 'string' && item) : [];
    if (model0) {
      for (const key of mountKeys) {
        runtime.rmLabel(model0, generatedIngressMount.p, generatedIngressMount.r, generatedIngressMount.c, key);
      }
    }
  }
  if (generatedEgressModel0Labels.length > 0) {
    const model0 = runtime.getModel(0);
    if (model0) {
      for (const key of generatedEgressModel0Labels) {
        runtime.rmLabel(model0, 0, 0, 0, key);
      }
    }
  }
  if (generatedEgressMount && Number.isInteger(generatedEgressMount.p) && Number.isInteger(generatedEgressMount.r) && Number.isInteger(generatedEgressMount.c)) {
    const model0 = runtime.getModel(0);
    const mountKeys = Array.isArray(generatedEgressMount.keys) ? generatedEgressMount.keys.filter((item) => typeof item === 'string' && item) : [];
    if (model0) {
      for (const key of mountKeys) {
        runtime.rmLabel(model0, generatedEgressMount.p, generatedEgressMount.r, generatedEgressMount.c, key);
      }
    }
  }
  if (generatedEgressSystemLabels.length > 0) {
    const sys = runtime.getModel(-10);
    if (sys) {
      for (const key of generatedEgressSystemLabels) {
        runtime.rmLabel(sys, 0, 0, 0, key);
      }
    } else {
      runtime.eventLog.record({
        op: 'host_egress_cleanup_skipped',
        cell: { model_id: rootModelId, p: 0, r: 0, c: 0 },
        label: { k: 'host_egress_generated_system_labels', t: 'json' },
        result: 'skipped',
        reason: 'sys_model_missing',
      });
    }
  }

  for (const model of runtime.models.values()) {
    for (const cell of model.cells.values()) {
      for (const [key, label] of [...cell.labels.entries()]) {
        if (label && label.t === 'model.submt' && targetIds.has(label.v)) {
          runtime.rmLabel(model, cell.p, cell.r, cell.c, key);
        }
      }
    }
  }

  for (const [childId, parentInfo] of [...runtime.parentChildMap.entries()]) {
    if (targetIds.has(childId) || (parentInfo && targetIds.has(parentInfo.parentModelId))) {
      runtime.parentChildMap.delete(childId);
    }
  }

  for (const modelId of modelIds) {
    runtime.models.delete(modelId);
  }

  return { ok: true, modelIds, systemLabels: generatedEgressSystemLabels };
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
  const label = cell.labels.get(BUS_EVENT_LAST_OP_KEY);
  return label ? label.v : '';
}

function getEventError(runtime) {
  const cell = getMailboxCell(runtime);
  const label = cell.labels.get(BUS_EVENT_ERROR_KEY);
  return label ? label.v : null;
}

function getActionLifecycle(runtime) {
  const cell = getMailboxCell(runtime);
  const label = cell.labels.get('action_lifecycle');
  if (!label || label.t !== 'json' || !label.v || typeof label.v !== 'object' || Array.isArray(label.v)) {
    return null;
  }
  return label.v;
}

function writeActionLifecycle(runtime, nextPatch) {
  const model = runtime.getModel(EDITOR_MODEL_ID);
  if (!model) return;
  const current = getActionLifecycle(runtime);
  const base = {
    op_id: '',
    action: '',
    status: 'idle',
    started_at: 0,
    completed_at: null,
    result: null,
    confidence: 1,
    llm_used: false,
    llm_model: null,
    llm_reasoning: null,
  };
  const nextValue = {
    ...base,
    ...(current && typeof current === 'object' ? current : {}),
    ...(nextPatch && typeof nextPatch === 'object' ? nextPatch : {}),
  };
  runtime.addLabel(model, 0, 0, 1, { k: 'action_lifecycle', t: 'json', v: nextValue });
}

async function maybeEnhanceSceneContextWithLlm(runtime, programEngine, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const sceneCfg = readLlmSceneConfig(runtime);
  if (!sceneCfg.enabled) return null;
  if (!opts.llmUsed) return null;

  const sceneModel = runtime.getModel(-12);
  if (!sceneModel) return null;
  const currentScene = runtime.getLabelValue(sceneModel, 0, 0, 0, 'scene_context');
  if (!currentScene || typeof currentScene !== 'object' || Array.isArray(currentScene)) return null;

  const lifecycle = getActionLifecycle(runtime) || {};
  const promptTemplate = readSystemPromptTemplate(runtime, 'llm_scene_prompt_template', DEFAULT_LLM_SCENE_PROMPT_TEMPLATE);
  const prompt = renderPromptTemplate(promptTemplate, {
    scene_context_json: safeJsonStringify(currentScene),
    action_lifecycle_json: safeJsonStringify(lifecycle),
    action: typeof opts.action === 'string' ? opts.action : '',
  });

  const dispatchCfg = readLlmDispatchConfig(runtime);
  const llmResult = await programEngine.llmInfer({
    baseUrl: dispatchCfg.base_url,
    model: dispatchCfg.model,
    prompt,
    timeoutMs: sceneCfg.timeout_ms,
    temperature: sceneCfg.temperature,
    maxTokens: sceneCfg.max_tokens,
  });
  if (!llmResult || llmResult.ok !== true) return llmResult || null;

  const parsed = extractFirstJsonObject(llmResult.data && llmResult.data.response);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, code: 'llm_parse_failed', detail: 'scene_json_parse_failed' };
  }
  const merged = mergeSceneContext(currentScene, parsed);
  runtime.addLabel(sceneModel, 0, 0, 0, { k: 'scene_context', t: 'json', v: merged });
  return { ok: true, data: { model: llmResult.data && llmResult.data.model ? llmResult.data.model : dispatchCfg.model } };
}

function setMailboxEnvelope(runtime, envelopeOrNull) {
  const model = runtime.getModel(EDITOR_MODEL_ID);
  runtime.addLabel(model, 0, 0, 1, { k: BUS_EVENT_KEY, t: 'event', v: envelopeOrNull });
}

function normalizePinPayloadTargetRef(targetRef) {
  if (Number.isInteger(targetRef)) return { table_id: 'host', model_id: targetRef };
  if (!targetRef || typeof targetRef !== 'object') return null;
  const tableId = targetRef.table_id === undefined || targetRef.table_id === null
    ? 'host'
    : (typeof targetRef.table_id === 'string' && isSafePinRouteSegment(targetRef.table_id) ? targetRef.table_id : null);
  if (!tableId) return null;
  if (!Number.isInteger(targetRef.model_id)) return null;
  return { table_id: tableId, model_id: targetRef.model_id };
}

function temporaryPayloadToOwnerMaterialization(targetRef, payload, opId) {
  const target = normalizePinPayloadTargetRef(targetRef);
  if (!target) return null;
  if (!Array.isArray(payload) || payload.length === 0 || !payload.every(isTemporaryModelTableRecord)) return null;
  const records = [];
  for (const record of payload) {
    records.push({
      op: 'add_label',
      table_id: target.table_id,
      model_id: target.model_id,
      p: record.p,
      r: record.r,
      c: record.c,
      k: record.k,
      t: record.t,
      v: record.v,
    });
  }
  return {
    op_id: typeof opId === 'string' && opId ? opId : `pin_payload_${Date.now()}`,
    records,
  };
}

function findTemporaryPayloadRecord(payload, key) {
  if (!Array.isArray(payload) || typeof key !== 'string') return null;
  return payload.find((record) => record
    && record.id === 0
    && record.p === 0
    && record.r === 0
    && record.c === 0
    && record.k === key) || null;
}

function readTemporaryPayloadString(payload, key, fallback = '') {
  const record = findTemporaryPayloadRecord(payload, key);
  if (!record) return fallback;
  return record.t === 'str' && typeof record.v === 'string' ? record.v : fallback;
}

function readTemporaryPayloadInt(payload, key) {
  const record = findTemporaryPayloadRecord(payload, key);
  return record && record.t === 'int' && Number.isInteger(record.v) ? record.v : null;
}

function readTemporaryPayloadJson(payload, key) {
  const record = findTemporaryPayloadRecord(payload, key);
  return record && record.t === 'json' ? record.v : null;
}

function hasClientAuthoredAuthorityMetadata(records) {
  if (!Array.isArray(records)) return false;
  return records.some((record) => record
    && record.id === 0
    && record.p === 0
    && record.r === 0
    && record.c === 0
    && (record.k === 'principal_id'
      || record.k === 'table_id'
      || record.k === 'owner_principal_id'));
}

function hasInvalidTemporaryPayloadStringRecord(payload, key) {
  const record = findTemporaryPayloadRecord(payload, key);
  return Boolean(record && (record.t !== 'str' || typeof record.v !== 'string'));
}

function hasDuplicateTemporaryPayloadRecordKeys(payload, keys) {
  if (!Array.isArray(payload)) return false;
  const watched = new Set(keys);
  const seen = new Set();
  for (const record of payload) {
    if (!record || !watched.has(record.k)) continue;
    if (seen.has(record.k)) return true;
    seen.add(record.k);
  }
  return false;
}

function isStrictNonBlankString(value) {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function parsePinPayloadRecordEnvelope(content) {
  if (!content || content.version !== 'v1' || content.type !== 'pin_payload') {
    return { ok: false, code: 'invalid_packet' };
  }
  const keys = Object.keys(content).sort();
  if (keys.length !== 3 || keys[0] !== 'payload' || keys[1] !== 'type' || keys[2] !== 'version') {
    return { ok: false, code: 'loose_pin_payload_fields_removed' };
  }
  const records = content.payload;
  if (!isTemporaryPayloadRecordArray(records)) {
    return { ok: false, code: 'temporary_modeltable_required' };
  }
  const kind = readTemporaryPayloadString(records, '__mt_payload_kind');
  if (kind !== 'pin_payload.v1') {
    return { ok: false, code: 'invalid_payload_kind' };
  }
  const stringMetadataKeys = [
    '__mt_request_id',
    'op_id',
    'message_role',
    'topic',
    'response_topic',
    'route_kind',
    'endpoint_worker_id',
    'endpoint_table_id',
    'endpoint_pin',
    'origin_worker_id',
    'origin_table_id',
    'origin_pin',
    'reply_target_worker_id',
    'reply_target_table_id',
    'reply_target_pin',
    'reply_target_principal_key',
  ];
  const metadataKeys = stringMetadataKeys.concat([
    '__mt_payload_kind',
    'endpoint_model_id',
    'origin_model_id',
    'reply_target_model_id',
    'payload',
    'timestamp',
    'bus_out_key',
    'bus',
  ]);
  if (hasDuplicateTemporaryPayloadRecordKeys(records, metadataKeys)) {
    return { ok: false, code: 'invalid_pin_payload_records' };
  }
  for (const key of stringMetadataKeys) {
    if (hasInvalidTemporaryPayloadStringRecord(records, key)) {
      return { ok: false, code: 'invalid_pin_payload_records' };
    }
  }
  const requestId = readTemporaryPayloadString(records, '__mt_request_id');
  const opIdLabel = readTemporaryPayloadString(records, 'op_id');
  const requestIdIsValid = requestId === '' || isStrictNonBlankString(requestId);
  const opIdIsValid = opIdLabel === '' || isStrictNonBlankString(opIdLabel);
  if (!requestIdIsValid || !opIdIsValid) {
    return { ok: false, code: 'invalid_pin_payload_records' };
  }
  if (!requestId && !opIdLabel) {
    return { ok: false, code: 'missing_request_correlation' };
  }
  const messageRole = readTemporaryPayloadString(records, 'message_role');
  if (messageRole !== 'request' && messageRole !== 'response') {
    return { ok: false, code: 'invalid_message_role' };
  }
  const topicValue = readTemporaryPayloadString(records, 'topic');
  const responseTopic = readTemporaryPayloadString(records, 'response_topic');
  if (!isValidControlBusEndpointTopic(topicValue)) {
    return { ok: false, code: 'invalid_topic' };
  }
  if (!isValidControlBusEndpointTopic(responseTopic)) {
    return { ok: false, code: 'invalid_response_topic' };
  }
  for (const record of records) {
    if (!record || typeof record.k !== 'string') {
      return { ok: false, code: 'invalid_pin_payload_records' };
    }
  }
  if (containsLegacyPinPayloadMetadataInPinPayloadRecords(records)) {
    return { ok: false, code: 'legacy_pin_payload_metadata_removed' };
  }
  if (hasClientAuthoredAuthorityMetadata(records)) {
    return { ok: false, code: 'client_authority_metadata_rejected' };
  }
  const endpoint = readPinPayloadEndpoint(records, 'endpoint');
  const origin = readPinPayloadEndpoint(records, 'origin');
  const replyTarget = readPinPayloadEndpoint(records, 'reply_target');
  const validEndpoint = isValidPinPayloadEndpoint(endpoint) && endpoint.table_id === 'host';
  const validOrigin = isValidPinPayloadEndpoint(origin, { allowNonHostModelZero: true });
  const validReplyTarget = isValidPinPayloadEndpoint(replyTarget, { allowNonHostModelZero: true });
  const nestedPayload = readTemporaryPayloadJson(records, 'payload');
  if (!validEndpoint || !validOrigin || !validReplyTarget || !isTemporaryPayloadRecordArray(nestedPayload)) {
    return { ok: false, code: 'invalid_pin_payload_records' };
  }
  if (origin.table_id !== 'host' && (!replyTarget.table_id_present || replyTarget.table_id === 'host')) {
    return { ok: false, code: 'missing_reply_target_table_id' };
  }
  const topicContractError = validatePinPayloadTopicContract({
    messageRole,
    topic: topicValue,
    responseTopic,
    endpoint,
    replyTarget,
  });
  if (topicContractError) {
    return { ok: false, code: topicContractError };
  }
  const opId = opIdLabel || requestId;
  return { ok: true, records, endpoint, origin, replyTarget, nestedPayload, opId, messageRole, topic: topicValue, responseTopic };
}

function upsertTemporaryPayloadRecord(payload, record) {
  const base = Array.isArray(payload)
    ? payload.map((entry) => (entry && typeof entry === 'object' ? { ...entry } : entry))
    : [];
  const index = base.findIndex((entry) => entry && entry.k === record.k);
  if (index >= 0) {
    base[index] = { ...base[index], ...record };
  } else {
    base.push(record);
  }
  return base;
}

function validateMgmtBusConsoleAck(content) {
  const payload = content && content.payload;
  if (!isTemporaryPayloadRecordArray(payload)) {
    return { ok: false, code: 'temporary_modeltable_required' };
  }
  const kind = readTemporaryPayloadString(payload, '__mt_payload_kind').trim();
  if (kind !== 'mgmt_bus_console.ack.v1') {
    return { ok: false, code: 'invalid_payload_kind' };
  }
  const targetUserId = readTemporaryPayloadString(payload, 'target_user_id').trim();
  if (!targetUserId.startsWith('@mbr:')) {
    return { ok: false, code: 'invalid_target_user_id' };
  }
  const replyText = readTemporaryPayloadString(payload, 'reply_text').trim();
  if (!replyText) {
    return { ok: false, code: 'missing_reply_text' };
  }
  return { ok: true, targetUserId, replyText };
}

function pinPayloadPacketToBusValue(packet) {
  const parsed = parsePinPayloadRecordEnvelope(packet);
  return parsed.ok ? parsed.records : null;
}

function isValidPrincipalRuntimeControlTopic(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
  const parts = value.split('/');
  return parts.length === 8
    && parts[0] === 'UIPUT'
    && parts.every((part) => isSafePinRouteSegment(part))
    && /^(0|[1-9][0-9]*)$/u.test(parts[6]);
}

function principalRuntimeControlTopicParts(value) {
  if (!isValidPrincipalRuntimeControlTopic(value)) return null;
  const parts = value.split('/');
  return {
    worker_id: parts[5],
    model_id: Number(parts[6]),
    pin: parts[7],
  };
}

function principalIdentity(principal) {
  if (!principal || typeof principal !== 'object') return null;
  const ordered = [
    ['subject', principal.subject],
    ['userId', principal.userId],
    ['email', principal.email],
    ['username', principal.username],
  ];
  for (const [source, raw] of ordered) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if (value) return { source, value };
  }
  return null;
}

function principalRuntimeKey(principal) {
  const identity = principalIdentity(principal);
  if (!identity) return '';
  return `${identity.source}:${identity.value}`;
}

function parsePrincipalRuntimePinPayload(payload) {
  let decoded = payload;
  if (typeof decoded === 'string') {
    try {
      decoded = JSON.parse(decoded);
    } catch (_) {
      return { ok: false, code: 'invalid_packet' };
    }
  }
  const records = Array.isArray(decoded)
    ? decoded
    : (decoded && decoded.type === 'pin_payload' && decoded.version === 'v1' && Array.isArray(decoded.payload) ? decoded.payload : null);
  if (!isTemporaryPayloadRecordArray(records)) {
    return { ok: false, code: 'temporary_modeltable_required' };
  }
  const kind = readTemporaryPayloadString(records, '__mt_payload_kind');
  if (kind !== 'pin_payload.v1') return { ok: false, code: 'invalid_payload_kind' };
  const nestedPayload = readTemporaryPayloadJson(records, 'payload');
  if (!isTemporaryPayloadRecordArray(nestedPayload)) return { ok: false, code: 'invalid_nested_payload' };
  const topic = readTemporaryPayloadString(records, 'topic');
  const responseTopic = readTemporaryPayloadString(records, 'response_topic');
  if (!isValidPrincipalRuntimeControlTopic(topic)) return { ok: false, code: 'invalid_topic' };
  if (!isValidPrincipalRuntimeControlTopic(responseTopic)) return { ok: false, code: 'invalid_response_topic' };
  if (hasClientAuthoredAuthorityMetadata(records)) {
    return { ok: false, code: 'client_authority_metadata_rejected' };
  }
  const endpoint = readPinPayloadEndpoint(records, 'endpoint');
  if (!isValidPinPayloadEndpoint(endpoint) || endpoint.table_id !== 'host') {
    return { ok: false, code: 'invalid_pin_payload_records' };
  }
  const topicEndpoint = principalRuntimeControlTopicParts(topic);
  const endpointMatchesTopic = topicEndpoint
    && endpoint.worker_id === topicEndpoint.worker_id
    && endpoint.model_id === topicEndpoint.model_id
    && endpoint.pin === topicEndpoint.pin;
  if (!endpointMatchesTopic) return { ok: false, code: 'invalid_endpoint_topic' };
  const origin = readPinPayloadEndpoint(records, 'origin');
  const replyTarget = readPinPayloadEndpoint(records, 'reply_target');
  const validOrigin = isValidPinPayloadEndpoint(origin, { allowNonHostModelZero: true });
  const validReplyTarget = isValidPinPayloadEndpoint(replyTarget, { allowNonHostModelZero: true });
  if (!validOrigin || !validReplyTarget) return { ok: false, code: 'invalid_pin_payload_records' };
  if (origin.table_id !== 'host' && (!replyTarget.table_id_present || replyTarget.table_id === 'host')) {
    return { ok: false, code: 'missing_reply_target_table_id' };
  }
  return {
    ok: true,
    records,
    messageRole: readTemporaryPayloadString(records, 'message_role'),
    topic,
    responseTopic,
    routeKind: readTemporaryPayloadString(records, 'route_kind'),
    replyTargetPrincipalKey: readTemporaryPayloadString(records, 'reply_target_principal_key'),
    endpoint,
    origin,
    replyTarget,
    nestedPayload,
  };
}

function principalRuntimeMarkerRecord(payload) {
  let decoded = payload;
  if (typeof decoded === 'string') {
    try {
      decoded = JSON.parse(decoded);
    } catch (_) {
      return null;
    }
  }
  const records = Array.isArray(decoded)
    ? decoded
    : (decoded && decoded.type === 'pin_payload' && decoded.version === 'v1' && Array.isArray(decoded.payload) ? decoded.payload : null);
  return findTemporaryPayloadRecord(records, 'reply_target_principal_key');
}

function createPrincipalRuntimeRegistry(options = {}) {
  const createState = typeof options.createState === 'function'
    ? options.createState
    : () => createServerState({ dbPath: null });
  const readOnlyState = options.readOnlyState || null;
  const runtimes = new Map();
  const initializationByPrincipalKey = new Map();

  function publicInitializationStatus(principalKey, record = null) {
    if (runtimes.has(principalKey)) {
      return {
        status: 'ready',
        code: 'workspace_ready',
        principalKey,
      };
    }
    if (!record) {
      return {
        status: 'idle',
        code: 'workspace_not_started',
        principalKey,
      };
    }
    const status = record.status || 'initializing';
    const out = {
      status,
      code: record.code || (status === 'failed' ? 'workspace_initialization_failed' : 'workspace_initializing'),
      principalKey,
      startedAt: Number.isFinite(record.startedAt) ? record.startedAt : null,
      finishedAt: Number.isFinite(record.finishedAt) ? record.finishedAt : null,
      elapsedMs: Number.isFinite(record.startedAt)
        ? Math.max(0, (record.finishedAt || Date.now()) - record.startedAt)
        : null,
    };
    if (status === 'failed') {
      out.error = record.error || 'workspace_initialization_failed';
    }
    return out;
  }

  function createRuntimeEntry(principalKey, principal) {
    const entry = {
      principalKey,
      principal: { ...(principal || {}) },
      mutable: true,
      state: createState(principalKey, principal),
    };
    runtimes.set(principalKey, entry);
    return entry;
  }

  function resolveMutableRuntime(principal) {
    const principalKey = principalRuntimeKey(principal);
    if (!principalKey) {
      throw new Error('guest_read_only');
    }
    return runtimes.get(principalKey) || createRuntimeEntry(principalKey, principal);
  }

  function resolveReadRuntime(principal) {
    const principalKey = principalRuntimeKey(principal);
    if (!principalKey) {
      return {
        principalKey: 'guest',
        principal: null,
        mutable: false,
        state: readOnlyState,
      };
    }
    return resolveMutableRuntime(principal);
  }

  function readRuntimeIfReady(principal) {
    const principalKey = principalRuntimeKey(principal);
    if (!principalKey) {
      return {
        principalKey: 'guest',
        principal: null,
        mutable: false,
        state: readOnlyState,
      };
    }
    return runtimes.get(principalKey) || null;
  }

  function getRuntimeInitializationStatus(principal) {
    const principalKey = principalRuntimeKey(principal);
    if (!principalKey) {
      return {
        status: 'guest',
        code: 'guest_read_only',
        principalKey: 'guest',
      };
    }
    return publicInitializationStatus(principalKey, initializationByPrincipalKey.get(principalKey) || null);
  }

  function startRuntimeInitialization(principal, options = {}) {
    const principalKey = principalRuntimeKey(principal);
    if (!principalKey) {
      throw new Error('guest_read_only');
    }
    const readyEntry = runtimes.get(principalKey);
    if (readyEntry) {
      return {
        ...publicInitializationStatus(principalKey),
        entry: readyEntry,
        promise: Promise.resolve(readyEntry),
      };
    }
    const existing = initializationByPrincipalKey.get(principalKey);
    if (existing) {
      return {
        ...publicInitializationStatus(principalKey, existing),
        promise: existing.promise,
      };
    }
    const record = {
      status: 'initializing',
      code: 'workspace_initializing',
      principal: { ...(principal || {}) },
      startedAt: Date.now(),
      finishedAt: null,
      error: '',
      entry: null,
      promise: null,
    };
    const configuredDelay = Number.parseInt(String(process.env.DY_PRINCIPAL_RUNTIME_INIT_DELAY_MS || ''), 10);
    const defaultDelayMs = Number.isInteger(configuredDelay) && configuredDelay >= 0 ? configuredDelay : 500;
    const delayMs = Number.isFinite(options.delayMs) ? Math.max(0, Number(options.delayMs)) : defaultDelayMs;
    record.promise = new Promise((resolve, reject) => {
      const run = () => {
        try {
          const entry = runtimes.get(principalKey) || createRuntimeEntry(principalKey, principal);
          record.status = 'ready';
          record.code = 'workspace_ready';
          record.finishedAt = Date.now();
          record.entry = entry;
          resolve(entry);
        } catch (err) {
          record.status = 'failed';
          record.code = 'workspace_initialization_failed';
          record.finishedAt = Date.now();
          record.error = String(err && err.message ? err.message : err);
          reject(err);
        }
      };
      if (options.defer === false) {
        run();
      } else {
        setTimeout(run, delayMs);
      }
    });
    record.promise.catch(() => {});
    initializationByPrincipalKey.set(principalKey, record);
    return {
      ...publicInitializationStatus(principalKey, record),
      promise: record.promise,
    };
  }

  function runtimeByKey(principalKey) {
    if (typeof principalKey !== 'string' || !principalKey.trim()) return null;
    return runtimes.get(principalKey.trim()) || null;
  }

  async function handleControlBusPacketResult(topic, payload) {
    const principalMarker = principalRuntimeMarkerRecord(payload);
    const parsed = parsePrincipalRuntimePinPayload(payload);
    if (!parsed.ok) {
      return {
        matched: Boolean(principalMarker),
        handled: false,
        code: parsed.code || 'invalid_packet',
      };
    }
    const hasPrincipalTarget = typeof parsed.replyTargetPrincipalKey === 'string'
      && parsed.replyTargetPrincipalKey.trim() !== '';
    if (!hasPrincipalTarget) {
      return {
        matched: Boolean(principalMarker),
        handled: false,
        code: 'missing_reply_target_principal_key',
      };
    }
    if (parsed.messageRole !== 'response') return { matched: false, handled: false, code: 'not_response' };
    if (parsed.topic !== topic || parsed.responseTopic !== topic || parsed.routeKind !== 'control') {
      return { matched: true, handled: false, code: 'invalid_principal_response_route' };
    }
    if (parsed.replyTarget.pin !== 'result') {
      return { matched: true, handled: false, code: 'invalid_principal_reply_target_pin' };
    }
    const entry = runtimeByKey(parsed.replyTargetPrincipalKey);
    if (!entry || !entry.mutable || !entry.state || !entry.state.runtime) {
      return { matched: true, handled: false, code: 'principal_runtime_not_found' };
    }
    const engine = entry.state.programEngine;
    const handled = engine && typeof engine.handleControlBusPacket === 'function'
      ? await engine.handleControlBusPacket(topic, payload)
      : false;
    if (handled && typeof entry.state.updateDerived === 'function') {
      entry.state.updateDerived({ scope: 'business' });
    }
    return {
      matched: true,
      handled: handled === true,
      principalKey: entry.principalKey,
      code: handled === true ? 'handled' : 'principal_runtime_rejected',
    };
  }

  async function handleControlBusPacket(topic, payload) {
    const result = await handleControlBusPacketResult(topic, payload);
    return result.handled === true;
  }

  return {
    resolveMutableRuntime,
    resolveReadRuntime,
    readRuntimeIfReady,
    startRuntimeInitialization,
    getRuntimeInitializationStatus,
    handleControlBusPacket,
    handleControlBusPacketResult,
    runtimeByKey,
    principalRuntimeKey,
    runtimes,
  };
}

function buildMgmtBusConsoleMatrixPacket(payload, options = {}) {
  if (!isTemporaryPayloadRecordArray(payload)) {
    return { ok: false, code: 'invalid_bus_payload', detail: 'temporary_modeltable_required' };
  }
  const kind = readTemporaryPayloadString(payload, '__mt_payload_kind').trim();
  if (kind !== 'mgmt_bus_console.send.v1') {
    return { ok: false, code: 'invalid_payload_kind', detail: kind || 'missing_kind' };
  }
  const targetUserId = readTemporaryPayloadString(payload, 'target_user_id').trim();
  if (!targetUserId || !targetUserId.startsWith('@mbr:')) {
    return { ok: false, code: 'invalid_target_user_id', detail: targetUserId || 'missing_target_user_id' };
  }
  const draft = readTemporaryPayloadString(payload, 'draft', readTemporaryPayloadString(payload, 'message_text')).trim();
  if (!draft) {
    return { ok: false, code: 'empty_message', detail: 'draft_required' };
  }
  const targetWorkerId = targetUserId.startsWith('@')
    ? targetUserId.slice(1).split(':')[0]
    : targetUserId;
  if (!isSafePinRouteSegment(targetWorkerId)) {
    return { ok: false, code: 'invalid_target_worker_id', detail: targetWorkerId || 'missing_target_worker_id' };
  }
  const now = Date.now();
  const opId = `mgmt_bus_console_${now}`;
  const endpoint = {
    worker_id: targetWorkerId,
    table_id: 'host',
    model_id: MGMT_BUS_CONSOLE_MODEL_ID,
    pin: 'submit',
  };
  const replyTarget = {
    worker_id: resolveUiServerWorkerId(),
    table_id: 'host',
    model_id: MGMT_BUS_CONSOLE_MODEL_ID,
    pin: 'result',
  };
  const routeTopic = buildEndpointTopic(options.runtime || null, endpoint);
  const responseTopic = buildEndpointTopic(options.runtime || null, replyTarget);
  const principalKey = options.runtime ? readRuntimePrincipalKey(options.runtime) : '';
  if (!routeTopic || !responseTopic || routeTopic === responseTopic) {
    return { ok: false, code: 'invalid_topic', detail: 'topic_and_response_topic_required' };
  }
  let normalizedPayload = upsertTemporaryPayloadRecord(payload, {
    id: 0,
    p: 0,
    r: 0,
    c: 0,
    k: 'target_user_id',
    t: 'str',
    v: targetUserId,
  });
  normalizedPayload = upsertTemporaryPayloadRecord(normalizedPayload, {
    id: 0,
    p: 0,
    r: 0,
    c: 0,
    k: 'message_text',
    t: 'str',
    v: draft,
  });
  return {
    ok: true,
    data: {
      version: 'v1',
      type: 'pin_payload',
      payload: [
        mtPayloadRecord('__mt_payload_kind', 'str', 'pin_payload.v1'),
        mtPayloadRecord('__mt_request_id', 'str', opId),
        mtPayloadRecord('op_id', 'str', opId),
        mtPayloadRecord('message_role', 'str', 'request'),
        mtPayloadRecord('topic', 'str', routeTopic),
        mtPayloadRecord('response_topic', 'str', responseTopic),
        mtPayloadRecord('route_kind', 'str', 'management'),
        mtPayloadRecord('bus', 'str', 'management'),
        mtPayloadRecord('endpoint_worker_id', 'str', endpoint.worker_id),
        mtPayloadRecord('endpoint_table_id', 'str', endpoint.table_id),
        mtPayloadRecord('endpoint_model_id', 'int', endpoint.model_id),
        mtPayloadRecord('endpoint_pin', 'str', endpoint.pin),
        mtPayloadRecord('origin_worker_id', 'str', resolveUiServerWorkerId()),
        mtPayloadRecord('origin_table_id', 'str', 'host'),
        mtPayloadRecord('origin_model_id', 'int', MGMT_BUS_CONSOLE_MODEL_ID),
        mtPayloadRecord('origin_pin', 'str', 'submit'),
        mtPayloadRecord('reply_target_worker_id', 'str', replyTarget.worker_id),
        mtPayloadRecord('reply_target_table_id', 'str', replyTarget.table_id),
        mtPayloadRecord('reply_target_model_id', 'int', replyTarget.model_id),
        mtPayloadRecord('reply_target_pin', 'str', replyTarget.pin),
        ...(principalKey ? [mtPayloadRecord('reply_target_principal_key', 'str', principalKey)] : []),
        mtPayloadRecord('payload', 'json', normalizedPayload),
        mtPayloadRecord('timestamp', 'int', now),
      ],
    },
  };
}

const HOME_PIN_ACTIONS = new Set([
  'home_refresh',
  'home_select_row',
  'home_open_create',
  'home_open_edit',
  'home_save_label',
  'home_delete_label',
  'home_view_detail',
  'home_close_detail',
  'home_close_edit',
]);
const HOME_OWNER_REQUEST_PIN = 'home_owner_request';
const HOME_OWNER_ROUTE_LABEL = 'home_owner_route';
const HOME_OWNER_FUNC = 'home_owner_materialize';
const HOME_PIN_ERROR_LABEL = 'home_pin_error';
const GENERIC_OWNER_REQUEST_PIN = 'owner_request';
const GENERIC_OWNER_ROUTE_LABEL = 'owner_route';
const GENERIC_OWNER_FUNC = 'owner_materialize';
const GENERIC_PIN_ERROR_LABEL = 'owner_pin_error';

function mtPayloadRecord(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function ownerRequestToTemporaryPayload(request, kind = 'owner_request.v1') {
  const normalized = request && typeof request === 'object' ? request : {};
  const requestId = typeof normalized.request_id === 'string' && normalized.request_id
    ? normalized.request_id
    : `owner_req_${Date.now()}`;
  const targetModelId = Number.isInteger(normalized.target_model_id) ? normalized.target_model_id : 0;
  const origin = normalized.origin && typeof normalized.origin === 'object' ? normalized.origin : {};
  const originAction = typeof normalized.origin_action === 'string'
    ? normalized.origin_action
    : (typeof origin.action === 'string' ? origin.action : '');
  const normalizeWrite = (label) => {
    if (!label || typeof label.k !== 'string' || !label.k || typeof label.t !== 'string' || !label.t) return null;
    return {
      p: Number.isInteger(label.p) ? label.p : 0,
      r: Number.isInteger(label.r) ? label.r : 0,
      c: Number.isInteger(label.c) ? label.c : 0,
      k: label.k,
      t: label.t,
      v: label.v,
    };
  };
  const normalizeRemove = (label) => {
    if (!label || typeof label.k !== 'string' || !label.k) return null;
    return {
      p: Number.isInteger(label.p) ? label.p : 0,
      r: Number.isInteger(label.r) ? label.r : 0,
      c: Number.isInteger(label.c) ? label.c : 0,
      k: label.k,
    };
  };
  const writeLabels = Array.isArray(normalized.write_labels)
    ? normalized.write_labels.map(normalizeWrite).filter(Boolean)
    : [];
  const removeLabels = Array.isArray(normalized.remove_labels)
    ? normalized.remove_labels.map(normalizeRemove).filter(Boolean)
    : [];
  return [
    mtPayloadRecord('__mt_payload_kind', 'str', kind),
    mtPayloadRecord('__mt_request_id', 'str', requestId),
    mtPayloadRecord('target_model_id', 'int', targetModelId),
    mtPayloadRecord('origin_action', 'str', originAction),
    mtPayloadRecord('write_labels', 'json', writeLabels),
    mtPayloadRecord('remove_labels', 'json', removeLabels),
  ];
}

function homeOwnerMaterializeCode(modelId) {
  return [
    `const SELF_MODEL_ID = ${JSON.stringify(modelId)};`,
    "const readPayload = (value, key, fallback = null) => {",
    "  if (!Array.isArray(value)) return fallback;",
    "  const rec = value.find((item) => item && item.id === 0 && item.p === 0 && item.r === 0 && item.c === 0 && item.k === key);",
    "  return rec && Object.prototype.hasOwnProperty.call(rec, 'v') ? rec.v : fallback;",
    "};",
    "const labelValue = label ? label.v : null;",
    "if (!Array.isArray(labelValue)) throw new Error('temporary_modeltable_required');",
    "const targetModelId = readPayload(labelValue, 'target_model_id', null);",
    "if (targetModelId !== SELF_MODEL_ID) throw new Error('target_scope_rejected');",
    "const writeLabels = readPayload(labelValue, 'write_labels', []);",
    "const removeLabels = readPayload(labelValue, 'remove_labels', []);",
    "if (!Array.isArray(writeLabels) || !Array.isArray(removeLabels)) throw new Error('invalid_request_shape');",
    "for (const item of writeLabels) {",
    "  if (!item || Object.prototype.hasOwnProperty.call(item, 'op') || Object.prototype.hasOwnProperty.call(item, 'model_id')) throw new Error('invalid_request_shape');",
    "  if (typeof item.k !== 'string' || !item.k || typeof item.t !== 'string' || !item.t) throw new Error('invalid_request_shape');",
    "  V1N.table.addLabel(Number.isInteger(item.p) ? item.p : 0, Number.isInteger(item.r) ? item.r : 0, Number.isInteger(item.c) ? item.c : 0, item.k, item.t, item.v);",
    "}",
    "for (const item of removeLabels) {",
    "  if (!item || Object.prototype.hasOwnProperty.call(item, 'op') || Object.prototype.hasOwnProperty.call(item, 'model_id')) throw new Error('invalid_request_shape');",
    "  if (typeof item.k !== 'string' || !item.k) throw new Error('invalid_request_shape');",
    "  V1N.table.removeLabel(Number.isInteger(item.p) ? item.p : 0, Number.isInteger(item.r) ? item.r : 0, Number.isInteger(item.c) ? item.c : 0, item.k);",
    "}",
  ].join('\n');
}

function genericOwnerMaterializeCode(modelId) {
  return [
    `const SELF_MODEL_ID = ${JSON.stringify(modelId)};`,
    "const readPayload = (value, key, fallback = null) => {",
    "  if (!Array.isArray(value)) return fallback;",
    "  const rec = value.find((item) => item && item.id === 0 && item.p === 0 && item.r === 0 && item.c === 0 && item.k === key);",
    "  return rec && Object.prototype.hasOwnProperty.call(rec, 'v') ? rec.v : fallback;",
    "};",
    "const labelValue = label ? label.v : null;",
    "if (!Array.isArray(labelValue)) throw new Error('temporary_modeltable_required');",
    "const targetModelId = readPayload(labelValue, 'target_model_id', null);",
    "if (targetModelId !== SELF_MODEL_ID) throw new Error('target_scope_rejected');",
    "const requestId = readPayload(labelValue, '__mt_request_id', '');",
    "const originAction = readPayload(labelValue, 'origin_action', '');",
    "V1N.table.addLabel(0, 0, 0, '__owner_last_request_id', 'str', typeof requestId === 'string' ? requestId : '');",
    "V1N.table.addLabel(0, 0, 0, '__owner_last_action', 'str', typeof originAction === 'string' ? originAction : '');",
    "const writeLabels = readPayload(labelValue, 'write_labels', []);",
    "const removeLabels = readPayload(labelValue, 'remove_labels', []);",
    "if (!Array.isArray(writeLabels) || !Array.isArray(removeLabels)) throw new Error('invalid_request_shape');",
    "for (const item of writeLabels) {",
    "  if (!item || Object.prototype.hasOwnProperty.call(item, 'op') || Object.prototype.hasOwnProperty.call(item, 'model_id')) throw new Error('invalid_request_shape');",
    "  if (typeof item.k !== 'string' || !item.k || typeof item.t !== 'string' || !item.t) throw new Error('invalid_request_shape');",
    "  V1N.table.addLabel(Number.isInteger(item.p) ? item.p : 0, Number.isInteger(item.r) ? item.r : 0, Number.isInteger(item.c) ? item.c : 0, item.k, item.t, item.v);",
    "}",
    "for (const item of removeLabels) {",
    "  if (!item || Object.prototype.hasOwnProperty.call(item, 'op') || Object.prototype.hasOwnProperty.call(item, 'model_id')) throw new Error('invalid_request_shape');",
    "  if (typeof item.k !== 'string' || !item.k) throw new Error('invalid_request_shape');",
    "  V1N.table.removeLabel(Number.isInteger(item.p) ? item.p : 0, Number.isInteger(item.r) ? item.r : 0, Number.isInteger(item.c) ? item.c : 0, item.k);",
    "}",
  ].join('\n');
}

function ownerMaterializerNeedsRefresh(cell, funcKey) {
  const existing = cell && cell.labels ? cell.labels.get(funcKey) : null;
  if (!existing) return true;
  const code = existing.v && typeof existing.v.code === 'string' ? existing.v.code : '';
  return /\bctx\.(writeLabel|getLabel|rmLabel)\b/.test(code)
    || /typeof labelValue === ['"]object['"] \? labelValue/.test(code)
    || /if \(!req\) return;/.test(code)
    || /readPayload\(labelValue, ['"]request['"]/.test(code)
    || /\breq\.op\b|\brecord\.op\b|\bapply_records\b/.test(code);
}

function ensureHomeOwnerMaterializer(runtime, modelId) {
  const model = runtime.getModel(modelId);
  if (!model) return false;
  const cell = runtime.getCell(model, 0, 0, 0);
  const pinType = typeof runtime._modelInputLabelType === 'function'
    ? runtime._modelInputLabelType(model)
    : 'pin.in';
  if (!cell.labels.has(HOME_OWNER_REQUEST_PIN)) {
    runtime.addLabel(model, 0, 0, 0, { k: HOME_OWNER_REQUEST_PIN, t: pinType, v: null });
  }
  if (!cell.labels.has(HOME_OWNER_ROUTE_LABEL)) {
    runtime.addLabel(model, 0, 0, 0, {
      k: HOME_OWNER_ROUTE_LABEL,
      t: 'pin.connect.label',
      v: [{ from: HOME_OWNER_REQUEST_PIN, to: [`${HOME_OWNER_FUNC}:in`] }],
    });
  }
  if (ownerMaterializerNeedsRefresh(cell, HOME_OWNER_FUNC)) {
    runtime.addLabel(model, 0, 0, 0, {
      k: HOME_OWNER_FUNC,
      t: 'func.js',
      v: { code: homeOwnerMaterializeCode(modelId), modelName: 'home_owner_materialize' },
    });
  }
  return true;
}

function ensureGenericOwnerMaterializer(runtime, modelId) {
  const model = runtime.getModel(modelId);
  if (!model) return false;
  const cell = runtime.getCell(model, 0, 0, 0);
  const pinType = typeof runtime._modelInputLabelType === 'function'
    ? runtime._modelInputLabelType(model)
    : 'pin.in';
  if (!cell.labels.has(GENERIC_OWNER_REQUEST_PIN)) {
    runtime.addLabel(model, 0, 0, 0, { k: GENERIC_OWNER_REQUEST_PIN, t: pinType, v: null });
  }
  if (!cell.labels.has(GENERIC_OWNER_ROUTE_LABEL)) {
    runtime.addLabel(model, 0, 0, 0, {
      k: GENERIC_OWNER_ROUTE_LABEL,
      t: 'pin.connect.label',
      v: [{ from: GENERIC_OWNER_REQUEST_PIN, to: [`${GENERIC_OWNER_FUNC}:in`] }],
    });
  }
  if (ownerMaterializerNeedsRefresh(cell, GENERIC_OWNER_FUNC)) {
    runtime.addLabel(model, 0, 0, 0, {
      k: GENERIC_OWNER_FUNC,
      t: 'func.js',
      v: { code: genericOwnerMaterializeCode(modelId), modelName: 'owner_materialize' },
    });
  }
  return true;
}

function buildHomeSourceOutPin(targetModelId) {
  return `home_owner_req_${String(targetModelId)}`;
}

function ensureHomeOwnerRoute(runtime, targetModelId) {
  const model0 = runtime.getModel(0);
  if (!model0) return false;
  const sourcePin = buildHomeSourceOutPin(targetModelId);
  const systemMount = ensureModel0SubmodelMount(runtime, -10);
  const targetMount = ensureModel0SubmodelMount(runtime, targetModelId);
  if (!systemMount || !targetMount) return false;
  runtime.addLabel(model0, systemMount.p, systemMount.r, systemMount.c, { k: sourcePin, t: 'pin.out', v: null });
  runtime.addLabel(model0, targetMount.p, targetMount.r, targetMount.c, { k: HOME_OWNER_REQUEST_PIN, t: 'pin.in', v: null });
  const routeKey = `0|${systemMount.p}|${systemMount.r}|${systemMount.c}|${sourcePin}`;
  const existing = runtime.cellConnectionRoutes.get(routeKey) || [];
  if (existing.some((target) => target && target.model_id === 0 && target.p === targetMount.p && target.r === targetMount.r && target.c === targetMount.c && target.k === HOME_OWNER_REQUEST_PIN)) {
    return true;
  }
  runtime.addLabel(model0, 0, 0, 0, {
    k: `${HOME_OWNER_ROUTE_LABEL}_${sourcePin}`,
    t: 'pin.connect.cell',
    v: [{ from: [systemMount.p, systemMount.r, systemMount.c, sourcePin], to: [[targetMount.p, targetMount.r, targetMount.c, HOME_OWNER_REQUEST_PIN]] }],
  });
  return true;
}

function buildGenericSourceOutPin(targetModelId) {
  return `owner_req_${String(targetModelId)}`;
}

function ensureGenericOwnerRoute(runtime, targetModelId) {
  const model0 = runtime.getModel(0);
  if (!model0) return false;
  const sourcePin = buildGenericSourceOutPin(targetModelId);
  const systemMount = ensureModel0SubmodelMount(runtime, -10);
  const targetMount = ensureModel0SubmodelMount(runtime, targetModelId);
  if (!systemMount || !targetMount) return false;
  runtime.addLabel(model0, systemMount.p, systemMount.r, systemMount.c, { k: sourcePin, t: 'pin.out', v: null });
  runtime.addLabel(model0, targetMount.p, targetMount.r, targetMount.c, { k: GENERIC_OWNER_REQUEST_PIN, t: 'pin.in', v: null });
  const routeKey = `0|${systemMount.p}|${systemMount.r}|${systemMount.c}|${sourcePin}`;
  const existing = runtime.cellConnectionRoutes.get(routeKey) || [];
  if (existing.some((target) => target && target.model_id === 0 && target.p === targetMount.p && target.r === targetMount.r && target.c === targetMount.c && target.k === GENERIC_OWNER_REQUEST_PIN)) {
    return true;
  }
  runtime.addLabel(model0, 0, 0, 0, {
    k: `${GENERIC_OWNER_ROUTE_LABEL}_${sourcePin}`,
    t: 'pin.connect.cell',
    v: [{ from: [systemMount.p, systemMount.r, systemMount.c, sourcePin], to: [[targetMount.p, targetMount.r, targetMount.c, GENERIC_OWNER_REQUEST_PIN]] }],
  });
  return true;
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
const INTERNAL_LABEL_TYPES = new Set([
  'MQTT_WILDCARD_SUB',
]);
const EXCLUDED_LABEL_KEYS = new Set(['snapshot_json', 'event_log']);
const CLIENT_SECRET_LABEL_KEYS = new Set([
  'matrix_token',
  'matrix_passwd',
  'access_token',
  'refresh_token',
  'password',
  'passwd',
  'secret',
  'token',
]);
const CLIENT_SECRET_LABEL_TYPES = new Set([
  'matrix.token',
  'matrix.passwd',
]);
const CLIENT_REDACTED_LABEL_TYPES = new Set([
  'func.js',
  'func.python',
]);
const CLIENT_SECRET_STRING_PATTERNS = [
  /syt_[A-Za-z0-9._=-]{8,}/u,
  /ChangeMeLocal2026/u,
];
const CLIENT_SECRET_KEY_PATTERNS = [
  /^token$/iu,
  /_token$/iu,
  /access_token/iu,
  /refresh_token/iu,
  /matrix_token/iu,
  /password/iu,
  /passwd/iu,
  /secret/iu,
];
const ALWAYS_RESTRICTED_CLIENT_MODEL_IDS = new Set([
  String(LOGIN_MODEL_ID),
  String(-10),
]);
const MATRIX_RESTRICTED_CLIENT_MODEL_IDS = new Set([
  String(MATRIX_WORKSPACE_APP_MODEL_ID),
  String(MATRIX_SESSION_MODEL_ID),
  String(MATRIX_ROOM_DIRECTORY_MODEL_ID),
  String(MATRIX_ACTIVE_CONVERSATION_MODEL_ID),
  String(MATRIX_ACTIVE_ROOM_MEMBERS_MODEL_ID),
  String(MATRIX_CHAT_UI_STATE_MODEL_ID),
  String(TRACE_MODEL_ID),
  String(MATRIX_SUITE_APP_MODEL_ID),
  String(MATRIX_CHAT_APP_MODEL_ID),
]);
const MANAGEMENT_RESTRICTED_CLIENT_MODEL_IDS = new Set([
  String(MGMT_BUS_CONSOLE_MODEL_ID),
]);
const APP_WRITE_RESTRICTED_CLIENT_MODEL_IDS = new Set([
  String(1050),
  String(WORKSPACE_MANAGER_APP_MODEL_ID),
  String(WORKSPACE_ASSET_CATALOG_MODEL_ID),
]);
const PRINCIPAL_RESTRICTED_LABEL_KEY_PATTERNS = [
  /^matrix_/iu,
  /^mgmt_/iu,
  /^management_/iu,
  /^mqtt_target_/iu,
  /access_token/iu,
  /passwd/iu,
  /password/iu,
];

function containsClientSecretValue(value, seen = new WeakSet()) {
  if (typeof value === 'string') {
    return CLIENT_SECRET_STRING_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const nestedKey = typeof value.k === 'string' ? value.k.trim().toLowerCase() : '';
  const nestedType = typeof value.t === 'string' ? value.t.trim().toLowerCase() : '';
  if (CLIENT_SECRET_LABEL_KEYS.has(nestedKey) || CLIENT_SECRET_LABEL_TYPES.has(nestedType)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsClientSecretValue(item, seen));
  }
  return Object.entries(value).some(([key, item]) => isClientSecretKey(key) || containsClientSecretValue(item, seen));
}

function isClientSecretLabel(labelKey, labelValue) {
  const normalizedKey = typeof labelKey === 'string' ? labelKey.trim().toLowerCase() : '';
  const normalizedType = labelValue && typeof labelValue.t === 'string'
    ? labelValue.t.trim().toLowerCase()
    : '';
  return CLIENT_SECRET_LABEL_KEYS.has(normalizedKey)
    || CLIENT_SECRET_LABEL_TYPES.has(normalizedType)
    || containsClientSecretValue(labelValue?.v);
}

function isClientSecretKey(key) {
  const normalized = String(key || '').trim().toLowerCase();
  return CLIENT_SECRET_LABEL_KEYS.has(normalized)
    || CLIENT_SECRET_KEY_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sanitizeClientVisibleValue(value, seen = new WeakSet()) {
  if (typeof value === 'string') {
    return CLIENT_SECRET_STRING_PATTERNS.some((pattern) => pattern.test(value)) ? undefined : value;
  }
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return undefined;
  seen.add(value);
  const nestedKey = typeof value.k === 'string' ? value.k.trim().toLowerCase() : '';
  const nestedType = typeof value.t === 'string' ? value.t.trim().toLowerCase() : '';
  if (isClientSecretKey(nestedKey) || CLIENT_SECRET_LABEL_TYPES.has(nestedType)) return undefined;
  if (Array.isArray(value)) {
    const sanitized = [];
    for (const item of value) {
      const next = sanitizeClientVisibleValue(item, seen);
      if (next !== undefined) sanitized.push(next);
    }
    return sanitized;
  }
  const sanitized = {};
  for (const [key, nested] of Object.entries(value)) {
    if (isClientSecretKey(key)) continue;
    const next = sanitizeClientVisibleValue(nested, seen);
    if (next !== undefined) sanitized[key] = next;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function principalCapabilities(principal) {
  return new Set(principal && Array.isArray(principal.capabilities) ? principal.capabilities : []);
}

function principalHasCapability(principal, capability) {
  if (!capability) return true;
  return principalCapabilities(principal).has(capability);
}

function requiredCapabilityForClientModel(modelIdText) {
  const key = String(modelIdText);
  if (ALWAYS_RESTRICTED_CLIENT_MODEL_IDS.has(key)) return 'never';
  if (MATRIX_RESTRICTED_CLIENT_MODEL_IDS.has(key)) return 'matrix:connect';
  if (MANAGEMENT_RESTRICTED_CLIENT_MODEL_IDS.has(key)) return 'management_bus:use';
  if (APP_WRITE_RESTRICTED_CLIENT_MODEL_IDS.has(key)) return 'app:write';
  return '';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function restrictedClientModelIdsForPrincipal(principal) {
  const ids = new Set(ALWAYS_RESTRICTED_CLIENT_MODEL_IDS);
  for (const id of MATRIX_RESTRICTED_CLIENT_MODEL_IDS) {
    if (!principalHasCapability(principal, 'matrix:connect')) ids.add(id);
  }
  for (const id of MANAGEMENT_RESTRICTED_CLIENT_MODEL_IDS) {
    if (!principalHasCapability(principal, 'management_bus:use')) ids.add(id);
  }
  for (const id of APP_WRITE_RESTRICTED_CLIENT_MODEL_IDS) {
    if (!principalHasCapability(principal, 'app:write')) ids.add(id);
  }
  return ids;
}

function isRestrictedClientModelReference(value, principal) {
  const modelId = typeof value === 'number' && Number.isInteger(value)
    ? String(value)
    : (typeof value === 'string' && /^-?\d+$/u.test(value.trim()) ? value.trim() : '');
  if (!modelId) return false;
  const requiredCapability = requiredCapabilityForClientModel(modelId);
  return requiredCapability === 'never'
    || (requiredCapability && !principalHasCapability(principal, requiredCapability));
}

function containsRestrictedClientModelReference(value, principal) {
  if (typeof value !== 'string') return false;
  for (const modelId of restrictedClientModelIdsForPrincipal(principal)) {
    const escaped = escapeRegExp(modelId);
    const prefix = modelId.startsWith('-') ? '(^|[^0-9-])' : '(^|[^0-9])';
    const pattern = new RegExp(`${prefix}${escaped}(?![0-9])`, 'u');
    if (pattern.test(value)) return true;
  }
  return false;
}

function restrictedTextPatternForPrincipal(principal) {
  const patterns = [/password/iu];
  if (!principalHasCapability(principal, 'matrix:connect')) {
    patterns.push(/matrix chat/iu, /matrix suite/iu, /matrix debug/iu, /matrix_userline/iu);
  }
  if (!principalHasCapability(principal, 'management_bus:use')) {
    patterns.push(/mgmt_bus/iu, /management bus/iu, /mgmt bus/iu);
  }
  if (!principalHasCapability(principal, 'app:write')) {
    patterns.push(/func\.js/iu, /func\.python/iu);
  }
  return patterns;
}

function sanitizePrincipalLabelValue(value, principal) {
  if (typeof value === 'string') {
    if (containsRestrictedClientModelReference(value, principal)
      || restrictedTextPatternForPrincipal(principal).some((pattern) => pattern.test(value))) {
      return undefined;
    }
    return value;
  }
  if (typeof value === 'number') {
    return isRestrictedClientModelReference(value, principal) ? undefined : value;
  }
  if (Array.isArray(value)) {
    const sanitized = [];
    const objectList = value.every((item) => item && typeof item === 'object' && !Array.isArray(item));
    let dropped = false;
    for (const item of value) {
      const next = sanitizePrincipalLabelValue(item, principal);
      if (next !== undefined) {
        sanitized.push(next);
      } else {
        dropped = true;
      }
    }
    if (dropped && !objectList) return undefined;
    return sanitized;
  }
  if (!value || typeof value !== 'object') return value;

  if (isRestrictedClientModelReference(value.model_id, principal)
    || isRestrictedClientModelReference(value.value, principal)) {
    return undefined;
  }

  const sanitized = {};
  let droppedProperty = false;
  for (const [key, nested] of Object.entries(value)) {
    if (containsRestrictedClientModelReference(key, principal)) {
      droppedProperty = true;
      continue;
    }
    const next = sanitizePrincipalLabelValue(nested, principal);
    if (next !== undefined) {
      sanitized[key] = next;
    } else {
      droppedProperty = true;
    }
  }
  if (droppedProperty) return undefined;
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function shouldFilterPrincipalLabel(labelKey, labelValue, principal) {
  const normalizedType = labelValue && typeof labelValue.t === 'string'
    ? labelValue.t.trim().toLowerCase()
    : '';
  if (CLIENT_REDACTED_LABEL_TYPES.has(normalizedType)) return true;
  if (isClientSecretLabel(labelKey, labelValue)) return true;
  if (containsRestrictedClientModelReference(labelKey, principal)) return true;
  if (labelValue && typeof labelValue.k === 'string' && containsRestrictedClientModelReference(labelValue.k, principal)) {
    return true;
  }
  if (
    (!principalHasCapability(principal, 'matrix:connect') || !principalHasCapability(principal, 'management_bus:use'))
    && PRINCIPAL_RESTRICTED_LABEL_KEY_PATTERNS.some((pattern) => pattern.test(labelKey))
  ) {
    return true;
  }
  return false;
}

function shouldFilterClientBaseLabel(labelKey, labelValue) {
  const normalizedType = labelValue && typeof labelValue.t === 'string'
    ? labelValue.t.trim().toLowerCase()
    : '';
  return CLIENT_REDACTED_LABEL_TYPES.has(normalizedType)
    || isClientSecretKey(labelKey)
    || isClientSecretLabel(labelKey, labelValue);
}

function sanitizeClientSnapshotLabel(labelKey, labelValue) {
  if (shouldFilterClientBaseLabel(labelKey, labelValue)) return null;
  const sanitizedValue = sanitizeClientVisibleValue(labelValue?.v);
  if (sanitizedValue === undefined && labelValue && Object.prototype.hasOwnProperty.call(labelValue, 'v')) return null;
  return sanitizedValue === labelValue?.v ? labelValue : { ...labelValue, v: sanitizedValue };
}

function buildClientSnapshotLabels(labels = {}) {
  const filteredLabels = {};
  for (const [lk, lv] of Object.entries(labels || {})) {
    const sanitized = sanitizeClientSnapshotLabel(lk, lv);
    if (sanitized) filteredLabels[lk] = sanitized;
  }
  return filteredLabels;
}

function sanitizeClientSnapshotV1nConfig(value) {
  const sanitized = sanitizeClientVisibleValue(value);
  return sanitized === undefined ? {} : sanitized;
}

function shouldFilterPrincipalCell(modelIdText, cellKey, cell, principal) {
  if (String(modelIdText) !== '0') return false;
  if (containsRestrictedClientModelReference(String(cellKey || ''), principal)) return true;
  if (isRestrictedClientModelReference(cell?.c, principal)) return true;
  const modelTypeLabel = cell && cell.labels ? cell.labels.model_type : null;
  if (isRestrictedClientModelReference(modelTypeLabel?.v, principal)) return true;
  return false;
}

function principalTableAccessIdentity(principal) {
  const identity = principalIdentity(principal);
  return identity ? identity.value : '';
}

function snapshotSubtableMount(snapshot, tableId) {
  if (!snapshot || !tableId || tableId === 'host') return { found: true, owner: '' };
  for (const model of Object.values(snapshot.models || {})) {
    for (const cell of Object.values(model?.cells || {})) {
      for (const label of Object.values(cell?.labels || {})) {
        if (!label || label.t !== 'model.subtable' || !label.v || typeof label.v !== 'object') continue;
        if (label.v.table_id !== tableId) continue;
        return {
          found: true,
          owner: typeof label.v.owner_principal_id === 'string' ? label.v.owner_principal_id.trim() : '',
        };
      }
    }
  }
  return { found: false, owner: '' };
}

function principalCanAccessSnapshotTable(snapshot, principal, tableId) {
  if (tableId === 'host') return true;
  const mount = snapshotSubtableMount(snapshot, tableId);
  if (!mount.found) return false;
  if (!mount.owner) return true;
  return principalTableAccessIdentity(principal) === mount.owner;
}

function buildClientSnapshot(runtime) {
  const snap = runtime.snapshot();
  if (!snap || !snap.models) return snap;
  const model0 = runtime.getModel(0);
  const filterConfig = model0
    ? runtime.getLabelValue(model0, 0, 0, 0, 'snapshot_filter_config')
    : null;
  const excludeTypes = filterConfig && Array.isArray(filterConfig.exclude_label_types)
    ? new Set(filterConfig.exclude_label_types)
    : INTERNAL_LABEL_TYPES;
  const excludeKeys = filterConfig && Array.isArray(filterConfig.exclude_label_keys)
    ? new Set(filterConfig.exclude_label_keys)
    : EXCLUDED_LABEL_KEYS;
  const models = {};
  for (const [id, model] of Object.entries(snap.models)) {
    const modelId = Number(id);
    // Trace model: include summary root plus cellwise UI nodes, but still skip bulk trace entry cells.
    if (modelId === TRACE_MODEL_ID) {
      const filterCell = (cell) => {
        const filteredLabels = buildClientSnapshotLabels(cell?.labels || {});
        return { ...cell, labels: filteredLabels };
      };
      const filteredCells = {};
      const rootCell = model.cells && model.cells['0,0,0'];
      if (rootCell) filteredCells['0,0,0'] = filterCell(rootCell);
      for (const [ck, cell] of Object.entries(model.cells || {})) {
        if (!ck.startsWith('2,')) continue;
        filteredCells[ck] = filterCell(cell);
      }
      models[id] = { ...model, cells: filteredCells };
      continue;
    }
    // System function model: exclude function code labels
    if (modelId === -10) {
      const filteredCells = {};
      for (const [ck, cell] of Object.entries(model.cells || {})) {
        const filteredLabels = {};
        for (const [lk, lv] of Object.entries(cell.labels || {})) {
          if (excludeTypes.has(lv.t)) continue;
          const sanitized = sanitizeClientSnapshotLabel(lk, lv);
          if (sanitized) filteredLabels[lk] = sanitized;
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
          if (excludeKeys.has(lk)) continue;
          const sanitized = sanitizeClientSnapshotLabel(lk, lv);
          if (sanitized) filteredLabels[lk] = sanitized;
        }
        filteredCells[ck] = { ...cell, labels: filteredLabels };
      }
      models[id] = { ...model, cells: filteredCells };
      continue;
    }
    const filteredCells = {};
    for (const [ck, cell] of Object.entries(model.cells || {})) {
      const filteredLabels = buildClientSnapshotLabels(cell.labels || {});
      filteredCells[ck] = { ...cell, labels: filteredLabels };
    }
    models[id] = { ...model, cells: filteredCells };
  }
  const tables = {};
  for (const [tableId, table] of Object.entries(snap.tables || {})) {
    const tableModels = {};
    for (const [id, model] of Object.entries(table?.models || {})) {
      const filteredCells = {};
      for (const [ck, cell] of Object.entries(model.cells || {})) {
        const filteredLabels = buildClientSnapshotLabels(cell.labels || {});
        filteredCells[ck] = { ...cell, labels: filteredLabels };
      }
      tableModels[id] = { ...model, cells: filteredCells };
    }
    if (Object.keys(tableModels).length > 0) {
      tables[tableId] = { ...table, table_id: tableId, models: tableModels };
    }
  }
  return {
    models,
    ...(Object.keys(tables).length > 0 ? { tables } : {}),
    v1nConfig: sanitizeClientSnapshotV1nConfig(snap.v1nConfig),
  };
}

function buildClientSnapshotForPrincipal(snapshot, principal = null) {
  if (!snapshot || !snapshot.models) return snapshot;
  const models = {};
  for (const [id, model] of Object.entries(snapshot.models)) {
    const requiredCapability = requiredCapabilityForClientModel(id);
    if (requiredCapability === 'never') continue;
    if (requiredCapability && !principalHasCapability(principal, requiredCapability)) continue;
    const filteredCells = {};
    for (const [ck, cell] of Object.entries(model.cells || {})) {
      if (shouldFilterPrincipalCell(id, ck, cell, principal)) continue;
      const filteredLabels = {};
      for (const [lk, lv] of Object.entries(cell.labels || {})) {
        if (shouldFilterClientBaseLabel(lk, lv)) continue;
        if (shouldFilterPrincipalLabel(lk, lv, principal)) continue;
        const clientSafeValue = sanitizeClientVisibleValue(lv?.v);
        if (clientSafeValue === undefined && lv && Object.prototype.hasOwnProperty.call(lv, 'v')) continue;
        const sanitizedValue = sanitizePrincipalLabelValue(clientSafeValue, principal);
        if (sanitizedValue === undefined) continue;
        filteredLabels[lk] = sanitizedValue === lv?.v ? lv : { ...lv, v: sanitizedValue };
      }
      filteredCells[ck] = { ...cell, labels: filteredLabels };
    }
    models[id] = { ...model, cells: filteredCells };
  }
  const tables = {};
  for (const [tableId, table] of Object.entries(snapshot.tables || {})) {
    if (!principalCanAccessSnapshotTable(snapshot, principal, tableId)) continue;
    const tableModels = {};
    for (const [id, model] of Object.entries(table?.models || {})) {
      const filteredCells = {};
      for (const [ck, cell] of Object.entries(model.cells || {})) {
        if (shouldFilterPrincipalCell(id, ck, cell, principal)) continue;
        const filteredLabels = {};
        for (const [lk, lv] of Object.entries(cell.labels || {})) {
          if (shouldFilterClientBaseLabel(lk, lv)) continue;
          if (shouldFilterPrincipalLabel(lk, lv, principal)) continue;
          const clientSafeValue = sanitizeClientVisibleValue(lv?.v);
          if (clientSafeValue === undefined && lv && Object.prototype.hasOwnProperty.call(lv, 'v')) continue;
          const sanitizedValue = sanitizePrincipalLabelValue(clientSafeValue, principal);
          if (sanitizedValue === undefined) continue;
          filteredLabels[lk] = sanitizedValue === lv?.v ? lv : { ...lv, v: sanitizedValue };
        }
        filteredCells[ck] = { ...cell, labels: filteredLabels };
      }
      tableModels[id] = { ...model, cells: filteredCells };
    }
    if (Object.keys(tableModels).length > 0) {
      tables[tableId] = { ...table, table_id: tableId, models: tableModels };
    }
  }
  return {
    models,
    ...(Object.keys(tables).length > 0 ? { tables } : {}),
    v1nConfig: sanitizeClientSnapshotV1nConfig(snapshot.v1nConfig),
  };
}

function readSnapshotRootLabels(snapshot, modelId) {
  return snapshot?.models?.[String(modelId)]?.cells?.['0,0,0']?.labels || {};
}

function bootstrapAllowedModelIds(snapshot) {
  void snapshot;
  return new Set([
    0,
    EDITOR_MODEL_ID,
    EDITOR_STATE_MODEL_ID,
    DESKTOP_CATALOG_MODEL_ID,
    DESKTOP_FOREGROUND_SHELL_MODEL_ID,
    GALLERY_STATE_MODEL_ID,
  ]);
}

function cloneClientSnapshotModel(model, modelId) {
  if (!model || typeof model !== 'object') return null;
  const next = cloneSnapshotJson(model);
  if (modelId === 0) {
    const root = next.cells && next.cells['0,0,0'];
    if (root && root.labels) {
      root.labels = Object.fromEntries(
        Object.entries(root.labels).filter(([key]) => BOOTSTRAP_MODEL0_LABEL_KEYS.has(key)),
      );
    }
    if (next.cells) {
      next.cells = root ? { '0,0,0': root } : {};
    }
  }
  if (modelId === EDITOR_STATE_MODEL_ID) {
    const root = next.cells && next.cells['0,0,0'];
    if (root && root.labels) {
      root.labels = Object.fromEntries(
        Object.entries(root.labels).filter(([key]) => BOOTSTRAP_EDITOR_STATE_LABEL_KEYS.has(key)),
      );
    }
    if (next.cells) {
      next.cells = root ? { '0,0,0': root } : {};
    }
  }
  if (modelId === EDITOR_MODEL_ID) {
    const cell = next.cells && next.cells['0,0,1'];
    if (cell && cell.labels) {
      cell.labels = Object.fromEntries(
        Object.entries(cell.labels).filter(([key]) => BOOTSTRAP_EDITOR_MAILBOX_LABEL_KEYS.has(key)),
      );
    }
    if (next.cells) {
      next.cells = cell ? { '0,0,1': cell } : {};
    }
  }
  if (modelId === GALLERY_STATE_MODEL_ID) {
    const root = next.cells && next.cells['0,0,0'];
    if (root && root.labels) {
      root.labels = Object.fromEntries(
        Object.entries(root.labels).filter(([key]) => BOOTSTRAP_GALLERY_STATE_LABEL_KEYS.has(key)),
      );
    }
    if (next.cells) {
      next.cells = root ? { '0,0,0': root } : {};
    }
  }
  return next;
}

function buildClientSnapshotProfile(snapshot, options = {}) {
  const profile = options && typeof options.profile === 'string' ? options.profile : 'bootstrap';
  if (profile === 'full') {
    return { ...(snapshot || {}), v1nConfig: sanitizeClientSnapshotV1nConfig(snapshot?.v1nConfig) };
  }
  const visibleModelRefs = normalizeVisibleModelRefsFromOptions(options);
  const allowed = bootstrapAllowedModelIds(snapshot);
  const models = {};
  const tables = {};
  for (const modelId of [...allowed].sort((a, b) => a - b)) {
    const model = snapshot?.models?.[String(modelId)];
    if (!model) continue;
    const cloned = cloneClientSnapshotModel(model, modelId);
    if (cloned) models[String(modelId)] = cloned;
  }
  for (const ref of visibleModelRefs) {
    const model = getSnapshotModelByRef(snapshot, ref);
    if (!model) continue;
    if (ref.table_id === 'host') {
      models[String(ref.model_id)] = cloneSnapshotJson(model);
      continue;
    }
    if (!tables[ref.table_id]) {
      tables[ref.table_id] = { table_id: ref.table_id, models: {} };
    }
    tables[ref.table_id].models[String(ref.model_id)] = cloneSnapshotJson(model);
  }
  const out = { models, v1nConfig: sanitizeClientSnapshotV1nConfig(snapshot?.v1nConfig) };
  if (Object.keys(tables).length > 0) out.tables = tables;
  return out;
}

function normalizeVisibleModelRef(value) {
  if (Number.isInteger(value)) return { table_id: 'host', model_id: value };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const tableId = typeof value.table_id === 'string' && value.table_id.trim()
    ? value.table_id.trim()
    : 'host';
  if (!Number.isInteger(value.model_id)) return null;
  return { table_id: tableId, model_id: value.model_id };
}

function normalizeVisibleModelRefsFromOptions(options = {}) {
  const refs = [];
  if (Array.isArray(options.visibleModelRefs)) {
    for (const ref of options.visibleModelRefs) {
      const normalized = normalizeVisibleModelRef(ref);
      if (normalized) refs.push(normalized);
    }
  }
  if (Array.isArray(options.visibleModelIds)) {
    for (const modelId of options.visibleModelIds) {
      if (Number.isInteger(modelId)) refs.push({ table_id: 'host', model_id: modelId });
    }
  }
  const seen = new Set();
  const out = [];
  for (const ref of refs) {
    const key = `${ref.table_id}|${ref.model_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  out.sort((a, b) => a.table_id.localeCompare(b.table_id) || a.model_id - b.model_id);
  return out;
}

function getSnapshotModelByRef(snapshot, ref) {
  const normalized = normalizeVisibleModelRef(ref);
  if (!normalized) return null;
  if (normalized.table_id === 'host') {
    return snapshot?.models?.[String(normalized.model_id)] || null;
  }
  return snapshot?.tables?.[normalized.table_id]?.models?.[String(normalized.model_id)] || null;
}

function snapshotModelEntries(snapshot) {
  const entries = [];
  for (const [modelKey, model] of Object.entries(snapshot?.models || {})) {
    const modelId = normalizeStatsModelId(modelKey);
    if (Number.isInteger(modelId)) {
      entries.push({ table_id: 'host', model_id: modelId, key: `host|${modelId}`, modelKey, model });
    }
  }
  for (const [tableId, table] of Object.entries(snapshot?.tables || {})) {
    for (const [modelKey, model] of Object.entries(table?.models || {})) {
      const modelId = normalizeStatsModelId(modelKey);
      if (Number.isInteger(modelId)) {
        entries.push({ table_id: tableId, model_id: modelId, key: `${tableId}|${modelId}`, modelKey, model });
      }
    }
  }
  entries.sort((a, b) => a.table_id.localeCompare(b.table_id) || a.model_id - b.model_id);
  return entries;
}

function jsonByteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function normalizeStatsModelId(modelKey) {
  return /^-?\d+$/u.test(String(modelKey)) ? Number.parseInt(String(modelKey), 10) : modelKey;
}

function parseStatsCellKey(cellKey) {
  const parts = String(cellKey || '').split(',').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return { p: 0, r: 0, c: 0 };
  return { p: parts[0], r: parts[1], c: parts[2] };
}

function countSnapshotLabels(snapshot) {
  let count = 0;
  for (const model of Object.values(snapshot?.models || {})) {
    for (const cell of Object.values(model?.cells || {})) {
      count += Object.keys(cell?.labels || {}).length;
    }
  }
  for (const table of Object.values(snapshot?.tables || {})) {
    for (const model of Object.values(table?.models || {})) {
      for (const cell of Object.values(model?.cells || {})) {
        count += Object.keys(cell?.labels || {}).length;
      }
    }
  }
  return count;
}

function buildClientSnapshotProfileStats(sourceSnapshot, profiledSnapshot, options = {}) {
  const profile = options && typeof options.profile === 'string' ? options.profile : 'bootstrap';
  const visibleModelIds = Array.isArray(options?.visibleModelIds) ? options.visibleModelIds.filter(Number.isInteger) : [];
  const visibleModelRefs = normalizeVisibleModelRefsFromOptions(options);
  const modelStats = [];
  const cellStats = [];
  const labelStats = [];
  const profiledEntries = snapshotModelEntries(profiledSnapshot);
  for (const { table_id: tableId, model_id: modelId, modelKey, model } of profiledEntries) {
    modelStats.push({
      table_id: tableId,
      model_id: modelId,
      bytes: jsonByteLength(model),
      cell_count: Object.keys(model?.cells || {}).length,
      label_count: countSnapshotLabels({ models: { [modelKey]: model } }),
    });
    for (const [cellKey, cell] of Object.entries(model?.cells || {})) {
      const parsed = parseStatsCellKey(cellKey);
      cellStats.push({
        table_id: tableId,
        model_id: modelId,
        p: Number.isInteger(cell?.p) ? cell.p : parsed.p,
        r: Number.isInteger(cell?.r) ? cell.r : parsed.r,
        c: Number.isInteger(cell?.c) ? cell.c : parsed.c,
        bytes: jsonByteLength(cell),
        label_count: Object.keys(cell?.labels || {}).length,
      });
      for (const [labelKey, labelValue] of Object.entries(cell?.labels || {})) {
        labelStats.push({
          table_id: tableId,
          model_id: modelId,
          p: Number.isInteger(cell?.p) ? cell.p : parsed.p,
          r: Number.isInteger(cell?.r) ? cell.r : parsed.r,
          c: Number.isInteger(cell?.c) ? cell.c : parsed.c,
          k: labelKey,
          t: typeof labelValue?.t === 'string' ? labelValue.t : '',
          bytes: jsonByteLength(labelValue),
        });
      }
    }
  }
  modelStats.sort((a, b) => b.bytes - a.bytes || String(a.model_id).localeCompare(String(b.model_id)));
  cellStats.sort((a, b) => b.bytes - a.bytes || String(a.model_id).localeCompare(String(b.model_id)) || a.p - b.p || a.r - b.r || a.c - b.c);
  labelStats.sort((a, b) => b.bytes - a.bytes || String(a.model_id).localeCompare(String(b.model_id)) || a.p - b.p || a.r - b.r || a.c - b.c || a.k.localeCompare(b.k));

  const sourceModelCount = snapshotModelEntries(sourceSnapshot).length;
  const sourceLabelCount = countSnapshotLabels(sourceSnapshot);
  const visibleModelCount = profiledEntries.length;
  const visibleLabelCount = countSnapshotLabels(profiledSnapshot);
  return {
    profile,
    visible_model_ids: visibleModelIds,
    visible_model_refs: visibleModelRefs,
    total_bytes: jsonByteLength(profiledSnapshot || {}),
    model_count: visibleModelCount,
    cell_count: cellStats.length,
    label_count: visibleLabelCount,
    dropped_model_count: Math.max(0, sourceModelCount - visibleModelCount),
    dropped_label_count: Math.max(0, sourceLabelCount - visibleLabelCount),
    models: modelStats,
    cells: cellStats.slice(0, Number.isInteger(options?.topCellLimit) ? Math.max(0, options.topCellLimit) : 20),
    top_labels: labelStats.slice(0, Number.isInteger(options?.topLabelLimit) ? Math.max(0, options.topLabelLimit) : 20),
  };
}

function buildClientSnapshotProfileWithStats(snapshot, options = {}) {
  const profiledSnapshot = buildClientSnapshotProfile(snapshot, options);
  return {
    snapshot: profiledSnapshot,
    snapshot_stats: buildClientSnapshotProfileStats(snapshot, profiledSnapshot, options),
  };
}

function cloneSnapshotJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function snapshotJsonEquals(a, b) {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (_) {
    return false;
  }
}

function normalizeSnapshotModelId(id) {
  const text = String(id);
  return /^-?\d+$/u.test(text) ? Number(text) : text;
}

function buildClientSnapshotPatchOps(previousSnapshot, nextSnapshot) {
  const prev = previousSnapshot && previousSnapshot.models ? previousSnapshot : { models: {}, v1nConfig: undefined };
  const next = nextSnapshot && nextSnapshot.models ? nextSnapshot : { models: {}, v1nConfig: undefined };
  const ops = [];
  if (!snapshotJsonEquals(prev.v1nConfig, next.v1nConfig)) {
    ops.push({ op: 'replace_v1n_config', value: cloneSnapshotJson(next.v1nConfig) });
  }
  const prevModels = new Map(snapshotModelEntries(prev).map((entry) => [entry.key, entry]));
  const nextModels = new Map(snapshotModelEntries(next).map((entry) => [entry.key, entry]));
  const modelKeys = new Set([...prevModels.keys(), ...nextModels.keys()]);
  for (const modelKey of [...modelKeys].sort()) {
    const prevEntry = prevModels.get(modelKey);
    const nextEntry = nextModels.get(modelKey);
    const refEntry = nextEntry || prevEntry;
    const tableId = refEntry.table_id;
    const normalizedModelId = refEntry.model_id;
    const withTableId = (op) => tableId === 'host' ? op : { table_id: tableId, ...op };
    const prevModel = prevEntry && prevEntry.model;
    const nextModel = nextEntry && nextEntry.model;
    if (!nextModel) {
      ops.push(withTableId({ op: 'delete_model', model_id: normalizedModelId }));
      continue;
    }
    if (!prevModel) {
      ops.push(withTableId({ op: 'replace_model', model_id: normalizedModelId, value: cloneSnapshotJson(nextModel) }));
      continue;
    }
    const prevCells = prevModel.cells || {};
    const nextCells = nextModel.cells || {};
    const cellKeys = new Set([...Object.keys(prevCells), ...Object.keys(nextCells)]);
    for (const cellKey of [...cellKeys].sort()) {
      const prevCell = prevCells[cellKey];
      const nextCell = nextCells[cellKey];
      if (!nextCell) {
        ops.push(withTableId({ op: 'delete_cell', model_id: normalizedModelId, cell_key: cellKey }));
        continue;
      }
      if (!prevCell) {
        ops.push(withTableId({ op: 'replace_cell', model_id: normalizedModelId, cell_key: cellKey, value: cloneSnapshotJson(nextCell) }));
        continue;
      }
      const prevLabels = prevCell.labels || {};
      const nextLabels = nextCell.labels || {};
      const labelKeys = new Set([...Object.keys(prevLabels), ...Object.keys(nextLabels)]);
      for (const labelKey of [...labelKeys].sort()) {
        const prevLabel = prevLabels[labelKey];
        const nextLabel = nextLabels[labelKey];
        if (!nextLabel) {
          ops.push(withTableId({ op: 'delete_label', model_id: normalizedModelId, cell_key: cellKey, label_key: labelKey }));
          continue;
        }
        if (!prevLabel || !snapshotJsonEquals(prevLabel, nextLabel)) {
          ops.push(withTableId({ op: 'replace_label', model_id: normalizedModelId, cell_key: cellKey, label_key: labelKey, value: cloneSnapshotJson(nextLabel) }));
        }
      }
    }
  }
  return ops;
}

function buildClientSnapshotPatchMessage({
  previousSnapshot,
  nextSnapshot,
  baseSnapshotSeq,
  snapshotSeq,
  opId = '',
  previousPrincipalKey = '',
  currentPrincipalKey = '',
  maxOps = 1000,
  maxPatchBytes = 32 * 1024,
  snapshotProfile = '',
  visibleModelIds = [],
  visibleModelRefs = [],
} = {}) {
  const normalizedNext = nextSnapshot && nextSnapshot.models ? nextSnapshot : { models: {}, v1nConfig: undefined };
  const normalizedSnapshotSeq = Number.isInteger(snapshotSeq) ? snapshotSeq : 0;
  const normalizedBaseSeq = Number.isInteger(baseSnapshotSeq) ? baseSnapshotSeq : 0;
  const normalizedOpId = typeof opId === 'string' ? opId : '';
  const normalizedProfile = typeof snapshotProfile === 'string' && snapshotProfile.trim()
    ? snapshotProfile.trim()
    : '';
  const normalizedVisibleModelIds = Array.isArray(visibleModelIds)
    ? [...new Set(visibleModelIds.filter((modelId) => Number.isInteger(modelId)))].sort((a, b) => a - b)
    : [];
  const normalizedVisibleModelRefs = normalizeVisibleModelRefsFromOptions({ visibleModelIds: normalizedVisibleModelIds, visibleModelRefs });
  const resetData = {
    snapshot: cloneSnapshotJson(normalizedNext),
    snapshot_seq: normalizedSnapshotSeq,
    op_id: normalizedOpId,
    patch_kind: previousPrincipalKey && currentPrincipalKey && previousPrincipalKey !== currentPrincipalKey
      ? 'principal_reset'
      : 'reset',
    ...(normalizedProfile ? { snapshot_profile: normalizedProfile } : {}),
    ...(normalizedProfile ? { visible_model_ids: normalizedVisibleModelIds } : {}),
    ...(normalizedProfile ? { visible_model_refs: normalizedVisibleModelRefs } : {}),
  };
  if (!previousSnapshot || !previousSnapshot.models || previousPrincipalKey !== currentPrincipalKey) {
    return { event: 'snapshot', data: resetData };
  }
  const ops = buildClientSnapshotPatchOps(previousSnapshot, normalizedNext);
  if (ops.length === 0) {
    return {
      event: 'noop',
      data: {
        snapshot_seq: normalizedSnapshotSeq,
        base_snapshot_seq: normalizedBaseSeq,
        op_id: normalizedOpId,
        patch_kind: 'noop',
        ...(normalizedProfile ? { snapshot_profile: normalizedProfile } : {}),
        ...(normalizedProfile ? { visible_model_ids: normalizedVisibleModelIds } : {}),
        ...(normalizedProfile ? { visible_model_refs: normalizedVisibleModelRefs } : {}),
      },
    };
  }
  const patch = {
    patch_kind: 'json_replace_v1',
    snapshot_seq: normalizedSnapshotSeq,
    base_snapshot_seq: normalizedBaseSeq,
    op_id: normalizedOpId,
    ops,
  };
  const patchStats = {
    bytes: Buffer.byteLength(JSON.stringify(patch), 'utf8'),
    op_count: ops.length,
  };
  const data = {
    snapshot_patch: patch,
    snapshot_seq: normalizedSnapshotSeq,
    base_snapshot_seq: normalizedBaseSeq,
    op_id: normalizedOpId,
    patch_stats: patchStats,
    ...(normalizedProfile ? { snapshot_profile: normalizedProfile } : {}),
    ...(normalizedProfile ? { visible_model_ids: normalizedVisibleModelIds } : {}),
    ...(normalizedProfile ? { visible_model_refs: normalizedVisibleModelRefs } : {}),
  };
  if (ops.length > maxOps || patchStats.bytes > maxPatchBytes) {
    return {
      event: 'snapshot',
      data: {
        ...resetData,
        patch_kind: 'oversize_reset',
        fallback_reason: ops.length > maxOps ? 'patch_too_many_ops' : 'patch_oversize',
        patch_stats: patchStats,
      },
    };
  }
  return { event: 'snapshot_patch', data };
}

function buildGuestClientSnapshot(snapshot) {
  return buildClientSnapshotForPrincipal(snapshot, null);
}

function resolveDbPath() {
  const workspace = process.env.WORKER_BASE_WORKSPACE || 'default';
  const configuredRoot = process.env.WORKER_BASE_DATA_ROOT;
  const dataRoot = configuredRoot && configuredRoot.trim()
    ? (path.isAbsolute(configuredRoot) ? configuredRoot : path.resolve(process.cwd(), configuredRoot))
    : path.join(DEFAULT_PERSIST_ROOT, 'runtime');
  return path.resolve(dataRoot, workspace, 'yhl.db');
}

function ensureStateLabel(runtime, key, t, v) {
  const model = runtime.getModel(EDITOR_STATE_MODEL_ID);
  const cell = runtime.getCell(model, 0, 0, 0);
  if (!cell.labels.has(key)) {
    runtime.addLabel(model, 0, 0, 0, { k: key, t, v });
  }
}

function overwriteStateLabel(runtime, key, t, v) {
  const model = runtime.getModel(EDITOR_STATE_MODEL_ID);
  const cell = runtime.getCell(model, 0, 0, 0);
  const current = cell.labels.get(key) || null;
  if (current && current.t === t && modelTableValueEquals(current.v, v)) {
    return;
  }
  if (current) {
    runtime.rmLabel(model, 0, 0, 0, key);
  }
  runtime.addLabel(model, 0, 0, 0, { k: key, t, v });
}

function getMaxPositiveModelId(runtime) {
  const snap = runtime.snapshot();
  const models = snap && snap.models ? snap.models : {};
  let maxModelId = 0;
  for (const idText of Object.keys(models)) {
    const mid = Number(idText);
    if (Number.isInteger(mid) && mid > maxModelId) {
      maxModelId = mid;
    }
  }
  return maxModelId;
}

function resolveNextWorkspaceModelId(runtime) {
  return Math.max(1001, getMaxPositiveModelId(runtime) + 1);
}

function resolveDefaultAppId(runtime, apps) {
  const model0 = runtime.getModel(0);
  const configDefault = model0
    ? runtime.getLabelValue(model0, 0, 0, 0, 'workspace_default_app')
    : null;
  let preferred = null;
  if (Number.isInteger(configDefault)) {
    preferred = configDefault;
  } else {
    const parsed = Number.parseInt(String(readAuthString(configDefault)), 10);
    if (Number.isInteger(parsed)) preferred = parsed;
  }
  if (Number.isInteger(preferred) && apps.some((app) => app && app.model_id === preferred)) return preferred;
  const firstSlideCapable = apps.find((app) => app && app.slide_capable === true && Number.isInteger(app.model_id) && app.model_id > 0);
  if (firstSlideCapable) return firstSlideCapable.model_id;
  const firstPositive = apps.find((app) => app && Number.isInteger(app.model_id) && app.model_id > 0);
  return firstPositive ? firstPositive.model_id : (apps.length > 0 ? apps[0].model_id : 0);
}

function resolveWorkspaceSelection(apps, selectedValue, defaultSelected) {
  let selected = null;
  if (Number.isInteger(selectedValue)) {
    selected = selectedValue;
  } else {
    const parsed = Number.parseInt(String(readAuthString(selectedValue)), 10);
    if (Number.isInteger(parsed)) selected = parsed;
  }
  if (apps.some((app) => app && app.model_id === selected)) {
    return selected;
  }
  return defaultSelected;
}

function normalizeDesktopWorkspaceModelRef(value) {
  if (!value || typeof value !== 'object' || !Number.isInteger(value.model_id)) return null;
  const tableId = typeof value.table_id === 'string' && value.table_id.trim()
    ? value.table_id.trim()
    : 'host';
  return { table_id: tableId, model_id: value.model_id };
}

function runtimeHasDesktopWorkspaceModel(runtime, app) {
  const ref = normalizeDesktopWorkspaceModelRef(app);
  if (!ref) return false;
  return Boolean(runtime.getModel(ref));
}

function isValidDesktopAppForWorkspaceCatalog(runtime, app, validWorkspaceModelRefs) {
  const normalized = normalizeDesktopForegroundApp(app);
  if (!normalized) return false;
  if (normalized.page !== 'workspace') return true;
  if (!Number.isInteger(normalized.model_id)) return false;
  const refKey = desktopAppRefKey(normalized);
  if (!validWorkspaceModelRefs.has(refKey)) return false;
  return runtimeHasDesktopWorkspaceModel(runtime, normalized);
}

function sanitizeDesktopWorkspaceAppState(runtime, apps) {
  const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
  if (!stateModel) return;
  const validWorkspaceModelRefs = new Set(
    (Array.isArray(apps) ? apps : [])
      .filter((app) => app && Number.isInteger(app.model_id) && runtimeHasDesktopWorkspaceModel(runtime, app))
      .map((app) => desktopAppRefKey(app)),
  );
  const currentForeground = normalizeDesktopForegroundApp(
    runtime.getLabelValue(stateModel, 0, 0, 0, DESKTOP_FOREGROUND_APP_LABEL),
  );
  if (currentForeground && !isValidDesktopAppForWorkspaceCatalog(runtime, currentForeground, validWorkspaceModelRefs)) {
    overwriteStateLabel(runtime, DESKTOP_FOREGROUND_APP_LABEL, 'json', null);
  }
  const currentTaskStack = normalizeDesktopTaskStack(
    runtime.getLabelValue(stateModel, 0, 0, 0, DESKTOP_TASK_STACK_LABEL),
  );
  const nextTaskStack = currentTaskStack.filter((task) => (
    isValidDesktopAppForWorkspaceCatalog(runtime, task, validWorkspaceModelRefs)
  ));
  overwriteStateLabel(runtime, DESKTOP_TASK_STACK_LABEL, 'json', nextTaskStack);
}

function overwriteRuntimeLabel(runtime, modelId, p, r, c, key, t, v) {
  const model = runtime.getModel(modelId);
  if (!model) return;
  const cell = runtime.getCell(model, p, r, c);
  const current = cell.labels.get(key) || null;
  if (current && current.t === t && modelTableValueEquals(current.v, v)) {
    return;
  }
  if (current) {
    runtime.rmLabel(model, p, r, c, key);
  }
  runtime.addLabel(model, p, r, c, { k: key, t, v });
}

function withRuntimePersistenceDisabled(runtime, fn) {
  const persister = runtime && runtime.persistence ? runtime.persistence : null;
  const canToggle = persister && typeof persister.setEnabled === 'function';
  if (!canToggle) return fn();
  const previousEnabled = Boolean(persister.enabled);
  persister.setEnabled(false);
  let result;
  try {
    result = fn();
  } catch (err) {
    persister.setEnabled(previousEnabled);
    throw err;
  }
  if (result && typeof result.then === 'function') {
    persister.setEnabled(previousEnabled);
    throw new Error('persistence_disabled_async_callback_forbidden');
  }
  persister.setEnabled(previousEnabled);
  return result;
}

function readRuntimeCellLabel(runtime, modelId, p, r, c, key) {
  const model = runtime && typeof runtime.getModel === 'function' ? runtime.getModel(modelId) : null;
  if (!model) return null;
  const cell = runtime.getCell(model, p, r, c);
  return cell && cell.labels ? (cell.labels.get(key) || null) : null;
}

function readRuntimeCellString(runtime, modelId, p, r, c, key, fallback = '') {
  const label = readRuntimeCellLabel(runtime, modelId, p, r, c, key);
  return label && typeof label.v === 'string' ? label.v : fallback;
}

function readRuntimePrincipalKey(runtime) {
  const labelKey = readRuntimeCellString(runtime, 0, 0, 0, 'principal_runtime_key', '');
  if (labelKey) return labelKey;
  return runtime && typeof runtime.principalRuntimeKey === 'string'
    ? runtime.principalRuntimeKey.trim()
    : '';
}

function readRuntimeCellInt(runtime, modelId, p, r, c, key, fallback = null) {
  const label = readRuntimeCellLabel(runtime, modelId, p, r, c, key);
  return label && Number.isInteger(label.v) ? label.v : fallback;
}

function readRuntimeCellBool(runtime, modelId, p, r, c, key, fallback = false) {
  const label = readRuntimeCellLabel(runtime, modelId, p, r, c, key);
  return label && typeof label.v === 'boolean' ? label.v : fallback;
}

function readRuntimeCellJson(runtime, modelId, p, r, c, key, fallback = null) {
  const label = readRuntimeCellLabel(runtime, modelId, p, r, c, key);
  return label && label.t === 'json' ? label.v : fallback;
}

function buildWorkspaceAssetProviderBundleTopic(runtime, row) {
  if (!row || typeof row !== 'object') return '';
  return buildRemoteEndpointTopic(runtime, {
    to: {
      worker_id: row.provider_worker_id,
      model_id: row.provider_model_id,
    },
  }, row.provider_bundle_pin);
}

function validateWorkspaceAssetProviderEndpoint(runtime, row) {
  const routeKind = typeof row?.provider_route_kind === 'string' ? row.provider_route_kind.trim() : '';
  const topic = buildWorkspaceAssetProviderBundleTopic(runtime, row);
  const runtimePins = Array.isArray(row?.runtime_pins) ? row.runtime_pins : [];
  const ok = isSafePinRouteSegment(row?.provider_worker_id)
    && Number.isInteger(row?.provider_model_id)
    && row.provider_model_id > 0
    && isSafePinRouteSegment(row?.provider_bundle_pin)
    && (routeKind === 'control' || routeKind === 'management')
    && isValidControlBusEndpointTopic(topic)
    && isSafePinRouteSegment(row?.runtime_endpoint_worker_id)
    && Number.isInteger(row?.runtime_endpoint_model_id)
    && row.runtime_endpoint_model_id > 0
    && runtimePins.length > 0
    && runtimePins.every(isSafePinRouteSegment);
  return {
    ok,
    topic,
    routeKind,
  };
}

function buildWorkspaceAssetBundleRequestPacket(runtime, row, opId, providerEndpoint) {
  const now = Date.now();
  const requestId = typeof opId === 'string' && opId.trim()
    ? opId.trim()
    : `workspace_asset_bundle_${now}`;
  const routeKind = providerEndpoint.routeKind;
  const endpoint = {
    worker_id: row.provider_worker_id,
    table_id: 'host',
    model_id: row.provider_model_id,
    pin: row.provider_bundle_pin,
  };
  const origin = {
    worker_id: resolveUiServerWorkerId(),
    table_id: 'host',
    model_id: WORKSPACE_MANAGER_APP_MODEL_ID,
    pin: 'workspace_asset_install',
  };
  const replyTarget = {
    worker_id: resolveUiServerWorkerId(),
    table_id: 'host',
    model_id: WORKSPACE_MANAGER_APP_MODEL_ID,
    pin: SLIDE_IMPORT_REPLY_PIN,
  };
  const principalKey = readRuntimePrincipalKey(runtime);
  const responseTopic = buildEndpointTopic(runtime, replyTarget);
  const nestedPayload = [
    mtPayloadRecord('__mt_payload_kind', 'str', 'slide_app_bundle_request.v1'),
    mtPayloadRecord('__mt_request_id', 'str', requestId),
    mtPayloadRecord('asset_id', 'str', row.id),
    mtPayloadRecord('requested_version', 'str', 'current'),
  ];
  const records = [
    mtPayloadRecord('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mtPayloadRecord('__mt_request_id', 'str', requestId),
    mtPayloadRecord('op_id', 'str', requestId),
    mtPayloadRecord('message_role', 'str', 'request'),
    mtPayloadRecord('topic', 'str', providerEndpoint.topic),
    mtPayloadRecord('response_topic', 'str', responseTopic),
    mtPayloadRecord('route_kind', 'str', routeKind),
    mtPayloadRecord('bus', 'str', routeKind),
    mtPayloadRecord('endpoint_worker_id', 'str', endpoint.worker_id),
    mtPayloadRecord('endpoint_table_id', 'str', endpoint.table_id),
    mtPayloadRecord('endpoint_model_id', 'int', endpoint.model_id),
    mtPayloadRecord('endpoint_pin', 'str', endpoint.pin),
    mtPayloadRecord('origin_worker_id', 'str', origin.worker_id),
    mtPayloadRecord('origin_table_id', 'str', origin.table_id),
    mtPayloadRecord('origin_model_id', 'int', origin.model_id),
    mtPayloadRecord('origin_pin', 'str', origin.pin),
    mtPayloadRecord('reply_target_worker_id', 'str', replyTarget.worker_id),
    mtPayloadRecord('reply_target_table_id', 'str', replyTarget.table_id),
    mtPayloadRecord('reply_target_model_id', 'int', replyTarget.model_id),
    mtPayloadRecord('reply_target_pin', 'str', replyTarget.pin),
    ...(principalKey ? [mtPayloadRecord('reply_target_principal_key', 'str', principalKey)] : []),
    mtPayloadRecord('payload', 'json', nestedPayload),
    mtPayloadRecord('timestamp', 'int', now),
  ];
  return {
    opId: requestId,
    routeKind,
    endpoint,
    origin,
    replyTarget,
    topic: providerEndpoint.topic,
    responseTopic,
    records,
  };
}

function workspaceAssetProviderEndpointMatches(actual, expected) {
  return Boolean(actual && expected
    && actual.worker_id === expected.worker_id
    && actual.model_id === expected.model_id
    && actual.pin === expected.pin);
}

function registerImportedHostEgressBridgeFunctions(programEngine, runtime, imported) {
  if (!programEngine || !imported) return;
  const rawKeys = Array.isArray(imported.hostEgressKeys)
    ? imported.hostEgressKeys
    : (imported.hostEgressKeys ? [imported.hostEgressKeys] : []);
  const functionKeys = [];
  for (const entry of rawKeys) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.bridgeFunc === 'string' && entry.bridgeFunc) functionKeys.push(entry.bridgeFunc);
    if (typeof entry.forwardFunc === 'string' && entry.forwardFunc) functionKeys.push(entry.forwardFunc);
  }
  if (functionKeys.length === 0) return;
  const sys = firstSystemModel(runtime);
  if (!sys) return;
  for (const key of functionKeys) {
    const code = extractFunctionCode(runtime.getCell(sys, 0, 0, 0).labels.get(key)?.v);
    if (typeof code === 'string' && code.trim()) {
      programEngine.functions.set(key, code);
      sys.registerFunction(key);
    }
  }
}

function deriveWorkspaceAssetCatalogRowsFromDataArrayOne(runtime) {
  const catalog = runtime && typeof runtime.getModel === 'function'
    ? runtime.getModel(WORKSPACE_ASSET_CATALOG_MODEL_ID)
    : null;
  if (!catalog) return [];
  const rootType = readRuntimeCellLabel(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, 0, 0, 'model_type');
  if (!rootType || rootType.t !== 'model.table' || rootType.v !== 'Data.Array.One') return [];
  const maxRow = readRuntimeCellInt(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, 0, 0, 'max_r', 0);
  const rows = [];
  for (let rowIndex = 1; rowIndex <= maxRow; rowIndex += 1) {
    const id = readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'asset_id', '').trim();
    const name = readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'name', '').trim();
    if (!id || !name) continue;
    const installable = readRuntimeCellBool(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'installable', false);
    const providerModelId = readRuntimeCellInt(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'provider_model_id', null);
    const runtimeEndpointModelId = readRuntimeCellInt(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'runtime_endpoint_model_id', null);
    const row = {
      id,
      name,
      kind: readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'kind', ''),
      asset_type: readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'asset_type', ''),
      owner: readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'owner', ''),
      owner_worker_id: readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'owner_worker_id', ''),
      parent_asset_id: readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'parent_asset_id', ''),
      provider_worker_id: readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'provider_worker_id', ''),
      ...(Number.isInteger(providerModelId) ? { provider_model_id: providerModelId } : {}),
      provider_bundle_pin: readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'provider_bundle_pin', ''),
      provider_route_kind: readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'provider_route_kind', ''),
      runtime_endpoint_worker_id: readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'runtime_endpoint_worker_id', ''),
      ...(Number.isInteger(runtimeEndpointModelId) ? { runtime_endpoint_model_id: runtimeEndpointModelId } : {}),
      runtime_pins: readRuntimeCellJson(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'runtime_pins', []),
      bundle_resource_uri: readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'bundle_resource_uri', ''),
      bundle_sha256: readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'bundle_sha256', ''),
      installable,
      action_label: readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'action_label', installable ? '安装' : '详情'),
      action_type: installable ? 'primary' : 'default',
      summary_markdown: readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'summary_markdown', `### ${name}`),
      detail_markdown: readRuntimeCellString(runtime, WORKSPACE_ASSET_CATALOG_MODEL_ID, 0, rowIndex, 0, 'detail_markdown', `## ${name}`),
    };
    const providerBundleTopic = buildWorkspaceAssetProviderBundleTopic(runtime, row);
    if (providerBundleTopic) row.provider_bundle_topic = providerBundleTopic;
    rows.push(row);
  }
  return rows;
}

function syncWorkspaceAssetCatalogProjection(runtime) {
  const rows = deriveWorkspaceAssetCatalogRowsFromDataArrayOne(runtime);
  if (rows.length === 0) return rows;
  overwriteRuntimeLabel(runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'asset_catalog_json', 'json', rows);
  return rows;
}

function findWorkspaceAssetCatalogRow(runtime, assetId) {
  const id = typeof assetId === 'string' ? assetId.trim() : '';
  if (!id) return null;
  return deriveWorkspaceAssetCatalogRowsFromDataArrayOne(runtime).find((row) => row.id === id) || null;
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

function isFunctionLikeLabelType(typeName) {
  return typeName === 'func.js' || typeName === 'func.python';
}

function isExecutableJsFunctionLabelType(typeName) {
  return typeName === 'func.js';
}

function extractFunctionCode(value) {
  if (value && typeof value === 'object' && typeof value.code === 'string') return value.code;
  return '';
}

function firstSystemModel(runtime) {
  const canonical = runtime.getModel(-10);
  if (canonical) return canonical;
  const fnLabel = listSystemLabels(runtime, (label) => isFunctionLikeLabelType(label.t))[0];
  if (fnLabel) return fnLabel.model;
  for (const [id, model] of runtime.models.entries()) {
    if (id < 0) return model;
  }
  return null;
}

function readDualBusConfig(runtime, modelId) {
  if (!Number.isInteger(modelId) || modelId <= 0) return null;
  const model = runtime.getModel(modelId);
  if (!model) return null;
  const value = runtime.getCell(model, 0, 0, 0).labels.get('dual_bus_model')?.v ?? null;
  return value && typeof value === 'object' ? value : null;
}

const SLIDE_IMPORTER_CLICK_PAYLOAD = Object.freeze([
  { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
  { id: 0, p: 0, r: 0, c: 0, k: 'target', t: 'json', v: { model_id: 1031, p: 0, r: 0, c: 0 } },
]);

const SLIDE_IMPORTER_MEDIA_URI_BIND = Object.freeze({
  write: {
    bus_event_v2: true,
    bus_in_key: 'slide_import_media_uri_update',
    value_ref: [
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'write_label.v1' },
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_request_id', t: 'str', v: 'slide_import_media_uri_update' },
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_from_cell', t: 'json', v: { p: 0, r: 0, c: 0 } },
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_target_cell', t: 'json', v: { p: 0, r: 0, c: 0 } },
      { id: 0, p: 0, r: 0, c: 0, k: 'slide_import_media_uri', t: 'str', v: { $ref: 'value' } },
    ],
    value_t: 'modeltable',
  },
});

const SLIDE_IMPORTER_CLICK_BIND = Object.freeze({
  write: {
    bus_event_v2: true,
    bus_in_key: 'slide_import_click',
    value_ref: [
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'write_label.v1' },
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_request_id', t: 'str', v: 'slide_import_click' },
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_from_cell', t: 'json', v: { p: 0, r: 0, c: 0 } },
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_target_cell', t: 'json', v: { p: 2, r: 4, c: 0 } },
      { id: 0, p: 0, r: 0, c: 0, k: 'click', t: 'pin.in', v: SLIDE_IMPORTER_CLICK_PAYLOAD },
    ],
    value_t: 'modeltable',
  },
});

const SLIDE_IMPORTER_BUCKET_C_ROUTES = Object.freeze([
  { from: [2, 4, 0, 'write_label_req'], to: [[0, 0, 0, 'mt_write_req']] },
]);

const SLIDE_IMPORTER_CLICK_ROUTE = Object.freeze([
  { from: 'click', to: ['handle_slide_import_click:in'] },
]);

const SLIDE_IMPORTER_ROOT_MOUNT = Object.freeze({ p: 2, r: 0, c: 13 });
const SLIDE_IMPORTER_SYSTEM_MOUNT = Object.freeze({ p: 1, r: 0, c: 3 });

const SLIDE_IMPORTER_CLICK_INGRESS_ROUTE = Object.freeze([
  { from: [0, 0, 0, 'slide_import_click'], to: [[SLIDE_IMPORTER_ROOT_MOUNT.p, SLIDE_IMPORTER_ROOT_MOUNT.r, SLIDE_IMPORTER_ROOT_MOUNT.c, 'mt_bus_receive_in']] },
]);

const SLIDE_IMPORTER_MEDIA_URI_UPDATE_ROUTE = Object.freeze([
  { from: [0, 0, 0, 'slide_import_media_uri_update'], to: [[SLIDE_IMPORTER_ROOT_MOUNT.p, SLIDE_IMPORTER_ROOT_MOUNT.r, SLIDE_IMPORTER_ROOT_MOUNT.c, 'slide_import_media_uri_update']] },
]);

const SLIDE_IMPORTER_MEDIA_URI_CHILD_ROUTE = Object.freeze([
  { from: [0, 0, 0, 'slide_import_media_uri_update'], to: [[0, 2, 0, 'mt_bus_receive_in']] },
]);

const SLIDE_IMPORTER_REQUEST_ROUTE = Object.freeze([
  { from: [SLIDE_IMPORTER_ROOT_MOUNT.p, SLIDE_IMPORTER_ROOT_MOUNT.r, SLIDE_IMPORTER_ROOT_MOUNT.c, 'slide_import_request'], to: [[SLIDE_IMPORTER_SYSTEM_MOUNT.p, SLIDE_IMPORTER_SYSTEM_MOUNT.r, SLIDE_IMPORTER_SYSTEM_MOUNT.c, 'slide_app_import_request']] },
]);

const SLIDE_IMPORTER_CLICK_HANDLER_CODE = "/* rubric: P1 */ const payload = label && label.v;\nconst fail = (code, detail) => V1N.addLabel('slide_import_click_error', 'json', { code, detail, ts: Date.now() });\nif (!Array.isArray(payload)) {\n  fail('invalid_payload', 'temporary_modeltable_required');\n  return;\n}\nconst readPayload = (key, fallback = null) => {\n  const record = payload.find((rec) => rec && rec.id === 0 && rec.p === 0 && rec.r === 0 && rec.c === 0 && rec.k === key);\n  return record && Object.prototype.hasOwnProperty.call(record, 'v') ? record.v : fallback;\n};\nif (readPayload('__mt_payload_kind', '') !== 'ui_event.v1') {\n  fail('invalid_payload_kind', 'ui_event.v1_required');\n  return;\n}\nconst target = readPayload('target', null);\nif (!target || target.model_id !== 1031 || target.p !== 0 || target.r !== 0 || target.c !== 0) {\n  fail('invalid_target', 'slide_importer_truth_cell_required');\n  return;\n}\nconst requestPayload = [\n  { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'slide_app_import_request.v1' },\n  { id: 0, p: 0, r: 0, c: 0, k: 'target', t: 'json', v: target }\n];\nV1N.writeLabel(0, 0, 0, { k: 'slide_import_request', t: 'pin.out', v: requestPayload });";

const SLIDE_IMPORTER_CLICK_HANDLER = Object.freeze({
  code: SLIDE_IMPORTER_CLICK_HANDLER_CODE,
  modelName: 'slide_import_button',
});

function modelTableValueEquals(a, b) {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (_) {
    return false;
  }
}

function ensureRuntimeLabel(runtime, modelId, p, r, c, label, options = {}) {
  const model = runtime.getModel(modelId);
  if (!model) return false;
  const cell = runtime.getCell(model, p, r, c);
  const current = cell.labels.get(label.k) || null;
  const preserveExistingValue = options.preserveExistingValue === true;
  if (preserveExistingValue && current && current.t === label.t) return false;
  if (current && current.t === label.t && modelTableValueEquals(current.v, label.v)) return false;
  if (current) runtime.rmLabel(model, p, r, c, label.k);
  runtime.addLabel(model, p, r, c, label);
  return true;
}

function ensureRuntimeModelTablePinInOrNull(runtime, modelId, p, r, c, key) {
  const model = runtime.getModel(modelId);
  if (!model) return false;
  const cell = runtime.getCell(model, p, r, c);
  const current = cell.labels.get(key) || null;
  if (
    current
    && current.t === 'pin.in'
    && (current.v === null || current.v === undefined || isTemporaryPayloadRecordArray(current.v))
  ) {
    return false;
  }
  if (current) runtime.rmLabel(model, p, r, c, key);
  runtime.addLabel(model, p, r, c, {
    k: key,
    t: 'pin.in',
    v: null,
  });
  return true;
}

function repairSlideImporterClickContract(runtime) {
  let changed = false;
  const model0 = runtime.getModel(0);
  if (model0) {
    changed = ensureRuntimeLabel(runtime, 0, SLIDE_IMPORTER_ROOT_MOUNT.p, SLIDE_IMPORTER_ROOT_MOUNT.r, SLIDE_IMPORTER_ROOT_MOUNT.c, {
      k: 'model_type',
      t: 'model.submt',
      v: 1030,
    }) || changed;
    changed = ensureRuntimeLabel(runtime, 0, SLIDE_IMPORTER_ROOT_MOUNT.p, SLIDE_IMPORTER_ROOT_MOUNT.r, SLIDE_IMPORTER_ROOT_MOUNT.c, {
      k: 'mt_bus_receive_in',
      t: 'pin.in',
      v: null,
    }) || changed;
    changed = ensureRuntimeLabel(runtime, 0, SLIDE_IMPORTER_ROOT_MOUNT.p, SLIDE_IMPORTER_ROOT_MOUNT.r, SLIDE_IMPORTER_ROOT_MOUNT.c, {
      k: 'slide_import_media_uri_update',
      t: 'pin.in',
      v: null,
    }) || changed;
    changed = ensureRuntimeLabel(runtime, 0, SLIDE_IMPORTER_ROOT_MOUNT.p, SLIDE_IMPORTER_ROOT_MOUNT.r, SLIDE_IMPORTER_ROOT_MOUNT.c, {
      k: 'slide_import_request',
      t: 'pin.out',
      v: null,
    }) || changed;
    changed = ensureRuntimeLabel(runtime, 0, SLIDE_IMPORTER_SYSTEM_MOUNT.p, SLIDE_IMPORTER_SYSTEM_MOUNT.r, SLIDE_IMPORTER_SYSTEM_MOUNT.c, {
      k: 'model_type',
      t: 'model.submt',
      v: -10,
    }) || changed;
    changed = ensureRuntimeLabel(runtime, 0, SLIDE_IMPORTER_SYSTEM_MOUNT.p, SLIDE_IMPORTER_SYSTEM_MOUNT.r, SLIDE_IMPORTER_SYSTEM_MOUNT.c, {
      k: 'slide_app_import_request',
      t: 'pin.in',
      v: null,
    }) || changed;
  }
  changed = ensureRuntimeLabel(runtime, 1030, 0, 0, 0, {
    k: 'bucket_c_cell_routes',
    t: 'pin.connect.cell',
    v: SLIDE_IMPORTER_BUCKET_C_ROUTES,
  }) || changed;
  changed = ensureRuntimeLabel(runtime, 1030, 0, 0, 0, {
    k: 'slide_import_media_uri_update',
    t: 'pin.in',
    v: null,
  }) || changed;
  changed = ensureRuntimeLabel(runtime, 1030, 0, 2, 0, {
    k: 'mt_bus_receive_in',
    t: 'pin.in',
    v: null,
  }) || changed;
  changed = ensureRuntimeLabel(runtime, 1030, 0, 0, 0, {
    k: 'slide_import_media_uri_update_route',
    t: 'pin.connect.cell',
    v: SLIDE_IMPORTER_MEDIA_URI_CHILD_ROUTE,
  }) || changed;
  changed = ensureRuntimeLabel(runtime, 1030, 0, 0, 0, {
    k: 'slide_import_request',
    t: 'pin.out',
    v: null,
  }, { preserveExistingValue: true }) || changed;
  changed = ensureRuntimeLabel(runtime, 0, 0, 0, 0, {
    k: 'slide_import_click_route',
    t: 'pin.connect.cell',
    v: SLIDE_IMPORTER_CLICK_INGRESS_ROUTE,
  }) || changed;
  changed = ensureRuntimeLabel(runtime, 0, 0, 0, 0, {
    k: 'slide_import_media_uri_update_route',
    t: 'pin.connect.cell',
    v: SLIDE_IMPORTER_MEDIA_URI_UPDATE_ROUTE,
  }) || changed;
  changed = ensureRuntimeLabel(runtime, 0, 0, 0, 0, {
    k: 'slide_import_request_route',
    t: 'pin.connect.cell',
    v: SLIDE_IMPORTER_REQUEST_ROUTE,
  }) || changed;
  changed = ensureRuntimeLabel(runtime, 1030, 2, 3, 0, {
    k: 'ui_bind_json',
    t: 'json',
    v: SLIDE_IMPORTER_MEDIA_URI_BIND,
  }) || changed;
  changed = ensureRuntimeLabel(runtime, 1030, 2, 4, 0, {
    k: 'ui_bind_json',
    t: 'json',
    v: SLIDE_IMPORTER_CLICK_BIND,
  }) || changed;
  changed = ensureRuntimeLabel(runtime, 1030, 2, 4, 0, {
    k: 'scope_privileged',
    t: 'bool',
    v: true,
  }) || changed;
  changed = ensureRuntimeModelTablePinInOrNull(runtime, 1030, 2, 4, 0, 'click') || changed;
  changed = ensureRuntimeLabel(runtime, 1030, 2, 4, 0, {
    k: 'click_route',
    t: 'pin.connect.label',
    v: SLIDE_IMPORTER_CLICK_ROUTE,
  }) || changed;
  changed = ensureRuntimeLabel(runtime, 1030, 2, 4, 0, {
    k: 'handle_slide_import_click',
    t: 'func.js',
    v: SLIDE_IMPORTER_CLICK_HANDLER,
  }) || changed;
  return changed;
}

function isTemporaryPayloadRecordArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isTemporaryModelTableRecord);
}

function isRetiredSlideImporterDirectPin(target, pin) {
  return Boolean(
    target
    && target.model_id === 1030
    && target.p === 2
    && target.r === 4
    && target.c === 0
    && pin === 'click'
  );
}

function isRetiredSlideImporterOwnerLabelMutation(action, target) {
  return Boolean(
    (action === 'ui_owner_label_update' || action === 'ui_owner_label_remove')
    && target
    && target.model_id === 1031
    && target.p === 0
    && target.r === 0
    && target.c === 0
    && target.k === 'slide_import_media_uri'
  );
}

function isCellCoord(value) {
  return value
    && typeof value === 'object'
    && Number.isInteger(value.p)
    && Number.isInteger(value.r)
    && Number.isInteger(value.c);
}

function temporaryPayloadLabel(payload, key) {
  return Array.isArray(payload)
    ? payload.find((record) => record && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key) || null
    : null;
}

function isMalformedPinPayloadKind(kind) {
  if (!kind) return false;
  if (kind.t !== 'str' || typeof kind.v !== 'string') return true;
  const normalized = kind.v.trim();
  return normalized.startsWith('pin_payload.') && (kind.v !== normalized || normalized !== 'pin_payload.v1');
}

function isValidBusPayloadArray(value) {
  if (!isTemporaryPayloadRecordArray(value)) return false;
  for (const record of value) {
    if (!record || typeof record.k !== 'string') return false;
    if (isLegacyPinPayloadKey(record.k)) return false;
    if (containsLegacyPinPayloadMetadata(record.v)) return false;
  }
  const kind = temporaryPayloadLabel(value, '__mt_payload_kind');
  if (kind && (kind.t !== 'str' || typeof kind.v !== 'string')) return false;
  if (isMalformedPinPayloadKind(kind)) return false;
  if (kind && kind.t === 'str' && kind.v === 'pin_payload.v1') {
    const parsed = parsePinPayloadRecordEnvelope({ version: 'v1', type: 'pin_payload', payload: value });
    return parsed.ok === true;
  }
  if (kind && kind.t === 'str' && kind.v === 'write_label.v1') {
    const targetCell = temporaryPayloadLabel(value, '__mt_target_cell');
    if (!targetCell || targetCell.t !== 'json' || !isCellCoord(targetCell.v)) return false;
  }
  return true;
}

function isLegacyWriteEnvelope(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && value.op === 'write'
    && Array.isArray(value.records);
}

function normalizeDirectPinValue(rawValue, meta, target, pin) {
  let nextValue = rawValue;
  if (target && target.model_id === 0) {
    if (Array.isArray(nextValue)) {
      if (!isValidBusPayloadArray(nextValue)) {
        return { ok: false, code: 'invalid_bus_payload', detail: 'temporary_modeltable_required' };
      }
      return { ok: true, value: nextValue };
    }
    if (nextValue && typeof nextValue === 'object' && !Array.isArray(nextValue) && nextValue.version === 'v1' && nextValue.type === 'pin_payload') {
      return { ok: false, code: 'invalid_bus_payload', detail: 'external_pin_payload_wrapper_removed' };
    }
    if (isLegacyWriteEnvelope(nextValue)) {
      return { ok: false, code: 'invalid_bus_payload', detail: 'legacy_write_envelope' };
    }
    return { ok: false, code: 'invalid_bus_payload', detail: 'temporary_modeltable_required' };
  }
  if (target && target.model_id > 0) {
    if (Array.isArray(nextValue) && isValidBusPayloadArray(nextValue)) {
      return { ok: true, value: nextValue };
    }
    return { ok: false, code: 'invalid_pin_payload', detail: 'temporary_modeltable_required' };
  }
  if (target && target.model_id < 0) {
    if (nextValue === null || nextValue === undefined) return { ok: true, value: null };
    if (nextValue && typeof nextValue === 'object' && !Array.isArray(nextValue)
        && typeof nextValue.t === 'string' && Object.prototype.hasOwnProperty.call(nextValue, 'v')) {
      nextValue = nextValue.v;
    }
    if (Array.isArray(nextValue) && isValidBusPayloadArray(nextValue)) {
      return { ok: true, value: nextValue };
    }
    return { ok: false, code: 'invalid_pin_payload', detail: 'temporary_modeltable_required' };
  }
  if (nextValue && typeof nextValue === 'object' && !Array.isArray(nextValue)
      && typeof nextValue.t === 'string' && Object.prototype.hasOwnProperty.call(nextValue, 'v')) {
    nextValue = nextValue.v;
  }
  if (nextValue && typeof nextValue === 'object' && !Array.isArray(nextValue)) {
    const out = { ...nextValue };
    if (meta && !out.meta) out.meta = meta;
    if (target && !out.target) out.target = target;
    if (pin && !out.pin) out.pin = pin;
    return { ok: true, value: out };
  }
  return { ok: true, value: nextValue };
}

const RETIRED_SLIDE_ACTIONS = new Set([
  'slide_app_import',
  'slide_app_create',
  'ws_app_add',
  'ws_app_delete',
  'ws_select_app',
  'ws_app_select',
]);

function isRetiredSlideAction(action, targetModelId) {
  if (typeof action !== 'string' || !action.trim()) return false;
  if (action === 'submit') return targetModelId === 100;
  return RETIRED_SLIDE_ACTIONS.has(action);
}

class ProgramModelEngine {
  constructor(runtime) {
    this.runtime = runtime;
    this.functions = new Map();
    this.interceptCursor = 0;
    this.eventCursor = 0;
    this.matrixAdapter = null;
    this.matrixAdapterUnsub = null;
    this.matrixRoomId = null;
    this.matrixDmPeerUserId = null;
    this.matrixUserLoginImpl = null;
    this.controlBusClient = null;
    this.controlBusSubscription = '';
    this.controlBusReady = false;
    this.disableControlBusInbound = false;
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
    this.bridgedBusOutPorts = new Map();
    this.pendingBusOutPorts = new Map();
    this.failedBusOutPorts = new Map();
    this.outboundMatrixOps = [];
    this.ignoredMatrixReturnOpIds = new Set();
    this.matrixSuiteMatrixImpl = null;
    this.matrixSuiteSession = null;
    this.currentRequestMatrixSession = null;
    this.currentRequestMatrixSessionProvided = false;
    this.pendingMatrixHostActions = new Set();
    this.matrixSuiteHandledRequests = new Set();
    this.matrixChatHandledRequests = new Set();
    this.matrixAdapterInitPromise = null;
  }

  refreshMatrixBootstrapConfig() {
    const matrixConfig = readMatrixBootstrapConfig(this.runtime);
    this.matrixRoomId = firstValidValue(matrixConfig.roomId);
    this.matrixDmPeerUserId = firstValidValue(matrixConfig.peerUserId);
    return matrixConfig;
  }

  async ensureMatrixAdapter() {
    if (typeof this.runtime.isRunLoopActive === 'function' && !this.runtime.isRunLoopActive()) {
      return;
    }
    if (this.matrixAdapter) return;
    const matrixConfig = this.refreshMatrixBootstrapConfig();
    if (!this.matrixRoomId) {
      console.log('[ProgramModelEngine] No matrix_room_id configured on Model 0, running without Matrix.');
      return;
    }
    if (isPlaceholderValue(this.matrixDmPeerUserId)) {
      console.warn('[ProgramModelEngine] matrix_contuser is placeholder, Matrix messages may be skipped.');
    }
    try {
      const syncTimeoutMs = readIntEnv('DY_MATRIX_SYNC_TIMEOUT_MS', 20000, 1000);
      this.matrixAdapter = await createMatrixLiveAdapter({
        roomId: this.matrixRoomId,
        peerUserId: this.matrixDmPeerUserId || undefined,
        syncTimeoutMs,
        homeserverUrl: matrixConfig.homeserverUrl || undefined,
        accessToken: matrixConfig.accessToken || undefined,
        userId: matrixConfig.userId || undefined,
        password: matrixConfig.password || undefined,
      });
      if (this.matrixAdapterUnsub) {
        this.matrixAdapterUnsub();
        this.matrixAdapterUnsub = null;
      }
      this.matrixAdapterUnsub = this.matrixAdapter.subscribe((content) => {
        try {
          this.handleDyBusEvent(content);
        } catch (err) {
          console.warn('[ProgramModelEngine] handleDyBusEvent failed:', err && err.message ? err.message : err);
        }
      });
      console.log('[ProgramModelEngine] Matrix adapter connected, room:', this.matrixRoomId);
    } catch (err) {
      console.warn('[ProgramModelEngine] Matrix init failed (non-fatal):', err.message || err);
      console.warn('[ProgramModelEngine] Program engine will run without Matrix. UI events won\'t reach MBR/MQTT.');
      this.matrixAdapter = null;
    }
  }

  startMatrixAdapterInit() {
    if (this.matrixAdapter) return Promise.resolve(this.matrixAdapter);
    if (this.matrixAdapterInitPromise) return this.matrixAdapterInitPromise;
    this.matrixAdapterInitPromise = this.ensureMatrixAdapter()
      .catch((err) => {
        console.warn('[ProgramModelEngine] Matrix background init failed:', err && err.message ? err.message : err);
      })
      .finally(() => {
        this.matrixAdapterInitPromise = null;
      });
    return this.matrixAdapterInitPromise;
  }

  matrixSuiteReadRoot(key, fallback = null) {
    const model = this.runtime.getModel(MATRIX_SUITE_APP_MODEL_ID);
    if (!model) return fallback;
    const value = this.runtime.getLabelValue(model, 0, 0, 0, key);
    return value === undefined || value === null ? fallback : value;
  }

  matrixSuiteWriteRoot(key, type, value) {
    const model = this.runtime.getModel(MATRIX_SUITE_APP_MODEL_ID);
    if (!model) return;
    this.runtime.addLabel(model, 0, 0, 0, { k: key, t: type, v: value });
  }

  matrixSuiteRooms() {
    const rooms = this.matrixSuiteReadRoot('rooms_json', []);
    return Array.isArray(rooms) ? rooms : [];
  }

  matrixSuiteTimeline() {
    const events = this.matrixSuiteReadRoot('timeline_json', []);
    return Array.isArray(events) ? events : [];
  }

  matrixSuiteFindRoom(roomId, rooms = this.matrixSuiteRooms()) {
    return rooms.find((room) => room && room.id === roomId && room.archived !== true) || null;
  }

  matrixSuiteNow() {
    return new Date().toISOString().slice(11, 16);
  }

  matrixSuiteRenderRooms(rooms, selectedId) {
    return rooms
      .filter((room) => room && room.archived !== true)
      .map((room) => {
        const marker = room.id === selectedId ? '> ' : '  ';
        const name = String(room.name || room.alias || '').trim() || 'Unnamed room';
        const unread = Number(room.unread || 0);
        const visible = `${marker}${name}${unread > 0 ? ` · unread=${unread}` : ''}`;
        const hover = `room id: ${room.id || ''}`;
        return `${visible}\x01${hover}`;
      })
      .join('\n');
  }

  matrixSuiteRenderTimeline(events, selectedId, roomName) {
    const rows = events.filter((event) => event && event.room_id === selectedId);
    if (rows.length === 0) return `### ${roomName}\n\nNo events yet.`;
    const body = rows.map((event) => {
      const suffix = event.edited ? ' _(edited)_' : '';
      const type = event.msgtype || event.type || 'event';
      const eventId = event.event_id ? `\n  event: ${event.event_id}` : '';
      const editEventId = event.edit_event_id ? `\n  edit_event: ${event.edit_event_id}` : '';
      return `- **${event.sender || 'system'}** · ${event.ts || this.matrixSuiteNow()} · ${type}\n  ${event.body || ''}${suffix}${eventId}${editEventId}`;
    }).join('\n');
    return `### ${roomName}\n\n${body}`;
  }

  matrixSuiteSyncProjection(rooms, events, selectedId) {
    const current = this.matrixSuiteFindRoom(selectedId, rooms)
      || rooms.find((room) => room && room.archived !== true)
      || { id: selectedId, name: 'No room', members: [] };
    this.matrixSuiteWriteRoot('active_room_id', 'str', current.id || selectedId);
    this.matrixSuiteWriteRoot('active_room_name', 'str', current.name || 'No room');
    this.matrixSuiteWriteRoot('active_room_summary', 'str', `${current.kind === 'dm' ? '1v1' : 'Room'} · ${((current.members || []).length)} member(s)`);
    this.matrixSuiteWriteRoot('rooms_text', 'str', this.matrixSuiteRenderRooms(rooms, current.id || selectedId));
    this.matrixSuiteWriteRoot('timeline_markdown', 'str', this.matrixSuiteRenderTimeline(events, current.id || selectedId, current.name || 'No room'));
    this.matrixSuiteWriteRoot('room_inspector_markdown', 'str', `## ${current.name || 'No room'}\n\n- id: ${current.id || selectedId}\n- kind: ${current.kind || 'unknown'}\n- members: ${((current.members || []).join(', ') || 'none')}\n- unread: ${Number(current.unread || 0)}`);
  }

  matrixChatReadRoot(key, fallback = null) {
    const model = this.runtime.getModel(MATRIX_CHAT_APP_MODEL_ID);
    if (!model) return fallback;
    const value = this.runtime.getLabelValue(model, 0, 0, 0, key);
    return value === undefined || value === null ? fallback : value;
  }

  matrixChatWriteRoot(key, type, value) {
    const model = this.runtime.getModel(MATRIX_CHAT_APP_MODEL_ID);
    if (!model) return;
    this.runtime.addLabel(model, 0, 0, 0, { k: key, t: type, v: value });
  }

  matrixChatRooms() {
    const rooms = this.matrixChatReadRoot('rooms_json', []);
    return Array.isArray(rooms) ? rooms : [];
  }

  matrixChatTimeline() {
    const events = this.matrixChatReadRoot('timeline_json', []);
    return Array.isArray(events) ? events : [];
  }

  matrixChatFindRoom(roomId, rooms = this.matrixChatRooms()) {
    return rooms.find((room) => room && room.id === roomId && room.archived !== true) || null;
  }

  matrixChatSyncProjection(rooms, events, selectedId) {
    void events;
    const activeRooms = Array.isArray(rooms) ? rooms.filter((room) => room && room.archived !== true) : [];
    const current = this.matrixChatFindRoom(selectedId, activeRooms)
      || rooms.find((room) => room && room.archived !== true)
      || null;
    if (!current) {
      this.matrixChatWriteRoot('active_room_id', 'str', '');
      this.matrixChatWriteRoot('target_room_id', 'str', '');
      this.matrixChatWriteRoot('active_room_name', 'str', 'No room');
      this.matrixChatWriteRoot('active_room_summary', 'str', 'No active Matrix rooms');
      this.matrixChatWriteRoot('room_detail_markdown', 'str', '## No active room\n\nRefresh rooms or create a new conversation.');
      this.matrixChatWriteRoot('active_can_invite_members', 'bool', false);
      this.matrixChatWriteRoot('active_can_remove_members', 'bool', false);
      this.matrixChatWriteRoot('active_can_leave_room', 'bool', false);
      this.matrixChatWriteRoot('active_can_leave_people', 'bool', false);
      this.matrixChatWriteRoot('active_can_accept_invite', 'bool', false);
      this.matrixChatWriteRoot('active_can_send_messages', 'bool', false);
      this.matrixChatWriteRoot('active_invite_notice_markdown', 'str', '');
      return;
    }
    const memberObjects = Array.isArray(current.member_objects) ? current.member_objects : [];
    const members = memberObjects.length > 0
      ? memberObjects.map((member) => member.label || member.user_id).filter(Boolean)
      : (Array.isArray(current.members) ? current.members : []);
    const memberCount = Number.isFinite(Number(current.member_count)) ? Number(current.member_count) : members.length;
    const roomErrors = [
      current.member_status === 'error' && current.member_error ? `members: ${current.member_error.code || 'error'} ${current.member_error.detail || ''}` : '',
      current.history_status === 'error' && current.history_error ? `history: ${current.history_error.code || 'error'} ${current.history_error.detail || ''}` : '',
      current.power_status === 'error' && current.power_error ? `permissions: ${current.power_error.code || 'error'} ${current.power_error.detail || ''}` : '',
    ].filter(Boolean);
    const permissions = [
      `invite=${current.can_invite === true ? 'yes' : 'no'}`,
      `remove=${current.can_kick === true ? 'yes' : 'no'}`,
      `leave=${current.can_leave !== false ? 'yes' : 'no'}`,
    ].join(', ');
    const conversationGroup = matrixRoomConversationGroup(current.kind);
    const isPeople = conversationGroup === 'people';
    const isInvite = conversationGroup === 'invites';
    const isRoom = conversationGroup === 'rooms';
    const peerLabel = current.dm_user_id ? (current.dm_display_name || current.dm_user_id) : '';
    const displayName = String(current.list_title || (isPeople ? (peerLabel || current.name) : current.name) || 'No room');
    const summaryKind = matrixRoomKindLabel(current.kind, peerLabel);
    this.matrixChatWriteRoot('active_can_invite_members', 'bool', isRoom && current.can_invite === true);
    this.matrixChatWriteRoot('active_can_remove_members', 'bool', isRoom && current.can_kick === true);
    this.matrixChatWriteRoot('active_can_leave_room', 'bool', isRoom && current.can_leave !== false);
    this.matrixChatWriteRoot('active_can_leave_people', 'bool', isPeople && current.can_leave !== false);
    this.matrixChatWriteRoot('active_can_accept_invite', 'bool', isInvite && current.can_join !== false);
    this.matrixChatWriteRoot('active_can_send_messages', 'bool', !isInvite);
    this.matrixChatWriteRoot('active_invite_notice_markdown', 'str', isInvite
      ? `### Invitation pending\n\n${current.invited_by ? `Invited by **${current.invited_by}**. ` : ''}Accept to join **${displayName}**, or decline to remove this invitation.`
      : '');
    this.matrixChatWriteRoot('active_room_id', 'str', current.id || selectedId);
    this.matrixChatWriteRoot('target_room_id', 'str', current.id || selectedId);
    this.matrixChatWriteRoot('active_room_name', 'str', displayName);
    this.matrixChatWriteRoot('active_room_summary', 'str', `${summaryKind} · ${memberCount} member(s) · ${permissions}`);
    this.matrixChatWriteRoot('room_detail_markdown', 'str', `## ${displayName}\n\n- room name: ${current.name || 'none'}\n- id: ${current.id || selectedId}\n- kind: ${current.kind || 'unknown'}\n- alias: ${current.alias || 'none'}\n- topic: ${current.topic || 'none'}\n- members: ${members.join(', ') || 'none'}\n- member status: ${current.member_status || 'unknown'}\n- history status: ${current.history_status || 'unknown'}\n- permission status: ${current.power_status || 'unknown'}\n- permissions: ${permissions}\n- unread: ${Number(current.unread || 0)}${roomErrors.length > 0 ? `\n\n### Room API warnings\n\n${roomErrors.map((item) => `- ${item}`).join('\n')}` : ''}`);
  }

  matrixSuiteSessionFromRuntime(explicitSession = undefined) {
    if (explicitSession !== undefined) {
      if (!explicitSession || !explicitSession.accessToken || !explicitSession.homeserverUrl) return null;
      return {
        homeserverUrl: explicitSession.homeserverUrl,
        accessToken: explicitSession.accessToken,
        userId: explicitSession.userId || '',
        displayName: explicitSession.displayName || explicitSession.userId || '',
      };
    }
    if (this.matrixSuiteSession && this.matrixSuiteSession.accessToken && this.matrixSuiteSession.homeserverUrl) {
      return this.matrixSuiteSession;
    }
    const matrixConfig = readMatrixBootstrapConfig(this.runtime);
    const homeserverUrl = firstValidValue(matrixConfig.homeserverUrl, process.env.MATRIX_HOMESERVER_URL);
    const accessToken = firstValidValue(matrixConfig.accessToken, process.env.MATRIX_MBR_BOT_ACCESS_TOKEN, process.env.MATRIX_MBR_ACCESS_TOKEN);
    const userId = firstValidValue(matrixConfig.userId, process.env.MATRIX_MBR_BOT_USER, process.env.MATRIX_MBR_USER);
    if (!homeserverUrl || !accessToken) return null;
    return { homeserverUrl, accessToken, userId, displayName: userId };
  }

  async matrixSuiteDefaultCall(action, input, explicitSession = undefined) {
    if (action === 'login') {
      const result = await matrixSuiteLoginWithPassword(input || {});
      if (result && result.ok) {
        this.matrixSuiteSession = {
          homeserverUrl: result.homeserverUrl,
          accessToken: result.accessToken,
          userId: result.userId,
          displayName: result.displayName || result.userId,
        };
      }
      return result;
    }
    const session = this.matrixSuiteSessionFromRuntime(explicitSession);
    if (action === 'sendMessage') {
      return matrixSuiteSendRoomEvent(session, input && input.roomId, 'm.room.message', {
        msgtype: 'm.text',
        body: String(input && input.body ? input.body : ''),
      });
    }
    if (action === 'editMessage') {
      const body = String(input && input.body ? input.body : '');
      return matrixSuiteSendRoomEvent(session, input && input.roomId, 'm.room.message', {
        msgtype: 'm.text',
        body: `* ${body}`,
        'm.new_content': { msgtype: 'm.text', body },
        'm.relates_to': { rel_type: 'm.replace', event_id: String(input && input.eventId ? input.eventId : '') },
      });
    }
    if (action === 'createRoom') {
      return matrixSuiteCreateRoomWithSession(session, input || {});
    }
    if (action === 'refreshRooms') {
      return matrixSuiteRefreshRoomsWithSession(session);
    }
    if (action === 'inviteMember') {
      return matrixSuiteInviteMemberWithSession(session, input || {});
    }
    if (action === 'removeMember') {
      return matrixSuiteRemoveMemberWithSession(session, input || {});
    }
    if (action === 'leaveRoom') {
      return matrixSuiteLeaveRoomWithSession(session, input || {});
    }
    if (action === 'joinRoom') {
      return matrixSuiteJoinRoomWithSession(session, input || {});
    }
    if (action === 'shareFile') {
      const fileMessage = matrixShareFileMessage(input || {});
      return matrixSuiteSendRoomEvent(session, input && input.roomId, 'm.room.message', fileMessage.content);
    }
    return { ok: false, code: 'unsupported_action', detail: action || 'missing' };
  }

  async runMatrixSuiteHostAction(request, explicitSession = undefined) {
    const req = request && typeof request === 'object' ? request : {};
    const requestId = String(req.request_id || req.requestId || '').trim() || matrixSuiteTxnId('matrix_suite_req');
    if (this.matrixSuiteHandledRequests.has(requestId)) return;
    this.matrixSuiteHandledRequests.add(requestId);
    const action = String(req.action || '').trim();
    const payload = req.payload && typeof req.payload === 'object' ? req.payload : {};
    const impl = this.matrixSuiteMatrixImpl || {};
    const session = this.matrixSuiteSessionFromRuntime(explicitSession);
    const call = async (method, input) => (typeof impl[method] === 'function'
      ? impl[method](input, { session })
      : this.matrixSuiteDefaultCall(method, input, session));
    const rooms = this.matrixSuiteRooms();
    let events = this.matrixSuiteTimeline();
    let selectedId = String(this.matrixSuiteReadRoot('active_room_id', '!digital-sovereignty:ui.local') || '!digital-sovereignty:ui.local');
    const currentRoom = this.matrixSuiteFindRoom(selectedId, rooms);
    const fail = (code, detail) => {
      this.matrixSuiteWriteRoot('connection_status', 'str', 'error');
      this.matrixSuiteWriteRoot('status_text', 'str', `ERR ${code}: ${detail}`);
      this.matrixSuiteWriteRoot('last_error_json', 'json', { code, detail, request_id: requestId, ts: Date.now() });
    };
    try {
      if (action === 'login') {
        const result = await call('login', {
          homeserverUrl: String(payload.homeserver || payload.homeserverUrl || ''),
          userId: String(payload.user_id || payload.userId || ''),
          password: String(payload.password || ''),
        });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'login_failed', result && result.detail ? result.detail : 'login_failed');
          this.matrixSuiteWriteRoot('session_status', 'str', 'login_failed');
          this.matrixSuiteWriteRoot('login_password_draft', 'str', '');
          return;
        }
        if (result.accessToken && result.homeserverUrl) {
          this.matrixSuiteSession = {
            homeserverUrl: result.homeserverUrl,
            accessToken: result.accessToken,
            userId: result.userId || payload.user_id || '',
            displayName: result.displayName || result.userId || payload.user_id || '',
          };
        }
        this.matrixSuiteWriteRoot('session_status', 'str', 'authenticated');
        this.matrixSuiteWriteRoot('session_user_id', 'str', result.userId || payload.user_id || '');
        this.matrixSuiteWriteRoot('session_display_name', 'str', result.displayName || result.userId || payload.user_id || '');
        this.matrixSuiteWriteRoot('settings_homeserver', 'str', result.homeserverUrl || payload.homeserver || '');
        this.matrixSuiteWriteRoot('settings_status', 'str', `logged in as ${result.userId || payload.user_id || ''}`);
        this.matrixSuiteWriteRoot('login_password_draft', 'str', '');
        this.matrixSuiteWriteRoot('connection_status', 'str', 'online');
        this.matrixSuiteWriteRoot('status_text', 'str', 'Matrix login succeeded');
        return;
      }

      if (action === 'send_message') {
        const body = String(payload.body || '').trim();
        if (!currentRoom || !body) {
          fail('invalid_send_request', !currentRoom ? selectedId : 'empty_body');
          return;
        }
        const result = await call('sendMessage', { roomId: selectedId, body });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_send_failed', result && result.detail ? result.detail : 'matrix_send_failed');
          return;
        }
        events = events.concat({
          event_id: result.eventId || `$matrix_suite_${Date.now()}`,
          room_id: selectedId,
          sender: 'You',
          type: 'm.room.message',
          msgtype: 'm.text',
          body,
          ts: result.ts || this.matrixSuiteNow(),
          edited: false,
        });
        this.matrixSuiteWriteRoot('timeline_json', 'json', events);
        this.matrixSuiteWriteRoot('last_editable_event_id', 'str', result.eventId || '');
        this.matrixSuiteWriteRoot('edit_draft', 'str', body);
        this.matrixSuiteWriteRoot('composer_draft', 'str', '');
        this.matrixSuiteWriteRoot('status_text', 'str', `Sent via Matrix: ${result.eventId || 'ok'}`);
        this.matrixSuiteWriteRoot('connection_status', 'str', 'online');
        this.matrixSuiteSyncProjection(rooms, events, selectedId);
        return;
      }

      if (action === 'edit_message') {
        const eventId = String(payload.event_id || '').trim();
        const body = String(payload.body || '').trim();
        if (!eventId || !body || !currentRoom) {
          fail('invalid_edit_request', !eventId ? 'missing_event_id' : (!body ? 'empty_body' : selectedId));
          return;
        }
        const result = await call('editMessage', { roomId: selectedId, eventId, body });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_edit_failed', result && result.detail ? result.detail : 'matrix_edit_failed');
          return;
        }
        let edited = false;
        events = events.map((event) => event && event.event_id === eventId
          ? (edited = true, { ...event, body, edited: true, edited_at: result.ts || this.matrixSuiteNow(), edit_event_id: result.eventId || '' })
          : event);
        if (!edited) {
          events = events.concat({
            event_id: result.eventId || `$matrix_suite_edit_${Date.now()}`,
            room_id: selectedId,
            sender: 'You',
            type: 'm.room.message',
            msgtype: 'm.text',
            body,
            ts: result.ts || this.matrixSuiteNow(),
            edited: true,
          });
        }
        this.matrixSuiteWriteRoot('timeline_json', 'json', events);
        this.matrixSuiteWriteRoot('status_text', 'str', `Edited via Matrix: ${result.eventId || 'ok'}`);
        this.matrixSuiteWriteRoot('connection_status', 'str', 'online');
        this.matrixSuiteSyncProjection(rooms, events, selectedId);
        return;
      }

      if (action === 'create_channel') {
        const name = String(payload.name || '').trim();
        const kind = String(payload.kind || 'room') === 'dm' ? 'dm' : 'room';
        const result = await call('createRoom', { name, kind, inviteUserId: String(payload.invite_user_id || '') });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_create_room_failed', result && result.detail ? result.detail : 'matrix_create_room_failed');
          return;
        }
        const roomId = result.roomId || `!matrix-suite-${Date.now()}:local`;
        const nextRoom = {
          id: roomId,
          kind: result.kind || kind,
          name: result.name || name || roomId,
          list_title: kind === 'dm' ? (result.name || name || roomId) : (result.name || name || roomId),
          list_subtitle: '',
          avatar: (result.name || name || roomId).slice(0, 2).toUpperCase(),
          unread: 0,
          members: kind === 'dm' ? [result.name || name || roomId] : ['You'],
          archived: false,
        };
        const nextRooms = rooms.concat(nextRoom);
        this.matrixSuiteWriteRoot('rooms_json', 'json', nextRooms);
        this.matrixSuiteWriteRoot('new_channel_name', 'str', '');
        this.matrixSuiteWriteRoot('status_text', 'str', `Created Matrix ${kind}: ${nextRoom.name}`);
        this.matrixSuiteWriteRoot('connection_status', 'str', 'online');
        selectedId = roomId;
        this.matrixSuiteSyncProjection(nextRooms, events, selectedId);
        return;
      }

      if (action === 'refresh_rooms') {
        const result = await call('refreshRooms', {});
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_rooms_refresh_failed', result && result.detail ? result.detail : 'matrix_rooms_refresh_failed');
          return;
        }
        const nextRooms = matrixDedupeJoinedInviteRooms((Array.isArray(result.rooms) ? result.rooms : [])
          .map((room, index) => matrixProjectedRoom(room, index))
          .filter(Boolean));
        const refreshedEvents = mergeMatrixTimeline(events, matrixProjectedTimeline(result));
        if (nextRooms.length === 0) {
          this.matrixSuiteWriteRoot('rooms_json', 'json', []);
          this.matrixSuiteWriteRoot('rooms_text', 'str', 'No joined Matrix rooms visible for this session.');
          this.matrixSuiteWriteRoot('status_text', 'str', 'Matrix rooms refreshed: 0');
          this.matrixSuiteWriteRoot('connection_status', 'str', 'warning');
          return;
        }
        const requested = String(this.matrixSuiteReadRoot('target_room_id', '') || '').trim();
        const active = nextRooms.find((room) => room.id === selectedId)
          || nextRooms.find((room) => room.id === requested)
          || nextRooms[0];
        selectedId = active.id;
        this.matrixSuiteWriteRoot('rooms_json', 'json', nextRooms);
        this.matrixSuiteWriteRoot('timeline_json', 'json', refreshedEvents);
        this.matrixSuiteWriteRoot('target_room_id', 'str', selectedId);
        this.matrixSuiteWriteRoot('status_text', 'str', `Matrix rooms refreshed: ${nextRooms.length}`);
        this.matrixSuiteWriteRoot('connection_status', 'str', 'online');
        this.matrixSuiteSyncProjection(nextRooms, refreshedEvents, selectedId);
        return;
      }

      if (action === 'share_file') {
        const mediaUri = String(payload.media_uri || '').trim();
        const fileName = String(payload.file_name || 'uploaded-file').trim() || 'uploaded-file';
        const mimeType = String(payload.mime_type || payload.mimeType || '').trim();
        const fileMessage = matrixShareFileMessage({ mediaUri, fileName, mimeType });
        const cardKind = fileMessage.cardKind;
        if (!mediaUri || !currentRoom) {
          fail('invalid_file_request', !mediaUri ? 'missing_media_uri' : selectedId);
          return;
        }
        const result = await call('shareFile', { roomId: selectedId, mediaUri, fileName: fileMessage.fileName, mimeType: fileMessage.mimeType });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_file_send_failed', result && result.detail ? result.detail : 'matrix_file_send_failed');
          return;
        }
        events = events.concat({
          event_id: result.eventId || `$matrix_suite_file_${Date.now()}`,
          room_id: selectedId,
          sender: 'You',
          type: 'm.room.message',
          msgtype: fileMessage.content.msgtype,
          body: fileMessage.fileName,
          card_kind: cardKind,
          media_uri: mediaUri,
          file_name: fileMessage.fileName,
          mime_type: fileMessage.mimeType,
          size: fileMessage.size,
          download_url: matrixMediaDownloadUrl(mediaUri, fileMessage.fileName),
          thumbnail_url: cardKind === 'image' ? matrixMediaThumbnailUrl(mediaUri, fileMessage.fileName) : '',
          ts: result.ts || this.matrixSuiteNow(),
          edited: false,
        });
        this.matrixSuiteWriteRoot('timeline_json', 'json', events);
        this.matrixSuiteWriteRoot('file_share_status', 'str', `shared via Matrix: ${result.eventId || 'ok'}`);
        this.matrixSuiteWriteRoot('pending_file_uri', 'str', '');
        this.matrixSuiteWriteRoot('pending_file_name', 'str', '');
        this.matrixSuiteWriteRoot('status_text', 'str', `File shared via Matrix: ${result.eventId || 'ok'}`);
        this.matrixSuiteWriteRoot('connection_status', 'str', 'online');
        this.matrixSuiteSyncProjection(rooms, events, selectedId);
        return;
      }

      fail('unsupported_matrix_suite_action', action || 'missing');
    } catch (err) {
      fail('matrix_suite_host_exception', err && err.message ? err.message : String(err));
    }
  }

  async runMatrixChatHostAction(request, explicitSession = undefined) {
    const req = request && typeof request === 'object' ? request : {};
    const requestId = String(req.request_id || req.requestId || '').trim() || matrixSuiteTxnId('matrix_chat_req');
    if (this.matrixChatHandledRequests.has(requestId)) return;
    this.matrixChatHandledRequests.add(requestId);
    const action = String(req.action || '').trim();
    const payload = req.payload && typeof req.payload === 'object' ? req.payload : {};
    const impl = this.matrixSuiteMatrixImpl || {};
    const session = this.matrixSuiteSessionFromRuntime(explicitSession);
    const call = async (method, input) => (typeof impl[method] === 'function'
      ? impl[method](input, { session })
      : this.matrixSuiteDefaultCall(method, input, session));
    const rooms = this.matrixChatRooms();
    let events = this.matrixChatTimeline();
    let selectedId = String(this.matrixChatReadRoot('active_room_id', '!digital-sovereignty:ui.local') || '!digital-sovereignty:ui.local');
    const currentRoom = this.matrixChatFindRoom(selectedId, rooms);
    const fail = (code, detail) => {
      this.matrixChatWriteRoot('connection_status', 'str', 'error');
      this.matrixChatWriteRoot('status_text', 'str', `ERR ${code}: ${detail}`);
      this.matrixChatWriteRoot('last_error_json', 'json', { code, detail, request_id: requestId, ts: Date.now() });
    };
    try {
      if (action === 'refresh_rooms') {
        const result = await call('refreshRooms', {});
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_rooms_refresh_failed', result && result.detail ? result.detail : 'matrix_rooms_refresh_failed');
          return;
        }
        const nextRooms = matrixDedupeJoinedInviteRooms((Array.isArray(result.rooms) ? result.rooms : [])
          .map((room, index) => matrixProjectedRoom(room, index))
          .filter(Boolean));
        const refreshedEvents = mergeMatrixTimeline(events, matrixProjectedTimeline(result));
        if (nextRooms.length === 0) {
          this.matrixChatWriteRoot('rooms_json', 'json', []);
          this.matrixChatWriteRoot('status_text', 'str', 'Matrix rooms refreshed: 0');
          this.matrixChatWriteRoot('connection_status', 'str', 'warning');
          this.matrixChatSyncProjection([], refreshedEvents, '');
          return;
        }
        const active = nextRooms.find((room) => room.id === selectedId)
          || nextRooms.find((room) => room.id === String(this.matrixChatReadRoot('target_room_id', '') || '').trim())
          || nextRooms[0];
        selectedId = active.id;
        this.matrixChatWriteRoot('rooms_json', 'json', nextRooms);
        this.matrixChatWriteRoot('timeline_json', 'json', refreshedEvents);
        this.matrixChatWriteRoot('target_room_id', 'str', selectedId);
        this.matrixChatWriteRoot('status_text', 'str', `Matrix rooms refreshed: ${nextRooms.length}`);
        this.matrixChatWriteRoot('connection_status', 'str', 'online');
        this.matrixChatSyncProjection(nextRooms, refreshedEvents, selectedId);
        return;
      }

      if (action === 'send_message') {
        const body = String(payload.body || '').trim();
        if (!currentRoom || !body) {
          fail('invalid_send_request', !currentRoom ? selectedId : 'empty_body');
          return;
        }
        const result = await call('sendMessage', { roomId: selectedId, body });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_send_failed', result && result.detail ? result.detail : 'matrix_send_failed');
          return;
        }
        events = events.concat({
          event_id: result.eventId || `$matrix_chat_${Date.now()}`,
          room_id: selectedId,
          sender: 'You',
          type: 'm.room.message',
          msgtype: 'm.text',
          body,
          ts: result.ts || this.matrixSuiteNow(),
          edited: false,
        });
        this.matrixChatWriteRoot('timeline_json', 'json', events);
        this.matrixChatWriteRoot('last_editable_event_id', 'str', result.eventId || '');
        this.matrixChatWriteRoot('edit_draft', 'str', body);
        this.matrixChatWriteRoot('composer_draft', 'str', '');
        this.matrixChatWriteRoot('status_text', 'str', `Sent via Matrix: ${result.eventId || 'ok'}`);
        this.matrixChatWriteRoot('connection_status', 'str', 'online');
        this.matrixChatSyncProjection(rooms, events, selectedId);
        return;
      }

      if (action === 'edit_message') {
        const eventId = String(payload.event_id || '').trim();
        const body = String(payload.body || '').trim();
        if (!eventId || !body || !currentRoom) {
          fail('invalid_edit_request', !eventId ? 'missing_event_id' : (!body ? 'empty_body' : selectedId));
          return;
        }
        const result = await call('editMessage', { roomId: selectedId, eventId, body });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_edit_failed', result && result.detail ? result.detail : 'matrix_edit_failed');
          return;
        }
        let edited = false;
        events = events.map((event) => event && event.event_id === eventId
          ? (edited = true, { ...event, body, edited: true, edited_at: result.ts || this.matrixSuiteNow(), edit_event_id: result.eventId || '' })
          : event);
        if (!edited) {
          events = events.concat({
            event_id: result.eventId || `$matrix_chat_edit_${Date.now()}`,
            room_id: selectedId,
            sender: 'You',
            type: 'm.room.message',
            msgtype: 'm.text',
            body,
            ts: result.ts || this.matrixSuiteNow(),
            edited: true,
          });
        }
        this.matrixChatWriteRoot('timeline_json', 'json', events);
        this.matrixChatWriteRoot('edit_draft', 'str', body);
        this.matrixChatWriteRoot('edit_dialog_open', 'bool', false);
        this.matrixChatWriteRoot('status_text', 'str', `Edited via Matrix: ${result.eventId || 'ok'}`);
        this.matrixChatWriteRoot('connection_status', 'str', 'online');
        this.matrixChatSyncProjection(rooms, events, selectedId);
        return;
      }

      if (action === 'share_file') {
        const mediaUri = String(payload.media_uri || '').trim();
        const fileName = String(payload.file_name || 'uploaded-file').trim() || 'uploaded-file';
        const mimeType = String(payload.mime_type || payload.mimeType || '').trim();
        const fileMessage = matrixShareFileMessage({ mediaUri, fileName, mimeType });
        const cardKind = fileMessage.cardKind;
        if (!mediaUri || !currentRoom) {
          fail('invalid_file_request', !mediaUri ? 'missing_media_uri' : selectedId);
          return;
        }
        const result = await call('shareFile', { roomId: selectedId, mediaUri, fileName: fileMessage.fileName, mimeType: fileMessage.mimeType });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_file_send_failed', result && result.detail ? result.detail : 'matrix_file_send_failed');
          return;
        }
        events = events.concat({
          event_id: result.eventId || `$matrix_chat_file_${Date.now()}`,
          room_id: selectedId,
          sender: 'You',
          type: 'm.room.message',
          msgtype: fileMessage.content.msgtype,
          body: fileMessage.fileName,
          card_kind: cardKind,
          media_uri: mediaUri,
          file_name: fileMessage.fileName,
          mime_type: fileMessage.mimeType,
          size: fileMessage.size,
          download_url: matrixMediaDownloadUrl(mediaUri, fileMessage.fileName),
          thumbnail_url: cardKind === 'image' ? matrixMediaThumbnailUrl(mediaUri, fileMessage.fileName) : '',
          ts: result.ts || this.matrixSuiteNow(),
          edited: false,
        });
        this.matrixChatWriteRoot('timeline_json', 'json', events);
        this.matrixChatWriteRoot('file_share_status', 'str', `shared via Matrix: ${result.eventId || 'ok'}`);
        this.matrixChatWriteRoot('pending_file_uri', 'str', '');
        this.matrixChatWriteRoot('pending_file_name', 'str', '');
        this.matrixChatWriteRoot('status_text', 'str', `File shared via Matrix: ${result.eventId || 'ok'}`);
        this.matrixChatWriteRoot('connection_status', 'str', 'online');
        this.matrixChatSyncProjection(rooms, events, selectedId);
        return;
      }

      if (action === 'send_voice') {
        const mediaUri = String(payload.media_uri || '').trim();
        const fileName = String(payload.file_name || 'voice-message.webm').trim() || 'voice-message.webm';
        const mimeType = String(payload.mime_type || payload.mimeType || 'audio/webm').trim() || 'audio/webm';
        const fileMessage = matrixShareFileMessage({ mediaUri, fileName, mimeType });
        if (!mediaUri || !currentRoom) {
          fail('invalid_voice_request', !mediaUri ? 'missing_media_uri' : selectedId);
          return;
        }
        const result = await call('shareFile', { roomId: selectedId, mediaUri, fileName: fileMessage.fileName, mimeType: fileMessage.mimeType });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_voice_send_failed', result && result.detail ? result.detail : 'matrix_voice_send_failed');
          return;
        }
        events = events.concat({
          event_id: result.eventId || `$matrix_chat_voice_${Date.now()}`,
          room_id: selectedId,
          sender: 'You',
          type: 'm.room.message',
          msgtype: fileMessage.content.msgtype,
          body: fileMessage.fileName,
          card_kind: 'audio',
          media_uri: mediaUri,
          file_name: fileMessage.fileName,
          mime_type: fileMessage.mimeType,
          size: fileMessage.size,
          download_url: matrixMediaDownloadUrl(mediaUri, fileMessage.fileName),
          ts: result.ts || this.matrixSuiteNow(),
          edited: false,
        });
        this.matrixChatWriteRoot('timeline_json', 'json', events);
        this.matrixChatWriteRoot('status_text', 'str', `Voice shared via Matrix: ${result.eventId || 'ok'}`);
        this.matrixChatWriteRoot('connection_status', 'str', 'online');
        this.matrixChatSyncProjection(rooms, events, selectedId);
        return;
      }

      if (action === 'invite_member') {
        const userId = String(payload.user_id || payload.userId || '').trim();
        if (!currentRoom || !userId) {
          fail('invalid_invite_request', !currentRoom ? selectedId : 'missing_user_id');
          return;
        }
        const result = await call('inviteMember', { roomId: selectedId, userId, reason: String(payload.reason || '') });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_invite_failed', result && result.detail ? result.detail : 'matrix_invite_failed');
          return;
        }
        const nextRooms = rooms.map((room) => room && room.id === selectedId
          ? { ...room, pending_invites: Array.from(new Set([...(Array.isArray(room.pending_invites) ? room.pending_invites : []), userId])) }
          : room);
        this.matrixChatWriteRoot('rooms_json', 'json', nextRooms);
        this.matrixChatWriteRoot('invite_user_id_draft', 'str', '');
        this.matrixChatWriteRoot('status_text', 'str', `Invited ${userId} via Matrix`);
        this.matrixChatWriteRoot('connection_status', 'str', 'online');
        this.matrixChatSyncProjection(nextRooms, events, selectedId);
        return;
      }

      if (action === 'remove_member') {
        const userId = String(payload.user_id || payload.userId || '').trim();
        if (!currentRoom || !userId) {
          fail('invalid_remove_member_request', !currentRoom ? selectedId : 'missing_user_id');
          return;
        }
        const result = await call('removeMember', { roomId: selectedId, userId, reason: String(payload.reason || '') });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_remove_member_failed', result && result.detail ? result.detail : 'matrix_remove_member_failed');
          return;
        }
        const nextRooms = rooms.map((room) => {
          if (!room || room.id !== selectedId) return room;
          const members = Array.isArray(room.members) ? room.members.filter((member) => !String(member).includes(userId)) : [];
          const memberObjects = Array.isArray(room.member_objects) ? room.member_objects.filter((member) => member.user_id !== userId) : [];
          const pendingInvites = Array.isArray(room.pending_invites)
            ? room.pending_invites.filter((member) => member !== userId)
            : [];
          return { ...room, members, member_objects: memberObjects, member_count: memberObjects.length || members.length, pending_invites: pendingInvites };
        });
        this.matrixChatWriteRoot('rooms_json', 'json', nextRooms);
        this.matrixChatWriteRoot('remove_user_id_draft', 'str', '');
        this.matrixChatWriteRoot('status_text', 'str', `Removed ${userId} via Matrix`);
        this.matrixChatWriteRoot('connection_status', 'str', 'online');
        this.matrixChatSyncProjection(nextRooms, events, selectedId);
        return;
      }

      if (action === 'accept_invite') {
        if (!currentRoom || matrixRoomConversationGroup(currentRoom.kind) !== 'invites') {
          fail('accept_invite_requires_invited_room', !currentRoom ? selectedId : currentRoom.kind);
          return;
        }
        const result = await call('joinRoom', { roomId: selectedId, reason: String(payload.reason || '') });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_join_failed', result && result.detail ? result.detail : 'matrix_join_failed');
          return;
        }
        const refreshResult = await call('refreshRooms', {});
        if (!refreshResult || refreshResult.ok === false) {
          this.matrixChatWriteRoot('rooms_json', 'json', rooms);
          this.matrixChatWriteRoot('status_text', 'str', `Accepted Matrix invite: ${result.roomId || selectedId}; refresh failed, click Refresh to confirm the joined room`);
          this.matrixChatWriteRoot('connection_status', 'str', 'warning');
          this.matrixChatSyncProjection(rooms, events, selectedId);
          return;
        }
        const nextRooms = matrixDedupeJoinedInviteRooms((Array.isArray(refreshResult.rooms) ? refreshResult.rooms : [])
          .map((room, index) => matrixProjectedRoom(room, index))
          .filter(Boolean));
        const refreshedEvents = mergeMatrixTimeline(events, matrixProjectedTimeline(refreshResult));
        const joinedRoomId = String(result.roomId || '').trim();
        const active = nextRooms.find((room) => room.id === joinedRoomId)
          || nextRooms.find((room) => room.id !== selectedId)
          || nextRooms[0]
          || null;
        const nextSelectedId = active ? active.id : '';
        this.matrixChatWriteRoot('rooms_json', 'json', nextRooms);
        this.matrixChatWriteRoot('timeline_json', 'json', refreshedEvents);
        this.matrixChatWriteRoot('target_room_id', 'str', nextSelectedId);
        this.matrixChatWriteRoot('room_detail_dialog_open', 'bool', false);
        this.matrixChatWriteRoot('status_text', 'str', `Accepted Matrix invite: ${joinedRoomId || selectedId}`);
        this.matrixChatWriteRoot('connection_status', 'str', 'online');
        this.matrixChatSyncProjection(nextRooms, refreshedEvents, nextSelectedId);
        return;
      }

      if (action === 'decline_invite') {
        if (!currentRoom || matrixRoomConversationGroup(currentRoom.kind) !== 'invites') {
          fail('decline_invite_requires_invited_room', !currentRoom ? selectedId : currentRoom.kind);
          return;
        }
        const result = await call('leaveRoom', { roomId: selectedId, reason: String(payload.reason || '') });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_decline_invite_failed', result && result.detail ? result.detail : 'matrix_decline_invite_failed');
          return;
        }
        const refreshResult = await call('refreshRooms', {});
        const refreshedEvents = refreshResult && refreshResult.ok !== false
          ? mergeMatrixTimeline(events, matrixProjectedTimeline(refreshResult))
          : events;
        const nextRooms = refreshResult && refreshResult.ok !== false
          ? matrixDedupeJoinedInviteRooms((Array.isArray(refreshResult.rooms) ? refreshResult.rooms : [])
            .map((room, index) => matrixProjectedRoom(room, index))
            .filter((room) => room && room.id !== selectedId))
          : rooms.filter((room) => room && room.id !== selectedId);
        const active = nextRooms.find((room) => room && room.archived !== true) || null;
        const nextSelectedId = active ? active.id : '';
        this.matrixChatWriteRoot('rooms_json', 'json', nextRooms);
        this.matrixChatWriteRoot('timeline_json', 'json', refreshedEvents);
        this.matrixChatWriteRoot('target_room_id', 'str', nextSelectedId);
        this.matrixChatWriteRoot('room_detail_dialog_open', 'bool', false);
        this.matrixChatWriteRoot('status_text', 'str', refreshResult && refreshResult.ok === false
          ? `Declined Matrix invite: ${selectedId}; refresh failed, click Refresh to confirm`
          : `Declined Matrix invite: ${selectedId}`);
        this.matrixChatWriteRoot('connection_status', 'str', refreshResult && refreshResult.ok === false ? 'warning' : 'online');
        this.matrixChatSyncProjection(nextRooms, refreshedEvents, nextSelectedId);
        return;
      }

      if (action === 'leave_room' || action === 'delete_friend') {
        if (!currentRoom) {
          fail('invalid_leave_request', selectedId);
          return;
        }
        if (action === 'delete_friend' && matrixRoomConversationGroup(currentRoom.kind) !== 'people') {
          fail('delete_friend_requires_people_room', selectedId);
          return;
        }
        const result = await call('leaveRoom', { roomId: selectedId, reason: String(payload.reason || '') });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_leave_failed', result && result.detail ? result.detail : 'matrix_leave_failed');
          return;
        }
        const nextRooms = rooms.filter((room) => room && room.id !== selectedId);
        const fallback = nextRooms.find((room) => room && room.archived !== true);
        const nextSelectedId = fallback ? fallback.id : selectedId;
        this.matrixChatWriteRoot('rooms_json', 'json', nextRooms);
        this.matrixChatWriteRoot('room_detail_dialog_open', 'bool', false);
        this.matrixChatWriteRoot('status_text', 'str', action === 'delete_friend' ? `Left 1v1 conversation ${currentRoom.name}` : `Left ${currentRoom.name}`);
        this.matrixChatWriteRoot('connection_status', 'str', 'online');
        this.matrixChatSyncProjection(nextRooms, events, nextSelectedId);
        return;
      }

      if (action === 'create_channel') {
        const name = String(payload.name || '').trim();
        const kind = String(payload.kind || 'room') === 'dm' ? 'dm' : 'room';
        const result = await call('createRoom', { name, kind, inviteUserId: String(payload.invite_user_id || '') });
        if (!result || result.ok === false) {
          fail(result && result.code ? result.code : 'matrix_create_room_failed', result && result.detail ? result.detail : 'matrix_create_room_failed');
          return;
        }
        const roomId = result.roomId || `!matrix-chat-${Date.now()}:local`;
        const nextRoom = {
          id: roomId,
          kind: result.kind || kind,
          conversation_group: matrixRoomConversationGroup(result.kind || kind),
          name: result.name || name || roomId,
          list_title: result.name || name || roomId,
          list_subtitle: '',
          avatar: (result.name || name || roomId).slice(0, 2).toUpperCase(),
          unread: 0,
          members: kind === 'dm' ? [result.name || name || roomId] : ['You'],
          member_count: 1,
          member_status: 'created',
          history_status: 'created',
          power_status: 'created',
          can_invite: true,
          can_kick: true,
          can_leave: true,
          own_power: 100,
          invite_level: 0,
          kick_level: 50,
          last_message: '',
          archived: false,
        };
        const nextRooms = rooms.concat(nextRoom);
        this.matrixChatWriteRoot('rooms_json', 'json', nextRooms);
        this.matrixChatWriteRoot('new_channel_name', 'str', '');
        this.matrixChatWriteRoot('create_dialog_open', 'bool', false);
        this.matrixChatWriteRoot('status_text', 'str', `Created Matrix ${kind}: ${nextRoom.name}`);
        this.matrixChatWriteRoot('connection_status', 'str', 'online');
        selectedId = roomId;
        this.matrixChatSyncProjection(nextRooms, events, selectedId);
        return;
      }

      fail('unsupported_matrix_chat_action', action || 'missing');
    } catch (err) {
      fail('matrix_chat_host_exception', err && err.message ? err.message : String(err));
    }
  }

  trackMatrixHostAction(promise) {
    const tracked = Promise.resolve(promise)
      .catch((err) => {
        console.warn('[ProgramModelEngine] Matrix host action failed:', err && err.message ? err.message : err);
      })
      .finally(() => {
        this.pendingMatrixHostActions.delete(tracked);
      });
    this.pendingMatrixHostActions.add(tracked);
    return tracked;
  }

  async flushMatrixHostActions() {
    if (!this.pendingMatrixHostActions || this.pendingMatrixHostActions.size === 0) return;
    await Promise.allSettled(Array.from(this.pendingMatrixHostActions));
  }

  async init() {
    this.refreshFunctionRegistry();
    this.refreshMatrixBootstrapConfig();
    if (typeof this.runtime.isRunLoopActive === 'function' && this.runtime.isRunLoopActive()) {
      this.ensureControlBusAdapter();
      this.startMatrixAdapterInit();
    }
    this.started = true;
  }

  async activateRunning() {
    this.ensureControlBusAdapter();
    this.startMatrixAdapterInit();
  }

  refreshFunctionRegistry() {
    const functionLabels = listSystemLabels(this.runtime, (label) => isExecutableJsFunctionLabelType(label.t));
    for (const item of functionLabels) {
      const code = extractFunctionCode(item.label.v);
      if (typeof code === 'string' && code.trim().length > 0) {
        this.functions.set(item.label.k, code);
        item.model.registerFunction(item.label.k);
      }
    }
  }

  async sendMatrix(payload) {
    emitTrace(this.runtime, {
      hop: 'server\u2192matrix', direction: 'outbound',
      op_id: payload && payload.op_id ? payload.op_id : '',
      model_id: payload && payload.model_id != null ? payload.model_id : '',
      summary: `type=${payload && payload.type ? payload.type : '?'}`,
      payload,
    });
    if ((typeof this.runtime.isRunLoopActive === 'function' && !this.runtime.isRunLoopActive())
      || !this.matrixAdapter || !this.matrixRoomId) {
      return null;
    }
    if (!this.matrixDmPeerUserId) {
      return null;
    }
    const opId = payload && typeof payload.op_id === 'string' ? payload.op_id : '';
    const parsedPinPayload = payload && payload.type === 'pin_payload'
      ? parsePinPayloadRecordEnvelope(payload)
      : { ok: false };
    const normalizedOpId = opId || (parsedPinPayload.ok ? parsedPinPayload.opId : '');
    if (normalizedOpId) {
      this.outboundMatrixOps.push({
        op_id: normalizedOpId,
        origin_model_id: parsedPinPayload.ok ? parsedPinPayload.origin.model_id : null,
        type: typeof payload.type === 'string' ? payload.type : '',
        pin: parsedPinPayload.ok ? parsedPinPayload.endpoint.pin : '',
        ts: Date.now(),
      });
      if (this.outboundMatrixOps.length > 200) {
        this.outboundMatrixOps.splice(0, this.outboundMatrixOps.length - 200);
      }
    }
    await this.matrixAdapter.publish(payload);
    return true;
  }

  async sendControlBus(topic, payload) {
    emitTrace(this.runtime, {
      hop: 'server→mqtt',
      direction: 'outbound',
      op_id: payload && Array.isArray(payload.payload)
        ? readTemporaryPayloadString(payload.payload, 'op_id', readTemporaryPayloadString(payload.payload, '__mt_request_id'))
        : '',
      model_id: payload && Array.isArray(payload.payload)
        ? readTemporaryPayloadInt(payload.payload, 'origin_model_id')
        : '',
      summary: `topic=${topic || '?'}`,
      payload,
    });
    if ((typeof this.runtime.isRunLoopActive === 'function' && !this.runtime.isRunLoopActive())
      || !this.controlBusClient
      || !this.controlBusClient.connected
      || !isValidControlBusEndpointTopic(topic)) {
      return null;
    }
    return new Promise((resolve, reject) => {
      this.controlBusClient.publish(topic, JSON.stringify(payload), (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(true);
      });
    });
  }

  ensureControlBusAdapter() {
    if (typeof this.runtime.isRunLoopActive === 'function' && !this.runtime.isRunLoopActive()) {
      return;
    }
    if (this.controlBusClient) return;
    const mqttConfig = readMqttBootstrapConfig(this.runtime);
    const base = readModel0MqttTopicBase(this.runtime);
    if (!mqttConfig.host || !Number.isInteger(mqttConfig.port) || !isValidControlBusTopicBase(base)) {
      return;
    }
    const subscription = `${base}/+/+/+`;
    const clientId = `dy-ui-server-${resolveUiServerWorkerId()}-${Date.now()}`;
    const client = mqtt.connect(`mqtt://${mqttConfig.host}:${mqttConfig.port}`, {
      username: '',
      password: '',
      clientId,
      reconnectPeriod: 500,
    });
    this.controlBusClient = client;
    this.controlBusSubscription = subscription;
    client.on('connect', () => {
      if (this.disableControlBusInbound) {
        this.controlBusReady = true;
        return;
      }
      client.subscribe(subscription, (err) => {
        if (err) {
          console.warn('[ProgramModelEngine] Control bus subscribe failed:', err && err.message ? err.message : err);
          return;
        }
        this.controlBusReady = true;
        console.log('[ProgramModelEngine] Control bus adapter connected, subscription:', subscription);
      });
    });
    client.on('message', (topic, buf) => {
      let payload = null;
      try {
        payload = JSON.parse(buf.toString('utf8'));
      } catch (_) {
        return;
      }
      this.handleControlBusPacket(topic, payload).catch((err) => {
        console.warn('[ProgramModelEngine] handleControlBusPacket failed:', err && err.message ? err.message : err);
      });
    });
    client.on('error', (err) => {
      console.warn('[ProgramModelEngine] Control bus adapter error:', err && err.message ? err.message : err);
    });
  }

  handleWorkspaceAssetBundleResponse(parsedEnvelope, packet, topic = '') {
    if (!parsedEnvelope || !parsedEnvelope.ok) return { matched: false, handled: false };
    const nestedKind = readTemporaryPayloadString(parsedEnvelope.nestedPayload, '__mt_payload_kind');
    if (nestedKind !== 'slide_app_bundle_response.v1') {
      return { matched: false, handled: false };
    }
    const uiServerWorkerId = resolveUiServerWorkerId();
    const writeStatus = (status, error = null) => {
      overwriteRuntimeLabel(this.runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'asset_install_status', 'str', status);
      if (error) {
        overwriteRuntimeLabel(this.runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'asset_install_error', 'json', error);
        overwriteRuntimeLabel(this.runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'asset_install_dialog_open', 'bool', false);
      }
    };
    if (
      parsedEnvelope.messageRole !== 'response'
      || parsedEnvelope.replyTarget.worker_id !== uiServerWorkerId
      || parsedEnvelope.replyTarget.model_id !== WORKSPACE_MANAGER_APP_MODEL_ID
      || parsedEnvelope.replyTarget.pin !== SLIDE_IMPORT_REPLY_PIN
    ) {
      writeStatus('install failed: bundle_response_route_mismatch', {
        code: 'bundle_response_route_mismatch',
        op_id: parsedEnvelope.opId,
      });
      return { matched: true, handled: false };
    }
    const pending = readRuntimeCellJson(this.runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'asset_install_pending', null);
    if (!pending || typeof pending !== 'object' || Array.isArray(pending)) {
      const lastInstalledOpId = readRuntimeCellString(this.runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'last_installed_op_id', '');
      if (parsedEnvelope.opId && parsedEnvelope.opId === lastInstalledOpId) {
        return { matched: true, handled: true };
      }
      writeStatus('install failed: bundle_response_without_pending_request', {
        code: 'bundle_response_without_pending_request',
        op_id: parsedEnvelope.opId,
      });
      return { matched: true, handled: false };
    }
    const payloadTopic = readTemporaryPayloadString(parsedEnvelope.records, 'topic');
    const responseTopic = readTemporaryPayloadString(parsedEnvelope.records, 'response_topic');
    const routeKind = readTemporaryPayloadString(parsedEnvelope.records, 'route_kind');
    const assetId = readTemporaryPayloadString(parsedEnvelope.nestedPayload, 'asset_id');
    const bundlePayload = readTemporaryPayloadJson(parsedEnvelope.nestedPayload, 'bundle_payload');
    const expectedEndpoint = pending.provider_endpoint && typeof pending.provider_endpoint === 'object'
      ? pending.provider_endpoint
      : null;
    const expectedReplyTarget = pending.reply_target && typeof pending.reply_target === 'object'
      ? pending.reply_target
      : null;
    const matches = parsedEnvelope.opId === pending.op_id
      && assetId === pending.asset_id
      && payloadTopic === pending.response_topic
      && responseTopic === pending.response_topic
      && (!topic || topic === pending.response_topic)
      && routeKind === pending.route_kind
      && workspaceAssetProviderEndpointMatches(parsedEnvelope.origin, expectedEndpoint)
      && workspaceAssetProviderEndpointMatches(parsedEnvelope.endpoint, expectedReplyTarget)
      && workspaceAssetProviderEndpointMatches(parsedEnvelope.replyTarget, expectedReplyTarget);
    if (!matches) {
      writeStatus(`install failed ${pending.asset_id || assetId || 'unknown'}: bundle_response_mismatch`, {
        code: 'bundle_response_mismatch',
        op_id: parsedEnvelope.opId,
        asset_id: assetId,
        topic: payloadTopic,
        response_topic: responseTopic,
      });
      return { matched: true, handled: false };
    }
    const validation = validateSlideImportPayload(bundlePayload);
    if (!validation.ok) {
      writeStatus(`install failed ${assetId}: ${validation.detail || validation.code || 'invalid_bundle_payload'}`, {
        code: validation.code || 'invalid_bundle_payload',
        detail: validation.detail || '',
        op_id: parsedEnvelope.opId,
      });
      return { matched: true, handled: false };
    }
    try {
      const imported = materializeSlideImportPayload(this.runtime, bundlePayload, validation);
      registerImportedHostEgressBridgeFunctions(this, this.runtime, imported);
      overwriteRuntimeLabel(this.runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'last_installed_op_id', 'str', parsedEnvelope.opId);
      overwriteRuntimeLabel(this.runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'last_installed_asset_id', 'str', assetId);
      overwriteRuntimeLabel(this.runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'last_installed_model_id', 'int', imported.rootModelId);
      overwriteRuntimeLabel(this.runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'last_installed_table_id', 'str', imported.tableId);
      overwriteRuntimeLabel(this.runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'asset_install_pending', 'json', null);
      overwriteRuntimeLabel(this.runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'asset_install_error', 'json', null);
      const launchPayload = {
        id: `workspace:${imported.tableId}:${imported.rootModelId}`,
        kind: 'workspace',
        page: 'workspace',
        path: '/workspace',
        table_id: imported.tableId,
        model_id: imported.rootModelId,
        title: validation.metadata.appName,
      };
      overwriteRuntimeLabel(
        this.runtime,
        WORKSPACE_MANAGER_APP_MODEL_ID,
        0,
        0,
        0,
        'asset_install_status',
        'str',
        `installed ${validation.metadata.appName} as ${imported.tableId}/${imported.rootModelId}`,
      );
      overwriteRuntimeLabel(this.runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'asset_install_dialog_open', 'bool', true);
      overwriteRuntimeLabel(this.runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'asset_install_dialog_title', 'str', '安装完毕');
      overwriteRuntimeLabel(
        this.runtime,
        WORKSPACE_MANAGER_APP_MODEL_ID,
        0,
        0,
        0,
        'asset_install_dialog_text',
        'str',
        `${validation.metadata.appName} 已安装为 ${imported.tableId}/${imported.rootModelId}。是否现在打开？`,
      );
      overwriteRuntimeLabel(this.runtime, WORKSPACE_MANAGER_APP_MODEL_ID, 0, 0, 0, 'asset_install_dialog_target_json', 'json', launchPayload);
      this._wsRefreshCatalog?.();
      emitTrace(this.runtime, {
        hop: 'provider-bundle→server',
        direction: 'inbound',
        op_id: parsedEnvelope.opId,
        model_id: imported.rootModelId,
        summary: `installed provider bundle asset=${assetId}`,
        payload: packet,
      });
      this.onSnapshotChanged?.();
      return { matched: true, handled: true };
    } catch (err) {
      writeStatus(`install failed ${assetId}: exception`, {
        code: 'exception',
        detail: String(err && err.message ? err.message : err),
        op_id: parsedEnvelope.opId,
      });
      return { matched: true, handled: false };
    }
  }

  async handleControlBusPacket(topic, payload) {
    if (!isValidControlBusEndpointTopic(topic)) return false;
    const parsedEnvelope = parsePinPayloadRecordEnvelope(payload);
    if (!parsedEnvelope.ok) return false;
    const payloadTopic = readTemporaryPayloadString(parsedEnvelope.records, 'topic');
    const routeKindRecord = findTemporaryPayloadRecord(parsedEnvelope.records, 'route_kind');
    const routeKind = routeKindRecord && routeKindRecord.t === 'str' ? routeKindRecord.v : '';
    if (payloadTopic !== topic || routeKind !== 'control') return false;
    if (parsedEnvelope.messageRole !== 'response') return false;
    const uiServerWorkerId = resolveUiServerWorkerId();
    if (parsedEnvelope.replyTarget.worker_id !== uiServerWorkerId || parsedEnvelope.replyTarget.pin !== 'result') return false;
    const bundleResponse = this.handleWorkspaceAssetBundleResponse(parsedEnvelope, payload, topic);
    if (bundleResponse.matched) return bundleResponse.handled;
    const materialization = temporaryPayloadToOwnerMaterialization(parsedEnvelope.replyTarget, parsedEnvelope.nestedPayload, parsedEnvelope.opId);
    if (!materialization) return false;
    emitTrace(this.runtime, {
      hop: 'mqtt\u2192server',
      direction: 'inbound',
      op_id: parsedEnvelope.opId,
      table_id: parsedEnvelope.replyTarget.table_id,
      model_id: parsedEnvelope.replyTarget.model_id,
      summary: `control-bus response topic=${topic}`,
      payload,
    });
    const result = await this.routePinPayloadViaOwnerMaterialization(materialization);
    if (!result || result.ok !== true) {
      console.warn(
        '[handleControlBusPacket] pin_payload owner route rejected:',
        result && result.code ? result.code : 'unknown',
        result && result.detail ? result.detail : '',
      );
      return false;
    }
    this.onSnapshotChanged?.();
    return true;
  }

  ignoreOutboundMatrixReturns(originModelIds, sinceTs) {
    const originSet = new Set(Array.isArray(originModelIds) ? originModelIds : []);
    const startTs = Number.isFinite(sinceTs) ? sinceTs : 0;
    const ignored = [];
    for (const item of this.outboundMatrixOps) {
      if (!item || !originSet.has(item.origin_model_id)) continue;
      if (item.ts < startTs) continue;
      if (item.type !== 'pin_payload' || item.pin !== 'submit') continue;
      if (!item.op_id) continue;
      this.ignoredMatrixReturnOpIds.add(item.op_id);
      ignored.push(item.op_id);
    }
    return ignored;
  }

  async llmInfer(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const baseUrlRaw = typeof opts.baseUrl === 'string' ? opts.baseUrl.trim() : '';
    const modelRaw = typeof opts.model === 'string' ? opts.model.trim() : '';
    const prompt = typeof opts.prompt === 'string' ? opts.prompt : '';
    const systemPrompt = typeof opts.systemPrompt === 'string' ? opts.systemPrompt : '';
    const timeoutMs = toIntInRange(opts.timeoutMs, 10000, 1000, 180000);
    const temperature = toFiniteNumber(opts.temperature, 0.1);
    const maxTokens = toIntInRange(opts.maxTokens, 220, 32, 4096);

    if (!baseUrlRaw) {
      return { ok: false, code: 'llm_unavailable', detail: 'missing_llm_base_url' };
    }
    if (!modelRaw) {
      return { ok: false, code: 'llm_unavailable', detail: 'missing_llm_model' };
    }
    if (!prompt.trim()) {
      return { ok: false, code: 'invalid_target', detail: 'empty_prompt' };
    }

    const endpoint = `${baseUrlRaw.replace(/\/+$/, '')}/api/generate`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('llm_timeout')), timeoutMs);
    try {
      const body = {
        model: modelRaw,
        prompt,
        stream: true,
        think: false,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      };
      if (systemPrompt.trim()) {
        body.system = systemPrompt;
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return {
          ok: false,
          code: 'llm_http_error',
          detail: `status=${response.status}${text ? ` body=${text.slice(0, 300)}` : ''}`,
        };
      }
      const text = await response.text();
      return parseOllamaGenerateResponseText(text, modelRaw);
    } catch (err) {
      const name = err && typeof err === 'object' && typeof err.name === 'string' ? err.name : '';
      if (name === 'AbortError') {
        return { ok: false, code: 'llm_timeout', detail: `timeout_ms=${timeoutMs}` };
      }
      return {
        ok: false,
        code: 'llm_unavailable',
        detail: String(err && err.message ? err.message : err),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async routePinPayloadViaOwnerMaterialization(requestEnvelope) {
    const runtime = this.runtime;
    const hostRequests = [];
    const appRequests = [];
    const hostTargetModelIds = new Set();
    const appTargetRefs = new Map();
    for (const record of requestEnvelope.records) {
      if (!record || typeof record !== 'object' || !Number.isInteger(record.model_id)) continue;
      if (record.op !== 'add_label' && record.op !== 'rm_label') {
        return { ok: false, code: 'unsupported_op', detail: String(record.op || 'unknown') };
      }
      const tableId = record.table_id === undefined || record.table_id === null
        ? 'host'
        : (typeof record.table_id === 'string' && isSafePinRouteSegment(record.table_id) ? record.table_id : '');
      if (!tableId) return { ok: false, code: 'invalid_target', detail: 'invalid_table_id' };

      const scopedLabel = {
        p: Number.isInteger(record.p) ? record.p : 0,
        r: Number.isInteger(record.r) ? record.r : 0,
        c: Number.isInteger(record.c) ? record.c : 0,
        k: record.k,
        t: record.t,
        v: record.v,
      };

      if (tableId !== 'host') {
        if (record.model_id < 0) return { ok: false, code: 'invalid_target', detail: 'app_table_negative_model_forbidden' };
        const targetModel = runtime.getModel({ table_id: tableId, model_id: record.model_id });
        if (!targetModel) return { ok: false, code: 'invalid_target', detail: `${tableId}:${record.model_id}` };
        appRequests.push({ targetModel, record, scopedLabel, table_id: tableId, model_id: record.model_id });
        appTargetRefs.set(`${tableId}:${record.model_id}`, { table_id: tableId, model_id: record.model_id });
        continue;
      }

      const targetModel = runtime.getModel(record.model_id);
      if (!targetModel) continue;
      const dbLabel = runtime.getCell(targetModel, 0, 0, 0).labels.get('dual_bus_model');
      if (!dbLabel || !dbLabel.v || typeof dbLabel.v !== 'object') continue;

      hostRequests.push({
        target_model_id: record.model_id,
        request_id: `${requestEnvelope.op_id || 'pin_payload'}:${hostRequests.length + 1}`,
        origin_action: 'pin_payload_result',
        write_labels: record.op === 'add_label' ? [scopedLabel] : [],
        remove_labels: record.op === 'rm_label' ? [{ p: scopedLabel.p, r: scopedLabel.r, c: scopedLabel.c, k: scopedLabel.k }] : [],
      });
      hostTargetModelIds.add(record.model_id);
    }

    if (hostRequests.length === 0 && appRequests.length === 0) {
      return { ok: false, code: 'no_dual_bus_target', detail: 'pin_payload_no_owner_route' };
    }

    if (hostRequests.length > 0) {
      const sysModel = runtime.getModel(-10);
      if (!sysModel) return { ok: false, code: 'invalid_target', detail: 'missing_system_model' };

      runtime.addLabel(sysModel, 0, 0, 0, { k: GENERIC_PIN_ERROR_LABEL, t: 'json', v: null });
      for (const modelId of hostTargetModelIds) {
        const targetModel = runtime.getModel(modelId);
        if (!targetModel) return { ok: false, code: 'invalid_target', detail: String(modelId) };
        if (!ensureGenericOwnerMaterializer(runtime, modelId)) return { ok: false, code: 'target_owner_missing', detail: String(modelId) };
        if (!ensureGenericOwnerRoute(runtime, modelId)) return { ok: false, code: 'route_missing', detail: String(modelId) };
        runtime.rmLabel(targetModel, 0, 0, 0, `__error_${GENERIC_OWNER_FUNC}`);
      }

      for (const request of hostRequests) {
        runtime.addLabel(sysModel, 0, 0, 0, {
          k: buildGenericSourceOutPin(request.target_model_id),
          t: 'pin.out',
          v: ownerRequestToTemporaryPayload(request, 'owner_request.v1'),
        });
      }

      await sleepMs(25);
      await this.tick();

      const sourceErr = runtime.getLabelValue(sysModel, 0, 0, 0, GENERIC_PIN_ERROR_LABEL);
      if (sourceErr && typeof sourceErr === 'object') {
        return {
          ok: false,
          code: typeof sourceErr.code === 'string' ? sourceErr.code : 'source_pin_error',
          detail: typeof sourceErr.detail === 'string' ? sourceErr.detail : 'unknown',
        };
      }

      for (const modelId of hostTargetModelIds) {
        const targetModel = runtime.getModel(modelId);
        const errValue = targetModel ? runtime.getLabelValue(targetModel, 0, 0, 0, `__error_${GENERIC_OWNER_FUNC}`) : null;
        if (errValue && typeof errValue === 'object') {
          return {
            ok: false,
            code: 'target_materialization_failed',
            detail: typeof errValue.error === 'string' ? errValue.error : 'unknown',
          };
        }
      }
    }

    for (const request of appRequests) {
      const { targetModel, record, scopedLabel } = request;
      if (record.op === 'add_label') {
        runtime.addLabel(targetModel, scopedLabel.p, scopedLabel.r, scopedLabel.c, {
          k: scopedLabel.k,
          t: scopedLabel.t,
          v: scopedLabel.v,
        });
      } else {
        runtime.rmLabel(targetModel, scopedLabel.p, scopedLabel.r, scopedLabel.c, scopedLabel.k);
      }
    }

    return {
      ok: true,
      request_count: hostRequests.length + appRequests.length,
      target_models: [...hostTargetModelIds],
      target_refs: [
        ...[...hostTargetModelIds].map((modelId) => ({ table_id: 'host', model_id: modelId })),
        ...appTargetRefs.values(),
      ],
    };
  }

  handleDyBusEvent(content) {
    // Handle dy.bus.v1 events from MBR (return path: K8s -> MQTT -> MBR -> Matrix -> here).
    // Expected format: { version: 'v1', type: 'pin_payload', payload: Temporary ModelTable records }.
    if (!content || typeof content !== 'object') {
      return;
    }
    
    if (content.version !== 'v1') {
      return;
    }

    const traceInbound = () => {
      const parsedForTrace = content && content.type === 'pin_payload' ? parsePinPayloadRecordEnvelope(content) : { ok: false };
      emitTrace(this.runtime, {
        hop: 'matrix\u2192server', direction: 'inbound',
        op_id: parsedForTrace.ok ? parsedForTrace.opId : (content && content.op_id ? content.op_id : ''),
        model_id: '',
        summary: `dy.bus.v0 type=${content && content.type ? content.type : '?'}`,
        payload: content,
      });
    };
    
    if (content.type === 'pin_payload') {
      const parsedEnvelope = parsePinPayloadRecordEnvelope(content);
      if (!parsedEnvelope.ok) {
        return;
      }
      const uiServerWorkerId = resolveUiServerWorkerId();
      const ackValidation = parsedEnvelope.replyTarget.model_id === MGMT_BUS_CONSOLE_MODEL_ID
        && parsedEnvelope.replyTarget.worker_id === uiServerWorkerId
        && parsedEnvelope.replyTarget.pin === 'result'
        && parsedEnvelope.messageRole === 'response'
        ? validateMgmtBusConsoleAck({
          version: 'v1',
          type: 'mgmt_bus_console_ack',
          payload: parsedEnvelope.nestedPayload,
        })
        : { ok: false };
      if (ackValidation.ok) {
        const consoleModel = this.runtime.getModel(MGMT_BUS_CONSOLE_MODEL_ID);
        if (consoleModel) {
          this.runtime.addLabel(consoleModel, 0, 0, 0, { k: 'message_status', t: 'str', v: 'ack_received' });
        }
        traceInbound();
        this.tick().then(() => {
          this.onSnapshotChanged?.();
        }).catch((err) => {
          console.error('[handleDyBusEvent] mgmt_bus_console_ack projection failed:', err && err.message ? err.message : err);
        });
        return;
      }
      const opId = parsedEnvelope.opId;
      if (opId && this.ignoredMatrixReturnOpIds.has(opId)) {
        return;
      }
      if (parsedEnvelope.replyTarget.worker_id !== uiServerWorkerId || parsedEnvelope.replyTarget.pin !== 'result') {
        return;
      }
      if (parsedEnvelope.messageRole !== 'response') {
        return;
      }
      const bundleResponse = this.handleWorkspaceAssetBundleResponse(
        parsedEnvelope,
        content,
        readTemporaryPayloadString(parsedEnvelope.records, 'topic'),
      );
      if (bundleResponse.matched) {
        return;
      }
      const materialization = temporaryPayloadToOwnerMaterialization(parsedEnvelope.replyTarget, parsedEnvelope.nestedPayload, opId);
      if (!materialization) {
        return;
      }
      traceInbound();
      this.routePinPayloadViaOwnerMaterialization(materialization)
        .then((result) => {
          if (!result || result.ok !== true) {
            console.warn(
              '[handleDyBusEvent] pin_payload owner route rejected:',
              result && result.code ? result.code : 'unknown',
              result && result.detail ? result.detail : '',
            );
            return;
          }
          this.onSnapshotChanged?.();
        })
        .catch((err) => {
          console.error('[handleDyBusEvent] pin_payload owner route failed:', err && err.message ? err.message : err);
        });
      return;
    }
    
    if (content.type === UI_EVENT_TYPE) {
      // Echo of our own Matrix send — ignore in server return path.
      return;
    }
  }

  executeFunction(name, interceptPayload) {
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
      return;
    }
    const runtimeView = {
      getModel: (modelId) => {
        const model = this.runtime.getModel(modelId);
        if (!model) return null;
        return { id: model.id, name: model.name, type: model.type };
      },
      getCell: (modelRefOrId, p = 0, r = 0, c = 0) => {
        const modelId = Number.isInteger(modelRefOrId)
          ? modelRefOrId
          : (modelRefOrId && Number.isInteger(modelRefOrId.id) ? modelRefOrId.id : null);
        if (!Number.isInteger(modelId)) return null;
        const model = this.runtime.getModel(modelId);
        if (!model) return null;
        const cell = this.runtime.getCell(model, p, r, c);
        return {
          model_id: modelId,
          p,
          r,
          c,
          labels: new Map(Array.from(cell.labels.entries()).map(([key, value]) => [key, { ...value }])),
        };
      },
      getLabelValue: (modelRefOrId, p = 0, r = 0, c = 0, key) => {
        const modelId = Number.isInteger(modelRefOrId)
          ? modelRefOrId
          : (modelRefOrId && Number.isInteger(modelRefOrId.id) ? modelRefOrId.id : null);
        if (!Number.isInteger(modelId)) return undefined;
        const model = this.runtime.getModel(modelId);
        if (!model) return undefined;
        return this.runtime.getLabelValue(model, p, r, c, key);
      },
    };
    const ctx = {
      runtime: runtimeView,
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
      currentTopic: (pinName, modelId) => {
        const mid = Number.isInteger(modelId) ? modelId : 0;
        if (!pinName || typeof pinName !== 'string') return '';
        const topic = this.runtime._topicFor(mid, pinName);
        return topic || '';
      },
      mqttIncoming: (topic, payload) => this.runtime.mqttIncoming(topic, payload),
      startMqttLoop: () => this.runtime.startMqttLoop(),
      hostApi: {
        docsRefreshTree: () => {
          const files = listMarkdownFiles(DOCS_ROOT, isAllowedDocRelPath);
          const tree = buildDocsTree(files);
          return { ok: true, data: { tree, fileCount: files.length } };
        },
        docsSearch: (query, limit) => {
          const maxResults = Number.isInteger(limit) && limit > 0 ? limit : 50;
          const q = String(query ?? '').trim().toLowerCase();
          if (!q) return { ok: true, data: { results: [] } };
          const files = listMarkdownFiles(DOCS_ROOT, isAllowedDocRelPath);
          const results = [];
          for (const f of files) {
            if (results.length >= maxResults) break;
            if (f.relPath.toLowerCase().includes(q)) {
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
              results.push({
                path: f.relPath,
                hit: 'content',
                snippet: text.slice(start, end).replace(/\s+/g, ' ').trim(),
              });
            }
          }
          return { ok: true, data: { results } };
        },
        docsOpenDoc: (relPath) => {
          const rel = String(relPath ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
          if (!isAllowedDocRelPath(rel)) {
            return { ok: false, code: 'invalid_target', detail: 'doc_path_not_allowed' };
          }
          const abs = safeJoin(DOCS_ROOT, rel);
          if (!abs) {
            return { ok: false, code: 'invalid_target', detail: 'doc_path_invalid' };
          }
          if (!fs.existsSync(abs)) {
            return { ok: false, code: 'invalid_target', detail: 'doc_not_found' };
          }
          try {
            const md = fs.readFileSync(abs, 'utf8');
            const html = String(getMarkdownProcessor().processSync(md));
            return { ok: true, data: { markdown: md, html } };
          } catch (err) {
            return {
              ok: false,
              code: 'exception',
              detail: String(err && err.message ? err.message : err),
            };
          }
        },
        matrixUserLogin: async (homeserverUrl, username, password) => {
          try {
            const runtimeMatrixConfig = readMatrixBootstrapConfig(this.runtime);
            const rawHomeserver = typeof homeserverUrl === 'string' ? homeserverUrl.trim() : '';
            const envHomeserver = readAuthString(process.env.MATRIX_HOMESERVER_URL);
            const internalHomeserver = readAuthString(process.env.MATRIX_HOMESERVER_INTERNAL_URL) || 'http://synapse.dongyu.svc.cluster.local:8008';
            const effectiveHomeserver = !rawHomeserver
              ? (runtimeMatrixConfig.homeserverUrl || envHomeserver || internalHomeserver || '')
              : (rawHomeserver.includes('matrix.localhost')
                ? internalHomeserver
                : (envHomeserver && rawHomeserver === envHomeserver && runtimeMatrixConfig.homeserverUrl
                  ? runtimeMatrixConfig.homeserverUrl
                  : rawHomeserver));
            const impl = this.matrixUserLoginImpl
              ? this.matrixUserLoginImpl
              : async (nextHomeserverUrl, nextUsername, nextPassword) => {
                  const session = await loginWithMatrix(nextHomeserverUrl, nextUsername, nextPassword);
                  return {
                    ok: true,
                    userId: session.userId,
                    displayName: session.displayName,
                    homeserverUrl: session.homeserverUrl,
                  };
                };
            const result = await impl(effectiveHomeserver, username, password);
            if (!result || result.ok === false) {
              return {
                ok: false,
                code: result && typeof result.code === 'string' ? result.code : 'login_failed',
                detail: result && typeof result.detail === 'string' ? result.detail : 'login_failed',
              };
            }
            return {
              ok: true,
              data: {
                userId: typeof result.userId === 'string' ? result.userId : '',
                displayName: typeof result.displayName === 'string' ? result.displayName : '',
                homeserverUrl: typeof result.homeserverUrl === 'string' ? result.homeserverUrl : '',
              },
            };
          } catch (err) {
            return {
              ok: false,
              code: 'login_failed',
              detail: String(err && err.message ? err.message : err),
            };
          }
        },
        staticListProjects: () => {
          try {
            const projects = listStaticProjects();
            return { ok: true, data: { projects } };
          } catch (err) {
            return {
              ok: false,
              code: 'exception',
              detail: String(err && err.message ? err.message : err),
            };
          }
        },
        staticUploadProjectFromMxc: (name, kind, mediaUri) => {
          const projectName = String(name ?? '').trim();
          if (!/^[a-zA-Z0-9._-]+$/.test(projectName)) {
            return { ok: false, code: 'invalid_target', detail: 'invalid_project_name' };
          }
          const uploadKind = String(kind ?? 'zip').trim();
          if (uploadKind !== 'zip' && uploadKind !== 'html') {
            return { ok: false, code: 'invalid_target', detail: 'invalid_upload_kind' };
          }
          const uri = String(mediaUri ?? '').trim();
          if (!uri) return { ok: false, code: 'invalid_target', detail: 'missing_media_uri' };
          const cached = getCachedUploadedMedia(uri);
          if (!cached || !cached.buffer || !Buffer.isBuffer(cached.buffer)) {
            return { ok: false, code: 'invalid_target', detail: 'media_not_cached' };
          }
          const buf = cached.buffer;
          try {
            const projects = staticUploadCore(projectName, uploadKind, buf);
            return { ok: true, data: { projects, uploaded: projectName } };
          } catch (err) {
            return {
              ok: false,
              code: 'exception',
              detail: String(err && err.message ? err.message : err),
            };
          }
        },
        staticDeleteProject: (name) => {
          const projectName = String(name ?? '').trim();
          if (!/^[a-zA-Z0-9._-]+$/.test(projectName)) {
            return { ok: false, code: 'invalid_target', detail: 'invalid_project_name' };
          }
          const projectRoot = safeJoin(STATIC_PROJECTS_ROOT, projectName);
          if (!projectRoot) {
            return { ok: false, code: 'invalid_target', detail: 'invalid_project_name' };
          }
          if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
            return { ok: false, code: 'invalid_target', detail: 'project_not_found' };
          }
          try {
            fs.rmSync(projectRoot, { recursive: true, force: true });
            const projects = listStaticProjects();
            return { ok: true, data: { projects, deleted: projectName } };
          } catch (err) {
            return {
              ok: false,
              code: 'exception',
              detail: String(err && err.message ? err.message : err),
            };
          }
        },
        slideImportAppFromMxc: (mediaUri) => {
          const uri = String(mediaUri ?? '').trim();
          if (!uri) {
            return { ok: false, code: 'invalid_target', detail: 'missing_media_uri' };
          }
          const cached = getCachedUploadedMedia(uri);
          if (!cached || !cached.buffer || !Buffer.isBuffer(cached.buffer)) {
            return { ok: false, code: 'invalid_target', detail: 'media_not_cached' };
          }
          try {
            const payload = parseSlideImportPayloadFromZipBuffer(cached.buffer);
            const validation = validateSlideImportPayload(payload);
            if (!validation.ok) return validation;
            const imported = materializeSlideImportPayload(this.runtime, payload, validation);
            registerImportedHostEgressBridgeFunctions(programEngine, this.runtime, imported);
            return {
              ok: true,
              data: {
                table_id: imported.tableId,
                model_id: imported.rootModelId,
                model_ref: imported.rootModelRef,
                app_name: validation.metadata.appName,
                from_user: validation.metadata.fromUser,
                to_user: validation.metadata.toUser,
                model_ids: imported.modelIds,
              },
            };
          } catch (err) {
            return {
              ok: false,
              code: 'exception',
              detail: String(err && err.message ? err.message : err),
            };
          }
        },
        slideCreateAppFromState: (stateModelId) => {
          const targetStateModelId = Number.isInteger(stateModelId) ? stateModelId : 1035;
          const stateModel = this.runtime.getModel(targetStateModelId);
          if (!stateModel) {
            return { ok: false, code: 'invalid_target', detail: 'creator_state_missing' };
          }
          const readStr = (key, fallback = '') => {
            const value = this.runtime.getLabelValue(stateModel, 0, 0, 0, key);
            const text = value == null ? '' : String(value).trim();
            return text || fallback;
          };
          const appName = readStr('create_app_name');
          const sourceWorker = readStr('create_source_worker', 'filltable-create');
          const slideSurfaceType = readStr('create_slide_surface_type', 'workspace.page');
          const headline = readStr('create_headline', 'Created by Filltable');
          const bodyText = readStr('create_body_text', '');
          if (!appName) {
            return { ok: false, code: 'invalid_target', detail: 'missing_app_name' };
          }
          if (slideSurfaceType !== 'workspace.page') {
            return { ok: false, code: 'invalid_target', detail: 'unsupported_slide_surface_type' };
          }
          try {
            const payload = buildFilltableCreatedSlidePayload({
              appName,
              sourceWorker,
              slideSurfaceType,
              headline,
              bodyText,
            });
            const validation = validateSlideImportPayload(payload);
            if (!validation.ok) return validation;
            const created = materializeSlideImportPayload(this.runtime, payload, validation);
            return {
              ok: true,
              data: {
                table_id: created.tableId,
                model_id: created.rootModelId,
                truth_model_id: created.rootModelId + 1,
                model_ref: created.rootModelRef,
                app_name: appName,
              },
            };
          } catch (err) {
            return {
              ok: false,
              code: 'exception',
              detail: String(err && err.message ? err.message : err),
            };
          }
        },
        wsSelectApp: (modelId) => {
          let selected = null;
          if (Number.isInteger(modelId)) {
            selected = modelId;
          } else if (typeof modelId === 'string' && /^-?\d+$/.test(modelId.trim())) {
            selected = Number(modelId.trim());
          }
          if (!Number.isInteger(selected)) {
            return { ok: false, code: 'invalid_target', detail: 'ws_app_selected must be int' };
          }
          return { ok: true, data: { selected } };
        },
        wsAddApp: (name) => {
          const appName = String(name ?? '').trim();
          if (!appName) {
            return { ok: false, code: 'invalid_target', detail: 'empty_app_name' };
          }
          try {
        const nextId = resolveNextWorkspaceModelId(this.runtime);
        const model = this.runtime.createModel({ id: nextId, name: appName, type: 'sliding_ui' });
        this.runtime.addLabel(model, 0, 0, 0, { k: 'app_name', t: 'str', v: appName });
        this.runtime.addLabel(model, 0, 0, 0, { k: 'slide_app_summary', t: 'str', v: `Blank workspace slide app named ${appName}.` });
        this.runtime.addLabel(model, 0, 0, 0, { k: 'slide_capable', t: 'bool', v: true });
        this.runtime.addLabel(model, 0, 0, 0, { k: 'slide_surface_type', t: 'str', v: 'workspace.page' });
        this.runtime.addLabel(model, 0, 0, 0, { k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' });
        this.runtime.addLabel(model, 0, 0, 0, { k: 'ui_root_node_id', t: 'str', v: 'ws_added_root' });
        this.runtime.addLabel(model, 0, 0, 0, { k: 'deletable', t: 'bool', v: true });
        this.runtime.addLabel(model, 0, 0, 0, { k: 'ws_deleted', t: 'bool', v: false });
        this.runtime.addLabel(model, 2, 0, 0, { k: 'ui_node_id', t: 'str', v: 'ws_added_root' });
        this.runtime.addLabel(model, 2, 0, 0, { k: 'ui_component', t: 'str', v: 'Text' });
        this.runtime.addLabel(model, 2, 0, 0, { k: 'ui_text', t: 'str', v: appName });
        return { ok: true, data: { model_id: nextId, name: appName } };
          } catch (err) {
            return {
              ok: false,
              code: 'exception',
              detail: String(err && err.message ? err.message : err),
            };
          }
        },
        wsDeleteApp: (modelId) => {
          let targetId = null;
          if (Number.isInteger(modelId)) {
            targetId = modelId;
          } else if (typeof modelId === 'string' && /^-?\d+$/.test(modelId.trim())) {
            targetId = Number(modelId.trim());
          }
          if (!Number.isInteger(targetId)) {
            return { ok: false, code: 'invalid_target', detail: 'invalid_model_id' };
          }
          if (targetId < 100) {
            return { ok: false, code: 'protected_model', detail: 'protected_model' };
          }
          const targetModel = this.runtime.getModel(targetId);
          if (!targetModel) {
            return { ok: false, code: 'invalid_target', detail: 'model_not_found' };
          }
          const deletable = targetModel.getCell(0, 0, 0).labels.get('deletable');
          if (!deletable || deletable.v !== true) {
            return { ok: false, code: 'protected_model', detail: 'protected_model' };
          }
          try {
            const removed = removeImportedBundleFromRuntime(this.runtime, targetId);
            if (!removed.ok) {
              return { ok: false, code: 'invalid_target', detail: removed.code };
            }
            if (programEngine && Array.isArray(removed.systemLabels)) {
              const sys = firstSystemModel(this.runtime);
              for (const key of removed.systemLabels) {
                programEngine.functions.delete(key);
                if (sys && sys.functions instanceof Map) {
                  sys.functions.delete(key);
                }
              }
            }
            const runtimePersister = this.runtime && this.runtime.persistence ? this.runtime.persistence : null;
            if (runtimePersister && runtimePersister.db && typeof runtimePersister.db.prepare === 'function') {
              const stmt = runtimePersister.db.prepare("delete from mt_data where table_id = 'host' and mt_id = ?");
              for (const modelIdToDelete of removed.modelIds) {
                stmt.run(modelIdToDelete);
              }
            }
            return { ok: true, data: { model_id: targetId, removed_model_ids: removed.modelIds } };
          } catch (err) {
            return {
              ok: false,
              code: 'exception',
              detail: String(err && err.message ? err.message : err),
            };
          }
        },
        wsRefreshCatalog: () => {
          if (typeof this._wsRefreshCatalog !== 'function') {
            return { ok: false, code: 'invalid_target', detail: 'workspace_refresh_unavailable' };
          }
          try {
            this._wsRefreshCatalog();
            return { ok: true, data: { refreshed: true } };
          } catch (err) {
            return {
              ok: false,
              code: 'exception',
              detail: String(err && err.message ? err.message : err),
            };
          }
        },
        matrixDebugRefresh: (subjectId) => {
          try {
            if (typeof this._matrixDebugRefresh !== 'function') {
              return { ok: false, code: 'invalid_target', detail: 'matrix_debug_refresh_unavailable' };
            }
            return this._matrixDebugRefresh(subjectId);
          } catch (err) {
            return {
              ok: false,
              code: 'exception',
              detail: String(err && err.message ? err.message : err),
            };
          }
        },
        matrixDebugClearTrace: (subjectId) => {
          try {
            if (typeof this._matrixDebugClearTrace !== 'function') {
              return { ok: false, code: 'invalid_target', detail: 'matrix_debug_clear_unavailable' };
            }
            return this._matrixDebugClearTrace(subjectId);
          } catch (err) {
            return {
              ok: false,
              code: 'exception',
              detail: String(err && err.message ? err.message : err),
            };
          }
        },
        matrixDebugSummarize: (subjectId) => {
          try {
            if (typeof this._matrixDebugSummarize !== 'function') {
              return { ok: false, code: 'invalid_target', detail: 'matrix_debug_summarize_unavailable' };
            }
            return this._matrixDebugSummarize(subjectId);
          } catch (err) {
            return {
              ok: false,
              code: 'exception',
              detail: String(err && err.message ? err.message : err),
            };
          }
        },
        llmFilltablePreview: async (input) => {
          const inObj = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
          const promptText = typeof inObj.prompt === 'string' ? inObj.prompt.trim() : '';
          if (!promptText) {
            return { ok: false, code: 'invalid_target', detail: 'empty_prompt' };
          }

          const availability = await probeLlmPromptAvailability(this.runtime);
          overwriteLlmPromptAvailabilityState(this.runtime, availability);
          if (!availability.available) {
            return { ok: false, code: availability.code, detail: availability.detail };
          }
          const llmCfg = availability.cfg;

          const policy = readFilltablePolicy(this.runtime);
          const schemaModel = firstSystemModel(this.runtime);
          const outputSchema = schemaModel
            ? this.runtime.getLabelValue(schemaModel, 0, 0, 0, 'llm_filltable_output_schema')
            : null;
          const promptTemplate = readSystemPromptTemplate(this.runtime, 'llm_filltable_prompt_template', DEFAULT_LLM_FILLTABLE_PROMPT_TEMPLATE);
          const llmPrompt = renderPromptTemplate(promptTemplate, {
            prompt_text: promptText,
            policy_json: safeJsonStringify(policy, '{}'),
            output_schema_json: safeJsonStringify(outputSchema, '{}'),
            available_model_ids_json: safeJsonStringify(listPositiveModelIds(this.runtime), '[]'),
            model_inventory_json: safeJsonStringify(buildFilltableModelInventoryFromSnapshot(this.runtime.snapshot(), 128), '[]'),
          });
          const llmResult = await this.llmInfer({
            baseUrl: llmCfg.base_url,
            model: llmCfg.model,
            prompt: llmPrompt,
            timeoutMs: llmCfg.timeout_ms,
            temperature: llmCfg.temperature,
            maxTokens: llmCfg.max_tokens,
          });
          if (!llmResult || llmResult.ok !== true) {
            return llmResult || { ok: false, code: 'llm_unavailable', detail: 'llm_unavailable' };
          }

          const parsed = parseLlmFilltableResult(llmResult.data && llmResult.data.response ? llmResult.data.response : '');
          if (!parsed.ok) return parsed;
          if (parsed.candidate_changes.length > policy.max_changes_per_apply) {
            return {
              ok: false,
              code: 'too_many_changes',
              detail: `max_changes_per_apply=${policy.max_changes_per_apply}`,
            };
          }

          const previewed = previewCandidateChangesByOwner(parsed.candidate_changes, this.runtime, policy);
          const previewId = createFilltablePreviewId();
          const previewDigest = buildFilltableDigest(previewed.accepted_changes);
          const proposal = normalizeFilltableProposal(
            parsed.proposal,
            previewed.accepted_changes,
            previewed.rejected_changes,
          );

          return {
            ok: true,
            data: {
              preview_id: previewId,
              preview_digest: previewDigest,
              prompt: promptText,
              proposal,
              accepted_changes: previewed.accepted_changes,
              rejected_changes: previewed.rejected_changes,
              owner_plan: previewed.owner_plan,
              stats: previewed.stats,
              confidence: parsed.confidence,
              reasoning: parsed.reasoning,
              llm_used: true,
              llm_model: llmResult.data && llmResult.data.model ? llmResult.data.model : llmCfg.model,
              created_at: Date.now(),
              policy: previewed.policy,
            },
          };
        },
        llmFilltableApply: async (input) => {
          const inObj = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
          const requestedPreviewId = typeof inObj.requested_preview_id === 'string'
            ? inObj.requested_preview_id.trim()
            : '';
          const latestPreviewId = typeof inObj.latest_preview_id === 'string'
            ? inObj.latest_preview_id.trim()
            : '';
          const lastAppliedPreviewId = typeof inObj.last_applied_preview_id === 'string'
            ? inObj.last_applied_preview_id.trim()
            : '';
          const guard = evaluateApplyPreviewGuard({
            requested_preview_id: requestedPreviewId,
            latest_preview_id: latestPreviewId,
            last_applied_preview_id: lastAppliedPreviewId,
          });
          if (!guard.ok) {
            return { ok: false, code: guard.code, detail: guard.detail };
          }

          const previewPayload = parseJsonObjectOrNull(inObj.preview_payload) || {};
          const legacyAcceptedKey = ['accepted', 'records'].join('_');
          if (Object.prototype.hasOwnProperty.call(previewPayload, legacyAcceptedKey)) {
            return { ok: false, code: 'legacy_preview_contract', detail: 'preview_requires_accepted_changes' };
          }
          const acceptedFromPreview = Array.isArray(previewPayload.accepted_changes) ? previewPayload.accepted_changes : [];
          if (acceptedFromPreview.length === 0) {
            return { ok: false, code: 'nothing_to_apply', detail: 'no_accepted_changes' };
          }

          const policy = readFilltablePolicy(this.runtime);
          if (acceptedFromPreview.length > policy.max_changes_per_apply) {
            return {
              ok: false,
              code: 'too_many_changes',
              detail: `max_changes_per_apply=${policy.max_changes_per_apply}`,
            };
          }
          const validation = validateFilltableCandidateChanges(acceptedFromPreview, policy);
          const applyRejected = validation.rejected_changes.slice();
          const appliedChanges = [];

          for (let i = 0; i < validation.accepted_changes.length; i += 1) {
            const change = validation.accepted_changes[i];
            const resolved = resolveFilltableOwner(change, this.runtime);
            if (!resolved.ok) {
              applyRejected.push({ index: i, code: resolved.code, detail: resolved.detail, change });
              continue;
            }
            const materialized = materializeFilltableChange(change);
            if (!materialized.ok) {
              applyRejected.push({ index: i, code: materialized.code, detail: materialized.detail, change });
              continue;
            }
            try {
              if (materialized.operation.op === 'add_label') {
                this.runtime.addLabel(resolved.model, materialized.operation.p, materialized.operation.r, materialized.operation.c, {
                  k: materialized.operation.k,
                  t: materialized.operation.t,
                  v: materialized.operation.v,
                });
                appliedChanges.push({
                  ...change,
                  owner_id: resolved.owner_id,
                  owner_kind: resolved.owner_kind,
                });
              } else if (materialized.operation.op === 'rm_label') {
                this.runtime.rmLabel(
                  resolved.model,
                  materialized.operation.p,
                  materialized.operation.r,
                  materialized.operation.c,
                  materialized.operation.k,
                );
                appliedChanges.push({
                  ...change,
                  owner_id: resolved.owner_id,
                  owner_kind: resolved.owner_kind,
                });
              }
            } catch (err) {
              applyRejected.push({
                index: i,
                code: 'runtime_error',
                detail: String(err && err.message ? err.message : err),
                change,
              });
            }
          }

          if (appliedChanges.length === 0) {
            return {
              ok: false,
              code: 'apply_failed',
              detail: 'no_change_applied',
              data: {
                requested_preview_id: requestedPreviewId,
                preview_digest: buildFilltableDigest(validation.accepted_changes),
                applied_count: 0,
                rejected_count: applyRejected.length,
                rejected_changes: applyRejected,
                applied_at: Date.now(),
              },
            };
          }

          return {
            ok: true,
            data: {
              requested_preview_id: requestedPreviewId,
              preview_digest: buildFilltableDigest(validation.accepted_changes),
              applied_count: appliedChanges.length,
              rejected_count: applyRejected.length,
              applied_changes: appliedChanges,
              rejected_changes: applyRejected,
              applied_at: Date.now(),
            },
          };
        },
        llmInfer: async (prompt, options) => {
          const dispatchCfg = readLlmDispatchConfig(this.runtime);
          const opts = options && typeof options === 'object' ? options : {};
          const systemPrompt = typeof opts.system_prompt === 'string'
            ? opts.system_prompt
            : (typeof opts.systemPrompt === 'string' ? opts.systemPrompt : '');
          return this.llmInfer({
            baseUrl: typeof opts.base_url === 'string' ? opts.base_url : dispatchCfg.base_url,
            model: typeof opts.model === 'string' ? opts.model : dispatchCfg.model,
            prompt: typeof prompt === 'string' ? prompt : String(prompt ?? ''),
            systemPrompt,
            timeoutMs: Number.isInteger(opts.timeout_ms) ? opts.timeout_ms : dispatchCfg.timeout_ms,
            temperature: Number.isFinite(opts.temperature) ? opts.temperature : dispatchCfg.temperature,
            maxTokens: Number.isInteger(opts.max_tokens) ? opts.max_tokens : dispatchCfg.max_tokens,
          });
        },
      },
    };
    if (this.runtime && this.runtime.hostApi) {
      ctx.hostApi = Object.assign({}, this.runtime.hostApi, ctx.hostApi);
    }
    try {
      const fn = new Function('ctx', code);
      return fn(ctx);
    } catch (err) {
      const sys = firstSystemModel(this.runtime);
      if (sys) {
        this.runtime.addLabel(sys, 0, 0, 0, {
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
    }
  }

  processEventsSnapshot(eventEndExclusive) {
    const events = this.runtime.eventLog.list();
    const end = Math.min(Number.isInteger(eventEndExclusive) ? eventEndExclusive : events.length, events.length);
    const scheduledBusOut = new Set();
    for (; this.eventCursor < end; this.eventCursor += 1) {
      const event = events[this.eventCursor];
      if (event.op !== 'add_label') continue;

      // UI event in mailbox -> trigger mapped forward function(s)
      if (event.cell && event.cell.model_id === EDITOR_MODEL_ID && 
          event.cell.p === 0 && event.cell.r === 0 && event.cell.c === 1 &&
          event.label && event.label.k === BUS_EVENT_KEY && event.label.v) {
        const sys = firstSystemModel(this.runtime);
        const triggerMap = sys
          ? this.runtime.getLabelValue(sys, 0, 0, 0, 'event_trigger_map')
          : null;
        const triggerCandidates = triggerMap && typeof triggerMap === 'object'
          ? triggerMap[event.label.k]
          : null;
        const triggers = Array.isArray(triggerCandidates)
          ? triggerCandidates.filter((name) => typeof name === 'string' && name.trim().length > 0)
          : [];

        let triggered = 0;
        if (triggers.length > 0) {
          for (const funcName of triggers) {
            if (sys && sys.hasFunction(funcName)) {
              this.runtime.intercepts.record('run_func', { func: funcName });
              triggered += 1;
            }
          }
        }

        continue;
      }

      if (event.cell && event.cell.model_id === -10 &&
          event.cell.p === 0 && event.cell.r === 0 && event.cell.c === 0 &&
          event.label && event.label.k === 'mgmt_bus_console_refresh_intent' &&
          event.label.t === 'pin.in') {
        if (typeof this._mgmtBusConsoleRefreshChannels === 'function') {
          const requestMatrixSession = this.currentRequestMatrixSessionProvided
            ? this.currentRequestMatrixSession
            : undefined;
          this.trackMatrixHostAction(this._mgmtBusConsoleRefreshChannels(requestMatrixSession)
            .then(() => {
              if (typeof this.onSnapshotChanged === 'function') this.onSnapshotChanged();
            })
            .catch((err) => {
              console.warn('[ProgramModelEngine] mgmt_bus_console channel refresh failed:', err && err.message ? err.message : err);
            }));
        }
        continue;
      }

      if (event.cell && event.cell.model_id === -10 &&
          event.cell.p === 0 && event.cell.r === 0 && event.cell.c === 0 &&
          event.label && event.label.k === 'mgmt_bus_console_intent' &&
          event.label.t === 'pin.in') {
        if (event.label.v === null || event.label.v === undefined) {
          continue;
        }
        const consoleModel = this.runtime.getModel(MGMT_BUS_CONSOLE_MODEL_ID);
        const packetResult = buildMgmtBusConsoleMatrixPacket(event.label.v, {
          runtime: this.runtime,
          peerUserId: this.matrixDmPeerUserId,
        });
        if (!packetResult || packetResult.ok !== true) {
          if (consoleModel) {
            this.runtime.addLabel(consoleModel, 0, 0, 0, {
              k: 'message_status',
              t: 'str',
              v: packetResult && packetResult.code ? packetResult.code : 'send_rejected',
            });
          }
          const sys = firstSystemModel(this.runtime);
          if (sys) {
            this.runtime.addLabel(sys, 0, 0, 0, {
              k: 'mgmt_bus_console_error',
              t: 'json',
              v: packetResult || { ok: false, code: 'send_rejected' },
            });
          }
          continue;
        }
        const packet = packetResult.data;
        const businessPayload = readTemporaryPayloadJson(packet.payload, 'payload') || [];
        if (consoleModel) {
          this.runtime.addLabel(consoleModel, 0, 0, 0, { k: 'message_status', t: 'str', v: 'sending' });
          this.runtime.addLabel(consoleModel, 0, 0, 0, { k: 'last_sent_text', t: 'str', v: readTemporaryPayloadString(businessPayload, 'message_text') });
          this.runtime.addLabel(consoleModel, 0, 0, 0, { k: 'target_user_id', t: 'str', v: readTemporaryPayloadString(businessPayload, 'target_user_id') });
        }
        const model0 = this.runtime.getModel(0);
        const busValue = pinPayloadPacketToBusValue(packet);
        if (!model0 || !busValue) {
          if (consoleModel) this.runtime.addLabel(consoleModel, 0, 0, 0, { k: 'message_status', t: 'str', v: 'send_rejected' });
          continue;
        }
        this.runtime.addLabel(model0, 0, 0, 0, {
          k: 'mgmt_bus_console_mb_out',
          t: 'pin.bus.mb.out',
          v: busValue,
        });
        continue;
      }

      if (event.cell && event.cell.model_id === MATRIX_SUITE_APP_MODEL_ID &&
          event.cell.p === 0 && event.cell.r === 0 && event.cell.c === 0 &&
          event.label && event.label.k === 'matrix_suite_host_action' &&
          event.label.t === 'json' && event.label.v) {
        const requestMatrixSession = this.currentRequestMatrixSessionProvided
          ? this.currentRequestMatrixSession
          : undefined;
        this.trackMatrixHostAction(this.runMatrixSuiteHostAction(event.label.v, requestMatrixSession)
          .then(() => {
            if (typeof this.onSnapshotChanged === 'function') this.onSnapshotChanged();
          })
          .catch((err) => {
            this.matrixSuiteWriteRoot('connection_status', 'str', 'error');
            this.matrixSuiteWriteRoot('status_text', 'str', `ERR matrix_suite_host_exception: ${err && err.message ? err.message : String(err)}`);
          }));
        continue;
      }

      if (event.cell && event.cell.model_id === MATRIX_CHAT_APP_MODEL_ID &&
          event.cell.p === 0 && event.cell.r === 0 && event.cell.c === 0 &&
          event.label && event.label.k === 'matrix_chat_host_action' &&
          event.label.t === 'json' && event.label.v) {
        const requestMatrixSession = this.currentRequestMatrixSessionProvided
          ? this.currentRequestMatrixSession
          : undefined;
        this.trackMatrixHostAction(this.runMatrixChatHostAction(event.label.v, requestMatrixSession)
          .then(() => {
            if (typeof this.onSnapshotChanged === 'function') this.onSnapshotChanged();
          })
          .catch((err) => {
            this.matrixChatWriteRoot('connection_status', 'str', 'error');
            this.matrixChatWriteRoot('status_text', 'str', `ERR matrix_chat_host_exception: ${err && err.message ? err.message : String(err)}`);
          }));
        continue;
      }

      // Generic dual-bus model: bus_event at Cell(model_id, 0, 0, 2) → trigger forward function
      // Driven by `dual_bus_model` label on the model's Cell(0,0,0)
      if (event.cell && event.cell.model_id > 0 &&
          event.cell.p === 0 && event.cell.r === 0 && event.cell.c === 2 &&
          event.label && event.label.k === 'bus_event' && event.label.v) {
        const targetModel = this.runtime.getModel(event.cell.model_id);
        if (targetModel) {
          const dbLabel = this.runtime.getCell(targetModel, 0, 0, 0).labels.get('dual_bus_model');
          if (dbLabel && dbLabel.v && typeof dbLabel.v === 'object' && dbLabel.v.bus_event_func) {
            const funcName = dbLabel.v.bus_event_func;
            const sys = firstSystemModel(this.runtime);
            if (sys && sys.hasFunction(funcName)) {
              this.runtime.intercepts.record('run_func', { func: funcName });
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

    }
    this.schedulePendingModel0Egress(scheduledBusOut);
  }

  writeSplitBusOutError(code, detail, key, label) {
    const model0 = this.runtime.getModel(0);
    if (!model0) return;
    this.runtime.addLabel(model0, 0, 0, 0, {
      k: 'split_bus_out_error',
      t: 'json',
      v: {
        code,
        detail,
        pin: key || '',
        pin_type: label && label.t ? label.t : '',
        ts: Date.now(),
      },
    });
  }

  schedulePendingModel0Egress(alreadyScheduled = new Set()) {
    const model0 = this.runtime.getModel(0);
    if (!model0) return;
    const rootCell = this.runtime.getCell(model0, 0, 0, 0);
    for (const [key, label] of rootCell.labels.entries()) {
      const packet = label && isSplitBusOutLabelType(label.t) && typeof this.runtime._pinBusOutValueToExternalPayload === 'function'
        ? this.runtime._pinBusOutValueToExternalPayload(label.v)
        : null;
      if (!label || !isSplitBusOutLabelType(label.t) || !packet || typeof packet !== 'object' || packet.type !== 'pin_payload') {
        continue;
      }
      const opId = readTemporaryPayloadString(packet.payload, 'op_id', readTemporaryPayloadString(packet.payload, '__mt_request_id')).trim();
      const messageRole = readTemporaryPayloadString(packet.payload, 'message_role', 'unknown').trim() || 'unknown';
      const opIdentity = opId
        ? `${messageRole}:${opId}`
        : `${messageRole}:${readTemporaryPayloadString(packet.payload, 'endpoint_worker_id')}:${readTemporaryPayloadInt(packet.payload, 'endpoint_model_id')}:${readTemporaryPayloadString(packet.payload, 'endpoint_pin')}`;
      const bridgeKey = `${label.t}:${key}:${opIdentity}`;
      if (alreadyScheduled.has(bridgeKey)) continue;
      if (this.bridgedBusOutPorts.get(key) === opIdentity) continue;
      if (this.pendingBusOutPorts.get(key) === opIdentity) continue;
      const previousFailure = this.failedBusOutPorts.get(key);
      if (previousFailure && previousFailure.opIdentity === opIdentity) {
        if (label.t === 'pin.bus.cb.out') {
          const mqttReady = this.controlBusClient && this.controlBusClient.connected;
          const sameRejectingAdapter = previousFailure.adapter === this.controlBusClient;
          if (previousFailure.code === 'missing_split_bus_mqtt_adapter' && !mqttReady) continue;
          if (previousFailure.code === 'split_bus_mqtt_publish_failed' && sameRejectingAdapter) continue;
        } else {
          const matrixReady = this.matrixAdapter && this.matrixRoomId && this.matrixDmPeerUserId;
          const sameRejectingAdapter = previousFailure.adapter === this.matrixAdapter;
          if (previousFailure.code === 'missing_split_bus_matrix_adapter' && !matrixReady) continue;
          if (previousFailure.code === 'split_bus_matrix_publish_failed' && sameRejectingAdapter) continue;
        }
      }
      alreadyScheduled.add(bridgeKey);
      const markSuccess = () => {
        this.pendingBusOutPorts.delete(key);
        this.failedBusOutPorts.delete(key);
        this.bridgedBusOutPorts.set(key, opIdentity);
        const model0ForErrorClear = this.runtime.getModel(0);
        if (model0ForErrorClear) {
          this.runtime.rmLabel(model0ForErrorClear, 0, 0, 0, 'split_bus_out_error');
        }
      };
      const markFailure = (code, detail, adapter = null) => {
        this.pendingBusOutPorts.delete(key);
        this.failedBusOutPorts.set(key, {
          opIdentity,
          code,
          adapter,
        });
        this.writeSplitBusOutError(code, detail, key, label);
      };
      try {
        const maybePromise = label.t === 'pin.bus.cb.out'
          ? this.sendControlBus(readTemporaryPayloadString(packet.payload, 'topic').trim(), packet)
          : this.sendMatrix(packet);
        if (!maybePromise) {
          if (label.t === 'pin.bus.cb.out') {
            markFailure('missing_split_bus_mqtt_adapter', 'Control bus adapter, topic, or MQTT connection is required', this.controlBusClient);
          } else {
            markFailure('missing_split_bus_matrix_adapter', 'sendMatrix returned no result', this.matrixAdapter);
          }
          continue;
        }
        if (typeof maybePromise.then === 'function') {
          this.pendingBusOutPorts.set(key, opIdentity);
          maybePromise
            .then((result) => {
              if (result === null || result === false) {
                if (label.t === 'pin.bus.cb.out') {
                  markFailure('missing_split_bus_mqtt_adapter', 'Control bus adapter, topic, or MQTT connection is required', this.controlBusClient);
                } else {
                  markFailure('missing_split_bus_matrix_adapter', 'Matrix adapter, room, or peer user is required', this.matrixAdapter);
                }
                return;
              }
              markSuccess();
            })
            .catch((err) => {
              if (label.t === 'pin.bus.cb.out') {
                markFailure(
                  'split_bus_mqtt_publish_failed',
                  err && err.message ? err.message : String(err),
                  this.controlBusClient,
                );
              } else {
                markFailure(
                  'split_bus_matrix_publish_failed',
                  err && err.message ? err.message : String(err),
                  this.matrixAdapter,
                );
              }
            });
          continue;
        }
        markSuccess();
      } catch (err) {
        if (label.t === 'pin.bus.cb.out') {
          markFailure(
            'split_bus_mqtt_publish_failed',
            err && err.message ? err.message : String(err),
            this.controlBusClient,
          );
        } else {
          markFailure(
            'split_bus_matrix_publish_failed',
            err && err.message ? err.message : String(err),
            this.matrixAdapter,
          );
        }
      }
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
    await sleepMs(0);
    this.schedulePendingModel0Egress(new Set());
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
    if (typeof this.runtime.isRunLoopActive === 'function' && !this.runtime.isRunLoopActive()) {
      return Promise.resolve();
    }

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
        // Host actions perform external Matrix/management-bus I/O and report
        // completion through their own status writes + snapshot callbacks.
        // Waiting here makes every unrelated UI event inherit external network
        // latency, because submitEnvelope and tick are serialized globally.

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
      runtime.applyPatch(negativeOnlyPatch, { allowCreateModel: true, trustedBootstrap: true });
    }
  }
}

function loadFullModelPatches(runtime, dirPath, fileNames) {
  if (!dirPath) return;
  for (const fileName of fileNames) {
    const filePath = path.join(dirPath, fileName);
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const patches = Array.isArray(parsed) ? parsed : [parsed];
    for (const patch of patches) {
      if (!patch || !Array.isArray(patch.records)) continue;
      runtime.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
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

function countPositiveModels(runtime) {
  let count = 0;
  for (const id of runtime.models.keys()) {
    if (Number.isInteger(id) && id > 0) count += 1;
  }
  return count;
}

const DIRECT_MODEL_MUTATION_ACTIONS = new Set([
  'label_add',
  'label_update',
  'label_remove',
  'cell_clear',
  'submodel_create',
  'datatable_remove_label',
]);

function isDirectModelMutationAction(action) {
  return typeof action === 'string' && DIRECT_MODEL_MUTATION_ACTIONS.has(action);
}

function isMgmtBusConsoleLocalStateTarget(target) {
  return target
    && target.model_id === MGMT_BUS_CONSOLE_MODEL_ID
    && target.p === 0
    && target.r === 0
    && target.c === 0
    && MGMT_BUS_CONSOLE_LOCAL_STATE_KEYS.has(target.k);
}

function isUiLocalMutableTarget(target, action = '') {
  const modelId = target && Number.isInteger(target.model_id) ? target.model_id : null;
  return modelId === EDITOR_STATE_MODEL_ID
    || modelId === LOGIN_MODEL_ID
    || modelId === GALLERY_STATE_MODEL_ID
    || (action === 'label_update' && isMgmtBusConsoleLocalStateTarget(target));
}

function createServerState(options) {
  const dbPath = options && options.dbPath ? String(options.dbPath) : null;
  const matrixUserLoginImpl = options && typeof options.matrixUserLoginImpl === 'function'
    ? options.matrixUserLoginImpl
    : null;
  const matrixSuiteMatrixImpl = options && options.matrixSuiteMatrixImpl && typeof options.matrixSuiteMatrixImpl === 'object'
    ? options.matrixSuiteMatrixImpl
    : null;
  const mgmtBusConsoleJoinedRoomsImpl = options && typeof options.mgmtBusConsoleJoinedRoomsImpl === 'function'
    ? options.mgmtBusConsoleJoinedRoomsImpl
    : null;
  const runtime = new ModelTableRuntime();
  runtime.addLabel(runtime.getModel(0), 0, 0, 0, {
    k: 'sys_worker_id',
    t: 'worker.id',
    v: process.env.DY_UI_SERVER_V1N_ID || DEFAULT_UI_SERVER_V1N_ID,
  });
  runtime.addLabel(runtime.getModel(0), 0, 0, 0, { k: 'sys_worker_role', t: 'worker.role', v: 'DEM' });
  const assetRoot = resolvePersistedAssetRoot();
  const bootstrapGeneratedKeys = new Set([
    'matrix_room_id',
    'matrix_server',
    'matrix_user',
    'matrix_passwd',
    'matrix_token',
    'matrix_contuser',
  ]);
  let lastBusEventOpId = '';
  let busEventErrorValue = null;
  let mgmtBusConsoleJoinedRooms = [];
  let mgmtBusConsoleChannelDiscovery = {
    status: 'pending',
    text: '',
  };

  ensureDir(DOCS_ROOT);
  ensureDir(STATIC_PROJECTS_ROOT);
  if (dbPath) {
    ensureDir(path.dirname(dbPath));
  }

  let persister = null;
  if (dbPath) {
    persister = createSqlitePersister({ dbPath });
    if (typeof persister.setEnabled === 'function') persister.setEnabled(false);
    runtime.setPersistence(persister);
  }

  if (persister && typeof persister.setEnabled === 'function') persister.setEnabled(false);

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

  // ── Model -3: Login Form (schema/data now seeded from login_catalog_ui.json) ──────────────────────────
  if (!runtime.getModel(LOGIN_MODEL_ID)) {
    runtime.createModel({ id: LOGIN_MODEL_ID, name: 'login_form', type: 'ui' });
  }

  const systemModelsDir = new URL('../worker-base/system-models/', import.meta.url).pathname;
  if (assetRoot) {
    applyPersistedAssetEntries(runtime, {
      assetRoot,
      scope: 'ui-server',
      authority: 'authoritative',
      kind: 'patch',
      phases: ['00-system-base', '10-system-negative', '30-system-positive'],
      applyOptions: { allowCreateModel: true, trustedBootstrap: true },
    });
    loadFullModelPatches(runtime, systemModelsDir, ['sliding_flow_shell_ui.json']);
  } else {
    loadSystemModelPatches(runtime, systemModelsDir);
    loadFullModelPatches(runtime, systemModelsDir, ['server_config.json']);
    const positiveModelCountBeforeSeed = countPositiveModels(runtime);
    if (positiveModelCountBeforeSeed === 0) {
      loadFullModelPatches(runtime, systemModelsDir, [
        'workspace_positive_models.json',
        'doc_page_filltable_example_minimal.json',
        'slide_app_provider_docs_ui.json',
        'test_model_100_ui.json',
        'workspace_manager_asset_manager_ui.json',
      ]);
    } else {
      console.log(`[createServerState] skip positive seed patches (existing_positive_models=${positiveModelCountBeforeSeed})`);
    }
    loadFullModelPatches(runtime, systemModelsDir, ['runtime_hierarchy_mounts.json']);
  }

  const envPatch = readModelTablePatchFromEnv();
  if (envPatch) {
    runtime.applyPatch(envPatch, { allowCreateModel: true, trustedBootstrap: true });
  }

  if (dbPath && fs.existsSync(dbPath)) {
    const sqliteLoadResult = loadProgramModelFromSqlite({
      runtime,
      dbPath,
      includeModelId: (modelId) => Number.isInteger(modelId) && modelId >= 0,
      includeRecord: ({ table_id: tableId, modelId, k }) => !(
        tableId === 'host'
        && modelId === 0
        && bootstrapGeneratedKeys.has(String(k || ''))
      ),
    });
    if (sqliteLoadResult && sqliteLoadResult.rows > 0) {
      withRuntimePersistenceDisabled(runtime, () => {
        reapplyAuthoritativePositiveSurface(runtime, { assetRoot, systemModelsDir });
      });
    }
  }
  materializeDeclaredHostEgressAdapters(runtime);
  runtime.setRuntimeMode('edit');

  ensureStateLabel(runtime, 'selected_model_id', 'str', '0');
  ensureStateLabel(runtime, 'draft_p', 'str', '0');
  ensureStateLabel(runtime, 'draft_r', 'str', '0');
  ensureStateLabel(runtime, 'draft_c', 'str', '0');
  ensureStateLabel(runtime, 'draft_k', 'str', 'title');
  ensureStateLabel(runtime, 'draft_t', 'str', 'str');
  ensureStateLabel(runtime, 'draft_v_text', 'str', 'Hello');
  ensureStateLabel(runtime, 'draft_v_int', 'int', 0);
  ensureStateLabel(runtime, 'draft_v_bool', 'bool', false);
  ensureStateLabel(runtime, 'model100_input_draft', 'str', '');


  ensureStateLabel(runtime, 'dt_filter_model_query', 'str', '');
  ensureStateLabel(runtime, 'dt_filter_p', 'str', '');
  ensureStateLabel(runtime, 'dt_filter_r', 'str', '');
  ensureStateLabel(runtime, 'dt_filter_c', 'str', '');
  ensureStateLabel(runtime, 'dt_filter_ktv', 'str', '');
  ensureStateLabel(runtime, 'ui_page', 'str', 'desktop');
  ensureStateLabel(runtime, DESKTOP_FOREGROUND_APP_LABEL, 'json', null);
  ensureStateLabel(runtime, DESKTOP_APP_DETAIL_DRAWER_OPEN_LABEL, 'bool', false);
  ensureStateLabel(runtime, DESKTOP_APP_VIEW_MODE_LABEL, 'str', 'cards');
  ensureStateLabel(runtime, DESKTOP_APP_MANAGE_MODE_LABEL, 'bool', false);
  ensureStateLabel(runtime, DESKTOP_DELETE_CONFIRM_OPEN_LABEL, 'bool', false);
  ensureStateLabel(runtime, 'desktop_delete_confirm_title', 'str', '删除滑动 App？');
  ensureStateLabel(runtime, 'desktop_delete_confirm_text', 'str', '');
  ensureStateLabel(runtime, DESKTOP_DELETE_CONFIRM_TARGET_LABEL, 'json', null);
  ensureStateLabel(runtime, DESKTOP_DELETE_RESULT_OPEN_LABEL, 'bool', false);
  ensureStateLabel(runtime, 'desktop_delete_result_title', 'str', '删除成功');
  ensureStateLabel(runtime, 'desktop_delete_result_text', 'str', '');
  ensureStateLabel(runtime, DESKTOP_TASK_STACK_LABEL, 'json', []);
  ensureStateLabel(runtime, DESKTOP_TASK_SWITCHER_OPEN_LABEL, 'bool', false);
  ensureStateLabel(runtime, 'dt_pause_sse', 'bool', false);
  ensureStateLabel(runtime, 'home_selected_label_text', 'str', '');
  ensureStateLabel(runtime, 'home_status_text', 'str', '');
  ensureStateLabel(runtime, 'home_form_mode', 'str', 'edit');
  ensureStateLabel(runtime, 'home_edit_dialog_title', 'str', 'Edit Label');
  ensureStateLabel(runtime, 'home_delete_confirm_open', 'bool', false);
  ensureStateLabel(runtime, 'home_delete_confirm_text', 'str', '');
  ensureStateLabel(runtime, 'home_delete_target_json', 'json', null);
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
  ensureStateLabel(runtime, 'docs_render_markdown', 'str', '');
  ensureStateLabel(runtime, 'docs_render_html', 'str', '');

  // Static projects page state.
  // Upload-related labels are volatile (single-operation data); force-reset on startup
  // to prevent stale kind/b64 from a previous session causing wrong code path.
  ensureStateLabel(runtime, 'static_project_name', 'str', '');
  ensureStateLabel(runtime, 'static_media_uri', 'str', '');
  ensureStateLabel(runtime, 'static_media_name', 'str', '');
  const stateModelForReset = runtime.getModel(EDITOR_STATE_MODEL_ID);
  runtime.addLabel(stateModelForReset, 0, 0, 0, { k: 'static_upload_kind', t: 'str', v: 'zip' });
  runtime.addLabel(stateModelForReset, 0, 0, 0, { k: 'static_zip_b64', t: 'str', v: '' });
  runtime.addLabel(stateModelForReset, 0, 0, 0, { k: 'static_html_b64', t: 'str', v: '' });
  ensureStateLabel(runtime, 'static_status', 'str', '');
  ensureStateLabel(runtime, 'static_projects_json', 'json', []);

  // Workspace (sliding UI) state.
  ensureStateLabel(runtime, 'ws_app_selected', 'int', 0);
  ensureStateLabel(runtime, 'ws_app_next_id', 'int', 1001);
  ensureStateLabel(runtime, FLOW_SHELL_TAB_LABEL, 'str', FLOW_SHELL_DEFAULT_TAB);
  for (const label of deriveSlidingFlowShellProjectionLabels(null, null)) {
    ensureStateLabel(runtime, label.k, label.t, label.v);
  }
  ensureStateLabel(runtime, 'ws_new_app_name', 'str', '');
  ensureStateLabel(runtime, 'ws_delete_app_id', 'int', 0);
  ensureStateLabel(runtime, 'ws_status', 'str', '');
  ensureStateLabel(runtime, 'matrix_debug_subject_selected', 'str', 'trace');
  ensureStateLabel(runtime, 'matrix_debug_subjects_json', 'json', []);
  ensureStateLabel(runtime, 'matrix_debug_readiness_text', 'str', '');
  ensureStateLabel(runtime, 'matrix_debug_subject_summary_text', 'str', '');
  ensureStateLabel(runtime, 'matrix_debug_trace_summary_text', 'str', '');
  ensureStateLabel(runtime, 'matrix_debug_summary_text', 'str', '');
  ensureStateLabel(runtime, 'matrix_debug_status_text', 'str', '');
  ensureStateLabel(runtime, 'mgmt_bus_console_subject_rows_json', 'json', []);
  ensureStateLabel(runtime, 'mgmt_bus_console_timeline_text', 'str', '');
  ensureStateLabel(runtime, 'mgmt_bus_console_inspector_text', 'str', '');
  ensureStateLabel(runtime, 'mgmt_bus_console_event_rows_json', 'json', []);
  ensureStateLabel(runtime, 'mgmt_bus_console_event_inspector_json', 'json', []);
  ensureStateLabel(runtime, 'mgmt_bus_console_event_inspector_text', 'str', '');
  ensureStateLabel(runtime, 'mgmt_bus_console_route_rows_json', 'json', []);
  ensureStateLabel(runtime, 'mgmt_bus_console_route_status', 'str', 'route_missing');
  ensureStateLabel(runtime, 'mgmt_bus_console_composer_actions_json', 'json', []);
  ensureStateLabel(runtime, 'mgmt_bus_console_message_transcript', 'str', 'No messages sent yet.');

  let programEngine = null;

  const deriveWorkspaceRegistry = () => {
    return deriveWorkspaceRegistryFromSnapshot({
      snapshot: runtime.snapshot(),
      getParentInfo: (modelId) => runtime.parentChildMap.get(modelId),
    });
  };

  const currentWorkspaceRegistryForDesktopState = () => {
    const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
    if (!stateModel) return deriveWorkspaceRegistry();
    const appsRaw = runtime.getLabelValue(stateModel, 0, 0, 0, 'ws_apps_registry');
    return Array.isArray(appsRaw) ? appsRaw : deriveWorkspaceRegistry();
  };

  const isValidDesktopAppForCurrentCatalog = (app) => {
    const apps = currentWorkspaceRegistryForDesktopState();
    const validWorkspaceModelRefs = new Set(
      (Array.isArray(apps) ? apps : [])
        .filter((entry) => entry && Number.isInteger(entry.model_id) && runtimeHasDesktopWorkspaceModel(runtime, entry))
        .map((entry) => desktopAppRefKey(entry)),
    );
    return isValidDesktopAppForWorkspaceCatalog(runtime, app, validWorkspaceModelRefs);
  };

  const sanitizeDesktopWorkspaceAppStateFromCurrentCatalog = () => {
    sanitizeDesktopWorkspaceAppState(runtime, currentWorkspaceRegistryForDesktopState());
  };

  const normalizeIntState = (value, fallback) => {
    if (Number.isInteger(value)) return value;
    const str = readAuthString(value);
    if (!str) return fallback;
    const parsed = Number.parseInt(str, 10);
    if (Number.isInteger(parsed)) return parsed;
    return fallback;
  };

  const normalizeDerivedRefreshScope = (scopeOrOptions = 'business') => {
    const raw = typeof scopeOrOptions === 'string'
      ? scopeOrOptions
      : (scopeOrOptions && typeof scopeOrOptions.scope === 'string' ? scopeOrOptions.scope : 'business');
    return DERIVED_REFRESH_SCOPES.has(raw) ? raw : 'business';
  };

  const syncDerivedPageState = (scopeOrOptions = 'business') => {
    const scope = normalizeDerivedRefreshScope(scopeOrOptions);
    const refreshHomeEditor = scope === 'full' || scope === 'home_or_editor';
    const snap = runtime.snapshot();
    if (refreshHomeEditor) {
      overwriteStateLabel(runtime, 'editor_model_options_json', 'json', deriveEditorModelOptions(snap, EDITOR_STATE_MODEL_ID));
      overwriteStateLabel(runtime, 'home_table_rows_json', 'json', deriveHomeTableRows(snap, EDITOR_STATE_MODEL_ID));
      overwriteStateLabel(runtime, 'home_missing_model_text', 'str', deriveHomeMissingModelText(snap, EDITOR_STATE_MODEL_ID));
      overwriteStateLabel(runtime, 'home_selected_label_text', 'str', deriveHomeSelectedLabelText(snap, EDITOR_STATE_MODEL_ID));
      overwriteStateLabel(runtime, 'home_edit_dialog_title', 'str', deriveHomeEditDialogTitle(snap, EDITOR_STATE_MODEL_ID));
    }
    overwriteStateLabel(runtime, 'static_upload_disabled', 'bool', !deriveStaticUploadReady(snap, EDITOR_STATE_MODEL_ID));
    const slideGallery = deriveSlideGalleryView(snap, GALLERY_STATE_MODEL_ID);
    overwriteRuntimeLabel(runtime, GALLERY_STATE_MODEL_ID, 0, 13, 0, 'gallery_slide_summary_text', 'str', slideGallery.summaryText);
    overwriteRuntimeLabel(runtime, GALLERY_STATE_MODEL_ID, 0, 14, 0, 'gallery_slide_registry_count_text', 'str', slideGallery.registryCountText);
    overwriteRuntimeLabel(runtime, GALLERY_STATE_MODEL_ID, 0, 15, 0, 'gallery_slide_models_text', 'str', slideGallery.modelsText);
    overwriteRuntimeLabel(runtime, GALLERY_STATE_MODEL_ID, 0, 16, 0, 'gallery_slide_creator_status_text', 'str', slideGallery.creatorStatusText);
    overwriteRuntimeLabel(runtime, GALLERY_STATE_MODEL_ID, 0, 17, 0, 'gallery_slide_last_created_text', 'str', slideGallery.lastCreatedText);
    overwriteRuntimeLabel(runtime, GALLERY_STATE_MODEL_ID, 0, 18, 0, 'gallery_slide_docs_text', 'str', slideGallery.docsText);
    overwriteRuntimeLabel(runtime, GALLERY_STATE_MODEL_ID, 0, 19, 0, 'gallery_slide_evidence_local_text', 'str', slideGallery.localEvidenceText);
    overwriteRuntimeLabel(runtime, GALLERY_STATE_MODEL_ID, 0, 20, 0, 'gallery_slide_evidence_remote_text', 'str', slideGallery.remoteEvidenceText);
    syncMatrixDebugDerivedState();
    const flowSnap = buildClientSnapshot(runtime);
    const flowWorkspace = deriveWorkspaceSelected(flowSnap, EDITOR_STATE_MODEL_ID, buildAstFromSchema);
    const flowState = deriveSlidingFlowShellState(flowSnap, EDITOR_STATE_MODEL_ID);
    for (const label of deriveSlidingFlowShellProjectionLabels(flowState, flowWorkspace)) {
      overwriteStateLabel(runtime, label.k, label.t, label.v);
    }
  };

  const syncMatrixDebugHostLabels = () => {
    const traceModel = runtime.getModel(TRACE_MODEL_ID);
    if (!traceModel) return;
    const model0 = runtime.getModel(0);
    const runtimeMode = model0 ? readAuthString(runtime.getLabelValue(model0, 0, 0, 0, 'runtime_mode')) : 'edit';
    const matrixConfigured = Boolean(programEngine && programEngine.matrixRoomId);
    const matrixPeerReady = Boolean(programEngine && programEngine.matrixDmPeerUserId);
    const matrixConnected = Boolean(programEngine && programEngine.matrixAdapter && matrixConfigured && matrixPeerReady);
    const matrixStatus = !matrixConfigured
      ? 'config_missing'
      : !matrixPeerReady
        ? 'peer_missing'
        : matrixConnected
          ? 'connected'
          : 'not_ready';
    const bridgeStatus = runtimeMode === 'running'
      ? (matrixConnected ? 'relay_ready' : 'local_only')
      : `runtime_${runtimeMode || 'edit'}`;
    const traceEnabled = runtime.getLabelValue(traceModel, 0, 0, 0, 'trace_enabled') !== false;
    overwriteRuntimeLabel(runtime, TRACE_MODEL_ID, 0, 0, 0, 'matrix_status', 'str', matrixStatus);
    overwriteRuntimeLabel(runtime, TRACE_MODEL_ID, 0, 0, 0, 'bridge_status', 'str', bridgeStatus);
    overwriteRuntimeLabel(runtime, TRACE_MODEL_ID, 0, 0, 0, 'matrix_ready', 'bool', matrixConnected);
    overwriteRuntimeLabel(runtime, TRACE_MODEL_ID, 0, 0, 0, 'trace_status', 'str', traceEnabled ? 'monitoring' : 'paused');
  };

  const syncMgmtBusConsoleDerivedState = (matrixProjection) => {
    const consoleModel = runtime.getModel(MGMT_BUS_CONSOLE_MODEL_ID);
    const selectedEventId = consoleModel
      ? runtime.getLabelValue(consoleModel, 0, 0, 0, 'selected_event_id')
      : '';
    const selectedSubjectId = consoleModel
      ? readAuthString(
        runtime.getLabelValue(consoleModel, 0, 0, 0, 'selected_subject_id')
        || runtime.getLabelValue(consoleModel, 0, 0, 0, 'selected_subject'),
      )
      : '';
    const sourceProjection = matrixProjection && typeof matrixProjection === 'object'
      ? { ...matrixProjection }
      : {};
    if (mgmtBusConsoleChannelDiscovery.status === 'ready') {
      if (mgmtBusConsoleJoinedRooms.length > 0) {
        delete sourceProjection.subjects;
        sourceProjection.joinedRooms = mgmtBusConsoleJoinedRooms;
        sourceProjection.selected = selectedSubjectId || sourceProjection.selected || '';
      } else {
        sourceProjection.subjects = [{
          label: 'No Matrix channels joined by drop',
          value: 'matrix.joined_rooms_empty',
          status: 'empty',
        }];
      }
    } else if (mgmtBusConsoleChannelDiscovery.status === 'error') {
      sourceProjection.subjects = [{
        label: `Matrix channels unavailable: ${mgmtBusConsoleChannelDiscovery.text || 'unknown error'}`,
        value: 'matrix.joined_rooms_unavailable',
        status: 'error',
      }];
    }
    sourceProjection.readinessText = [
      sourceProjection.readinessText,
      mgmtBusConsoleChannelDiscovery.text,
    ].filter(Boolean).join('\n');
    const projection = deriveMgmtBusConsoleProjection({
      matrixProjection: {
        ...sourceProjection,
        selectedEventId,
      },
      readRootLabel: (modelId, key) => {
        const model = runtime.getModel(modelId);
        return model ? runtime.getLabelValue(model, 0, 0, 0, key) : undefined;
      },
    });
    overwriteStateLabel(runtime, 'mgmt_bus_console_subject_rows_json', 'json', projection.subjects);
    overwriteStateLabel(runtime, 'mgmt_bus_console_timeline_text', 'str', projection.timelineText);
    overwriteStateLabel(runtime, 'mgmt_bus_console_inspector_text', 'str', projection.inspectorText);
    overwriteStateLabel(runtime, 'mgmt_bus_console_event_rows_json', 'json', projection.eventRows);
    overwriteStateLabel(runtime, 'mgmt_bus_console_event_inspector_json', 'json', projection.eventInspectorRows);
    overwriteStateLabel(runtime, 'mgmt_bus_console_event_inspector_text', 'str', projection.eventInspectorText);
    overwriteStateLabel(runtime, 'mgmt_bus_console_route_rows_json', 'json', projection.routeRows);
    overwriteStateLabel(runtime, 'mgmt_bus_console_route_status', 'str', projection.routeStatus);
    overwriteStateLabel(runtime, 'mgmt_bus_console_composer_actions_json', 'json', projection.composerActions);
    overwriteStateLabel(runtime, 'mgmt_bus_console_message_transcript', 'str', projection.messageTranscript);
    return projection;
  };

  const refreshMgmtBusConsoleChannels = async (matrixSession = undefined, options = {}) => {
    const syncAfterChannelRefresh = () => {
      if (options && options.suppressPersistence === true) {
        return withRuntimePersistenceDisabled(runtime, () => syncMatrixDebugDerivedState());
      }
      return syncMatrixDebugDerivedState();
    };
    const hasExplicitSession = matrixSession !== undefined;
    const sessionResult = hasExplicitSession
      ? (
        matrixSession && matrixSession.homeserverUrl && matrixSession.accessToken
          ? {
            ok: true,
            data: {
              homeserverUrl: matrixSession.homeserverUrl,
              accessToken: matrixSession.accessToken,
              userId: matrixSession.userId || '',
              displayName: matrixSession.displayName || matrixSession.userId || '',
            },
          }
          : {
            ok: false,
            code: 'matrix_session_missing',
            detail: 'missing_session_matrix_token',
          }
      )
      : (AUTH_ENABLED
        ? {
          ok: false,
          code: 'matrix_session_missing',
          detail: 'missing_explicit_matrix_session',
        }
        : resolveMgmtBusConsoleMatrixSession(runtime));
    if (!sessionResult.ok) {
      mgmtBusConsoleJoinedRooms = [];
      mgmtBusConsoleChannelDiscovery = {
        status: 'error',
        text: `drop Matrix channels unavailable: ${sessionResult.detail || sessionResult.code}`,
      };
      syncAfterChannelRefresh();
      return { ok: false, code: sessionResult.code, detail: sessionResult.detail, rooms: [] };
    }
    try {
      const result = mgmtBusConsoleJoinedRoomsImpl
        ? await mgmtBusConsoleJoinedRoomsImpl(sessionResult.data)
        : await fetchMgmtBusConsoleJoinedRooms(sessionResult.data);
      const rooms = Array.isArray(result)
        ? result
        : (Array.isArray(result?.rooms) ? result.rooms : []);
      mgmtBusConsoleJoinedRooms = rooms;
      mgmtBusConsoleChannelDiscovery = {
        status: 'ready',
        text: `drop Matrix channels=${rooms.length}`,
      };
      syncAfterChannelRefresh();
      return { ok: true, rooms };
    } catch (err) {
      const detail = err && err.message ? err.message : String(err);
      mgmtBusConsoleJoinedRooms = [];
      mgmtBusConsoleChannelDiscovery = {
        status: 'error',
        text: `drop Matrix channels unavailable: ${detail}`,
      };
      syncAfterChannelRefresh();
      return { ok: false, code: 'matrix_joined_rooms_failed', detail, rooms: [] };
    }
  };

  const syncMatrixDebugDerivedState = () => {
    syncMatrixDebugHostLabels();
    const projection = deriveMatrixDebugView(buildClientSnapshot(runtime), EDITOR_STATE_MODEL_ID);
    overwriteStateLabel(runtime, 'matrix_debug_subjects_json', 'json', projection.subjects);
    overwriteStateLabel(runtime, 'matrix_debug_subject_selected', 'str', projection.selected);
    overwriteStateLabel(runtime, 'matrix_debug_readiness_text', 'str', projection.readinessText);
    overwriteStateLabel(runtime, 'matrix_debug_subject_summary_text', 'str', projection.subjectSummaryText);
    overwriteStateLabel(runtime, 'matrix_debug_trace_summary_text', 'str', projection.traceSummaryText);
    syncMgmtBusConsoleDerivedState(projection);
    return projection;
  };

  const refreshWorkspaceStateCatalog = () => {
    syncWorkspaceAssetCatalogProjection(runtime);
    const apps = deriveWorkspaceRegistry();
    const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
    overwriteStateLabel(runtime, 'ws_apps_registry', 'json', apps);
    sanitizeDesktopWorkspaceAppState(runtime, apps);

    const defaultSelected = resolveDefaultAppId(runtime, apps);
    const foregroundWorkspaceModelId = readDesktopForegroundWorkspaceModelId(buildClientSnapshot(runtime));
    const validSelected = resolveWorkspaceSelection(
      apps,
      Number.isInteger(foregroundWorkspaceModelId)
        ? foregroundWorkspaceModelId
        : runtime.getLabelValue(stateModel, 0, 0, 0, 'ws_app_selected'),
      defaultSelected,
    );
    overwriteStateLabel(runtime, 'ws_app_selected', 'int', Number(validSelected));

    overwriteStateLabel(runtime, 'ws_app_next_id', 'int', resolveNextWorkspaceModelId(runtime));
  };

  const reconcileWorkspaceSelectionState = () => {
    const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
    if (!stateModel) return;
    const uiPage = readAuthString(runtime.getLabelValue(stateModel, 0, 0, 0, 'ui_page')).toLowerCase();
    if (uiPage !== 'workspace') return;
    const appsRaw = runtime.getLabelValue(stateModel, 0, 0, 0, 'ws_apps_registry');
    const apps = Array.isArray(appsRaw) ? appsRaw : deriveWorkspaceRegistry();
    const defaultSelected = resolveDefaultAppId(runtime, apps);
    const validSelected = resolveWorkspaceSelection(
      apps,
      runtime.getLabelValue(stateModel, 0, 0, 0, 'ws_app_selected'),
      defaultSelected,
    );
    overwriteStateLabel(runtime, 'ws_app_selected', 'int', Number(validSelected));
    overwriteStateLabel(runtime, 'selected_model_id', 'str', String(validSelected));
  };

  const reconcileHomeSelectionState = (force = false) => {
    const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
    if (!stateModel) return;
    const uiPage = readAuthString(runtime.getLabelValue(stateModel, 0, 0, 0, 'ui_page')).toLowerCase();
    if (uiPage !== 'home') return;
    const selectedModelId = runtime.getLabelValue(stateModel, 0, 0, 0, 'selected_model_id');
    if (!force && String(selectedModelId ?? '') === '0') return;
    overwriteStateLabel(runtime, 'selected_model_id', 'str', '0');
  };

  const shouldResetHomeSelectionFromEnvelope = (envelope) => {
    const payload = envelope && typeof envelope === 'object' ? envelope.payload : null;
    const target = payload && typeof payload === 'object' ? payload.target : null;
    const value = payload && typeof payload === 'object' ? payload.value : null;
    return payload && payload.action === 'label_update'
      && target
      && target.model_id === EDITOR_STATE_MODEL_ID
      && target.p === 0
      && target.r === 0
      && target.c === 0
      && target.k === 'ui_page'
      && String(value && Object.prototype.hasOwnProperty.call(value, 'v') ? value.v : '').trim().toLowerCase() === 'home';
  };

  const readDesktopForegroundFromEnvelope = (envelope) => {
    const payload = envelope && typeof envelope === 'object' ? envelope.payload : null;
    const target = payload && typeof payload === 'object' ? payload.target : null;
    const value = payload && typeof payload === 'object' ? payload.value : null;
    if (!payload || payload.action !== 'label_update') return null;
    if (!target
      || target.model_id !== EDITOR_STATE_MODEL_ID
      || target.p !== 0
      || target.r !== 0
      || target.c !== 0
      || target.k !== DESKTOP_FOREGROUND_APP_LABEL) {
      return null;
    }
    return normalizeDesktopForegroundApp(value && Object.prototype.hasOwnProperty.call(value, 'v') ? value.v : value);
  };

  const reconcileDesktopTaskStackFromEnvelope = (envelope) => {
    const foregroundApp = readDesktopForegroundFromEnvelope(envelope);
    if (!foregroundApp) return;
    if (!isValidDesktopAppForCurrentCatalog(foregroundApp)) {
      sanitizeDesktopWorkspaceAppStateFromCurrentCatalog();
      return;
    }
    const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
    const currentStack = runtime.getLabelValue(stateModel, 0, 0, 0, DESKTOP_TASK_STACK_LABEL);
    overwriteStateLabel(runtime, DESKTOP_TASK_STACK_LABEL, 'json', deriveDesktopTaskStack(currentStack, foregroundApp));
  };

  const sanitizeStartupCatalogState = () => {
    overwriteStateLabel(runtime, 'docs_query', 'str', '');
    overwriteStateLabel(runtime, 'docs_tree_json', 'json', []);
    overwriteStateLabel(runtime, 'docs_search_results_json', 'json', []);
    overwriteStateLabel(runtime, 'docs_selected_path', 'str', '');
    overwriteStateLabel(runtime, 'docs_status', 'str', '');
    overwriteStateLabel(runtime, 'docs_render_markdown', 'str', '');
    overwriteStateLabel(runtime, 'docs_render_html', 'str', '');
    overwriteStateLabel(runtime, 'static_project_name', 'str', '');
    overwriteStateLabel(runtime, 'static_media_uri', 'str', '');
    overwriteStateLabel(runtime, 'static_media_name', 'str', '');
    overwriteStateLabel(runtime, 'static_projects_json', 'json', []);
    overwriteStateLabel(runtime, 'static_status', 'str', '');
    overwriteStateLabel(runtime, 'ws_apps_registry', 'json', []);
    overwriteStateLabel(runtime, 'ws_app_selected', 'int', 0);
    overwriteStateLabel(runtime, 'ws_app_next_id', 'int', resolveNextWorkspaceModelId(runtime));
    overwriteStateLabel(runtime, 'ws_new_app_name', 'str', '');
    overwriteStateLabel(runtime, 'ws_delete_app_id', 'int', 0);
    overwriteStateLabel(runtime, 'ws_status', 'str', '');
    overwriteStateLabel(runtime, 'llm_prompt_text', 'str', '');
    overwriteStateLabel(runtime, 'llm_prompt_preview_json', 'json', {});
    overwriteStateLabel(runtime, 'llm_prompt_preview_id', 'str', '');
    overwriteStateLabel(runtime, 'llm_prompt_preview_digest', 'str', '');
    overwriteStateLabel(runtime, 'llm_prompt_apply_preview_id', 'str', '');
    overwriteStateLabel(runtime, 'llm_prompt_apply_result_json', 'json', {});
    overwriteStateLabel(runtime, 'llm_prompt_status', 'str', '');
    overwriteStateLabel(runtime, 'llm_prompt_last_applied_preview_id', 'str', '');
    overwriteStateLabel(runtime, 'llm_prompt_available', 'bool', false);
    overwriteStateLabel(runtime, 'llm_prompt_notice', 'str', '正在检测 LLM 服务...');
    overwriteStateLabel(runtime, 'static_upload_kind', 'str', 'zip');
    overwriteStateLabel(runtime, 'static_media_uri', 'str', '');
    overwriteStateLabel(runtime, 'static_media_name', 'str', '');
    overwriteStateLabel(runtime, 'static_zip_b64', 'str', '');
    overwriteStateLabel(runtime, 'static_html_b64', 'str', '');
    overwriteRuntimeLabel(runtime, EDITOR_MODEL_ID, 0, 0, 1, BUS_EVENT_KEY, 'event', null);
    overwriteRuntimeLabel(runtime, EDITOR_MODEL_ID, 0, 0, 1, BUS_EVENT_LAST_OP_KEY, 'str', '');
    overwriteRuntimeLabel(runtime, EDITOR_MODEL_ID, 0, 0, 1, BUS_EVENT_ERROR_KEY, 'json', null);
    overwriteRuntimeLabel(runtime, EDITOR_MODEL_ID, 0, 0, 2, BUS_EVENT_KEY, 'event', null);

    const snap = runtime.snapshot();
    const models = snap && snap.models ? snap.models : {};
    for (const idText of Object.keys(models)) {
      const modelId = Number(idText);
      if (!Number.isInteger(modelId) || modelId < 0) continue;
      const model = runtime.getModel(modelId);
      if (!model) continue;
      overwriteRuntimeLabel(runtime, modelId, 0, 0, 2, BUS_EVENT_KEY, 'event', null);
      overwriteRuntimeLabel(runtime, modelId, 0, 0, 2, BUS_EVENT_LAST_OP_KEY, 'str', '');
      overwriteRuntimeLabel(runtime, modelId, 0, 0, 2, BUS_EVENT_ERROR_KEY, 'json', null);
    }
  };

  const clearAndValidateWorkspaceSelection = () => {
    const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
    if (!stateModel) return;
    const apps = deriveWorkspaceRegistry();
    const selected = runtime.getLabelValue(stateModel, 0, 0, 0, 'ws_app_selected');
    const fallbackModelId = resolveDefaultAppId(runtime, apps);
    const selectedId = Number.isInteger(selected) ? selected : Number.parseInt(String(readAuthString(selected)), 10);
    if (!apps.some((app) => app.model_id === Number(selectedId))) {
      overwriteStateLabel(runtime, 'ws_app_selected', 'int', Number(fallbackModelId));
    }
    overwriteStateLabel(runtime, 'ws_app_next_id', 'int', resolveNextWorkspaceModelId(runtime));
  };

  const resetStaticCatalogStateFromFilesystem = () => {
    overwriteStateLabel(runtime, 'static_status', 'str', '');
    overwriteStateLabel(runtime, 'static_projects_json', 'json', []);
    overwriteStateLabel(runtime, 'static_upload_kind', 'str', 'zip');
    overwriteStateLabel(runtime, 'static_media_uri', 'str', '');
    overwriteStateLabel(runtime, 'static_media_name', 'str', '');
    overwriteStateLabel(runtime, 'static_zip_b64', 'str', '');
    overwriteStateLabel(runtime, 'static_html_b64', 'str', '');
    overwriteStateLabel(runtime, 'ws_apps_registry', 'json', []);
    overwriteStateLabel(runtime, 'ws_app_selected', 'int', 0);
    overwriteStateLabel(runtime, 'ws_app_next_id', 'int', resolveNextWorkspaceModelId(runtime));
    overwriteStateLabel(runtime, 'ws_status', 'str', '');
    try {
      overwriteStateLabel(runtime, 'static_projects_json', 'json', listStaticProjects());
    } catch (_) {
      overwriteStateLabel(runtime, 'static_status', 'str', 'static list failed');
    }
  };

  const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
  // ---------------------------------------------------------------------------
  // Bus Trace / Matrix debug observable model (model_id = TRACE_MODEL_ID)
  // 0213 Step 2:
  // - trace buffer / trace_append / minimal host glue stay in the server
  // - formal UI surface is model-defined via matrix_debug_surface.json
  // ---------------------------------------------------------------------------
  if (!runtime.getModel(TRACE_MODEL_ID)) {
    runtime.createModel({ id: TRACE_MODEL_ID, name: 'bus_trace', type: 'Data' });
  }
  const traceModel = runtime.getModel(TRACE_MODEL_ID);
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'data_type', t: 'str', v: 'CircularBuffer' });
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'size_max', t: 'int', v: 2000 });
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_enabled', t: 'bool', v: true });
  runtime.addLabel(traceModel, 0, 0, 0, { k: 'app_name', t: 'str', v: 'Matrix Debug' });
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

  // 0213 Step 2 / 0346 refresh: the formal Matrix debug surface now comes from
  // packages/worker-base/system-models/matrix_debug_surface.json cellwise component cells.

  // Register clear handler — when clear_cmd is written to cell(0,0,2), clear the buffer
  runtime.registerFunction(traceModel, 'clear_trace', (ctx) => {
    const clearData = traceModel.getFunction('clear_data');
    if (typeof clearData === 'function') {
      clearData({ runtime, model: traceModel });
    }
    runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_count', t: 'int', v: 0 });
    runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_log_text', t: 'str', v: '(cleared)' });
    runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_last_update', t: 'str', v: '--:--:--' });
    runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_throughput', t: 'str', v: '0/s' });
    runtime.addLabel(traceModel, 0, 0, 0, { k: 'trace_error_rate', t: 'str', v: '0%' });
    _traceSeq = 0;
  });
  runtime.addMailboxTrigger(traceModel, 0, 0, 2, 'clear_trace');

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
      ensureGallery(0, 9, 3, { k: 'wave_c_dynamic_text', t: 'str', v: 'hello from deferred fragment' });

      // Wave E: ProgressBar demo state
      ensureGallery(0, 10, 0, { k: 'wave_e_progress', t: 'int', v: 92 });
      ensureGallery(0, 10, 1, { k: 'wave_e_progress2', t: 'int', v: 67 });
    }
  } catch (_) {
    // ignore
  }

  // Preload docs index and static projects list for first paint.
  const refreshStartupCatalogState = () => {
    try {
      const files = listMarkdownFiles(DOCS_ROOT, isAllowedDocRelPath);
      overwriteStateLabel(runtime, 'docs_tree_json', 'json', buildDocsTree(files));
      overwriteStateLabel(runtime, 'docs_status', 'str', `docs indexed: ${files.length}`);
    } catch (_) {
      overwriteStateLabel(runtime, 'docs_status', 'str', 'docs index failed');
    }
    try {
      overwriteStateLabel(runtime, 'static_projects_json', 'json', listStaticProjects());
    } catch (_) {
      overwriteStateLabel(runtime, 'static_status', 'str', 'static list failed');
    }
  };
  sanitizeStartupCatalogState();
  resetStaticCatalogStateFromFilesystem();
  clearAndValidateWorkspaceSelection();
  syncWorkspaceAssetCatalogProjection(runtime);
  refreshWorkspaceStateCatalog();
  reconcileHomeSelectionState(true);
  reconcileWorkspaceSelectionState();
  syncDerivedPageState({ scope: 'full' });
  refreshStartupCatalogState();
  runtime.setRuntimeMode('edit');
  if (persister && typeof persister.setEnabled === 'function') persister.setEnabled(true);

  const clearAndRefreshAfterRuntimeBoot = async () => {
    withRuntimePersistenceDisabled(runtime, () => {
      try {
        const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
        if (stateModel) {
          // Ensure file-backed catalogs are treated as "source of truth"
          // even if runtime persistence contains legacy data.
          const files = listMarkdownFiles(DOCS_ROOT, isAllowedDocRelPath);
          overwriteStateLabel(runtime, 'docs_tree_json', 'json', buildDocsTree(files));
          overwriteStateLabel(runtime, 'docs_status', 'str', `docs indexed: ${files.length}`);
          overwriteStateLabel(runtime, 'static_projects_json', 'json', listStaticProjects());
          overwriteStateLabel(runtime, 'static_status', 'str', '');
        }
      } catch (_) {
        overwriteStateLabel(runtime, 'static_status', 'str', 'static list failed');
      }
    });
    try {
      await refreshMgmtBusConsoleChannels(undefined, { suppressPersistence: true });
      withRuntimePersistenceDisabled(runtime, () => {
        refreshWorkspaceStateCatalog();
        reconcileWorkspaceSelectionState();
        syncDerivedPageState({ scope: 'full' });
      });
    } catch (_) {
      withRuntimePersistenceDisabled(runtime, () => {
        overwriteStateLabel(runtime, 'static_status', 'str', 'workspace catalog refresh failed');
      });
    }
    try {
      const availability = await probeLlmPromptAvailability(runtime);
      withRuntimePersistenceDisabled(runtime, () => {
        overwriteLlmPromptAvailabilityState(runtime, availability);
      });
    } catch (_) {
      withRuntimePersistenceDisabled(runtime, () => {
        overwriteStateLabel(runtime, 'llm_prompt_available', 'bool', false);
        overwriteStateLabel(runtime, 'llm_prompt_notice', 'str', '当前暂不可用：LLM 服务检测失败。');
      });
    }
  };

  const editorEventLog = [];
  const adapter = createLocalBusAdapter({ runtime, eventLog: editorEventLog, mode: 'v1' });
  programEngine = new ProgramModelEngine(runtime);
  runtime.eventLog.setObserver(() => {
    if (!programEngine || runtime.runtimeMode !== 'running') return;
    Promise.resolve().then(() => {
      try { programEngine.tick().catch(() => {}); } catch (_) { /* ignore */ }
    });
  });
  programEngine.matrixUserLoginImpl = matrixUserLoginImpl;
  programEngine.matrixSuiteMatrixImpl = matrixSuiteMatrixImpl;
  programEngine._mgmtBusConsoleRefreshChannels = refreshMgmtBusConsoleChannels;
  programEngine._matrixDebugRefresh = (subjectId) => {
    const selected = String(subjectId ?? '').trim() || 'trace';
    overwriteStateLabel(runtime, 'matrix_debug_subject_selected', 'str', selected);
    const projection = syncMatrixDebugDerivedState();
    return { ok: true, data: { projection } };
  };
  programEngine._matrixDebugClearTrace = (subjectId) => {
    const selected = String(subjectId ?? '').trim() || 'trace';
    const traceModel = runtime.getModel(TRACE_MODEL_ID);
    if (!traceModel) {
      return { ok: false, code: 'invalid_target', detail: 'matrix_debug_missing_model' };
    }
    overwriteStateLabel(runtime, 'matrix_debug_subject_selected', 'str', selected);
    runtime.addLabel(traceModel, 0, 0, 2, { k: 'clear_cmd', t: 'str', v: String(Date.now()) });
    const projection = syncMatrixDebugDerivedState();
    return { ok: true, data: { projection } };
  };
  programEngine._matrixDebugSummarize = (subjectId) => {
    const selected = String(subjectId ?? '').trim() || 'trace';
    overwriteStateLabel(runtime, 'matrix_debug_subject_selected', 'str', selected);
    const projection = syncMatrixDebugDerivedState();
    return {
      ok: true,
      data: {
        projection,
        summary: projection.subjectSummaryText,
      },
    };
  };
  programEngine._wsRefreshCatalog = refreshWorkspaceStateCatalog;
  runtime.hostApi = {
    slideImportAppFromMxc: (mediaUri) => {
      const uri = String(mediaUri ?? '').trim();
      if (!uri) {
        return { ok: false, code: 'invalid_target', detail: 'missing_media_uri' };
      }
      const cached = getCachedUploadedMedia(uri);
      if (!cached || !cached.buffer || !Buffer.isBuffer(cached.buffer)) {
        return { ok: false, code: 'invalid_target', detail: 'media_not_cached' };
      }
      try {
        const payload = parseSlideImportPayloadFromZipBuffer(cached.buffer);
        const validation = validateSlideImportPayload(payload);
        if (!validation.ok) return validation;
        const imported = materializeSlideImportPayload(runtime, payload, validation);
        registerImportedHostEgressBridgeFunctions(programEngine, runtime, imported);
        return {
          ok: true,
          data: {
            table_id: imported.tableId,
            model_id: imported.rootModelId,
            model_ref: imported.rootModelRef,
            app_name: validation.metadata.appName,
            from_user: validation.metadata.fromUser,
            to_user: validation.metadata.toUser,
            model_ids: imported.modelIds,
          },
        };
      } catch (err) {
        return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
      }
    },
    slideCreateAppFromState: (stateModelId) => {
      const targetStateModelId = Number.isInteger(stateModelId) ? stateModelId : 1035;
      const stateModel = runtime.getModel(targetStateModelId);
      if (!stateModel) {
        return { ok: false, code: 'invalid_target', detail: 'creator_state_missing' };
      }
      const readStr = (key, fallback = '') => {
        const value = runtime.getLabelValue(stateModel, 0, 0, 0, key);
        const text = value == null ? '' : String(value).trim();
        return text || fallback;
      };
      const appName = readStr('create_app_name');
      const sourceWorker = readStr('create_source_worker', 'filltable-create');
      const slideSurfaceType = readStr('create_slide_surface_type', 'workspace.page');
      const headline = readStr('create_headline', 'Created by Filltable');
      const bodyText = readStr('create_body_text', '');
      if (!appName) {
        return { ok: false, code: 'invalid_target', detail: 'missing_app_name' };
      }
      if (slideSurfaceType !== 'workspace.page') {
        return { ok: false, code: 'invalid_target', detail: 'unsupported_slide_surface_type' };
      }
      try {
        const payload = buildFilltableCreatedSlidePayload({ appName, sourceWorker, slideSurfaceType, headline, bodyText });
        const validation = validateSlideImportPayload(payload);
        if (!validation.ok) return validation;
        const created = materializeSlideImportPayload(runtime, payload, validation);
            return {
              ok: true,
              data: {
                table_id: created.tableId,
                model_id: created.rootModelId,
                truth_model_id: created.rootModelId + 1,
                model_ref: created.rootModelRef,
                app_name: appName,
              },
            };
      } catch (err) {
        return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
      }
    },
    wsSelectApp: (modelId) => {
      let selected = null;
      if (Number.isInteger(modelId)) {
        selected = modelId;
      } else if (typeof modelId === 'string' && /^-?\d+$/.test(modelId.trim())) {
        selected = Number(modelId.trim());
      }
      if (!Number.isInteger(selected)) {
        return { ok: false, code: 'invalid_target', detail: 'ws_app_selected must be int' };
      }
      return { ok: true, data: { selected } };
    },
    wsAddApp: (name) => {
      const appName = String(name ?? '').trim();
      if (!appName) {
        return { ok: false, code: 'invalid_target', detail: 'empty_app_name' };
      }
      try {
        const nextId = resolveNextWorkspaceModelId(runtime);
        const model = runtime.createModel({ id: nextId, name: appName, type: 'sliding_ui' });
        runtime.addLabel(model, 0, 0, 0, { k: 'app_name', t: 'str', v: appName });
        runtime.addLabel(model, 0, 0, 0, { k: 'slide_app_summary', t: 'str', v: `Blank workspace slide app named ${appName}.` });
        runtime.addLabel(model, 0, 0, 0, { k: 'slide_capable', t: 'bool', v: true });
        runtime.addLabel(model, 0, 0, 0, { k: 'slide_surface_type', t: 'str', v: 'workspace.page' });
        runtime.addLabel(model, 0, 0, 0, { k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' });
        runtime.addLabel(model, 0, 0, 0, { k: 'ui_root_node_id', t: 'str', v: 'ws_added_root' });
        runtime.addLabel(model, 0, 0, 0, { k: 'deletable', t: 'bool', v: true });
        runtime.addLabel(model, 0, 0, 0, { k: 'ws_deleted', t: 'bool', v: false });
        runtime.addLabel(model, 2, 0, 0, { k: 'ui_node_id', t: 'str', v: 'ws_added_root' });
        runtime.addLabel(model, 2, 0, 0, { k: 'ui_component', t: 'str', v: 'Text' });
        runtime.addLabel(model, 2, 0, 0, { k: 'ui_text', t: 'str', v: appName });
        return { ok: true, data: { model_id: nextId, name: appName } };
      } catch (err) {
        return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
      }
    },
    wsDeleteApp: (modelId) => {
      let targetId = null;
      if (Number.isInteger(modelId)) {
        targetId = modelId;
      } else if (typeof modelId === 'string' && /^-?\d+$/.test(modelId.trim())) {
        targetId = Number(modelId.trim());
      }
      if (!Number.isInteger(targetId)) {
        return { ok: false, code: 'invalid_target', detail: 'invalid_model_id' };
      }
      if (targetId < 100) {
        return { ok: false, code: 'protected_model', detail: 'protected_model' };
      }
      const targetModel = runtime.getModel(targetId);
      if (!targetModel) {
        return { ok: false, code: 'invalid_target', detail: 'model_not_found' };
      }
      const deletable = targetModel.getCell(0, 0, 0).labels.get('deletable');
      if (!deletable || deletable.v !== true) {
        return { ok: false, code: 'protected_model', detail: 'protected_model' };
      }
      try {
        const removed = removeImportedBundleFromRuntime(runtime, targetId);
        if (!removed.ok) {
          return { ok: false, code: 'invalid_target', detail: removed.code };
        }
        if (programEngine && Array.isArray(removed.systemLabels)) {
          const sys = firstSystemModel(runtime);
          for (const key of removed.systemLabels) {
            programEngine.functions.delete(key);
            if (sys && sys.functions instanceof Map) {
              sys.functions.delete(key);
            }
          }
        }
        const runtimePersister = runtime && runtime.persistence ? runtime.persistence : null;
        if (runtimePersister && runtimePersister.db && typeof runtimePersister.db.prepare === 'function') {
          const stmt = runtimePersister.db.prepare("delete from mt_data where table_id = 'host' and mt_id = ?");
          for (const modelIdToDelete of removed.modelIds) {
            stmt.run(modelIdToDelete);
          }
        }
        return { ok: true, data: { model_id: targetId, removed_model_ids: removed.modelIds } };
      } catch (err) {
        return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
      }
    },
    wsRefreshCatalog: () => {
      try {
        refreshWorkspaceStateCatalog();
        return { ok: true, data: { refreshed: true } };
      } catch (err) {
        return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
      }
    },
  };
  // 0325c Step 3.5 Rev 2 NN2: conflict-checked extension for cross-model I/O methods.
  const _crossModelMethods = buildCrossModelHostApiMethods(runtime);
  for (const _name of Object.keys(_crossModelMethods)) {
    if (typeof runtime.hostApi[_name] !== 'undefined') {
      throw new Error(`hostApi_name_conflict: ${_name} already defined`);
    }
    runtime.hostApi[_name] = _crossModelMethods[_name];
  }
  // 0325c Step 3.5 Stage 3 Batch 2: register docs* (per R17 按需补注册) for runtime-ctx Model -10 handlers.
  // Impl mirrors programEngine ctx.hostApi.docs* (L3101-L3160) — reuses file-level DOCS_ROOT + helpers.
  const _docsHostApiMethods = {
    docsRefreshTree: () => {
      try {
        const files = listMarkdownFiles(DOCS_ROOT, isAllowedDocRelPath);
        const tree = buildDocsTree(files);
        return { ok: true, data: { tree, fileCount: files.length } };
      } catch (err) {
        return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
      }
    },
    docsSearch: (query, limit) => {
      try {
        const maxResults = Number.isInteger(limit) && limit > 0 ? limit : 50;
        const q = String(query ?? '').trim().toLowerCase();
        if (!q) return { ok: true, data: { results: [] } };
        const files = listMarkdownFiles(DOCS_ROOT, isAllowedDocRelPath);
        const results = [];
        for (const f of files) {
          if (results.length >= maxResults) break;
          if (f.relPath.toLowerCase().includes(q)) {
            results.push({ path: f.relPath, hit: 'name', snippet: '' });
            continue;
          }
          let text = '';
          try { text = fs.readFileSync(f.absPath, 'utf8'); } catch (_) { continue; }
          const idx = text.toLowerCase().indexOf(q);
          if (idx >= 0) {
            const start = Math.max(0, idx - 40);
            const end = Math.min(text.length, idx + q.length + 60);
            results.push({ path: f.relPath, hit: 'content', snippet: text.slice(start, end).replace(/\s+/g, ' ').trim() });
          }
        }
        return { ok: true, data: { results } };
      } catch (err) {
        return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
      }
    },
    docsOpenDoc: (relPath) => {
      const rel = String(relPath ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
      if (!isAllowedDocRelPath(rel)) {
        return { ok: false, code: 'invalid_target', detail: 'doc_path_not_allowed' };
      }
      const abs = safeJoin(DOCS_ROOT, rel);
      if (!abs) return { ok: false, code: 'invalid_target', detail: 'doc_path_invalid' };
      if (!fs.existsSync(abs)) return { ok: false, code: 'invalid_target', detail: 'doc_not_found' };
      try {
        const md = fs.readFileSync(abs, 'utf8');
        const html = String(getMarkdownProcessor().processSync(md));
        return { ok: true, data: { markdown: md, html } };
      } catch (err) {
        return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
      }
    },
  };
  for (const _name of Object.keys(_docsHostApiMethods)) {
    if (typeof runtime.hostApi[_name] !== 'undefined') {
      throw new Error(`hostApi_name_conflict: ${_name} already defined`);
    }
    runtime.hostApi[_name] = _docsHostApiMethods[_name];
  }
  // 0325c Step 3.5 Stage 3 Batch 2: register static* (per R17).
  const _staticHostApiMethods = {
    staticListProjects: () => {
      try {
        const projects = listStaticProjects();
        return { ok: true, data: { projects } };
      } catch (err) {
        return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
      }
    },
    staticUploadProjectFromMxc: (name, kind, mediaUri) => {
      const projectName = String(name ?? '').trim();
      if (!/^[a-zA-Z0-9._-]+$/.test(projectName)) {
        return { ok: false, code: 'invalid_target', detail: 'invalid_project_name' };
      }
      const uploadKind = String(kind ?? 'zip').trim();
      if (uploadKind !== 'zip' && uploadKind !== 'html') {
        return { ok: false, code: 'invalid_target', detail: 'invalid_upload_kind' };
      }
      const uri = String(mediaUri ?? '').trim();
      if (!uri) return { ok: false, code: 'invalid_target', detail: 'missing_media_uri' };
      const cached = getCachedUploadedMedia(uri);
      if (!cached || !cached.buffer || !Buffer.isBuffer(cached.buffer)) {
        return { ok: false, code: 'invalid_target', detail: 'media_not_cached' };
      }
      try {
        const projects = staticUploadCore(projectName, uploadKind, cached.buffer);
        return { ok: true, data: { projects, uploaded: projectName } };
      } catch (err) {
        return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
      }
    },
    staticDeleteProject: (name) => {
      const projectName = String(name ?? '').trim();
      if (!/^[a-zA-Z0-9._-]+$/.test(projectName)) {
        return { ok: false, code: 'invalid_target', detail: 'invalid_project_name' };
      }
      const projectRoot = safeJoin(STATIC_PROJECTS_ROOT, projectName);
      if (!projectRoot) return { ok: false, code: 'invalid_target', detail: 'invalid_project_name' };
      if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
        return { ok: false, code: 'invalid_target', detail: 'project_not_found' };
      }
      try {
        fs.rmSync(projectRoot, { recursive: true, force: true });
        const projects = listStaticProjects();
        return { ok: true, data: { projects, deleted: projectName } };
      } catch (err) {
        return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
      }
    },
  };
  for (const _name of Object.keys(_staticHostApiMethods)) {
    if (typeof runtime.hostApi[_name] !== 'undefined') {
      throw new Error(`hostApi_name_conflict: ${_name} already defined`);
    }
    runtime.hostApi[_name] = _staticHostApiMethods[_name];
  }
  // 0325c Step 3.5 Stage 3 Batch 2/3: stubs for programEngine-only hostApi methods that runtime-ctx handlers may call.
  // Matrix debug + LLM Filltable + matrixUserLogin depend on programEngine internal state (programEngine.this._matrixDebugRefresh, LLM backend config).
  // In runtime ctx they return {ok:false, code:'handler_requires_program_engine'} so callers get well-shaped error and proceed gracefully.
  // Real functional integration is 0325d scope (refactor programEngine hostApi methods to file-level or dual-register).
  const _runtimeCtxStubs = {
    matrixDebugRefresh: () => ({ ok: false, code: 'handler_requires_program_engine', detail: 'matrixDebugRefresh not available in runtime ctx' }),
    matrixDebugClearTrace: () => ({ ok: false, code: 'handler_requires_program_engine', detail: 'matrixDebugClearTrace not available in runtime ctx' }),
    matrixDebugSummarize: () => ({ ok: false, code: 'handler_requires_program_engine', detail: 'matrixDebugSummarize not available in runtime ctx' }),
    llmFilltablePreview: async () => ({ ok: false, code: 'handler_requires_program_engine', detail: 'llmFilltablePreview not available in runtime ctx' }),
    llmFilltableApply: async () => ({ ok: false, code: 'handler_requires_program_engine', detail: 'llmFilltableApply not available in runtime ctx' }),
    llmInfer: async () => ({ ok: false, code: 'handler_requires_program_engine', detail: 'llmInfer not available in runtime ctx' }),
    matrixUserLogin: async () => ({ ok: false, code: 'handler_requires_program_engine', detail: 'matrixUserLogin not available in runtime ctx' }),
  };
  for (const _name of Object.keys(_runtimeCtxStubs)) {
    if (typeof runtime.hostApi[_name] !== 'undefined') {
      throw new Error(`hostApi_name_conflict: ${_name} already defined`);
    }
    runtime.hostApi[_name] = _runtimeCtxStubs[_name];
  }
  const programEngineReady = programEngine.init()
    .then(() => programEngine.tick())
    .then(() => clearAndRefreshAfterRuntimeBoot())
    .catch(() => {});

  function recoverModel100StaleInflight() {
    const model100 = runtime.getModel(100);
    if (!model100) return;
    const inflight = runtime.getLabelValue(model100, 0, 0, 0, 'submit_inflight');
    if (inflight !== true) return;
    const startedAt = Number(runtime.getLabelValue(model100, 0, 0, 0, 'submit_inflight_started_at') || 0);
    const now = Date.now();
    const timeoutMs = 30000;
    const stale = !Number.isFinite(startedAt) || startedAt <= 0 || (now - startedAt > timeoutMs);
    if (!stale) return;
    runtime.addLabel(model100, 0, 0, 0, { k: 'submit_inflight', t: 'bool', v: false });
    runtime.addLabel(model100, 0, 0, 0, { k: 'submit_inflight_started_at', t: 'int', v: 0 });
    runtime.addLabel(model100, 0, 0, 0, { k: 'status', t: 'str', v: 'ready' });
  }

  function updateDerived(scopeOrOptions = 'business') {
    const scope = normalizeDerivedRefreshScope(scopeOrOptions);
    repairSlideImporterClickContract(runtime);
    recoverModel100StaleInflight();
    if (scope === 'full' || scope === 'app_index') {
      refreshWorkspaceStateCatalog();
    }
    syncDerivedPageState({ scope });
    // Client-visible AST must be derived from the same filtered snapshot surface
    // that /snapshot and SSE expose, otherwise raw labels can leak via ui_ast_v0.
    const uiAst = resolvePageAsset(buildClientSnapshot(runtime), {
      projectSchemaModel: buildAstFromSchema,
      projectCellwiseModel: buildAstFromCellwiseModel,
    }).ast;
    // snapshot_json and event_log are excluded from client snapshot (too large).
    // Skip expensive computation — saves ~2 full snapshot traversals per event.
    adapter.updateUiDerived({
      uiAst,
      snapshotJson: '',
      eventLogJson: '',
    });
  }

  programEngineReady.then(() => {
    withRuntimePersistenceDisabled(runtime, () => updateDerived({ scope: 'full' }));
    if (typeof programEngine.onSnapshotChanged === 'function') {
      programEngine.onSnapshotChanged();
    }
  }).catch(() => {});

  function snapshot() {
    return runtime.snapshot();
  }

  function clientSnap() {
    recoverModel100StaleInflight();
    sanitizeDesktopWorkspaceAppStateFromCurrentCatalog();
    syncMatrixDebugDerivedState();
    return buildClientSnapshot(runtime);
  }

  function setLastBusEventOpId(next) {
    lastBusEventOpId = typeof next === 'string' ? next : '';
    overwriteRuntimeLabel(runtime, EDITOR_MODEL_ID, 0, 0, 1, BUS_EVENT_LAST_OP_KEY, 'str', lastBusEventOpId);
  }

  function getLastBusEventOpId() {
    return lastBusEventOpId;
  }

  function setBusEventErrorValue(next) {
    busEventErrorValue = next ?? null;
    overwriteRuntimeLabel(runtime, EDITOR_MODEL_ID, 0, 0, 1, BUS_EVENT_ERROR_KEY, 'json', busEventErrorValue);
  }

  function getBusEventErrorValue() {
    return busEventErrorValue;
  }

  function normalizeBusEventV2ValueToPinPayload(value, metaValue = null) {
    void metaValue;
    if (Array.isArray(value)) return isValidBusPayloadArray(value) ? value : { error: 'invalid_bus_payload' };
    return { error: 'invalid_bus_payload' };
  }

  let submitEnvelopeQueue = Promise.resolve();
  async function submitEnvelope(envelopeOrNull, options = {}) {
    const timingStart = {
      serverReceivedAt: Date.now(),
      serverReceivedPerfMs: nowPerfMs(),
      serverStartedAt: 0,
      serverStartedPerfMs: 0,
    };
    const previous = submitEnvelopeQueue;
    let releaseQueue = () => {};
    submitEnvelopeQueue = new Promise((resolve) => { releaseQueue = resolve; });
    await previous;
    timingStart.serverStartedAt = Date.now();
    timingStart.serverStartedPerfMs = nowPerfMs();
    try {
      const result = await submitEnvelopeCore(envelopeOrNull, options);
      return withSubmitTiming(result, envelopeOrNull, timingStart);
    } finally {
      if (options && Object.prototype.hasOwnProperty.call(options, 'matrixSession')) {
        programEngine.currentRequestMatrixSession = null;
        programEngine.currentRequestMatrixSessionProvided = false;
        programEngine.matrixSuiteSession = null;
      }
      releaseQueue();
    }
  }

  async function submitEnvelopeCore(envelopeOrNull, options = {}) {
    const envelope = envelopeOrNull;
    const payload = envelope && envelope.payload ? envelope.payload : null;
    const action = payload && typeof payload.action === 'string' ? payload.action : '';
    const pin = payload && typeof payload.pin === 'string' ? payload.pin.trim() : '';
    const meta = payload && payload.meta && typeof payload.meta === 'object'
      ? payload.meta
      : (envelope && envelope.meta && typeof envelope.meta === 'object' ? envelope.meta : null);
    const opId = meta && typeof meta.op_id === 'string' ? meta.op_id : '';

    if (envelopeOrNull) {
      await programEngineReady;
    }

    if (options && Object.prototype.hasOwnProperty.call(options, 'matrixSession')) {
      const requestMatrixSession = options.matrixSession && options.matrixSession.accessToken && options.matrixSession.homeserverUrl
        ? {
          homeserverUrl: options.matrixSession.homeserverUrl,
          accessToken: options.matrixSession.accessToken,
          userId: options.matrixSession.userId || '',
          displayName: options.matrixSession.displayName || options.matrixSession.userId || '',
        }
        : null;
      programEngine.currentRequestMatrixSession = requestMatrixSession;
      programEngine.currentRequestMatrixSessionProvided = true;
      programEngine.matrixSuiteSession = requestMatrixSession;
    }

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

    const inferDerivedScopeForResult = (extra = {}) => {
      if (extra && typeof extra.derived_scope === 'string') {
        return normalizeDerivedRefreshScope(extra.derived_scope);
      }
      if (HOME_PIN_ACTIONS.has(action) || action.startsWith('datatable_')) {
        return 'home_or_editor';
      }
      return 'business';
    };

    const stripInternalResultFields = (extra = {}) => {
      const out = { ...(extra || {}) };
      delete out.derived_scope;
      return out;
    };

    const finishOk = async (extra = {}) => {
      const derivedScope = inferDerivedScopeForResult(extra);
      const responseExtra = stripInternalResultFields(extra);
      setBusEventErrorValue(null);
      setLastBusEventOpId(opId);
      runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: BUS_EVENT_KEY, t: 'event', v: null });
      updateDerived({ scope: derivedScope });
      await programEngine.tick();
      return { consumed: true, result: 'ok', ...responseExtra };
    };

    const finishError = async (code, detail) => {
      if (typeof action === 'string' && action.startsWith('home_')) {
        runtime.addLabel(runtime.getModel(EDITOR_STATE_MODEL_ID), 0, 0, 0, {
          k: 'home_status_text',
          t: 'str',
          v: `ERR ${code}: ${detail}`,
        });
      }
      setBusEventErrorValue({ op_id: opId, code, detail });
      setLastBusEventOpId(opId);
      runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: BUS_EVENT_KEY, t: 'event', v: null });
      updateDerived({ scope: HOME_PIN_ACTIONS.has(action) || action.startsWith('datatable_') ? 'home_or_editor' : 'business' });
      return { consumed: true, result: 'error', code, detail };
    };

    const isLegacyUiEventShape = Boolean(
      envelopeOrNull
      && envelopeOrNull.type === UI_EVENT_TYPE
      && payload
      && typeof payload === 'object'
    );
    const isUiEventV2 = Boolean(
      envelopeOrNull
      && envelopeOrNull.type === 'bus_event_v2'
      && typeof envelopeOrNull.bus_in_key === 'string'
    );

    if (isLegacyUiEventShape) {
      return finishError('legacy_event_shape', 'payload_envelope_retired');
    }

    if (isUiEventV2) {
      const busInKey = String(envelopeOrNull.bus_in_key || '').trim();
      const allowedBusInKeys = new Set(['ui_submit', 'ui_click', 'ui_input', 'ui_edit', 'slide_import_media_uri_update', 'slide_import_click', 'mgmt_bus_console_send', 'mgmt_bus_console_refresh']);
      const isDeclaredModel0BusInRoute = (() => {
        if (!busInKey) return false;
        const model0 = runtime.getModel(0);
        if (!model0) return false;
        const rootCell = runtime.getCell(model0, 0, 0, 0);
        for (const label of rootCell.labels.values()) {
          if (label.t !== 'pin.connect.cell' || !Array.isArray(label.v)) continue;
          for (const route of label.v) {
            const from = route && route.from;
            if (
              Array.isArray(from)
              && from.length === 4
              && from[0] === 0
              && from[1] === 0
              && from[2] === 0
              && from[3] === busInKey
            ) {
              return true;
            }
          }
        }
        return false;
      })();
      if (!allowedBusInKeys.has(busInKey) && !isDeclaredModel0BusInRoute) {
        return finishError('invalid_bus_in_key', busInKey || 'missing_bus_in_key');
      }
      const v2Value = envelopeOrNull.value;
      if (!runtime.isRunLoopActive()) {
        return finishError('runtime_not_running', 'model_id=0');
      }
      if (busInKey === 'mgmt_bus_console_send' && Array.isArray(v2Value) && v2Value.length === 0) {
        return finishError('invalid_bus_payload', 'temporary_modeltable_required');
      }
      const model0 = runtime.getModel(0);
      if (!model0) {
        return finishError('invalid_target', 'missing_model0');
      }
      const busPayload = normalizeBusEventV2ValueToPinPayload(v2Value, envelopeOrNull.meta);
      if (!Array.isArray(busPayload)) {
        return finishError('invalid_bus_payload', 'temporary_modeltable_required');
      }
      const busResult = runtime.addLabel(model0, 0, 0, 0, {
        k: busInKey,
        t: 'pin.bus.cb.in',
        v: busPayload,
      });
      if (!busResult || !busResult.applied) {
        return finishError('invalid_bus_payload', 'pin_bus_in_rejected');
      }
      return finishOk({ routed_by: 'model0_busin' });
    }

    setMailboxEnvelope(runtime, HOME_PIN_ACTIONS.has(action) ? null : envelopeOrNull);

    const readCellLabel = (modelId, p, r, c, k) => {
      const model = runtime.getModel(modelId);
      if (!model) return null;
      const cell = runtime.getCell(model, p, r, c);
      return cell.labels.get(k) || null;
    };

    const readStateValue = (key) => {
      const label = readCellLabel(EDITOR_STATE_MODEL_ID, 0, 0, 0, key);
      return label ? label.v : null;
    };

    const inferLabelType = (label) => {
      if (!label) return 'str';
      const value = label.v;
      if (label.t === 'json' || (value !== null && typeof value === 'object')) return 'json';
      if (typeof value === 'boolean') return 'bool';
      if (Number.isInteger(value)) return 'int';
      return typeof label.t === 'string' && label.t ? label.t : 'str';
    };

    const stringifyLabelValue = (typeName, value) => {
      if (typeName === 'json') {
        try {
          return JSON.stringify(value, null, 2);
        } catch (_) {
          return String(value);
        }
      }
      return value == null ? '' : String(value);
    };

    const parseDebugLabelValue = (typeName) => {
      if (typeName === 'int') {
        const raw = readStateValue('dt_edit_v_int');
        return { ok: true, t: 'int', value: Number.isInteger(raw) ? raw : 0 };
      }
      if (typeName === 'bool') {
        return { ok: true, t: 'bool', value: readStateValue('dt_edit_v_bool') === true };
      }
      if (typeName === 'model.submt' || typeName === 'submt') {
        const raw = String(readStateValue('dt_edit_v_text') || '').trim();
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isInteger(parsed)) return { ok: false, code: 'submt_child_model_required' };
        return { ok: true, t: 'model.submt', value: parsed };
      }
      if (
        typeName === 'json'
        || typeName === 'event'
        || typeName === 'func.js'
        || typeName === 'func.python'
        || typeName.startsWith('pin.')
      ) {
        const raw = String(readStateValue('dt_edit_v_text') || '').trim();
        if (!raw) return { ok: true, t: typeName, value: null };
        try {
          return { ok: true, t: typeName, value: JSON.parse(raw) };
        } catch (_) {
          return { ok: false, code: 'parse_failed' };
        }
      }
      if (typeName === 'model.single' || typeName === 'model.table' || typeName === 'model.matrix' || typeName.startsWith('matrix.')) {
        return { ok: true, t: typeName, value: String(readStateValue('dt_edit_v_text') || '') };
      }
      return { ok: true, t: 'str', value: String(readStateValue('dt_edit_v_text') || '') };
    };

    const parseDebugLabelValueFromSource = (typeName, source = null) => {
      const rawText = source && Object.prototype.hasOwnProperty.call(source, 'value_text')
        ? String(source.value_text ?? '')
        : String(readStateValue('dt_edit_v_text') || '');
      const rawInt = source && Object.prototype.hasOwnProperty.call(source, 'value_int')
        ? source.value_int
        : readStateValue('dt_edit_v_int');
      const rawBool = source && Object.prototype.hasOwnProperty.call(source, 'value_bool')
        ? source.value_bool
        : readStateValue('dt_edit_v_bool');

      if (typeName === 'int') {
        return { ok: true, t: 'int', value: Number.isInteger(rawInt) ? rawInt : 0 };
      }
      if (typeName === 'bool') {
        return { ok: true, t: 'bool', value: rawBool === true };
      }
      if (typeName === 'model.submt' || typeName === 'submt') {
        const parsed = Number.parseInt(String(rawText || '').trim(), 10);
        if (!Number.isInteger(parsed)) return { ok: false, code: 'submt_child_model_required' };
        return { ok: true, t: 'model.submt', value: parsed };
      }
      if (
        typeName === 'json'
        || typeName === 'event'
        || typeName === 'func.js'
        || typeName === 'func.python'
        || typeName.startsWith('pin.')
      ) {
        const trimmed = String(rawText || '').trim();
        if (!trimmed) return { ok: true, t: typeName, value: null };
        try {
          return { ok: true, t: typeName, value: JSON.parse(trimmed) };
        } catch (_) {
          return { ok: false, code: 'parse_failed' };
        }
      }
      if (typeName === 'model.single' || typeName === 'model.table' || typeName === 'model.matrix' || typeName.startsWith('matrix.')) {
        return { ok: true, t: typeName, value: rawText };
      }
      return { ok: true, t: 'str', value: rawText };
    };

    const applyDebugDirectLabelWrite = (targetModelId, p, r, c, k, t, value) => {
      const targetModel = runtime.getModel(targetModelId);
      if (!targetModel) return { ok: false, code: 'missing_model' };
      const result = runtime.addLabel(targetModel, p, r, c, { k, t, v: value });
      return result && result.applied === true ? { ok: true } : { ok: false, code: 'debug_direct_write_rejected' };
    };

    const applyDebugDirectLabelDelete = (targetModelId, p, r, c, k) => {
      const targetModel = runtime.getModel(targetModelId);
      if (!targetModel) return { ok: false, code: 'missing_model' };
      const result = runtime.rmLabel(targetModel, p, r, c, k);
      return result && result.applied === true ? { ok: true } : { ok: false, code: 'debug_direct_delete_rejected' };
    };

    const buildHomeRequestOrigin = (sourceAction) => ({
      model_id: -10,
      cell: { p: 0, r: 0, c: 0 },
      action: typeof sourceAction === 'string' && sourceAction ? sourceAction : action,
    });

    const buildStateSetRequest = (labels, sourceAction = action) => ({
      target_model_id: EDITOR_STATE_MODEL_ID,
      write_labels: Array.isArray(labels) ? labels : [],
      remove_labels: [],
      origin: buildHomeRequestOrigin(sourceAction),
      request_id: opId || `home_req_${Date.now()}`,
    });

    const sendHomeOwnerRequestsViaSourcePin = async (requests) => {
      const sysModel = runtime.getModel(-10);
      if (!sysModel) return { ok: false, code: 'invalid_target', detail: 'missing_system_model' };
      const normalized = Array.isArray(requests) ? requests : [];
      if (normalized.length === 0) return { ok: true };
      runtime.addLabel(sysModel, 0, 0, 0, { k: HOME_PIN_ERROR_LABEL, t: 'json', v: null });
      for (const request of normalized) {
        const targetModelId = Number.isInteger(request?.target_model_id) ? request.target_model_id : null;
        if (!Number.isInteger(targetModelId)) {
          return { ok: false, code: 'invalid_target', detail: 'missing_model_id' };
        }
        const targetModel = runtime.getModel(targetModelId);
        if (!targetModel) return { ok: false, code: 'invalid_target', detail: 'missing_model' };
        if (!ensureHomeOwnerMaterializer(runtime, targetModelId)) {
          return { ok: false, code: 'target_owner_missing', detail: String(targetModelId) };
        }
        if (!ensureHomeOwnerRoute(runtime, targetModelId)) {
          return { ok: false, code: 'route_missing', detail: String(targetModelId) };
        }
        runtime.rmLabel(targetModel, 0, 0, 0, `__error_${HOME_OWNER_FUNC}`);
      }
      runtime.addLabel(sysModel, 0, 0, 0, {
        k: action,
        t: 'pin.in',
        v: [
          mtPayloadRecord('__mt_payload_kind', 'str', 'home_owner_requests.v1'),
          mtPayloadRecord('requests', 'json', normalized.map((request) => ({
            out_pin: buildHomeSourceOutPin(request.target_model_id),
            body: ownerRequestToTemporaryPayload(request, 'home_owner_request.v1'),
          }))),
        ],
      });
      await sleepMs(25);
      await programEngine.tick();
      const sourceErr = runtime.getLabelValue(sysModel, 0, 0, 0, HOME_PIN_ERROR_LABEL);
      if (sourceErr && typeof sourceErr === 'object') {
        return {
          ok: false,
          code: typeof sourceErr.code === 'string' ? sourceErr.code : 'source_pin_error',
          detail: typeof sourceErr.detail === 'string' ? sourceErr.detail : 'unknown',
        };
      }
      for (const request of normalized) {
        const targetModel = runtime.getModel(request.target_model_id);
        const errValue = runtime.getLabelValue(targetModel, 0, 0, 0, `__error_${HOME_OWNER_FUNC}`);
        if (errValue && typeof errValue === 'object') {
          return {
            ok: false,
            code: 'target_materialization_failed',
            detail: typeof errValue.error === 'string' ? errValue.error : 'unknown',
          };
        }
      }
      return { ok: true };
    };

    const sendGenericOwnerRequestsViaSourcePin = async (requests) => {
      const sysModel = runtime.getModel(-10);
      if (!sysModel) return { ok: false, code: 'invalid_target', detail: 'missing_system_model' };
      const normalized = Array.isArray(requests) ? requests : [];
      if (normalized.length === 0) return { ok: true };
      runtime.addLabel(sysModel, 0, 0, 0, { k: GENERIC_PIN_ERROR_LABEL, t: 'json', v: null });
      for (const request of normalized) {
        const targetModelId = Number.isInteger(request?.target_model_id) ? request.target_model_id : null;
        if (!Number.isInteger(targetModelId)) return { ok: false, code: 'invalid_target', detail: 'missing_model_id' };
        const targetModel = runtime.getModel(targetModelId);
        if (!targetModel) return { ok: false, code: 'invalid_target', detail: 'missing_model' };
        if (!ensureGenericOwnerMaterializer(runtime, targetModelId)) return { ok: false, code: 'target_owner_missing', detail: String(targetModelId) };
        if (!ensureGenericOwnerRoute(runtime, targetModelId)) return { ok: false, code: 'route_missing', detail: String(targetModelId) };
        runtime.rmLabel(targetModel, 0, 0, 0, `__error_${GENERIC_OWNER_FUNC}`);
      }
      for (const request of normalized) {
        runtime.addLabel(sysModel, 0, 0, 0, {
          k: buildGenericSourceOutPin(request.target_model_id),
          t: 'pin.out',
          v: ownerRequestToTemporaryPayload(request, 'owner_request.v1'),
        });
      }
      await sleepMs(25);
      await programEngine.tick();
      const sourceErr = runtime.getLabelValue(sysModel, 0, 0, 0, GENERIC_PIN_ERROR_LABEL);
      if (sourceErr && typeof sourceErr === 'object') {
        return {
          ok: false,
          code: typeof sourceErr.code === 'string' ? sourceErr.code : 'source_pin_error',
          detail: typeof sourceErr.detail === 'string' ? sourceErr.detail : 'unknown',
        };
      }
      for (const request of normalized) {
        const targetModel = runtime.getModel(request.target_model_id);
        const errValue = runtime.getLabelValue(targetModel, 0, 0, 0, `__error_${GENERIC_OWNER_FUNC}`);
        if (errValue && typeof errValue === 'object') {
          return {
            ok: false,
            code: 'target_materialization_failed',
            detail: typeof errValue.error === 'string' ? errValue.error : 'unknown',
          };
        }
      }
      return { ok: true };
    };

    const executeHomePinAction = async () => {
      const target = payload && payload.target && typeof payload.target === 'object' ? payload.target : {};
      const targetModelId = Number.isInteger(target.model_id) ? target.model_id : null;
      const p = Number.isInteger(target.p) ? target.p : 0;
      const r = Number.isInteger(target.r) ? target.r : 0;
      const c = Number.isInteger(target.c) ? target.c : 0;
      const key = typeof target.k === 'string' ? target.k : '';
      const selectedModelId = Number.parseInt(String(readStateValue('selected_model_id') || ''), 10);

      if (action === 'home_refresh') {
        const sent = await sendHomeOwnerRequestsViaSourcePin([
          buildStateSetRequest([{ p: 0, r: 0, c: 0, k: 'home_status_text', t: 'str', v: 'refreshed' }]),
        ]);
        return sent.ok ? finishOk({ routed_by: 'pin' }) : finishError(sent.code, sent.detail);
      }

      if (action === 'home_open_create') {
        if (!Number.isInteger(selectedModelId)) {
          return finishError('invalid_target', 'model_required');
        }
        const sent = await sendHomeOwnerRequestsViaSourcePin([
          buildStateSetRequest([
            { p: 0, r: 0, c: 0, k: 'home_form_mode', t: 'str', v: 'create' },
            { p: 0, r: 0, c: 0, k: 'dt_edit_model_id', t: 'str', v: String(selectedModelId) },
            { p: 0, r: 0, c: 0, k: 'dt_edit_p', t: 'str', v: '0' },
            { p: 0, r: 0, c: 0, k: 'dt_edit_r', t: 'str', v: '0' },
            { p: 0, r: 0, c: 0, k: 'dt_edit_c', t: 'str', v: '0' },
            { p: 0, r: 0, c: 0, k: 'dt_edit_k', t: 'str', v: '' },
            { p: 0, r: 0, c: 0, k: 'dt_edit_t', t: 'str', v: 'str' },
            { p: 0, r: 0, c: 0, k: 'dt_edit_v_text', t: 'str', v: '' },
            { p: 0, r: 0, c: 0, k: 'dt_edit_v_int', t: 'int', v: 0 },
            { p: 0, r: 0, c: 0, k: 'dt_edit_v_bool', t: 'bool', v: false },
            { p: 0, r: 0, c: 0, k: 'dt_edit_open', t: 'bool', v: true },
            { p: 0, r: 0, c: 0, k: 'home_status_text', t: 'str', v: `create label on model ${selectedModelId}` },
          ]),
        ]);
        return sent.ok ? finishOk({ routed_by: 'pin' }) : finishError(sent.code, sent.detail);
      }

      if (action === 'home_close_edit') {
        const sent = await sendHomeOwnerRequestsViaSourcePin([
          buildStateSetRequest([
            { p: 0, r: 0, c: 0, k: 'dt_edit_open', t: 'bool', v: false },
            { p: 0, r: 0, c: 0, k: 'home_form_mode', t: 'str', v: 'edit' },
            { p: 0, r: 0, c: 0, k: 'home_status_text', t: 'str', v: 'edit closed' },
          ]),
        ]);
        return sent.ok ? finishOk({ routed_by: 'pin' }) : finishError(sent.code, sent.detail);
      }

      if (action === 'home_close_detail') {
        const sent = await sendHomeOwnerRequestsViaSourcePin([
          buildStateSetRequest([
            { p: 0, r: 0, c: 0, k: 'dt_detail_open', t: 'bool', v: false },
            { p: 0, r: 0, c: 0, k: 'dt_detail_title', t: 'str', v: '' },
            { p: 0, r: 0, c: 0, k: 'dt_detail_text', t: 'str', v: '' },
          ]),
        ]);
        return sent.ok ? finishOk({ routed_by: 'pin' }) : finishError(sent.code, sent.detail);
      }

      if (action === 'home_save_label') {
        const draftOverride = payload && payload.value && typeof payload.value === 'object' ? payload.value : null;
        const modelId = Number.parseInt(String((draftOverride && draftOverride.model_id) ?? readStateValue('dt_edit_model_id') ?? ''), 10);
        const dp = Number.parseInt(String((draftOverride && draftOverride.p) ?? readStateValue('dt_edit_p') ?? ''), 10);
        const dr = Number.parseInt(String((draftOverride && draftOverride.r) ?? readStateValue('dt_edit_r') ?? ''), 10);
        const dc = Number.parseInt(String((draftOverride && draftOverride.c) ?? readStateValue('dt_edit_c') ?? ''), 10);
        const dk = String((draftOverride && draftOverride.k) ?? readStateValue('dt_edit_k') ?? '').trim();
        let dt = String((draftOverride && draftOverride.t) ?? readStateValue('dt_edit_t') ?? 'str').trim() || 'str';
        if (!(Number.isInteger(modelId) && Number.isInteger(dp) && Number.isInteger(dr) && Number.isInteger(dc) && dk)) {
          return finishError('invalid_target', 'edit_state_invalid');
        }
        const parsed = parseDebugLabelValueFromSource(dt, draftOverride);
        if (!parsed.ok) return finishError(parsed.code === 'parse_failed' ? 'invalid_json' : 'invalid_target', parsed.code);
        dt = parsed.t;
        const value = parsed.value;
        if (modelId > 0 && !runtime.getModel(modelId)) {
          const isCreateRootModelType = (
            dp === 0 && dr === 0 && dc === 0
            && dk === 'model_type'
            && (dt === 'model.table' || dt === 'model.single' || dt === 'model.matrix')
          );
          if (!isCreateRootModelType) {
            return finishError('invalid_target', 'missing_model');
          }
          try {
            runtime.createModel({ id: modelId, name: `model_${modelId}`, type: 'app' });
          } catch (err) {
            return finishError('exception', String(err && err.message ? err.message : err));
          }
        }
        if (modelId <= 0) {
          const direct = applyDebugDirectLabelWrite(modelId, dp, dr, dc, dk, dt, value);
          return direct.ok ? finishOk({ routed_by: 'direct' }) : finishError('invalid_target', direct.code);
        }
        const sent = await sendHomeOwnerRequestsViaSourcePin([{
          target_model_id: modelId,
          write_labels: [{ p: dp, r: dr, c: dc, k: dk, t: dt, v: value }],
          remove_labels: [],
          origin: buildHomeRequestOrigin(action),
          request_id: opId || `home_save_${Date.now()}`,
        }]);
        if (!sent.ok) return finishError(sent.code, sent.detail);
        const statusSent = await sendHomeOwnerRequestsViaSourcePin([
          buildStateSetRequest([
            { p: 0, r: 0, c: 0, k: 'selected_model_id', t: 'str', v: String(modelId) },
            { p: 0, r: 0, c: 0, k: 'draft_p', t: 'str', v: String(dp) },
            { p: 0, r: 0, c: 0, k: 'draft_r', t: 'str', v: String(dr) },
            { p: 0, r: 0, c: 0, k: 'draft_c', t: 'str', v: String(dc) },
            { p: 0, r: 0, c: 0, k: 'draft_k', t: 'str', v: dk },
            { p: 0, r: 0, c: 0, k: 'draft_t', t: 'str', v: dt },
            { p: 0, r: 0, c: 0, k: 'dt_edit_open', t: 'bool', v: false },
            { p: 0, r: 0, c: 0, k: 'home_form_mode', t: 'str', v: 'edit' },
            { p: 0, r: 0, c: 0, k: 'home_status_text', t: 'str', v: `saved ${dk} on model ${modelId}` },
          ]),
        ]);
        return statusSent.ok ? finishOk({ routed_by: 'pin' }) : finishError(statusSent.code, statusSent.detail);
      }

      if (!(Number.isInteger(targetModelId) && key)) {
        return finishError('invalid_target', 'row_target_required');
      }

      const currentLabel = readCellLabel(targetModelId, p, r, c, key);
      const currentType = inferLabelType(currentLabel);
      const currentValue = currentLabel ? currentLabel.v : null;

      if (action === 'home_select_row' || action === 'home_open_edit') {
        const labels = [
          { p: 0, r: 0, c: 0, k: 'selected_model_id', t: 'str', v: String(targetModelId) },
          { p: 0, r: 0, c: 0, k: 'draft_p', t: 'str', v: String(p) },
          { p: 0, r: 0, c: 0, k: 'draft_r', t: 'str', v: String(r) },
          { p: 0, r: 0, c: 0, k: 'draft_c', t: 'str', v: String(c) },
          { p: 0, r: 0, c: 0, k: 'draft_k', t: 'str', v: key },
          { p: 0, r: 0, c: 0, k: 'draft_t', t: 'str', v: currentType },
          { p: 0, r: 0, c: 0, k: currentType === 'int' ? 'draft_v_int' : currentType === 'bool' ? 'draft_v_bool' : 'draft_v_text', t: currentType === 'int' ? 'int' : currentType === 'bool' ? 'bool' : 'str', v: currentType === 'int' ? (Number.isInteger(currentValue) ? currentValue : 0) : currentType === 'bool' ? (currentValue === true) : stringifyLabelValue(currentType, currentValue) },
          { p: 0, r: 0, c: 0, k: 'home_status_text', t: 'str', v: `selected ${key} on model ${targetModelId}` },
        ];
        if (action === 'home_open_edit') {
          labels.push(
            { p: 0, r: 0, c: 0, k: 'home_form_mode', t: 'str', v: 'edit' },
            { p: 0, r: 0, c: 0, k: 'dt_edit_model_id', t: 'str', v: String(targetModelId) },
            { p: 0, r: 0, c: 0, k: 'dt_edit_p', t: 'str', v: String(p) },
            { p: 0, r: 0, c: 0, k: 'dt_edit_r', t: 'str', v: String(r) },
            { p: 0, r: 0, c: 0, k: 'dt_edit_c', t: 'str', v: String(c) },
            { p: 0, r: 0, c: 0, k: 'dt_edit_k', t: 'str', v: key },
            { p: 0, r: 0, c: 0, k: 'dt_edit_t', t: 'str', v: currentType },
            { p: 0, r: 0, c: 0, k: currentType === 'int' ? 'dt_edit_v_int' : currentType === 'bool' ? 'dt_edit_v_bool' : 'dt_edit_v_text', t: currentType === 'int' ? 'int' : currentType === 'bool' ? 'bool' : 'str', v: currentType === 'int' ? (Number.isInteger(currentValue) ? currentValue : 0) : currentType === 'bool' ? (currentValue === true) : stringifyLabelValue(currentType, currentValue) },
            { p: 0, r: 0, c: 0, k: 'dt_edit_open', t: 'bool', v: true },
            { p: 0, r: 0, c: 0, k: 'home_status_text', t: 'str', v: `edit ${key} on model ${targetModelId}` },
          );
        }
        const sent = await sendHomeOwnerRequestsViaSourcePin([buildStateSetRequest(labels)]);
        return sent.ok ? finishOk({ routed_by: 'pin' }) : finishError(sent.code, sent.detail);
      }

      if (action === 'home_view_detail') {
        const text = stringifyLabelValue(currentType, currentValue);
        const sent = await sendHomeOwnerRequestsViaSourcePin([
          buildStateSetRequest([
            { p: 0, r: 0, c: 0, k: 'dt_detail_title', t: 'str', v: `model ${targetModelId} (${p},${r},${c}) ${key}` },
            { p: 0, r: 0, c: 0, k: 'dt_detail_text', t: 'str', v: text },
            { p: 0, r: 0, c: 0, k: 'dt_detail_open', t: 'bool', v: true },
          ]),
        ]);
        return sent.ok ? finishOk({ routed_by: 'pin' }) : finishError(sent.code, sent.detail);
      }

      if (action === 'home_delete_label') {
        if (targetModelId <= 0) {
          const direct = applyDebugDirectLabelDelete(targetModelId, p, r, c, key);
          return direct.ok ? finishOk({ routed_by: 'direct' }) : finishError('invalid_target', direct.code);
        }
        const sent = await sendHomeOwnerRequestsViaSourcePin([{
          target_model_id: targetModelId,
          write_labels: [],
          remove_labels: [{ p, r, c, k: key }],
          origin: buildHomeRequestOrigin(action),
          request_id: opId || `home_delete_${Date.now()}`,
        }]);
        if (!sent.ok) return finishError(sent.code, sent.detail);
        const statusSent = await sendHomeOwnerRequestsViaSourcePin([
          buildStateSetRequest([{ p: 0, r: 0, c: 0, k: 'home_status_text', t: 'str', v: `deleted ${key} on model ${targetModelId}` }]),
        ]);
        return statusSent.ok ? finishOk({ routed_by: 'pin' }) : finishError(statusSent.code, statusSent.detail);
      }

      return finishError('unknown_action', action);
    };

    const executeGenericOwnerAction = async () => {
      const target = payload && payload.target && typeof payload.target === 'object' ? payload.target : {};
      const targetModelId = Number.isInteger(target.model_id) ? target.model_id : null;
      const p = Number.isInteger(target.p) ? target.p : 0;
      const r = Number.isInteger(target.r) ? target.r : 0;
      const c = Number.isInteger(target.c) ? target.c : 0;
      const key = typeof target.k === 'string' ? target.k : '';
      if (!runtime.isRunLoopActive()) {
        return finishError('runtime_not_running', `model_id=${targetModelId ?? 'unknown'}`);
      }
      if (!(Number.isInteger(targetModelId) && targetModelId > 0 && key)) {
        return finishError('invalid_target', 'positive_target_required');
      }
      if (isRetiredSlideImporterOwnerLabelMutation(action, { model_id: targetModelId, p, r, c, k: key })) {
        return finishError('direct_owner_update_disabled', 'slide_import_media_uri_requires_model0_busin');
      }
      if (action === 'ui_owner_label_update') {
        if (!payload.value || typeof payload.value.t !== 'string' || !Object.prototype.hasOwnProperty.call(payload.value, 'v')) {
          return finishError('invalid_target', 'missing_value');
        }
        const sent = await sendGenericOwnerRequestsViaSourcePin([{
          target_model_id: targetModelId,
          write_labels: [{ p, r, c, k: key, t: payload.value.t, v: payload.value.v }],
          remove_labels: [],
          origin: { model_id: -10, cell: { p: 0, r: 0, c: 0 }, action },
          request_id: opId || `ui_owner_set_${Date.now()}`,
        }]);
        return sent.ok ? finishOk({ routed_by: 'pin' }) : finishError(sent.code, sent.detail);
      }
      if (action === 'ui_owner_label_remove') {
        const sent = await sendGenericOwnerRequestsViaSourcePin([{
          target_model_id: targetModelId,
          write_labels: [],
          remove_labels: [{ p, r, c, k: key }],
          origin: { model_id: -10, cell: { p: 0, r: 0, c: 0 }, action },
          request_id: opId || `ui_owner_rm_${Date.now()}`,
        }]);
        return sent.ok ? finishOk({ routed_by: 'pin' }) : finishError(sent.code, sent.detail);
      }
      return finishError('unknown_action', action);
    };

    const unwrapWorkspaceAssetValue = (raw) => {
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && Object.prototype.hasOwnProperty.call(raw, 'v') && typeof raw.t === 'string') {
        return raw.v;
      }
      return raw;
    };

    const normalizeWorkspaceAssetRow = (raw) => {
      const row = unwrapWorkspaceAssetValue(raw);
      if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
      const id = typeof row.id === 'string'
        ? row.id.trim()
        : (typeof row.asset_id === 'string' ? row.asset_id.trim() : '');
      return findWorkspaceAssetCatalogRow(runtime, id);
    };

    const writeWorkspaceAssetSelection = (row, { detailOpen = false, status = null } = {}) => {
      overwriteRuntimeLabel(runtime, 1051, 0, 0, 0, 'selected_asset_id', 'str', row.id);
      overwriteRuntimeLabel(runtime, 1051, 0, 0, 0, 'selected_asset_name', 'str', row.name);
      overwriteRuntimeLabel(runtime, 1051, 0, 0, 0, 'selected_asset_summary_markdown', 'str', row.summary_markdown);
      overwriteRuntimeLabel(runtime, 1051, 0, 0, 0, 'selected_asset_detail_markdown', 'str', row.detail_markdown);
      overwriteRuntimeLabel(runtime, 1051, 0, 0, 0, 'asset_detail_dialog_open', 'bool', detailOpen === true);
      if (typeof status === 'string') {
        overwriteRuntimeLabel(runtime, 1051, 0, 0, 0, 'asset_install_status', 'str', status);
      }
    };

    const installWorkspaceSlideAsset = async (row) => {
      if (row.asset_type !== 'slide_app' || row.installable !== true) {
        writeWorkspaceAssetSelection(row, { detailOpen: true, status: `detail ${row.name}` });
        return finishOk({ routed_by: 'workspace_asset_detail' });
      }
      const providerEndpoint = validateWorkspaceAssetProviderEndpoint(runtime, row);
      if (!providerEndpoint.ok) {
        writeWorkspaceAssetSelection(row, {
          detailOpen: false,
          status: `install failed ${row.name}: missing provider bundle endpoint`,
        });
        return finishError('invalid_target', 'missing_provider_bundle_endpoint');
      }
      const request = buildWorkspaceAssetBundleRequestPacket(runtime, row, opId, providerEndpoint);
      overwriteRuntimeLabel(runtime, 1051, 0, 0, 0, 'asset_install_pending', 'json', {
        op_id: request.opId,
        asset_id: row.id,
        asset_name: row.name,
        provider_endpoint: request.endpoint,
        topic: request.topic,
        response_topic: request.responseTopic,
        route_kind: request.routeKind,
        reply_target: request.replyTarget,
        requested_at: Date.now(),
      });
      overwriteRuntimeLabel(runtime, 1051, 0, 0, 0, 'asset_install_error', 'json', null);
      overwriteRuntimeLabel(runtime, 1051, 0, 0, 0, 'asset_install_dialog_open', 'bool', false);
      overwriteRuntimeLabel(runtime, 1051, 0, 0, 0, 'asset_install_dialog_target_json', 'json', null);
      writeWorkspaceAssetSelection(row, {
        detailOpen: false,
        status: `requesting ${row.name} from ${providerEndpoint.topic}`,
      });
      const hostPinType = request.routeKind === 'management' ? 'pin.bus.mb.out' : 'pin.bus.cb.out';
      const model0 = runtime.getModel(0);
      runtime.rmLabel(model0, 0, 0, 0, 'workspace_asset_bundle_request_bus');
      runtime.addLabel(model0, 0, 0, 0, {
        k: 'workspace_asset_bundle_request_bus',
        t: hostPinType,
        v: request.records,
      });
      return finishOk({
        routed_by: 'workspace_asset_bundle_request',
        topic: request.topic,
        op_id: request.opId,
      });
    };

    const executeWorkspaceAssetAction = async () => {
      if (action === 'workspace_asset_close_detail') {
        overwriteRuntimeLabel(runtime, 1051, 0, 0, 0, 'asset_detail_dialog_open', 'bool', false);
        return finishOk({ routed_by: 'workspace_asset_dialog' });
      }
      if (action === 'workspace_asset_close_install_dialog') {
        overwriteRuntimeLabel(runtime, 1051, 0, 0, 0, 'asset_install_dialog_open', 'bool', false);
        return finishOk({ routed_by: 'workspace_asset_install_dialog' });
      }
      if (action === 'workspace_asset_open_installed_app') {
        const launchPayload = readRuntimeCellJson(runtime, 1051, 0, 0, 0, 'asset_install_dialog_target_json', null);
        const normalized = normalizeDesktopForegroundApp(launchPayload);
        if (!normalized || !Number.isInteger(normalized.model_id)) {
          return finishError('invalid_target', 'missing_installed_app_launch_payload');
        }
        overwriteStateLabel(runtime, DESKTOP_FOREGROUND_APP_LABEL, 'json', normalized);
        overwriteStateLabel(runtime, 'ws_app_selected', 'int', normalized.model_id);
        overwriteStateLabel(runtime, 'selected_model_id', 'str', String(normalized.model_id));
        overwriteRuntimeLabel(runtime, 1051, 0, 0, 0, 'asset_install_dialog_open', 'bool', false);
        updateDerived();
        return finishOk({ routed_by: 'workspace_asset_open_installed_app', model_id: normalized.model_id });
      }
      const row = normalizeWorkspaceAssetRow(payload && Object.prototype.hasOwnProperty.call(payload, 'value') ? payload.value : null);
      if (!row) return finishError('invalid_target', 'workspace_asset_row_required');
      if (action === 'workspace_asset_select') {
        writeWorkspaceAssetSelection(row, { detailOpen: false, status: `selected ${row.name}` });
        return finishOk({ routed_by: 'workspace_asset_select' });
      }
      if (action === 'workspace_asset_primary_action') {
        return installWorkspaceSlideAsset(row);
      }
      return finishError('unknown_action', action);
    };

    const unwrapDesktopAppActionValue = (raw) => {
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && Object.prototype.hasOwnProperty.call(raw, 'v') && typeof raw.t === 'string') {
        return raw.v;
      }
      return raw;
    };

    const normalizeDesktopDeleteTarget = (raw) => {
      const value = unwrapDesktopAppActionValue(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      const modelId = Number.isInteger(value.model_id)
        ? value.model_id
        : (typeof value.model_id === 'string' && /^-?\d+$/.test(value.model_id.trim()) ? Number(value.model_id.trim()) : null);
      if (!Number.isInteger(modelId)) return null;
      const tableId = typeof value.table_id === 'string' && value.table_id.trim()
        ? value.table_id.trim()
        : 'host';
      const title = typeof value.title === 'string' && value.title.trim() ? value.title.trim() : `App ${modelId}`;
      return { table_id: tableId, model_id: modelId, title };
    };

    const deleteWorkspaceAppTable = (tableId) => {
      if (typeof tableId !== 'string' || !tableId.trim() || tableId === 'host') {
        return { ok: false, code: 'invalid_target', detail: 'invalid_table_id' };
      }
      const normalizedTableId = tableId.trim();
      const tableModels = runtime.modelTables instanceof Map ? runtime.modelTables.get(normalizedTableId) : null;
      if (!tableModels) return { ok: false, code: 'invalid_target', detail: 'table_not_found' };
      const removedModelRefs = Array.from(tableModels.keys()).map((modelId) => ({ table_id: normalizedTableId, model_id: modelId }));
      const routePrefix = `${normalizedTableId}|`;
      if (runtime.cellConnectGraph instanceof Map) {
        for (const key of Array.from(runtime.cellConnectGraph.keys())) {
          if (String(key).startsWith(routePrefix)) runtime.cellConnectGraph.delete(key);
        }
      }
      if (runtime.cellConnectionRoutes instanceof Map) {
        for (const key of Array.from(runtime.cellConnectionRoutes.keys())) {
          if (String(key).startsWith(routePrefix)) runtime.cellConnectionRoutes.delete(key);
        }
      }
      runtime.modelTables.delete(normalizedTableId);
      if (runtime.subtableMounts instanceof Map) runtime.subtableMounts.delete(normalizedTableId);
      const model0 = runtime.getModel(0);
      if (model0) {
        for (const cell of model0.cells.values()) {
          const mountLabel = Array.from(cell.labels.values()).find((label) => (
            label && label.t === 'model.subtable' && label.v && label.v.table_id === normalizedTableId
          ));
          if (!mountLabel) continue;
          for (const key of Array.from(cell.labels.keys())) {
            runtime.rmLabel(model0, cell.p, cell.r, cell.c, key);
          }
          if (runtime.subtableMountsByHostCell instanceof Map) {
            runtime.subtableMountsByHostCell.delete(runtime._subtableHostCellKey(model0, cell.p, cell.r, cell.c));
          }
        }
      }
      const runtimePersister = runtime && runtime.persistence ? runtime.persistence : null;
      if (runtimePersister && runtimePersister.db && typeof runtimePersister.db.prepare === 'function') {
        runtimePersister.db.prepare('delete from mt_data where table_id = ?').run(normalizedTableId);
      }
      return { ok: true, removed_model_refs: removedModelRefs };
    };

    const deleteWorkspaceAppByRef = (target) => {
      if (!target || typeof target !== 'object') return { ok: false, code: 'invalid_target', detail: 'invalid_model_ref' };
      const tableId = typeof target.table_id === 'string' && target.table_id.trim() ? target.table_id.trim() : 'host';
      const targetId = target.model_id;
      if (!Number.isInteger(targetId)) return { ok: false, code: 'invalid_target', detail: 'invalid_model_id' };
      if (tableId !== 'host') {
        const targetModel = runtime.getModel({ table_id: tableId, model_id: targetId });
        if (!targetModel) return { ok: false, code: 'invalid_target', detail: 'model_not_found' };
        const rootCell = targetModel.getCell(0, 0, 0);
        const deletable = rootCell.labels.get('deletable');
        const slideCapable = rootCell.labels.get('slide_capable');
        if (!deletable || deletable.v !== true || !slideCapable || slideCapable.v !== true) {
          return { ok: false, code: 'protected_model', detail: 'protected_model' };
        }
        return deleteWorkspaceAppTable(tableId);
      }
      if (BUILTIN_WORKSPACE_APP_MODEL_IDS.includes(targetId) || targetId < 100) {
        return { ok: false, code: 'protected_model', detail: 'protected_model' };
      }
      const targetModel = runtime.getModel({ table_id: tableId, model_id: targetId });
      if (!targetModel) return { ok: false, code: 'invalid_target', detail: 'model_not_found' };
      const rootCell = targetModel.getCell(0, 0, 0);
      const deletable = rootCell.labels.get('deletable');
      const slideCapable = rootCell.labels.get('slide_capable');
      if (!deletable || deletable.v !== true || !slideCapable || slideCapable.v !== true) {
        return { ok: false, code: 'protected_model', detail: 'protected_model' };
      }
      try {
        const removed = removeImportedBundleFromRuntime(runtime, targetId);
        if (!removed.ok) return { ok: false, code: 'invalid_target', detail: removed.code };
        if (programEngine && Array.isArray(removed.systemLabels)) {
          const sys = firstSystemModel(runtime);
          for (const key of removed.systemLabels) {
            programEngine.functions.delete(key);
            if (sys && sys.functions instanceof Map) sys.functions.delete(key);
          }
        }
        const runtimePersister = runtime && runtime.persistence ? runtime.persistence : null;
        if (runtimePersister && runtimePersister.db && typeof runtimePersister.db.prepare === 'function') {
          const stmt = runtimePersister.db.prepare("delete from mt_data where table_id = 'host' and mt_id = ?");
          for (const modelIdToDelete of removed.modelIds) stmt.run(modelIdToDelete);
        }
        return { ok: true, removed_model_ids: removed.modelIds };
      } catch (err) {
        return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
      }
    };

    const executeDesktopAppAction = async () => {
      if (action === 'desktop_app_cancel_delete') {
        overwriteStateLabel(runtime, DESKTOP_DELETE_CONFIRM_OPEN_LABEL, 'bool', false);
        overwriteStateLabel(runtime, DESKTOP_DELETE_CONFIRM_TARGET_LABEL, 'json', null);
        return finishOk({ routed_by: 'desktop_app_delete_dialog' });
      }
      if (action === 'desktop_app_close_delete_result') {
        overwriteStateLabel(runtime, DESKTOP_DELETE_RESULT_OPEN_LABEL, 'bool', false);
        return finishOk({ routed_by: 'desktop_app_delete_result' });
      }
      if (action === 'desktop_app_request_delete') {
        const targetInfo = normalizeDesktopDeleteTarget(payload && Object.prototype.hasOwnProperty.call(payload, 'value') ? payload.value : null);
        if (!targetInfo) return finishError('invalid_target', 'desktop_delete_target_required');
        const targetModel = runtime.getModel({ table_id: targetInfo.table_id, model_id: targetInfo.model_id });
        const rootCell = targetModel ? targetModel.getCell(0, 0, 0) : null;
        const deletable = rootCell ? rootCell.labels.get('deletable') : null;
        if (!targetModel || !deletable || deletable.v !== true || (targetInfo.table_id === 'host' && BUILTIN_WORKSPACE_APP_MODEL_IDS.includes(targetInfo.model_id))) {
          return finishError('protected_model', 'protected_model');
        }
        overwriteStateLabel(runtime, 'desktop_delete_confirm_title', 'str', '删除滑动 App？');
        overwriteStateLabel(runtime, 'desktop_delete_confirm_text', 'str', `确定删除 ${targetInfo.title} 吗？删除后这个本地安装实例会从桌面移除。`);
        overwriteStateLabel(runtime, DESKTOP_DELETE_CONFIRM_TARGET_LABEL, 'json', targetInfo);
        overwriteStateLabel(runtime, DESKTOP_DELETE_RESULT_OPEN_LABEL, 'bool', false);
        overwriteStateLabel(runtime, DESKTOP_DELETE_CONFIRM_OPEN_LABEL, 'bool', true);
        return finishOk({ routed_by: 'desktop_app_delete_request', model_id: targetInfo.model_id });
      }
      if (action === 'desktop_app_confirm_delete') {
        const targetInfo = normalizeDesktopDeleteTarget(readStateValue(DESKTOP_DELETE_CONFIRM_TARGET_LABEL));
        if (!targetInfo) return finishError('invalid_target', 'desktop_delete_target_required');
        const removed = deleteWorkspaceAppByRef(targetInfo);
        if (!removed.ok) return finishError(removed.code || 'invalid_target', removed.detail || 'delete_failed');
        overwriteStateLabel(runtime, DESKTOP_DELETE_CONFIRM_OPEN_LABEL, 'bool', false);
        overwriteStateLabel(runtime, DESKTOP_DELETE_CONFIRM_TARGET_LABEL, 'json', null);
        overwriteStateLabel(runtime, DESKTOP_DELETE_RESULT_OPEN_LABEL, 'bool', true);
        overwriteStateLabel(runtime, 'desktop_delete_result_title', 'str', '删除成功');
        overwriteStateLabel(runtime, 'desktop_delete_result_text', 'str', `已删除 ${targetInfo.title}。`);
        overwriteStateLabel(runtime, DESKTOP_APP_MANAGE_MODE_LABEL, 'bool', false);
        const foreground = normalizeDesktopForegroundApp(readStateValue(DESKTOP_FOREGROUND_APP_LABEL));
        if (foreground && desktopAppRefKey(foreground) === desktopAppRefKey(targetInfo)) {
          overwriteStateLabel(runtime, DESKTOP_FOREGROUND_APP_LABEL, 'json', null);
        }
        refreshWorkspaceStateCatalog();
        return finishOk({
          routed_by: 'desktop_app_delete_confirm',
          table_id: targetInfo.table_id,
          model_id: targetInfo.model_id,
          removed_model_ids: removed.removed_model_ids,
          removed_model_refs: removed.removed_model_refs,
        });
      }
      return finishError('unknown_action', action);
    };

    const target = payload && payload.target && typeof payload.target === 'object' ? payload.target : null;
    const targetModelId = target && Number.isInteger(target.model_id) ? target.model_id : null;
    if (envelopeOrNull && pin) {
      if (!(target && Number.isInteger(target.model_id) && Number.isInteger(target.p) && Number.isInteger(target.r) && Number.isInteger(target.c))) {
        return finishError('invalid_target', 'missing_target_coords');
      }
      if (!runtime.isRunLoopActive()) {
        return finishError('runtime_not_running', `model_id=${target.model_id}`);
      }
      if (isRetiredSlideImporterDirectPin(target, pin)) {
        return finishError('direct_pin_disabled', 'slide_import_click_requires_model0_busin');
      }
      const targetModel = runtime.getModel(target.model_id);
      if (!targetModel) {
        return finishError('invalid_target', 'missing_model');
      }
      const normalizedDirectPin = normalizeDirectPinValue(payload.value, meta, target, pin);
      if (!normalizedDirectPin || normalizedDirectPin.ok !== true) {
        return finishError(
          target.model_id === 0 ? 'invalid_bus_payload' : 'invalid_target',
          normalizedDirectPin && normalizedDirectPin.detail ? normalizedDirectPin.detail : 'invalid_pin_payload',
        );
      }
      const addResult = runtime.addLabel(
        targetModel,
        target.p,
        target.r,
        target.c,
        {
          k: pin,
          t: target.model_id === 0 ? 'pin.bus.cb.in' : 'pin.in',
          v: normalizedDirectPin.value,
        },
      );
      if (!addResult || !addResult.applied) {
        return finishError(target.model_id === 0 ? 'invalid_bus_payload' : 'invalid_target', 'runtime_add_label_rejected');
      }
      return finishOk({ routed_by: 'direct_pin' });
    }
    if (envelopeOrNull && isRetiredSlideAction(action, targetModelId)) {
      return finishError('legacy_action_protocol_retired', action);
    }
    const businessTargetModelId = meta && Number.isInteger(meta.model_id)
      ? meta.model_id
      : (action === 'submit' ? targetModelId : null);
    const directMutationTarget = targetModelId;
    if (target && !(Number.isInteger(target.model_id) && Number.isInteger(target.p) && Number.isInteger(target.r) && Number.isInteger(target.c))) {
      return finishError('invalid_target', 'missing_target_coords');
    }
    if (envelopeOrNull && HOME_PIN_ACTIONS.has(action)) {
      return executeHomePinAction();
    }
    if (envelopeOrNull && (action === 'ui_owner_label_update' || action === 'ui_owner_label_remove')) {
      return executeGenericOwnerAction();
    }
    if (envelopeOrNull && (
      action === 'workspace_asset_select'
      || action === 'workspace_asset_primary_action'
      || action === 'workspace_asset_close_detail'
      || action === 'workspace_asset_close_install_dialog'
      || action === 'workspace_asset_open_installed_app'
    )) {
      return executeWorkspaceAssetAction();
    }
    if (envelopeOrNull && (
      action === 'desktop_app_request_delete'
      || action === 'desktop_app_cancel_delete'
      || action === 'desktop_app_confirm_delete'
      || action === 'desktop_app_close_delete_result'
    )) {
      return executeDesktopAppAction();
    }
    const allowUiLocalMutation = isUiLocalMutableTarget(target, action);
    if (envelopeOrNull && isDirectModelMutationAction(action) && !(action !== 'submodel_create' && allowUiLocalMutation)) {
      return finishError('direct_model_mutation_disabled', action);
    }
    if (envelopeOrNull && allowUiLocalMutation && directMutationTarget !== null && directMutationTarget !== EDITOR_STATE_MODEL_ID) {
      const uiLocalAdapter = createLocalBusAdapter({
        runtime,
        eventLog: editorEventLog,
        mode: 'v1',
        mailboxModelId: EDITOR_MODEL_ID,
        editorStateModelId: directMutationTarget,
      });
      const result = uiLocalAdapter.consumeOnce();
      updateDerived();
      await programEngine.tick();
      return result;
    }
    if (envelopeOrNull && businessTargetModelId && businessTargetModelId > 0) {
      if (!runtime.isRunLoopActive()) {
        return finishError('runtime_not_running', `model_id=${businessTargetModelId}`);
      }
      const targetModel = runtime.getModel(businessTargetModelId);
      if (!targetModel) {
        return finishError('invalid_target', 'missing_model');
      }
      const rootCell = runtime.getCell(targetModel, 0, 0, 0);
      if (!rootCell.labels.has('dual_bus_model')) {
        return finishError('invalid_target', 'model_not_dual_bus');
      }
      const rawBusinessValue = payload && payload.value;
      const eventValue = rawBusinessValue && rawBusinessValue.t === 'event'
        ? rawBusinessValue.v
        : (rawBusinessValue && rawBusinessValue.t === 'json'
          ? rawBusinessValue.v
          : (rawBusinessValue && typeof rawBusinessValue === 'object' && !Array.isArray(rawBusinessValue)
            ? rawBusinessValue
            : null));
      const normalizedEvent = eventValue && typeof eventValue === 'object'
        ? { ...eventValue }
        : {};
      if (!normalizedEvent.action) normalizedEvent.action = action;
      if (!normalizedEvent.meta) normalizedEvent.meta = meta || {};
      if (target && !normalizedEvent.target) normalizedEvent.target = target;
      runtime.addLabel(targetModel, 0, 0, 2, { k: 'bus_event', t: 'event', v: normalizedEvent });
      return finishOk();
    }
    
    // Trigger mapped forward function(s) BEFORE any action processing clears the mailbox
    // This gives the function a chance to forward the event to Matrix
    if (envelopeOrNull) {
      await programEngine.tick();
    }
    
    try {
      const sysModel = firstSystemModel(runtime);
      const dispatchTable = sysModel
        ? runtime.getLabelValue(sysModel, 0, 0, 0, 'intent_dispatch_table')
        : null;
      const dispatchEntries = [];
      if (dispatchTable && typeof dispatchTable === 'object' && sysModel) {
        for (const [actionName, funcName] of Object.entries(dispatchTable)) {
          if (typeof actionName !== 'string' || !actionName.trim()) continue;
          if (typeof funcName !== 'string' || !funcName.trim()) continue;
          if (!sysModel.hasFunction(funcName)) continue;
          dispatchEntries.push([actionName, funcName]);
        }
      }
      const dispatchFuncByAction = new Map(dispatchEntries);

      let resolvedAction = action;
      let resolvedFunc = dispatchFuncByAction.get(action) || '';
      const llmDispatch = {
        used: false,
        model: null,
        confidence: 1,
        reasoning: '',
        candidates: [],
      };

      if (!resolvedFunc && action && dispatchEntries.length > 0 && sysModel && shouldAttemptLlmIntentRouting(action)) {
        const llmCfg = readLlmDispatchConfig(runtime);
        if (llmCfg.enabled && llmCfg.provider === 'ollama') {
          const sceneModel = runtime.getModel(-12);
          const sceneContext = sceneModel ? runtime.getLabelValue(sceneModel, 0, 0, 0, 'scene_context') : null;
          const promptTemplate = readSystemPromptTemplate(runtime, 'llm_intent_prompt_template', DEFAULT_LLM_INTENT_PROMPT_TEMPLATE);
          const prompt = renderPromptTemplate(promptTemplate, {
            action,
            available_actions: safeJsonStringify(dispatchEntries.map(([name]) => name), '[]'),
            scene_context_json: safeJsonStringify(sceneContext, '{}'),
            mailbox_payload_json: safeJsonStringify(payload, '{}'),
          });
          const llmResult = await programEngine.llmInfer({
            baseUrl: llmCfg.base_url,
            model: llmCfg.model,
            prompt,
            timeoutMs: llmCfg.timeout_ms,
            temperature: llmCfg.temperature,
            maxTokens: llmCfg.max_tokens,
          });
          if (llmResult && llmResult.ok === true) {
            const parsed = parseLlmIntentResult(
              llmResult.data && llmResult.data.response ? llmResult.data.response : '',
              dispatchEntries.map(([name]) => name),
              llmCfg.max_candidates,
            );
            if (parsed && parsed.ok === true) {
              llmDispatch.used = true;
              llmDispatch.model = llmResult.data && llmResult.data.model ? llmResult.data.model : llmCfg.model;
              llmDispatch.confidence = parsed.confidence;
              llmDispatch.reasoning = parsed.reasoning;
              llmDispatch.candidates = parsed.candidates;
              if (parsed.matched_action && parsed.confidence >= llmCfg.confidence_threshold) {
                resolvedAction = parsed.matched_action;
                resolvedFunc = dispatchFuncByAction.get(parsed.matched_action) || '';
              } else {
                const detail = parsed.matched_action
                  ? `matched=${parsed.matched_action} confidence=${parsed.confidence.toFixed(3)} threshold=${llmCfg.confidence_threshold.toFixed(3)}`
                  : 'no_confident_match';
                setBusEventErrorValue({
                  op_id: opId,
                  code: 'low_confidence',
                  detail,
                  candidates: llmDispatch.candidates,
                });
                setLastBusEventOpId(opId);
                runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: BUS_EVENT_KEY, t: 'event', v: null });
                updateDerived();
                await programEngine.tick();
                writeActionLifecycle(runtime, {
                  op_id: opId,
                  action,
                  status: 'failed',
                  started_at: Date.now(),
                  completed_at: Date.now(),
                  result: { code: 'low_confidence', detail },
                  confidence: llmDispatch.confidence,
                  llm_used: true,
                  llm_model: llmDispatch.model,
                  llm_reasoning: llmDispatch.reasoning || null,
                });
                return {
                  consumed: true,
                  result: 'error',
                  code: 'low_confidence',
                  detail,
                  routed_by: 'llm',
                  confidence: llmDispatch.confidence,
                  candidates: llmDispatch.candidates,
                };
              }
            }
          }
        }
      }

      // Step 3: dispatch only through an explicit action-to-function table.
      if (typeof resolvedFunc === 'string' && resolvedFunc.trim().length > 0 &&
          sysModel && sysModel.hasFunction(resolvedFunc)) {
        if (!runtime.isRunLoopActive()) {
          return finishError('runtime_not_running', resolvedAction || action || 'dispatch_action');
        }
        const startedAt = Date.now();
        writeActionLifecycle(runtime, {
          op_id: opId,
          action: resolvedAction,
          status: 'executing',
          started_at: startedAt,
          completed_at: null,
          result: null,
          confidence: llmDispatch.used ? llmDispatch.confidence : 1,
          llm_used: llmDispatch.used,
          llm_model: llmDispatch.used ? (llmDispatch.model || null) : null,
          llm_reasoning: llmDispatch.used ? (llmDispatch.reasoning || null) : null,
        });
        setBusEventErrorValue(null);
        runtime.addLabel(sysModel, 0, 0, 0, { k: 'mgmt_func_error', t: 'str', v: '' });
        const dispatchPayload = payload && typeof payload === 'object'
          ? {
              ...payload,
              action: resolvedAction,
              meta: {
                ...(payload.meta && typeof payload.meta === 'object' ? payload.meta : {}),
                llm_routed_from: llmDispatch.used ? action : '',
              },
            }
          : payload;
        runtime.intercepts.record('run_func', { func: resolvedFunc, payload: dispatchPayload });
        await programEngine.tick();
        const funcErr = runtime.getLabelValue(sysModel, 0, 0, 0, 'mgmt_func_error');
        if (typeof funcErr === 'string' && funcErr.trim().length > 0) {
          runtime.addLabel(sysModel, 0, 0, 0, { k: 'mgmt_func_error', t: 'str', v: '' });
          setBusEventErrorValue({ op_id: opId, code: 'func_exception', detail: String(funcErr) });
        }
        setLastBusEventOpId(opId);
        if (!getBusEventErrorValue()) {
          setBusEventErrorValue(null);
        }
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: BUS_EVENT_KEY, t: 'event', v: null });
        updateDerived();
        await programEngine.tick();
        const errValue = getBusEventErrorValue();
        if (errValue && typeof errValue === 'object') {
          const errCode = typeof errValue.code === 'string' ? errValue.code : 'dispatch_error';
          const errDetail = typeof errValue.detail === 'string' ? errValue.detail : '';
          writeActionLifecycle(runtime, {
            op_id: opId,
            action: resolvedAction,
            status: 'failed',
            completed_at: Date.now(),
            result: {
              code: errCode,
              detail: errDetail,
            },
            confidence: llmDispatch.used ? llmDispatch.confidence : 1,
            llm_used: llmDispatch.used,
            llm_model: llmDispatch.used ? (llmDispatch.model || null) : null,
            llm_reasoning: llmDispatch.used ? (llmDispatch.reasoning || null) : null,
          });
          return {
            consumed: true,
            result: 'error',
            code: errCode,
            detail: errDetail,
            routed_by: llmDispatch.used ? 'llm' : 'rule',
            confidence: llmDispatch.used ? llmDispatch.confidence : 1,
            candidates: llmDispatch.used ? llmDispatch.candidates : undefined,
          };
        }

        await maybeEnhanceSceneContextWithLlm(runtime, programEngine, {
          llmUsed: llmDispatch.used,
          action: resolvedAction,
          opId,
        });

        writeActionLifecycle(runtime, {
          op_id: opId,
          action: resolvedAction,
          status: 'completed',
          completed_at: Date.now(),
          result: { ok: true },
          confidence: llmDispatch.used ? llmDispatch.confidence : 1,
          llm_used: llmDispatch.used,
          llm_model: llmDispatch.used ? (llmDispatch.model || null) : null,
          llm_reasoning: llmDispatch.used ? (llmDispatch.reasoning || null) : null,
        });
        return {
          consumed: true,
          result: 'ok',
          routed_by: llmDispatch.used ? 'llm' : 'rule',
          confidence: llmDispatch.used ? llmDispatch.confidence : 1,
          candidates: llmDispatch.used ? llmDispatch.candidates : undefined,
        };
      }

    if (action.startsWith('cellab_')) {
      const meta = payload && payload.meta ? payload.meta : null;
      const opId = meta && typeof meta.op_id === 'string' ? meta.op_id : '';
      const model1 = runtime.getModel(1);

      async function succeed(note) {
        setLastBusEventOpId(opId);
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: BUS_EVENT_KEY, t: 'event', v: null });
        editorEventLog.push({ op_id: opId, result: 'ok', note: note || '' });
        updateDerived({ scope: 'business' });
        await programEngine.tick();
        return { consumed: true, result: 'ok' };
      }

      async function fail(code, detail) {
        setBusEventErrorValue({ op_id: opId, code, detail });
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: BUS_EVENT_KEY, t: 'event', v: null });
        editorEventLog.push({ op_id: opId, result: 'error', code, detail });
        updateDerived({ scope: 'business' });
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
        setLastBusEventOpId(opId);
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: BUS_EVENT_KEY, t: 'event', v: null });
        editorEventLog.push({ op_id: opId, result: 'ok', note: note || '' });
        updateDerived({ scope: 'home_or_editor' });
        await programEngine.tick();
        return { consumed: true, result: 'ok' };
      }

      async function fail(code, detail) {
        setBusEventErrorValue({ op_id: opId, code, detail });
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: BUS_EVENT_KEY, t: 'event', v: null });
        editorEventLog.push({ op_id: opId, result: 'error', code, detail });
        updateDerived({ scope: 'home_or_editor' });
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

    const requestedDesktopForeground = readDesktopForegroundFromEnvelope(envelope);
    if (requestedDesktopForeground && !isValidDesktopAppForCurrentCatalog(requestedDesktopForeground)) {
      sanitizeDesktopWorkspaceAppStateFromCurrentCatalog();
      return finishError('invalid_desktop_app', `workspace_model_unavailable:${requestedDesktopForeground.model_id}`);
    }

    const forceHomeSelectionReset = shouldResetHomeSelectionFromEnvelope(envelope);
    const result = adapter.consumeOnce();
    if (forceHomeSelectionReset) {
      reconcileHomeSelectionState(true);
    }
    reconcileDesktopTaskStackFromEnvelope(envelope);
    reconcileWorkspaceSelectionState();
    updateDerived({ scope: forceHomeSelectionReset ? 'home_or_editor' : 'business' });
    await programEngine.tick();
    return result;
    } catch (err) {
      const errMeta = payload && payload.meta ? payload.meta : null;
      const errOpId = errMeta && typeof errMeta.op_id === 'string' ? errMeta.op_id : '';
      setBusEventErrorValue({ op_id: errOpId, code: 'exception', detail: String(err && err.message ? err.message : err) });
      runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: BUS_EVENT_KEY, t: 'event', v: null });
      updateDerived();
      await programEngine.tick();
      return { consumed: true, result: 'error', code: 'exception' };
    }
  }

  withRuntimePersistenceDisabled(runtime, () => {
    setMailboxEnvelope(runtime, null);
    updateDerived({ scope: 'full' });
  });

  async function applyModelTablePatch(patchOrPatches, options = {}) {
    const patches = Array.isArray(patchOrPatches) ? patchOrPatches : [patchOrPatches];
    const allowCreateModel = options.allowCreateModel !== false;
    const trustedBootstrap = options.trustedBootstrap === true;
    let applied = 0;
    let rejected = 0;
    for (const patch of patches) {
      if (!patch || !Array.isArray(patch.records)) {
        rejected += 1;
        continue;
      }
      const result = runtime.applyPatch(patch, { allowCreateModel, trustedBootstrap });
      applied += Number(result && Number.isFinite(result.applied) ? result.applied : 0);
      rejected += Number(result && Number.isFinite(result.rejected) ? result.rejected : 0);
    }
    materializeDeclaredHostEgressAdapters(runtime);
    updateDerived({ scope: 'full' });
    await programEngine.tick();
    return { applied, rejected };
  }

  async function activateRuntimeMode(mode) {
    runtime.setRuntimeMode(mode);
    if (mode === 'running') {
      programEngine.activateRunning();
      programEngineReady
        .then(() => programEngine.activateRunning())
        .then(() => programEngine.tick())
        .then(() => {
          updateDerived({ scope: 'full' });
          if (typeof programEngine.onSnapshotChanged === 'function') {
            programEngine.onSnapshotChanged();
          }
        })
        .catch((err) => {
          console.warn('[ProgramModelEngine] runtime mode background activation failed:', err && err.message ? err.message : err);
        });
    }
    updateDerived({ scope: 'full' });
    return { mode: runtime.getRuntimeMode() };
  }

  return {
    runtime,
    snapshot,
    clientSnap,
    submitEnvelope,
    applyModelTablePatch,
    activateRuntimeMode,
    updateDerived,
    refreshMgmtBusConsoleChannels,
    getRuntimeMode: () => runtime.getRuntimeMode(),
    getLastOpId: () => getLastBusEventOpId(),
    getEventError: () => getBusEventErrorValue(),
    cacheUploadedMediaForTest: (uri, item) => cacheUploadedMedia(uri, item),
    programEngine,
  };
}

function startServer(options) {
  const port = Number.isInteger(options && options.port) ? options.port : 9000;
  const corsOrigin = options && options.corsOrigin ? String(options.corsOrigin) : null;
  const enablePrincipalRuntimeTestHooks = options && options.enableTestPrincipalRuntimeInitHooks === true;

  const distDir = new URL('../ui-model-demo-frontend/dist/', import.meta.url).pathname;
  const buildInfo = options && options.skipFrontendBuild
    ? { ok: true, skipped: true }
    : maybeEnsureFrontendBuild(distDir);

  const state = createServerState({
    dbPath: options && Object.prototype.hasOwnProperty.call(options, 'dbPath') ? options.dbPath : resolveDbPath(),
  });
  const rootDbPath = options && Object.prototype.hasOwnProperty.call(options, 'dbPath') ? options.dbPath : resolveDbPath();
  const clients = new Set();
  let clientSnapshotSeq = 1;

  // SSE sends filtered client snapshot (excludes snapshot_json, trace entries, function code)
  let _cachedClientSnapByState = new WeakMap();

  function localDevPrincipal() {
    return {
      provider: 'disabled',
      userId: 'local-dev',
      subject: 'local-dev',
      roles: ['local.dev'],
      capabilities: [
        'app:read',
        'app:write',
        'workspace:read',
        'workspace:write',
        'slide_app:use',
        'matrix:connect',
        'management_bus:use',
      ],
      matrixConnected: false,
    };
  }

  function principalDbPath(principalKey) {
    if (rootDbPath === null) return null;
    const normalized = typeof principalKey === 'string' && principalKey.trim() ? principalKey.trim() : 'guest';
    const digest = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
    const ext = path.extname(rootDbPath) || '.sqlite';
    const base = path.basename(rootDbPath, path.extname(rootDbPath));
    return path.join(path.dirname(rootDbPath), `${base}.principal-${digest}${ext}`);
  }

  function createPrincipalState(principalKey) {
    if (enablePrincipalRuntimeTestHooks && process.env.DY_TEST_PRINCIPAL_RUNTIME_INIT_FAIL === '1') {
      throw new Error('dy_test_principal_runtime_init_failed');
    }
    const testBlockMs = enablePrincipalRuntimeTestHooks
      ? Number.parseInt(String(process.env.DY_TEST_PRINCIPAL_RUNTIME_INIT_BLOCK_MS || ''), 10)
      : 0;
    if (Number.isInteger(testBlockMs) && testBlockMs > 0) {
      const blockUntil = Date.now() + Math.min(testBlockMs, 5000);
      while (Date.now() < blockUntil) {
        // Test-only busy wait to prove auth routes are not queued behind runtime creation.
      }
    }
    const userState = createServerState({ dbPath: principalDbPath(principalKey) });
    const normalizedPrincipalKey = typeof principalKey === 'string' ? principalKey.trim() : '';
    if (normalizedPrincipalKey) {
      userState.runtime.principalRuntimeKey = normalizedPrincipalKey;
    }
    const model0 = userState.runtime.getModel(0);
    if (model0 && normalizedPrincipalKey) {
      userState.runtime.addLabel(model0, 0, 0, 0, {
        k: 'principal_runtime_key',
        t: 'str',
        v: normalizedPrincipalKey,
      });
    }
    userState.programEngine.disableControlBusInbound = true;
    attachPrincipalAwareProgramEngine(userState, principalKey, { wrapControlBusInbound: false });
    return userState;
  }

  const principalRuntimeRegistry = createPrincipalRuntimeRegistry({
    readOnlyState: state,
    createState: createPrincipalState,
  });

  function attachPrincipalAwareProgramEngine(runtimeState, principalKey = '', options = {}) {
    if (!runtimeState || !runtimeState.programEngine || runtimeState.programEngine.__principalRuntimeAware) return;
    const wrapControlBusInbound = options.wrapControlBusInbound !== false;
    if (wrapControlBusInbound) {
      const originalHandleControlBusPacket = typeof runtimeState.programEngine.handleControlBusPacket === 'function'
        ? runtimeState.programEngine.handleControlBusPacket.bind(runtimeState.programEngine)
        : null;
      runtimeState.programEngine.handleControlBusPacket = async (topic, payload) => {
        const principalResult = await principalRuntimeRegistry.handleControlBusPacketResult(topic, payload);
        if (principalResult.matched) {
          if (principalResult.handled === true) {
            broadcastSnapshot(principalResult.principalKey || '');
            return true;
          }
          return false;
        }
        return originalHandleControlBusPacket ? originalHandleControlBusPacket(topic, payload) : false;
      };
    }
    runtimeState.programEngine.onSnapshotChanged = () => {
      runtimeState.updateDerived();
      broadcastSnapshot(principalKey);
    };
    runtimeState.programEngine.__principalRuntimeAware = true;
  }

  attachPrincipalAwareProgramEngine(state);

  let sharedControlBusInboundReadyPromise = null;

  async function ensureSharedControlBusInboundReady() {
    if (sharedControlBusInboundReadyPromise) return sharedControlBusInboundReadyPromise;
    sharedControlBusInboundReadyPromise = (async () => {
      if (
        state.runtime
        && typeof state.runtime.isRuntimeRunning === 'function'
        && state.runtime.isRuntimeRunning()
      ) {
        state.programEngine.activateRunning();
        return;
      }
      await state.activateRuntimeMode('running');
    })().catch((err) => {
      sharedControlBusInboundReadyPromise = null;
      console.warn('[ProgramModelEngine] shared control-bus inbound activation failed:', err && err.message ? err.message : err);
    });
    return sharedControlBusInboundReadyPromise;
  }

  function readPrincipalForRequest(req) {
    return AUTH_ENABLED ? getSession(req) : localDevPrincipal();
  }

  function resolveReadRuntimeForRequest(req) {
    return principalRuntimeRegistry.resolveReadRuntime(readPrincipalForRequest(req));
  }

  function resolveSnapshotRuntimeForRequest(req) {
    const principal = readPrincipalForRequest(req);
    const readyEntry = principalRuntimeRegistry.readRuntimeIfReady(principal);
    if (readyEntry) {
      return {
        status: 'ready',
        entry: readyEntry,
        principal,
      };
    }
    const started = principalRuntimeRegistry.startRuntimeInitialization(principal);
    return {
      status: started.status || 'initializing',
      initialization: started,
      principal,
    };
  }

  function resolveMutableRuntimeForPrincipal(principal) {
    return principalRuntimeRegistry.resolveMutableRuntime(principal);
  }

  function clientSnapshotCacheKey(principal = null) {
    const caps = Array.isArray(principal?.capabilities) ? [...principal.capabilities].sort() : [];
    const identity = principal && (principal.subject || principal.userId || principal.email || principal.username)
      ? String(principal.subject || principal.userId || principal.email || principal.username)
      : 'guest';
    return `${identity}:${caps.length > 0 ? caps.join('|') : 'guest'}`;
  }

  function snapshotBaselinePrincipalKey(entry) {
    if (entry && entry.principal) return clientSnapshotCacheKey(entry.principal);
    if (entry && entry.principalKey) return String(entry.principalKey);
    return 'guest';
  }

  function getClientSnapForRuntime(entry) {
    const runtimeState = entry && entry.state ? entry.state : state;
    const principal = entry && entry.principal ? entry.principal : null;
    const snap = runtimeState.clientSnap();
    let cache = _cachedClientSnapByState.get(runtimeState);
    if (!cache || cache.snap !== snap) {
      cache = { snap, byKey: new Map() };
      _cachedClientSnapByState.set(runtimeState, cache);
    }
    const cacheKey = clientSnapshotCacheKey(principal);
    const cached = cache.byKey.get(cacheKey);
    if (cached) return cached;
    const filtered = buildClientSnapshotForPrincipal(snap, principal);
    cache.byKey.set(cacheKey, filtered);
    return filtered;
  }

  function snapshotProfileError(status, error, extra = {}) {
    return { ok: false, status, body: { ok: false, error, ...extra } };
  }

  function validateVisibleModelId(rawValue, runtimeEntry) {
    const text = String(rawValue || '').trim();
    if (!/^-?\d+$/u.test(text)) {
      return snapshotProfileError(400, 'invalid_model_id');
    }
    const modelId = Number.parseInt(text, 10);
    if (!Number.isSafeInteger(modelId)) {
      return snapshotProfileError(400, 'invalid_model_id');
    }
    const requiredCapability = requiredCapabilityForClientModel(String(modelId));
    if (requiredCapability === 'never') {
      return snapshotProfileError(403, 'model_not_allowed');
    }
    const principal = runtimeEntry && runtimeEntry.principal ? runtimeEntry.principal : null;
    if (requiredCapability && !principalHasCapability(principal, requiredCapability)) {
      return snapshotProfileError(403, 'permission_denied', { requiredCapability });
    }
    const runtimeState = runtimeEntry && runtimeEntry.state ? runtimeEntry.state : state;
    if (!runtimeState.runtime.getModel(modelId)) {
      return snapshotProfileError(404, 'model_not_found');
    }
    if (!visibleModelIdsForClient(runtimeEntry).has(modelId)) {
      return snapshotProfileError(403, 'model_not_visible');
    }
    return { ok: true, modelId, modelRef: { table_id: 'host', model_id: modelId } };
  }

  function visibleModelRefKey(ref) {
    const normalized = normalizeVisibleModelRef(ref);
    return normalized ? `${normalized.table_id}|${normalized.model_id}` : '';
  }

  function principalIdentityForTableAccess(principal) {
    return principal && (principal.subject || principal.userId || principal.email || principal.username)
      ? String(principal.subject || principal.userId || principal.email || principal.username)
      : '';
  }

  function principalCanAccessTable(runtime, principal, tableId) {
    if (tableId === 'host') return true;
    const mount = runtime && runtime.subtableMounts instanceof Map ? runtime.subtableMounts.get(tableId) : null;
    if (!mount) return false;
    const owner = mount && typeof mount.owner_principal_id === 'string' ? mount.owner_principal_id.trim() : '';
    if (!owner) return true;
    return principalIdentityForTableAccess(principal) === owner;
  }

  function visibleModelRefsForClient(runtimeEntry) {
    const runtimeState = runtimeEntry && runtimeEntry.state ? runtimeEntry.state : state;
    const runtime = runtimeState && runtimeState.runtime ? runtimeState.runtime : null;
    const principal = runtimeEntry && runtimeEntry.principal ? runtimeEntry.principal : null;
    const out = new Map();
    const registry = runtime
      ? deriveWorkspaceRegistryFromSnapshot({
        snapshot: runtime.snapshot(),
        getParentInfo: (modelId) => runtime.parentChildMap.get(modelId),
      })
      : [];
    for (const entry of registry) {
      if (!entry || !Number.isInteger(entry.model_id)) continue;
      const tableId = typeof entry.table_id === 'string' && entry.table_id.trim()
        ? entry.table_id.trim()
        : 'host';
      if (!principalCanAccessTable(runtime, principal, tableId)) continue;
      if (tableId === 'host' && entry.model_id <= 0) continue;
      if (tableId !== 'host' && entry.model_id < 0) continue;
      const ref = { table_id: tableId, model_id: entry.model_id };
      if (!runtime.getModel(ref)) continue;
      out.set(visibleModelRefKey(ref), ref);
    }
    for (const modelId of BUILTIN_WORKSPACE_APP_MODEL_IDS) {
      if (Number.isInteger(modelId) && modelId < 0 && runtime.getModel(modelId)) {
        const ref = { table_id: 'host', model_id: modelId };
        out.set(visibleModelRefKey(ref), ref);
      }
    }
    const snap = runtime ? runtime.snapshot() : null;
    for (const [tableId, table] of Object.entries(snap?.tables || {})) {
      if (!principalCanAccessTable(runtime, principal, tableId)) continue;
      for (const modelKey of Object.keys(table?.models || {})) {
        const modelId = Number.parseInt(modelKey, 10);
        if (!Number.isInteger(modelId)) continue;
        const ref = { table_id: tableId, model_id: modelId };
        out.set(visibleModelRefKey(ref), ref);
      }
    }
    return out;
  }

  function visibleModelIdsForClient(runtimeEntry) {
    return new Set([...visibleModelRefsForClient(runtimeEntry).values()]
      .filter((ref) => ref.table_id === 'host')
      .map((ref) => ref.model_id));
  }

  function parseVisibleModelRefParam(rawValue) {
    const text = String(rawValue || '').trim();
    if (!text) return null;
    if (/^-?\d+$/u.test(text)) {
      return { table_id: 'host', model_id: Number.parseInt(text, 10) };
    }
    try {
      return normalizeVisibleModelRef(JSON.parse(text));
    } catch (_) {
      return null;
    }
  }

  function validateVisibleModelRef(rawValue, runtimeEntry) {
    const ref = parseVisibleModelRefParam(rawValue);
    if (!ref || !Number.isSafeInteger(ref.model_id)) {
      return snapshotProfileError(400, 'invalid_model_ref');
    }
    if (ref.table_id === 'host') {
      return validateVisibleModelId(String(ref.model_id), runtimeEntry);
    }
    const runtimeState = runtimeEntry && runtimeEntry.state ? runtimeEntry.state : state;
    const runtime = runtimeState && runtimeState.runtime ? runtimeState.runtime : null;
    if (!runtime || !runtime.getModel(ref)) {
      return snapshotProfileError(404, 'model_not_found');
    }
    const visibleRefs = visibleModelRefsForClient(runtimeEntry);
    if (!visibleRefs.has(visibleModelRefKey(ref))) {
      return snapshotProfileError(403, 'model_not_visible');
    }
    return { ok: true, modelId: ref.model_id, modelRef: ref };
  }

  function resolveSnapshotProfileOptions(searchParams, runtimeEntry) {
    const rawProfile = searchParams.get('profile');
    const profile = rawProfile && rawProfile.trim() ? rawProfile.trim() : 'bootstrap';
    if (!CLIENT_SNAPSHOT_PROFILES.has(profile)) {
      return snapshotProfileError(400, 'invalid_snapshot_profile');
    }
    if (profile === 'full') {
      return { ok: true, options: { profile: 'full', visibleModelIds: [], visibleModelRefs: [] } };
    }

    const rawVisibleRefs = [...searchParams.getAll('visible_model_ref'), ...searchParams.getAll('model_ref')];
    const rawVisibleIds = profile === 'visible'
      ? [...searchParams.getAll('model_id'), ...searchParams.getAll('visible_model_id')]
      : searchParams.getAll('visible_model_id');
    if (profile === 'visible' && rawVisibleIds.length === 0 && rawVisibleRefs.length === 0) {
      return snapshotProfileError(400, 'missing_model_id');
    }
    const visibleModelIds = [];
    const visibleModelRefs = [];
    const seen = new Set();
    for (const rawValue of rawVisibleRefs) {
      const validated = validateVisibleModelRef(rawValue, runtimeEntry);
      if (!validated.ok) return validated;
      const key = visibleModelRefKey(validated.modelRef);
      if (seen.has(key)) continue;
      seen.add(key);
      visibleModelRefs.push(validated.modelRef);
      if (validated.modelRef.table_id === 'host') visibleModelIds.push(validated.modelRef.model_id);
    }
    for (const rawValue of rawVisibleIds) {
      const validated = validateVisibleModelId(rawValue, runtimeEntry);
      if (!validated.ok) return validated;
      const key = visibleModelRefKey(validated.modelRef);
      if (seen.has(key)) continue;
      seen.add(key);
      visibleModelIds.push(validated.modelId);
      visibleModelRefs.push(validated.modelRef);
    }
    return { ok: true, options: { profile: profile === 'visible' ? 'visible' : 'bootstrap', visibleModelIds, visibleModelRefs } };
  }

  function getProfiledClientSnapForRuntime(entry, profileOptions = {}) {
    const fullSnap = getClientSnapForRuntime(entry);
    return buildClientSnapshotProfile(fullSnap, profileOptions);
  }

  function invalidateClientSnapCache() {
    _cachedClientSnapByState = new WeakMap();
  }

  function sendSseMessage(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  function updateClientSnapshotBaseline(client, entry, snap, seq) {
    if (!client) return;
    client.lastSnapshot = cloneSnapshotJson(snap);
    client.lastSnapshotSeq = seq;
    client.principalKey = snapshotBaselinePrincipalKey(entry);
  }

  function sendSnapshot(res, entry, client = null, patchKind = 'snapshot') {
    const runtimeState = entry && entry.state ? entry.state : state;
    const profileOptions = client && client.snapshotProfileOptions ? client.snapshotProfileOptions : { profile: 'bootstrap', visibleModelIds: [] };
    const snap = getProfiledClientSnapForRuntime(entry, profileOptions);
    const data = {
      snapshot: snap,
      snapshot_seq: clientSnapshotSeq,
      op_id: runtimeState.getLastOpId(),
      patch_kind: patchKind,
      snapshot_profile: profileOptions.profile || 'bootstrap',
      visible_model_ids: Array.isArray(profileOptions.visibleModelIds) ? profileOptions.visibleModelIds : [],
      visible_model_refs: normalizeVisibleModelRefsFromOptions(profileOptions),
    };
    res.write(`event: snapshot\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    updateClientSnapshotBaseline(client, entry, snap, clientSnapshotSeq);
  }

  function sendSnapshotPatchOrSnapshot(client, entry) {
    const runtimeState = entry && entry.state ? entry.state : state;
    const profileOptions = client && client.snapshotProfileOptions ? client.snapshotProfileOptions : { profile: 'bootstrap', visibleModelIds: [] };
    const nextSnap = getProfiledClientSnapForRuntime(entry, profileOptions);
    const currentPrincipalKey = snapshotBaselinePrincipalKey(entry);
    const message = buildClientSnapshotPatchMessage({
      previousSnapshot: client.lastSnapshot,
      nextSnapshot: nextSnap,
      baseSnapshotSeq: client.lastSnapshotSeq,
      snapshotSeq: clientSnapshotSeq,
      opId: runtimeState.getLastOpId(),
      previousPrincipalKey: client.principalKey || '',
      currentPrincipalKey,
      snapshotProfile: profileOptions.profile || 'bootstrap',
      visibleModelIds: Array.isArray(profileOptions.visibleModelIds) ? profileOptions.visibleModelIds : [],
      visibleModelRefs: Array.isArray(profileOptions.visibleModelRefs) ? profileOptions.visibleModelRefs : [],
    });
    if (!message || message.event === 'noop') return;
    sendSseMessage(client.res, message.event, message.data);
    if (message.event === 'snapshot' || message.event === 'snapshot_patch') {
      updateClientSnapshotBaseline(client, entry, nextSnap, clientSnapshotSeq);
    }
  }

  function broadcastSnapshot(principalKey = '') {
    clientSnapshotSeq += 1;
    invalidateClientSnapCache();
    for (const client of clients) {
      try {
        const entry = resolveReadRuntimeForRequest(client.req);
        if (principalKey && entry.principalKey !== principalKey) continue;
        sendSnapshotPatchOrSnapshot(client, entry);
      } catch (_) {
        clients.delete(client);
      }
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    const cors = corsHeaders(req, corsOrigin);

    function returnTo() {
      return `${url.pathname}${url.search || ''}`;
    }

    function writeLoginRequired() {
      writeJson(res, 401, { ok: false, error: 'login_required', returnTo: returnTo() }, cors);
    }

    function writePermissionDenied(requiredCapability) {
      writeJson(res, 403, {
        ok: false,
        error: 'permission_denied',
        requiredCapability,
        returnTo: returnTo(),
      }, cors);
    }

    function requireCapability(requiredCapability) {
      if (!AUTH_ENABLED) {
        return localDevPrincipal();
      }
      const session = getSession(req);
      if (!session) {
        writeLoginRequired();
        return null;
      }
      const capabilities = Array.isArray(session.capabilities) ? session.capabilities : [];
      if (requiredCapability && !capabilities.includes(requiredCapability)) {
        writePermissionDenied(requiredCapability);
        return null;
      }
      return session;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    // ── Auth endpoints ───────────────────────────────────────────────────
    if (req.method === 'GET' && url.pathname === '/auth/sso/start') {
      try {
        const started = await startOidcLogin({ req, returnTo: url.searchParams.get('returnTo') || '/' });
        res.writeHead(302, {
          ...cors,
          location: started.authorizationUrl,
          'cache-control': 'no-cache',
          'set-cookie': started.stateCookie,
        });
        res.end();
      } catch (err) {
        const error = err && err.message ? err.message : 'oidc_start_failed';
        writeJson(res, error === 'oidc_not_configured' ? 503 : 500, { ok: false, error }, cors);
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/auth/sso/callback') {
      const code = url.searchParams.get('code') || '';
      const stateParam = url.searchParams.get('state') || '';
      try {
        const completed = await completeOidcLogin({ req, code, state: stateParam });
        res.writeHead(302, {
          ...cors,
          location: completed.returnTo || '/',
          'cache-control': 'no-cache',
          'set-cookie': [makeSetCookieHeader(completed.token, undefined, req), makeClearOidcStateCookieHeader(req)],
        });
        res.end();
      } catch (err) {
        const error = err && err.message ? err.message : 'oidc_callback_failed';
        const status = error === 'invalid_oidc_state' || error === 'missing_oidc_callback_fields' ? 400 : 401;
        const headers = { ...cors };
        if (status === 400 || (err && err.oidcStateFinalized === true)) headers['set-cookie'] = makeClearOidcStateCookieHeader(req);
        writeJson(res, status, { ok: false, error }, headers);
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/auth/matrix/start') {
      if (!requireCapability('matrix:connect')) return;
      try {
        const started = await startMatrixSso({
          req,
          homeserverUrl: url.searchParams.get('homeserverUrl') || process.env.MATRIX_HOMESERVER_URL || '',
          returnTo: url.searchParams.get('returnTo') || '/',
        });
        res.writeHead(302, {
          ...cors,
          location: started.redirectUrl,
          'cache-control': 'no-cache',
        });
        res.end();
      } catch (err) {
        const error = err && err.message ? err.message : 'matrix_sso_start_failed';
        const status = error === 'missing_homeserver_url' || error === 'homeserver_not_allowed' || error.startsWith('invalid_homeserver') || error === 'blocked_internal_url'
          ? 400
          : (error === 'matrix_sso_not_supported' || error === 'matrix_token_login_not_supported' || error === 'matrix_login_flows_failed' ? 502 : 500);
        writeJson(res, status, { ok: false, error }, cors);
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/auth/matrix/callback') {
      const stateParam = url.searchParams.get('state') || '';
      const loginToken = url.searchParams.get('loginToken') || '';
      try {
        const completed = await completeMatrixSso({ state: stateParam, loginToken });
        res.writeHead(302, {
          ...cors,
          location: completed.returnTo || '/',
          'cache-control': 'no-cache',
        });
        res.end();
      } catch (err) {
        const error = err && err.message ? err.message : 'matrix_sso_callback_failed';
        const status = error === 'invalid_matrix_sso_state' || error === 'missing_matrix_sso_callback_fields'
          ? 400
          : (error === 'matrix_session_missing' ? 401 : (error === 'permission_denied' ? 403 : 502));
        writeJson(res, status, { ok: false, error }, cors);
      }
      return;
    }

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
          'set-cookie': makeSetCookieHeader(session.token, undefined, req),
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

    if (req.method === 'GET' && url.pathname === '/auth/matrix/status') {
      if (!requireCapability('matrix:connect')) return;
      writeJson(res, 200, getMatrixStatus(req), cors);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/auth/matrix/disconnect') {
      if (!requireCapability('matrix:connect')) return;
      try {
        writeJson(res, 200, disconnectMatrix(req), cors);
      } catch (err) {
        const error = err && err.message ? err.message : 'matrix_disconnect_failed';
        writeJson(res, error === 'matrix_session_missing' ? 401 : 500, { ok: false, error }, cors);
      }
      return;
    }

    if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/auth/logout') {
      const result = await logout(req, { includeOidcLogoutUrl: req.method === 'GET' });
      const clearSessionCookie = makeClearCookieHeader(req);
      if (req.method === 'GET') {
        res.writeHead(302, {
          ...cors,
          location: result && result.logoutUrl ? result.logoutUrl : '/',
          'cache-control': 'no-cache',
          'set-cookie': clearSessionCookie,
        });
        res.end();
        return;
      }
      res.writeHead(200, {
        ...cors,
        'content-type': 'application/json; charset=utf-8',
        'set-cookie': clearSessionCookie,
      });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/auth/me') {
      const session = AUTH_ENABLED ? getSession(req) : localDevPrincipal();
      if (!session) {
        writeJson(res, 401, { ok: false, error: 'not_authenticated' }, cors);
        return;
      }
      writeJson(res, 200, {
        ok: true,
        provider: session.provider,
        userId: session.userId,
        subject: session.subject,
        email: session.email,
        username: session.username,
        displayName: session.displayName,
        homeserverUrl: session.homeserverUrl,
        matrixUserId: session.matrixUserId || '',
        roles: session.roles,
        capabilities: session.capabilities,
        matrixConnected: session.matrixConnected,
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
      const ast = buildAstFromCellwiseModel(miniSnap, LOGIN_MODEL_ID);
      writeJson(res, 200, { snapshot: miniSnap, ast }, cors);
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/auth/homeservers') {
      if (!requireCapability('matrix:connect')) return;
      const hsUrl = url.searchParams.get('url');
      if (!hsUrl) {
        writeJson(res, 400, { ok: false, error: 'missing_url' }, cors);
        return;
      }
      removeHomeserver(hsUrl);
      writeJson(res, 200, { ok: true }, cors);
      return;
    }

    // ── Matrix media upload (UI upload_media primitive) ─────────────────
    if (req.method === 'POST' && url.pathname === '/api/media/upload') {
      const uploadPurpose = normalizeMediaUploadPurpose(url.searchParams.get('purpose'));
      const principal = requireCapability(uploadPurpose === 'slide-import' ? 'slide_app:use' : 'matrix:connect');
      if (!principal) return;
      const runtimeEntry = resolveMutableRuntimeForPrincipal(principal);
      await handleMediaUploadRequest(req, res, runtimeEntry.state, corsOrigin);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/media/download') {
      const principal = requireCapability('matrix:connect');
      if (!principal) return;
      const runtimeEntry = resolveReadRuntimeForRequest(req);
      await handleMatrixMediaProxyRequest(req, res, runtimeEntry.state, corsOrigin, 'download');
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/media/thumbnail') {
      const principal = requireCapability('matrix:connect');
      if (!principal) return;
      const runtimeEntry = resolveReadRuntimeForRequest(req);
      await handleMatrixMediaProxyRequest(req, res, runtimeEntry.state, corsOrigin, 'thumbnail');
      return;
    }

    // ── Auth guard ───────────────────────────────────────────────────────
    function isPublicPath(method, pathname) {
      if (!AUTH_ENABLED) return true;
      if (pathname === '/auth/login' || pathname === '/auth/me') return true;
      if (method === 'GET' && (pathname === '/auth/sso/start' || pathname === '/auth/sso/callback')) return true;
      if (method === 'GET' && pathname === '/auth/matrix/callback') return true;
      if (method === 'GET' && pathname === '/auth/homeservers') return true;
      if (method === 'GET' && pathname === '/auth/login-model') return true;
      if (method === 'GET' && (pathname === '/' || pathname === '/index.html'
          || pathname === '/favicon.ico'
          || pathname.startsWith('/assets/')
          || pathname.startsWith('/p/'))) return true;
      if (method === 'GET' && (pathname === '/snapshot' || pathname === '/stream')) return true;
      if (method === 'OPTIONS') return true;
      return false;
    }

    if (!isPublicPath(req.method, url.pathname) && !isAuthenticated(req)) {
      writeLoginRequired();
      return;
    }

    if (req.method === 'GET') {
      const exportMatch = url.pathname.match(/^\/api\/slide-apps\/(\d+)\/export\.zip$/);
      const queryExport = url.pathname === '/api/slide-apps/export.zip';
      if (exportMatch || queryExport) {
        const principal = requireCapability('slide_app:use');
        if (!principal) return;
        const runtimeEntry = resolveReadRuntimeForRequest(req);
        handleSlideAppExportRequest(req, res, runtimeEntry.state, corsOrigin);
        return;
      }
    }

    if (req.method === 'GET' && url.pathname === '/favicon.ico') {
      res.writeHead(204, { 'cache-control': 'no-cache' });
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
        'cache-control': 'no-cache',
      });
      res.end(buf);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/snapshot') {
      const requestStartedAt = Date.now();
      const rawProfile = url.searchParams.get('profile');
      const profile = rawProfile && rawProfile.trim() ? rawProfile.trim() : 'bootstrap';
      if (!CLIENT_SNAPSHOT_PROFILES.has(profile)) {
        writeJson(res, 400, { ok: false, error: 'invalid_snapshot_profile' }, cors);
        return;
      }
      const wantsInitialProjection = url.searchParams.get('initial_projection') === '1';
      const canUseInitialProjection = profile === 'bootstrap' || profile === 'visible';
      const runtimeResolution = canUseInitialProjection && (profile === 'bootstrap' || wantsInitialProjection)
        ? resolveSnapshotRuntimeForRequest(req)
        : { status: 'ready', entry: resolveReadRuntimeForRequest(req), principal: readPrincipalForRequest(req) };
      if (runtimeResolution.status === 'failed') {
        const info = runtimeResolution.initialization || {};
        writeJson(res, 503, {
          ok: false,
          status: 'workspace_initialization_failed',
          code: 'workspace_initialization_failed',
          error: info.error || 'workspace_initialization_failed',
          timing: {
            request_started_at: requestStartedAt,
            response_started_at: Date.now(),
            runtime_status: 'failed',
            runtime_elapsed_ms: Number.isFinite(info.elapsedMs) ? info.elapsedMs : null,
          },
        }, cors);
        return;
      }
      if (runtimeResolution.status !== 'ready') {
        const info = runtimeResolution.initialization || {};
        const initializingBody = {
          ok: false,
          status: 'workspace_initializing',
          code: 'workspace_initializing',
          retry_after_ms: 100,
          timing: {
            request_started_at: requestStartedAt,
            response_started_at: Date.now(),
            runtime_status: info.status || 'initializing',
            runtime_elapsed_ms: Number.isFinite(info.elapsedMs) ? info.elapsedMs : null,
          },
        };
        if (wantsInitialProjection && canUseInitialProjection) {
          const initialProjectionEntry = {
            principalKey: info.principalKey || 'initializing',
            principal: runtimeResolution.principal || null,
            mutable: false,
            state,
          };
          const initialProfile = resolveSnapshotProfileOptions(url.searchParams, initialProjectionEntry);
          if (initialProfile.ok) {
            const snapshotBuildStartedAt = Date.now();
            initializingBody.snapshot = getProfiledClientSnapForRuntime(initialProjectionEntry, initialProfile.options);
            initializingBody.snapshot_seq = clientSnapshotSeq;
            initializingBody.op_id = state.getLastOpId();
            initializingBody.patch_kind = 'snapshot';
            initializingBody.snapshot_profile = initialProfile.options.profile;
            initializingBody.visible_model_ids = initialProfile.options.visibleModelIds;
            initializingBody.visible_model_refs = normalizeVisibleModelRefsFromOptions(initialProfile.options);
            initializingBody.snapshot_projection = 'read_only_initializing';
            initializingBody.truth_snapshot = false;
            initializingBody.workspace_status = {
              status: 'initializing',
              code: 'workspace_initializing',
              message: '',
            };
            initializingBody.timing.snapshot_build_started_at = snapshotBuildStartedAt;
            initializingBody.timing.response_started_at = Date.now();
          }
        }
        writeJson(res, 202, initializingBody, cors);
        return;
      }
      const runtimeEntry = runtimeResolution.entry;
      const resolvedProfile = resolveSnapshotProfileOptions(url.searchParams, runtimeEntry);
      if (!resolvedProfile.ok) {
        writeJson(res, resolvedProfile.status, resolvedProfile.body, cors);
        return;
      }
      const snapshotBuildStartedAt = Date.now();
      const snap = getProfiledClientSnapForRuntime(runtimeEntry, resolvedProfile.options);
      writeJson(res, 200, {
        snapshot: snap,
        snapshot_seq: clientSnapshotSeq,
        op_id: runtimeEntry.state.getLastOpId(),
        patch_kind: 'snapshot',
        snapshot_profile: resolvedProfile.options.profile,
        visible_model_ids: resolvedProfile.options.visibleModelIds,
        visible_model_refs: normalizeVisibleModelRefsFromOptions(resolvedProfile.options),
        timing: {
          request_started_at: requestStartedAt,
          snapshot_build_started_at: snapshotBuildStartedAt,
          response_started_at: Date.now(),
          runtime_status: 'ready',
        },
      }, cors);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/stream') {
      const runtimeEntry = resolveReadRuntimeForRequest(req);
      const resolvedProfile = resolveSnapshotProfileOptions(url.searchParams, runtimeEntry);
      if (!resolvedProfile.ok) {
        writeJson(res, resolvedProfile.status, resolvedProfile.body, cors);
        return;
      }
      res.writeHead(200, {
        ...cors,
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      });
      res.write(`retry: 1000\n\n`);
      const client = { res, req, lastSnapshot: null, lastSnapshotSeq: 0, principalKey: '', snapshotProfileOptions: resolvedProfile.options };
      clients.add(client);
      try {
        sendSnapshot(res, runtimeEntry, client);
      } catch (_) {
        clients.delete(client);
        try { res.end(); } catch (_) {}
        return;
      }

      req.on('close', () => {
        clients.delete(client);
      });
      return;
    }

    if (req.method === 'POST' && (url.pathname === BUS_EVENT_ENDPOINT_PATH || url.pathname === UI_EVENT_ENDPOINT_PATH)) {
      const principal = requireCapability('app:write');
      if (!principal) return;
      const eventRequestStartedAt = Date.now();
      try {
        const runtimeEntry = principalRuntimeRegistry.readRuntimeIfReady(principal);
        if (!runtimeEntry) {
          const started = principalRuntimeRegistry.startRuntimeInitialization(principal);
          if (started && started.status === 'failed') {
            writeJson(res, 503, {
              ok: false,
              status: 'workspace_initialization_failed',
              code: 'workspace_initialization_failed',
              error: started.error || 'workspace_initialization_failed',
              timing: {
                request_started_at: eventRequestStartedAt,
                response_started_at: Date.now(),
                runtime_status: started.status,
                runtime_elapsed_ms: Number.isFinite(started.elapsedMs) ? started.elapsedMs : null,
              },
            }, cors);
            return;
          }
          writeJson(res, 202, {
            ok: false,
            status: 'workspace_initializing',
            code: 'workspace_initializing',
            retry_after_ms: 100,
            timing: {
              request_started_at: eventRequestStartedAt,
              response_started_at: Date.now(),
              runtime_status: started && started.status ? started.status : 'initializing',
              runtime_elapsed_ms: started && Number.isFinite(started.elapsedMs) ? started.elapsedMs : null,
            },
          }, cors);
          return;
        }
        const body = await readJsonBody(req);
        let envelope = body;
        if (body && body.payload && typeof body.payload === 'object') {
          const action = typeof body.payload.action === 'string' ? body.payload.action : '';
          envelope = { ...body };
          if (typeof envelope.type !== 'string' || !envelope.type) envelope.type = body.payload.type || action;
          if (envelope.source === undefined) envelope.source = body.payload.source;
          if (envelope.meta === undefined) envelope.meta = body.payload.meta;
        }
        if (body && body.envelope) {
          envelope = body.envelope;
        }
        const consumeResult = await runtimeEntry.state.submitEnvelope(envelope, {
          matrixSession: resolveRequestMatrixSession(req),
        });
        broadcastSnapshot(runtimeEntry.principalKey);
        // Snapshot omitted from response — SSE broadcastSnapshot() delivers it.
        // This halves bandwidth per bus-event (was sending 2MB snapshot twice).
        writeJson(
          res,
          200,
          {
            ok: true,
            consumed: Boolean(consumeResult && consumeResult.consumed),
            result: consumeResult && consumeResult.result ? consumeResult.result : undefined,
            code: consumeResult && consumeResult.code ? consumeResult.code : undefined,
            detail: consumeResult && consumeResult.detail ? consumeResult.detail : undefined,
            routed_by: consumeResult && consumeResult.routed_by ? consumeResult.routed_by : undefined,
            timing: consumeResult && consumeResult.timing ? consumeResult.timing : undefined,
            confidence: consumeResult && Number.isFinite(consumeResult.confidence) ? consumeResult.confidence : undefined,
            candidates: consumeResult && Array.isArray(consumeResult.candidates) ? consumeResult.candidates : undefined,
            bus_event_last_op_id: runtimeEntry.state.getLastOpId(),
            bus_event_error: runtimeEntry.state.getEventError(),
          },
          cors,
        );
      } catch (err) {
        writeJson(res, 400, { ok: false, error: 'bad_request', detail: String(err && err.message ? err.message : err) }, cors);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/runtime/mode') {
      const principal = requireCapability('app:write');
      if (!principal) return;
      const runtimeModeRequestStartedAt = Date.now();
      try {
        const body = await readJsonBody(req);
        const nextMode = body && typeof body.mode === 'string' ? body.mode : '';
        if (nextMode !== 'running') {
          writeJson(res, 400, { ok: false, error: 'invalid_mode_transition' }, cors);
          return;
        }
        const runtimeEntry = principalRuntimeRegistry.readRuntimeIfReady(principal);
        if (!runtimeEntry) {
          const started = principalRuntimeRegistry.startRuntimeInitialization(principal);
          if (started && started.status === 'failed') {
            writeJson(res, 503, {
              ok: false,
              status: 'workspace_initialization_failed',
              code: 'workspace_initialization_failed',
              error: started.error || 'workspace_initialization_failed',
              timing: {
                request_started_at: runtimeModeRequestStartedAt,
                response_started_at: Date.now(),
                runtime_status: started.status,
                runtime_elapsed_ms: Number.isFinite(started.elapsedMs) ? started.elapsedMs : null,
              },
            }, cors);
            return;
          }
          writeJson(res, 202, {
            ok: false,
            status: 'workspace_initializing',
            code: 'workspace_initializing',
            retry_after_ms: 100,
            timing: {
              request_started_at: runtimeModeRequestStartedAt,
              response_started_at: Date.now(),
              runtime_status: started && started.status ? started.status : 'initializing',
              runtime_elapsed_ms: started && Number.isFinite(started.elapsedMs) ? started.elapsedMs : null,
            },
          }, cors);
          return;
        }
        await ensureSharedControlBusInboundReady();
        const result = await runtimeEntry.state.activateRuntimeMode(nextMode);
        broadcastSnapshot(runtimeEntry.principalKey);
        writeJson(res, 200, { ok: true, mode: result.mode }, cors);
      } catch (err) {
        const code = err && err.message === 'invalid_mode_transition' ? 409 : 400;
        const error = err && err.message === 'invalid_mode_transition' ? 'invalid_mode_transition' : 'bad_request';
        writeJson(res, code, { ok: false, error, detail: String(err && err.message ? err.message : err) }, cors);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/modeltable/patch') {
      writeJson(res, 400, {
        ok: false,
        error: 'direct_patch_api_disabled',
      }, cors);
      return;
    }

    writeJson(res, 404, { ok: false, error: 'not_found' }, cors);
  });

  const host = process.env.HOST || '127.0.0.1';
  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = address && typeof address === 'object' ? address.port : port;
    process.stdout.write(`ui-model-demo-server listening on http://${host}:${actualPort}\n`);
  });

  return server;
}

// 0325c Step 3.5 Stage 2: rubric P4/P5/P6 (cross-model I/O) + R14 setMqttTargetConfig.
// Return shape per R2: {ok: boolean, code?: string, detail?: string, data?: any}.
// Error codes per R18 (Stage 2 subset): invalid_target | invalid_target_white_list
//                      | model_not_found | invalid_label_key | invalid_label_type | exception.
// Note: invalid_dynamic_target reserved for P10 handler-side check, not emitted by these methods.
// Whitelist per R3 (Batch 3b CRITICAL-1 expansion):
//   - modelId === -1 && (p,r,c) === (0,0,1) (UI mailbox)
//   - modelId === -2 && (p,r,c) === (0,0,0) (State projection root)
//   - modelId === 0  && (p,r,c) === (0,0,0) (System bus config root; P7 bridge semantic)
//   - modelId >  0   (positive models: any cell)
//   - modelId <  -2  (other negative system capability layer: any cell — MGMT channels on M-10 (0,0,1)/(0,0,2), cognition on M-12, etc.)
// Security: hasHostPrivileges = model.id<0 gates caller side; positive-model handlers have ctx.hostApi=null so can't abuse.
// Signature errors (R22): return {ok:false}, never throw.
function crossModelTargetCheck(modelId, p, r, c) {
  if (!Number.isInteger(modelId)) return { ok: false, code: 'invalid_target', detail: 'modelId must be integer' };
  if (!Number.isInteger(p) || !Number.isInteger(r) || !Number.isInteger(c)) {
    return { ok: false, code: 'invalid_target', detail: 'p/r/c must be integer' };
  }
  if (modelId === -1) {
    if (p === 0 && r === 0 && c === 1) return { ok: true };
    return { ok: false, code: 'invalid_target_white_list', detail: 'Model -1 only (0,0,1) mailbox' };
  }
  if (modelId === -2) {
    if (p === 0 && r === 0 && c === 0) return { ok: true };
    return { ok: false, code: 'invalid_target_white_list', detail: 'Model -2 only (0,0,0) root' };
  }
  if (modelId === 0) {
    if (p === 0 && r === 0 && c === 0) return { ok: true };
    return { ok: false, code: 'invalid_target_white_list', detail: 'Model 0 only (0,0,0) root' };
  }
  if (modelId > 0) return { ok: true };
  // Other negative (<-2): system capability layer — any cell allowed.
  return { ok: true };
}

export function buildCrossModelHostApiMethods(runtime) {
  const writeCrossModel = (modelId, p, r, c, k, t, v) => {
    const gate = crossModelTargetCheck(modelId, p, r, c);
    if (!gate.ok) return gate;
    if (typeof k !== 'string' || !k) return { ok: false, code: 'invalid_label_key', detail: 'k must be non-empty string' };
    if (typeof t !== 'string' || !t) return { ok: false, code: 'invalid_label_type', detail: 't must be non-empty string' };
    const model = runtime.getModel(modelId);
    if (!model) return { ok: false, code: 'model_not_found', detail: `modelId=${modelId}` };
    try {
      runtime.addLabel(model, p, r, c, { k, t, v });
      return { ok: true };
    } catch (err) {
      return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
    }
  };

  const readCrossModel = (modelId, p, r, c, k) => {
    const gate = crossModelTargetCheck(modelId, p, r, c);
    if (!gate.ok) return gate;
    if (typeof k !== 'string' || !k) return { ok: false, code: 'invalid_label_key', detail: 'k must be non-empty string' };
    const model = runtime.getModel(modelId);
    if (!model) return { ok: false, code: 'model_not_found', detail: `modelId=${modelId}` };
    try {
      const cell = runtime.getCell(model, p, r, c);
      const lbl = cell && cell.labels ? cell.labels.get(k) : null;
      return { ok: true, data: lbl ? { t: lbl.t, v: lbl.v } : null };
    } catch (err) {
      return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
    }
  };

  const rmCrossModel = (modelId, p, r, c, k) => {
    const gate = crossModelTargetCheck(modelId, p, r, c);
    if (!gate.ok) return gate;
    if (typeof k !== 'string' || !k) return { ok: false, code: 'invalid_label_key', detail: 'k must be non-empty string' };
    const model = runtime.getModel(modelId);
    if (!model) return { ok: false, code: 'model_not_found', detail: `modelId=${modelId}` };
    try {
      runtime.rmLabel(model, p, r, c, k);
      return { ok: true };
    } catch (err) {
      return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
    }
  };

  const setMqttTargetConfig = (host, port, clientId) => {
    if (typeof host !== 'string' || !host.trim()) {
      return { ok: false, code: 'invalid_target', detail: 'host must be non-empty string' };
    }
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      return { ok: false, code: 'invalid_target', detail: 'port must be integer 1-65535' };
    }
    if (typeof clientId !== 'string' || !clientId.trim()) {
      return { ok: false, code: 'invalid_target', detail: 'clientId must be non-empty string' };
    }
    const model0 = runtime.getModel(0);
    if (!model0) return { ok: false, code: 'model_not_found', detail: 'Model 0 not initialized' };
    // M1: atomic apply — build triple, then write all or none (rollback on partial failure).
    const prepared = [
      { k: 'mqtt_target_host', t: 'str', v: host.trim() },
      { k: 'mqtt_target_port', t: 'int', v: port },
      { k: 'mqtt_target_client_id', t: 'str', v: clientId.trim() },
    ];
    const priorValues = prepared.map((entry) => {
      const cell = runtime.getCell(model0, 0, 0, 0);
      const prior = cell && cell.labels ? cell.labels.get(entry.k) : null;
      return prior ? { k: entry.k, t: prior.t, v: prior.v } : null;
    });
    let writtenCount = 0;
    try {
      for (const entry of prepared) {
        runtime.addLabel(model0, 0, 0, 0, entry);
        writtenCount += 1;
      }
      return { ok: true };
    } catch (err) {
      for (let i = 0; i < writtenCount; i += 1) {
        const prior = priorValues[i];
        if (prior) {
          runtime.addLabel(model0, 0, 0, 0, prior);
        } else {
          runtime.rmLabel(model0, 0, 0, 0, prepared[i].k);
        }
      }
      return { ok: false, code: 'exception', detail: String(err && err.message ? err.message : err) };
    }
  };

  return { writeCrossModel, readCrossModel, rmCrossModel, setMqttTargetConfig };
}

export {
  buildClientSnapshot,
  buildClientSnapshotForPrincipal,
  buildClientSnapshotPatchMessage,
  buildClientSnapshotProfile,
  buildClientSnapshotProfileStats,
  buildClientSnapshotProfileWithStats,
  buildSlideAppExportPayload,
  buildSlideAppExportZip,
  createPrincipalRuntimeRegistry,
  createServerState,
  deriveWorkspaceRegistryFromSnapshot,
  handleSlideAppExportRequest,
  handleMediaUploadRequest,
  handleMatrixMediaProxyRequest,
  parsePinPayloadRecordEnvelope,
  startServer,
};

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  startServer({
    port: process.env.PORT ? Number(process.env.PORT) : 9000,
    corsOrigin: process.env.CORS_ORIGIN || null,
  });
}
