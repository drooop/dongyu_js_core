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
import { readMatrixBootstrapConfig } from '../worker-base/src/bootstrap_config.mjs';
import { createLocalBusAdapter } from '../ui-model-demo-frontend/src/local_bus_adapter.js';
import { buildEditorAstV1, buildAstFromSchema } from '../ui-model-demo-frontend/src/demo_modeltable.js';
import { GALLERY_MAILBOX_MODEL_ID, GALLERY_STATE_MODEL_ID } from '../ui-model-demo-frontend/src/model_ids.js';
import {
  getSession, getSessionWithToken, isAuthenticated, loginWithMatrix, logout,
  makeSetCookieHeader, makeClearCookieHeader,
  loadHomeservers, addHomeserver, removeHomeserver,
  checkLoginRateLimit,
} from './auth.mjs';
import {
  normalizeFilltablePolicy,
  validateFilltableCandidateChanges,
  buildFilltableDigest,
  evaluateApplyPreviewGuard,
} from './filltable_policy.mjs';

const require = createRequire(import.meta.url);
const { loadProgramModelFromSqlite } = require('../worker-base/src/program_model_loader.js');
const { createSqlitePersister } = require('../worker-base/src/modeltable_persistence_sqlite.js');
const { initDataModel } = require('../worker-base/src/data_models.js');
const { createMatrixLiveAdapter } = require('../worker-base/src/matrix_live.js');

const EDITOR_MODEL_ID = -1;
const EDITOR_STATE_MODEL_ID = -2;
const LOGIN_MODEL_ID = -3;
const TRACE_MODEL_ID = -100;
// Monotonic sequence counter for trace events (module-level, survives across calls).
let _traceSeq = 0;
const MEDIA_CACHE_TTL_MS = 15 * 60 * 1000;
const mediaUploadCache = new Map();

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
  'Output shape:',
  '{"proposal":{"summary":"...","operations":["..."],"queries":["..."],"requires_confirmation":true,"confirmation_question":"..."},"candidate_changes":[{"action":"set_label","target":{"model_id":100,"p":0,"r":0,"c":0,"k":"title"},"label":{"t":"str","v":"Demo"},"owner_hint":"modeltable_local_owner"}],"confidence":0.0,"reasoning":"..."}',
  'Rules:',
  '- JSON only, no markdown, no prose before or after JSON',
  '- operations and queries may be arrays of strings',
  '- candidate_changes only support action=set_label/remove_label',
  '- set_label requires target.model_id,target.p,target.r,target.c,target.k and label.t,label.v',
  '- remove_label requires target.model_id,target.p,target.r,target.c,target.k',
  '- max changes is 10',
  '- query-only requests must use candidate_changes: [] and put reads in proposal.queries',
  '- target.model_id must be one of available positive model ids',
  '- do not target model_id=0 or any negative model_id in candidate_changes',
  '- obey policy.allowed_label_types and policy.allow_structural_types',
  '- Structural t (func.js/func.python/pin.connect.label/pin.connect.cell/pin.connect.model/pin.bus.in/pin.bus.out/pin.table.in/pin.table.out/pin.single.in/pin.single.out/model.single/model.matrix/model.table/submt) are forbidden unless policy.allow_structural_types=true',
  '- pin.table.in / pin.table.out are for table-or-matrix models, and pin.single.in / pin.single.out are for model.single',
  '- For func.js/func.python, v must be object and include non-empty string field code',
  '- For pin.connect.*, v must be an array',
  '- For pin.bus.* / pin.table.* / pin.single.*, v must be JSON-serializable; use null for declaration-only ports when appropriate',
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

// Lightweight snapshot for SSE/client: excludes internal-only labels that bloat payload.
// Filters: snapshot_json (1.5MB recursive), event_log, trace entry cells, function code.
const INTERNAL_LABEL_TYPES = new Set([
  'func.js',
  'func.python',
  'pin.connect.label',
  'pin.connect.cell',
  'pin.connect.model',
  'pin.in',
  'pin.out',
  'pin.bus.in',
  'pin.bus.out',
  'pin.table.in',
  'pin.table.out',
  'pin.single.in',
  'pin.single.out',
  'submt',
  'MQTT_WILDCARD_SUB',
]);
const EXCLUDED_LABEL_KEYS = new Set(['snapshot_json', 'event_log']);
const CLIENT_SECRET_LABEL_KEYS = new Set([
  'matrix_token',
  'matrix_passwd',
]);
const CLIENT_SECRET_LABEL_TYPES = new Set([
  'matrix.token',
  'matrix.passwd',
]);

function isClientSecretLabel(labelKey, labelValue) {
  if (CLIENT_SECRET_LABEL_KEYS.has(labelKey)) return true;
  if (labelValue && CLIENT_SECRET_LABEL_TYPES.has(labelValue.t)) return true;
  if (typeof labelKey === 'string' && /(?:^|_)(token|passwd|password|secret)$/.test(labelKey)) return true;
  return false;
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
          if (excludeTypes.has(lv.t)) continue;
          if (isClientSecretLabel(lk, lv)) continue;
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
          if (excludeKeys.has(lk)) continue;
          if (isClientSecretLabel(lk, lv)) continue;
          filteredLabels[lk] = lv;
        }
        filteredCells[ck] = { ...cell, labels: filteredLabels };
      }
      models[id] = { ...model, cells: filteredCells };
      continue;
    }
    const filteredCells = {};
    for (const [ck, cell] of Object.entries(model.cells || {})) {
      const filteredLabels = {};
      for (const [lk, lv] of Object.entries(cell.labels || {})) {
        if (isClientSecretLabel(lk, lv)) continue;
        filteredLabels[lk] = lv;
      }
      filteredCells[ck] = { ...cell, labels: filteredLabels };
    }
    models[id] = { ...model, cells: filteredCells };
  }
  return { models, v1nConfig: snap.v1nConfig };
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
  if (cell.labels.has(key)) {
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
  let preferred = 100;
  if (Number.isInteger(configDefault)) {
    preferred = configDefault;
  } else {
    const parsed = Number.parseInt(String(readAuthString(configDefault)), 10);
    if (Number.isInteger(parsed)) preferred = parsed;
  }
  if (apps.some((app) => app && app.model_id === preferred)) return preferred;
  const firstPositive = apps.find((app) => app && Number.isInteger(app.model_id) && app.model_id > 0);
  return firstPositive ? firstPositive.model_id : (apps.length > 0 ? apps[0].model_id : 0);
}

function overwriteRuntimeLabel(runtime, modelId, p, r, c, key, t, v) {
  const model = runtime.getModel(modelId);
  if (!model) return;
  const cell = runtime.getCell(model, p, r, c);
  if (cell.labels.has(key)) {
    runtime.rmLabel(model, p, r, c, key);
  }
  runtime.addLabel(model, p, r, c, { k: key, t, v });
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
  const fnLabel = listSystemLabels(runtime, (label) => isFunctionLikeLabelType(label.t))[0];
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
    this.matrixAdapter = null;
    this.matrixAdapterUnsub = null;
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

  async init() {
    this.refreshFunctionRegistry();
    this.refreshMatrixBootstrapConfig();
    if (typeof this.runtime.isRunLoopActive === 'function' && this.runtime.isRunLoopActive()) {
      await this.ensureMatrixAdapter();
    }
    this.started = true;
  }

  async activateRunning() {
    await this.ensureMatrixAdapter();
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
    emitTrace(this.runtime, {
      hop: 'server\u2192matrix', direction: 'outbound',
      op_id: payload && payload.op_id ? payload.op_id : '',
      model_id: payload && payload.model_id != null ? payload.model_id : '',
      summary: `type=${payload && payload.type ? payload.type : '?'}`,
      payload,
    });
    if ((typeof this.runtime.isRunLoopActive === 'function' && !this.runtime.isRunLoopActive())
      || !this.matrixAdapter || !this.matrixRoomId) {
      console.log('[sendMatrix] WARN: matrix_not_ready, skipping send');
      return null;
    }
    if (!this.matrixDmPeerUserId) {
      console.log('[sendMatrix] WARN: matrix_dm_peer_user_id_required, skipping send');
      return null;
    }
    await this.matrixAdapter.publish(payload);
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

        // Write patch to the model's root input label using the current model form semantics.
        const pinName = dbLabel.v.patch_in_pin || 'patch';
        const rootPinType = typeof this.runtime._modelInputLabelType === 'function'
          ? this.runtime._modelInputLabelType(targetModel)
          : 'pin.table.in';
        console.log(`[handleDyBusEvent] Writing patch to Model ${modelId} (${pinName}) at cell(${modelId},0,0,0)`);
        this.runtime.addLabel(targetModel, 0, 0, 0, { k: pinName, t: rootPinType, v: patch });
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

    if (content.type === 'ui_event') {
      // Echo of our own Matrix send — ignore in server return path.
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
        if (!this.matrixAdapter || !this.matrixRoomId || !this.matrixDmPeerUserId) {
          return null;
        }
        return this.sendMatrix(payload);
      },
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
            return { ok: true, data: { html } };
          } catch (err) {
            return {
              ok: false,
              code: 'exception',
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
            this.runtime.addLabel(model, 0, 0, 0, { k: 'ws_deleted', t: 'bool', v: false });
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
          try {
            this.runtime.rmLabel(targetModel, 0, 0, 0, 'app_name');
            this.runtime.rmLabel(targetModel, 0, 0, 0, 'dual_bus_model');
            this.runtime.addLabel(targetModel, 0, 0, 0, { k: 'ws_deleted', t: 'bool', v: true });
            return { ok: true, data: { model_id: targetId } };
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

      // UI event in mailbox -> trigger mapped forward function(s)
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
        console.log('[processEventsSnapshot] ui_event MATCHED! Resolving event_trigger_map...');
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

        if (triggered === 0) {
          console.log('[processEventsSnapshot] WARNING: no available ui_event trigger, sys=', !!sys);
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

      // Model 0 local egress point: color-generator submit has already been
      // normalized and relayed upward through existing model-boundary wiring.
      if (event.cell && event.cell.model_id === 0 &&
          event.cell.p === 0 && event.cell.r === 0 && event.cell.c === 0 &&
          event.label && event.label.k === 'model100_submit_out' && event.label.v) {
        const payload = event.label.v;
        if (!payload || payload.source_model_id !== 100) {
          console.log('[processEventsSnapshot] WARNING: model100_submit_out missing source_model_id=100');
          continue;
        }
        const sys = firstSystemModel(this.runtime);
        const funcName = 'forward_model100_submit_from_model0';
        console.log('[processEventsSnapshot] Model 0 egress detected, triggering forward_model100_submit_from_model0');
        if (sys && sys.hasFunction(funcName)) {
          this.runtime.intercepts.record('run_func', { func: funcName, payload });
        } else {
          console.log(`[processEventsSnapshot] WARNING: ${funcName} function NOT found`);
        }
        continue;
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

function currentTopic(runtime, pinName) {
  const config = runtime._getConfigFromPage0();
  const prefix = config.topic_prefix || '';
  if (prefix) return `${prefix}/${pinName}`;
  return pinName;
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

function isUiLocalMutableModelId(modelId) {
  return modelId === EDITOR_STATE_MODEL_ID
    || modelId === LOGIN_MODEL_ID
    || modelId === GALLERY_STATE_MODEL_ID;
}

function createServerState(options) {
  const dbPath = options && options.dbPath ? String(options.dbPath) : null;
  const runtime = new ModelTableRuntime();

  ensureDir(DOCS_ROOT);
  ensureDir(STATIC_PROJECTS_ROOT);
  if (dbPath) {
    ensureDir(path.dirname(dbPath));
  }

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
  loadFullModelPatches(runtime, systemModelsDir, ['server_config.json']);
  const positiveModelCountBeforeSeed = countPositiveModels(runtime);
  if (positiveModelCountBeforeSeed === 0) {
    loadFullModelPatches(runtime, systemModelsDir, [
      'workspace_positive_models.json',
      'test_model_100_ui.json',
    ]);
  } else {
    console.log(`[createServerState] skip positive seed patches (existing_positive_models=${positiveModelCountBeforeSeed})`);
  }

  const envPatch = readModelTablePatchFromEnv();
  if (envPatch) {
    runtime.applyPatch(envPatch, { allowCreateModel: true, trustedBootstrap: true });
  }
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
  ensureStateLabel(runtime, 'ws_new_app_name', 'str', '');
  ensureStateLabel(runtime, 'ws_delete_app_id', 'int', 0);
  ensureStateLabel(runtime, 'ws_status', 'str', '');

  // Prompt FillTable page state.
  ensureStateLabel(runtime, 'llm_prompt_text', 'str', '');
  ensureStateLabel(runtime, 'llm_prompt_preview_json', 'json', {});
  ensureStateLabel(runtime, 'llm_prompt_preview_id', 'str', '');
  ensureStateLabel(runtime, 'llm_prompt_preview_digest', 'str', '');
  ensureStateLabel(runtime, 'llm_prompt_apply_preview_id', 'str', '');
  ensureStateLabel(runtime, 'llm_prompt_apply_result_json', 'json', {});
  ensureStateLabel(runtime, 'llm_prompt_status', 'str', '');
  ensureStateLabel(runtime, 'llm_prompt_last_applied_preview_id', 'str', '');
  ensureStateLabel(runtime, 'llm_prompt_available', 'bool', false);
  ensureStateLabel(runtime, 'llm_prompt_notice', 'str', '正在检测 LLM 服务...');

  const deriveWorkspaceRegistry = () => {
    const derived = [];
    const seen = new Set();
    const excludedModelIds = new Set([
      EDITOR_MODEL_ID,
      EDITOR_STATE_MODEL_ID,
      LOGIN_MODEL_ID,
      -10, // system model (functions / mgmt), never a Workspace app
      GALLERY_MAILBOX_MODEL_ID,
      GALLERY_STATE_MODEL_ID,
    ]);

    const addOrReplace = (entry) => {
      if (!entry || !Number.isInteger(entry.model_id)) return;
      if (entry.model_id === 0) return;
      if (excludedModelIds.has(entry.model_id)) return;
      const existing = derived.find((item) => item.model_id === entry.model_id);
      if (existing) {
        Object.assign(existing, entry);
        return;
      }
      derived.push(entry);
      seen.add(entry.model_id);
    };

    const snap = runtime.snapshot();
    const models = snap && snap.models ? snap.models : {};
    for (const [idText, modelSnap] of Object.entries(models)) {
      const modelId = Number(idText);
      if (!Number.isInteger(modelId) || modelId === 0) continue;
      if (seen.has(modelId)) continue;
      if (excludedModelIds.has(modelId)) continue;
      const rootLabels = modelSnap && modelSnap.cells && modelSnap.cells['0,0,0'] && modelSnap.cells['0,0,0'].labels
        ? modelSnap.cells['0,0,0'].labels
        : {};
      if (rootLabels.ws_deleted && rootLabels.ws_deleted.v === true) continue;
      // For positive models, accept either explicit app signals (app_name/dual_bus_model)
      // or a schema cell (1,0,0). For negative models, only accept explicit app_name.
      const hasAppSignals = modelId > 0
        ? Boolean(rootLabels.app_name || rootLabels.dual_bus_model || (modelSnap && modelSnap.cells && modelSnap.cells['1,0,0']))
        : Boolean(rootLabels.app_name);
      if (!hasAppSignals) continue;
      const name = rootLabels.app_name && typeof rootLabels.app_name.v === 'string' && rootLabels.app_name.v.trim()
        ? rootLabels.app_name.v
        : (modelSnap && typeof modelSnap.name === 'string' && modelSnap.name.trim()
          ? modelSnap.name
          : `App ${modelId}`);
      const source = rootLabels.source_worker && typeof rootLabels.source_worker.v === 'string'
        ? rootLabels.source_worker.v
        : '';
      addOrReplace({ model_id: modelId, name, source });
    }
    derived.sort((a, b) => a.model_id - b.model_id);
    return derived;
  };

  const normalizeIntState = (value, fallback) => {
    if (Number.isInteger(value)) return value;
    const str = readAuthString(value);
    if (!str) return fallback;
    const parsed = Number.parseInt(str, 10);
    if (Number.isInteger(parsed)) return parsed;
    return fallback;
  };

  const refreshWorkspaceStateCatalog = () => {
    const apps = deriveWorkspaceRegistry();
    const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
    overwriteStateLabel(runtime, 'ws_apps_registry', 'json', apps);

    const defaultSelected = resolveDefaultAppId(runtime, apps);
    const selected = normalizeIntState(runtime.getLabelValue(stateModel, 0, 0, 0, 'ws_app_selected'), defaultSelected);
    const validSelected = apps.some((app) => app.model_id === selected) ? selected : defaultSelected;
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
    const selected = normalizeIntState(runtime.getLabelValue(stateModel, 0, 0, 0, 'ws_app_selected'), defaultSelected);
    const validSelected = apps.some((app) => app.model_id === selected) ? selected : defaultSelected;
    overwriteStateLabel(runtime, 'ws_app_selected', 'int', Number(validSelected));
    overwriteStateLabel(runtime, 'selected_model_id', 'str', String(validSelected));
  };

  const sanitizeStartupCatalogState = () => {
    overwriteStateLabel(runtime, 'docs_query', 'str', '');
    overwriteStateLabel(runtime, 'docs_tree_json', 'json', []);
    overwriteStateLabel(runtime, 'docs_search_results_json', 'json', []);
    overwriteStateLabel(runtime, 'docs_selected_path', 'str', '');
    overwriteStateLabel(runtime, 'docs_status', 'str', '');
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
    overwriteRuntimeLabel(runtime, EDITOR_MODEL_ID, 0, 0, 1, 'ui_event', 'event', null);
    overwriteRuntimeLabel(runtime, EDITOR_MODEL_ID, 0, 0, 1, 'ui_event_last_op_id', 'str', '');
    overwriteRuntimeLabel(runtime, EDITOR_MODEL_ID, 0, 0, 1, 'ui_event_error', 'json', null);
    overwriteRuntimeLabel(runtime, EDITOR_MODEL_ID, 0, 0, 2, 'ui_event', 'event', null);

    const snap = runtime.snapshot();
    const models = snap && snap.models ? snap.models : {};
    for (const idText of Object.keys(models)) {
      const modelId = Number(idText);
      if (!Number.isInteger(modelId) || modelId < 0) continue;
      const model = runtime.getModel(modelId);
      if (!model) continue;
      overwriteRuntimeLabel(runtime, modelId, 0, 0, 2, 'ui_event', 'event', null);
      overwriteRuntimeLabel(runtime, modelId, 0, 0, 2, 'ui_event_last_op_id', 'str', '');
      overwriteRuntimeLabel(runtime, modelId, 0, 0, 2, 'ui_event_error', 'json', null);
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
  refreshWorkspaceStateCatalog();
  reconcileWorkspaceSelectionState();
  refreshStartupCatalogState();
  runtime.setRuntimeMode('edit');

  const clearAndRefreshAfterRuntimeBoot = async () => {
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
    try {
      refreshWorkspaceStateCatalog();
      reconcileWorkspaceSelectionState();
    } catch (_) {
      overwriteStateLabel(runtime, 'static_status', 'str', 'workspace catalog refresh failed');
    }
    try {
      const availability = await probeLlmPromptAvailability(runtime);
      overwriteLlmPromptAvailabilityState(runtime, availability);
    } catch (_) {
      overwriteStateLabel(runtime, 'llm_prompt_available', 'bool', false);
      overwriteStateLabel(runtime, 'llm_prompt_notice', 'str', '当前暂不可用：LLM 服务检测失败。');
    }
  };

  const editorEventLog = [];
  const adapter = createLocalBusAdapter({ runtime, eventLog: editorEventLog, mode: 'v1' });
  const programEngine = new ProgramModelEngine(runtime);
  programEngine._wsRefreshCatalog = refreshWorkspaceStateCatalog;
  const programEngineReady = programEngine.init()
    .then(() => programEngine.tick())
    .then(() => clearAndRefreshAfterRuntimeBoot())
    .catch(() => {});

  function updateDerived() {
    // Client-visible AST must be derived from the same filtered snapshot surface
    // that /snapshot and SSE expose, otherwise raw labels can leak via ui_ast_v0.
    const uiAst = buildEditorAstV1(buildClientSnapshot(runtime));
    // snapshot_json and event_log are excluded from client snapshot (too large).
    // Skip expensive computation — saves ~2 full snapshot traversals per event.
    adapter.updateUiDerived({
      uiAst,
      snapshotJson: '',
      eventLogJson: '',
    });
  }

  programEngineReady.then(() => {
    updateDerived();
    if (typeof programEngine.onSnapshotChanged === 'function') {
      programEngine.onSnapshotChanged();
    }
  }).catch(() => {});

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
    const meta = payload && payload.meta && typeof payload.meta === 'object' ? payload.meta : null;
    const opId = meta && typeof meta.op_id === 'string' ? meta.op_id : '';

    if (envelopeOrNull) {
      await programEngineReady;
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

    setMailboxEnvelope(runtime, envelopeOrNull);

    const finishOk = async () => {
      runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_error', t: 'json', v: null });
      runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_last_op_id', t: 'str', v: opId });
      runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event', t: 'event', v: null });
      updateDerived();
      await programEngine.tick();
      return { consumed: true, result: 'ok' };
    };

    const finishError = async (code, detail) => {
      runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, {
        k: 'ui_event_error',
        t: 'json',
        v: { op_id: opId, code, detail },
      });
      runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_last_op_id', t: 'str', v: opId });
      runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event', t: 'event', v: null });
      updateDerived();
      return { consumed: true, result: 'error', code, detail };
    };

    const businessTargetModelId = meta && Number.isInteger(meta.model_id) ? meta.model_id : null;
    const directMutationTarget = payload && payload.target && typeof payload.target === 'object' && Number.isInteger(payload.target.model_id)
      ? payload.target.model_id
      : null;
    const allowUiLocalMutation = isUiLocalMutableModelId(directMutationTarget);
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
      const eventValue = payload && payload.value && payload.value.t === 'event'
        ? payload.value.v
        : (payload && payload.value && payload.value.t === 'json' ? payload.value.v : null);
      const normalizedEvent = eventValue && typeof eventValue === 'object'
        ? { ...eventValue }
        : {};
      if (!normalizedEvent.action) normalizedEvent.action = action;
      if (!normalizedEvent.meta) normalizedEvent.meta = meta || {};
      runtime.addLabel(targetModel, 0, 0, 2, { k: 'ui_event', t: 'event', v: normalizedEvent });
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
                runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, {
                  k: 'ui_event_error',
                  t: 'json',
                  v: {
                    op_id: opId,
                    code: 'low_confidence',
                    detail,
                    candidates: llmDispatch.candidates,
                  },
                });
                runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_last_op_id', t: 'str', v: opId });
                runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event', t: 'event', v: null });
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

      // Step 3 dual-track: dispatch table first, legacy action-prefix as fallback.
      if (typeof resolvedFunc === 'string' && resolvedFunc.trim().length > 0 &&
          sysModel && sysModel.hasFunction(resolvedFunc)) {
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
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_error', t: 'json', v: null });
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
          runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, {
            k: 'ui_event_error',
            t: 'json',
            v: { op_id: opId, code: 'func_exception', detail: String(funcErr) },
          });
        }
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_last_op_id', t: 'str', v: opId });
        if (!getEventError(runtime)) {
          runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event_error', t: 'json', v: null });
        }
        runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, { k: 'ui_event', t: 'event', v: null });
        updateDerived();
        await programEngine.tick();
        const errValue = getEventError(runtime);
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
    reconcileWorkspaceSelectionState();
    updateDerived();
    await programEngine.tick();
    return result;
    } catch (err) {
      const errMeta = payload && payload.meta ? payload.meta : null;
      const errOpId = errMeta && typeof errMeta.op_id === 'string' ? errMeta.op_id : '';
      runtime.addLabel(runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1, {
        k: 'ui_event_error',
        t: 'json',
        v: { op_id: errOpId, code: 'exception', detail: String(err && err.message ? err.message : err) },
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
    updateDerived();
    await programEngine.tick();
    return { applied, rejected };
  }

  async function activateRuntimeMode(mode) {
    runtime.setRuntimeMode(mode);
    if (mode === 'running') {
      await programEngineReady;
      await programEngine.activateRunning();
      await programEngine.tick();
    }
    updateDerived();
    return { mode: runtime.getRuntimeMode() };
  }

  return {
    runtime,
    snapshot,
    clientSnap,
    submitEnvelope,
    applyModelTablePatch,
    activateRuntimeMode,
    getRuntimeMode: () => runtime.getRuntimeMode(),
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

    // ── Matrix media upload (UI upload_media primitive) ─────────────────
    if (req.method === 'POST' && url.pathname === '/api/media/upload') {
      if (AUTH_ENABLED && !isAuthenticated(req)) {
        writeJson(res, 401, { ok: false, error: 'not_authenticated' }, cors);
        return;
      }
      const session = getSessionWithToken(req);
      const uploadIdentity = (session && session.accessToken && session.homeserverUrl)
        ? {
          homeserverUrl: session.homeserverUrl,
          accessToken: session.accessToken,
          userId: session.userId || '',
        }
        : (!AUTH_ENABLED
          ? {
            homeserverUrl: firstValidValue(process.env.MATRIX_HOMESERVER_URL),
            accessToken: firstValidValue(
              process.env.MATRIX_MBR_BOT_ACCESS_TOKEN,
              process.env.MATRIX_MBR_ACCESS_TOKEN,
            ),
            userId: firstValidValue(process.env.MATRIX_MBR_BOT_USER, process.env.MATRIX_MBR_USER),
          }
          : null);
      if (!uploadIdentity || !uploadIdentity.accessToken || !uploadIdentity.homeserverUrl) {
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
      return;
    }

    // ── Auth guard ───────────────────────────────────────────────────────
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
            code: consumeResult && consumeResult.code ? consumeResult.code : undefined,
            detail: consumeResult && consumeResult.detail ? consumeResult.detail : undefined,
            routed_by: consumeResult && consumeResult.routed_by ? consumeResult.routed_by : undefined,
            confidence: consumeResult && Number.isFinite(consumeResult.confidence) ? consumeResult.confidence : undefined,
            candidates: consumeResult && Array.isArray(consumeResult.candidates) ? consumeResult.candidates : undefined,
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

    if (req.method === 'POST' && url.pathname === '/api/runtime/mode') {
      try {
        const body = await readJsonBody(req);
        const nextMode = body && typeof body.mode === 'string' ? body.mode : '';
        if (nextMode !== 'running') {
          writeJson(res, 400, { ok: false, error: 'invalid_mode_transition' }, cors);
          return;
        }
        const result = await state.activateRuntimeMode(nextMode);
        broadcastSnapshot();
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
    process.stdout.write(`ui-model-demo-server listening on http://${host}:${port}\n`);
  });

  return server;
}

startServer({
  port: process.env.PORT ? Number(process.env.PORT) : 9000,
  corsOrigin: process.env.CORS_ORIGIN || null,
});
