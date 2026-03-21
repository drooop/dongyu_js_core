import { createHash } from 'node:crypto';

const DEFAULT_ALLOWED_LABEL_TYPES = ['str', 'int', 'float', 'bool', 'json', 'event'];
const STRUCTURAL_LABEL_TYPES = new Set([
  'func.js',
  'func.python',
  'pin.connect.label',
  'pin.connect.cell',
  'pin.connect.model',
  'pin.bus.in',
  'pin.bus.out',
  'pin.table.in',
  'pin.table.out',
  'pin.single.in',
  'pin.single.out',
  'model.single',
  'model.matrix',
  'model.table',
  'submt',
]);
const DEFAULT_PROTECTED_LABEL_KEYS = [
  'ui_event',
  'ui_event_error',
  'ui_event_last_op_id',
  'intent.v0',
  'snapshot_json',
  'event_log',
  'dual_bus_model',
  'run_mgmt_send',
  'run_intent_dispatch',
  'mgmt_inbox',
  'mgmt_func_error',
];

export const DEFAULT_FILLTABLE_POLICY = Object.freeze({
  allow_positive_model_ids: true,
  allow_negative_model_ids: false,
  allow_structural_types: false,
  max_changes_per_apply: 10,
  max_value_bytes: 64 * 1024,
  max_total_bytes: 256 * 1024,
  allowed_label_types: DEFAULT_ALLOWED_LABEL_TYPES,
  protected_label_keys: DEFAULT_PROTECTED_LABEL_KEYS,
});

function readInt(value, fallback) {
  if (Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return fallback;
}

function readNumber(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toStringSet(value, fallback) {
  const arr = Array.isArray(value) ? value : fallback;
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const key = item.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function byteSize(value) {
  if (value === undefined) return 0;
  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch (_) {
    return Number.POSITIVE_INFINITY;
  }
}

function normalizeTypedValue(typeName, rawValue) {
  if (typeName === 'func.js' || typeName === 'func.python') {
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      return { ok: false, code: 'invalid_func_value' };
    }
    const code = typeof rawValue.code === 'string' ? rawValue.code : '';
    if (!code.trim()) {
      return { ok: false, code: 'invalid_func_value' };
    }
    const normalized = { ...rawValue, code };
    try {
      JSON.stringify(normalized);
      return { ok: true, value: normalized };
    } catch (_) {
      return { ok: false, code: 'invalid_func_value' };
    }
  }
  if (typeName === 'pin.connect.label' || typeName === 'pin.connect.cell' || typeName === 'pin.connect.model') {
    if (!Array.isArray(rawValue)) {
      return { ok: false, code: 'invalid_connect_value' };
    }
    return { ok: true, value: rawValue };
  }
  if (
    typeName === 'pin.bus.in'
    || typeName === 'pin.bus.out'
    || typeName === 'pin.table.in'
    || typeName === 'pin.table.out'
    || typeName === 'pin.single.in'
    || typeName === 'pin.single.out'
  ) {
    try {
      JSON.stringify(rawValue);
      return { ok: true, value: rawValue };
    } catch (_) {
      return { ok: false, code: 'invalid_pin_value' };
    }
  }
  if (typeName === 'model.single' || typeName === 'model.matrix' || typeName === 'model.table') {
    if (typeof rawValue !== 'string' || !rawValue.trim()) {
      return { ok: false, code: 'invalid_model_form_value' };
    }
    return { ok: true, value: rawValue.trim() };
  }
  if (typeName === 'submt') {
    try {
      JSON.stringify(rawValue);
      return { ok: true, value: rawValue };
    } catch (_) {
      return { ok: false, code: 'invalid_submt_value' };
    }
  }
  if (typeName === 'str') {
    return { ok: true, value: String(rawValue ?? '') };
  }
  if (typeName === 'int') {
    const intValue = readInt(rawValue, null);
    if (!Number.isSafeInteger(intValue)) {
      return { ok: false, code: 'invalid_int_value' };
    }
    return { ok: true, value: intValue };
  }
  if (typeName === 'float') {
    const num = readNumber(rawValue, null);
    if (!Number.isFinite(num)) return { ok: false, code: 'invalid_float_value' };
    return { ok: true, value: num };
  }
  if (typeName === 'bool') {
    if (typeof rawValue === 'boolean') return { ok: true, value: rawValue };
    if (typeof rawValue === 'string') {
      const text = rawValue.trim().toLowerCase();
      if (text === 'true') return { ok: true, value: true };
      if (text === 'false') return { ok: true, value: false };
    }
    return { ok: false, code: 'invalid_bool_value' };
  }
  if (typeName === 'json' || typeName === 'event') {
    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          return { ok: true, value: JSON.parse(trimmed) };
        } catch (_) {
          return { ok: false, code: 'invalid_json_value' };
        }
      }
    }
    try {
      JSON.stringify(rawValue);
      return { ok: true, value: rawValue };
    } catch (_) {
      return { ok: false, code: 'invalid_json_value' };
    }
  }
  return { ok: false, code: 'invalid_label_type' };
}

function normalizeTargetBase(target) {
  const model_id = readInt(target && target.model_id, null);
  const p = readInt(target && target.p, null);
  const r = readInt(target && target.r, null);
  const c = readInt(target && target.c, null);
  const k = target && typeof target.k === 'string' ? target.k.trim() : '';
  if (!Number.isInteger(model_id)) return { ok: false, code: 'invalid_model_id' };
  if (!Number.isInteger(p) || !Number.isInteger(r) || !Number.isInteger(c)) {
    return { ok: false, code: 'invalid_coordinates' };
  }
  if (!k) return { ok: false, code: 'invalid_label_key' };
  return { ok: true, model_id, p, r, c, k };
}

function normalizeChangeAction(source) {
  return typeof source?.action === 'string' ? source.action.trim() : '';
}

export function normalizeFilltablePolicy(rawValue) {
  const raw = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
    ? rawValue
    : {};
  const maxChangesRaw = raw.max_changes_per_apply ?? raw.max_records_per_apply;
  return {
    allow_positive_model_ids: raw.allow_positive_model_ids !== false,
    allow_negative_model_ids: raw.allow_negative_model_ids === true,
    allow_structural_types: raw.allow_structural_types === true,
    max_changes_per_apply: Math.max(1, Math.min(256, readInt(maxChangesRaw, DEFAULT_FILLTABLE_POLICY.max_changes_per_apply))),
    max_value_bytes: Math.max(256, Math.min(4 * 1024 * 1024, readInt(raw.max_value_bytes, DEFAULT_FILLTABLE_POLICY.max_value_bytes))),
    max_total_bytes: Math.max(1024, Math.min(16 * 1024 * 1024, readInt(raw.max_total_bytes, DEFAULT_FILLTABLE_POLICY.max_total_bytes))),
    allowed_label_types: toStringSet(raw.allowed_label_types, DEFAULT_FILLTABLE_POLICY.allowed_label_types),
    protected_label_keys: toStringSet(raw.protected_label_keys, DEFAULT_FILLTABLE_POLICY.protected_label_keys),
  };
}

export function validateFilltableCandidateChanges(changesInput, policyInput) {
  const policy = normalizeFilltablePolicy(policyInput);
  const changes = Array.isArray(changesInput) ? changesInput : [];
  const accepted_changes = [];
  const rejected_changes = [];
  const allowedTypeSet = new Set(policy.allowed_label_types);
  const protectedKeySet = new Set(policy.protected_label_keys);
  let accepted_total_bytes = 0;

  for (let i = 0; i < changes.length; i += 1) {
    const source = changes[i];
    const index = i;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      rejected_changes.push({ index, code: 'invalid_change', detail: 'change_not_object', change: source });
      continue;
    }
    if (i >= policy.max_changes_per_apply) {
      rejected_changes.push({ index, code: 'too_many_changes', detail: `max_changes_per_apply=${policy.max_changes_per_apply}`, change: source });
      continue;
    }

    const action = normalizeChangeAction(source);
    if (action !== 'set_label' && action !== 'remove_label') {
      rejected_changes.push({ index, code: 'invalid_action', detail: 'only_set_label_or_remove_label', change: source });
      continue;
    }

    const base = normalizeTargetBase(source.target);
    if (!base.ok) {
      rejected_changes.push({ index, code: base.code, detail: base.code, change: source });
      continue;
    }
    if (base.model_id > 0 && !policy.allow_positive_model_ids) {
      rejected_changes.push({ index, code: 'model_id_not_allowed', detail: 'positive_model_id_forbidden', change: source });
      continue;
    }
    if (base.model_id < 0 && !policy.allow_negative_model_ids) {
      rejected_changes.push({ index, code: 'model_id_not_allowed', detail: 'negative_model_id_forbidden', change: source });
      continue;
    }
    if (base.model_id === 0) {
      rejected_changes.push({ index, code: 'model_id_not_allowed', detail: 'model_0_forbidden', change: source });
      continue;
    }
    if (protectedKeySet.has(base.k)) {
      rejected_changes.push({ index, code: 'protected_label_key', detail: base.k, change: source });
      continue;
    }

    const owner_hint = typeof source.owner_hint === 'string' && source.owner_hint.trim()
      ? source.owner_hint.trim()
      : undefined;

    if (action === 'remove_label') {
      accepted_changes.push({
        action: 'remove_label',
        target: {
          model_id: base.model_id,
          p: base.p,
          r: base.r,
          c: base.c,
          k: base.k,
        },
        ...(owner_hint ? { owner_hint } : {}),
      });
      continue;
    }

    const label = source.label && typeof source.label === 'object' && !Array.isArray(source.label)
      ? source.label
      : null;
    if (!label) {
      rejected_changes.push({ index, code: 'missing_label', detail: 'set_label_requires_label', change: source });
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(label, 'v')) {
      rejected_changes.push({ index, code: 'missing_label_value', detail: 'set_label_requires_label_v', change: source });
      continue;
    }
    const t = typeof label.t === 'string' ? label.t.trim() : '';
    const isStructuralType = STRUCTURAL_LABEL_TYPES.has(t);
    if (isStructuralType && !policy.allow_structural_types) {
      rejected_changes.push({ index, code: 'structural_label_type_forbidden', detail: t || 'missing_t', change: source });
      continue;
    }
    if (!isStructuralType && !allowedTypeSet.has(t)) {
      rejected_changes.push({ index, code: 'label_type_not_allowed', detail: t || 'missing_t', change: source });
      continue;
    }

    const typed = normalizeTypedValue(t, label.v);
    if (!typed.ok) {
      rejected_changes.push({ index, code: typed.code, detail: typed.code, change: source });
      continue;
    }
    const value_bytes = byteSize(typed.value);
    if (!Number.isFinite(value_bytes)) {
      rejected_changes.push({ index, code: 'invalid_value', detail: 'json_stringify_failed', change: source });
      continue;
    }
    if (value_bytes > policy.max_value_bytes) {
      rejected_changes.push({ index, code: 'value_too_large', detail: `max_value_bytes=${policy.max_value_bytes}`, change: source });
      continue;
    }
    if (accepted_total_bytes + value_bytes > policy.max_total_bytes) {
      rejected_changes.push({ index, code: 'total_too_large', detail: `max_total_bytes=${policy.max_total_bytes}`, change: source });
      continue;
    }

    accepted_total_bytes += value_bytes;
    accepted_changes.push({
      action: 'set_label',
      target: {
        model_id: base.model_id,
        p: base.p,
        r: base.r,
        c: base.c,
        k: base.k,
      },
      label: {
        t,
        v: typed.value,
      },
      ...(owner_hint ? { owner_hint } : {}),
    });
  }

  return {
    accepted_changes,
    rejected_changes,
    stats: {
      requested: changes.length,
      accepted: accepted_changes.length,
      rejected: rejected_changes.length,
      accepted_total_bytes,
    },
    policy,
  };
}

export function buildFilltableDigest(changes) {
  const payload = Array.isArray(changes) ? changes : [];
  const text = JSON.stringify(payload);
  return createHash('sha256').update(text || '[]').digest('hex');
}

export function evaluateApplyPreviewGuard(input) {
  const requested = typeof (input && input.requested_preview_id) === 'string'
    ? input.requested_preview_id.trim()
    : '';
  const latest = typeof (input && input.latest_preview_id) === 'string'
    ? input.latest_preview_id.trim()
    : '';
  const lastApplied = typeof (input && input.last_applied_preview_id) === 'string'
    ? input.last_applied_preview_id.trim()
    : '';

  if (!requested) {
    return { ok: false, code: 'missing_preview_id', detail: 'missing_preview_id' };
  }
  if (!latest) {
    return { ok: false, code: 'missing_preview', detail: 'missing_preview' };
  }
  if (requested !== latest) {
    return { ok: false, code: 'stale_preview', detail: 'stale_preview' };
  }
  if (lastApplied && requested === lastApplied) {
    return { ok: false, code: 'preview_replay', detail: 'preview_replay' };
  }
  return { ok: true };
}
